# Graphwake design specification

Date: 2026-07-11
Status: approved by the initiating brief

## 1. Product statement

Graphwake is a local-first graph studio that shows what changed, how it changed, and what evidence supports it.

The application turns a prompt into a live, typed evidence graph. Each accepted mutation becomes an immutable event. The current graph is a replayed projection of those events, so a user can scrub backward, compare states, inspect calculations, and distinguish application lineage from claims about the outside world.

## 2. Truth boundary

Graphwake makes exact claims about its own data and computation:

- event `e17` added node `n6`
- reducer version `1` transformed state hash `a` into state hash `b`
- node `n6` has degree centrality `0.42` under the displayed formula
- vectors `v2` and `v8` have cosine similarity `0.71` in the named vector space
- a model proposed an assertion with the displayed evidence references and model-stated reason

Graphwake does not claim that:

- vector similarity proves shared meaning
- a provenance link proves truth
- a model-stated reason reveals hidden model reasoning
- an edge labeled `causal-hypothesis` proves real-world cause
- graph layout distance has semantic meaning unless the active layout explicitly maps a stored metric

The UI uses `Transition trace` for replayed application changes and reserves `Causal hypothesis` for a user or model assertion with evidence and assumptions.

## 3. Architecture decision

### 3.1 Runtime

- Next.js 16 App Router with React 19 and TypeScript
- Node.js runtime route handlers for AI generation and embedding
- browser-only project data in IndexedDB through Dexie
- Sigma 3 with Graphology for graph topology and WebGL rendering
- ForceAtlas2 in a worker, with persisted coordinates and a frozen live layout
- Motion for panel presence and direct interaction feedback
- Vitest, Testing Library, and fake IndexedDB for automated tests

The page and metadata remain Server Components. The studio shell is a client component because it owns IndexedDB, browser storage, run control, and selection. The heavy Sigma renderer loads dynamically inside the client boundary.

### 3.2 Source of truth

The append-only `events` table is the knowledge-state source of truth. Graph snapshots are derived by replay. Project metadata is a query index. Layout coordinates are presentation state and live in a separate table so dragging does not pollute the knowledge ledger.

### 3.3 Why local-first

The open-source first run needs no account, database, or deployment. Local persistence also makes the event ledger, replay, and export easy to inspect. Closing a browser cannot keep a job alive, so a project that was running reopens with status `interrupted`. That behavior is explicit in the interface.

## 4. Domain model

### 4.1 Enumerations

```ts
type ProjectStatus =
  | "draft"
  | "running"
  | "stopped"
  | "interrupted"
  | "failed";

type ActorKind = "user" | "local-engine" | "model" | "system";

type NodeKind =
  | "source"
  | "observation"
  | "assertion"
  | "concept"
  | "question"
  | "decision"
  | "state";

type EpistemicStatus =
  | "observed"
  | "asserted"
  | "inferred"
  | "hypothesis";

type RelationKind =
  | "supports"
  | "refutes"
  | "derived-from"
  | "depends-on"
  | "similar-to"
  | "causal-hypothesis"
  | "transitions-to"
  | "contains";
```

### 4.2 Project record

```ts
interface ProjectRecord {
  id: string;
  name: string;
  purpose: string;
  seedPrompt: string;
  status: ProjectStatus;
  engine: "local" | "gateway";
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  lastSequence: number;
  nodeCount: number;
  edgeCount: number;
  eventCount: number;
  schemaVersion: 1;
}
```

### 4.3 Graph objects

```ts
interface EvidenceRef {
  id: string;
  label: string;
  uri?: string;
  excerpt?: string;
  contentHash?: string;
}

interface VectorRecord {
  method: "feature-hash-v1" | "openai/text-embedding-3-small";
  dimensions: number;
  values: number[];
  normalized: boolean;
  createdAt: string;
}

interface GraphNode {
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

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationKind;
  confidence: number;
  evidence: EvidenceRef[];
  rationale: string;
  createdByEventId: string;
}

interface GraphSnapshot {
  sequence: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stateHash: string;
}
```

Confidence is an asserted score with a named actor, not a calibrated probability unless the evidence explicitly says so.

