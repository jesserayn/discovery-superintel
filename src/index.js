import pkg from "../package.json";
import { askAI } from "./askAi.js";
import { DEFAULT_MODELS, PROVIDER_LABELS } from "./providers.js";

let extensionAPI;

const SETTING_DEFAULTS = {
  provider: PROVIDER_LABELS.grok,
  "grok-api-key": "",
  "claude-api-key": "",
  "muse-api-key": "",
  "grok-model": DEFAULT_MODELS.grok,
  "claude-model": DEFAULT_MODELS.claude,
  "muse-model": DEFAULT_MODELS.muse,
  "system-prompt": "",
};

function providerId(label) {
  const entry = Object.entries(PROVIDER_LABELS).find(
    ([, providerLabel]) => providerLabel === label,
  );
  return entry?.[0] || "grok";
}

function getAISettings() {
  const provider = providerId(extensionAPI.settings.get("provider"));
  return {
    provider,
    apiKey: extensionAPI.settings.get(`${provider}-api-key`) || "",
    model:
      extensionAPI.settings.get(`${provider}-model`) ||
      DEFAULT_MODELS[provider],
    systemPrompt: extensionAPI.settings.get("system-prompt") || "",
  };
}

function inputSetting(id, name, description, placeholder) {
  return {
    id,
    name,
    description,
    action: {
      type: "input",
      placeholder,
      onChange: (evt) => extensionAPI.settings.set(id, evt.target.value),
    },
  };
}

function buildPanelConfig() {
  return {
    tabTitle: "Roam Discover Superintelligence",
    settings: [
      {
        id: "provider",
        name: "AI provider",
        description: "Provider used by the Ask AI command.",
        action: {
          type: "select",
          items: Object.values(PROVIDER_LABELS),
          onChange: (value) => extensionAPI.settings.set("provider", value),
        },
      },
      inputSetting(
        "grok-api-key",
        "Grok API key",
        "API key for xAI Grok.",
        "xAI API key",
      ),
      inputSetting(
        "grok-model",
        "Grok model",
        "Model ID sent to the xAI API.",
        DEFAULT_MODELS.grok,
      ),
      inputSetting(
        "claude-api-key",
        "Claude API key",
        "API key for Anthropic Claude.",
        "Anthropic API key",
      ),
      inputSetting(
        "claude-model",
        "Claude model",
        "Model ID sent to the Anthropic API.",
        DEFAULT_MODELS.claude,
      ),
      inputSetting(
        "muse-api-key",
        "Muse API key",
        "Meta Model API key (MODEL_API_KEY) for Muse.",
        "Meta Model API key",
      ),
      inputSetting(
        "muse-model",
        "Muse model",
        "Model ID sent to the Meta Model API.",
        DEFAULT_MODELS.muse,
      ),
      inputSetting(
        "system-prompt",
        "System prompt",
        "Optional instructions sent with every Ask AI request.",
        "You are a helpful research assistant.",
      ),
    ],
  };
}

async function onload({ extensionAPI: api }) {
  extensionAPI = api;

  for (const [id, value] of Object.entries(SETTING_DEFAULTS)) {
    if (extensionAPI.settings.get(id) == null) {
      await extensionAPI.settings.set(id, value);
    }
  }

  extensionAPI.settings.panel.create(buildPanelConfig());
  await extensionAPI.ui.commandPalette.addCommand({
    label: "Roam Discover Superintelligence: Ask AI",
    callback: () => {
      void askAI(getAISettings);
    },
  });

  console.log(`${pkg.name} version ${pkg.version} loaded`);
}

function onunload() {
  console.log(`${pkg.name} version ${pkg.version} unloaded`);
  extensionAPI = undefined;
}

export default {
  onload,
  onunload,
};
