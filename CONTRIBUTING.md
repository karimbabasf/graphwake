# Contributing to Graphwake

Graphwake accepts focused issues and pull requests. Keep changes inspectable and preserve the distinction between application lineage and claims about the outside world.

## Local setup

```bash
npm install
npm run dev
```

## Change process

1. Create a branch such as `feature/relation-filter` or `fix/replay-boundary`.
2. Add a failing test before changing behavior.
3. Implement the smallest coherent change.
4. Run `npm run check`.
5. Describe the observable behavior and verification evidence in the pull request.

## Graph rules

- Add typed relations through the domain schemas.
- Store graph mutations as events. Do not mutate a snapshot as a second source of truth.
- Treat similarity as a scored vector result, not proof of meaning or cause.
- Treat `causal-hypothesis` as an evidence-bearing claim, not a verified cause.
- Record a method, inputs, formula or algorithm, sequence, result, and caveat for computed insights.
- Use graph motion only for a real committed event or measured field.
- Keep layout coordinates outside the knowledge ledger.

## Test

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Security

Do not commit credentials, private source material, or `.env.local`. Model output is untrusted data and must pass the bounded Zod schemas before it reaches the reducer.
