import assert from "node:assert/strict";
import test from "node:test";

// Mock the Roam browser environment before importing the module under test.
const BLOCKS = {
  aaa111aaa: "Earlier answer block",
  bbb222bbb: "Middle context block",
  ccc333ccc: "How is an intranet created?",
  q0q0q0q0q: "What is Kwangmyong?",
  ans000ans: "Answered by Grok (`grok-4.7`)",
  body00bod: "A closed intranet.",
  cont00con: "Continuing the conversation: ...",
  fol000fol: "How is an intranet created?",
};
const PARENTS = {
  ans000ans: "q0q0q0q0q",
  body00bod: "ans000ans",
  cont00con: "ans000ans",
  fol000fol: "cont00con",
};
const CHILDREN = {
  q0q0q0q0q: ["ans000ans"],
  ans000ans: ["body00bod", "cont00con"],
  cont00con: ["fol000fol"],
};
let focusedUid = null;
let selectedUids = [];

globalThis.window = {
  roamAlphaAPI: {
    pull: (pattern, [, uid]) => {
      if (pattern.includes("_children")) {
        const parent = PARENTS[uid];
        return parent ? { ":block/_children": [{ ":block/uid": parent }] } : null;
      }
      if (pattern.includes(":block/children")) {
        const kids = CHILDREN[uid] || [];
        return {
          ":block/children": kids.map((kid, i) => ({
            ":block/uid": kid,
            ":block/order": i,
          })),
        };
      }
      return { ":block/string": BLOCKS[uid] || "" };
    },
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

test("nested follow-up auto-includes the thread above it", () => {
  focusedUid = "fol000fol";
  selectedUids = [];
  const ctx = getAskContext();
  assert.equal(ctx.prompt, "How is an intranet created?");
  assert.ok(ctx.contextText.includes("What is Kwangmyong?"));
  assert.ok(ctx.contextText.includes("Answered by Grok"));
  assert.ok(ctx.contextText.includes("A closed intranet."));
  // The follow-up itself is the request, not part of its own context.
  assert.equal(ctx.contextText.split("How is an intranet created?").length - 1, 0);
});

test("explicit selection wins over thread context", () => {
  focusedUid = "fol000fol";
  selectedUids = ["aaa111aaa"];
  const ctx = getAskContext();
  assert.equal(ctx.contextText, "Earlier answer block");
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
