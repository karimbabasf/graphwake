import { z } from "zod";

import {
  ACTOR_KINDS,
  EPISTEMIC_STATUSES,
  EVENT_TYPES,
  NODE_KINDS,
  PROJECT_STATUSES,
  RELATION_KINDS,
} from "@/lib/domain/types";

const identifierSchema = z.string().trim().min(1).max(160);
const isoDateSchema = z.iso.datetime({ offset: true });
const confidenceSchema = z.number().min(0).max(1);

export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const actorKindSchema = z.enum(ACTOR_KINDS);
export const nodeKindSchema = z.enum(NODE_KINDS);
export const epistemicStatusSchema = z.enum(EPISTEMIC_STATUSES);
export const relationKindSchema = z.enum(RELATION_KINDS);
export const eventTypeSchema = z.enum(EVENT_TYPES);

export const evidenceRefSchema = z
  .object({
    id: identifierSchema,
    label: z.string().trim().min(1).max(160),
    uri: z.url().max(2_048).optional(),
    excerpt: z.string().trim().min(1).max(1_000).optional(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  })
  .strict();

export const vectorRecordSchema = z
  .object({
    method: z.string().trim().min(1).max(160),
    dimensions: z.number().int().min(1).max(4_096),
    values: z.array(z.number().finite()).min(1).max(4_096),
    normalized: z.boolean(),
    createdAt: isoDateSchema,
  })
  .strict()
  .refine((vector) => vector.values.length === vector.dimensions, {
    message: "Vector value count must match dimensions",
    path: ["values"],
  });

export const projectSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1).max(80),
    purpose: z.string().trim().min(1).max(600),
    seedPrompt: z.string().trim().min(1).max(1_200),
    status: projectStatusSchema,
    engine: z.enum(["local", "gateway"]),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
    lastOpenedAt: isoDateSchema,
    lastSequence: z.number().int().min(0),
    nodeCount: z.number().int().min(0),
    edgeCount: z.number().int().min(0),
    eventCount: z.number().int().min(0),
    schemaVersion: z.literal(1),
  })
  .strict();

export const graphNodeSchema = z
  .object({
    id: identifierSchema,
    label: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(1).max(600),
    kind: nodeKindSchema,
    epistemicStatus: epistemicStatusSchema,
    confidence: confidenceSchema,
    evidence: z.array(evidenceRefSchema).max(24),
    vector: vectorRecordSchema,
    createdByEventId: identifierSchema,
    updatedByEventId: identifierSchema,
  })
  .strict();

export const graphEdgeSchema = z
  .object({
    id: identifierSchema,
    source: identifierSchema,
    target: identifierSchema,
    relation: relationKindSchema,
    confidence: confidenceSchema,
    evidence: z.array(evidenceRefSchema).max(24),
    rationale: z.string().trim().min(1).max(600),
    createdByEventId: identifierSchema,
  })
  .strict()
  .refine((edge) => edge.source !== edge.target, {
    message: "Self edges are not allowed",
    path: ["target"],
  });

export const graphEventSchema = z
  .object({
    id: identifierSchema,
    projectId: identifierSchema,
    sequence: z.number().int().min(1),
    type: eventTypeSchema,
    actor: actorKindSchema,
    occurredAt: isoDateSchema,
    reason: z.string().trim().min(1).max(600),
    evidence: z.array(evidenceRefSchema).max(24),
    payload: z.unknown(),
    reducerVersion: z.literal(1),
    previousEventHash: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
    eventHash: z.string().regex(/^[a-f0-9]{64}$/i),
    resultingStateHash: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();

const addNodeProposalSchema = z
  .object({
    type: z.literal("add-node"),
    ref: identifierSchema,
    label: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(1).max(600),
    kind: nodeKindSchema,
    epistemicStatus: epistemicStatusSchema,
    confidence: confidenceSchema,
    evidence: z.array(evidenceRefSchema).max(24),
    reason: z.string().trim().min(1).max(600),
  })
  .strict();

const addEdgeProposalSchema = z
  .object({
    type: z.literal("add-edge"),
    sourceRef: identifierSchema,
    targetRef: identifierSchema,
    relation: relationKindSchema,
    confidence: confidenceSchema,
    evidence: z.array(evidenceRefSchema).max(24),
    reason: z.string().trim().min(1).max(600),
  })
  .strict()
  .refine((edge) => edge.sourceRef !== edge.targetRef, {
    message: "Self edges are not allowed",
    path: ["targetRef"],
  });

export const mutationProposalSchema = z.discriminatedUnion("type", [
  addNodeProposalSchema,
  addEdgeProposalSchema,
]);

const generationContextNodeSchema = z
  .object({
    id: identifierSchema,
    label: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(1).max(600),
    kind: nodeKindSchema,
    epistemicStatus: epistemicStatusSchema,
  })
  .strict();

const generationContextEdgeSchema = z
  .object({
    id: identifierSchema,
    source: identifierSchema,
    target: identifierSchema,
    relation: relationKindSchema,
  })
  .strict();

export const generationRequestSchema = z
  .object({
    projectId: identifierSchema,
    purpose: z.string().trim().min(1).max(600),
    prompt: z.string().trim().min(1).max(1_200),
    batch: z.number().int().min(0).max(1_000),
    nodes: z.array(generationContextNodeSchema).max(80),
    edges: z.array(generationContextEdgeSchema).max(120),
  })
  .strict();

export const embeddingRequestSchema = z
  .object({
    values: z.array(z.string().trim().min(1).max(2_000)).min(1).max(16),
  })
  .strict();
