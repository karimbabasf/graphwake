import { graphEdgeSchema, graphNodeSchema } from "@/lib/domain/schemas";
import type {
  GraphEvent,
  GraphNode,
  GraphSnapshot,
  ProjectStatus,
} from "@/lib/domain/types";

export const EMPTY_STATE_HASH = "0".repeat(64);

export function emptySnapshot(): GraphSnapshot {
  return {
    sequence: 0,
    nodes: [],
    edges: [],
    stateHash: EMPTY_STATE_HASH,
    status: "draft",
  };
}

function readObject(payload: unknown, eventType: string): Record<string, unknown> {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError(`${eventType} payload must be an object`);
  }
  return payload as Record<string, unknown>;
}

function readName(payload: unknown, eventType: string): string {
  const name = readObject(payload, eventType).name;
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new TypeError(`${eventType} payload requires a name`);
  }
  return name.trim();
}

function withStatus(
  snapshot: GraphSnapshot,
  event: GraphEvent,
  status: ProjectStatus,
): GraphSnapshot {
  return {
    ...snapshot,
    sequence: event.sequence,
    stateHash: event.resultingStateHash,
    status,
  };
}

function updateNode(snapshot: GraphSnapshot, event: GraphEvent): GraphNode[] {
  const payload = readObject(event.payload, event.type);
  const nodeId = payload.nodeId;
  const patch = payload.patch;

  if (typeof nodeId !== "string") {
    throw new TypeError("node.updated payload requires nodeId");
  }
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("node.updated payload requires an object patch");
  }

  let found = false;
  const nodes = snapshot.nodes.map((node) => {
    if (node.id !== nodeId) return node;
    found = true;
    return graphNodeSchema.parse({
      ...node,
      ...(patch as Partial<GraphNode>),
      id: node.id,
      createdByEventId: node.createdByEventId,
      updatedByEventId: event.id,
    });
  });

  if (!found) {
    throw new Error(`Cannot update missing node ${nodeId}`);
  }
  return nodes;
}

export function reduceEvent(
  snapshot: GraphSnapshot,
  event: GraphEvent,
): GraphSnapshot {
  if (event.reducerVersion !== 1) {
    throw new Error(`Unsupported reducer version ${event.reducerVersion}`);
  }

  switch (event.type) {
    case "project.created":
      return {
        ...withStatus(snapshot, event, "draft"),
        name: readName(event.payload, event.type),
      };

    case "project.renamed":
      return {
        ...snapshot,
        name: readName(event.payload, event.type),
        sequence: event.sequence,
        stateHash: event.resultingStateHash,
      };

    case "run.started":
      return withStatus(snapshot, event, "running");

    case "run.stopped":
      return withStatus(snapshot, event, "stopped");

    case "run.interrupted":
      return withStatus(snapshot, event, "interrupted");

    case "run.failed":
      return withStatus(snapshot, event, "failed");

    case "node.added": {
      const node = graphNodeSchema.parse(
        readObject(event.payload, event.type).node,
      );
      if (snapshot.nodes.some((candidate) => candidate.id === node.id)) {
        throw new Error(`Node ${node.id} already exists`);
      }
      return {
        ...snapshot,
        sequence: event.sequence,
        stateHash: event.resultingStateHash,
        nodes: [...snapshot.nodes, node],
      };
    }

    case "node.updated":
      return {
        ...snapshot,
        sequence: event.sequence,
        stateHash: event.resultingStateHash,
        nodes: updateNode(snapshot, event),
      };

    case "edge.added": {
      const edge = graphEdgeSchema.parse(
        readObject(event.payload, event.type).edge,
      );
      if (snapshot.edges.some((candidate) => candidate.id === edge.id)) {
        throw new Error(`Edge ${edge.id} already exists`);
      }
      if (!snapshot.nodes.some((node) => node.id === edge.source)) {
        throw new Error(
          `Edge ${edge.id} references missing node ${edge.source}`,
        );
      }
      if (!snapshot.nodes.some((node) => node.id === edge.target)) {
        throw new Error(
          `Edge ${edge.id} references missing node ${edge.target}`,
        );
      }
      return {
        ...snapshot,
        sequence: event.sequence,
        stateHash: event.resultingStateHash,
        edges: [...snapshot.edges, edge],
      };
    }
  }
}
