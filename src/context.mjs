export function getBlockString(uid) {
  if (!uid) return "";
  const result = window.roamAlphaAPI.pull("[:block/string]", [
    ":block/uid",
    uid,
  ]);
  return result?.[":block/string"] || "";
}

export function getSelectedBlockUids() {
  const highlighted = document.querySelectorAll(".block-highlight-blue");
  if (highlighted.length) {
    const uids = [];
    highlighted.forEach((node) => {
      const input = node.querySelector(".rm-block__input");
      if (!input) return;
      const uid = input.id.slice(-9);
      if (uid && !uids.includes(uid)) uids.push(uid);
    });
    if (uids.length) return uids;
  }

  try {
    return (
      window.roamAlphaAPI.ui.individualMultiselect.getSelectedUids() || []
    );
  } catch {
    return [];
  }
}

const MAX_THREAD_BLOCKS = 80;
const MAX_THREAD_CHARS = 12000;

function getParentUid(uid) {
  const result = window.roamAlphaAPI.pull(
    "[{:block/_children [:block/uid]}]",
    [":block/uid", uid],
  );
  return result?.[":block/_children"]?.[0]?.[":block/uid"] || "";
}

function getChildrenUids(uid) {
  const result = window.roamAlphaAPI.pull(
    "[{:block/children [:block/uid :block/order]}]",
    [":block/uid", uid],
  );
  return (result?.[":block/children"] || [])
    .slice()
    .sort((a, b) => (a[":block/order"] ?? 0) - (b[":block/order"] ?? 0))
    .map((child) => child[":block/uid"])
    .filter(Boolean);
}

function collectThreadText(topUid, excludeUid) {
  const lines = [];
  let count = 0;
  const walk = (uid, depth) => {
    if (count >= MAX_THREAD_BLOCKS || uid === excludeUid) return;
    const text = getBlockString(uid).trim();
    if (text) {
      lines.push(`${"  ".repeat(depth)}${text}`);
      count += 1;
    }
    for (const childUid of getChildrenUids(uid)) walk(childUid, depth + 1);
  };
  walk(topUid, 0);
  let text = lines.join("\n");
  if (text.length > MAX_THREAD_CHARS) {
    text = `${text.slice(0, MAX_THREAD_CHARS)}\n[thread truncated]`;
  }
  return text;
}

// When a follow-up is nested inside a previous Q&A thread and nothing was
// manually selected, use the whole thread above it as context.
export function getThreadContextText(promptUid) {
  if (!promptUid) return "";
  const ancestors = [];
  const seen = new Set([promptUid]);
  let current = promptUid;
  while (ancestors.length < 25) {
    const parent = getParentUid(current);
    if (!parent || seen.has(parent)) break;
    ancestors.push(parent);
    seen.add(parent);
    current = parent;
  }
  if (!ancestors.length) return "";
  return collectThreadText(ancestors[ancestors.length - 1], promptUid);
}

export function getAskContext() {
  const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
  const selectedUids = getSelectedBlockUids();
  let promptUid = focusedBlock?.["block-uid"] || "";

  // With a multi-block selection there is no focused block. The prompt is
  // the last selected block (the latest follow-up in a thread); everything
  // selected above it is context.
  if (!promptUid && selectedUids.length) {
    promptUid = selectedUids[selectedUids.length - 1];
  }

  const prompt = getBlockString(promptUid).trim();
  const contextBlocks = selectedUids
    .filter((uid) => uid !== promptUid)
    .map((uid) => ({ uid, text: getBlockString(uid).trim() }))
    .filter((block) => block.text);

  let contextText = contextBlocks.map((block) => block.text).join("\n\n");
  if (!contextBlocks.length) {
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText && selectedText !== prompt) contextText = selectedText;
  }
  // An explicit selection always wins; only fall back to the surrounding
  // thread when the user selected nothing.
  if (!contextText) {
    const threadText = getThreadContextText(promptUid);
    if (threadText && threadText !== prompt) contextText = threadText;
  }

  return { promptUid, prompt, contextText };
}
