# Primitive Map M0-M23

This map compresses the verified M0-M23 surface into protocol primitives.

```text
Conversation is input.
Reasoning state is output.
```

A primitive is not a product feature and not a new milestone. It is a durable capability boundary already supported by docs, schema export shape, validator checks, projector state, CLI commands, fixtures, and tests.

## Append-Only Event Truth

What it does:

Stores protocol history as append-only NDJSON events. The event log is the source of truth; projected state is derived.

Milestones:

- M0 Protocol Spine Proven
- M1 Protocol Validity
- M6 Protocol Integrity
- M7 and M14 Protocol Continuity

Preserved laws:

- `.clista/events.ndjson` is source of truth.
- Projected state is derived.
- Done is not a statement. Done is a verified state.

## Deterministic Projection

What it does:

Reconstructs current reasoning state from the event log without relying on transcript memory.

Milestones:

- M0 Protocol Spine Proven
- M2 Protocol Governance
- M4 Protocol Forks
- M5 Protocol Merges
- M7 and M14 Protocol Continuity

Preserved laws:

- Projection proves memory.
- Continuity is not transcript replay.
- Many threads. Few states. One verified artifact.

## Validation Before Trust

What it does:

Rejects invalid reasoning logs before projection is treated as trusted protocol state.

Milestones:

- M1 Protocol Validity
- M2 Protocol Governance
- M6 Protocol Integrity
- M8-M23 layer-specific validation

Preserved laws:

- Validation proves protocol.
- Unsupported state is not valid state.
- Invalid reasoning must fail loudly with `event_id` and `reason`.
- Required review is pending until completed as `reviewed`.

## Governance And Authority

What it does:

Separates reasoning contribution from authorized state change. Decisions, merges, amendments, delegation, execution, and exchange boundaries require explicit authority context.

Milestones:

- M2 Protocol Governance
- M5 Protocol Merges
- M8 Protocol Identity
- M13 Protocol Amendments
- M18 Protocol Negotiation
- M19 and M19.1 Protocol Delegation
- M23 Protocol Review

Preserved laws:

- Governance proves legitimacy.
- Recommendation is not amendment.
- Delegation is not authority surrender.
- Agreement is not governance merger.
- Review is not approval.

## Accountability: Identity, Attribution, Provenance

What it does:

Records who contributed, what role and authority context existed at event time, and what source lineage was available.

Milestones:

- M8 Protocol Identity
- M9 Protocol Attribution
- M10 Protocol Provenance
- M19.1 Delegation Actor Boundary Clarification

Preserved laws:

- Non-participant delegation is not actor exemption.
- Attribution is not reputation.
- Provenance is not truth ranking.
- Source lineage is auditability, not scoring.

## Reasoning Evolution

What it does:

Allows reasoning to branch, merge, learn, adapt, and amend without erasing dissent or rewriting prior state.

Milestones:

- M3 Decision Outcomes
- M4 Protocol Forks
- M5 Protocol Merges
- M11 Protocol Learning
- M12 Protocol Adaptation
- M13 Protocol Amendments
- M22 Protocol Learning from Outcomes

Preserved laws:

- Outcomes prove learning from consequences.
- Learning is not reputation.
- Adaptation is not governance mutation.
- Learning is not retroactive justification.

## Exchange Boundary

What it does:

Lets verified reasoning state move across contexts while preserving capability, meaning, authority boundaries, and declared exchange terms.

Milestones:

- M7 and M14 Protocol Continuity
- M15 Protocol Compatibility
- M16 Protocol Interoperability
- M17 Protocol Federation
- M18 Protocol Negotiation

Preserved laws:

- Context transfer is not memory trust.
- Compatibility is not best effort acceptance.
- Translation is not reinterpretation.
- Shared state is not shared authority.
- Agreement is not authority transfer.

## Action Chain

What it does:

Tracks an authorized action from delegation through execution, observed outcome, evaluated outcome, and learning from that evaluated outcome.

Milestones:

- M19 and M19.1 Protocol Delegation
- M20 Protocol Execution
- M21 Protocol Outcome
- M22 Protocol Learning from Outcomes

Preserved laws:

- Delegation is not authority surrender.
- Execution is not intent.
- Completion is not success.
- Learning is not retroactive justification.

Canonical fixture:

```text
examples/action-chain/events.ndjson
```

The fixture proves:

```text
delegation -> execution -> outcome -> outcome learning
```

without adding events to the canonical origin log.

## Review Routing

What it does:

Routes state changes, violations, disputes, degraded exchange signals, rollbacks, failed outcomes, inconclusive outcomes, and outcome-learning signals through required review before further action when protocol rules require review.

Milestones:

- M23 Protocol Review

Preserved laws:

- Review is not approval.
- Review completion means `reviewed`.
- Review does not approve, repair, recover, roll back, mutate governance, create authority, create consensus, assign blame, assign accountability scores, or mutate the reviewed object.

## Decision Outcomes And Protocol Outcomes

M3 decision outcome means:

```text
decision reasoning consequence / declared decision result
```

It uses:

- `ExpectedOutcomeDeclared`
- `OutcomeAudited`
- `DecisionScored`
- `clista outcome expect --thread <threadId> --decision <decisionRecordId>`
- `clista outcome audit`
- `clista decision score`

M21 protocol outcome means:

```text
execution-linked observed effect evaluated against intended effect
```

It uses:

- `OutcomeExpected`
- `OutcomeObserved`
- `OutcomeEvaluated`
- `OutcomeDisputed`
- `OutcomeViolationRecorded`
- `clista outcome expect --execution <executionId>`
- `clista outcome observe`
- `clista outcome evaluate`

The names overlap because M21 reuses the CLI namespace for a narrower execution-linked outcome primitive. The event families and object shapes preserve the boundary.

## Layer Versioning And Release Versioning

Layer protocol versions mark capability boundaries. For example, delegation remains `0.19.0`, execution remains `0.20.0`, outcome remains `0.21.0`, outcome learning remains `0.22.0`, and review is `0.23.0` until those layer behaviors change.

Package and release versions mark repository releases. A feature release can advance to `v0.23.0` while unchanged M19-M22 layer versions stay at their original capability boundaries.

Use a layer version to ask:

```text
Which capability boundary introduced this projected layer?
```

Use the package or tag version to ask:

```text
Which repository release contains this cleanup, fixture, docs, or implementation?
```

## Schema And Validator Boundary

`schemas/clista-protocol.schema.json` describes exported protocol state. It intentionally leaves some projected objects open with `additionalProperties: true` so export metadata can remain forward compatible.

The strict trust contract is the validator:

```text
clista validate
```

and the layer verifiers:

```text
clista delegation verify
clista execution verify
clista outcome verify
clista outcome-learning verify
clista review verify
```

If schema permissiveness and validator strictness differ, validator strictness controls trusted protocol state.
