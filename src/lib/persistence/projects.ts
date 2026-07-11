import { appendEvent, type AppendEventInput } from "@/lib/domain/events";
import { projectSchema } from "@/lib/domain/schemas";
import { replayEvents, verifyLedger } from "@/lib/domain/replay";
import type {
  EngineKind,
  GraphEvent,
  GraphSnapshot,
  LayoutPosition,
  ProjectRecord,
  ProjectStatus,
} from "@/lib/domain/types";
import {
  GraphwakeDatabase,
  graphwakeDatabase,
} from "@/lib/persistence/database";

export interface CreateProjectInput {
  name: string;
  purpose: string;
  seedPrompt: string;
  engine: EngineKind;
}

export interface LoadedProject {
  project: ProjectRecord;
  events: GraphEvent[];
  layouts: LayoutPosition[];
  snapshot: GraphSnapshot;
}

interface RepositoryOptions {
  createId?: () => string;
  now?: () => string;
}

interface LoadProjectOptions {
  verify?: boolean;
}

type ProjectEventInput<TPayload = unknown> = Omit<
  AppendEventInput<TPayload>,
  "projectId"
>;

type RecoveryLock = (
  projectId: string,
  recover: () => Promise<boolean>,
) => Promise<boolean>;

function statusForEvent(
  type: GraphEvent["type"],
  current: ProjectStatus,
): ProjectStatus {
  switch (type) {
    case "run.started":
      return "running";
    case "run.stopped":
      return "stopped";
    case "run.interrupted":
      return "interrupted";
    case "run.failed":
      return "failed";
    default:
      return current;
  }
}

