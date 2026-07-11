import { beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({
  embedNodeTexts: vi.fn(),
  hasGatewayCredentials: vi.fn(),
}));

vi.mock("@/lib/ai/adapter", () => adapter);

import { POST } from "@/app/api/embed/route";

function request(values: string[]): Request {
  return new Request("http://localhost/api/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
    },
    body: JSON.stringify({ values }),
  });
}

describe("POST /api/embed", () => {
  beforeEach(() => {
    adapter.embedNodeTexts.mockReset();
    adapter.hasGatewayCredentials.mockReset();
  });

  it("returns 503 without Gateway authentication", async () => {
    adapter.hasGatewayCredentials.mockReturnValue(false);
    const response = await POST(request(["context graph"]));
    expect(response.status).toBe(503);
  });

  it("rejects a cross-origin caller before embedding work", async () => {
    adapter.hasGatewayCredentials.mockReturnValue(true);
    const incoming = request(["context graph"]);
    incoming.headers.set("Origin", "https://attacker.example");

    const response = await POST(incoming);

    expect(response.status).toBe(403);
    expect(adapter.embedNodeTexts).not.toHaveBeenCalled();
  });

  it("returns the exact model, dimensions, vectors, and usage", async () => {
    adapter.hasGatewayCredentials.mockReturnValue(true);
    adapter.embedNodeTexts.mockResolvedValue({
      model: "openai/text-embedding-3-small",
      dimensions: 3,
      vectors: [[0.1, 0.2, 0.3]],
      usage: { tokens: 2 },
    });
    const incoming = request(["context graph"]);

    const response = await POST(incoming);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      model: "openai/text-embedding-3-small",
      dimensions: 3,
      vectors: [[0.1, 0.2, 0.3]],
      usage: { tokens: 2 },
    });
    expect(adapter.embedNodeTexts).toHaveBeenCalledWith(
      ["context graph"],
      incoming.signal,
    );
  });
});
