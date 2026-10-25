## Unreleased
### Added
- Provider: OpenRouter, selectable with its own API key and model in the Roam settings panel (default model `anthropic/claude-sonnet-4.5`). It uses OpenRouter's OpenAI-compatible API, so any OpenRouter model ID in `provider/model` form works, and the reasoning effort setting applies to it. Switch to it from the command palette with **Discovery Superintel: Use OpenRouter**.
- Context fidelity: selected blocks now include their descendants, block references and embeds are resolved to the text they point to, and thread context sends the ancestor path plus prior content only (branches after the follow-up are no longer sent). The attribution block notes the context source and block count.
- Multi-turn threads: a follow-up inside an earlier Q&A thread is sent as alternating user/assistant messages instead of one flat context blob. All providers share an 8,192-token output limit, and a truncated answer ends with a truncation notice.
### Fixed
- Running Ask AI while a request is already streaming now shows an "already running" notice instead of silently doing nothing.
- To-dos in answers now render as Roam checkboxes: Markdown task items (`- [ ] …`, `- [x] …`) and model-emitted `[[to-do]]`, `{{[[to-do]]}}`, and `{{todo}}` prefixes are converted to `{{[[TODO]]}}` / `{{[[DONE]]}}` blocks instead of landing as literal text or a `[[to-do]]` page reference. Existing Roam TODO/DONE blocks, other page references such as `[[Infinite Ways]]`, mid-sentence brackets, and code blocks are left untouched.

## 1.0.0 - 2026-10-12
### Added
- Renamed to Discovery Superintel.
- The system prompt is edited in a multi-line text field in the tool settings, pre-filled with the current default prompt.
- Ask AI command: uses the focused block as the request and selected blocks as context, streaming the answer into child blocks.
- Providers: Grok (xAI), Claude (Anthropic), and Muse (Meta Model API), selectable with per-provider API keys, models, and an optional system prompt in the Roam settings panel.
- Roam-native response formatting: headings become bold text, list markers are stripped into their own nested blocks, horizontal rules and empty blocks are skipped, and wrapped lines are joined.
- Response framing: every answer opens by naming the provider and model that produced it and closes with a note explaining how to continue the conversation inline.
- Reasoning effort setting for Grok and Muse, shown in the attribution line; the whole answer nests under the attribution block, and multi-select continuation prompts from the last selected block.
- Command-palette commands to switch provider/model and reasoning effort without opening settings.
- Automatic thread context: a focused follow-up nested in a previous Q&A thread includes the thread above it as context (explicit selection wins).
- Cancel: abort an in-flight stream from the command palette or the on-screen Cancel button.
- The continuation note at the end of each answer can be turned off in settings.
- Crystal-ball button in the Roam top bar that runs Ask AI.
- The top bar button now also appears when the extension auto-starts before Roam's top bar has rendered (for example, PR-shorthand loads).
- Markdown tables in answers are converted to one Roam block per row instead of a single pipe-filled block.
- The top bar button now uses Roam's native Blueprint button structure so it renders reliably in shipped (PR-shorthand / Depot) loads; insertion is re-checked continuously and logged to the console.
- Ask AI button uses a crystal-ball SVG in the same top-bar slot as other icon buttons, and can also sit in the left sidebar. Choose the location in settings.
