# ClisTa Agent Instructions

ClisTa is a protocol engine first.

The protocol spine is proven: `events -> projector -> validator -> cli`, exercised end-to-end by the test suite and a clean-room replay. Every milestone since extends that spine with one protocol property at a time — governance reviews, federation, continuity, recovery, attribution, and the rest are modeled as events, projections, and validations, never as product surfaces.

The boundary still holds: do not build UI, hosted platform, graph DB, governance portal, or agent runtime. A module named `governance.js` records governance *as events*; it is not a portal. `federation.js` is protocol interop, not a platform.

## Verification

Verification is handled through the agent.

The agent runs replays (`npm run replay`), full test suites, `clista validate`, `clista state show`, `clista decision summary`, and determinism checks directly against event logs. These agent-executed checks are sufficient to unblock and advance development.

No external human verification gate is required. External debate-pack runs (in `pack/`) remain available as an optional tool for broader credibility but do not block progress.

## Core Loop

```text
Commit Evidence -> Pull Decision -> Track Audit
```

## Storage

Use append-only NDJSON events.

The event log is the source of truth. Projected state is derived.

Every event must use the shared envelope:

```text
event_id
event_type
thread_id
actor_id
timestamp
payload
```

`content_hash` may be included for integrity.

## Goal

A messy reasoning conversation becomes durable structured state that another human or agent can reload later.

## Repository Pattern

```text
docs define the protocol
schemas define the objects
events record the truth
validator rejects invalid truth
projector derives current state
cli exposes the protocol
tests prove the theorem
```

Concrete structure:

```text
.clista/events.ndjson          canonical origin thread log

AGENTS.md                     guardrails for Codex
README.md                     mission + critical commands

docs/protocol/v0/
  constitution.md
  north-star.md
  protocol-law-001.md
  core-objects.md
  governance.md
  spec.md
  milestone-0.md
  milestone-1.md

schemas/
  clista-protocol.schema.json

src/
  events.js                   create/read append-only events
  projector.js                event log -> reasoning state
  validator.js                invalid reasoning fails loudly
  cli.js                      clista commands

test/
  projector.test.js           proves memory/projection
  validator.test.js           proves validity/governance

examples/first-test-thread/
  events.ndjson
```

## Build Rhythm

```text
1. Define protocol rule in docs
2. Reflect it in schema
3. Add event support if needed
4. Project it in projector.js
5. Validate it in validator.js
6. Expose it in cli.js
7. Prove it with tests
8. npm test
9. Commit + tag
```

## Invariant

```text
.clista/events.ndjson is source of truth.
Projected state is derived.
Validation happens before trusted projection.
```

## Milestone Pattern

```text
Milestone 0:
Projection proves memory.

Milestone 1:
Validation proves protocol.

Next milestone:
Stay narrow. Prove one protocol property, not a product feature.
```

## Protocol Law 001

Conversations are not the asset. Reasoning state is the asset.

Conversation is input. Reasoning state is output.

## Critical Test

```text
clista state show
```

If this can reconstruct the current reasoning state from only the append-only log, the protocol spine is working.

## Validity Test

```text
clista validate
```

Invalid reasoning must fail loudly with `event_id` and `reason`.