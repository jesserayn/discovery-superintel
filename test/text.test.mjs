import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUserContent,
  CONTINUATION_GUIDANCE,
  frameResponse,
  markdownToRoamBlocks,
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

test("markdownToRoamBlocks keeps real headings when enabled", () => {
  const blocks = markdownToRoamBlocks("## Section Title\nBody text.", {
    headings: true,
  });
  assert.equal(blocks[0].string, "Section Title");
  assert.equal(blocks[0].heading, 1);
  assert.equal(blocks[1].depth, 1);
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

test("buildUserContent includes context before the request", () => {
  assert.equal(
    buildUserContent({ prompt: "Summarize this", contextText: "Selected notes" }),
    "Context:\nSelected notes\n\nRequest:\nSummarize this",
  );
});

test("buildUserContent returns the prompt when there is no context", () => {
  assert.equal(buildUserContent({ prompt: "Hello", contextText: "" }), "Hello");
});
