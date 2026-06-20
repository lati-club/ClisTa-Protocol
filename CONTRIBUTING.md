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

## Recording development as a ClisTa thread (dogfooding)

ClisTa is its own user: significant development decisions are recorded into the live self-attestation chain, through the CLI, never by hand-editing the log.

Two event logs exist — do not conflate them:

- `.clista/events.ndjson` is a **frozen test fixture** (the original clean scenario). Tests assert exact projected counts against it (`test/projector.test.js`). **Never append to it** — you will drift those counts and break the suite.
- `examples/clista-protocol-attestation.ndjson` is the **live chain** (`thd_thread_0001`). All live recording goes here. No test pins its size.

Convention: extend the single existing thread — do not open a new thread or a new `DecisionRecord` per milestone (the original architecture decision already merged; milestones accumulate under it). Record each milestone as:

- `EvidenceCommitted` — one per milestone. Put any source URL in the `source` field, **never** in `artifactIds`.
- `ClaimCreated` — its hard law, linked to the evidence via `--evidence`.
- `ObjectionRaised --status resolved --resolution …` — for each real design tension the milestone settled. This is where the surviving-objection value lives: record the path *not* taken and why.
- `PositionTaken --participant Author --stance support`.

The default actor for these verbs is `Author` (`par_author`); `appendParticipant` is idempotent, so re-declaring it is a no-op.

Mechanics: the CLI writes to `<cwd>/.clista/events.ndjson` and ignores `CLISTA_STORE` for writes. To extend the standalone chain safely, run the CLI from a scratch directory seeded with the chain, validate, then copy back:

```sh
TMP=$(mktemp -d)
( cd "$TMP" && node "$REPO/src/cli.js" init )
cp examples/clista-protocol-attestation.ndjson "$TMP/.clista/events.ndjson"
# run evidence/claim/objection/position verbs with cwd="$TMP", e.g.:
( cd "$TMP" && node "$REPO/src/cli.js" evidence commit \
    --thread thd_thread_0001 --id evd_mNN_short_slug \
    --source "https://github.com/lati-club/ClisTa-Protocol/commit/<sha>" \
    --finding "…" )
( cd "$TMP" && node "$REPO/src/cli.js" validate )   # { valid: true, errors: [] }
cp "$TMP/.clista/events.ndjson" examples/clista-protocol-attestation.ndjson
```

Then bump the chain's event count in `README.md` and re-run `npm test` + `npm run replay`.

## License

By contributing you agree your code is licensed under Apache-2.0 and your documentation under CC BY 4.0, matching the repository's existing terms (`LICENSE`, `NOTICE`).