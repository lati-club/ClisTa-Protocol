# Milestone 4: Protocol Forks

## Acceptance Criteria

ClisTa must preserve one reasoning line while allowing another to diverge.

The theorem is:

```text
alternative_reasoning = fork(parent_thread_state)
```

Given only:

```text
.clista/events.ndjson
```

ClisTa can reconstruct:

```text
parent reasoning state -> fork boundary -> inherited fork state -> divergent fork state
```

## Required Command

```text
clista thread fork --parent <threadId> --fork <forkThreadId> --title <title> --reason <reason> --through <eventId>
clista fork lineage --thread <forkThreadId>
```

## Required Event

- `ThreadForked`

## Required Projection

`clista state show --thread <forkThreadId>` must expose:

- parent thread ID
- fork thread ID
- inherited event boundary
- fork lineage
- changed assumptions
- divergent claims
- inherited parent state through the boundary
- fork-local events after the boundary

## Required Validation

ClisTa rejects fork logs when:

- the parent thread does not exist
- the fork thread ID is not unique
- the inherited event boundary does not exist
- the inherited event boundary is not in the parent thread
- the fork inherits from a future event
- a fork event mutates an inherited parent object directly
- fork lineage cannot be reconstructed from the append-only log

## Boundary

This is divergence only.

It does not add:

- merge semantics
- UI
- agents
- network behavior
- reputation
- graph database
- conflict resolution

## Theorem

Projection proves memory.

Validation proves protocol.

Governance proves legitimacy.

Outcomes prove learning from consequences.

Forks prove divergent reasoning without parent mutation.
