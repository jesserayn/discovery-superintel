# Roam and Discover Superintelligence

Ask AI in Roam Research using Grok, Claude, or Muse. The focused block is the request, context comes from your selection or the surrounding thread (see below), and the streamed answer is inserted as nested blocks under the focused block.

## Installation

Install from Roam Depot, then open **Settings > Extensions > Roam and Discover Superintelligence** and add the API key and model for your provider, and select the provider you want Ask AI to use.

API keys are stored in Roam's extension settings. Anyone with access to the graph should be treated as able to access those settings.

## What exactly is sent to the AI

Only the request, its context, and your optional system prompt are sent — to the one provider you selected (xAI, Anthropic, or Meta). Nothing else leaves your graph.

- **Request:** the text of the focused block. With a multi-block selection and no focused block, the *last* selected block is the request.
- **Context**, in priority order:
  1. If you selected blocks, every selected block except the request block.
  2. Otherwise, any highlighted text selection.
  3. Otherwise, if the request block is nested inside an earlier thread, the thread around it: the outermost ancestor block of the request block and *all of its descendants* (indentation preserved), excluding the request block's own subtree. This can be most of a page outline if the request sits at the top level of a large page, so it is capped at 80 blocks and 12,000 characters and truncated beyond that.
- **System prompt:** the optional text from the settings panel, sent with every request.

## Usage

1. Focus a block containing your request.
2. Optionally select other blocks to use as context.
3. Open the command palette and run **Roam and Discover Superintelligence: Ask AI** — or click the crystal-ball button at the right end of the top bar.
4. To use a keyboard shortcut, assign one to the command in Roam's Hotkeys settings. The extension intentionally does not claim a default hotkey.

You can also switch model and effort without opening settings: press Cmd+P and run **Roam and Discover Superintelligence: Use Grok / Claude / Muse** or **Set effort …**.

Every answer starts with an attribution block naming the provider and model (plus reasoning effort for Grok and Muse, configurable via the Reasoning effort setting) and, by default, ends with a short note explaining how to continue the conversation; turn that note off in settings (**Continuation note**) once you know the flow. The whole answer nests under the attribution block. To go back and forth: write your follow-up in a new block under the answer, focus it, and run Ask AI again — the thread above it is included as context automatically (an explicit selection overrides this). While an answer is streaming, cancel it with the **Cancel Ask AI** palette command or the on-screen Cancel button.

## Local development

For working on this extension itself:

1. Run `./build.sh` to install dependencies and build `extension.js`.
2. In Roam, open **Settings > Roam Depot**, enable developer mode, choose **Load extension**, and select this folder.
3. Reload after code changes with `ctrl-d ctrl-r`, or from **Settings > Roam Depot > Developer Extensions**.

- `npm run build` builds `extension.js`.
- `npm run watch` rebuilds while developing; reload the extension in Roam after changes.
- `npm test` runs the tests.
