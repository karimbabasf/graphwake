import { hashEvent, hashSnapshot } from "@/lib/domain/hash";
import { mutationProposalSchema } from "@/lib/domain/schemas";
import { replayEvents } from "@/lib/domain/replay";
import { reduceEvent } from "@/lib/domain/reducer";
import type {
  ActorKind,
  EvidenceRef,
  EventType,
  GraphEdge,
  GraphEvent,
  GraphNode,
  MutationProposal,
  VectorRecord,
} from "@/lib/domain/types";

const EMPTY_HASH = "0".repeat(64);

export interface AppendEventInput<TPayload = unknown> {
  id?: string;
  projectId: string;
  type: EventType;
  actor: ActorKind;
  occurredAt?: string;
  reason: string;
  evidence?: EvidenceRef[];
  payload: TPayload;
}

export async function appendEvent<TPayload>(
  events: GraphEvent[],
  input: AppendEventInput<TPayload>,
): Promise<GraphEvent<TPayload>> {
  const previous = events.at(-1);
  if (events.some((event) => event.projectId !== input.projectId)) {
    throw new Error("A ledger cannot contain events from multiple projects");
  }

  const event: GraphEvent<TPayload> = {
    id: input.id ?? crypto.randomUUID(),
    projectId: input.projectId,
    sequence: (previous?.sequence ?? 0) + 1,
    type: input.type,
    actor: input.actor,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    reason: input.reason,
    evidence: input.evidence ?? [],
    payload: input.payload,
    reducerVersion: 1,
    previousEventHash: previous?.eventHash ?? null,
    eventHash: EMPTY_HASH,
    resultingStateHash: EMPTY_HASH,
  };

  const current = replayEvents(events);
  const next = reduceEvent(current, event);
  event.resultingStateHash = await hashSnapshot(next);
  event.eventHash = await hashEvent(event);
  return event;
}

export type ResolvedMutation =
  | {
      type: "node.added";
      payload: { node: GraphNode };
      reason: string;
      evidence: EvidenceRef[];
    }
  | {
      type: "edge.added";
      payload: { edge: GraphEdge };
      reason: string;
      evidence: EvidenceRef[];
    };

export interface ProposalResolutionContext {
  eventId: string;
  occurredAt: string;
  refs: Map<string, string>;
  knownNodeIds: Set<string>;
  createId?: () => string;
  vectorize: (text: string, occurredAt: string) => VectorRecord;
}

function resolveNodeRef(
  ref: string,
  context: ProposalResolutionContext,
): string {
  const batchId = context.refs.get(ref);
  if (batchId) return batchId;
  if (context.knownNodeIds.has(ref)) return ref;
  throw new Error(`Unknown node reference ${ref}`);
}

export function resolveProposal(
  input: MutationProposal,
  context: ProposalResolutionContext,
): ResolvedMutation {
  const proposal = mutationProposalSchema.parse(input);
  const createId = context.createId ?? (() => crypto.randomUUID());

  if (proposal.type === "add-node") {
    const nodeId = createId();
    context.refs.set(`batch:${proposal.ref}`, nodeId);
    context.knownNodeIds.add(nodeId);

    return {
      type: "node.added",
      payload: {
        node: {
          id: nodeId,
          label: proposal.label,
          summary: proposal.summary,
          kind: proposal.kind,
          epistemicStatus: proposal.epistemicStatus,
          confidence: proposal.confidence,
          evidence: proposal.evidence,
          vector: context.vectorize(
            `${proposal.label} ${proposal.summary}`,
            context.occurredAt,
          ),
          createdByEventId: context.eventId,
          updatedByEventId: context.eventId,
        },
      },
      reason: proposal.reason,
      evidence: proposal.evidence,
    };
  }

  const source = resolveNodeRef(proposal.sourceRef, context);
  const target = resolveNodeRef(proposal.targetRef, context);
  if (source === target) {
    throw new Error("Self edges are not allowed");
  }

  return {
    type: "edge.added",
    payload: {
      edge: {
        id: createId(),
        source,
        target,
        relation: proposal.relation,
        confidence: proposal.confidence,
        evidence: proposal.evidence,
        rationale: proposal.reason,
        createdByEventId: context.eventId,
      },
    },
    reason: proposal.reason,
    evidence: proposal.evidence,
  };
}
