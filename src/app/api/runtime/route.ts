import {
  configuredEmbeddingModel,
  configuredMutationModel,
  hasGatewayCredentials,
} from "@/lib/ai/adapter";
import { RUN_LIMITS } from "@/lib/runtime/limits";

export function GET(): Response {
  return Response.json(
    {
      gatewayConfigured: hasGatewayCredentials(),
      accessTokenRequired: Boolean(process.env.GRAPHWAKE_API_TOKEN),
      mutationModel: configuredMutationModel(),
      embeddingModel: configuredEmbeddingModel(),
      limits: RUN_LIMITS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
