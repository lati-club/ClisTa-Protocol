# Milestone 6: Protocol Integrity

## Acceptance Criteria

ClisTa must verify that the event log history itself is trustworthy.

The theorem is:

```text
trustworthy_history = verify(event_log_integrity)
```

Given only:

```text
.clista/events.ndjson
```

ClisTa can reconstruct whether the log is canonical, hash-linked, and untampered.

## Required Commands

```text
clista integrity verify [--events <path>] [--strict]
clista export [--events <path>]
clista import --events <path> [--replace true]
```

## Required Event Integrity

Newly appended events include:

- `protocol_version`
- `hash_version`
- `content_hash`
- `previous_hash` after the first event

`content_hash` is computed from canonical event serialization.

`previous_hash` links each event to the content hash of the event before it.

## Required Validation

ClisTa rejects logs when:

- an event declares an unsupported protocol version
- an event declares an unsupported hash version
- an event has a malformed content hash
- an event has a malformed previous hash
- an event content hash does not match canonical event serialization
- a previous hash does not match the prior event content hash

Strict integrity verification additionally rejects logs when:

- events omit protocol version
- events omit hash version
- events omit content hash
- non-genesis events omit previous hash

## Migration Guardrails

Historical v0 logs remain readable.

Import refuses to overwrite an existing store unless `--replace true` is explicit.

Protocol exports include their schema version and integrity report.

Protocol import rejects unsupported export schemas.

## Boundary

This is local event-log integrity only.

It does not add:

- UI
- agents
- network behavior
- reputation
- graph database
- search
- analytics

## Theorem

Memory, validity, governance, outcomes, forks, and merges depend on a trustworthy event log.

Integrity proves that the history used by those layers has not silently changed.
