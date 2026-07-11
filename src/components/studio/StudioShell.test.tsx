import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StudioShell } from "@/components/studio/StudioShell";
import type { GraphEvent } from "@/lib/domain/types";
import type { LoadedProject, ProjectRepository } from "@/lib/persistence/projects";
import { makeNode, makeProject, NOW } from "@/test/factories";

vi.mock("@/components/graph/GraphCanvas", () => ({
  GraphCanvas: ({ onSelectNode }: { onSelectNode: (id: string) => void }) => (
    <button type="button" onClick={() => onSelectNode("node-1")}>
      Select event sourcing
    </button>
  ),
}));

function event(overrides: Partial<GraphEvent>): GraphEvent {
  return {
    id: "event-1",
    projectId: "project-1",
    sequence: 1,
    type: "project.created",
    actor: "user",
    occurredAt: NOW,
    reason: "Create the graph project.",
    evidence: [],
    payload: { name: "Graph test" },
    reducerVersion: 1,
    previousEventHash: null,
    eventHash: "a".repeat(64),
    resultingStateHash: "b".repeat(64),
    ...overrides,
  };
}

function loadedProject(): LoadedProject {
  const node = makeNode();
  const events = [
    event({}),
    event({
      id: "event-2",
      sequence: 2,
      type: "node.added",
      actor: "local-engine",
      previousEventHash: "a".repeat(64),
      payload: { node },
      reason: "Add the core event sourcing concept.",
    }),
  ];
  return {
    project: makeProject({ lastSequence: 2, nodeCount: 1, eventCount: 2 }),
    events,
    layouts: [],
    snapshot: {
      sequence: 2,
      status: "draft",
      stateHash: "b".repeat(64),
      nodes: [node],
      edges: [],
    },
  };
}

describe("StudioShell", () => {
  it("inspects objects, vectors, the key, and replay state", async () => {
    const user = userEvent.setup();
    const loaded = loadedProject();
    const repository = {
      loadProject: vi.fn().mockResolvedValue(loaded),
      appendProjectEvent: vi.fn(),
      saveLayout: vi.fn(),
    } as unknown as ProjectRepository;

    render(
      <StudioShell
        projectId="project-1"
        onExit={vi.fn()}
        repository={repository}
        initialData={loaded}
      />,
    );

    expect(screen.getByRole("button", { name: /^start$/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /select event sourcing/i }));
    expect(screen.getByRole("heading", { name: "Event sourcing" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /^vector$/i }));
    expect(screen.getByText(/feature-hash-v1/i)).toBeVisible();
    expect(screen.getByText(/2 dimensions/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /open visual key/i }));
    await user.click(screen.getByRole("button", { name: /minimize visual key/i }));
    expect(screen.getByRole("button", { name: /open visual key/i })).toBeVisible();

    fireEvent.change(screen.getByLabelText(/replay sequence/i), {
      target: { value: "1" },
    });
    expect(screen.getByText(/replay 1 of 2/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /return to live/i })).toBeVisible();
  });

  it("opens manual object creation from the N shortcut", async () => {
    const loaded = loadedProject();
    const repository = {
      loadProject: vi.fn().mockResolvedValue(loaded),
      appendProjectEvent: vi.fn(),
      saveLayout: vi.fn(),
    } as unknown as ProjectRepository;
    render(
      <StudioShell
        projectId="project-1"
        onExit={vi.fn()}
        repository={repository}
        initialData={loaded}
      />,
    );

    fireEvent.keyDown(window, { key: "n" });
    expect(screen.getByRole("dialog", { name: /add object/i })).toBeInTheDocument();
  });
});
