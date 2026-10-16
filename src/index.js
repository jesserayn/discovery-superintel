import pkg from "../package.json";
import { askAI, cancelAskAI } from "./askAi.js";
import { CRYSTAL_BALL_SVG } from "./crystalBall.mjs";
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
  "button-position": "Both topbar and sidebar",
};

const REASONING_EFFORTS = ["Default", "low", "medium", "high"];
const EXTENSION_NAME = "Roam and Discover Superintelligence";

// Same DOM as 8bitgentleman/roam-depot-random-block's top-bar button.
// The icon is a crystal ball SVG instead of Blueprint's random glyph.
const nameToUse = "roamDiscoverSuperintelligence";
const topbarIconId = nameToUse + "-icon";

const topbarButtonId = nameToUse + "-button-topbar";
const topBarFlexLeftSpaceId = nameToUse + "-flex-space-left";
const topBarFlexRightSpaceId = nameToUse + "-flex-space-right";

const leftSidebarButtonId = nameToUse + "-button-left-sidebar";

let buttonObserver = null;
let buttonTimer = null;
let showTopbarButton = true;
let showSidebarButton = true;

function addButtonTopbar() {
  if (document.getElementById(topbarIconId)) return;

  // A re-render can remove the icon and leave the spacers behind.
  // Drop those before choosing the anchor, or the button attaches to a
  // detached spacer and never shows up in the bar.
  removeButtonTopbar();

  const roamTopbar = document.getElementsByClassName("rm-topbar");
  const nextIconButton = roamTopbar[0]?.lastElementChild;
  if (!roamTopbar[0] || !nextIconButton) return;

  const mainButton = document.createElement("span");
  mainButton.id = topbarButtonId;
  mainButton.classList.add("bp3-popover-wrapper");
  mainButton.title = EXTENSION_NAME + ": Ask AI";
  const spanTwo = document.createElement("span");
  spanTwo.classList.add("bp3-popover-target");
  mainButton.appendChild(spanTwo);
  const mainIcon = document.createElement("span");
  mainIcon.id = topbarIconId;
  mainIcon.classList.add("bp3-button", "bp3-minimal", "bp3-small");
  mainIcon.setAttribute("role", "button");
  mainIcon.setAttribute("aria-label", "Ask AI");
  mainIcon.innerHTML = CRYSTAL_BALL_SVG;
  spanTwo.appendChild(mainIcon);

  nextIconButton.insertAdjacentElement("afterend", mainButton);

  const leftSpaceDiv = document.createElement("div");
  leftSpaceDiv.id = topBarFlexLeftSpaceId;
  leftSpaceDiv.className = "rm-topbar__spacer-sm";
  mainButton.insertAdjacentElement("beforebegin", leftSpaceDiv);

  const rightSpaceDiv = document.createElement("div");
  rightSpaceDiv.id = topBarFlexRightSpaceId;
  rightSpaceDiv.className = "rm-topbar__spacer-sm";
  mainButton.insertAdjacentElement("afterend", rightSpaceDiv);

  // Ask AI reads the focused block. preventDefault keeps that focus,
  // which a navigation button like Random Block does not need.
  mainButton.addEventListener("mousedown", (evt) => evt.preventDefault());
  mainButton.addEventListener("click", () => {
    void askAI(getAISettings);
  });
  console.log(`[${EXTENSION_NAME}] top bar button inserted`);
}

function removeButtonTopbar() {
  let domIdsToRemove = [topbarButtonId, topBarFlexLeftSpaceId, topBarFlexRightSpaceId];
  domIdsToRemove.forEach((domId) => {
    let elem = document.getElementById(domId);
    if (elem) {
      elem.remove();
    }
  });
}

