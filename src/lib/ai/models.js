// Claude models offered in the UI (kept separate from providers.js so pages
// can list them without loading the SDK bundle).
export const ANTHROPIC_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (most capable, default)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (fast & capable)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fastest, lowest cost)" },
];
