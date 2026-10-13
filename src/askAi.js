import { getAskContext } from "./context.mjs";
import { PROVIDER_LABELS, streamCompletion } from "./providers.js";
import {
  buildUserContent,
  CONTINUATION_GUIDANCE,
  frameResponse,
  markdownToRoamBlocks,
} from "./text.mjs";

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

async function writeFinalResponse(header, targetUid, fullText) {
  await updateBlock(targetUid, header);
  const blocks = markdownToRoamBlocks(fullText);
  if (!blocks.length) {
    await createChildBlock(targetUid, "No response received.");
    return;
  }

  // Every content block nests under the attribution block, which stays at
  // depth -1 as the root of this answer.
  const uidByDepth = [];
  let previousDepth = -1;

  for (const block of blocks) {
    const depth = Math.min(block.depth, previousDepth + 1);
    const parent = depth === 0 ? targetUid : uidByDepth[depth - 1] || targetUid;
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
      "Roam and Discover Superintelligence: focus a block containing your request, optionally select context blocks, then run Ask AI again.",
    );
    return;
  }

  isRunning = true;
  let targetUid;
  try {
    const providerLabel = PROVIDER_LABELS[settings.provider] || settings.provider;
    const header = frameResponse({
      providerLabel,
      model: settings.model,
      effort: settings.reasoningEffort,
      body: "",
    }).split("\n\n")[0];

    targetUid = await createChildBlock(promptUid, header);
    let fullText = "";
    let lastUpdate = 0;
    let pendingUpdate = Promise.resolve();

    const queuePreviewUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate < STREAM_UPDATE_MS) return;
      lastUpdate = now;
      const preview = `${header}\n\n${fullText}`;
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
    // The header already lives on the target block; only the answer body
    // and guidance are parsed into child blocks.
    const content = `${fullText.trim()}\n\n---\n${CONTINUATION_GUIDANCE}`;
    await writeFinalResponse(header, targetUid, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Roam and Discover Superintelligence failed", error);
    if (targetUid) {
      await updateBlock(targetUid, `Error: ${message}`).catch(() => {});
    } else {
      window.alert(`Roam and Discover Superintelligence: ${message}`);
    }
  } finally {
    isRunning = false;
  }
}
