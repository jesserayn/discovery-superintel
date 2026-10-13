import assert from "node:assert/strict";
import test from "node:test";

// Mock the Roam browser environment before importing the module under test.
const BLOCKS = {
  aaa111aaa: "Earlier answer block",
  bbb222bbb: "Middle context block",
  ccc333ccc: "How is an intranet created?",
};
let focusedUid = null;
let selectedUids = [];

globalThis.window = {
  roamAlphaAPI: {
    pull: (_pattern, [, uid]) => ({ ":block/string": BLOCKS[uid] || "" }),
    ui: {
      getFocusedBlock: () =>
        focusedUid ? { "block-uid": focusedUid } : null,
      individualMultiselect: { getSelectedUids: () => selectedUids },
    },
  },
  getSelection: () => ({ toString: () => "" }),
};
globalThis.document = { querySelectorAll: () => [] };

const { getAskContext } = await import("../src/context.mjs");

test("multi-select uses the last selected block as the prompt", () => {
  focusedUid = null;
  selectedUids = ["aaa111aaa", "bbb222bbb", "ccc333ccc"];
  const ctx = getAskContext();
  assert.equal(ctx.promptUid, "ccc333ccc");
  assert.equal(ctx.prompt, "How is an intranet created?");
  assert.equal(
    ctx.contextText,
    "Earlier answer block\n\nMiddle context block",
  );
});

test("focused block stays the prompt when one exists", () => {
  focusedUid = "bbb222bbb";
  selectedUids = ["aaa111aaa", "bbb222bbb", "ccc333ccc"];
  const ctx = getAskContext();
  assert.equal(ctx.promptUid, "bbb222bbb");
  assert.equal(
    ctx.contextText,
    "Earlier answer block\n\nHow is an intranet created?",
  );
});
