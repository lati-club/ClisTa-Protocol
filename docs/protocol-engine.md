# ClisTa Protocol Engine

This project is intentionally protocol-first.

ClisTa is not an agent platform, chat UI, graph database, or governance portal yet. The MVP proves one thing:

```text
A messy reasoning conversation can become durable structured state
that another human or agent can reload later.
```

## Layers

1. Append-only NDJSON event log
2. Deterministic state projection
3. Validation and rejection
4. Governance and legitimacy
5. Outcomes and learning
6. Forks and merges
7. Local event-log integrity
8. Protocol identity
9. Protocol attribution
10. Protocol provenance
11. Protocol learning
12. Protocol adaptation
13. Protocol amendments
14. Protocol continuity packets
15. Protocol compatibility
16. Protocol interoperability
17. Protocol federation
18. Protocol negotiation
19. Protocol delegation
19.1. Delegation actor boundary
20. Protocol execution
21. Protocol outcome
22. Protocol learning from outcomes
23. Protocol review
24. Protocol recovery
25. Protocol release
26. Protocol runtime verification

The compressed primitive map for M0-M25 is:

```text
docs/protocol/v0/primitive-map.md
```

Layer protocol versions mark capability boundaries. Release and package versions mark repository snapshots. A cleanup release may advance while unchanged layer protocol versions remain at the milestone that introduced them.

## Protocol Objects

The protocol core defines:

- `evidence`
- `participant`
- `participantRole`
- `participantAuthority`
- `contributionAttribution`
- `attributionCorrection`
- `attributionDispute`
- `attributionRevocation`
- `assumption`
- `claim`
- `position`
- `objection`
- `decisionRequest`
- `review`
- `decisionRecord`
- `minorityReport`
- `mergeRequest`
- `mergeReview`
- `mergeConflict`
- `mergeConflictResolution`
- `mergeCompletion`
- `expectedOutcome`
- `outcomeAudit`
- `decisionScore`
- `continuityPacket`
- `compatibilityContext`
- `interoperabilityProfile`
- `federationContext`
- `federatedStateReference`
- `negotiationRequest`
- `negotiationConstraint`
- `negotiationDifference`
- `negotiationTerms`
- `negotiationFailure`
- `delegationGrant`
- `delegatedAction`
- `executionRecord`
- `outcomeRecord`
- `outcomeDispute`
- `outcomeViolation`
- `outcomeLearningSignal`
- `outcomeLesson`
- `outcomeLearningDispute`
- `outcomeLearningViolation`
- `protocolReview`
- `protocolReviewCompletion`
- `protocolReviewDispute`
- `protocolReviewViolation`
- `recoveryRequest`
- `recoveryPlan`
- `recoveryQuarantine`
- `recoveryApplication`
- `recoveryVerification`
- `recoveryViolation`
- `releaseManifest`

See `schemas/clista-protocol.schema.json`.

M25 release manifests are described by `schemas/clista-release-manifest.schema.json` because release verification is a repository artifact boundary rather than projected reasoning state.

## Event Log

Every protocol action is stored as an immutable NDJSON event.

Every event shares the same envelope:

```text
event_id
event_type
thread_id
actor_id
timestamp
payload
```

`payload` carries the protocol object for that action. The envelope stays stable as the object model grows.

Integrity-aware events may also include:

```text
protocol_version
hash_version
previous_hash
content_hash
```

Supported events:

- `AssumptionDeclared`
- `EvidenceCommitted`
- `ParticipantDeclared`
- `ParticipantRoleAssigned`
- `ParticipantAuthorityGranted`
- `ParticipantAuthorityRevoked`
- `ContributionAttributed`
- `ContributionAttributionCorrected`
- `ContributionAttributionDisputed`
- `ContributionAttributionRevoked`
- `ThreadForked`
- `ClaimCreated`
- `PositionTaken`
- `ObjectionRaised`
- `ObjectionResolved`
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
- `RecoveryRequested`
- `RecoveryPlanCreated`
- `RecoveryQuarantined`
- `RecoveryApplied`
- `RecoveryVerified`
- `RecoveryViolationRecorded`

M25 release manifests are repository artifacts, not event-log records. They do not add release approval events.

M26 runtime verification is a local artifact/runtime check. It does not add event-log records.

The local store lives at:

```text
.clista/events.ndjson
```

## CLI

For the fresh-user workflow, start with:

```text
docs/quickstart.md
```

