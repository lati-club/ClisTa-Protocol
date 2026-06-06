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
- `LearningSignalRecorded`
- `PatternObservationRecorded`
- `OutcomeReviewRecorded`
- `LearningRecommendationRecorded`
- `AdaptationReviewRecorded`
- `GovernanceReviewRecommended`
- `EvidenceRequirementReviewRecommended`
- `RevisitTriggerReviewRecommended`
- `DecisionGateReviewRecommended`
- `ProtocolAmendmentProposed`
- `ProtocolAmendmentReviewed`
- `ProtocolAmendmentApproved`
- `ProtocolAmendmentRejected`
- `ProtocolAmendmentSuperseded`
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
- pattern-level learning signals from outcome evidence
- governance adaptation recommendations from learning signals
- explicit protocol amendments and amendment history

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
- learning references, uncertainty, non-scoring, and non-authority-mutation boundaries
- adaptation references, uncertainty, non-scoring, and non-governance-mutation boundaries
- amendment references, approval authority, non-implicit-mutation, and non-retroactive boundaries
- compatibility capability support, verification-layer support, active-amendment support, and fail-closed boundaries

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
clista continuity verify [--packet <path>]
clista continuity import <path>
clista continuity resume [--packet <path>]
clista continuity show [--packet <path>]
clista continuity summary --packet <path>
```

must transfer projected reasoning state across contexts without relying on the full conversation transcript.

The theorem is:

```text
reasoning_continuity = resume(project(event_log), verification_state)
```

The hard law is:

```text
context transfer != memory trust
```

A Continuity Packet must be integrity-gated and must preserve:

- protocol version
- milestone capability set
- event log hash
- projection hash
- state hash
- resume status: `verified`, `degraded`, or `rejected`
- verification status for integrity, attribution, provenance, learning, adaptation, amendments, and compatibility
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
- provenance state
- learning state
- adaptation state
- amendment state
- compatibility state
- next action

Continuity must reject packets that trust transcript replay, trust model memory, skip failed verification, create authority, approve amendments, mutate governance, mutate imported state, or bypass validation.

## Required Compatibility

```text
clista compatibility check
clista compatibility show
clista compatibility verify
```

must verify that the receiving protocol context can safely resume a continuity packet.

The theorem is:

```text
protocol_compatibility = verify(capability_set, amendment_state, validation_requirements)
```

The hard law is:

```text
unsupported_state != valid_state
```

Compatibility must verify:

- packet protocol version is declared and supported
- local protocol version is declared
- required capabilities are recognized
- required verification layers are supported
- active amendments are explicitly supported by the receiver
- optional unsupported capabilities degrade explicitly
- incompatible resume does not project as valid
- unknown required capability fails closed

Compatibility must reject packets that silently downgrade verification, ignore unsupported amendments, accept unknown required capabilities, treat partial compatibility as full validity, mutate imported state to fit local capabilities, or treat compatibility as governance approval.

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

## Required Learning

```text
clista learning review
clista learning list
clista learning show <learningId>
clista learning verify
```

must derive pattern-level learning signals from outcome evidence.

The theorem is:

```text
protocol_learning = update(reasoning_patterns, outcome_evidence)
```

The hard law is:

```text
learning != reputation
```

Learning may review:

- expected outcomes
- actual outcomes
- decision results
- assumption accuracy
- claim support or failure
- evidence sufficiency
- objection validity
- governance review auditability
- merge and fork lineage
- provenance completeness
- revisit triggers

Learning outputs must remain pattern-level:

Good:

- `assumption_with_evidence_provenance_failed`
- `claims_supported_failed_decision`
- `governance_reviews_documented_rationale`
- `failed_outcome_requires_revisit`

Invalid:

- participant reputation
- participant scores
- source scores
- model rankings
- agent rankings
- automatic authority changes

Learning recommendations may suggest future governance review. They must not change authority automatically.

## Required Adaptation

```text
clista adaptation review
clista adaptation list
clista adaptation show <adaptationId>
clista adaptation verify
```

must recommend governance review from learning signals.

The theorem is:

```text
governance_adaptation = recommend(governance_review, learning_signals)
```

The hard law is:

```text
adaptation != governance mutation
```

Adaptation may recommend review of:

- evidence requirements
- revisit triggers
- decision gates
- governance audit requirements
- outcome windows
- provenance completeness requirements
- objection-resolution requirements

Adaptation must not:

- automatically change authority
- automatically change decision rules
- automatically modify governance thresholds
- promote or demote participants
- trust or distrust sources
- prefer models or agents

Actual governance changes remain explicit authorized governance events.

## Required Amendments

```text
clista amendment propose
clista amendment list
clista amendment show <amendmentId>
clista amendment verify
```

must record explicit protocol changes through authorized governance action.

The theorem is:

```text
authorized_protocol_change = approve(amendment, governance_authority)
```

The hard law is:

```text
recommendation != amendment
```

Amendments may propose changes to:

- protocol rules
- governance requirements
- evidence thresholds
- revisit triggers
- decision gates
- schemas
- validation policies
- interpretive guidance

Amendments may link to:

- adaptation recommendations
- learning signals
- source events
- rationale and review history

Amendments must not:

- activate automatically from learning
- activate automatically from adaptation
- change active protocol state without approval
- mutate hidden policy
- rewrite old event validity
- change authority without governance validation

Approval, rejection, and supersession require active governance authority.

Rejected amendments have no active effect.

Superseded amendments preserve history.

Approved amendments affect future validation or governance behavior unless explicitly marked as interpretive guidance.
