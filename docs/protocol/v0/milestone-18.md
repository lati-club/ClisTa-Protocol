# Milestone 18: Protocol Negotiation

## Acceptance Criteria

ClisTa must let independent contexts agree on explicit exchange terms when their capabilities, amendments, validation requirements, semantic profiles, or federation status differ.

The theorem is:

```text
protocol_negotiation = agree(exchange_terms, across_independent_contexts)
```

The hard law is:

```text
agreement != governance merger
```

## Boundary

Negotiation answers:

```text
How can these independent contexts exchange or reference state under declared constraints?
```

Negotiation does not answer:

```text
Can one context transfer authority, merge governance, or adopt amendments by agreement alone?
```

ClisTa contexts may agree on exchange terms without surrendering governance.

## Required Objects

A negotiation request declares the contexts and packet being compared.

A negotiation constraint records a local or remote exchange constraint:

- required capabilities
- required verification layers
- supported amendment ids or amendment types
- interoperability profile requirements
- review conditions

A negotiation difference records an explicit mismatch:

- capability
- amendment
- validation requirement
- interoperability profile
- compatibility status
- interoperability status
- federation status

Negotiation terms record proposed, accepted, rejected, or degraded exchange behavior.

A negotiation failure records that declared constraints could not produce acceptable exchange terms.

## Required Status

Negotiation status must be one of:

- `accepted`
- `degraded`
- `rejected`
- `failed`
- `pending`

`accepted` means no required differences remain unresolved.

`degraded` means exchange may continue only under explicit degraded terms.

`rejected` means a required verification gate failed or exchange terms are not acceptable.

`failed` means the negotiation could not agree on terms under declared constraints.

`pending` means a request or terms proposal exists without accepted, rejected, degraded, or failed resolution.

## Required Commands

```text
clista negotiation propose
clista negotiation check
clista negotiation list
clista negotiation show <negotiationId>
clista negotiation verify
```

## Required Validation

ClisTa rejects negotiation when:

- continuity verification fails
- capability differences are silently skipped
- amendment differences are silently skipped
- validation requirement differences are silently skipped
- interoperability profile differences are silently skipped
- authority transfer is requested
- remote authority is imported automatically
- governance is merged automatically
- amendments are adopted automatically
- automatic consensus is created
- local or remote state is mutated by negotiation
- validation rules are changed by negotiation
- degraded support is accepted silently
- accepted terms are treated as protocol amendments

Negotiated exchange terms may constrain how state is shared.

They may not mutate authority, governance, amendments, validation rules, local state, or remote state.

## Examples

Accepted:

```text
status: accepted
hard_law: agreement != governance merger
authorityTransfer: false
governanceMerge: false
automaticAmendmentAdoption: false
```

Degraded:

```text
status: degraded
difference: optional semantic unsupported
condition: exchange may reference packet only as degraded
silentDowngrade: false
```

Rejected:

```text
authorityTransfer: true
governanceMerge: true
automaticAmendmentAdoption: true
```

Failure:

```text
reason: required validation layer unsupported under declared constraints
status: failed
```

## Anti-Goal

Negotiation is not authority transfer.

Agreement is not governance merger.

Negotiation does not import remote authority, merge governance, adopt amendments, create consensus, mutate state, change validation rules, or approve protocol amendments.

Milestone 18 does not add UI, agents, network sync, graph databases, search, reputation, OAuth/login, signatures, distributed consensus, automatic consensus, automatic amendment adoption, or automatic protocol translation.

## Audit Rationale

Integrity makes history trustworthy.

Identity makes actors accountable.

Attribution makes contributions accountable.

Provenance makes lineage auditable.

Learning makes reasoning improvable.

Adaptation makes improvement governable.

Amendments make governance change explicit.

Continuity makes verified reasoning portable.

Compatibility makes portability safe.

Interoperability makes portability meaningful.

Federation makes independent contexts alignable.

Negotiation makes exchange differences explicit.
