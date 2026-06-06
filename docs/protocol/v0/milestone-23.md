# Milestone 23: Protocol Review

## Theorem

```text
protocol_review = route(state_change, through_required_review)
```

## Hard Law

```text
review != approval
```

## Capability

Protocol review routes state changes, violations, disputes, degraded exchange signals, rollbacks, failed outcomes, inconclusive outcomes, and learning signals through required review when protocol rules say review is necessary.

Review determines whether something must be examined before further action. It does not approve, repair, punish, recover, roll back, mutate governance, score accountability, assign blame, create consensus, create authority, or change the reviewed object.

## Events

- `ReviewRequired`
- `ReviewOpened`
- `ReviewCompleted`
- `ReviewDisputed`
- `ReviewViolationRecorded`

`ReviewCompleted` records that review occurred. Its completion status is `reviewed`; it is not approval.

## Projection

Protocol review projects to `review` state:

- `records`
- `required`
- `open`
- `completed`
- `disputed`
- `violated`
- `byReview`
- `bySubject`
- `completionsByReview`
- `disputesByReview`
- `violationsByReview`
- `reviewValidationStatus`

A required review remains pending until a `ReviewCompleted` event records that the review was examined.

## Validation

Validation rejects review events when:

- the reviewed subject does not exist
- the actor does not match the accountable reviewer field
- a completion attempts to act as approval
- a review event attempts governance mutation, authority creation, consensus creation, amendment approval, recovery, rollback, accountability scoring, blame assignment, or state mutation
- disputes or violations reference unknown reviews

## CLI

```text
clista review require --thread <threadId> --subject <objectId> --trigger <triggerType> --reason <reason>
clista review open --review <reviewId>
clista review complete --review <reviewId> --summary <summary>
clista review dispute --review <reviewId> --reason <reason>
clista review violation --review <reviewId> --type <violationType> --reason <reason>
clista review list
clista review show <reviewId>
clista review verify
```

Read-only commands accept `--events <path>`.

## Boundary

M3 `ReviewSubmitted` is a governance response to a decision request.

M23 protocol review is a routing layer for state changes that require examination before further action.

Neither one silently changes the reviewed object. M23 additionally enforces `review != approval` as its hard law.
