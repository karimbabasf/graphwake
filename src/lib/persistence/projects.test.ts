import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GraphwakeDatabase } from "@/lib/persistence/database";
import { ProjectRepository } from "@/lib/persistence/projects";
import { makeNode, NOW } from "@/test/factories";

describe("ProjectRepository", () => {
  let database: GraphwakeDatabase;
  let repository: ProjectRepository;
  let id = 0;

  beforeEach(() => {
    database = new GraphwakeDatabase(`graphwake-test-${crypto.randomUUID()}`);
    repository = new ProjectRepository(database, {
      createId: () => `id-${(id += 1)}`,
      now: () => NOW,
    });
  });

  afterEach(async () => {
    await database.delete();
  });

  it("creates, persists, and reloads a project", async () => {
    const project = await repository.createProject({
      name: "Memory map",
      purpose: "Trace changing assertions.",
      seedPrompt: "Map how an agent updates a preference.",
      engine: "local",
    });

    const loaded = await repository.loadProject(project.id);

    expect(loaded?.project.name).toBe("Memory map");
    expect(loaded?.project.eventCount).toBe(1);
    expect(loaded?.events).toHaveLength(1);
    expect(loaded?.snapshot.name).toBe("Memory map");
  });

  it("appends an event and updates query counts atomically", async () => {
    const project = await repository.createProject({
      name: "Count map",
      purpose: "Keep query metadata current.",
      seedPrompt: "Add a node.",
      engine: "local",
    });

    await repository.appendProjectEvent(project.id, {
      id: "node-event",
      type: "node.added",
      actor: "user",
      occurredAt: NOW,
      reason: "Add the first node.",
      evidence: [],
      payload: {
        node: makeNode({
          id: "node-count",
          createdByEventId: "node-event",
          updatedByEventId: "node-event",
        }),
      },
    });

    const loaded = await repository.loadProject(project.id);
    expect(loaded?.project.nodeCount).toBe(1);
    expect(loaded?.project.eventCount).toBe(2);
    expect(loaded?.events).toHaveLength(2);
  });

  it("normalizes a renamed project before writing the event and index", async () => {
    const project = await repository.createProject({
      name: "Original name",
      purpose: "Keep metadata and replay aligned.",
      seedPrompt: "Rename this project.",
      engine: "local",
    });

    await repository.renameProject(project.id, "  New name  ");

    const loaded = await repository.loadProject(project.id);
    expect(loaded?.project.name).toBe("New name");
    expect(loaded?.snapshot.name).toBe("New name");
  });

  it("recovers a stored running project as interrupted", async () => {
    const project = await repository.createProject({
      name: "Interrupted map",
      purpose: "Recover honest status.",
      seedPrompt: "Start and close.",
      engine: "local",
    });
    await repository.appendProjectEvent(project.id, {
      type: "run.started",
      actor: "user",
      occurredAt: NOW,
      reason: "Start the run.",
      evidence: [],
      payload: {},
    });

    expect(await repository.recoverInterruptedProjects()).toBe(1);
    expect((await repository.loadProject(project.id))?.project.status).toBe(
      "interrupted",
    );
  });

  it("does not interrupt a run whose browser lock is still active", async () => {
    const project = await repository.createProject({
      name: "Active tab map",
      purpose: "Leave another tab's live run untouched.",
      seedPrompt: "Keep running elsewhere.",
      engine: "local",
    });
    await repository.appendProjectEvent(project.id, {
      type: "run.started",
      actor: "user",
      occurredAt: NOW,
      reason: "Start the run in another tab.",
      evidence: [],
      payload: {},
    });

    expect(
      await repository.recoverInterruptedProjects(async () => false),
    ).toBe(0);
    expect((await repository.loadProject(project.id))?.project.status).toBe(
      "running",
    );
  });

  it("does not append an interruption after a run stops before recovery", async () => {
    const project = await repository.createProject({
      name: "Recovery race",
      purpose: "Keep lifecycle events ordered.",
      seedPrompt: "Stop before abandoned-run recovery acquires the lock.",
      engine: "local",
    });
    await repository.appendProjectEvent(project.id, {
      type: "run.started",
      actor: "user",
      occurredAt: NOW,
      reason: "Start the run.",
      evidence: [],
      payload: {},
    });

    const recovered = await repository.recoverInterruptedProjects(
      async (projectId, recover) => {
        await repository.appendProjectEvent(projectId, {
          type: "run.stopped",
          actor: "system",
          occurredAt: NOW,
          reason: "Stop before recovery.",
          evidence: [],
          payload: {},
        });
        return recover();
      },
    );

    const loaded = await repository.loadProject(project.id);
    expect(recovered).toBe(0);
    expect(loaded?.project.status).toBe("stopped");
    expect(
      loaded?.events.some((candidate) => candidate.type === "run.interrupted"),
    ).toBe(false);
  });

  it("deletes metadata, events, and layouts atomically", async () => {
    const project = await repository.createProject({
      name: "Delete map",
      purpose: "Verify local deletion.",
      seedPrompt: "Remove all records.",
      engine: "local",
    });
    await repository.saveLayout(project.id, [
      { nodeId: "node-1", x: 10, y: 20 },
    ]);

    await repository.deleteProject(project.id);

    expect(await repository.loadProject(project.id)).toBeNull();
    expect(await database.events.where("projectId").equals(project.id).count()).toBe(
      0,
    );
    expect(
      await database.layouts.where("projectId").equals(project.id).count(),
    ).toBe(0);
  });

  it("refuses to load a ledger whose stored event no longer matches its hash", async () => {
    const project = await repository.createProject({
      name: "Integrity map",
      purpose: "Reject a corrupted local record.",
      seedPrompt: "Verify before rendering.",
      engine: "local",
    });
    const event = await database.events.where("projectId").equals(project.id).first();
    if (!event) throw new Error("Fixture event was not stored");
    await database.events.update(event.id, { reason: "Changed outside the ledger" });

    await expect(repository.loadProject(project.id)).rejects.toThrow(
      "Ledger verification failed",
    );
  });
});
