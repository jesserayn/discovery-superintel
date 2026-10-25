import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAnswerContent,
  buildMessages,
  buildUserContent,
  CONTINUATION_GUIDANCE,
  frameResponse,
  isAnswerHeader,
  markdownToRoamBlocks,
  normalizeMessages,
  splitParagraphs,
} from "../src/text.mjs";

test("splitParagraphs separates blank-line paragraphs", () => {
  assert.deepEqual(splitParagraphs("First paragraph.\n\nSecond paragraph.\n"), [
    "First paragraph.",
    "Second paragraph.",
  ]);
});

test("splitParagraphs returns no blocks for empty text", () => {
  assert.deepEqual(splitParagraphs("  \n\n "), []);
});

test("markdownToRoamBlocks converts headings, bullets, and rules", () => {
  const blocks = markdownToRoamBlocks(
    [
      "Hi! Intro.",
      "",
      "### 1. Kwangmyong",
      "This is what most people mean.",
      "",
      "Key points:",
      "* **Only inside:** Available at universities.",
      "* **Curated content:** Mostly state media.",
      "",
      "---",
      "",
      "### 2. Gwangmyeong City",
      "A city in South Korea.",
    ].join("\n"),
  );

  assert.deepEqual(
    blocks.map((block) => block.string),
    [
      "Hi! Intro.",
      "**1. Kwangmyong**",
      "This is what most people mean.",
      "Key points:",
      "**Only inside:** Available at universities.",
      "**Curated content:** Mostly state media.",
      "**2. Gwangmyeong City**",
      "A city in South Korea.",
    ],
  );
  assert.ok(blocks.every((block) => block.heading === 0));
  assert.ok(blocks[4].depth > blocks[3].depth);
  assert.ok(blocks.every((block) => block.string.trim().length > 0));
  assert.ok(blocks.every((block) => !block.string.startsWith("###")));
  assert.ok(blocks.every((block) => !block.string.startsWith("* ")));
});

test("markdownToRoamBlocks converts tables to one block per row", () => {
  const blocks = markdownToRoamBlocks(
    [
      "**B. Mechanical / Electrical**",
      "",
      "| ID | Requirement |",
      "|---|---|",
      "| MEC-01 | Footprint <=4x4m, height <=4.2m. |",
      "| ELE-01 | 4kW servo + regenerative brake. |",
    ].join("\n"),
  );
  assert.deepEqual(
    blocks.map((b) => b.string),
    [
      "**B. Mechanical / Electrical**",
      "**MEC-01** — Footprint <=4x4m, height <=4.2m.",
      "**ELE-01** — 4kW servo + regenerative brake.",
    ],
  );
  assert.ok(blocks.every((b) => !b.string.includes("|---|")));
});

test("markdownToRoamBlocks labels extra table columns by header", () => {
  const blocks = markdownToRoamBlocks(
    ["| ID | Load | Noise |", "|---|---|---|", "| MEC-02 | 120kg | <65 dBA |"].join(
      "\n",
    ),
  );
  assert.deepEqual(blocks.map((b) => b.string), [
    "**MEC-02** — Load: 120kg; Noise: <65 dBA",
  ]);
});

test("markdownToRoamBlocks keeps real headings when enabled", () => {
  const blocks = markdownToRoamBlocks("## Section Title\nBody text.", {
    headings: true,
  });
  assert.equal(blocks[0].string, "Section Title");
  assert.equal(blocks[0].heading, 1);
  assert.equal(blocks[1].depth, 1);
});

test("markdownToRoamBlocks converts task lists to Roam TODO/DONE blocks", () => {
  const blocks = markdownToRoamBlocks(
    [
      "- [ ] Buy milk",
      "- [x] Done thing",
      "- [X] Also done",
      "* [ ] Star task",
      "1. [ ] Numbered task",
      "- Regular bullet",
    ].join("\n"),
  );
  assert.deepEqual(
    blocks.map((block) => block.string),
    [
      "{{[[TODO]]}} Buy milk",
      "{{[[DONE]]}} Done thing",
      "{{[[DONE]]}} Also done",
      "{{[[TODO]]}} Star task",
      "{{[[TODO]]}} Numbered task",
      "Regular bullet",
    ],
  );
});

test("markdownToRoamBlocks keeps nested task depth", () => {
  const blocks = markdownToRoamBlocks("- [ ] Parent\n  - [ ] Child");
  assert.deepEqual(
    blocks.map((block) => block.string),
    ["{{[[TODO]]}} Parent", "{{[[TODO]]}} Child"],
  );
  assert.ok(blocks[1].depth > blocks[0].depth);
});

test("markdownToRoamBlocks leaves Roam TODO/DONE and non-tasks untouched", () => {
  const blocks = markdownToRoamBlocks(
    [
      "- {{[[TODO]]}} Already a todo",
      "- {{[[DONE]]}} Already done",
      "Remember to [ ] check mid-sentence.",
      "",
      "```",
      "- [ ] Inside code",
      "```",
    ].join("\n"),
  );
  const strings = blocks.map((block) => block.string);
  assert.ok(strings.includes("{{[[TODO]]}} Already a todo"));
  assert.ok(strings.includes("{{[[DONE]]}} Already done"));
  assert.ok(!strings.some((s) => s.includes("{{[[TODO]]}} {{[[TODO]]}}")));
  assert.ok(strings.includes("Remember to [ ] check mid-sentence."));
  assert.ok(strings.some((s) => s.includes("- [ ] Inside code")));
  assert.ok(!strings.some((s) => s === "{{[[TODO]]}} Inside code"));
});

