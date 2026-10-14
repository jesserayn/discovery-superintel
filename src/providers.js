import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const DEFAULT_MODELS = {
  grok: "grok-4.7",
  claude: "claude-sonnet-4-5",
  muse: "muse-spark-1.3",
};

export const PROVIDER_LABELS = {
  grok: "Grok",
  claude: "Claude",
  muse: "Muse",
};

const OPENAI_COMPATIBLE = {
  grok: "https://api.x.ai/v1",
  muse: "https://api.meta.ai/v1",
};

function requireApiKey(provider, apiKey) {
  if (apiKey) return;
  const label = PROVIDER_LABELS[provider] || provider;
  throw new Error(
    `Missing ${label} API key. Add it under Roam Settings > Extensions > Roam and Discover Superintelligence.`,
  );
}

async function* streamClaude({
  apiKey,
  model,
  systemPrompt,
  userContent,
  signal,
}) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = await client.messages.create(
    {
      model,
      max_tokens: 4096,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: "user", content: userContent }],
      stream: true,
    },
    { signal },
  );

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta?.type === "text_delta" &&
      event.delta.text
    ) {
      yield event.delta.text;
    }
  }
}

async function* streamOpenAICompatible({
  provider,
  apiKey,
  model,
  systemPrompt,
  userContent,
  reasoningEffort,
  signal,
}) {
  const client = new OpenAI({
    apiKey,
    baseURL: OPENAI_COMPATIBLE[provider],
    dangerouslyAllowBrowser: true,
  });
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: userContent },
  ];
  const stream = await client.chat.completions.create(
    {
      model,
      messages,
      stream: true,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    },
    { signal },
  );

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
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
