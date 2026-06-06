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
- `ParticipantDeclared`
- `ParticipantRoleAssigned`
- `ParticipantAuthorityGranted`
- `ParticipantAuthorityRevoked`
- `ContributionAttributed`
- `ContributionAttributionCorrected`
- `ContributionAttributionDisputed`
- `ContributionAttributionRevoked`
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

- participants and identity state
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
- active and revoked authorities
- attribution by contribution, participant, and source event
- provenance by contribution, source, and introducing event

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
- attribution source, participant, role, authority, and event-time provenance
- provenance source existence, source timing, transformation, and source hash consistency

## Required Integrity

```text
clista integrity verify
```

must explain whether an event log is tamper-evident and hash-linked.

```text
clista integrity verify --strict
```

must reject logs missing canonical protocol version, hash version, content hashes, or previous hashes after the genesis event.

## Required Continuity

```text
clista continuity export
clista continuity verify --packet <path>
clista continuity import --packet <path>
clista continuity summary --packet <path>
```

must transfer projected reasoning state across contexts without relying on the full conversation transcript.

A Continuity Packet must be integrity-gated and must preserve:

- current question
- current decision
- assumptions
- claims
- open objections
- governance state
- outcome state
- fork lineage
- merge state
- attribution state
- next action

## Required Identity

```text
clista participant declare
clista participant role assign
clista participant authority grant
clista participant authority revoke
clista identity show --participant <id>
```

must prove protocol-level participant identity, role, and active authority before authority-bearing reasoning actions are trusted.

Anti-pattern:

```text
vibes with hashes
```

A system that preserves artifacts with hashes but cannot prove who authored them, what authority they carried, or why their contributions should be trusted.

## Required Attribution

```text
clista attribution list
clista attribution show <contributionId>
clista attribution by-participant <participantId>
clista attribution verify
```

must trace reasoning contributions to participant, role, source event, provenance, and authority context at contribution event time.

Attribution is not reputation. It records who contributed a reasoning element; it does not score participant trustworthiness.

## Required Provenance

```text
clista provenance list
clista provenance show <contributionId>
clista provenance trace <contributionId>
clista provenance verify
```

must trace reasoning contributions to source lineage:

- source type
- source id
- introducing event
- transformation
- source hash when available
- source integrity status
- availability at contribution event time

The theorem is:

```text
trusted_contribution = verify(attribution + source_provenance)
```

Supported source types are:

- `event`
- `evidence`
- `import`
- `continuity_packet`
- `fork`
- `merge`
- `projection`
- `external_reference`

Supported transformations are:

- `asserted`
- `observed`
- `imported`
- `summarized`
- `inferred`
- `corrected`
- `disputed`
- `revoked`
- `merged`

Provenance is not truth ranking. It records where a contribution came from and how it entered state; it does not score sources, participants, agents, or models.
