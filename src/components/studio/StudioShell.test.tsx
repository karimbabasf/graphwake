import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StudioShell } from "@/components/studio/StudioShell";
import type { GraphEvent } from "@/lib/domain/types";
import type { LoadedProject, ProjectRepository } from "@/lib/persistence/projects";
import { makeNode, makeProject, NOW } from "@/test/factories";

const runController = vi.hoisted(() => ({
  start: vi.fn<() => Promise<void>>(),
  stop: vi.fn(),
}));

const runLock = vi.hoisted(() => ({
  run: vi.fn<(
    projectId: string,
    action: () => Promise<void>,
  ) => Promise<void>>(),
}));

vi.mock("@/lib/runtime/controller", () => ({
  createRunController: () => runController,
}));

vi.mock("@/lib/runtime/runLock", () => ({
  runWithProjectLock: (
    projectId: string,
    action: () => Promise<void>,
  ) => runLock.run(projectId, action),
}));

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
    event({
      id: "event-3",
      sequence: 3,
      type: "project.renamed",
      previousEventHash: "a".repeat(64),
      payload: { name: "Graph test" },
      reason: "Keep the fixture name while adding a replay boundary.",
    }),
  ];
  return {
    project: makeProject({ lastSequence: 3, nodeCount: 1, eventCount: 3 }),
    events,
    layouts: [],
    snapshot: {
      sequence: 3,
      status: "draft",
      stateHash: "b".repeat(64),
      nodes: [node],
      edges: [],
    },
  };
}

describe("StudioShell", () => {
  beforeEach(() => {
    runController.start.mockReset();
    runController.start.mockResolvedValue();
    runController.stop.mockReset();
    runLock.run.mockReset();
    runLock.run.mockImplementation((_projectId, action) => action());
  });

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
    expect(
      screen.getByRole("button", { name: /gateway access/i }),
    ).toBeVisible();
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
    expect(screen.getByText(/replay 1 of 3/i)).toBeVisible();
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

  it("does not offer a model embedding while replaying history", async () => {
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

    await user.click(screen.getByRole("button", { name: /select event sourcing/i }));
    fireEvent.change(screen.getByLabelText(/replay sequence/i), {
      target: { value: "2" },
    });
    await user.click(screen.getByRole("tab", { name: /^vector$/i }));

    expect(
      screen.queryByRole("button", { name: /create model embedding/i }),
    ).not.toBeInTheDocument();
  });

  it("waits for the active run to finish before leaving the studio", async () => {
    const user = userEvent.setup();
    const loaded = loadedProject();
    let finishRun: (() => void) | undefined;
    runController.start.mockImplementation(
      () => new Promise<void>((resolve) => {
        finishRun = resolve;
      }),
    );
    const onExit = vi.fn();
    const repository = {
      loadProject: vi.fn().mockResolvedValue(loaded),
      appendProjectEvent: vi.fn(),
      saveLayout: vi.fn(),
    } as unknown as ProjectRepository;

    render(
      <StudioShell
        projectId="project-1"
        onExit={onExit}
        repository={repository}
        initialData={loaded}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^start$/i }));
    await user.click(screen.getByRole("button", { name: /^projects$/i }));

    expect(runController.stop).toHaveBeenCalledOnce();
    expect(onExit).not.toHaveBeenCalled();

    finishRun?.();
    await waitFor(() => expect(onExit).toHaveBeenCalledOnce());
  });

  it("keeps exit pending when the project lock has not granted the run", async () => {
    const user = userEvent.setup();
    const loaded = loadedProject();
    let grantLock: (() => void) | undefined;
    const lockGate = new Promise<void>((resolve) => {
      grantLock = resolve;
    });
    runLock.run.mockImplementation(async (_projectId, action) => {
      await lockGate;
      await action();
    });
    const onExit = vi.fn();
    const repository = {
      loadProject: vi.fn().mockResolvedValue(loaded),
      appendProjectEvent: vi.fn(),
      saveLayout: vi.fn(),
    } as unknown as ProjectRepository;

    render(
      <StudioShell
        projectId="project-1"
        onExit={onExit}
        repository={repository}
        initialData={loaded}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^start$/i }));
    await waitFor(() => expect(runLock.run).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: /^projects$/i }));

    expect(runController.stop).toHaveBeenCalledOnce();
    expect(runController.start).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();

    grantLock?.();
    await waitFor(() => expect(runController.start).toHaveBeenCalledOnce());
    await waitFor(() => expect(onExit).toHaveBeenCalledOnce());
  });
});
