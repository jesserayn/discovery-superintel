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

export function getAskContext() {
  const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
  const selectedUids = getSelectedBlockUids();
  let promptUid = focusedBlock?.["block-uid"] || "";

  if (!promptUid && selectedUids.length) promptUid = selectedUids[0];

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

  return { promptUid, prompt, contextText };
}
