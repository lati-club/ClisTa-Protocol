# Milestone 10: Protocol Provenance

## Acceptance Criteria

ClisTa must trace meaningful reasoning contributions not only to participants and authority context, but also to source lineage.

The theorem is:

```text
trusted_contribution = verify(attribution + source_provenance)
```

Protocol-native form:

```text
reasoning_provenance = trace(contribution, source, transformation, authority)
```

## Boundary

Attribution answers:

```text
Who contributed this reasoning element, under what authority context?
```

Provenance answers:

```text
Where did this reasoning element come from, and how did it enter state?
```

This milestone is auditability, not reputation.

## Required Projection

Projection must expose:

- provenance by contribution
- provenance by source
- provenance by introducing event
- source type
- source id
- source refs
- introducing event id
- transformation
- source hash where available
- source integrity status
- availability at contribution event time
- preserved correction, dispute, and revocation audit trail
- fork and merge source lineage

## Source Types

Supported source types are:

- `event`
- `evidence`
- `import`
- `continuity_packet`
- `fork`
- `merge`
- `projection`
- `external_reference`

## Transformations

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

## Required Commands

```text
clista provenance list
clista provenance show <contributionId>
clista provenance trace <contributionId>
clista provenance verify
```

## Required Validation

ClisTa rejects provenance logs when:

- provenance source does not exist
- provenance source event occurs after the contribution event
- source hash does not match canonical source serialization
- imported provenance lacks integrity metadata
- continuity packet provenance lacks packet hash metadata
- unsupported source types are used
- unsupported transformations are used

Correction, dispute, and revocation preserve original provenance. They append audit transformations; they do not overwrite source lineage.

Fork provenance preserves the inherited boundary event.

Merge provenance preserves accepted, rejected, and preserved source fork lineage.

## Event Shape

Milestone 10 does not require a new event type.

The source of truth remains the append-only event log. Provenance is derived from protocol events and may be made explicit inside `ContributionAttributed.payload.contributionAttribution.provenance`.

Explicit provenance may include:

```text
sourceType
sourceId
sourceEventId
sourceHash
transformation
sourceIntegrityVerified
sourceRefs
```

Legacy `event_log` source type is normalized to `event` for compatibility with Milestone 9 attribution records.

## Anti-Goal

Provenance is not truth.

Provenance says:

```text
This came from here.
```

It does not say:

```text
This source is universally correct.
```

Milestone 10 does not add reputation, trust scores, source scoring, truth ranking, participant scoring, model ranking, search, graph databases, signatures, OAuth, login identity, UI, agents, network sync, or distributed consensus.

## Audit Rationale

Attribution without provenance is incomplete accountability.

Provenance without scoring preserves neutrality.

Milestone 10 lets ClisTa say:

```text
This contribution is accountable because its source lineage is traceable.
```

## Theorem

Identity enables attribution.

Attribution enables accountability.

Provenance enables auditability.

Auditability does not require reputation.
