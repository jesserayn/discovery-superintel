import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClaudeParams,
  buildOpenAIParams,
  DEFAULT_MODELS,
  MAX_OUTPUT_TOKENS,
  OPENAI_COMPATIBLE,
  PROVIDER_LABELS,
  streamCompletion,
  TRUNCATION_NOTICE,
} from "../src/providers.js";

test("OpenRouter is a registered provider with a default model", () => {
  assert.equal(PROVIDER_LABELS.openrouter, "OpenRouter");
  assert.ok(DEFAULT_MODELS.openrouter, "has a default model");
  assert.match(DEFAULT_MODELS.openrouter, /\//, "OpenRouter model IDs use provider/model form");
});

test("OpenRouter uses its OpenAI-compatible endpoint", () => {
  assert.equal(OPENAI_COMPATIBLE.openrouter, "https://openrouter.ai/api/v1");
});

test("existing providers keep their endpoints and defaults", () => {
  assert.equal(OPENAI_COMPATIBLE.grok, "https://api.x.ai/v1");
  assert.equal(OPENAI_COMPATIBLE.muse, "https://api.meta.ai/v1");
  assert.equal(DEFAULT_MODELS.grok, "grok-4.7");
  assert.equal(DEFAULT_MODELS.claude, "claude-sonnet-4-5");
  assert.equal(DEFAULT_MODELS.muse, "muse-spark-1.3");
});

test("streamCompletion requires an OpenRouter API key", async () => {
  await assert.rejects(
    async () => {
      for await (const _ of streamCompletion({
        provider: "openrouter",
        apiKey: "",
        model: DEFAULT_MODELS.openrouter,
        userContent: "hi",
      })) {
        // unreachable without a key
      }
    },
    /Missing OpenRouter API key/,
  );
});

test("all providers share one output limit and pass messages through", () => {
  const messages = [
    { role: "user", content: "Q1" },
    { role: "assistant", content: "A1" },
    { role: "user", content: "Q2" },
  ];
  const claude = buildClaudeParams({ model: "m", messages, systemPrompt: "S" });
  const openai = buildOpenAIParams({ model: "m", messages, systemPrompt: "S" });
  assert.equal(claude.max_tokens, MAX_OUTPUT_TOKENS);
  assert.equal(openai.max_tokens, MAX_OUTPUT_TOKENS);
  assert.ok(MAX_OUTPUT_TOKENS > 4096);
  assert.deepEqual(claude.messages, messages);
  assert.deepEqual(openai.messages, [{ role: "system", content: "S" }, ...messages]);
  assert.match(TRUNCATION_NOTICE, /truncated/i);
});

test("streamCompletion rejects unknown providers", async () => {
  await assert.rejects(
    async () => {
      for await (const _ of streamCompletion({
        provider: "nope",
        apiKey: "key",
        model: "m",
        userContent: "hi",
      })) {
        // unreachable
      }
    },
    /Unknown AI provider: nope/,
  );
});
