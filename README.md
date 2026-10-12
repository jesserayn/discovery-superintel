# Jesse Roam AI

Ask AI in Roam Research using Grok, Claude, or Muse. The focused block is the request, selected blocks provide context, and the streamed answer is inserted as child blocks of the focused block.

## Setup

1. Run `./build.sh` to install dependencies and build `extension.js`.
2. In Roam, open **Settings > Roam Depot**, enable developer mode, choose **Load extension**, and select this folder.
3. Open **Settings > Extensions > Jesse Roam AI** and add the API key and model for your provider.
4. Select the provider you want Ask AI to use.

API keys are stored in Roam's extension settings. Anyone with access to the graph should be treated as able to access those settings.

## Usage

1. Focus a block containing your request.
2. Optionally select other blocks to use as context.
3. Open the command palette and run **Jesse Roam AI: Ask AI**.
4. To use a keyboard shortcut, assign one to the command in Roam's Hotkeys settings. The extension intentionally does not claim a default hotkey.

## Development

- `npm run build` builds `extension.js`.
- `npm run watch` rebuilds while developing; reload the extension in Roam after changes.
- `npm test` runs the text-helper tests.
