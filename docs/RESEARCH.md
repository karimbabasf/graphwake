# Graphwake research brief

Date: 2026-07-11

## Research question

How can one app teach context graphs, memory graphs, vectors, embeddings, and state transitions while keeping every visible insight honest and inspectable?

## Definitions we will use

- A memory graph is the durable, versioned record of sources, observations, assertions, events, and derived artifacts.
- A context graph is a reproducible view selected from that memory for one task. It records the query, filters, scores, and selected items.
- A vector is an ordered numeric tuple. An embedding is a model-produced mapping into vector space.
- Similarity is a scored relationship inside a named vector space. It does not prove truth, support, lineage, or cause.
- Operational lineage explains how application state changed: `state[n + 1] = reducer(state[n], event[n + 1])`.
- A causal claim about the outside world needs declared assumptions and evidence. A polished model rationale is not causal proof or hidden model reasoning.

## What can be verified

Graphwake can verify facts about its own process:

- which event added, updated, or linked an item
- which actor, model, prompt, and reducer version produced the event
- which evidence references were attached
- the exact before and after graph states produced by replay
- deterministic graph metrics and local vector calculations
- the integrity of an exported event ledger through stable hashes

Graphwake cannot verify that a source is true, that an extracted assertion is correct, or that a model explanation exposes its internal reasoning. The UI must label these boundaries.

## Prior art and the gap

- Neo4j Bloom is strong at natural-language graph exploration, but it is tied to a database product and is not an event-ledger teaching tool.
- LangGraph Studio exposes workflow nodes and intermediate agent state, but its graph is control flow rather than a user-built knowledge graph.
- Graphiti models evolving temporal facts and provenance, but it expects external graph infrastructure and does not provide the intended studio UX.
- Microsoft GraphRAG is a useful extraction and evaluation reference, but its indexing model is batch-oriented rather than a continuous visual run.
- Understand Anything is close to the desired graph exploration surface, but it is domain-specific and does not center transition replay or an evidence ledger.
- MemoryGraph and Neo4j Agent Memory show demand for graph-native agent memory, while also showing common risks: stale facts, entity collapse, hidden provenance, and schema drift.

The open-source gap is a local-first studio that treats the event history as the source of truth, makes graph mutation visible as it happens, and separates computed insight from model assertion.

## Visualization findings

Sigma with Graphology is the best fit for v1:

- WebGL rendering supports thousands of nodes and edges.
- Graphology supplies an evented graph model, serialization, and ForceAtlas2 layout support.
- React can own the accessible shell, controls, inspector, and searchable table while Sigma owns the imperative render loop.
- A small canvas overlay can draw a finite event pulse without mutating React or graph state every frame.

Cytoscape.js has richer built-in graph analysis and styling, but edge-heavy canvas rendering is less suitable for the intended scale. React Flow is better for editable node diagrams, but DOM and SVG costs rise quickly for network views. Cosmos is a later fallback for extreme scale, not an MVP dependency.

Visual semantics:

- a finite source-to-target pulse means one committed graph event
- pulse color means event kind
- edge width means stored confidence or weight
- edge opacity means age inside the selected time window
- node halo means the node changed in the active event
- proximity is a layout result unless a similarity layout is explicitly selected

No line moves forever merely to make the canvas feel alive.

## Persistence and runtime findings

Three viable architectures were compared:

1. Local-first web/PWA with IndexedDB. Lowest setup cost, broadest access, and direct local persistence. Runs pause when the page closes.
2. Tauri desktop app with SQLite and a user-level daemon. Can continue after the UI quits, but adds service lifecycle, signing, credential, and update work.
3. Hosted backend with Postgres, pgvector, and workers. Best for collaboration and always-on runs, but adds accounts, deployment, cost, and operational burden.

Version 1 will use option 1. Every mutation is committed to IndexedDB immediately. A project that closes while running reopens as interrupted and can resume. The event and export schemas are designed so a daemon or hosted store can be added later without changing the visible model.

## AI generation findings

AI SDK structured output can stream validated array elements as they finish. Graphwake will request typed mutation proposals, validate every element, then commit accepted mutations one at a time. The browser repeats bounded batches until the user stops. This avoids one unbounded server request and gives the stop action a clear boundary.

The model receives no write-capable tools. It can only propose bounded graph mutations. Application code owns identifiers, referential checks, limits, deduplication, event hashes, and persistence. A deterministic local generator keeps the app usable without credentials and is labeled as such.

## Main blockers and responses

- Extraction hallucination: label model output as an assertion and keep its prompt and evidence references.
- Similarity presented as meaning: display the vector method, dimensions, metric, inputs, and exact score.
- Causal overclaim: keep `supports`, `derived-from`, `similar-to`, and `causal-hypothesis` as separate relations.
- Layout instability: persist coordinates and freeze physics while live mutations arrive.
- Graph hairballs: filter by neighborhood, relation, event window, and label level of detail.
- Provenance overload: reveal full event details on selection, not on every node label.
- Prompt injection and unsafe output: treat prompts and model output as data, validate strict schemas, render text only, and give the model no external tools.
- Browser eviction: request persistent storage where supported and expose JSON export.

## Primary sources

- [W3C PROV-O](https://www.w3.org/TR/prov-o/)
- [W3C SHACL](https://www.w3.org/TR/shacl/)
- [Sigma documentation](https://www.sigmajs.org/docs/)
- [Graphology events](https://graphology.github.io/events.html)
- [Graphology ForceAtlas2](https://graphology.github.io/standard-library/layout-forceatlas2.html)
- [AI SDK structured output](https://ai-sdk.dev/docs/reference/ai-sdk-core/output)
- [AI SDK tool and step semantics](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [MDN persistent storage](https://developer.mozilla.org/docs/Web/API/StorageManager/persist)
- [AWS event sourcing pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/event-sourcing.html)
- [OWASP improper LLM output handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/)
- [Neo4j Agent Memory](https://github.com/neo4j-labs/agent-memory)
- [Graphiti](https://github.com/getzep/graphiti)
- [LangGraph](https://github.com/langchain-ai/langgraph)
- [Microsoft GraphRAG](https://github.com/microsoft/graphrag)
- [Understand Anything](https://github.com/Egonex-AI/Understand-Anything)