function addButtonLeftSidebar() {
  // Same left-sidebar log button as roam-depot-random-block, under Daily Notes.
  if (document.getElementById(leftSidebarButtonId)) return;
  const sidebarcontent = document.querySelector(
    "#app > div.roam-body > div.roam-app > div.roam-sidebar-container.noselect > div",
  );
  const sidebartoprow = sidebarcontent?.childNodes[1];
  if (!sidebarcontent || !sidebartoprow) return;

  const divButton = document.createElement("div");
  divButton.classList.add("log-button");
  divButton.innerHTML = "Ask AI";
  divButton.id = leftSidebarButtonId;
  const spanIcon = document.createElement("span");
  spanIcon.classList.add("bp3-icon", "icon");
  spanIcon.innerHTML = CRYSTAL_BALL_SVG;
  divButton.prepend(spanIcon);
  sidebartoprow.parentNode.insertBefore(divButton, sidebartoprow.nextSibling);
  divButton.addEventListener("mousedown", (evt) => evt.preventDefault());
  divButton.onclick = () => {
    void askAI(getAISettings);
  };
}

function removeButtonLeftSidebar() {
  let domIdsToRemove = [leftSidebarButtonId];
  domIdsToRemove.forEach((domId) => {
    let elem = document.getElementById(domId);
    if (elem) {
      elem.remove();
    }
  });
}

function buttonPosition() {
  return (
    extensionAPI?.settings.get("button-position") || "Both topbar and sidebar"
  );
}

function addAndRemoveButtonsAsRequired() {
  let value = buttonPosition();
  showTopbarButton = value !== "Only left sidebar";
  showSidebarButton = value !== "Only topbar";
  if (showSidebarButton) addButtonLeftSidebar();
  else removeButtonLeftSidebar();
  if (showTopbarButton) addButtonTopbar();
  else removeButtonTopbar();
}

// Roam re-renders .rm-topbar after auto-start and drops nodes it did not
// create. Keep putting the button back for as long as the extension is loaded.
let ensureQueued = false;

function ensureButtons() {
  if (!extensionAPI) return;
  try {
    addAndRemoveButtonsAsRequired();
  } catch (error) {
    console.error(
      `[${EXTENSION_NAME}] could not place the Ask AI button`,
      error,
    );
  }
}

function queueEnsureButtons() {
  if (ensureQueued) return;
  ensureQueued = true;
  setTimeout(() => {
    ensureQueued = false;
    ensureButtons();
  }, 200);
}

function buttonsMissing() {
  if (showTopbarButton && !document.getElementById(topbarIconId)) return true;
  if (showSidebarButton && !document.getElementById(leftSidebarButtonId)) return true;
  return false;
}

function startButtonWatcher() {
  stopButtonWatcher();
  ensureButtons();
  const observeTarget = document.body || document.documentElement;
  if (typeof MutationObserver !== "undefined" && observeTarget) {
    buttonObserver = new MutationObserver(() => {
      if (buttonsMissing()) queueEnsureButtons();
    });
    buttonObserver.observe(observeTarget, { childList: true, subtree: true });
  }
  buttonTimer = setInterval(() => {
    if (buttonsMissing()) ensureButtons();
  }, 1000);
}

function stopButtonWatcher() {
  if (buttonObserver) {
    buttonObserver.disconnect();
    buttonObserver = null;
  }
  if (buttonTimer) {
    clearInterval(buttonTimer);
    buttonTimer = null;
  }
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
        id: "button-position",
        name: "Display button location(s)",
        description: "Where do you want to display the Ask AI button?",
        action: {
          type: "select",
          items: ["Both topbar and sidebar", "Only left sidebar", "Only topbar"],
          onChange: () => {
            setTimeout(() => {
              ensureButtons();
            }, 100);
          },
        },
      },
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

  for (const [id, value] of Object.entries(SETTING_DEFAULTS)) {
    if (extensionAPI.settings.get(id) == null) {
      await extensionAPI.settings.set(id, value);
    }
  }

  extensionAPI.settings.panel.create(buildPanelConfig());
  startButtonWatcher();
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
  stopButtonWatcher();
  removeButtonTopbar();
  removeButtonLeftSidebar();
  console.log(`${pkg.name} version ${pkg.version} unloaded`);
  extensionAPI = undefined;
}

export default {
  onload,
  onunload,
};
