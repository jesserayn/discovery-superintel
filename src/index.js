import pkg from "../package.json";
import { askAI, cancelAskAI } from "./askAi.js";
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
  "reasoning-effort": "Default",
  "system-prompt": "",
  "continuation-note": true,
};

const REASONING_EFFORTS = ["Default", "low", "medium", "high"];
const EXTENSION_NAME = "Roam and Discover Superintelligence";

const CRYSTAL_BALL_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="10.5" cy="9.5" r="6.8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.8 4.9A5.6 5.6 0 0 1 11.6 3.8C8.9 4.9 7.3 6.9 6.9 9.7 6.3 7.8 6.4 6.2 6.8 4.9Z"/><path d="M18 1.2Q18.45 3.75 21 4.2Q18.45 4.65 18 7.2Q17.55 4.65 15 4.2Q17.55 3.75 18 1.2Z"/><path d="M16.6 7.6Q16.86 9.04 18.3 9.3Q16.86 9.56 16.6 11Q16.34 9.56 14.9 9.3Q16.34 9.04 16.6 7.6Z"/><ellipse cx="10.5" cy="17" rx="6.5" ry="1.6"/><path d="M5.2 18.2h10.6l1.4 3.4c.2.6-.2 1.1-.8 1.1H4.6c-.6 0-1-.5-.8-1.1Z"/></svg>`;

let topbarButton = null;
let topbarTimer = null;
let topbarObserver = null;

const TOPBAR_BUTTON_ID = "rd-ai-button-topbar";
const TOPBAR_ICON_ID = "rd-ai-icon";
const TOPBAR_SPACER_LEFT_ID = "rd-ai-flex-space-left";
const TOPBAR_SPACER_RIGHT_ID = "rd-ai-flex-space-right";

// Mirrors the structure Roam's own top bar buttons use (as in
// 8bitgentleman/roam-depot-random-block): a Blueprint popover wrapper
// inserted after the top bar's last child, flanked by spacer divs.
function tryAddTopbarButton() {
  if (document.getElementById(TOPBAR_ICON_ID)) {
    topbarButton = document.getElementById(TOPBAR_BUTTON_ID);
    return true;
  }
  const roamTopbar = document.getElementsByClassName("rm-topbar");
  const nextIconButton = roamTopbar[0]?.lastElementChild;
  if (!roamTopbar[0] || !nextIconButton) return false;

  const mainButton = document.createElement("span");
  mainButton.id = TOPBAR_BUTTON_ID;
  mainButton.classList.add("bp3-popover-wrapper", "rd-ai-topbar");
  mainButton.title = `${EXTENSION_NAME}: Ask AI`;

  const spanTwo = document.createElement("span");
  spanTwo.classList.add("bp3-popover-target");
  mainButton.appendChild(spanTwo);

  const mainIcon = document.createElement("span");
  mainIcon.id = TOPBAR_ICON_ID;
  mainIcon.classList.add("bp3-button", "bp3-minimal", "bp3-small");
  mainIcon.setAttribute("role", "button");
  mainIcon.setAttribute("aria-label", "Ask AI");
  mainIcon.innerHTML = CRYSTAL_BALL_SVG;
  spanTwo.appendChild(mainIcon);

  nextIconButton.insertAdjacentElement("afterend", mainButton);

  const leftSpaceDiv = document.createElement("div");
  leftSpaceDiv.id = TOPBAR_SPACER_LEFT_ID;
  leftSpaceDiv.className = "rm-topbar__spacer-sm";
  mainButton.insertAdjacentElement("beforebegin", leftSpaceDiv);

  const rightSpaceDiv = document.createElement("div");
  rightSpaceDiv.id = TOPBAR_SPACER_RIGHT_ID;
  rightSpaceDiv.className = "rm-topbar__spacer-sm";
  mainButton.insertAdjacentElement("afterend", rightSpaceDiv);

  // Keep the editor's focused block and text selection when clicked.
  mainButton.addEventListener("mousedown", (event) => event.preventDefault());
  mainButton.addEventListener("click", () => {
    void askAI(getAISettings);
  });
  topbarButton = mainButton;
  return true;
}

function addTopbarButton() {
  try {
    removeTopbarButton();
    tryAddTopbarButton();
  } catch {
    // Never let button placement break the rest of onload.
  }
  // Roam re-renders its top bar after auto-start, wiping foreign DOM
  // nodes. Watch for the button disappearing (or the top bar appearing)
  // and put it back. This must run even when the first attempt succeeds.
  const observeTarget = document.body || document.documentElement;
  if (typeof MutationObserver !== "undefined" && observeTarget) {
    topbarObserver = new MutationObserver(() => {
      tryAddTopbarButton();
    });
    topbarObserver.observe(observeTarget, { childList: true, subtree: true });
  }
  if (!topbarButton) {
    // Fallback when there is no body to observe yet: keep retrying for
    // up to 30 seconds (remote extensions can auto-start very early).
    let attempts = 0;
    topbarTimer = setInterval(() => {
      attempts += 1;
      if (tryAddTopbarButton() || attempts >= 60) {
        clearInterval(topbarTimer);
        topbarTimer = null;
      }
    }, 500);
  }
}

function removeTopbarButton() {
  if (topbarObserver) {
    topbarObserver.disconnect();
    topbarObserver = null;
  }
  if (topbarTimer) {
    clearInterval(topbarTimer);
    topbarTimer = null;
  }
  topbarButton?.remove();
  topbarButton = null;
  for (const id of [TOPBAR_BUTTON_ID, TOPBAR_SPACER_LEFT_ID, TOPBAR_SPACER_RIGHT_ID]) {
    document.getElementById(id)?.remove();
  }
  document.querySelectorAll(".rd-ai-topbar").forEach((el) => el.remove());
}

function providerId(label) {
  const entry = Object.entries(PROVIDER_LABELS).find(
    ([, providerLabel]) => providerLabel === label,
  );
  return entry?.[0] || "grok";
}

function getAISettings() {
  const provider = providerId(extensionAPI.settings.get("provider"));
  const effortSetting = extensionAPI.settings.get("reasoning-effort");
  const reasoningEffort =
    effortSetting && effortSetting !== "Default" ? effortSetting : null;
  return {
    provider,
    apiKey: extensionAPI.settings.get(`${provider}-api-key`) || "",
    model:
      extensionAPI.settings.get(`${provider}-model`) ||
      DEFAULT_MODELS[provider],
    // Only Grok and Muse accept reasoning_effort; the Anthropic Messages
    // API has no equivalent parameter, so it stays unset for Claude and the
    // header leaves effort off rather than display a value that does nothing.
    reasoningEffort: provider === "claude" ? null : reasoningEffort,
    systemPrompt: extensionAPI.settings.get("system-prompt") || "",
    showContinuationNote:
      extensionAPI.settings.get("continuation-note") !== false,
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
    tabTitle: "Roam and Discover Superintelligence",
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
      {
        id: "reasoning-effort",
        name: "Reasoning effort",
        description:
          "Sent as reasoning_effort to Grok and Muse. Default omits it and uses the provider default. Not supported by Claude.",
        action: {
          type: "select",
          items: REASONING_EFFORTS,
          onChange: (value) =>
            extensionAPI.settings.set("reasoning-effort", value),
        },
      },
      inputSetting(
        "system-prompt",
        "System prompt",
        "Optional instructions sent with every Ask AI request.",
        "You are a helpful research assistant.",
      ),
      {
        id: "continuation-note",
        name: "Continuation note",
        description:
          "Append a short note at the end of each answer explaining how to continue the conversation. Turn off once you know the flow.",
        action: {
          type: "switch",
          onChange: (evt) => {
            const value =
              typeof evt === "boolean" ? evt : evt?.target?.checked;
            if (typeof value === "boolean") {
              void extensionAPI.settings.set("continuation-note", value);
            }
          },
        },
      },
    ],
  };
}

// One command per provider and per effort level, so both can be picked
// straight from the Cmd+P palette. Labels use the provider name only;
// the model version for each provider lives in the settings panel.
async function registerPaletteCommands() {
  for (const [, label] of Object.entries(PROVIDER_LABELS)) {
    await extensionAPI.ui.commandPalette.addCommand({
      label: `${EXTENSION_NAME}: Use ${label}`,
      callback: () => {
        void extensionAPI.settings.set("provider", label);
      },
    });
  }
  for (const effort of REASONING_EFFORTS) {
    await extensionAPI.ui.commandPalette.addCommand({
      label: `${EXTENSION_NAME}: Set effort ${effort}`,
      callback: () => {
        void extensionAPI.settings.set("reasoning-effort", effort);
      },
    });
  }
}

async function onload({ extensionAPI: api }) {
  extensionAPI = api;
  // First, so the button appears even if a later settings/panel/API call
  // hangs or fails during remote auto-start.
  addTopbarButton();

  for (const [id, value] of Object.entries(SETTING_DEFAULTS)) {
    if (extensionAPI.settings.get(id) == null) {
      await extensionAPI.settings.set(id, value);
    }
  }

  extensionAPI.settings.panel.create(buildPanelConfig());
  await extensionAPI.ui.commandPalette.addCommand({
    label: `${EXTENSION_NAME}: Ask AI`,
    callback: () => {
      void askAI(getAISettings);
    },
  });
  await extensionAPI.ui.commandPalette.addCommand({
    label: `${EXTENSION_NAME}: Cancel Ask AI`,
    callback: () => cancelAskAI(),
  });
  await registerPaletteCommands();

  console.log(`${pkg.name} version ${pkg.version} loaded`);
}

function onunload() {
  cancelAskAI();
  removeTopbarButton();
  console.log(`${pkg.name} version ${pkg.version} unloaded`);
  extensionAPI = undefined;
}

export default {
  onload,
  onunload,
};
