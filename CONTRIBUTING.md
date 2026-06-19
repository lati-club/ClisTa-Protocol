# Contributing to ClisTa Protocol

Thank you for considering a contribution. ClisTa is a protocol engine first — an event-sourced decision-accountability spine, not a platform. Read `README.md`, `AGENTS.md`, and `docs/protocol/v0/` before opening a PR.

## Verification through the agent

Verification is performed through the agent.

The agent executes replays (`npm run replay`), full test suites (`npm test`), `clista validate`, `clista state show`, `clista decision summary`, and determinism/continuity checks directly on event logs. These agent-run verifications are sufficient to advance development.

External debate-pack runs remain available as an optional tool for broader credibility but are no longer a blocking requirement.

## Focus

The protocol spine (events → projector → validator → cli) remains the focus. Agent-executed verification is the primary method for confirming correctness and determinism.

Development is no longer blocked by external human verification requirements.

## Invariants every change must preserve

- `trusted: false` stays the default everywhere. Verification of structure is never endorsement of content.
- Determinism: the same events must always produce the same projected state. Never introduce wall-clock time, randomness, or environment-dependent output into projection.
- No new runtime dependencies in the engine.
- All existing commands still exit 0 on a fresh clone.

## Checks before you open a PR

```sh
npm test            # the JS test suite must pass
npm run replay      # must print "Clean-room replay PASSED" (byte-identical)
```

Follow the build rhythm in `AGENTS.md` (docs → schema → events → projector → validator → cli → tests). Stay narrow: prove one protocol property per change, not a product feature.

## License

By contributing you agree your code is licensed under Apache-2.0 and your documentation under CC BY 4.0, matching the repository's existing terms (`LICENSE`, `NOTICE`).