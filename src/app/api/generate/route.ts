import {
  hasGatewayCredentials,
  publicAiError,
  streamMutationElements,
} from "@/lib/ai/adapter";
import { generationRequestSchema } from "@/lib/domain/schemas";

const encoder = new TextEncoder();

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
      "Configure Vercel AI Gateway to use the model engine. The local engine remains available.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
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
    elements = streamMutationElements(parsed.data, request.signal);
  } catch (error) {
    const failure = publicAiError(error);
    return jsonError(failure.status, failure.code, failure.message);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const element of elements) {
          controller.enqueue(encoder.encode(`${JSON.stringify(element)}\n`));
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