### 4.4 Event envelope

```ts
type EventType =
  | "project.created"
  | "project.renamed"
  | "run.started"
  | "run.stopped"
  | "run.interrupted"
  | "run.failed"
  | "node.added"
  | "node.updated"
  | "edge.added";

interface GraphEvent<TPayload = unknown> {
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
```

Event hashes use canonical JSON plus SHA-256. They show ledger integrity inside an export. They do not attest that the actor or evidence is truthful.

### 4.5 AI mutation proposal

The model never writes an event directly. It emits proposals:

```ts
type MutationProposal =
  | {
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
  | {
      type: "add-edge";
      sourceRef: string;
      targetRef: string;
      relation: RelationKind;
      confidence: number;
      evidence: EvidenceRef[];
      reason: string;
    };
```

References may be existing node IDs or `batch:<ref>` values for nodes proposed earlier in the same batch. Application validation rejects unknown references, duplicate self-edges, values outside limits, and disallowed relation names. Application code assigns final IDs and event metadata.

## 5. Persistence

Dexie database name: `graphwake`.

Version 1 tables:

```txt
projects: id, updatedAt, lastOpenedAt, status
events: id, [projectId+sequence], projectId, type, occurredAt
layouts: [projectId+nodeId], projectId, nodeId, updatedAt
```

Rules:

- create and mutation persistence use one Dexie transaction
- event sequences are strictly increasing per project
- project counts and status update in the same transaction as the event
- delete removes project, events, and layout rows in one transaction
- startup converts a stored `running` project to `interrupted` only while holding an available Web Lock, through a real `run.interrupted` event
- `navigator.storage.persist()` is requested after the first project creation
- export includes project metadata, ordered events, layouts, schema version, and a checksum manifest

## 6. State replay and verification

`replayEvents(events, targetSequence)` starts from an empty snapshot and applies ordered events with reducer version 1. It rejects gaps, duplicate sequence numbers, unknown event types, and invalid references.

The timeline uses the replayed snapshot, never a separately mutated copy. A selected event displays:

- the event envelope
- the object before the event, when applicable
- the object after the event
- the event and resulting state hashes
- the exact visual signal generated by the event

`verifyLedger(events)` recomputes each event hash, chain link, resulting state hash, and final snapshot. Export is blocked if verification fails.

## 7. Vector and graph insight model

### 7.1 Local vectors

`feature-hash-v1` tokenizes the node label and summary, hashes tokens and adjacent token pairs into 48 signed dimensions, applies term-frequency weights, and L2-normalizes the result. This is a deterministic lexical projection, not a neural embedding.

### 7.2 Gateway embeddings

When Gateway authentication exists, `POST /api/embed` calls AI SDK `embedMany` with `openai/text-embedding-3-small` or `GRAPHWAKE_EMBEDDING_MODEL`. The returned vector and exact model ID are committed through `node.updated` events. The local vector remains available for comparison.

### 7.3 Computed insights

The Insights panel exposes:

- degree centrality: `degree(node) / max(1, nodeCount - 1)`
- connected component: deterministic traversal and member IDs
- shortest path: breadth-first path plus traversed edge IDs
- betweenness centrality: Brandes algorithm on the visible unweighted graph
- cosine similarity: dot product divided by vector magnitudes

Each result includes method name, input object IDs, formula or algorithm, selected filters, sequence, and numeric result. Computation above 500 visible nodes moves to a worker or is deferred until requested.

## 8. Continuous run model

### 8.1 Lifecycle

```txt
draft -> running -> stopped
                 -> failed
                 -> interrupted after close when startup can prove no tab owns the run lock
stopped | interrupted | failed -> running on resume
```

### 8.2 Local engine

The deterministic engine derives seed concepts from the prompt, then adds typed questions, assertions, evidence requests, and explicit relations. It never fabricates source URLs. It yields one validated proposal every 280 ms and stops at the 120-node safety budget if the user has not stopped it.

### 8.3 Gateway engine

`POST /api/generate` accepts a bounded project summary and one batch request. It uses `streamText` with `Output.array` and the verified default model `openai/gpt-5.6-terra`, overridable through `GRAPHWAKE_MODEL`. Each fully validated element is returned as NDJSON.

