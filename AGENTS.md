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

## Protocol Law 001

Conversations are not the asset. Reasoning state is the asset.

Conversation is input. Reasoning state is output.

## Critical Test

```text
clista state show
```

If this can reconstruct the current reasoning state from only the append-only log, the protocol spine is working.
