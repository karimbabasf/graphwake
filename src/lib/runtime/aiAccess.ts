import {
  type AiProviderId,
  DEFAULT_MODELS,
  isAiProviderId,
} from "@/lib/ai/catalog";

// AI configuration lives in sessionStorage only. The provider key, selected
// model, and optional deployment token never enter a project ledger or an
// export. Each request carries them as headers to the same-origin API route,
// which forwards them to the chosen provider.
const PROVIDER_KEY = "graphwake:ai:provider";
const KEY_PREFIX = "graphwake:ai:key:";
const MODEL_PREFIX = "graphwake:ai:model:";
const APP_TOKEN_KEY = "graphwake:app-token";

function store(): Storage | null {
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

export function getAiProvider(): AiProviderId {
  const value = store()?.getItem(PROVIDER_KEY);
  return isAiProviderId(value) ? value : "openai";
}

export function setAiProvider(provider: AiProviderId): void {
  store()?.setItem(PROVIDER_KEY, provider);
}

export function getAiKey(provider: AiProviderId): string {
  return store()?.getItem(`${KEY_PREFIX}${provider}`) ?? "";
}

export function setAiKey(provider: AiProviderId, value: string): void {
  const storage = store();
  if (!storage) return;
  const key = value.trim();
  if (key) storage.setItem(`${KEY_PREFIX}${provider}`, key);
  else storage.removeItem(`${KEY_PREFIX}${provider}`);
}

export function getAiModel(provider: AiProviderId): string {
  return (
    store()?.getItem(`${MODEL_PREFIX}${provider}`) ?? DEFAULT_MODELS[provider]
  );
}

export function setAiModel(provider: AiProviderId, model: string): void {
  const storage = store();
  if (!storage) return;
  const value = model.trim();
  if (value) storage.setItem(`${MODEL_PREFIX}${provider}`, value);
  else storage.removeItem(`${MODEL_PREFIX}${provider}`);
}

export function getAppToken(): string {
  return store()?.getItem(APP_TOKEN_KEY) ?? "";
}

export function setAppToken(value: string): void {
  const storage = store();
  if (!storage) return;
  const token = value.trim();
  if (token) storage.setItem(APP_TOKEN_KEY, token);
  else storage.removeItem(APP_TOKEN_KEY);
}

export interface AiConfig {
  provider: AiProviderId;
  model: string;
  apiKey: string;
}

// The active provider's full configuration, or null when no key is stored.
export function getActiveAiConfig(): AiConfig | null {
  const provider = getAiProvider();
  const apiKey = getAiKey(provider);
  if (!apiKey) return null;
  return { provider, model: getAiModel(provider), apiKey };
}

export function hasAiCredentials(): boolean {
  return getActiveAiConfig() !== null;
}

// Persist a full selection at once (used by the create and settings dialogs).
export function saveAiConfig(config: AiConfig): void {
  setAiProvider(config.provider);
  setAiKey(config.provider, config.apiKey);
  setAiModel(config.provider, config.model);
}

// Headers for a same-origin AI request: JSON body, the active provider's
// credentials, and the optional deployment access token.
export function aiRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const config = getActiveAiConfig();
  if (config) {
    headers["x-graphwake-provider"] = config.provider;
    headers["x-graphwake-model"] = config.model;
    headers["x-graphwake-key"] = config.apiKey;
  }
  const token = store()?.getItem(APP_TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
