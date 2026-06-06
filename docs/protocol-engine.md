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
8. Protocol continuity packets
9. Protocol identity
10. Protocol attribution

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

See `schemas/clista-protocol.schema.json`.

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

The local store lives at:

```text
.clista/events.ndjson
```

## CLI

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

## Architecture Rule

Agents may be added later through LangGraph, but agents must emit ClisTa protocol objects.

Agents must not define the architecture.

## Core Principle

```text
ClisTa is not where reasoning happens.
ClisTa is where reasoning becomes accountable.
```
