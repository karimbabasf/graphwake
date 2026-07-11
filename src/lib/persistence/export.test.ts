import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyLedger } from "@/lib/domain/replay";
import { GraphwakeDatabase } from "@/lib/persistence/database";
import { exportProject } from "@/lib/persistence/export";
import { ProjectRepository } from "@/lib/persistence/projects";
import { NOW } from "@/test/factories";

describe("exportProject", () => {
  let database: GraphwakeDatabase;
  let repository: ProjectRepository;

  beforeEach(() => {
    database = new GraphwakeDatabase(`graphwake-export-${crypto.randomUUID()}`);
    repository = new ProjectRepository(database, {
      createId: () => crypto.randomUUID(),
      now: () => NOW,
    });
  });

  afterEach(async () => {
    await database.delete();
  });

  it("exports a versioned, verified ledger with checksums", async () => {
    const project = await repository.createProject({
      name: "Export map",
      purpose: "Inspect the full local record.",
      seedPrompt: "Export a valid ledger.",
      engine: "local",
    });

    const json = await exportProject(repository, project.id);
    const exported = JSON.parse(json);

    expect(exported.format).toBe("graphwake");
    expect(exported.schemaVersion).toBe(1);
    expect(exported.manifest.projectHash).toMatch(/^[a-f0-9]{64}$/);
    expect(exported.manifest.eventsHash).toMatch(/^[a-f0-9]{64}$/);
    expect((await verifyLedger(exported.events)).valid).toBe(true);
  });

  it("rejects an unknown project", async () => {
    await expect(exportProject(repository, "missing")).rejects.toThrow(
      "Project missing was not found",
    );
  });
});
