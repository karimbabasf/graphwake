import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { MutationProposal } from "@/lib/domain/types";
import { featureHashVector } from "@/lib/insights/vectors";
import { GraphwakeDatabase } from "@/lib/persistence/database";
import { ProjectRepository } from "@/lib/persistence/projects";
import { createRunController } from "@/lib/runtime/controller";
import { NOW } from "@/test/factories";

async function* proposals(): AsyncGenerator<MutationProposal> {
  let index = 0;
  while (true) {
    index += 1;
    yield {
      type: "add-node",
      ref: `node-${index}`,
      label: `Node ${index}`,
      summary: `Generated node ${index}.`,
      kind: "concept",
      epistemicStatus: "inferred",
      confidence: 0.5,
      evidence: [],
      reason: "Deterministic controller fixture.",
    };
  }
}

describe("RunController", () => {
  let database: GraphwakeDatabase;
  let repository: ProjectRepository;

  beforeEach(() => {
    database = new GraphwakeDatabase(`graphwake-runtime-${crypto.randomUUID()}`);
    repository = new ProjectRepository(database, { now: () => NOW });
  });

  afterEach(async () => {
    await database.delete();
  });

  it("does not commit a mutation after stop", async () => {
    const project = await repository.createProject({
      name: "Stop test",
      purpose: "Prove that stop is a hard boundary.",
      seedPrompt: "Generate nodes until stopped.",
      engine: "local",
    });
    let nodeEvents = 0;
    let nextId = 0;
    const controller = createRunController({
      repository,
      now: () => NOW,
      createId: () => `runtime-${(nextId += 1)}`,
      vectorize: (text, occurredAt) => featureHashVector(text, 48, occurredAt),
      localSource: () => proposals(),
      onEvent(event) {
        if (event.type !== "node.added") return;
        nodeEvents += 1;
        if (nodeEvents === 2) controller.stop();
      },
    });

    await controller.start(project.id);
    const loaded = await repository.loadProject(project.id);
    const committedNodes = loaded?.events.filter(
      (event) => event.type === "node.added",
    );

    expect(committedNodes).toHaveLength(2);
    expect(controller.status).toBe("stopped");
    expect(loaded?.project.status).toBe("stopped");
  });

  it("releases the active lock when the start event cannot be stored", async () => {
    const project = await repository.createProject({
      name: "Start failure",
      purpose: "Verify the runner lock is released after a storage failure.",
      seedPrompt: "Attempt to start once.",
      engine: "local",
    });
    const controller = createRunController({
      repository: {
        loadProject: (projectId) => repository.loadProject(projectId),
        appendProjectEvent: async () => {
          throw new Error("Storage unavailable");
        },
      },
      now: () => NOW,
    });

    await expect(controller.start(project.id)).rejects.toThrow(
      "Storage unavailable",
    );
    expect(controller.isActive).toBe(false);
  });
});
