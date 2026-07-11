import { resolveProposal } from "@/lib/domain/events";
import type {
  GenerationRequest,
  GraphEvent,
  MutationProposal,
  ProjectStatus,
  VectorRecord,
} from "@/lib/domain/types";
import { featureHashVector } from "@/lib/insights/vectors";
import type { ProjectRepository } from "@/lib/persistence/projects";
import {
  generateLocalProposals,
  type LocalEngineInput,
} from "@/lib/runtime/localEngine";
import { requestMutationBatch } from "@/lib/runtime/gatewayClient";
import { RUN_LIMITS } from "@/lib/runtime/limits";

type ProposalSource = AsyncIterable<MutationProposal>;

export interface RunControllerDependencies {
  repository: Pick<ProjectRepository, "loadProject" | "appendProjectEvent">;
  now?: () => string;
  createId?: () => string;
  vectorize?: (text: string, occurredAt: string) => VectorRecord;
  localSource?: (input: LocalEngineInput) => ProposalSource;
  gatewaySource?: (
    request: GenerationRequest,
    signal: AbortSignal,
  ) => ProposalSource;
  onEvent?: (event: GraphEvent) => void;
}

function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function edgeKey(source: string, target: string, relation: string): string {
  return `${source}\u0000${target}\u0000${relation}`;
}

export function createRunController(dependencies: RunControllerDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const vectorize =
    dependencies.vectorize ??
    ((text: string, occurredAt: string) =>
      featureHashVector(text, 48, occurredAt));
  const localSource = dependencies.localSource ?? generateLocalProposals;
  const gatewaySource = dependencies.gatewaySource ?? requestMutationBatch;
  let currentStatus: ProjectStatus | "idle" = "idle";
  let controller: AbortController | null = null;
  let active = false;
  let stopRequested = false;

  const publish = (event: GraphEvent) => dependencies.onEvent?.(event);

  async function appendLifecycle(
    projectId: string,
    type: "run.started" | "run.stopped" | "run.failed",
    reason: string,
  ): Promise<GraphEvent> {
    const event = await dependencies.repository.appendProjectEvent(projectId, {
      id: createId(),
      type,
      actor: type === "run.started" ? "user" : "system",
      occurredAt: now(),
      reason,
      evidence: [],
      payload: {},
    });
    publish(event);
    return event;
  }

  async function* gatewayRun(
    projectId: string,
    signal: AbortSignal,
  ): AsyncGenerator<MutationProposal> {
    let batch = 0;
    while (!signal.aborted) {
      const loaded = await dependencies.repository.loadProject(projectId, {
        verify: false,
      });
      if (!loaded) throw new Error(`Project ${projectId} was not found`);
      const request: GenerationRequest = {
        projectId,
        purpose: loaded.project.purpose,
        prompt: loaded.project.seedPrompt,
        batch,
        nodes: loaded.snapshot.nodes.slice(-RUN_LIMITS.contextNodes).map((node) => ({
          id: node.id,
          label: node.label,
          summary: node.summary,
          kind: node.kind,
          epistemicStatus: node.epistemicStatus,
        })),
        edges: loaded.snapshot.edges.slice(-RUN_LIMITS.contextEdges).map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          relation: edge.relation,
        })),
      };

      for await (const proposal of gatewaySource(request, signal)) {
        yield proposal;
      }
      batch += 1;
    }
  }

  async function start(projectId: string): Promise<void> {
    if (active) throw new Error("A graph run is already active in this tab");
    const stoppedBeforeStart = stopRequested;
    stopRequested = false;
    const loaded = await dependencies.repository.loadProject(projectId, {
      verify: false,
    });
    if (!loaded) throw new Error(`Project ${projectId} was not found`);

    active = true;
    controller = new AbortController();
    if (stoppedBeforeStart || stopRequested) controller.abort();
    currentStatus = "running";
    try {
      await appendLifecycle(projectId, "run.started", "Start the graph run.");
    } catch (error) {
      active = false;
      controller = null;
      currentStatus = "failed";
      stopRequested = false;
      throw error;
    }

    const refs = new Map<string, string>();
    const knownNodeIds = new Set(loaded.snapshot.nodes.map((node) => node.id));
    const labels = new Map(
      loaded.snapshot.nodes.map((node) => [
        node.label.trim().toLocaleLowerCase("en-US"),
        node.id,
      ]),
    );
    const edges = new Set(
      loaded.snapshot.edges.map((edge) =>
        edgeKey(edge.source, edge.target, edge.relation),
      ),
    );
    let nodeCount = loaded.project.nodeCount;
    let edgeCount = loaded.project.edgeCount;
    let budgetReached = false;

    const source =
      loaded.project.engine === "local"
        ? localSource({
            prompt: loaded.project.seedPrompt,
            purpose: loaded.project.purpose,
            batch: loaded.project.eventCount,
            existingNodes: loaded.snapshot.nodes,
            existingEdges: loaded.snapshot.edges,
            signal: controller.signal,
          })
        : gatewayRun(projectId, controller.signal);

    try {
      for await (const proposal of source) {
        controller.signal.throwIfAborted();

        if (proposal.type === "add-node") {
          const existing = labels.get(
            proposal.label.trim().toLocaleLowerCase("en-US"),
          );
          if (existing) {
            refs.set(`batch:${proposal.ref}`, existing);
            continue;
          }
          if (nodeCount >= RUN_LIMITS.nodeBudget) {
            budgetReached = true;
            break;
          }
        } else if (edgeCount >= RUN_LIMITS.edgeBudget) {
          budgetReached = true;
          break;
        }

        const eventId = createId();
        const occurredAt = now();
        const resolved = resolveProposal(proposal, {
          eventId,
          occurredAt,
          refs,
          knownNodeIds,
          createId,
          vectorize,
        });

        if (resolved.type === "edge.added") {
          const edge = resolved.payload.edge;
          const key = edgeKey(edge.source, edge.target, edge.relation);
          if (edges.has(key)) continue;
          edges.add(key);
        }

        const event = await dependencies.repository.appendProjectEvent(projectId, {
          id: eventId,
          type: resolved.type,
          actor: loaded.project.engine === "local" ? "local-engine" : "model",
          occurredAt,
          reason: resolved.reason,
          evidence: resolved.evidence,
          payload: resolved.payload,
        });
        if (resolved.type === "node.added") {
          nodeCount += 1;
          labels.set(
            resolved.payload.node.label.trim().toLocaleLowerCase("en-US"),
            resolved.payload.node.id,
          );
        } else {
          edgeCount += 1;
        }
        publish(event);
      }

      await appendLifecycle(
        projectId,
        "run.stopped",
        budgetReached
          ? "The graph reached its configured safety budget."
          : "The graph source completed its run.",
      );
      currentStatus = "stopped";
    } catch (error) {
      if (isAbort(error) || controller.signal.aborted) {
        await appendLifecycle(projectId, "run.stopped", "The user stopped the graph run.");
        currentStatus = "stopped";
      } else {
        currentStatus = "failed";
        try {
          await appendLifecycle(
            projectId,
            "run.failed",
            error instanceof Error ? error.message : "The graph run failed.",
          );
        } catch {
          currentStatus = "failed";
        }
        throw error;
      }
    } finally {
      active = false;
      controller = null;
      stopRequested = false;
    }
  }

  return {
    start,
    resume: start,
    stop() {
      stopRequested = true;
      controller?.abort();
    },
    get status() {
      return currentStatus;
    },
    get isActive() {
      return active;
    },
  };
}
