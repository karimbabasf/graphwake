// Provider catalog shared by the server adapter, the API routes, and the client
// UI. It carries no secrets and no server-only imports, so it is safe to bundle
// into the browser. The live model lists come from each provider's /v1/models
// endpoint (proxied through /api/models); the arrays below are the offline
// fallback shown before a key is entered or when that request fails.

export const AI_PROVIDER_IDS = ["openai", "anthropic", "nearai"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export interface AiProviderMeta {
  id: AiProviderId;
  label: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyUrl: string;
  supportsEmbeddings: boolean;
  blurb: string;
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderMeta> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    keyLabel: "OpenAI API key",
    keyPlaceholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
    supportsEmbeddings: true,
    blurb: "GPT and o-series models from your OpenAI account.",
  },
  anthropic: {
    id: "anthropic",
    label: "Claude (Anthropic)",
    keyLabel: "Anthropic API key",
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
    supportsEmbeddings: false,
    blurb: "Claude models direct from Anthropic. No vector embeddings.",
  },
  nearai: {
    id: "nearai",
    label: "NEAR AI Cloud",
    keyLabel: "NEAR AI API key",
    keyPlaceholder: "Your NEAR AI Cloud key",
    keyUrl: "https://cloud.near.ai",
    supportsEmbeddings: true,
    blurb: "One key, a large private catalog: Claude, GPT, Gemini, Qwen, more.",
  },
};

// The provider's OpenAI-compatible base URL. OpenAI and Anthropic use their SDK
// defaults; NEAR AI Cloud speaks the OpenAI Chat Completions and Embeddings API.
export const NEAR_AI_BASE_URL = "https://cloud-api.near.ai/v1";

// Default generation model per provider (the dropdown's first choice before a
// live list loads).
export const DEFAULT_MODELS: Record<AiProviderId, string> = {
  openai: "gpt-5.1",
  anthropic: "claude-sonnet-4-6",
  nearai: "openai/gpt-5.1",
};

// Embedding model per provider. Anthropic has no embeddings endpoint, so its
// vector layer stays on the deterministic local projection.
export const DEFAULT_EMBEDDING_MODELS: Record<AiProviderId, string | null> = {
  openai: "text-embedding-3-small",
  anthropic: null,
  nearai: "Qwen/Qwen3-Embedding-0.6B",
};

// Offline fallback lists. Kept intentionally close to each provider's current
// catalog; the live /api/models fetch replaces them whenever a key is present.
export const FALLBACK_MODELS: Record<AiProviderId, string[]> = {
  openai: [
    "gpt-5.1",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "o4-mini",
    "o3",
    "o3-mini",
  ],
  anthropic: [
    "claude-opus-4-8",
    "claude-opus-4-7",
    "claude-sonnet-5",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
  ],
  nearai: [
    "anthropic/claude-opus-4-7",
    "anthropic/claude-opus-4-6",
    "anthropic/claude-sonnet-4-6",
    "anthropic/claude-sonnet-4-5",
    "anthropic/claude-haiku-4-5",
    "openai/gpt-5.5",
    "openai/gpt-5.4",
    "openai/gpt-5.2",
    "openai/gpt-5.1",
    "openai/gpt-5",
    "openai/gpt-5-mini",
    "openai/gpt-5-nano",
    "openai/gpt-4.1",
    "openai/gpt-oss-120b",
    "openai/o4-mini",
    "openai/o3",
    "google/gemini-3.5-flash",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash",
    "deepseek/deepseek-v3.2",
    "deepseek-ai/DeepSeek-V4-Flash",
    "moonshotai/kimi-k2.6",
    "qwen/qwen3.7-max",
    "Qwen/Qwen3.5-122B-A10B",
    "z-ai/glm-5.2",
    "z-ai/glm-5",
    "minimax/minimax-m2.5",
  ],
};

export function isAiProviderId(value: unknown): value is AiProviderId {
  return (
    typeof value === "string" &&
    (AI_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

export function providerSupportsEmbeddings(provider: AiProviderId): boolean {
  return AI_PROVIDERS[provider].supportsEmbeddings;
}