```text
npm run clista -- init
npm run clista -- participant declare --name "Troy" --id par_troy
npm run clista -- thread create --id thd_example --actor par_troy --title "ClisTa MVP protocol shape" --question "Should ClisTa MVP begin as a local-first JSON protocol before UI?"
npm run clista -- participant authority grant --participant par_troy --authority decision_owner --scope thread --thread thd_example
npm run clista -- thread fork --parent thd_example --fork thd_example_alt --title "Alternative protocol shape" --reason "Test an alternate assumption." --through evt_example
npm run clista -- evidence commit --thread thd_example --source "Research" --finding "Protocol-first state can be reloaded."
npm run clista -- claim create --thread thd_example --text "ClisTa should start protocol-first." --evidence evd_example
npm run clista -- position take --thread thd_example --participant "Troy" --stance support
npm run clista -- objection raise --thread thd_example --participant "Dissent Agent" --target clm_example --text "The schema may be too broad."
npm run clista -- decision open --thread thd_example --proposal "Build the protocol engine first."
npm run clista -- decision eligibility --request drq_example
npm run clista -- review submit --thread thd_example --request drq_example --reviewer "Troy" --status approve_with_conditions
npm run clista -- decision merge --thread thd_example --request drq_example --decider "Troy"
npm run clista -- outcome expect --thread thd_example --decision dcr_example --metric revenue_growth --operator ">" --target 0.15 --review-date 2027-03-01
npm run clista -- outcome audit --thread thd_example --expected exo_example --actual 0.08 --result failed --summary "Revenue growth missed target." --auditor "Troy"
npm run clista -- decision score --thread thd_example --decision dcr_example --score 0.4 --status failed --rationale "The expected outcome was not met." --audits out_example
npm run clista -- execution start --delegation dlg_example --action verify --scope thread:thd_example --constraint "Verify only the delegated execution scope"
npm run clista -- execution complete --execution exe_example --evidence "Verification completed with replay evidence."
npm run clista -- outcome expect --execution exe_example --expected-effect "Remote packet accepted under strict verification."
npm run clista -- outcome observe --outcome oco_example --observed-effect "Remote packet accepted under strict verification." --evidence "Strict verification output matched expected result."
npm run clista -- outcome evaluate --outcome oco_example --result success --comparison "Observed effect satisfied expected effect." --evidence "Outcome evidence reviewed."
npm run clista -- outcome-learning derive --outcome oco_example --lesson "Strict verification evidence predicted packet acceptance."
npm run clista -- outcome-learning lesson --signal ols_example --lesson "Require strict verification evidence on similar packet acceptance."
npm run clista -- review require --thread thd_example --subject ols_example --subject-type outcome_learning_signal --trigger outcome_learning_dispute --reason "Learning signal requires review before reuse."
npm run clista -- review open --review prv_example
npm run clista -- review complete --review prv_example --summary "Signal was reviewed without approving a governance change."
npm run clista -- recovery request --thread thd_example --subject evt_bad --subject-type invalid_event --reason "Event failed validation and needs reviewed recovery."
npm run clista -- recovery plan --recovery rcv_example --plan "Quarantine invalid event from trusted projection and verify restored state."
npm run clista -- recovery quarantine --recovery rcv_example --reason "Invalid event remains visible but not trusted."
npm run clista -- recovery apply --recovery rcv_example --summary "Applied reviewed repair marker without rewriting history."
npm run clista -- recovery verify --recovery rcv_example
npm run clista -- release manifest --tag v0.26.0-protocol-runtime-verification --out .clista/release-manifest.json
npm run clista -- release verify --manifest .clista/release-manifest.json
npm run clista -- release show --manifest .clista/release-manifest.json
npm run clista -- runtime verify --manifest .clista/release-manifest.json
npm run clista -- merge open --source thd_example_alt --target thd_example --summary "Integrate useful fork reasoning."
npm run clista -- merge eligibility --request mrg_example
npm run clista -- merge complete --request mrg_example --merged-by "Troy"
npm run clista -- validate
npm run clista -- integrity verify
npm run clista -- continuity export --out continuity.json
npm run clista -- continuity verify --packet continuity.json
npm run clista -- continuity import continuity.json
npm run clista -- continuity resume
npm run clista -- continuity show
npm run clista -- compatibility verify --packet continuity.json
npm run clista -- compatibility show --packet continuity.json
npm run clista -- interoperability verify --packet continuity.json
npm run clista -- interoperability show --packet continuity.json
npm run clista -- federation check --packet continuity.json
npm run clista -- federation verify
npm run clista -- negotiation check --packet continuity.json
npm run clista -- negotiation verify
npm run clista -- execution verify
npm run clista -- review verify
npm run clista -- recovery verify
npm run clista -- release verify
npm run clista -- runtime verify --manifest .clista/release-manifest.json
npm run clista -- outcome verify
npm run clista -- outcome-learning verify
npm run clista -- identity show --participant par_troy
npm run clista -- attribution list --thread thd_example
npm run clista -- attribution show clm_example
npm run clista -- attribution by-participant par_troy
npm run clista -- attribution verify
npm run clista -- state show --thread thd_example
npm run clista -- audit show --thread thd_example
npm run clista -- fork lineage --thread thd_example_alt
npm run clista -- export
npm run clista -- import --events clista-export.json
```

## First Test Thread

The first test thread asks:

```text
Should ClisTa MVP begin as a local-first JSON protocol before UI?
```

Fixture:

```text
examples/first-test-thread/events.ndjson
```

It must answer:

- What was decided?
- Why?
- What evidence supported it?
- Who dissented?
- What objections remain?
- What happens next?

## Action Chain Fixture

The M19-M22 action-chain fixture lives at:

```text
examples/action-chain/events.ndjson
```

It proves:

```text
delegation -> execution -> outcome -> outcome learning
```

Use read-only commands with `--events examples/action-chain/events.ndjson` to inspect it without appending to the canonical log.

## Architecture Rule

Agents may be added later through LangGraph, but agents must emit ClisTa protocol objects.

Agents must not define the architecture.

## Core Principle

```text
ClisTa is not where reasoning happens.
ClisTa is where reasoning becomes accountable.
```
