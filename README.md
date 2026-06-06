# ClisTa Protocol

ClisTa is a protocol engine for accountable reasoning.

It does not preserve conversations as the primary asset. It preserves the reasoning state produced by conversations.

```text
Conversation is input.
Reasoning state is output.
```

## Core Loop

```text
Commit Evidence -> Pull Decision -> Track Audit
```

## Protocol Spine

- Append-only NDJSON event log.
- Event log as source of truth.
- Projected state derived from events.
- CLI-first protocol engine.

The critical command is:

```text
clista state show
```

If it can reconstruct the current reasoning state from only the append-only log, the protocol spine works.

The validity command is:

```text
clista validate
```

If it rejects invalid event logs with clear event-level errors, the protocol can govern reasoning state instead of merely projecting it.

The integrity command is:

```text
clista integrity verify
```

If it verifies canonical hashes, the event log can be trusted as history rather than just read as data.

For v0.6 chained logs, add `--strict` to require protocol versions, hash versions, and previous-hash links.

The continuity command is:

```text
clista continuity export --out continuity.json
```

If it produces a verifiable Continuity Packet, projected reasoning state can survive context loss without treating the transcript as memory.

The identity command is:

```text
clista identity show --participant par_troy
```

If it reconstructs roles, active authority, revoked authority, and authority history from the event log, portable reasoning stays accountable after it leaves its original context.

The attribution command is:

```text
clista attribution list
```

If it traces claims, assumptions, evidence, objections, decisions, outcomes, forks, merges, and governance reviews back to participants and event-time authority context, reasoning contributions are accountable without becoming reputation.

The provenance command is:

```text
clista provenance verify
```

If it verifies where each contribution came from, what transformation introduced it, and whether source lineage was available at contribution time, accountability becomes auditability without becoming scoring.

Anti-pattern:

```text
vibes with hashes
```

A system that hashes artifacts without proving who authored them, what authority they carried, or why their contributions should be trusted.

Provenance is not truth ranking. It records source lineage; it does not score sources, participants, or models.

## Repository Boundary

This repository is `clista-protocol`.

It is not `clista-app`, `clista-ui`, or `clista-platform`.

Do not build UI, agent orchestration, graph databases, governance portals, or platform features until the protocol spine works.
