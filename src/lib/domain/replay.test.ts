import { describe, expect, it } from "vitest";

import { appendEvent, resolveProposal } from "@/lib/domain/events";
import { replayEvents, verifyLedger } from "@/lib/domain/replay";
import type { GraphEvent } from "@/lib/domain/types";
import { makeEdge, makeNode, makeVector, NOW } from "@/test/factories";

async function signedLedger(): Promise<GraphEvent[]> {
  const events: GraphEvent[] = [];

  events.push(
    await appendEvent(events, {
      id: "event-1",
      projectId: "project-1",
      type: "project.created",
      actor: "user",
      occurredAt: NOW,
      reason: "Create the project.",
      evidence: [],
      payload: { name: "Graph test" },
    }),
  );

  events.push(
    await appendEvent(events, {
      id: "event-2",
      projectId: "project-1",
      type: "node.added",
      actor: "user",
      occurredAt: NOW,
      reason: "Add the first concept.",
      evidence: [],
      payload: { node: makeNode() },
    }),
  );

  events.push(
    await appendEvent(events, {
      id: "event-3",
      projectId: "project-1",
      type: "node.added",
      actor: "user",
      occurredAt: NOW,
      reason: "Add supporting evidence.",
      evidence: [],
      payload: {
        node: makeNode({
          id: "node-2",
          label: "Replay",
          createdByEventId: "event-3",
          updatedByEventId: "event-3",
        }),
      },
    }),
  );

  events.push(
    await appendEvent(events, {
      id: "event-4",
      projectId: "project-1",
      type: "edge.added",
      actor: "user",
      occurredAt: NOW,
      reason: "Link the concepts.",
      evidence: [],
      payload: { edge: makeEdge() },
    }),
  );

  return events;
}

describe("replayEvents", () => {
  it("reconstructs the exact state at a target sequence", async () => {
    const events = await signedLedger();
    const snapshot = replayEvents(events, 2);

    expect(snapshot.nodes.map((node) => node.id)).toEqual(["node-1"]);
    expect(snapshot.edges).toEqual([]);
    expect(snapshot.sequence).toBe(2);
  });

  it("rejects a sequence gap", async () => {
    const events = await signedLedger();
    const withGap = [events[0], { ...events[1], sequence: 3 }];

    expect(() => replayEvents(withGap)).toThrow(
      "Expected event sequence 2, received 3",
    );
  });

  it("rejects an edge whose target is missing", async () => {
    const events = await signedLedger();
    const edgeAtSequenceThree = { ...events[3], sequence: 3 };

    expect(() =>
      replayEvents([events[0], events[1], edgeAtSequenceThree]),
    ).toThrow("Edge edge-1 references missing node node-2");
  });
});

describe("verifyLedger", () => {
  it("accepts an unchanged signed ledger", async () => {
    const events = await signedLedger();
    const result = await verifyLedger(events);

    expect(result.valid).toBe(true);
    expect(result.checkedEvents).toBe(4);
    expect(result.errors).toEqual([]);
  });

  it("detects a changed payload", async () => {
    const events = await signedLedger();
    const changed = structuredClone(events);
    changed[1].reason = "Changed after signing.";

    const result = await verifyLedger(changed);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("event-2");
  });
});

describe("resolveProposal", () => {
  it("resolves an edge to a node proposed earlier in the batch", () => {
    const refs = new Map<string, string>();
    const knownNodeIds = new Set<string>(["existing-node"]);
    const ids = ["new-node", "new-edge"];
    const createId = () => ids.shift() ?? "unreachable";

    const node = resolveProposal(
      {
        type: "add-node",
        ref: "context",
        label: "Context graph",
        summary: "A task-scoped view of selected memory.",
        kind: "concept",
        epistemicStatus: "asserted",
        confidence: 0.8,
        evidence: [],
        reason: "Defines the project subject.",
      },
      {
        eventId: "event-node",
        occurredAt: NOW,
        refs,
        knownNodeIds,
        createId,
        vectorize: () => makeVector(),
      },
    );

    const edge = resolveProposal(
      {
        type: "add-edge",
        sourceRef: "batch:context",
        targetRef: "existing-node",
        relation: "supports",
        confidence: 0.7,
        evidence: [],
        reason: "Links the new concept to existing evidence.",
      },
      {
        eventId: "event-edge",
        occurredAt: NOW,
        refs,
        knownNodeIds,
        createId,
        vectorize: () => makeVector(),
      },
    );

    expect(node.type).toBe("node.added");
    expect(edge.type).toBe("edge.added");
    if (edge.type === "edge.added") {
      expect(edge.payload.edge.source).toBe("new-node");
      expect(edge.payload.edge.target).toBe("existing-node");
    }
  });
});
