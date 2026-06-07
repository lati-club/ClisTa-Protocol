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

## Schema And Validator Boundary

`schemas/clista-protocol.schema.json` describes exported protocol state. It is not the only strict contract for trusted event logs.

Some exported projections permit additional properties so derived metadata can remain forward compatible. The validator is stricter where protocol trust requires it.

The strict trust boundary is:

```text
clista validate
```

and the layer verifiers.

If an export schema shape is looser than validator behavior, validator behavior controls whether reasoning state is trusted.

## Layer Versioning

Layer protocol versions mark capability boundaries. Release and package versions mark repository snapshots.

For example, `delegationProtocolVersion: "0.19.0"` means the delegation layer is still at the M19 capability boundary. A cleanup release can advance the package or Git tag version without changing that layer boundary.

Change a layer version only when that layer's protocol behavior changes. Change the package or release version when the repository release changes.

M25 Protocol Release uses `release_protocol_version: "0.25.0"` in the release manifest. It does not add release records to projected reasoning state, so `schemas/clista-protocol.schema.json` remains the reasoning-state export schema and `schemas/clista-release-manifest.schema.json` describes the release artifact.

M26 Protocol Runtime Verification and M26.1 Runtime Usage Audit are repository/runtime verifiers. They do not add event types, projected release state, protocol authority, governance approval, amendment approval, or compatibility proof.

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
- `CapabilitySetDeclared`
- `CompatibilityCheckRecorded`
- `CompatibilityFailureRecorded`
- `CompatibilityDegradationRecorded`
- `CompatibilityAcceptanceRecorded`
- `InteroperabilityProfileDeclared`
- `SemanticMappingRecorded`
- `InteroperabilityCheckRecorded`
- `SemanticDegradationRecorded`
- `InteroperabilityFailureRecorded`
- `InteroperabilityAcceptanceRecorded`
- `FederationContextDeclared`
- `FederationPeerRecorded`
- `FederatedStateReferenceRecorded`
- `FederatedPacketVerified`
- `FederatedPacketRejected`
- `FederationBoundaryRecorded`
- `NegotiationRequested`
- `NegotiationConstraintDeclared`
- `NegotiationDifferenceRecorded`
- `NegotiationTermsProposed`
- `NegotiationTermsAccepted`
- `NegotiationTermsRejected`
- `NegotiationDegradationAccepted`
- `NegotiationFailureRecorded`
- `DelegationGranted`
- `DelegatedActionRecorded`
- `DelegationRevoked`
- `DelegationExpired`
- `DelegationViolationRecorded`
- `ExecutionStarted`
- `ExecutionCompleted`
- `ExecutionFailed`
- `ExecutionRolledBack`
- `ExecutionViolationRecorded`
- `OutcomeExpected`
- `OutcomeObserved`
- `OutcomeEvaluated`
- `OutcomeDisputed`
- `OutcomeViolationRecorded`
- `LearningSignalDerived`
- `LessonRecorded`
- `LearningDisputed`
- `LearningViolationRecorded`
- `ReviewRequired`
- `ReviewOpened`
- `ReviewCompleted`
- `ReviewDisputed`
- `ReviewViolationRecorded`
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
- portability, interoperability, federation, negotiation, delegation, execution, outcome, outcome-learning, review, and recovery status

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
- interoperability semantic preservation, event-type preservation, object-meaning preservation, and explicit-degradation boundaries
- federation packet verification, independent-context references, non-authority-import, and non-centralization boundaries
- negotiation request, constraint, difference, terms, non-authority-transfer, non-governance-merger, and explicit-downgrade boundaries
- delegation authority, accountable delegate, scoped action, and attribution boundaries
- execution authorization, actor accountability, scope, constraints, evidence, and explicit lifecycle boundaries
- outcome expectation, observation evidence, evaluation judgment, dispute, violation, and completion-not-success boundaries
- outcome-learning evaluated-outcome references, evidence links, actor accountability, and non-retroactive-justification boundaries
- review subject existence, actor accountability, required-review pending state, completion-as-reviewed, and review-not-approval boundaries
- recovery checkpoint verification, review dependency, quarantine visibility, repair evidence, restored-state hashes, and non-history-rewrite boundaries

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
- verification status for integrity, attribution, provenance, learning, adaptation, amendments, compatibility, interoperability, federation, negotiation, delegation, execution, outcome, and outcome learning
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
- interoperability state
- federation state
- negotiation state
- delegation state
- execution state
- protocol outcome state
- outcome learning state
- next action

