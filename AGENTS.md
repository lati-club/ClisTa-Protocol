# ClisTa Agent Instructions

ClisTa is a protocol engine first.

Do not build UI, agents, graph DB, governance portal, or platform features until the protocol spine works.

## Scope Freeze (until the EXTERNAL-RUNS gate)

The spine is frozen until the EXTERNAL-RUNS gate is decided (`pack/GATES.md`: ≥5 external
runs by 2026-09-07, or the productization claim dies on the record).

```text
No new verifier layers until 5 external runs exist.
```

- Every layer is permanent deterministic surface area. Once shipped, `same events -> same
  state` must hold for it forever. Do not add a layer before the claim it would serve is
  tested by external runs.
- Frozen-but-supported layers: amendment, adaptation, learning, negotiation. These are
  platform-shaped concerns already wearing protocol clothes. Keep their verifiers passing and
  `trusted:false`; do NOT expand their event families or rules, and do NOT remove them
  (removal breaks determinism for any log that used them).
- Always in scope: bugfixes, docs, tests, the debate pack, and anything that lowers the cost
  of an external run materializing. New deterministic layers are not, until the runs exist.

This rule lifts when the gate lifts. See `CONTRIBUTING.md` and the README "Scope freeze"
boundary.

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
