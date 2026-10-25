import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import { normalizeMessages } from "./text.mjs";

export const DEFAULT_MODELS = {
  grok: "grok-4.7",
  claude: "claude-sonnet-4-5",
  muse: "muse-spark-1.3",
  openrouter: "anthropic/claude-sonnet-4.5",
};

export const PROVIDER_LABELS = {
  grok: "Grok",
  claude: "Claude",
  muse: "Muse",
  openrouter: "OpenRouter",
};

export const OPENAI_COMPATIBLE = {
  grok: "https://api.x.ai/v1",
  muse: "https://api.meta.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

// One explicit output cap for every provider. Claude requires max_tokens,
// so without a shared value it silently truncated at half this length
// while the OpenAI-compatible providers used their own defaults.
export const MAX_OUTPUT_TOKENS = 8192;

export const TRUNCATION_NOTICE =
  "[Response truncated at the output limit. Ask a follow-up to continue.]";

function requireApiKey(provider, apiKey) {
  if (apiKey) return;
  const label = PROVIDER_LABELS[provider] || provider;
  throw new Error(
    `Missing ${label} API key. Add it under Roam Settings > Extensions > Discovery Superintel.`,
  );
}

// Accept either structured messages (multi-turn thread replay) or the
// legacy single userContent string.
function resolveMessages({ messages, userContent }) {
  if (Array.isArray(messages) && messages.length) {
    const normalized = normalizeMessages(messages);
    if (normalized.length) return normalized;
  }
  return [{ role: "user", content: String(userContent || "") }];
}

export function buildClaudeParams({ model, systemPrompt, messages, userContent }) {
  return {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: resolveMessages({ messages, userContent }),
    stream: true,
  };
}

export function buildOpenAIParams({
  model,
  systemPrompt,
  messages,
  userContent,
  reasoningEffort,
}) {
  return {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...resolveMessages({ messages, userContent }),
    ],
    stream: true,
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
  };
}

async function* streamClaude(options) {
  const { apiKey, signal } = options;
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = await client.messages.create(buildClaudeParams(options), {
    signal,
  });

  let truncated = false;
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta?.type === "text_delta" &&
      event.delta.text
    ) {
      yield event.delta.text;
    }
    if (
      event.type === "message_delta" &&
      event.delta?.stop_reason === "max_tokens"
    ) {
      truncated = true;
    }
  }
  if (truncated) yield `\n\n${TRUNCATION_NOTICE}`;
}

async function* streamOpenAICompatible(options) {
  const { provider, apiKey, signal } = options;
  const client = new OpenAI({
    apiKey,
    baseURL: OPENAI_COMPATIBLE[provider],
    dangerouslyAllowBrowser: true,
    // OpenRouter uses this to attribute requests to this extension.
    ...(provider === "openrouter"
      ? { defaultHeaders: { "X-Title": "Discovery Superintel" } }
      : {}),
  });
  const stream = await client.chat.completions.create(
    buildOpenAIParams(options),
    { signal },
  );

  let truncated = false;
  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    const text = choice?.delta?.content;
    if (text) yield text;
    if (choice?.finish_reason === "length") truncated = true;
  }
  if (truncated) yield `\n\n${TRUNCATION_NOTICE}`;
}

export async function* streamCompletion(options) {
  const { provider, apiKey } = options;
  requireApiKey(provider, apiKey);
  if (provider === "claude") {
    yield* streamClaude(options);
    return;
  }
  if (OPENAI_COMPATIBLE[provider]) {
    yield* streamOpenAICompatible(options);
    return;
  }
  throw new Error(`Unknown AI provider: ${provider}`);
}