function renamedProject(event: GraphEvent): string | undefined {
  if (event.type !== "project.renamed") return undefined;
  if (event.payload === null || typeof event.payload !== "object") return undefined;
  const name = (event.payload as Record<string, unknown>).name;
  return typeof name === "string" ? name : undefined;
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (
    typeof navigator === "undefined" ||
    navigator.storage?.persist === undefined
  ) {
    return null;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export class ProjectRepository {
  readonly database: GraphwakeDatabase;
  private readonly createId: () => string;
  private readonly now: () => string;

  constructor(
    database: GraphwakeDatabase,
    options: RepositoryOptions = {},
  ) {
    this.database = database;
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const projectId = this.createId();
    const eventId = this.createId();
    const occurredAt = this.now();
    const event = await appendEvent([], {
      id: eventId,
      projectId,
      type: "project.created",
      actor: "user",
      occurredAt,
      reason: "Create the graph project.",
      evidence: [],
      payload: {
        name: input.name.trim(),
        purpose: input.purpose.trim(),
        seedPrompt: input.seedPrompt.trim(),
        engine: input.engine,
      },
    });

    const project = projectSchema.parse({
      id: projectId,
      name: input.name,
      purpose: input.purpose,
      seedPrompt: input.seedPrompt,
      status: "draft",
      engine: input.engine,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      lastOpenedAt: occurredAt,
      lastSequence: event.sequence,
      nodeCount: 0,
      edgeCount: 0,
      eventCount: 1,
      schemaVersion: 1,
    });

    await this.database.transaction(
      "rw",
      this.database.projects,
      this.database.events,
      async () => {
        await this.database.projects.add(project);
        await this.database.events.add(event);
      },
    );

    return project;
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return this.database.projects.orderBy("updatedAt").reverse().toArray();
  }

  async loadProject(
    projectId: string,
    options: LoadProjectOptions = {},
  ): Promise<LoadedProject | null> {
    const [project, events, layouts] = await this.database.transaction(
      "r",
      this.database.projects,
      this.database.events,
      this.database.layouts,
      () =>
        Promise.all([
          this.database.projects.get(projectId),
          this.database.events
            .where("projectId")
            .equals(projectId)
            .sortBy("sequence"),
          this.database.layouts.where("projectId").equals(projectId).toArray(),
        ]),
    );
    if (!project) return null;

    if (options.verify !== false) {
      const verification = await verifyLedger(events);
      if (!verification.valid) {
        throw new Error(
          `Ledger verification failed: ${verification.errors.join("; ")}`,
        );
      }
    }

    const snapshot = replayEvents(events);
    if (options.verify !== false) {
      const nodeCount = events.filter((event) => event.type === "node.added").length;
      const edgeCount = events.filter((event) => event.type === "edge.added").length;
      const indexedStateMatches =
        project.eventCount === events.length &&
        project.lastSequence === (events.at(-1)?.sequence ?? 0) &&
        project.nodeCount === nodeCount &&
        project.edgeCount === edgeCount &&
        project.status === snapshot.status &&
        project.name === snapshot.name;
      if (!indexedStateMatches) {
        throw new Error("Project index verification failed");
      }
    }

    return {
      project,
      events,
      layouts,
      snapshot,
    };
  }

  async appendProjectEvent<TPayload>(
    projectId: string,
    input: ProjectEventInput<TPayload>,
  ): Promise<GraphEvent<TPayload>> {
    const loaded = await this.loadProject(projectId, { verify: false });
    if (!loaded) throw new Error(`Project ${projectId} was not found`);

    const event = await appendEvent(loaded.events, {
      ...input,
      projectId,
    });

    await this.database.transaction(
      "rw",
      this.database.projects,
      this.database.events,
      async () => {
        const current = await this.database.projects.get(projectId);
        if (!current) throw new Error(`Project ${projectId} was not found`);
        if (current.lastSequence !== loaded.project.lastSequence) {
          throw new Error(`Project ${projectId} changed during event creation`);
        }

        await this.database.events.add(event);
        await this.database.projects.put({
          ...current,
          name: renamedProject(event) ?? current.name,
          status: statusForEvent(event.type, current.status),
          updatedAt: event.occurredAt,
          lastSequence: event.sequence,
          eventCount: current.eventCount + 1,
          nodeCount:
            current.nodeCount + (event.type === "node.added" ? 1 : 0),
          edgeCount:
            current.edgeCount + (event.type === "edge.added" ? 1 : 0),
        });
      },
    );

    return event;
  }

  async renameProject(projectId: string, name: string): Promise<void> {
    const normalizedName = projectSchema.shape.name.parse(name);
    await this.appendProjectEvent(projectId, {
      type: "project.renamed",
      actor: "user",
      occurredAt: this.now(),
      reason: "Rename the graph project.",
      evidence: [],
      payload: { name: normalizedName },
    });
  }

  async touchProject(projectId: string): Promise<void> {
    const updated = await this.database.projects.update(projectId, {
      lastOpenedAt: this.now(),
    });
    if (updated === 0) throw new Error(`Project ${projectId} was not found`);
  }

  async interruptProjectIfRunning(projectId: string): Promise<boolean> {
    const loaded = await this.loadProject(projectId, { verify: false });
    if (!loaded || loaded.project.status !== "running") return false;

    const event = await appendEvent(loaded.events, {
      id: this.createId(),
      projectId,
      type: "run.interrupted",
      actor: "system",
      occurredAt: this.now(),
      reason: "The browser closed while this project was running.",
      evidence: [],
      payload: {},
    });
    let interrupted = false;

    await this.database.transaction(
      "rw",
      this.database.projects,
      this.database.events,
      async () => {
        const current = await this.database.projects.get(projectId);
        if (
          !current ||
          current.status !== "running" ||
          current.lastSequence !== loaded.project.lastSequence
        ) {
          return;
        }

        await this.database.events.add(event);
        await this.database.projects.put({
          ...current,
          status: "interrupted",
          updatedAt: event.occurredAt,
          lastSequence: event.sequence,
          eventCount: current.eventCount + 1,
        });
        interrupted = true;
      },
    );

    return interrupted;
  }

  async saveLayout(
    projectId: string,
    positions: Array<Pick<LayoutPosition, "nodeId" | "x" | "y">>,
  ): Promise<void> {
    const project = await this.database.projects.get(projectId);
    if (!project) throw new Error(`Project ${projectId} was not found`);
    const updatedAt = this.now();
    await this.database.layouts.bulkPut(
      positions.map((position) => ({ projectId, updatedAt, ...position })),
    );
  }

  async recoverInterruptedProjects(
    withRecoveryLock: RecoveryLock = async (_projectId, recover) => recover(),
  ): Promise<number> {
    const running = await this.database.projects
      .where("status")
      .equals("running")
      .toArray();

    let recovered = 0;
    for (const project of running) {
      if (
        await withRecoveryLock(project.id, () =>
          this.interruptProjectIfRunning(project.id),
        )
      ) {
        recovered += 1;
      }
    }
    return recovered;
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.projects,
      this.database.events,
      this.database.layouts,
      async () => {
        await this.database.projects.delete(projectId);
        await this.database.events.where("projectId").equals(projectId).delete();
        await this.database.layouts.where("projectId").equals(projectId).delete();
      },
    );
  }
}

export const projectRepository = new ProjectRepository(graphwakeDatabase);
