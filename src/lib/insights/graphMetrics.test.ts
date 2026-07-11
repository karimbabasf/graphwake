import { describe, expect, it } from "vitest";

import {
  betweennessCentrality,
  connectedComponents,
  degreeCentrality,
  shortestPath,
} from "@/lib/insights/graphMetrics";
import type { GraphSnapshot } from "@/lib/domain/types";
import { makeEdge, makeNode } from "@/test/factories";

function pathSnapshot(): GraphSnapshot {
  return {
    sequence: 7,
    status: "stopped",
    stateHash: "a".repeat(64),
    nodes: ["a", "b", "c", "d"].map((id) =>
      makeNode({ id, label: id.toUpperCase() }),
    ),
    edges: [
      makeEdge({ id: "ab", source: "a", target: "b" }),
      makeEdge({ id: "bc", source: "b", target: "c" }),
      makeEdge({ id: "cd", source: "c", target: "d" }),
    ],
  };
}

describe("graph metrics", () => {
  it("finds deterministic connected components", () => {
    const snapshot = pathSnapshot();
    snapshot.nodes.push(makeNode({ id: "island", label: "Island" }));

    expect(connectedComponents(snapshot)).toEqual([
      ["a", "b", "c", "d"],
      ["island"],
    ]);
  });

  it("returns the shortest node and edge path", () => {
    const result = shortestPath(pathSnapshot(), "a", "d");

    expect(result.nodeIds).toEqual(["a", "b", "c", "d"]);
    expect(result.edgeIds).toEqual(["ab", "bc", "cd"]);
  });

  it("computes normalized degree centrality", () => {
    expect(degreeCentrality(pathSnapshot(), "b").value).toBeCloseTo(2 / 3);
  });

  it("ranks the path bridge nodes above its endpoints", () => {
    const scores = betweennessCentrality(pathSnapshot());
    const b = scores.get("b")?.value;
    const c = scores.get("c")?.value;
    const a = scores.get("a")?.value;

    expect(typeof b).toBe("number");
    expect(typeof c).toBe("number");
    expect(b as number).toBeGreaterThan(a as number);
    expect(c as number).toBeGreaterThan(a as number);
  });
});
