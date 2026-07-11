import {
  embedNodeTexts,
  hasGatewayCredentials,
  publicAiError,
} from "@/lib/ai/adapter";
import { embeddingRequestSchema } from "@/lib/domain/schemas";
import {
  AiRequestBodyError,
  authorizeAiRequest,
  guardAiAuthorizationFailure,
  guardAiRequest,
  readBoundedJson,
} from "@/lib/http/aiRequestGuard";

function jsonError(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { code, message },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const authorization = authorizeAiRequest(request);
  if (authorization) {
    const failureLimit = authorization.status === 401
      ? guardAiAuthorizationFailure()
      : null;
    const rejection = failureLimit ?? authorization;
    return jsonError(
      rejection.status,
      rejection.code,
      rejection.message,
      rejection.headers,
    );
  }

  const rejection = guardAiRequest(request);
  if (rejection) {
    return jsonError(
      rejection.status,
      rejection.code,
      rejection.message,
      rejection.headers,
    );
  }

  if (!hasGatewayCredentials()) {
    return jsonError(
      503,
      "GATEWAY_UNAVAILABLE",
      "Configure Vercel AI Gateway to create model embeddings.",
    );
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof AiRequestBodyError) {
      return jsonError(error.status, error.code, error.message);
    }
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
