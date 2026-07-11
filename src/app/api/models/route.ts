import { type AiProviderId, NEAR_AI_BASE_URL } from "@/lib/ai/catalog";
import { readModelListCredentials } from "@/lib/http/aiCredentials";
import {
  authorizeAiRequest,
  guardAiAuthorizationFailure,
  guardAiRequest,
} from "@/lib/http/aiRequestGuard";

interface ProviderModel {
  id: string;
  label: string;
}

// Models that cannot generate graph mutations. Kept out of the generation
// dropdown; embeddings are selected automatically per provider.
const NON_GENERATION = [
  "embedding",
  "embed",
  "reranker",
  "rerank",
  "whisper",
  "transcribe",
  "tts",
  "audio",
  "moderation",
  "dall-e",
  "image",
  "flux",
];

function jsonError(status: number, code: string, message: string): Response {
  return Response.json(
    { code, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isGenerationModel(id: string): boolean {
  const lower = id.toLocaleLowerCase("en-US");
  return !NON_GENERATION.some((token) => lower.includes(token));
}

function providerRequest(
  provider: AiProviderId,
  apiKey: string,
): { url: string; headers: Record<string, string> } {
  switch (provider) {
    case "openai":
      return {
        url: "https://api.openai.com/v1/models",
        headers: { Authorization: `Bearer ${apiKey}` },
      };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/models?limit=1000",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      };
    case "nearai":
      return {
        url: `${NEAR_AI_BASE_URL}/models`,
        headers: { Authorization: `Bearer ${apiKey}` },
      };
  }
}

function normalize(payload: unknown): ProviderModel[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  const models: ProviderModel[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = record.id;
    if (typeof id !== "string" || !id) continue;
    if (!isGenerationModel(id)) continue;
    const label =
      typeof record.display_name === "string" && record.display_name
        ? record.display_name
        : typeof record.name === "string" && record.name
          ? record.name
          : id;
    models.push({ id, label });
  }
  models.sort((left, right) => left.id.localeCompare(right.id));
  return models;
}

export async function POST(request: Request): Promise<Response> {
  const authorization = authorizeAiRequest(request);
  if (authorization) {
    const failureLimit =
      authorization.status === 401 ? guardAiAuthorizationFailure() : null;
    const rejection = failureLimit ?? authorization;
    return jsonError(rejection.status, rejection.code, rejection.message);
  }

  const rejection = guardAiRequest(request);
  if (rejection) {
    return jsonError(rejection.status, rejection.code, rejection.message);
  }

  const credentials = readModelListCredentials(request);
  if ("rejection" in credentials) {
    return jsonError(
      credentials.rejection.status,
      credentials.rejection.code,
      credentials.rejection.message,
    );
  }

  const { url, headers } = providerRequest(
    credentials.provider,
    credentials.apiKey,
  );

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return jsonError(
      502,
      "MODEL_LIST_FAILED",
      "Could not reach the provider to list its models.",
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return jsonError(401, "INVALID_KEY", "The provider rejected this API key.");
    }
    return jsonError(
      502,
      "MODEL_LIST_FAILED",
      "The provider could not list its models for this key.",
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const models = normalize(payload);
  if (models.length === 0) {
    return jsonError(
      502,
      "MODEL_LIST_EMPTY",
      "The provider returned no usable models for this key.",
    );
  }

  return Response.json(
    { models },
    { headers: { "Cache-Control": "no-store" } },
  );
}