Continuity must reject packets that trust transcript replay, trust model memory, skip failed verification, create authority, approve amendments, mutate governance, mutate imported state, or bypass validation.

## Required Outcome Learning

```text
clista outcome-learning derive --outcome <outcomeId> --lesson <lesson>
clista outcome-learning lesson --signal <learningSignalId> --lesson <lesson>
clista outcome-learning dispute --learning <learningId> --reason <reason>
clista outcome-learning violation --learning <learningId> --type <violationType> --reason <reason>
clista outcome-learning verify
```

must derive learning only from evaluated protocol outcomes.

The theorem is:

```text
protocol_outcome_learning = derive(adaptation_signal, from_evaluated_outcome)
```

The hard law is:

```text
learning != retroactive justification
```

Outcome learning may record lessons, confirmed assumptions, failed assumptions, future constraints, and amendment recommendations. It must preserve the original reasoning state, intended effect, authority, and governance history.

Outcome learning must reject unevaluated outcomes, evaluation-result rewrites, intended-effect rewrites, retroactive justification, universal truth claims, authority mutation, governance mutation, and attempts to turn failure into success after the fact.

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

## Required Interoperability

```text
clista interoperability check
clista interoperability show
clista interoperability verify
```

must verify that a compatible exchange preserves protocol meaning across contexts.

The theorem is:

```text
protocol_interoperability = preserve(meaning, across_compatible_contexts)
```

The hard law is:

```text
translation != reinterpretation
```

Interoperability must verify:

- exchange format is declared and supported
- required semantics are recognized
- optional unsupported semantics degrade explicitly
- event types preserve protocol meaning
- source event types are declared in the interoperability profile
- object meanings match for claims, assumptions, evidence, decisions, authority, attribution, provenance, learning signals, adaptation recommendations, amendments, continuity, compatibility, and interoperability
- compatibility failures prevent interoperability acceptance

Interoperability must reject packets that silently remap event meanings, flatten authority into metadata, flatten provenance into notes, treat learning signals as scores, treat adaptation recommendations as amendments, treat continuity packets as transcript summaries, accept unknown required semantics, or accept semantically degraded state as fully valid.

## Required Federation

```text
clista federation record
clista federation check
clista federation list
clista federation show <federationId>
clista federation verify
```

must verify external ClisTa state references without merging authority domains.

The theorem is:

```text
protocol_federation = align(independent_reasoning_states, shared_protocol_rules)
```

The hard law is:

```text
shared_state != shared_authority
```

Federation must verify:

- external packets pass continuity verification
- external packets pass compatibility verification
- external packets pass interoperability verification
- federated state references include packet hash, event-log hash, projection hash, state hash, and remote thread id
- federation status is `accepted`, `degraded`, `rejected`, or `pending`
- remote verification may inform local reasoning
- remote authority does not become local authority without explicit local governance
- remote amendments do not become local amendments automatically
- remote state does not mutate local governance or projected local state

Federation must reject records that create shared authority by default, import remote authority automatically, merge remote governance automatically, import amendments automatically, create automatic consensus, mutate local state from remote state, or treat federation as network consensus.

## Required Negotiation

```text
clista negotiation propose
clista negotiation check
clista negotiation list
clista negotiation show <negotiationId>
clista negotiation verify
```

must resolve exchange terms across independent contexts without transferring authority or merging governance.

The theorem is:

```text
protocol_negotiation = agree(exchange_terms, across_independent_contexts)
```

