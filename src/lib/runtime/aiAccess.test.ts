import { beforeEach, describe, expect, it } from "vitest";

import {
  aiRequestHeaders,
  getActiveAiConfig,
  hasAiCredentials,
  saveAiConfig,
  setAppToken,
} from "@/lib/runtime/aiAccess";

describe("AI access", () => {
  beforeEach(() => sessionStorage.clear());

  it("has no credentials until a key is stored", () => {
    expect(hasAiCredentials()).toBe(false);
    expect(getActiveAiConfig()).toBeNull();
  });

  it("carries the active provider, model, and key as request headers", () => {
    saveAiConfig({ provider: "nearai", apiKey: "near-key", model: "openai/gpt-5.1" });

    expect(hasAiCredentials()).toBe(true);
    expect(aiRequestHeaders()).toMatchObject({
      "x-graphwake-provider": "nearai",
      "x-graphwake-model": "openai/gpt-5.1",
      "x-graphwake-key": "near-key",
    });
  });

  it("remembers a separate key and model per provider", () => {
    saveAiConfig({ provider: "openai", apiKey: "openai-key", model: "gpt-5.1" });
    saveAiConfig({ provider: "anthropic", apiKey: "ant-key", model: "claude-sonnet-4-6" });

    // The active provider is the last one saved.
    expect(getActiveAiConfig()).toEqual({
      provider: "anthropic",
      apiKey: "ant-key",
      model: "claude-sonnet-4-6",
    });
  });

  it("adds the optional deployment token as a bearer header", () => {
    saveAiConfig({ provider: "openai", apiKey: "openai-key", model: "gpt-5.1" });
    setAppToken("deployment-access-token-value");

    expect(aiRequestHeaders().Authorization).toBe(
      "Bearer deployment-access-token-value",
    );
  });
});
