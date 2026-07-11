import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

const MAX_BODY_BYTES = 128 * 1024;
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 40;
const AUTH_FAILURES_PER_WINDOW = 20;
const MAX_RATE_BUCKETS = 8;

interface RateBucket {
  count: number;
  startedAt: number;
}

export interface AiRequestRejection {
  status: number;
  code: string;
  message: string;
  headers?: Record<string, string>;
}

export class AiRequestBodyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AiRequestBodyError";
    this.status = status;
    this.code = code;
  }
}

const buckets = new Map<string, RateBucket>();
let authorizationFailures: RateBucket | null = null;

type AiEnvironment = Partial<Pick<
  NodeJS.ProcessEnv,
  "GRAPHWAKE_API_TOKEN" | "NODE_ENV"
>>;

function safeTokenMatch(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export function authorizeAiRequest(
  request: Request,
  environment: AiEnvironment = process.env,
): AiRequestRejection | null {
  const configuredToken = environment.GRAPHWAKE_API_TOKEN;
  if (!configuredToken) {
    if (environment.NODE_ENV === "production") {
      return {
        status: 503,
        code: "AI_ROUTE_LOCKED",
        message:
          "Set GRAPHWAKE_API_TOKEN before enabling AI routes on a public deployment.",
      };
    }
    return null;
  }

  if (configuredToken.length < 24) {
    return {
      status: 503,
      code: "ACCESS_TOKEN_MISCONFIGURED",
      message: "GRAPHWAKE_API_TOKEN must contain at least 24 characters.",
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!safeTokenMatch(received, configuredToken)) {
    return {
      status: 401,
      code: "ACCESS_TOKEN_REQUIRED",
      message: "Enter this deployment's Graphwake access token.",
    };
  }

  return null;
}

function requestKey(request: Request): string {
  return new URL(request.url).pathname;
}

function evictExpiredBuckets(timestamp: number) {
  for (const [key, bucket] of buckets) {
    if (timestamp - bucket.startedAt >= WINDOW_MS) buckets.delete(key);
  }

  while (buckets.size >= MAX_RATE_BUCKETS) {
    const oldest = [...buckets.entries()].sort(
      (left, right) => left[1].startedAt - right[1].startedAt,
    )[0];
    if (!oldest) break;
    buckets.delete(oldest[0]);
  }
}

export function guardAiAuthorizationFailure(
  now: () => number = Date.now,
): AiRequestRejection | null {
  const timestamp = now();
  if (
    !authorizationFailures ||
    timestamp - authorizationFailures.startedAt >= WINDOW_MS
  ) {
    authorizationFailures = { count: 0, startedAt: timestamp };
  }
  authorizationFailures.count += 1;

  if (authorizationFailures.count > AUTH_FAILURES_PER_WINDOW) {
    return {
      status: 429,
      code: "AUTH_RATE_LIMIT",
      message: "This server instance received too many invalid access tokens.",
      headers: { "Retry-After": "60" },
    };
  }

  return null;
}

export function guardAiRequest(
  request: Request,
  now: () => number = Date.now,
): AiRequestRejection | null {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin !== requestOrigin) {
    return {
      status: 403,
      code: "ORIGIN_REJECTED",
      message: "AI routes only accept same-origin browser requests.",
    };
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return {
      status: 403,
      code: "ORIGIN_REJECTED",
      message: "AI routes only accept same-origin browser requests.",
    };
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLocaleLowerCase("en-US").startsWith("application/json")) {
    return {
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "The request body must use application/json.",
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return {
      status: 413,
      code: "BODY_TOO_LARGE",
      message: "The request body exceeds the AI route limit.",
    };
  }

  const timestamp = now();
  evictExpiredBuckets(timestamp);
  const key = requestKey(request);
  const current = buckets.get(key);
  const bucket =
    current && timestamp - current.startedAt < WINDOW_MS
      ? current
      : { count: 0, startedAt: timestamp };
  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > REQUESTS_PER_WINDOW) {
    return {
      status: 429,
      code: "LOCAL_RATE_LIMIT",
      message: "This server instance received too many AI requests. Try again shortly.",
      headers: { "Retry-After": "60" },
    };
  }

  return null;
}

export async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) {
    throw new AiRequestBodyError(
      400,
      "INVALID_JSON",
      "The request body must be valid JSON.",
    );
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AiRequestBodyError(
          413,
          "BODY_TOO_LARGE",
          "The request body exceeds the AI route limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AiRequestBodyError(
      400,
      "INVALID_JSON",
      "The request body must be valid JSON.",
    );
  }
}

export function resetAiRequestGuardForTests() {
  buckets.clear();
  authorizationFailures = null;
}
