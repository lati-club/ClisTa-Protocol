# Milestone 2: Protocol Governance

## Acceptance Criteria

ClisTa must prove that a merged decision was legitimate, not merely well-formed.

The theorem is:

```text
authorized_decision = validate(authority + requirements + state)
```

Given only:

```text
.clista/events.ndjson
```

ClisTa can explain whether a decision request is eligible to merge and reject a merged decision that violates protocol governance.

## Required Command

```text
clista decision eligibility --request <decisionRequestId>
```

The command returns explainable JSON:

```text
eligible
requestId
authorizedDecisionOwners
blockingObjections
missingReviews
requiredMinorityReports
reasons
```

## Governance Rules

A `DecisionMerged` event is legitimate only if the append-only log proves:

- the decision request exists and is mergeable
- the deciding actor has `decision_owner` authority
- required reviews exist
- no review has unresolved `request_changes`
- blocking objections are resolved or explicitly preserved
- preserved blocking objections have minority reports
- non-blocking objections do not block merge but remain visible
- the decision package records supporting evidence, claims, assumptions, objections, reviews, and authority

## Boundary

This is protocol governance only.

It does not add:

- UI
- agents
- graph database
- search
- reputation
- network behavior
- policy engine
- governance portal

## Theorem

Projection proves memory.

Validation proves integrity.

Governance proves legitimacy.
