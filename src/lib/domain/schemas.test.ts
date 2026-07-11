import { describe, expect, it } from "vitest";

import {
  evidenceRefSchema,
  generationRequestSchema,
  mutationProposalSchema,
} from "@/lib/domain/schemas";

describe("mutationProposalSchema", () => {
  it("accepts a bounded node proposal", () => {
    const proposal = mutationProposalSchema.parse({
      type: "add-node",
      ref: "seed",
      label: "Event sourcing",
      summary: "State is reconstructed from an ordered event ledger.",
      kind: "concept",
      epistemicStatus: "asserted",
      confidence: 0.8,
      evidence: [],
      reason: "The project asks how state changes can be inspected.",
    });

    expect(proposal.type).toBe("add-node");
  });

  it("rejects an unknown relation", () => {
    expect(() =>
      mutationProposalSchema.parse({
        type: "add-edge",
        sourceRef: "a",
        targetRef: "b",
        relation: "magically-causes",
        confidence: 0.7,
        evidence: [],
        reason: "Invalid relation.",
      }),
    ).toThrow();
  });

  it("rejects confidence outside the unit interval", () => {
    expect(() =>
      mutationProposalSchema.parse({
        type: "add-node",
        ref: "bad-confidence",
        label: "Invalid score",
        summary: "Confidence must remain between zero and one.",
        kind: "assertion",
        epistemicStatus: "asserted",
        confidence: 1.2,
        evidence: [],
        reason: "Tests the contract.",
      }),
    ).toThrow();
  });
});

describe("evidenceRefSchema", () => {
  it("rejects an executable URL scheme", () => {
    expect(() =>
      evidenceRefSchema.parse({
        id: "evidence-1",
        label: "Unsafe source",
        uri: "javascript:alert(1)",
      }),
    ).toThrow();
  });
});

describe("generationRequestSchema", () => {
  it("rejects prompts beyond the run budget", () => {
    expect(() =>
      generationRequestSchema.parse({
        projectId: "project-1",
        purpose: "Map a changing body of knowledge.",
        prompt: "x".repeat(1_201),
        batch: 0,
        nodes: [],
        edges: [],
      }),
    ).toThrow();
  });
});
