import { getAskContext } from "./context.mjs";
import { PROVIDER_LABELS, streamCompletion } from "./providers.js";
import {
  buildAnswerContent,
  buildUserContent,
  frameResponse,
  markdownToRoamBlocks,
} from "./text.mjs";

const STREAM_UPDATE_MS = 250;

// Shown in the answer block until the first token arrives.
const LOADING_ART = [
  "```",
  "      .-~~~~-.",
  "    .'   *    '.",
  "   /  *   ___   \\",
  "  |      /   \\   |",
  "   \\    \\___/   /",
  "    '.______.'",
  "  __/________\\__",
  "```",
].join("\n");
let isRunning = false;
let activeController = null;
let cancelButton = null;

export function cancelAskAI() {
  activeController?.abort();
}

function showCancelButton() {
  hideCancelButton();
  cancelButton = document.createElement("button");
  cancelButton.className = "rd-ai-cancel";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel Ask AI";
  cancelButton.addEventListener("click", cancelAskAI);
  document.body.appendChild(cancelButton);
}

function hideCancelButton() {
  cancelButton?.remove();
  cancelButton = null;
}

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
      "Discovery Superintel: focus a block containing your request, optionally select context blocks, then run Ask AI again.",
    );
    return;
  }

  isRunning = true;
  activeController = new AbortController();
  const providerLabel = PROVIDER_LABELS[settings.provider] || settings.provider;
  const header = frameResponse({
    providerLabel,
    model: settings.model,
    effort: settings.reasoningEffort,
    body: "",
  }).split("\n\n")[0];
  let targetUid;
  try {
    targetUid = await createChildBlock(promptUid, header);
    showCancelButton();
    await updateBlock(targetUid, `${header}\n\n${LOADING_ART}`).catch(
      () => {},
    );
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
      signal: activeController.signal,
      userContent: buildUserContent({ prompt, contextText }),
    })) {
      fullText += delta;
      queuePreviewUpdate();
    }

    await pendingUpdate;
    // The provider SDKs end their stream iterators silently on abort
    // rather than throwing, so check the signal explicitly: a cancelled
    // request gets a cancelled marker instead of a partial answer.
    if (activeController.signal.aborted) {
      await updateBlock(targetUid, header);
      await createChildBlock(targetUid, "Request cancelled.");
      return;
    }
    // The header already lives on the target block; only the answer body
    // (and the continuation note, when enabled) becomes child blocks.
    const content = buildAnswerContent(fullText, settings.showContinuationNote);
    await writeFinalResponse(header, targetUid, content);
  } catch (error) {
    if (activeController.signal.aborted) {
      if (targetUid) {
        await updateBlock(targetUid, header).catch(() => {});
        await createChildBlock(targetUid, "Request cancelled.").catch(
          () => {},
        );
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Discovery Superintel failed", error);
      if (targetUid) {
        await updateBlock(targetUid, `Error: ${message}`).catch(() => {});
      } else {
        window.alert(`Discovery Superintel: ${message}`);
      }
    }
  } finally {
    hideCancelButton();
    activeController = null;
    isRunning = false;
  }
}
