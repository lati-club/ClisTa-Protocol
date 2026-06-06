# Milestone 9: Protocol Attribution

## Acceptance Criteria

ClisTa must trace meaningful reasoning contributions back to the participant, role, authority context, source event, and provenance that produced them.

The theorem is:

```text
accountable_reasoning = attribute(contribution, participant, authority_context)
```

## Boundary

Identity answers:

```text
Who was this participant, and what authority did they have at event time?
```

Attribution answers:

```text
Which reasoning contribution came from whom, under what role and authority context?
```

This milestone is traceability, not reputation.

## Required Events

- `ContributionAttributed`
- `ContributionAttributionCorrected`
- `ContributionAttributionDisputed`
- `ContributionAttributionRevoked`

## Required Projection

Projection must expose:

- attributions by contribution
- attributions by participant
- attributions by source event
- role context at contribution event time
- authority context at contribution event time
- provenance for supporting evidence, claims, assumptions, objections, and reviews
- preserved corrections
- preserved disputes
- preserved revocations

Derived attribution is produced for core protocol contributions:

- evidence
- assumptions
- claims
- positions
- objections
- decisions
- outcomes
- forks
- merges
- governance reviews

## Required Commands

```text
clista attribution list
clista attribution show <contributionId>
clista attribution by-participant <participantId>
clista attribution verify
```

## Required Validation

ClisTa rejects attribution logs when:

- attributed participant does not exist
- participant was not active at contribution event time
- attribution references a future source event
- attribution references an unknown source event
- attribution role was not valid at contribution event time
- authority context does not permit the contribution type
- attribution correction references an unknown attribution
- attribution dispute references an unknown attribution
- attribution revocation lacks `decision_owner` authority

## Anti-Goal

Attribution is not reputation.

Attribution says:

```text
This participant contributed this reasoning element.
```

Reputation says:

```text
This participant is generally more trustworthy.
```

Milestone 9 does not add reputation, scoring participants, social trust graphs, search, graph databases, signatures, OAuth, login identity, UI, agents, or network behavior.

## Audit Rationale

Portable reasoning without attribution becomes:

```text
vibes with hashes
```

Attribution gives the portable state an accountable trail without turning that trail into a social score.

## Theorem

Identity enables attribution.

Attribution enables accountability.

Accountability does not require reputation.
