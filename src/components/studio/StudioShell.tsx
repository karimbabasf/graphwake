"use client";

import {
  ArrowLeft,
  Braces,
  Database,
  PanelRight,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AccessibleGraph } from "@/components/graph/AccessibleGraph";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { EventRail } from "@/components/studio/EventRail";
import { GatewayAccess } from "@/components/studio/GatewayAccess";
import { Inspector } from "@/components/studio/Inspector";
import { Legend } from "@/components/studio/Legend";
import {
  ManualMutation,
  type ManualMode,
} from "@/components/studio/ManualMutation";
import { RunControl } from "@/components/studio/RunControl";
import { resolveProposal } from "@/lib/domain/events";
import { replayEvents } from "@/lib/domain/replay";
import type {
  GraphEvent,
  GraphNode,
  MutationProposal,
  VectorRecord,
} from "@/lib/domain/types";
import { featureHashVector } from "@/lib/insights/vectors";
import type {
  LoadedProject,
  ProjectRepository,
} from "@/lib/persistence/projects";
import { createRunController } from "@/lib/runtime/controller";
import { gatewayRequestHeaders } from "@/lib/runtime/gatewayAccess";
import { runWithProjectLock } from "@/lib/runtime/runLock";

interface StudioShellProps {
  projectId: string;
  onExit: () => void | Promise<void>;
  repository?: ProjectRepository;
  initialData?: LoadedProject;
  storagePersistent?: boolean | null;
}

interface EmbedResponse {
  model: string;
  dimensions: number;
  vectors: number[][];
}

function isInputTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function readEmbedResponse(value: unknown): EmbedResponse {
  if (!value || typeof value !== "object") throw new Error("The embedding response is invalid.");
  const response = value as Partial<EmbedResponse> & { message?: unknown };
  if (
    typeof response.model !== "string" ||
    typeof response.dimensions !== "number" ||
    !Array.isArray(response.vectors) ||
    !response.vectors.every(
      (vector) => Array.isArray(vector) && vector.every((item) => typeof item === "number"),
    )
  ) {
    throw new Error(typeof response.message === "string" ? response.message : "The embedding response is invalid.");
  }
  return response as EmbedResponse;
}

