# ClisTa Protocol Constitution v0

## Mission

ClisTa exists to make reasoning accountable.

The protocol converts messy conversations into durable reasoning state that another human or agent can reload later.

## First Principles

- Conversations are not the asset.
- Reasoning state is the asset.
- Conversation is input.
- Reasoning state is output.
- The event log is the source of truth.
- Projected state is derived.

## Boundary

ClisTa is a protocol engine first.

It must not become a chat UI, agent platform, graph database, governance portal, or general AI feature surface before the protocol spine works.

## Core Loop

```text
Commit Evidence -> Pull Decision -> Track Audit
```

## Critical Test

```text
clista state show
```

If the command reconstructs current reasoning state from only the append-only log, the protocol spine is intact.

