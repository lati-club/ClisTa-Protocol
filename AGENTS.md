# ClisTa Agent Instructions

ClisTa is a protocol engine first.

Do not build UI, agents, graph DB, governance portal, or platform features until the protocol spine works.

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
