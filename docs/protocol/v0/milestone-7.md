# Milestone 7: Protocol Continuity

## Acceptance Criteria

ClisTa must make reasoning state resumable across chats, tools, models, and future protocol contexts.

The theorem is:

```text
reasoning_continuity = transfer(project(event_log))
```

Given an integrity-verified event log, ClisTa can export and import a Continuity Packet that preserves projected reasoning state without relying on the full conversation transcript.

## Core Principle

Alignment Before Action.

Protocol Law 001 still governs the boundary:

```text
Conversation is input.
Reasoning state is output.
```

Milestone 7 adds:

```text
Projected reasoning state is continuity.
```

## Required Commands

```text
clista continuity export [--events <path>] [--thread <threadId>] [--out <path>]
clista continuity verify --packet <path>
clista continuity import --packet <path> [--replace true]
clista continuity summary [--packet <path>]
```

## Continuity Packet

A ClisTa Continuity Packet is a portable JSON artifact with:

- packet identity
- protocol version
- schema version
- source thread ID
- event log hash
- projection hash
- state hash
- integrity verification metadata
- source events as audit material
- projected continuity state

The packet is not a transcript.

The packet is not a new source of protocol truth.

The packet is a verifiable transfer artifact for projected reasoning state.

## Required Continuity State

The packet must preserve:

- mission
- current question
- current request
- current decision
- assumptions
- active assumptions
- claims
- accepted claims
- open objections
- governance status
- outcome state
- fork lineage
- merge state
- attribution state
- integrity state
- thread status
- next action

## Required Verification

ClisTa rejects continuity packets when:

- `integrity_verified` is false
- source events fail integrity verification
- `event_log_hash` does not match source events
- `projection_hash` does not match recomputed projection
- `state_hash` does not match canonical continuity state
- `continuity_state` does not match recomputed projected state
- protocol version is unsupported
- schema version is unsupported
- packet type is unknown or future
- continuity state is missing or malformed
- strict integrity is claimed for a non-strict legacy log

## Legacy Compatibility

Historical v0 logs may produce continuity packets in compatibility mode when their content hashes verify but their event log lacks v0.6 strict hash-chain fields.

Compatibility mode is explicit:

```text
verification_mode = compatibility
strict_integrity_verified = false
```

Legacy uncertainty must not masquerade as strict continuity.

## Boundary

This milestone does not add:

- UI
- agents
- reputation
- networking
- distributed consensus
- graph database
- search
- identity
- signatures

## Theorem

Milestone 6 proved:

```text
trustworthy_history = verify(event_log_integrity)
```

Milestone 7 proves:

```text
reasoning_continuity = transfer(project(event_log))
```

The bridge is integrity-gated projected state.
