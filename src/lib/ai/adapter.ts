import { APICallError, embedMany, Output, streamText } from "ai";

import { buildMutationPrompt } from "@/lib/ai/prompt";
import { mutationProposalSchema } from "@/lib/domain/schemas";
import type {
  GenerationRequest,
  MutationProposal,
} from "@/lib/domain/types";

export const DEFAULT_MUTATION_MODEL = "openai/gpt-5.6-terra";
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

export interface PublicAiError {
  status: number;
  code: string;
  message: string;
}

export function hasGatewayCredentials(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    environment.AI_GATEWAY_API_KEY || environment.VERCEL_OIDC_TOKEN,
  );
}

export function configuredMutationModel(): string {
  return process.env.GRAPHWAKE_MODEL ?? DEFAULT_MUTATION_MODEL;
}

export function configuredEmbeddingModel(): string {
  return process.env.GRAPHWAKE_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
}

export function streamMutationElements(
  request: GenerationRequest,
  signal: AbortSignal,
): AsyncIterable<MutationProposal> {
  const result = streamText({
    model: configuredMutationModel(),
    output: Output.array({
      element: mutationProposalSchema,
      description: "A bounded sequence of typed evidence graph mutations.",
    }),
    prompt: buildMutationPrompt(request),
    abortSignal: signal,
    providerOptions: {
      gateway: {
        tags: ["project:graphwake", "feature:graph-mutation"],
      },
    },
  });

  return result.elementStream;
}

export async function embedNodeTexts(
  values: string[],
  signal: AbortSignal,
) {
  const model = configuredEmbeddingModel();
  const result = await embedMany({
    model,
    values,
    abortSignal: signal,
    providerOptions: {
      gateway: {
        tags: ["project:graphwake", "feature:node-embedding"],
      },
    },
  });

  return {
    model,
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

  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 402:
        return {
          status: 402,
          code: "BUDGET_EXCEEDED",
          message: "The configured AI Gateway budget has been reached.",
        };
      case 429:
        return {
          status: 429,
          code: "RATE_LIMITED",
          message: "The AI Gateway rate limit was reached. Resume after a short wait.",
        };
      case 503:
        return {
          status: 503,
          code: "GATEWAY_UNAVAILABLE",
          message: "The AI Gateway is temporarily unavailable.",
        };
    }
  }

  return {
    status: 502,
    code: "MODEL_FAILED",
    message: "The model could not complete this graph batch.",
  };
}