export function StudioShell({
  projectId,
  onExit,
  repository,
  initialData,
  storagePersistent = null,
}: StudioShellProps) {
  const repositoryRef = useRef<ProjectRepository | null>(repository ?? null);
  const controllerRef = useRef<ReturnType<typeof createRunController> | null>(null);
  const runTaskRef = useRef<Promise<void> | null>(null);
  const exitTaskRef = useRef<Promise<void> | null>(null);
  const exitRequestedRef = useRef(false);
  const [loaded, setLoaded] = useState<LoadedProject | null>(initialData ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [replaySequence, setReplaySequence] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [wakeEvent, setWakeEvent] = useState<GraphEvent | null>(null);
  const [manualMode, setManualMode] = useState<ManualMode>(null);
  const [showObjects, setShowObjects] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (repository) repositoryRef.current = repository;
  }, [repository]);

  const getRepository = useCallback(async () => {
    if (repositoryRef.current) return repositoryRef.current;
    const repositoryModule = await import("@/lib/persistence/projects");
    repositoryRef.current = repositoryModule.projectRepository;
    return repositoryModule.projectRepository;
  }, []);

  const reload = useCallback(async (verify = true) => {
    const currentRepository = await getRepository();
    const current = await currentRepository.loadProject(projectId, { verify });
    if (!current) throw new Error("This project no longer exists in local storage.");
    setLoaded(current);
    return current;
  }, [getRepository, projectId]);

  useEffect(() => {
    let cancelled = false;
    void getRepository()
      .then((currentRepository) => currentRepository.loadProject(projectId))
      .then((current) => {
        if (cancelled) return;
        if (!current) throw new Error("This project no longer exists in local storage.");
        setLoaded(current);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "The project could not be loaded.");
      });
    return () => {
      cancelled = true;
      controllerRef.current?.stop();
    };
  }, [getRepository, projectId]);

  const snapshot = useMemo(
    () =>
      loaded
        ? replayEvents(loaded.events, replaySequence ?? Number.POSITIVE_INFINITY)
        : null,
    [loaded, replaySequence],
  );
  const selectedNode =
    snapshot?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge =
    snapshot?.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const selectedEvent =
    loaded?.events.find((event) => event.id === selectedEventId) ?? null;

  const start = useCallback(() => {
    if (runTaskRef.current || running || replaySequence !== null) return;
    setRuntimeError(null);
    setRunning(true);
    const task = (async () => {
      const currentRepository = await getRepository();
      const controller = createRunController({
        repository: currentRepository,
        onEvent(event) {
          setWakeEvent(event);
          setSelectedEventId(event.id);
          void reload(false);
        },
      });
      controllerRef.current = controller;
      if (exitRequestedRef.current) controller.stop();
      await runWithProjectLock(projectId, () => controller.start(projectId));
    })()
      .catch((error) => {
        setRuntimeError(error instanceof Error ? error.message : "The graph runner failed.");
      })
      .finally(async () => {
        setRunning(false);
        controllerRef.current = null;
        try {
          await reload();
        } catch (error) {
          setRuntimeError(error instanceof Error ? error.message : "The project could not be reloaded.");
        }
      });
    runTaskRef.current = task;
    void task.finally(() => {
      if (runTaskRef.current === task) runTaskRef.current = null;
    });
  }, [getRepository, projectId, reload, replaySequence, running]);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const exitStudio = useCallback(() => {
    if (exitTaskRef.current) return exitTaskRef.current;
    const task = (async () => {
      exitRequestedRef.current = true;
      setExiting(true);
      controllerRef.current?.stop();
      await runTaskRef.current;
      await onExit();
    })();
    exitTaskRef.current = task;
    return task;
  }, [onExit]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (isInputTarget(event.target)) return;
      const key = event.key.toLocaleLowerCase("en-US");
      if (key === "n" && replaySequence === null && !running) {
        event.preventDefault();
        setManualMode("node");
      } else if (key === "e" && replaySequence === null && !running && (snapshot?.nodes.length ?? 0) >= 2) {
        event.preventDefault();
        setManualMode("edge");
      } else if (event.code === "Space") {
        event.preventDefault();
        if (running) stop();
        else void start();
      } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && loaded) {
        event.preventDefault();
        const current = replaySequence ?? loaded.project.lastSequence;
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        const next = Math.min(loaded.project.lastSequence, Math.max(1, current + direction));
        setReplaySequence(next === loaded.project.lastSequence ? null : next);
      } else if (event.key === "Escape") {
        setManualMode(null);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setShowObjects(false);
        setShowInspector(false);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [loaded, replaySequence, running, snapshot?.nodes.length, start, stop]);

  async function commitProposal(proposal: MutationProposal) {
    if (!snapshot || replaySequence !== null) throw new Error("Return to live before editing.");
    const currentRepository = await getRepository();
    const eventId = crypto.randomUUID();
    const occurredAt = new Date().toISOString();
    const resolved = resolveProposal(proposal, {
      eventId,
      occurredAt,
      refs: new Map(),
      knownNodeIds: new Set(snapshot.nodes.map((node) => node.id)),
      vectorize: (text, time) => featureHashVector(text, 48, time),
    });
    const event = await currentRepository.appendProjectEvent(projectId, {
      id: eventId,
      type: resolved.type,
      actor: "user",
      occurredAt,
      reason: resolved.reason,
      evidence: resolved.evidence,
      payload: resolved.payload,
    });
    setWakeEvent(event);
    setSelectedEventId(event.id);
    await reload(false);
  }

  async function embedNode(node: GraphNode) {
    if (replaySequence !== null || running) {
      throw new Error("Return to a stopped live state before changing a vector.");
    }
    setRuntimeError(null);
    const response = await fetch("/api/embed", {
      method: "POST",
      headers: gatewayRequestHeaders(),
      body: JSON.stringify({ values: [`${node.label} ${node.summary}`] }),
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const message =
        body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
          ? (body as { message: string }).message
          : "The model embedding request failed.";
      setRuntimeError(message);
      throw new Error(message);
    }
    const embedding = readEmbedResponse(body);
    const values = embedding.vectors[0];
    if (!values || values.length !== embedding.dimensions) {
      throw new Error("The model returned an embedding with the wrong dimensions.");
    }
    const vector: VectorRecord = {
      method: embedding.model,
      dimensions: embedding.dimensions,
      values,
      normalized: false,
      createdAt: new Date().toISOString(),
    };
    const currentRepository = await getRepository();
    const event = await currentRepository.appendProjectEvent(projectId, {
      id: crypto.randomUUID(),
      type: "node.updated",
      actor: "user",
      occurredAt: vector.createdAt,
      reason: `Replace the local projection with a ${embedding.model} embedding.`,
      evidence: [],
      payload: { nodeId: node.id, patch: { vector } },
    });
    setWakeEvent(event);
    setSelectedEventId(event.id);
    await reload(false);
  }

  async function saveLayout(
    positions: Array<{ nodeId: string; x: number; y: number }>,
  ) {
    const currentRepository = await getRepository();
    await currentRepository.saveLayout(projectId, positions);
    await reload(false);
  }

  if (loadError) {
    return (
      <main className="studio-failure">
        <span>PROJECT LOAD FAILED</span>
        <h1>The local record could not be opened.</h1>
        <p>{loadError}</p>
        <button type="button" onClick={() => void exitStudio()} disabled={exiting}>Return to projects</button>
      </main>
    );
  }

  if (!loaded || !snapshot) {
    return <main className="studio-loading" aria-label="Loading graph studio"><i /><i /><i /></main>;
  }

  const replaying = replaySequence !== null;
  const status = running
    ? "running"
    : replaying
      ? snapshot.status
      : loaded.project.status;

  return (
    <main className={`studio-shell ${replaying ? "is-replaying" : ""}`}>
      <header className="mobile-studio-header">
        <button type="button" onClick={() => void exitStudio()} disabled={exiting} aria-label="Back to projects"><ArrowLeft size={18} /></button>
        <strong>{loaded.project.name}</strong>
        <div>
          <button type="button" onClick={() => setShowObjects(true)} aria-label="Open object index"><Database size={18} /></button>
          <button type="button" onClick={() => setShowInspector(true)} aria-label="Open inspector"><PanelRight size={18} /></button>
        </div>
      </header>

      <aside className={`studio-rail ${showObjects ? "is-open" : ""}`}>
        <header>
          <button className="studio-wordmark" type="button" onClick={() => void exitStudio()} disabled={exiting}>
            <span className="wordmark-mark" aria-hidden="true"><i /><i /><i /></span>
            GRAPHWAKE
          </button>
          <button className="back-projects" type="button" onClick={() => void exitStudio()} disabled={exiting}>
            <ArrowLeft aria-hidden="true" size={15} /> PROJECTS
          </button>
        </header>
        <section className="project-brief">
          <span className="eyebrow">ACTIVE PROJECT</span>
          <h1>{loaded.project.name}</h1>
          <p>{loaded.project.purpose}</p>
          <dl>
            <div><dt>Runner</dt><dd>{loaded.project.engine}</dd></div>
            <div><dt>Objects</dt><dd>{loaded.project.nodeCount}</dd></div>
            <div><dt>Relations</dt><dd>{loaded.project.edgeCount}</dd></div>
            <div><dt>Events</dt><dd>{loaded.project.eventCount}</dd></div>
          </dl>
        </section>
        <button className="object-index-toggle" type="button" onClick={() => setShowObjects((value) => !value)}>
          <Database aria-hidden="true" size={14} />
          {showObjects ? "Hide object index" : "Show object index"}
        </button>
        {showObjects ? (
          <AccessibleGraph
            snapshot={snapshot}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={(nodeId) => {
              setSelectedNodeId(nodeId);
              setSelectedEdgeId(null);
              setSelectedEventId(null);
            }}
            onSelectEdge={(edgeId) => {
              setSelectedEdgeId(edgeId);
              setSelectedNodeId(null);
              setSelectedEventId(null);
            }}
          />
        ) : null}
        {storagePersistent === false ? (
          <p className="storage-warning">
            Browser-managed storage. Export this ledger after important work.
          </p>
        ) : null}
        <footer>
          <Braces aria-hidden="true" size={14} />
          <span>STATE</span>
          <code>{snapshot.stateHash.slice(0, 10)}</code>
        </footer>
      </aside>

      <section className="studio-field">
        <header className="field-heading">
          <div>
            <span className="eyebrow">
              {replaying ? "REPLAY EVIDENCE FIELD" : "LIVE EVIDENCE FIELD"} / S{snapshot.sequence}
            </span>
            <p>{loaded.project.seedPrompt}</p>
          </div>
          <div className="field-actions">
            <GatewayAccess />
            <ManualMutation
              mode={manualMode}
              snapshot={snapshot}
              selectedNodeId={selectedNodeId}
              disabled={running || replaying}
              onModeChange={setManualMode}
              onSubmit={commitProposal}
            />
          </div>
        </header>
        <RunControl
          status={status}
          engine={loaded.project.engine}
          running={running}
          disabled={replaying}
          nodeCount={snapshot.nodes.length}
          edgeCount={snapshot.edges.length}
          onStart={() => void start()}
          onStop={stop}
        />
        {loaded.project.status === "interrupted" && !running ? (
          <p className="runtime-notice">This run was interrupted when the browser closed. The ledger is intact and ready to resume.</p>
        ) : null}
        {runtimeError ? <p className="runtime-error" role="alert">{runtimeError}</p> : null}
        <div className="graph-field">
          <GraphCanvas
            snapshot={snapshot}
            events={loaded.events}
            layouts={loaded.layouts}
            activeEvent={replaying ? null : wakeEvent}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={(nodeId) => {
              setSelectedNodeId(nodeId);
              setSelectedEdgeId(null);
              setSelectedEventId(null);
              if (nodeId) setShowInspector(true);
            }}
            onSelectEdge={(edgeId) => {
              setSelectedEdgeId(edgeId);
              setSelectedNodeId(null);
              setSelectedEventId(null);
              if (edgeId) setShowInspector(true);
            }}
            onSaveLayout={saveLayout}
            readOnly={running || replaying}
          />
          <Legend />
        </div>
        <EventRail
          events={loaded.events}
          replaySequence={replaySequence}
          selectedEventId={selectedEventId}
          onReplay={setReplaySequence}
          onReturnLive={() => setReplaySequence(null)}
          onSelectEvent={(eventId) => {
            setSelectedEventId(eventId);
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setShowInspector(true);
          }}
        />
      </section>

      <div className={`inspector-plane ${showInspector ? "is-open" : ""}`}>
        <button className="mobile-sheet-close" type="button" onClick={() => setShowInspector(false)}>Close inspector</button>
        <Inspector
          key={selectedNode?.id ?? selectedEdge?.id ?? selectedEvent?.id ?? "empty"}
          snapshot={snapshot}
          node={selectedNode}
          edge={selectedEdge}
          event={selectedEvent}
          onEmbed={replaying || running ? undefined : embedNode}
        />
      </div>
    </main>
  );
}
