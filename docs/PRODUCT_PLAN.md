# Graphwake product plan

Date: 2026-07-11

## Product

Graphwake is a local-first graph studio for seeing what changed, how it changed, and what evidence supports it.

The product teaches graph concepts by making them operable. A user creates a named project, describes its purpose in one prompt, watches typed graph mutations arrive, stops the run, replays any point in history, and inspects the basis of every visible insight.

## Audience

- builders learning context and memory systems
- researchers presenting graph evolution
- teams prototyping an evidence model before choosing graph infrastructure
- anyone who needs to explain a changing body of knowledge without hiding behind a node cloud

## Product principles

1. Show process, not mystique. Every visual signal maps to stored data or a computed event.
2. Separate categories. Similarity, support, contradiction, provenance, state transition, and causal hypothesis never share one vague edge type.
3. Make the first run free of setup. A deterministic local engine creates a useful graph without an API key.
4. Keep advanced detail one click away. The default screen stays calm; the inspector, ledger, vector panel, and legend expand when needed.
5. Prefer reconstruction over explanation theater. Replay and diff prove how Graphwake changed state. Model-written rationales are labeled as model statements.
6. Own the data. Projects live in the browser, export as versioned JSON, and delete locally.

## Primary flow

1. Land on a project shelf with one sample project and a single `New graph` action.
2. Enter a project name, purpose, and seed prompt.
3. Start with either the local engine or a configured AI model.
4. Watch nodes and links commit one event at a time. The timeline, counts, and inspector update with each event.
5. Hover for a concise definition. Click to pin the full inspector.
6. Stop the run. Scrub the event rail to reconstruct any previous state and view the exact change.
7. Open Insights to inspect degree, bridge score, connected components, vector method, cosine inputs, and result.
8. Resume, add a node or relationship manually, export, rename, or delete the project.

## Version 1 scope

### Included

- named local projects with create, rename, reopen, export, and delete
- status lifecycle: draft, running, stopped, interrupted, failed
- append-only typed event ledger
- deterministic state replay at any event sequence
- manual node and relationship creation
- prompt-driven continuous graph growth with stop and resume
- zero-key local generator
- optional AI generation through Vercel AI Gateway and AI SDK structured output
- WebGL graph rendering with event-driven wake pulses
- hover summary, pinned inspector, searchable equivalent list, and collapsible legend
- relation filters and neighborhood focus
- deterministic local text vectors with cosine similarity and explicit method labels
- graph metrics with formulas and input references
- IndexedDB persistence plus persistent-storage request
- versioned JSON export
- installable PWA manifest
- responsive desktop and compact tablet layout
- reduced-motion and keyboard paths

### Excluded from version 1

- real-world causal inference
- hidden chain-of-thought display
- remote collaboration or accounts
- background execution after the browser closes
- arbitrary web crawling or write-capable AI tools
- native desktop packaging
- hosted graph database
- 3D rendering

## Approach decision

### Chosen: local-first event-sourced PWA

This keeps setup to `npm install` and `npm run dev`, makes the sample and manual tools work offline, and gives replay a natural source of truth. AI is an optional bounded server route.

### Rejected for v1: desktop daemon

It would meet true run-after-quit behavior, but its service lifecycle, signing, Keychain integration, updates, and platform testing would dominate the first release.

### Rejected for v1: hosted graph backend

It would support collaboration and always-on work, but it would make accounts, infrastructure, and cost prerequisites for a project meant to teach and showcase the graph itself.

## Delivery branches

1. `research/foundations`: research, product plan, design specification, and implementation plan.
2. `feature/graph-core`: typed event model, reducer, replay, analytics, vectors, and persistence.
3. `feature/live-runtime`: local generator, AI mutation route, validation, stop, resume, and lifecycle.
4. `feature/studio-interface`: project shelf, graph canvas, inspector, ledger, legend, manual edits, and responsive states.
5. `release/open-source`: PWA assets, README, license, contributor setup, screenshots, audits, and release fixes.

Each branch is merged to `main` with its tests green. Public push happens only after the final main verification.

## Success criteria

- A clean clone reaches the sample graph with `npm install && npm run dev` and no credentials.
- One prompt starts visible graph growth within one second in local mode.
- Stop prevents the next batch and preserves every committed event.
- Reload restores the project, graph, positions, ledger, and selected latest state.
- Closing during a run restores the project as interrupted, never falsely running.
- A timeline position reconstructs the same state hash on repeated replay.
- Every animated pulse corresponds to one event ID visible in the ledger.
- Every computed insight names its method, inputs, and result.
- Similarity is labeled as local feature-hash cosine similarity, never semantic truth.
- Project delete removes its metadata and events from IndexedDB.
- Keyboard users can create, select, inspect, stop, replay, export, and delete.
- Reduced-motion mode removes travel while preserving state feedback.
- The test suite, typecheck, lint, production build, browser flow, and design gate pass on final main.

