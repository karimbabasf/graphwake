import { describe, expect, it } from "vitest";

import {
  edgeVisual,
  nodeVisual,
  wakeColor,
} from "@/lib/visual/encodings";
import { NODE_KINDS, RELATION_KINDS } from "@/lib/domain/types";
import { makeEdge, makeNode } from "@/test/factories";

describe("visual encodings", () => {
  it("gives every node kind an explicit shape", () => {
    const shapes = NODE_KINDS.map(
      (kind) => nodeVisual(makeNode({ kind })).shape,
    );

    expect(shapes.every(Boolean)).toBe(true);
    expect(new Set(shapes).size).toBeGreaterThanOrEqual(5);
  });

  it("keeps default node size independent of graph degree", () => {
    const node = makeNode();
    expect(nodeVisual(node, { mode: "semantic", degree: 1 }).size).toBe(
      nodeVisual(node, { mode: "semantic", degree: 20 }).size,
    );
    expect(nodeVisual(node).size).toBe(10);
  });

  it("dual-encodes every relation with dash and color", () => {
    const visuals = RELATION_KINDS.map((relation) =>
      edgeVisual(makeEdge({ relation })),
    );

    expect(visuals.every((visual) => visual.color.length > 0)).toBe(true);
    expect(visuals.every((visual) => Array.isArray(visual.dash))).toBe(true);
  });

  it("keeps a causal hypothesis distinct from support", () => {
    const support = edgeVisual(makeEdge({ relation: "supports" }));
    const causal = edgeVisual(makeEdge({ relation: "causal-hypothesis" }));

    expect(causal.color).not.toBe(support.color);
    expect(causal.dash).not.toEqual(support.dash);
  });

  it("maps a committed edge event to a finite wake color", () => {
    expect(wakeColor("edge.added")).toBe("#2b50d6");
  });
});
