import type { AiCredentials } from "@/lib/ai/adapter";
import { type AiProviderId, isAiProviderId } from "@/lib/ai/catalog";
import type { AiRequestRejection } from "@/lib/http/aiRequestGuard";

const MAX_MODEL_LENGTH = 200;
const MAX_KEY_LENGTH = 400;

// The browser sends the active provider, model, and the user's own API key as
// request headers. These never touch the server environment or the project
// ledger; the route forwards them to the chosen provider for one request.
const PROVIDER_HEADER = "x-graphwake-provider";
const MODEL_HEADER = "x-graphwake-model";
const KEY_HEADER = "x-graphwake-key";

function readProvider(
  request: Request,
): { provider: AiProviderId } | { rejection: AiRequestRejection } {
  const provider = request.headers.get(PROVIDER_HEADER);
  if (!isAiProviderId(provider)) {
    return {
      rejection: {
        status: 400,
        code: "PROVIDER_REQUIRED",
        message: "Choose an AI provider (OpenAI, Anthropic, or NEAR AI).",
      },
    };
  }
  return { provider };
}

function readKey(
  request: Request,
): { apiKey: string } | { rejection: AiRequestRejection } {
  const apiKey = (request.headers.get(KEY_HEADER) ?? "").trim();
  if (!apiKey || apiKey.length > MAX_KEY_LENGTH) {
    return {
      rejection: {
        status: 400,
        code: "KEY_REQUIRED",
        message: "Enter your provider API key to use the model engine.",
      },
    };
  }
  return { apiKey };
}

// Full credentials for generation and embedding requests.
export function readAiCredentials(
  request: Request,
): { credentials: AiCredentials } | { rejection: AiRequestRejection } {
  const provider = readProvider(request);
  if ("rejection" in provider) return provider;
  const key = readKey(request);
  if ("rejection" in key) return key;

  const model = (request.headers.get(MODEL_HEADER) ?? "").trim();
  if (!model || model.length > MAX_MODEL_LENGTH) {
    return {
      rejection: {
        status: 400,
        code: "MODEL_REQUIRED",
        message: "Select a model for this provider.",
      },
    };
  }

  return {
    credentials: { provider: provider.provider, model, apiKey: key.apiKey },
  };
}

// Provider plus key only, for listing a provider's available models.
export function readModelListCredentials(
  request: Request,
): { provider: AiProviderId; apiKey: string } | { rejection: AiRequestRejection } {
  const provider = readProvider(request);
  if ("rejection" in provider) return provider;
  const key = readKey(request);
  if ("rejection" in key) return key;
  return { provider: provider.provider, apiKey: key.apiKey };
}
