import { describe, expect, it } from "vitest";

import { projectSnapshot } from "@/lib/visual/projection";
import type { GraphSnapshot, LayoutPosition } from "@/lib/domain/types";
import { makeEdge, makeNode, NOW } from "@/test/factories";

function snapshot(): GraphSnapshot {
  return {
    sequence: 4,
    status: "stopped",
    stateHash: "f".repeat(64),
    nodes: [
      makeNode({ id: "source", label: "Source" }),
      makeNode({ id: "claim", label: "Claim", kind: "assertion" }),
    ],
    edges: [
      makeEdge({
        id: "support",
        source: "source",
        target: "claim",
        relation: "supports",
      }),
    ],
  };
}

describe("projectSnapshot", () => {
  it("projects stable IDs, semantics, and persisted coordinates", () => {
    const layouts: LayoutPosition[] = [
      { projectId: "project-1", nodeId: "source", x: 4, y: 8, updatedAt: NOW },
    ];
    const graph = projectSnapshot(snapshot(), layouts);

    expect(graph.nodes()).toEqual(["source", "claim"]);
    expect(graph.edges()).toEqual(["support"]);
    expect(graph.getNodeAttribute("source", "x")).toBe(4);
    expect(graph.getNodeAttribute("source", "y")).toBe(8);
    expect(graph.getNodeAttribute("claim", "shape")).toBe("diamond");
    expect(graph.getEdgeAttribute("support", "relation")).toBe("supports");
  });

  it("uses deterministic coordinates when layout data is absent", () => {
    const first = projectSnapshot(snapshot(), []);
    const second = projectSnapshot(snapshot(), []);

    expect(first.getNodeAttribute("claim", "x")).toBe(
      second.getNodeAttribute("claim", "x"),
    );
    expect(first.getNodeAttribute("claim", "y")).toBe(
      second.getNodeAttribute("claim", "y"),
    );
  });

  it("projects distinct relations between the same two objects", () => {
    const input = snapshot();
    input.edges.push(
      makeEdge({
        id: "cause",
        source: "source",
        target: "claim",
        relation: "refutes",
      }),
    );

    const graph = projectSnapshot(input, []);

    expect(graph.edges("source", "claim").sort()).toEqual(["cause", "support"]);
    expect([
      graph.getEdgeAttribute("cause", "lane"),
      graph.getEdgeAttribute("support", "lane"),
    ].sort()).toEqual([-0.5, 0.5]);
  });
});