The client:

1. starts one batch with an `AbortController`
2. parses and validates each NDJSON line
3. commits accepted proposals one at a time
4. requests embeddings for new nodes when available
5. starts the next bounded batch after the previous one completes
6. stops before another batch when the user presses Stop or a budget is reached

Limits:

- prompt: 1,200 characters
- purpose: 600 characters
- existing context sent to a batch: 80 nodes and 120 edges
- proposals per batch: 4 to 8
- node budget per project run: 120
- edge budget per project run: 480
- one active run per browser tab

The model receives no browser storage, secrets, external tools, HTML renderer, network fetcher, or write authority.

## 9. API routes

### `GET /api/runtime`

Returns whether Gateway authentication is configured, the selected mutation model, the selected embedding model, and limits. It never returns credentials.

### `POST /api/generate`

- parses JSON with Zod
- rejects oversized or malformed input with status 400
- returns status 503 with code `GATEWAY_UNAVAILABLE` when credentials are absent
- streams `MutationProposal` lines as `application/x-ndjson`
- passes `request.signal` to AI SDK for cancellation
- returns a typed terminal error line if generation fails after streaming begins

### `POST /api/embed`

- accepts 1 to 16 strings, each at most 2,000 characters
- returns model ID, dimensions, vectors, and token usage
- returns 503 when Gateway credentials are absent

Route handlers use the default Node.js runtime and `Cache-Control: no-store`.

## 10. Interface design

### 10.1 Design DNA

```txt
Audience: builders and researchers
Axes: neutral-cool, stark, focused, mixed geometry, scientific, reactive, expressive
Faces: Bricolage Grotesque / Bricolage Grotesque / IBM Plex Mono
Hue: seafoam mineral paper + carbon + ultramarine signal
Signature: causal wake, one finite light trace per committed edge event
```

Domain metaphors are a ship wake, graph paper, and specimen labels.

### 10.2 Desktop layout

```txt
| project rail | graph field and command line        | inspector |
|              |                                     |           |
|              | collapsible legend                 |           |
|              | event rail and replay control      |           |
```

- hidden 12-column grid: 2 columns rail, 7 columns graph, 3 columns inspector
- no floating card collection; planes are separated by alignment and one-pixel rules
- graph field uses a faint measured grid on seafoam mineral paper
- project rail can collapse to an icon and name strip
- inspector has Object, Evidence, Vector, and Insight tabs
- event rail is one dense chronological line, not a card carousel

At widths below 960 px, the rail and inspector become modal sheets over a full-width graph. At 375 px, the graph, run control, project switcher, inspector sheet, and event scrubber remain usable with 44 px touch targets.

### 10.3 Color tokens

```css
--paper: oklch(0.965 0.018 175);
--paper-deep: oklch(0.92 0.028 175);
--ink: oklch(0.205 0.018 205);
--ink-muted: oklch(0.48 0.025 205);
--signal: oklch(0.55 0.19 264);
--evidence: oklch(0.58 0.12 168);
--question: oklch(0.68 0.14 72);
--refute: oklch(0.58 0.19 28);
--hypothesis: oklch(0.62 0.13 320);
```

Long text meets AAA contrast on `--paper`. Relationship colors are always paired with shape or dash encoding.

### 10.4 Visual semantics

- node shape encodes node kind
- node fill encodes epistemic status
- node size encodes visible degree only when the Degree view is active
- edge dash encodes relation family
- edge width encodes stored confidence
- finite wake color encodes event kind
- wake direction follows source to target
- wake duration is 700 ms and does not encode latency
- opacity encodes event age only in a labeled time-window view
- layout proximity carries no default meaning

The minimized legend remains reachable from the graph toolbar and states the active mappings and caveats.

### 10.5 Interaction

- hover shows label, kind, relation count, confidence label, and last event
- click or keyboard selection pins the inspector
- `/` focuses search
- `N` opens manual node creation
- `E` opens relation creation after two nodes are selected
- Space starts or stops the current run when focus is not in a field
- Left and Right step through event history
- Escape closes sheets or clears transient selection

