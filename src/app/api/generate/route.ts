import { publicAiError, streamMutationElements } from "@/lib/ai/adapter";
import { generationRequestSchema } from "@/lib/domain/schemas";
import { readAiCredentials } from "@/lib/http/aiCredentials";
import {
  AiRequestBodyError,
  authorizeAiRequest,
  guardAiAuthorizationFailure,
  guardAiRequest,
  readBoundedJson,
} from "@/lib/http/aiRequestGuard";
import { RUN_LIMITS } from "@/lib/runtime/limits";

const encoder = new TextEncoder();

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

  const credentials = readAiCredentials(request);
  if ("rejection" in credentials) {
    return jsonError(
      credentials.rejection.status,
      credentials.rejection.code,
      credentials.rejection.message,
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

  const parsed = generationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_REQUEST",
      parsed.error.issues[0]?.message ?? "The generation request is invalid.",
    );
  }

  let elements;
  try {
    elements = streamMutationElements(
      parsed.data,
      credentials.credentials,
      request.signal,
    );
  } catch (error) {
    const failure = publicAiError(error);
    return jsonError(failure.status, failure.code, failure.message);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let emitted = 0;
        for await (const element of elements) {
          controller.enqueue(encoder.encode(`${JSON.stringify(element)}\n`));
          emitted += 1;
          if (emitted >= RUN_LIMITS.proposalsPerBatch) break;
        }
      } catch (error) {
        const failure = publicAiError(error);
        if (failure.code !== "ABORTED") {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "error",
                code: failure.code,
                message: failure.message,
              })}\n`,
            ),
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
