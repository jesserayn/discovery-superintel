# Roam Discover Superintelligence

Ask AI in Roam Research using Grok, Claude, or Muse. The focused block is the request, selected blocks provide context, and the streamed answer is inserted as child blocks of the focused block.

## Setup

1. Run `./build.sh` to install dependencies and build `extension.js`.
2. In Roam, open **Settings > Roam Depot**, enable developer mode, choose **Load extension**, and select this folder.
3. Open **Settings > Extensions > Roam Discover Superintelligence** and add the API key and model for your provider.
4. Select the provider you want Ask AI to use.

API keys are stored in Roam's extension settings. Anyone with access to the graph should be treated as able to access those settings.

## Usage

1. Focus a block containing your request.
2. Optionally select other blocks to use as context.
3. Open the command palette and run **Roam Discover Superintelligence: Ask AI**.
4. To use a keyboard shortcut, assign one to the command in Roam's Hotkeys settings. The extension intentionally does not claim a default hotkey.

Every answer starts with which provider and model produced it and ends with a continuation note. To go back and forth: write your follow-up in a new block under the answer, focus it, and run Ask AI again, selecting any earlier blocks you want included as context.

## Development

- `npm run build` builds `extension.js`.
- `npm run watch` rebuilds while developing; reload the extension in Roam after changes.
- `npm test` runs the text-helper tests.