test("markdownToRoamBlocks converts [[to-do]] page refs to Roam TODO blocks", () => {
  const blocks = markdownToRoamBlocks(
    [
      "- [[to-do]] Get a Nevada driver's license",
      "- [[TODO]] Register my van in Nevada",
      "- [[todo]] Pay back taxes",
      "- {{[[to-do]]}} Find a tax person",
      "- {{todo}} Call the DMV",
      "- to-do: Move business to Nevada",
      "- [[done]] Already finished",
      "- Move [[Infinite Ways]] from California to Nevada",
    ].join("\n"),
  );
  assert.deepEqual(
    blocks.map((block) => block.string),
    [
      "{{[[TODO]]}} Get a Nevada driver's license",
      "{{[[TODO]]}} Register my van in Nevada",
      "{{[[TODO]]}} Pay back taxes",
      "{{[[TODO]]}} Find a tax person",
      "{{[[TODO]]}} Call the DMV",
      "{{[[TODO]]}} Move business to Nevada",
      "{{[[DONE]]}} Already finished",
      "Move [[Infinite Ways]] from California to Nevada",
    ],
  );
  assert.ok(blocks.every((block) => !block.string.startsWith("[[to-do]]")));
});

test("markdownToRoamBlocks converts a bare task paragraph", () => {
  assert.deepEqual(
    markdownToRoamBlocks("[ ] Standalone task").map((block) => block.string),
    ["{{[[TODO]]}} Standalone task"],
  );
});

test("markdownToRoamBlocks joins wrapped lines and strips dash bullets", () => {
  assert.deepEqual(
    markdownToRoamBlocks("First line\nsecond line\n\n- one\n- two").map(
      (block) => block.string,
    ),
    ["First line second line", "one", "two"],
  );
});

test("frameResponse leads with the model and ends with guidance", () => {
  const framed = frameResponse({
    providerLabel: "Grok",
    model: "grok-4.7",
    body: "Answer body.",
  });
  assert.ok(framed.startsWith("Answered by Grok (`grok-4.7`)"));
  assert.ok(framed.endsWith(CONTINUATION_GUIDANCE));

  const blocks = markdownToRoamBlocks(framed);
  assert.equal(blocks[0].string, "Answered by Grok (`grok-4.7`)");
  assert.equal(blocks[1].string, "Answer body.");
  assert.equal(blocks[blocks.length - 1].string, CONTINUATION_GUIDANCE);
  assert.ok(
    blocks.every((block) => block.string.trim() !== "---"),
    "separator rule produces no block",
  );
});

test("buildAnswerContent omits the continuation note when disabled", () => {
  assert.equal(buildAnswerContent("Answer body.", false), "Answer body.");
  assert.ok(
    buildAnswerContent("Answer body.", true).endsWith(CONTINUATION_GUIDANCE),
  );
  assert.ok(buildAnswerContent("Answer body.").endsWith(CONTINUATION_GUIDANCE));
});

test("frameResponse includes effort when set", () => {
  const framed = frameResponse({
    providerLabel: "Muse",
    model: "muse-spark-1.3",
    effort: "medium",
    body: "Hi.",
  });
  assert.ok(
    framed.startsWith("Answered by Muse (`muse-spark-1.3`, effort `medium`)"),
  );
});

test("buildUserContent includes context before the request", () => {
  assert.equal(
    buildUserContent({ prompt: "Summarize this", contextText: "Selected notes" }),
    "Context:\nSelected notes\n\nRequest:\nSummarize this",
  );
});

test("buildUserContent returns the prompt when there is no context", () => {
  assert.equal(buildUserContent({ prompt: "Hello", contextText: "" }), "Hello");
});

test("frameResponse appends the context label to the header", () => {
  const framed = frameResponse({
    providerLabel: "Grok",
    model: "grok-4.7",
    body: "Hi.",
    contextLabel: "context: thread, 4 blocks",
  });
  assert.ok(
    framed.startsWith("Answered by Grok (`grok-4.7`) · context: thread, 4 blocks"),
  );
});

test("isAnswerHeader recognizes headers with effort and context suffixes", () => {
  assert.ok(isAnswerHeader("Answered by Grok (`grok-4.7`)"));
  assert.ok(isAnswerHeader("Answered by Muse (`m`, effort `high`) · context: thread, 2 blocks"));
  assert.ok(!isAnswerHeader("What is Kwangmyong?"));
});

test("buildMessages turns a prior Q&A thread into alternating turns", () => {
  const messages = buildMessages({
    prompt: "And how is it built?",
    contextText: "",
    contextEntries: [
      { text: "What is Kwangmyong?", role: "user" },
      { text: "Answered by Grok (`grok-4.7`)", role: "assistant" },
      { text: "A closed intranet.", role: "assistant" },
      { text: CONTINUATION_GUIDANCE, role: "assistant" },
    ],
  });
  assert.deepEqual(messages, [
    { role: "user", content: "What is Kwangmyong?" },
    { role: "assistant", content: "A closed intranet." },
    { role: "user", content: "And how is it built?" },
  ]);
});

test("buildMessages falls back to one user message without a thread", () => {
  assert.deepEqual(
    buildMessages({ prompt: "Summarize", contextText: "Notes", contextEntries: [] }),
    [{ role: "user", content: "Context:\nNotes\n\nRequest:\nSummarize" }],
  );
  assert.deepEqual(buildMessages({ prompt: "Hello", contextText: "" }), [
    { role: "user", content: "Hello" },
  ]);
});

test("normalizeMessages merges same-role turns and starts with user", () => {
  const messages = normalizeMessages([
    { role: "assistant", content: "orphan" },
    { role: "user", content: "one" },
    { role: "user", content: "two" },
    { role: "assistant", content: "  " },
  ]);
  assert.equal(messages[0].role, "user");
  assert.ok(messages.some((m) => m.content.includes("one") && m.content.includes("two")));
  assert.ok(messages.every((m) => m.content.trim()));
});
