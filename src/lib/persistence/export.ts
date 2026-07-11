import { canonicalize, sha256 } from "@/lib/domain/hash";
import { verifyLedger } from "@/lib/domain/replay";
import type { ProjectRepository } from "@/lib/persistence/projects";

export async function exportProject(
  repository: ProjectRepository,
  projectId: string,
): Promise<string> {
  const loaded = await repository.loadProject(projectId);
  if (!loaded) throw new Error(`Project ${projectId} was not found`);

  const verification = await verifyLedger(loaded.events);
  if (!verification.valid) {
    throw new Error(`Ledger verification failed: ${verification.errors.join("; ")}`);
  }

  const [projectHash, eventsHash, layoutsHash] = await Promise.all([
    sha256(canonicalize(loaded.project)),
    sha256(canonicalize(loaded.events)),
    sha256(canonicalize(loaded.layouts)),
  ]);

  return JSON.stringify(
    {
      format: "graphwake",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      project: loaded.project,
      events: loaded.events,
      layouts: loaded.layouts,
      manifest: {
        projectHash,
        eventsHash,
        layoutsHash,
        finalStateHash: verification.finalStateHash,
      },
    },
    null,
    2,
  );
}
