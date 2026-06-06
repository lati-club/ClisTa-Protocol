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

## Required Validation

`clista validate` must reject invalid reasoning logs before they are treated as protocol state.

Validation checks:

- event envelope fields
- object references
- state transitions
- decision requirements
- objection resolution authority
- audit integrity
