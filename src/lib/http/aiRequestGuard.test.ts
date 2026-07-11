import { beforeEach, describe, expect, it } from "vitest";

import {
  authorizeAiRequest,
  guardAiAuthorizationFailure,
  guardAiRequest,
  readBoundedJson,
  resetAiRequestGuardForTests,
} from "@/lib/http/aiRequestGuard";

function request(body = "{}", headers: Record<string, string> = {}) {
  return new Request("https://graphwake.example/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://graphwake.example",
      ...headers,
    },
    body,
  });
}

describe("guardAiRequest", () => {
  beforeEach(() => resetAiRequestGuardForTests());

  it("rejects a body above the route byte limit", () => {
    const rejection = guardAiRequest(
      request("{}", { "Content-Length": "1000000" }),
    );
    expect(rejection?.status).toBe(413);
  });

  it("limits repeated model calls from one forwarded address", () => {
    let rejection = null;
    for (let index = 0; index < 41; index += 1) {
      rejection = guardAiRequest(
        request("{}", { "X-Forwarded-For": "203.0.113.7" }),
        () => 1_000,
      );
    }
    expect(rejection?.status).toBe(429);
  });

  it("does not let forwarded addresses create independent spend buckets", () => {
    let rejection = null;
    for (let index = 0; index < 41; index += 1) {
      rejection = guardAiRequest(
        request("{}", { "X-Forwarded-For": `203.0.113.${index}` }),
        () => 1_000,
      );
    }
    expect(rejection?.status).toBe(429);
  });

  it("bounds repeated authorization failures with one fixed bucket", () => {
    let rejection = null;
    for (let index = 0; index < 21; index += 1) {
      rejection = guardAiAuthorizationFailure(() => 1_000);
    }
    expect(rejection?.status).toBe(429);
    expect(rejection?.code).toBe("AUTH_RATE_LIMIT");
  });

  it("stops reading an undeclared oversized body", async () => {
    const incoming = request(JSON.stringify({ value: "x".repeat(140_000) }));
    incoming.headers.delete("Content-Length");

    await expect(readBoundedJson(incoming)).rejects.toMatchObject({
      status: 413,
      code: "BODY_TOO_LARGE",
    });
  });

  it("requires a server-validated token when one is configured", () => {
    const incoming = request();
    expect(
      authorizeAiRequest(incoming, {
        NODE_ENV: "production",
        GRAPHWAKE_API_TOKEN: "a-secure-deployment-token-value",
      })?.status,
    ).toBe(401);

    incoming.headers.set(
      "Authorization",
      "Bearer a-secure-deployment-token-value",
    );
    expect(
      authorizeAiRequest(incoming, {
        NODE_ENV: "production",
        GRAPHWAKE_API_TOKEN: "a-secure-deployment-token-value",
      }),
    ).toBeNull();
  });

  it("locks a non-loopback production route without an access token", () => {
    expect(
      authorizeAiRequest(request(), { NODE_ENV: "production" })?.status,
    ).toBe(503);
  });

  it("locks a loopback production route without an access token", () => {
    const incoming = new Request("http://127.0.0.1:3000/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3000",
      },
      body: "{}",
    });

    expect(
      authorizeAiRequest(incoming, { NODE_ENV: "production" })?.status,
    ).toBe(503);
  });
});