The hard law is:

```text
agreement != governance merger
```

Negotiation must verify:

- continuity, compatibility, interoperability, and federation results are declared
- capability differences are explicit
- amendment differences are explicit
- validation requirement differences are explicit
- interoperability profile differences are explicit
- proposed, accepted, degraded, and rejected terms remain auditable
- proposed terms have no authority or governance effect
- failed required gates are rejected rather than degraded
- degraded terms are explicit only for optional or tolerated limitations
- accepted terms may constrain exchange behavior
- accepted terms do not transfer authority
- accepted terms do not merge governance
- accepted terms do not adopt amendments automatically
- accepted terms do not mutate local state, validation rules, or remote state

Negotiation must reject records that transfer authority, merge governance, adopt amendments automatically, create automatic consensus, mutate local state from remote state, silently downgrade support, or treat negotiation acceptance as a protocol amendment.

## Required Delegation

```text
clista delegation grant
clista delegation record
clista delegation list
clista delegation show <delegationId>
clista delegation revoke
clista delegation verify
```

must authorize scoped action by an accountable actor without surrendering authority.

The theorem is:

```text
protocol_delegation = authorize(scoped_action, accountable_actor)
```

The hard law is:

```text
delegation != authority surrender
```

Delegation must verify:

- delegator authority exists at event time
- delegate actor resolves to a known accountable participant
- agent delegates are participants with `kind: agent`
- tool delegates are participants with `kind: tool` or `kind: system`
- context delegates are participants with `kind: system`
- delegated action is explicit
- action scope is explicit
- limits are explicit
- attribution is required
- delegated action references a known active grant
- delegated action actor_id matches the accountable delegate
- delegated action matches the granted delegate, action, and scope
- revoked, expired, or violated grants cannot silently continue

Delegation must reject records that surrender authority, transfer authority permanently, mutate governance, create unbounded action, omit attribution, create automatic consensus, create delegated consensus, or treat delegated action as underlying authority.

## Required Execution

```text
clista execution start
clista execution complete
clista execution fail
clista execution rollback
clista execution list
clista execution show <executionId>
clista execution verify
```

must record performed action under verified authorization, scope, constraints, evidence, and accountability.

The theorem is:

```text
protocol_execution = perform(authorized_action, under_verified_constraints)
```

The hard law is:

```text
execution != intent
```

Execution must verify:

- actor resolves to a known accountable participant
- actor_id matches the execution actor
- execution references an approved decision or active delegation
- delegated execution actor matches the accountable delegate
- delegated execution matches granted action and scope
- execution constraints preserve delegation limits or decision conditions
- completion includes evidence
- failure is explicit
- rollback references a prior completed or failed execution and includes evidence
- violations are projected, not silently ignored

Execution must reject records that create authority, imply consensus, approve amendments, merge governance, complete by assertion, silently complete, silently fail, silently rollback, or treat intent as performed action.

## Required Outcome

```text
clista outcome expect
clista outcome observe
clista outcome evaluate
clista outcome dispute
clista outcome list
clista outcome show <outcomeId>
clista outcome verify
```

must evaluate completed execution against intended effect using observed evidence, explicit judgment, and accountable attribution.

The theorem is:

```text
protocol_outcome = evaluate(execution_result, against_intended_effect)
```

The hard law is:

```text
completion != success
```

Outcome must verify:

- expected outcome references an existing execution
- expected outcome is declared before or at execution completion
- outcome actor resolves to a known accountable participant
- observation includes evidence
- evaluation references a completed execution
- evaluation compares observed effect against intended effect
- evaluation judgment is success, partial_success, failure, or inconclusive
- disputes and violations are projected
- outcome status remains distinct from evaluation judgment

Outcome must reject records that treat completion as success, assert success without evidence, rewrite intended effect retroactively, treat unmeasured impact as achieved impact, silently ignore unintended consequence, imply consensus, grant governance approval, approve amendments, or create authority.

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
