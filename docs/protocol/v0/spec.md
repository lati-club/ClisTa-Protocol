# ClisTa Protocol v0 Spec

## Storage

ClisTa uses append-only NDJSON events.

The local event log lives at:

```text
.clista/events.ndjson
```

## Event Envelope

Every event uses the same envelope:

```text
event_id
event_type
thread_id
actor_id
timestamp
payload
```

`content_hash` may be included for integrity.

New integrity-aware events may also include:

```text
protocol_version
hash_version
previous_hash
content_hash
```

`content_hash` is computed from canonical event serialization.

`previous_hash` links an event to the prior event's `content_hash`.

## Source Of Truth

The event log is the source of truth.

Projected state is derived.

## Core Events

- `ThreadCreated`
- `ThreadForked`
- `ParticipantAdded`
- `EvidenceCommitted`
- `AssumptionDeclared`
- `ClaimCreated`
- `PositionTaken`
- `ObjectionRaised`
- `ObjectionResolved`
- `AlignmentCalculated`
- `DecisionRequestOpened`
- `ReviewSubmitted`
- `DecisionMerged`
- `MinorityReportFiled`
- `ExpectedOutcomeDeclared`
- `OutcomeAudited`
- `DecisionScored`
- `MergeRequestOpened`
- `MergeReviewSubmitted`
- `MergeConflictDeclared`
- `MergeConflictResolved`
- `MergeCompleted`

## Required Projection

`clista state show` must reconstruct:

- current proposal
- supporting evidence
- assumptions
- claims
- participant positions
- unresolved objections
- alignment snapshot
- decision status
- audit trail
- fork lineage
- merge state

## Required Validation

`clista validate` must reject invalid reasoning logs before they are treated as protocol state.

Validation checks:

- event envelope fields
- object references
- state transitions
- decision requirements
- objection resolution authority
- audit integrity
- event hash chain integrity
- protocol and hash schema versions

## Required Integrity

```text
clista integrity verify
```

must explain whether an event log is tamper-evident and hash-linked.

```text
clista integrity verify --strict
```

must reject logs missing canonical protocol version, hash version, content hashes, or previous hashes after the genesis event.
