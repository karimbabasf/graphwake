<p align="center">
  <img src="./public/graphwake-header.svg" alt="Graphwake, see knowledge change state" width="100%" />
</p>

# Graphwake

Graphwake is a local-first studio for building typed context, memory, and evidence graphs from one prompt. It records every accepted graph mutation in an append-only event ledger, reconstructs any prior state by replay, and exposes the method, inputs, formula, and caveat behind each computed insight.

- Run a deterministic local graph generator without an account or API key.
- Stream model-proposed mutations through Vercel AI Gateway when configured.
- Inspect objects, evidence, vectors, relation rationale, event hashes, and state hashes.
- Save projects in IndexedDB, replay their history, export verified JSON, and delete every local record.

Graphwake keeps application transitions, provenance, vector similarity, and causal hypotheses distinct. A model-stated reason is stored data, not hidden reasoning. A causal hypothesis is a claim, not proof.

## Run locally

Requirements: Node.js 20.19 or newer and npm.

```bash
git clone https://github.com/karimbabasf/graphwake.git
cd graphwake
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The local runner, manual editor, replay, insights, export, and persistence work with no environment variables.

## Optional AI Gateway

Copy the environment example and add your own Gateway key:

```bash
cp .env.example .env.local
```

```env
AI_GATEWAY_API_KEY=your_key_here
GRAPHWAKE_API_TOKEN=a_random_value_with_at_least_24_characters
GRAPHWAKE_MODEL=xai/grok-4.5
GRAPHWAKE_EMBEDDING_MODEL=openai/text-embedding-3-small
```

Create a project with the AI Gateway runner to use model-proposed graph batches. Enter `GRAPHWAKE_API_TOKEN` in the project form or the studio's Gateway access dialog. It stays in session storage and never enters the project ledger. The application validates proposals before writing them to IndexedDB. The Gateway key stays in the server environment.

For a public deployment, configure a Gateway spend limit and platform rate limit. Graphwake checks request origin, bounds request bytes and model output, and applies a per-instance request limit. A distributed deployment still needs a platform-level quota.

## Test

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Run the complete gate with `npm run check`.

Project data stays in the current browser profile. Export a project before clearing browser storage if you need to keep its ledger.

Runners execute only while the studio tab is open. After an unclean close, browsers with Web Locks record the abandoned run as interrupted on the next startup. Browsers without Web Locks leave that status untouched instead of guessing.

Licensed under the [MIT License](./LICENSE).
