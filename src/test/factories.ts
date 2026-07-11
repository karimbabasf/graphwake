import type {
  GraphEdge,
  GraphNode,
  ProjectRecord,
  VectorRecord,
} from "@/lib/domain/types";

const NOW = "2026-07-11T16:00:00.000Z";

export function makeVector(
  overrides: Partial<VectorRecord> = {},
): VectorRecord {
  return {
    method: "feature-hash-v1",
    dimensions: 2,
    values: [1, 0],
    normalized: true,
    createdAt: NOW,
    ...overrides,
  };
}

export function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node-1",
    label: "Event sourcing",
    summary: "State is reconstructed from ordered events.",
    kind: "concept",
    epistemicStatus: "asserted",
    confidence: 0.8,
    evidence: [],
    vector: makeVector(),
    createdByEventId: "event-2",
    updatedByEventId: "event-2",
    ...overrides,
  };
}

export function makeEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: "edge-1",
    source: "node-1",
    target: "node-2",
    relation: "supports",
    confidence: 0.7,
    evidence: [],
    rationale: "The source adds evidence for the target.",
    createdByEventId: "event-4",
    ...overrides,
  };
}

export function makeProject(
  overrides: Partial<ProjectRecord> = {},
): ProjectRecord {
  return {
    id: "project-1",
    name: "Graph test",
    purpose: "Verify replay behavior.",
    seedPrompt: "Trace how a graph changes.",
    status: "draft",
    engine: "local",
    createdAt: NOW,
    updatedAt: NOW,
    lastOpenedAt: NOW,
    lastSequence: 1,
    nodeCount: 0,
    edgeCount: 0,
    eventCount: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

export { NOW };
