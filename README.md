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

## Repository Boundary

This repository is `clista-protocol`.

It is not `clista-app`, `clista-ui`, or `clista-platform`.

Do not build UI, agent orchestration, graph databases, governance portals, or platform features until the protocol spine works.

