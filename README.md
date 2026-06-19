# ClisTa Protocol

Here's a yes — now trace its shape.

A normal decision system records:

```text
approved / rejected
```

ClisTa records an accountable decision state:

- evidence carried into the decision
- assumptions that shaped it
- objections that survived approval
- minority reports
- authority trails
- provenance traces
- bounded scope and verification state

In the bundled scenario, a team approves an AI support-assistant beta. The approval is not a
boolean. It is a yes with its accountability structure fused on: 4 evidence items, 2
assumptions, 3 claims, a privacy objection that survived the yes, 2 governance reviews, a
minority report, a provenance trace, authority context — and a scope *narrower than the
question asked*: redacted sample tickets only.

That is the product value: ClisTa does not just record that a decision was made. It records
the shape that made the decision accountable — and anyone holding the event log can
reconstruct that shape.

```text
conversation -> event log -> projection -> verification -> accountable state
```

Operating law: **conversation is input; reasoning state is output.**

## Verification through the agent

Verification is handled through the agent. The agent can directly execute replays, full
validation, state reconstruction (`clista state show`), decision summaries, continuity checks,
and determinism verification on any event log.

External debate-pack runs (in `pack/`) are still available as an optional tool if you want to
apply the pattern to a real decision in your own context, but they are no longer a
requirement or blocker for development.

Everything below is the protocol tour — what the engine is, and how to verify it yourself.

## Try It in 30 Seconds

Prerequisites: Node.js >= 18, plus Python 3 (used only to re-ingest the session). Nothing to install — the engine itself has zero npm dependencies.

```sh
git clone https://github.com/lati-club/ClisTa-Protocol.git
cd clista-protocol
npm run replay
```

This reproduces the bundled agent-session example in a clean room and verifies it end to
end: it re-ingests a session into a canonical event log, confirms the result is
byte-identical to the committed one, validates it against the engine, and prints the
decision answer view — *what was decided, why, who dissented, what should happen next*. It
ends with `Clean-room replay PASSED`. No server, no account, no setup — the event log is the
source of truth.

## Quickstart

Prerequisite: Node.js >= 18.

```sh
git clone https://github.com/lati-club/ClisTa-Protocol.git
cd clista-protocol
npm install
npm run clista -- help
```

The CLI is the main interface:

```sh
npm run clista -- help
npm run clista -- state show --events examples/scenario-demo/events.ndjson
npm run clista -- validate --events examples/scenario-demo/events.ndjson
npm run clista -- decision summary --events examples/scenario-demo/events.ndjson
```

See `docs/quickstart.md` for more.

## Core Idea

The event log is the source of truth. Everything else is derived.

- `clista validate` checks structural and protocol rules.
- `clista state show` reconstructs the current reasoning state.
- `clista decision summary` surfaces the concise "answer view": what was decided, why, who dissented, what next.
- Replays (`npm run replay`) prove that the same events always produce the same state, even in a clean room.

## Scope freeze note (updated)

The previous EXTERNAL-RUNS gate has been removed. Development is no longer stalled waiting for external human verification. Agent verification (replays, tests, and CLI commands) is sufficient.

The debate pack in `pack/` is retained for anyone who wants to use the pattern voluntarily.

## Worked example — a sample Challenge Record (`pilot-dryrun/`)

`pilot-dryrun/` is a full dress rehearsal of one application of the debate pack: the engine,
unchanged, used to produce a sample *Challenge Record* for a model-risk-management deployment
decision (the public Epic Sepsis Model case). It adapts the pack to MRM roles
(`pilot-dryrun/pack-mrm/`), runs five sealed review sessions as ClisTa event logs that each
`validate` and replay, and aggregates them into a 9-section Challenge Record with a verification
bundle (`pilot-dryrun/verification.md`, runnable cold). No new protocol code or layers — it
exercises the spine.

It is a **sample against public sources, not advice, and not productization evidence**:
`trusted: false` throughout.

## License

Code is licensed under Apache-2.0 (see `LICENSE`). Documentation and the debate prompt pack
are licensed under CC BY 4.0. Attribution: lati-cooki.

## Running Example: Governing Octopus CSV CLI Build with ClisTa + ThreadHub

This is the live, operationalized example of the full integration (as of 2026-06-12):

- Octopus runs the CSV CLI arms (parsing, stats, CLI integration + error handling).
- ThreadHub stores the execution signals (cascade-blocks → ObjectionRaised) in `octo-build`.
- ClisTa turns them into accountable governance in a dedicated ThreadHub thread `clista-csv-cli-build-v4` (and the clean event log `examples/clista-csv-cli-build.ndjson`). Models the build arms as `DelegationGranted` → delegation-authorized `ExecutionStarted`, with the `DecisionMerged` last (governance ratifies after review, integrating 4 live cascade-blocks incl. the error-handling arm).

Key artifacts:
- Clean combined log — **25 events, validates clean** (`node src/cli.js validate`, exit 0) and projects a full `clista.threadState.v0`.
- N2 (resume without replay): the log is hash-chained.
- Cross-links and attribution preserved.

### Quick Exploration (from clista-protocol root)

```sh
node src/cli.js validate --events examples/clista-csv-cli-build.ndjson
node src/cli.js state show --thread thd_csv_cli_build_consensus_mqa0yqno_95493e23 --events examples/clista-csv-cli-build.ndjson
node src/cli.js attribution list --events examples/clista-csv-cli-build.ndjson
node src/cli.js provenance trace --contribution evd_live_p2 --events examples/clista-csv-cli-build.ndjson
```

See `docs/clista-csv-cli-build.md` (in the ThreadHub repo) for full details.

This example is the reference for "ClisTa as the consensus layer over execution via a verifiable substrate." The clean log keeps the demo pollution-free.