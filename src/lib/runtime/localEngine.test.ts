import { describe, expect, it } from "vitest";

import {
  generateLocalProposals,
  type LocalEngineInput,
} from "@/lib/runtime/localEngine";
import type { MutationProposal } from "@/lib/domain/types";

async function take(
  source: AsyncIterable<MutationProposal>,
  count: number,
): Promise<MutationProposal[]> {
  const values: MutationProposal[] = [];
  for await (const value of source) {
    values.push(value);
    if (values.length === count) break;
  }
  return values;
}

const seed: LocalEngineInput = {
  prompt: "Map how memory evidence changes an agent decision",
  purpose: "Teach replayable context graphs",
  batch: 0,
  existingNodes: [],
  existingEdges: [],
  delayMs: 0,
};

describe("generateLocalProposals", () => {
  it("generates the same opening proposals for the same prompt", async () => {
    const first = await take(generateLocalProposals(seed), 8);
    const second = await take(generateLocalProposals(seed), 8);

    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      type: "add-node",
      ref: "seed-prompt",
      kind: "source",
    });
  });

  it("never fabricates evidence references", async () => {
    const proposals = await take(generateLocalProposals(seed), 20);
    expect(proposals.every((proposal) => proposal.evidence.length === 0)).toBe(
      true,
    );
  });
});
