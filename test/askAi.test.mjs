import assert from "node:assert/strict";
import test from "node:test";

const alerts = [];

globalThis.window = {
  alert: (msg) => alerts.push(msg),
  roamAlphaAPI: {
    pull: (_pattern, [, uid]) =>
      uid === "promptuid" ? { ":block/string": "What is X?" } : null,
    ui: {
      getFocusedBlock: () => ({ "block-uid": "promptuid" }),
      individualMultiselect: { getSelectedUids: () => [] },
    },
    util: { generateUID: () => "newblock1" },
    // Never resolves: the first Ask AI run stays in flight.
    createBlock: () => new Promise(() => {}),
    updateBlock: async () => {},
  },
  getSelection: () => ({ toString: () => "" }),
};
globalThis.document = {
  querySelectorAll: () => [],
  createElement: () => ({ addEventListener: () => {}, remove: () => {} }),
  body: { appendChild: () => {} },
};

const { askAI, ALREADY_RUNNING_MESSAGE } = await import("../src/askAi.js");

const getSettings = () => ({
  provider: "grok",
  apiKey: "key",
  model: "grok-4.7",
  reasoningEffort: null,
  systemPrompt: "",
  showContinuationNote: true,
});

test("a second Ask AI while one is running tells the user instead of no-op", async () => {
  void askAI(getSettings);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await askAI(getSettings);
  assert.ok(alerts.includes(ALREADY_RUNNING_MESSAGE));
  assert.match(ALREADY_RUNNING_MESSAGE, /already running/i);
});
