## 1.0.0 - 2026-10-12
### Added
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
