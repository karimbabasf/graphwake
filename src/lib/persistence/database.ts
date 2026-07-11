import Dexie, { type Table } from "dexie";

import type {
  GraphEvent,
  LayoutPosition,
  ProjectRecord,
} from "@/lib/domain/types";

export class GraphwakeDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>;
  events!: Table<GraphEvent, string>;
  layouts!: Table<LayoutPosition, [string, string]>;

  constructor(name = "graphwake") {
    super(name);
    this.version(1).stores({
      projects: "id, updatedAt, lastOpenedAt, status",
      events: "id, [projectId+sequence], projectId, type, occurredAt",
      layouts: "[projectId+nodeId], projectId, nodeId, updatedAt",
    });
  }
}

export const graphwakeDatabase = new GraphwakeDatabase();
