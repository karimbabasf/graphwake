import {
  embedNodeTexts,
  hasGatewayCredentials,
  publicAiError,
} from "@/lib/ai/adapter";
import { embeddingRequestSchema } from "@/lib/domain/schemas";

function jsonError(status: number, code: string, message: string): Response {
  return Response.json(
    { code, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!hasGatewayCredentials()) {
    return jsonError(
      503,
      "GATEWAY_UNAVAILABLE",
      "Configure Vercel AI Gateway to create model embeddings.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const parsed = embeddingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_REQUEST",
      parsed.error.issues[0]?.message ?? "The embedding request is invalid.",
    );
  }

  try {
    const result = await embedNodeTexts(parsed.data.values, request.signal);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const failure = publicAiError(error);
    return jsonError(failure.status, failure.code, failure.message);
  }
}
