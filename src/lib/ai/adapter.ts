import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  APICallError,
  embedMany,
  type EmbeddingModel,
  type LanguageModel,
  Output,
  streamText,
} from "ai";

import {
  type AiProviderId,
  DEFAULT_EMBEDDING_MODELS,
  NEAR_AI_BASE_URL,
} from "@/lib/ai/catalog";
import { buildMutationPrompt } from "@/lib/ai/prompt";
import { mutationProposalSchema } from "@/lib/domain/schemas";
import type {
  GenerationRequest,
  MutationProposal,
} from "@/lib/domain/types";

// Credentials arrive per request from the browser (the user's own provider
// key). Nothing here is read from the server environment; there is no shared
// gateway key.
export interface AiCredentials {
  provider: AiProviderId;
  model: string;
  apiKey: string;
}

export interface PublicAiError {
  status: number;
  code: string;
  message: string;
}

export class EmbeddingsUnsupportedError extends Error {
  constructor(provider: AiProviderId) {
    super(`The ${provider} provider does not offer embeddings.`);
    this.name = "EmbeddingsUnsupportedError";
  }
}

function mutationLanguageModel(credentials: AiCredentials): LanguageModel {
  const { provider, model, apiKey } = credentials;
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey }).chat(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "nearai":
      return createOpenAI({ apiKey, baseURL: NEAR_AI_BASE_URL }).chat(model);
  }
}

function embeddingLanguageModel(
  credentials: AiCredentials,
): { model: EmbeddingModel; modelId: string } {
  const { provider, apiKey } = credentials;
  const modelId = DEFAULT_EMBEDDING_MODELS[provider];
  if (!modelId) throw new EmbeddingsUnsupportedError(provider);

  const model =
    provider === "nearai"
      ? createOpenAI({ apiKey, baseURL: NEAR_AI_BASE_URL }).textEmbeddingModel(
          modelId,
        )
      : createOpenAI({ apiKey }).textEmbeddingModel(modelId);

  return { model, modelId };
}

export function streamMutationElements(
  request: GenerationRequest,
  credentials: AiCredentials,
  signal: AbortSignal,
): AsyncIterable<MutationProposal> {
  const result = streamText({
    model: mutationLanguageModel(credentials),
    output: Output.array({
      element: mutationProposalSchema,
      description: "A bounded sequence of typed evidence graph mutations.",
    }),
    prompt: buildMutationPrompt(request),
    abortSignal: signal,
    maxOutputTokens: 3_000,
  });

  return result.elementStream;
}

export async function embedNodeTexts(
  values: string[],
  credentials: AiCredentials,
  signal: AbortSignal,
) {
  const { model, modelId } = embeddingLanguageModel(credentials);
  const result = await embedMany({
    model,
    values,
    abortSignal: signal,
  });

  return {
    model: modelId,
    dimensions: result.embeddings[0]?.length ?? 0,
    vectors: result.embeddings,
    usage: result.usage,
  };
}

export function publicAiError(error: unknown): PublicAiError {
  if (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return { status: 499, code: "ABORTED", message: "The request was stopped." };
  }

  if (error instanceof EmbeddingsUnsupportedError) {
    return {
      status: 501,
      code: "EMBEDDINGS_UNSUPPORTED",
      message:
        "This provider has no embedding model. The local vector projection stays available.",
    };
  }

  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return {
          status: 401,
          code: "INVALID_KEY",
          message: "The provider rejected this API key.",
        };
      case 402:
        return {
          status: 402,
          code: "BUDGET_EXCEEDED",
          message: "The provider reported that this key has no remaining budget.",
        };
      case 404:
        return {
          status: 404,
          code: "MODEL_NOT_FOUND",
          message: "The selected model is not available for this key.",
        };
      case 429:
        return {
          status: 429,
          code: "RATE_LIMITED",
          message: "The provider rate limit was reached. Resume after a short wait.",
        };
      case 503:
        return {
          status: 503,
          code: "PROVIDER_UNAVAILABLE",
          message: "The provider is temporarily unavailable.",
        };
    }
  }

  return {
    status: 502,
    code: "MODEL_FAILED",
    message: "The model could not complete this graph batch.",
  };
}