Motion uses one shared spring for button feedback and panel presence. The graph wake uses an imperative canvas overlay with `requestAnimationFrame`, tracks only active event IDs, and cancels on unmount. Reduced-motion mode replaces travel with a 180 ms source and target opacity acknowledgement.

## 11. Screens and states

### Project shelf

- empty: one sample preview and `Create your first graph`
- loading: exact shelf rows as skeletons
- error: storage error, recovery copy, retry, and export if data is readable
- populated: recent projects, status, counts, last update, rename, export, and delete

### Studio

- draft: prompt and purpose command line over an empty measured field
- running: stop control, event rate, current engine, budget, and live ledger
- stopped: resume control and replay enabled
- interrupted: explicit browser-close explanation and resume control
- failed: last accepted event preserved, typed error, retry, and local-engine fallback
- replay: graph is read-only, selected sequence is visible, and `Return to live` restores the latest snapshot

### Destructive actions

Delete requires the project name. The action reports exactly what local records will be removed. No undo is implied after the transaction succeeds.

## 12. Accessibility

- all controls use semantic buttons, labels, and dialogs
- searchable DOM node and relation lists provide a canvas-equivalent representation
- focus in the list highlights the graph object and graph selection focuses the inspector heading
- hover information has focus and click parity
- color is dual-encoded
- graph event announcements are rate-limited to one summary per second
- focus rings meet 3:1 contrast
- reduced motion is honored by MotionConfig and graph wake code
- canvas has an accessible name and points to the equivalent list

## 13. Error handling and security

- all user and model strings render as text, never HTML
- input and model output use strict Zod schemas with length and numeric limits
- model output has no command, URL fetch, filesystem, or database authority
- IDs come from application code
- unknown references and invalid sequences fail closed
- AbortError is a normal stop, not a failure
- 402, 429, and 503 Gateway responses become specific recovery copy
- IndexedDB quota and transaction failures preserve the in-memory event and stop the run before another mutation
- exports escape spreadsheet-leading characters in CSV views and use JSON as the canonical format
- `.env*` files stay ignored except `.env.example`

## 14. File boundaries

```txt
src/app/                      Next.js shell, metadata, manifest, API routes
src/components/shelf/         project list and creation flow
src/components/studio/        studio composition, controls, panels, timeline
src/components/graph/         Sigma renderer, adapters, wake overlay, accessible list
src/components/ui/            focused primitives owned by Graphwake
src/lib/domain/               types, schemas, reducer, event creation, replay, hashes
src/lib/insights/             vectors, graph metrics, explanations
src/lib/persistence/          Dexie schema, project repository, export
src/lib/runtime/              local generator, Gateway client, run controller
src/lib/visual/               Graphology projection, layout, visual encodings
src/test/                     test setup and factories
```

No component owns persistence rules, no route handler owns graph state, and no renderer decides semantic meaning.

## 15. Testing and verification

Test-first cycles cover:

- schema acceptance and rejection
- deterministic event and state hashes
- replay to exact sequences and invalid-ledger failures
- project create, persist, interrupt, delete, and export
- local vector determinism and cosine values
- centrality, components, shortest path, and betweenness fixtures
- proposal validation and temporary reference resolution
- local run stop and safety budgets
- NDJSON parsing, abort, and typed route failures
- shelf, create flow, inspector, legend, timeline, and delete interaction
- reduced-motion wake behavior

Final verification:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- browser flow at desktop and 375 px
- persisted reload and interrupted recovery
- real Gateway smoke test only if local credentials exist
- 1,000-node fixture pan, zoom, hover, and update trace
- design gate, security quick pass, accessibility scan, and artifact text scan

## 16. Open-source release

- MIT license
- public repository `karimbabasf/graphwake`
- README header built from the application visual system
- README covers what it is, how to run it, how to configure optional Gateway models, and how to test it
- `CONTRIBUTING.md` covers branch names, test-first changes, visual semantics, and the truth boundary
- `.env.example` contains names only, never credentials
- repository topics: knowledge-graph, context-graph, memory, provenance, embeddings, graph-visualization, nextjs, local-first
