export const PROJECT_STATUSES = [
  "draft",
  "running",
  "stopped",
  "interrupted",
  "failed",
] as const;

export const ACTOR_KINDS = [
  "user",
  "local-engine",
  "model",
  "system",
] as const;

export const NODE_KINDS = [
  "source",
  "observation",
  "assertion",
  "concept",
  "question",
  "decision",
  "state",
] as const;

export const EPISTEMIC_STATUSES = [
  "observed",
  "asserted",
  "inferred",
  "hypothesis",
] as const;

export const RELATION_KINDS = [
  "supports",
  "refutes",
  "derived-from",
  "depends-on",
  "similar-to",
  "causal-hypothesis",
  "transitions-to",
  "contains",
] as const;

export const EVENT_TYPES = [
  "project.created",
  "project.renamed",
  "run.started",
  "run.stopped",
  "run.interrupted",
  "run.failed",
  "node.added",
  "node.updated",
  "edge.added",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ActorKind = (typeof ACTOR_KINDS)[number];
export type NodeKind = (typeof NODE_KINDS)[number];
export type EpistemicStatus = (typeof EPISTEMIC_STATUSES)[number];
export type RelationKind = (typeof RELATION_KINDS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type EngineKind = "local" | "gateway";

export interface EvidenceRef {
  id: string;
  label: string;
  uri?: string;
  excerpt?: string;
  contentHash?: string;
}

export interface VectorRecord {
  method: string;
  dimensions: number;
  values: number[];
  normalized: boolean;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  purpose: string;
  seedPrompt: string;
  status: ProjectStatus;
  engine: EngineKind;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  lastSequence: number;
  nodeCount: number;
  edgeCount: number;
  eventCount: number;
  schemaVersion: 1;
}

export interface GraphNode {
  id: string;
  label: string;
  summary: string;
  kind: NodeKind;
  epistemicStatus: EpistemicStatus;
  confidence: number;
  evidence: EvidenceRef[];
  vector: VectorRecord;
  createdByEventId: string;
  updatedByEventId: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationKind;
  confidence: number;
  evidence: EvidenceRef[];
  rationale: string;
  createdByEventId: string;
}

export interface GraphSnapshot {
  sequence: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stateHash: string;
  status: ProjectStatus;
  name?: string;
}

export interface GraphEvent<TPayload = unknown> {
  id: string;
  projectId: string;
  sequence: number;
  type: EventType;
  actor: ActorKind;
  occurredAt: string;
  reason: string;
  evidence: EvidenceRef[];
  payload: TPayload;
  reducerVersion: 1;
  previousEventHash: string | null;
  eventHash: string;
  resultingStateHash: string;
}

export interface AddNodeProposal {
  type: "add-node";
  ref: string;
  label: string;
  summary: string;
  kind: NodeKind;
  epistemicStatus: EpistemicStatus;
  confidence: number;
  evidence: EvidenceRef[];
  reason: string;
}

export interface AddEdgeProposal {
  type: "add-edge";
  sourceRef: string;
  targetRef: string;
  relation: RelationKind;
  confidence: number;
  evidence: EvidenceRef[];
  reason: string;
}

export type MutationProposal = AddNodeProposal | AddEdgeProposal;

export interface GenerationContextNode {
  id: string;
  label: string;
  summary: string;
  kind: NodeKind;
  epistemicStatus: EpistemicStatus;
}

export interface GenerationContextEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationKind;
}

export interface GenerationRequest {
  projectId: string;
  purpose: string;
  prompt: string;
  batch: number;
  nodes: GenerationContextNode[];
  edges: GenerationContextEdge[];
}

export interface EmbeddingRequest {
  values: string[];
}

export interface LayoutPosition {
  projectId: string;
  nodeId: string;
  x: number;
  y: number;
  updatedAt: string;
}

export interface InsightResult {
  method: string;
  sequence: number;
  inputIds: string[];
  formula: string;
  value: number | string | string[];
  caveat: string;
}

export interface LedgerVerification {
  valid: boolean;
  checkedEvents: number;
  finalStateHash: string | null;
  errors: string[];
}
