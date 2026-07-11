import { describe, expect, it } from "vitest";

import {
  GatewayStreamError,
  parseNdjson,
} from "@/lib/runtime/gatewayClient";

const encoder = new TextEncoder();

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const values = [];
  for await (const value of parseNdjson(stream)) values.push(value);
  return values;
}

describe("parseNdjson", () => {
  it("parses complete proposals split across arbitrary chunks", async () => {
    const first = JSON.stringify({
      type: "add-node",
      ref: "memory",
      label: "Memory",
      summary: "A durable record of prior observations.",
      kind: "concept",
      epistemicStatus: "asserted",
      confidence: 0.8,
      evidence: [],
      reason: "The prompt names memory.",
    });
    const second = JSON.stringify({
      type: "add-edge",
      sourceRef: "batch:memory",
      targetRef: "existing-node",
      relation: "supports",
      confidence: 0.7,
      evidence: [],
      reason: "Memory supports the existing assertion.",
    });

    const values = await collect(
      streamOf([first.slice(0, 18), first.slice(18), `\n${second}\n`]),
    );

    expect(values).toHaveLength(2);
    expect(values[0].type).toBe("add-node");
    expect(values[1].type).toBe("add-edge");
  });

  it("raises a typed terminal stream error", async () => {
    const stream = streamOf([
      `${JSON.stringify({
        type: "error",
        code: "MODEL_FAILED",
        message: "The provider stopped the batch.",
      })}\n`,
    ]);

    await expect(collect(stream)).rejects.toEqual(
      new GatewayStreamError("MODEL_FAILED", "The provider stopped the batch."),
    );
  });
});
