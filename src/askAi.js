import { getAskContext } from "./context.js";
import { streamCompletion } from "./providers.js";
import { buildUserContent, markdownToRoamBlocks } from "./text.mjs";

const STREAM_UPDATE_MS = 250;
let isRunning = false;

async function createChildBlock(parentUid, content, heading = 0) {
  const uid = window.roamAlphaAPI.util.generateUID();
  await window.roamAlphaAPI.createBlock({
    location: { "parent-uid": parentUid, order: "last" },
    block: { string: content, uid, open: true, heading },
  });
  return uid;
}

async function updateBlock(uid, content, heading = 0) {
  await window.roamAlphaAPI.updateBlock({
    block: { uid, string: content, heading },
  });
}

async function writeFinalResponse(parentUid, targetUid, fullText) {
  const blocks = markdownToRoamBlocks(fullText);
  if (!blocks.length) {
    await updateBlock(targetUid, "No response received.");
    return;
  }

  const [first, ...rest] = blocks;
  await updateBlock(targetUid, first.string, first.heading);
  const uidByDepth = [targetUid];
  let previousDepth = first.depth;

  for (const block of rest) {
    const depth = Math.min(block.depth, previousDepth + 1);
    const parent = depth === 0 ? parentUid : uidByDepth[depth - 1] || parentUid;
    const uid = await createChildBlock(parent, block.string, block.heading);
    uidByDepth[depth] = uid;
    uidByDepth.length = depth + 1;
    previousDepth = depth;
  }
}

export async function askAI(getSettings) {
  if (isRunning) return;
  const settings = getSettings();
  const { promptUid, prompt, contextText } = getAskContext();

  if (!promptUid || !prompt) {
    window.alert(
      "Jesse Roam AI: focus a block containing your request, optionally select context blocks, then run Ask AI again.",
    );
    return;
  }

  isRunning = true;
  let targetUid;
  try {
    targetUid = await createChildBlock(promptUid, "Thinking...");
    let fullText = "";
    let lastUpdate = 0;
    let pendingUpdate = Promise.resolve();

    const queuePreviewUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate < STREAM_UPDATE_MS) return;
      lastUpdate = now;
      const preview = fullText;
      pendingUpdate = pendingUpdate.then(() => updateBlock(targetUid, preview));
    };

    for await (const delta of streamCompletion({
      ...settings,
      userContent: buildUserContent({ prompt, contextText }),
    })) {
      fullText += delta;
      queuePreviewUpdate();
    }

    await pendingUpdate;
    await writeFinalResponse(promptUid, targetUid, fullText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Jesse Roam AI failed", error);
    if (targetUid) {
      await updateBlock(targetUid, `Error: ${message}`).catch(() => {});
    } else {
      window.alert(`Jesse Roam AI: ${message}`);
    }
  } finally {
    isRunning = false;
  }
}
