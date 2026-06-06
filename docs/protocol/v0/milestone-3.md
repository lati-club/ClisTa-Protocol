# Milestone 3: Protocol Outcomes

## Acceptance Criteria

ClisTa must compare decisions against reality.

The theorem is:

```text
decision_quality = compare(expected_outcomes, actual_outcomes)
```

Given only:

```text
.clista/events.ndjson
```

ClisTa can reconstruct:

```text
reasoning -> decision -> expected outcomes -> actual outcomes -> decision score
```

## Required Commands

```text
clista outcome expect
clista outcome audit
clista decision score
```

## Required Events

- `ExpectedOutcomeDeclared`
- `OutcomeAudited`
- `DecisionScored`

## Required Projection

`clista state show --thread <id>` must answer:

- What did we expect?
- When did we expect to know?
- What actually happened?
- Which assumptions failed?
- Which evidence links failed?
- Was the decision confirmed, partially confirmed, failed, or inconclusive?
- What is the decision quality score?

## Required Validation

ClisTa rejects outcome logs when:

- an expected outcome references an unknown decision
- an outcome audit references an unknown expected outcome
- failed assumptions reference unknown assumptions
- failed evidence references unknown evidence
- a decision score references unknown outcome audits
- a decision score exists before outcome audits
- `reviewDate` is not a valid date

## Boundary

This is empirical protocol state only.

It does not add:

- UI
- agents
- network behavior
- reputation
- prediction markets
- analytics dashboards

## Theorem

Projection proves memory.

Validation proves protocol.

Governance proves legitimacy.

Outcomes prove learning from consequences.
