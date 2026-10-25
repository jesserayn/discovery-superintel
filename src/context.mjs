import { isAnswerHeader } from "./text.mjs";

const MAX_CONTEXT_BLOCKS = 80;
const MAX_CONTEXT_CHARS = 12000;
const MAX_REF_DEPTH = 3;

function getRawBlockString(uid) {
  if (!uid) return "";
  const result = window.roamAlphaAPI.pull("[:block/string]", [
    ":block/uid",
    uid,
  ]);
  return result?.[":block/string"] || "";
}

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

const EMBED_RE =
  /\{\{(?:\[\[embed\]\]|embed)\s*:\s*\(\(([A-Za-z0-9_-]+)\)\)\s*\}\}/gi;
const BLOCK_REF_RE = /\(\(([A-Za-z0-9_-]+)\)\)/g;

// An embed shows the referenced block and its children, so resolve it to
// that subtree (indented) rather than to the single referenced line.
function resolveEmbed(uid, seen, depth) {
  const lines = [];
  const walk = (current, level) => {
    if (lines.length >= 20) return;
    const text = resolveBlockText(
      getRawBlockString(current),
      new Set([...seen, current]),
      depth + 1,
    ).trim();
    if (text) lines.push(`${"  ".repeat(level)}${text}`);
    for (const child of getChildrenUids(current)) walk(child, level + 1);
  };
  walk(uid, 0);
  return lines.join("\n");
}

// Replace ((uid)) block refs and {{embed}}s with the text they point at,
// so the model sees the research instead of Roam syntax. Refs already on
// the resolution path (cycles) and missing blocks stay literal.
function resolveBlockText(text, seen, depth) {
  const raw = String(text || "");
  if (depth > MAX_REF_DEPTH || !raw.includes("((")) return raw;
  const embedsResolved = raw.replace(EMBED_RE, (match, uid) => {
    if (seen.has(uid)) return match;
    return resolveEmbed(uid, seen, depth) || match;
  });
  return embedsResolved.replace(BLOCK_REF_RE, (match, uid) => {
    if (seen.has(uid)) return match;
    const target = getRawBlockString(uid);
    if (!target) return match;
    return resolveBlockText(target, new Set([...seen, uid]), depth + 1);
  });
}

export function getBlockString(uid) {
  if (!uid) return "";
  return resolveBlockText(getRawBlockString(uid), new Set([uid]), 0);
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

function hasAnswerChild(uid) {
  return getChildrenUids(uid).some((child) =>
    isAnswerHeader(getBlockString(child)),
  );
}

function newCollector(excludeUid) {
  return {
    entries: [],
    chars: 0,
    visited: new Set(),
    excludeUid: excludeUid || "",
    truncated: false,
  };
}

// Record one block and return the role its children inherit: an
// attribution block starts an assistant turn, a block with an answer
// under it is a user prompt, everything else keeps the inherited role.
function emitBlock(state, uid, depth, inheritedRole) {
  if (!uid || uid === state.excludeUid || state.visited.has(uid)) return null;
  if (state.truncated) return null;
  state.visited.add(uid);
  const text = getBlockString(uid).trim();
  const role = isAnswerHeader(text)
    ? "assistant"
    : hasAnswerChild(uid)
      ? "user"
      : inheritedRole;
  if (!text) return role;
  if (
    state.entries.length >= MAX_CONTEXT_BLOCKS ||
    (state.entries.length && state.chars + text.length > MAX_CONTEXT_CHARS)
  ) {
    state.truncated = true;
    return null;
  }
  state.entries.push({ uid, text, depth, role });
  state.chars += text.length;
  return role;
}

function collectSubtree(state, uid, depth, inheritedRole) {
  const role = emitBlock(state, uid, depth, inheritedRole);
  if (role === null) return;
  for (const child of getChildrenUids(uid)) {
    if (state.truncated) break;
    collectSubtree(state, child, depth + 1, role);
  }
}

function entriesToLines(entries) {
  return entries.map((e) => `${"  ".repeat(e.depth)}${e.text}`).join("\n");
}

// When a follow-up is nested inside a previous Q&A thread and nothing was
// manually selected, use the thread before it as context: the ancestor
// path down to the follow-up plus everything before that path. Branches
// after the follow-up, and siblings after the path at every level, are
// left out.
export function getThreadContext(promptUid) {
  const empty = { text: "", entries: [], blockCount: 0, truncated: false };
  if (!promptUid) return empty;
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
  if (!ancestors.length) return empty;

  const path = [...ancestors.reverse(), promptUid];
  const state = newCollector(promptUid);
  const walkPrior = (uid, depth, inheritedRole, pathIndex) => {
    const role = emitBlock(state, uid, depth, inheritedRole);
    if (role === null) return;
    const nextOnPath = path[pathIndex + 1] || "";
    for (const child of getChildrenUids(uid)) {
      if (state.truncated || child === promptUid) break;
      if (child === nextOnPath) {
        walkPrior(child, depth + 1, role, pathIndex + 1);
        break;
      }
      collectSubtree(state, child, depth + 1, role);
    }
  };
  walkPrior(path[0], 0, "user", 0);

  let text = entriesToLines(state.entries);
  if (state.truncated && text) text = `${text}\n[thread truncated]`;
  return {
    text,
    entries: state.entries,
    blockCount: state.entries.length,
    truncated: state.truncated,
  };
}

export function getThreadContextText(promptUid) {
  return getThreadContext(promptUid).text;
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
  let contextText = "";
  let contextEntries = [];
  let contextSource = "none";
  let contextBlockCount = 0;

  // Selected blocks bring their whole subtree, like thread context does.
  const state = newCollector(promptUid);
  const rootTexts = [];
  for (const uid of selectedUids.filter((id) => id !== promptUid)) {
    const start = state.entries.length;
    collectSubtree(state, uid, 0, "user");
    const slice = state.entries.slice(start);
    if (slice.length) rootTexts.push(entriesToLines(slice));
    if (state.truncated) break;
  }
  if (rootTexts.length) {
    contextText = rootTexts.join("\n\n");
    if (state.truncated) contextText = `${contextText}\n[context truncated]`;
    contextEntries = state.entries;
    contextSource = "selection";
    contextBlockCount = state.entries.length;
  }

  if (!contextText) {
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText && selectedText !== prompt) {
      contextText = selectedText;
      contextSource = "highlight";
    }
  }
  // An explicit selection always wins; only fall back to the surrounding
  // thread when the user selected nothing.
  if (!contextText) {
    const thread = getThreadContext(promptUid);
    if (thread.text && thread.text !== prompt) {
      contextText = thread.text;
      contextEntries = thread.entries;
      contextSource = "thread";
      contextBlockCount = thread.blockCount;
    }
  }

  return {
    promptUid,
    prompt,
    contextText,
    contextEntries,
    contextSource,
    contextBlockCount,
  };
}
