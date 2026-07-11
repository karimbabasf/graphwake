import { beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({
  hasGatewayCredentials: vi.fn(),
  streamMutationElements: vi.fn(),
}));

vi.mock("@/lib/ai/adapter", () => adapter);

import { POST } from "@/app/api/generate/route";

const validBody = {
  projectId: "project-1",
  purpose: "Map changing decisions.",
  prompt: "Show why a launch plan changed.",
  batch: 0,
  nodes: [],
  edges: [],
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    adapter.hasGatewayCredentials.mockReset();
    adapter.streamMutationElements.mockReset();
  });

  it("returns 503 without Gateway authentication", async () => {
    adapter.hasGatewayCredentials.mockReturnValue(false);

    const response = await POST(request(validBody));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "GATEWAY_UNAVAILABLE" });
  });

  it("rejects oversized input before model work", async () => {
    adapter.hasGatewayCredentials.mockReturnValue(true);

    const response = await POST(
      request({ ...validBody, prompt: "x".repeat(1_201) }),
    );

    expect(response.status).toBe(400);
    expect(adapter.streamMutationElements).not.toHaveBeenCalled();
  });

  it("streams one validated proposal per NDJSON line", async () => {
    adapter.hasGatewayCredentials.mockReturnValue(true);
    adapter.streamMutationElements.mockReturnValue(
      (async function* () {
        yield {
          type: "add-node",
          ref: "launch",
          label: "Launch plan",
          summary: "The current plan for releasing the product.",
          kind: "decision",
          epistemicStatus: "asserted",
          confidence: 0.8,
          evidence: [],
          reason: "The seed prompt names a launch plan.",
        };
      })(),
    );
    const incoming = request(validBody);

    const response = await POST(incoming);
    const lines = (await response.text()).trim().split("\n");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).type).toBe("add-node");
    expect(adapter.streamMutationElements).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project-1" }),
      incoming.signal,
    );
  });
});
