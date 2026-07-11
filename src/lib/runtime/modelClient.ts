import { mutationProposalSchema } from "@/lib/domain/schemas";
import type {
  GenerationRequest,
  MutationProposal,
} from "@/lib/domain/types";
import { aiRequestHeaders } from "@/lib/runtime/aiAccess";

export class ModelStreamError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ModelStreamError";
    this.code = code;
  }
}

export class ModelRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ModelRequestError";
    this.status = status;
    this.code = code;
  }
}

function parseLine(line: string): MutationProposal {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new ModelStreamError("INVALID_JSON", "The model stream returned invalid JSON.");
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (
      record.type === "error" &&
      typeof record.code === "string" &&
      typeof record.message === "string"
    ) {
      throw new ModelStreamError(record.code, record.message);
    }
  }

  const parsed = mutationProposalSchema.safeParse(value);
  if (!parsed.success) {
    throw new ModelStreamError(
      "INVALID_PROPOSAL",
      parsed.error.issues[0]?.message ?? "The model returned an invalid proposal.",
    );
  }
  return parsed.data;
}

export async function* parseNdjson(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<MutationProposal> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const cancel = () => void reader.cancel(signal?.reason);
  signal?.addEventListener("abort", cancel, { once: true });

  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield parseLine(line);
        newline = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    const finalLine = buffer.trim();
    if (finalLine) yield parseLine(finalLine);
  } finally {
    signal?.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

type Fetcher = typeof fetch;

export async function* requestMutationBatch(
  request: GenerationRequest,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
): AsyncGenerator<MutationProposal> {
  const response = await fetcher("/api/generate", {
    method: "POST",
    headers: aiRequestHeaders(),
    body: JSON.stringify(request),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new ModelRequestError(
      response.status,
      body?.code ?? "MODEL_REQUEST_FAILED",
      body?.message ?? `Model request failed with status ${response.status}.`,
    );
  }
  if (!response.body) {
    throw new ModelRequestError(
      502,
      "EMPTY_STREAM",
      "The model response did not include a stream.",
    );
  }

  yield* parseNdjson(response.body, signal);
}
