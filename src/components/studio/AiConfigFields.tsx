"use client";

import { useEffect, useState } from "react";

import {
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  type AiProviderId,
  FALLBACK_MODELS,
} from "@/lib/ai/catalog";
import {
  getAiKey,
  getAiModel,
  getAppToken,
  setAppToken,
} from "@/lib/runtime/aiAccess";

export interface AiConfigValue {
  provider: AiProviderId;
  apiKey: string;
  model: string;
}

interface AiConfigFieldsProps {
  value: AiConfigValue;
  onChange: (next: AiConfigValue) => void;
}

type ModelsStatus = "idle" | "loading" | "live" | "fallback";

interface ProviderModel {
  id: string;
  label: string;
}

export function AiConfigFields({ value, onChange }: AiConfigFieldsProps) {
  const provider = AI_PROVIDERS[value.provider];
  const [models, setModels] = useState<ProviderModel[]>(() =>
    FALLBACK_MODELS[value.provider].map((id) => ({ id, label: id })),
  );
  const [status, setStatus] = useState<ModelsStatus>("idle");
  const [appToken, setAppTokenState] = useState(() => getAppToken());

  // Switching providers recalls that provider's stored key and model and resets
  // the visible list to its offline fallback until a live fetch replaces it.
  function selectProvider(nextProvider: AiProviderId) {
    setModels(FALLBACK_MODELS[nextProvider].map((id) => ({ id, label: id })));
    setStatus("idle");
    onChange({
      provider: nextProvider,
      apiKey: getAiKey(nextProvider),
      model: getAiModel(nextProvider),
    });
  }

  // Fetch the models this key can actually reach, debounced on key edits.
  useEffect(() => {
    const key = value.apiKey.trim();
    let cancelled = false;

    if (!key) {
      const reset = setTimeout(() => {
        if (cancelled) return;
        setStatus("idle");
        setModels(
          FALLBACK_MODELS[value.provider].map((id) => ({ id, label: id })),
        );
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(reset);
      };
    }

    const timer = setTimeout(() => {
      if (cancelled) return;
      setStatus("loading");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-graphwake-provider": value.provider,
        "x-graphwake-key": key,
      };
      const token = getAppToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      void fetch("/api/models", { method: "POST", headers, body: "{}" })
        .then(async (response) => ({ ok: response.ok, body: await response.json() }))
        .then(({ ok, body }) => {
          if (cancelled) return;
          const list = (body as { models?: ProviderModel[] }).models;
          if (ok && Array.isArray(list) && list.length > 0) {
            setModels(list);
            setStatus("live");
          } else {
            setStatus("fallback");
          }
        })
        .catch(() => {
          if (!cancelled) setStatus("fallback");
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value.provider, value.apiKey, appToken]);

  // Keep the current selection choosable even if it is not in the live list.
  const options = models.some((model) => model.id === value.model)
    ? models
    : [{ id: value.model, label: value.model }, ...models];

  return (
    <div className="ai-config-fields">
      <label>
        <span>Provider</span>
        <select
          name="provider"
          value={value.provider}
          onChange={(event) => selectProvider(event.target.value as AiProviderId)}
        >
          {AI_PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>
              {AI_PROVIDERS[id].label}
            </option>
          ))}
        </select>
        <small className="field-hint">{provider.blurb}</small>
      </label>

      <label>
        <span>{provider.keyLabel}</span>
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={provider.keyPlaceholder}
          value={value.apiKey}
          onChange={(event) => onChange({ ...value, apiKey: event.target.value })}
        />
        <small className="field-hint">
          Stored only in this browser session, never in a project or export.{" "}
          <a href={provider.keyUrl} target="_blank" rel="noreferrer">
            Get a key
          </a>
          .
        </small>
      </label>

      <label>
        <span>Model</span>
        <select
          name="model"
          value={value.model}
          onChange={(event) => onChange({ ...value, model: event.target.value })}
        >
          {options.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
        <small className="field-hint" data-models-status={status}>
          {status === "loading"
            ? "Loading the models this key can reach."
            : status === "live"
              ? `${models.length} models available to this key.`
              : status === "fallback"
                ? "Could not list live models; showing the known catalog."
                : "Enter a key to load the live model list."}
        </small>
      </label>

      <details className="ai-config-advanced">
        <summary>Shared deployment? Add its access token</summary>
        <label>
          <span>Deployment access token</span>
          <input
            name="appToken"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={appToken}
            onChange={(event) => {
              setAppTokenState(event.target.value);
              setAppToken(event.target.value);
            }}
          />
          <small className="field-hint">
            Only needed when a public deployment sets GRAPHWAKE_API_TOKEN. Left
            blank for local use.
          </small>
        </label>
      </details>
    </div>
  );
}
