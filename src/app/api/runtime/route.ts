import {
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  DEFAULT_EMBEDDING_MODELS,
  DEFAULT_MODELS,
  FALLBACK_MODELS,
} from "@/lib/ai/catalog";
import { RUN_LIMITS } from "@/lib/runtime/limits";

export function GET(): Response {
  return Response.json(
    {
      accessTokenRequired: Boolean(process.env.GRAPHWAKE_API_TOKEN),
      providers: AI_PROVIDER_IDS.map((id) => ({
        ...AI_PROVIDERS[id],
        defaultModel: DEFAULT_MODELS[id],
        embeddingModel: DEFAULT_EMBEDDING_MODELS[id],
        models: FALLBACK_MODELS[id],
      })),
      limits: RUN_LIMITS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
