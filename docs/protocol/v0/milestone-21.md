# Milestone 21: Protocol Outcome

## Theorem

```text
protocol_outcome = evaluate(execution_result, against_intended_effect)
```

## Hard Law

```text
completion != success
```

An execution is not successful because it completed.

It is successful only when observed outcome evidence satisfies the intended effect.

## Boundary

Outcome evaluates the effect of performed action. It does not create consensus, governance approval, amendment approval, or authority.

Allowed:

- record an expected outcome for an execution
- record an observed outcome with evidence
- evaluate observed effect against intended effect
- classify the evaluation as success, partial success, failure, or inconclusive
- record outcome disputes
- record outcome violations
- preserve attribution
- project outcome state separately from execution state

Forbidden:

- completion treated as success
- success by assertion
- outcome without evidence
- retroactive rewriting of intended effect
- unmeasured impact treated as achieved impact
- silent unintended consequence
- outcome as consensus
- outcome as governance approval
- outcome as amendment approval

## Event Types

```text
OutcomeExpected
OutcomeObserved
OutcomeEvaluated
OutcomeDisputed
OutcomeViolationRecorded
```

## State

Outcome projection includes:

```text
outcome:
  records
  expected
  pending
  observed
  evaluated
  disputed
  violated
```

Each outcome record includes:

- `id`
- `executionId`
- `threadId`
- `actorId`
- `expectedEffect`
- `observedEffect`
- `evidence`
- `evaluationResult`
- `confidence`
- `evaluatedByParticipantId`
- lifecycle timestamps
- disputes
- violations
- attribution back to actor and execution

`status` records observation state. `evaluationResult` records judgment.

## Validation

ClisTa rejects outcome records when:

- the execution reference is unknown
- the outcome actor is not a known participant
- the event actor does not match the outcome actor
- an expected outcome is declared after execution completion
- observation omits evidence
- evaluation lacks an observed outcome
- evaluation references an execution that is not completed
- evaluation omits comparison evidence
- expected effect is rewritten after declaration
- disputes or violations reference unknown outcomes
- outcome creates authority, consensus, governance approval, amendment approval, or governance mutation
- completion is treated as success by assertion

## CLI

```text
clista outcome expect
clista outcome observe
clista outcome evaluate
clista outcome dispute
clista outcome list
clista outcome show <outcomeId>
clista outcome verify
```

`clista outcome expect --execution <executionId>` records M21 protocol outcome expectation.

The older decision-quality command remains available:

```text
clista outcome expect --thread <threadId> --decision <decisionRecordId>
```

That command records M3 expected outcomes for decision scoring.

## Continuity

M21 adds outcome to the continuity capability set and required verification layers.

Continuity packets carry `protocol_outcome_state` and `outcomeValidationStatus`.
