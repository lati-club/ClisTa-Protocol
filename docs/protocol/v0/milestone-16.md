# Milestone 16: Protocol Interoperability

## Acceptance Criteria

ClisTa must exchange compatible reasoning state only when the receiving context preserves the declared protocol meaning of the state.

The theorem is:

```text
protocol_interoperability = preserve(meaning, across_compatible_contexts)
```

The hard law is:

```text
translation != reinterpretation
```

## Boundary

Interoperability answers:

```text
Can this compatible context preserve the meaning of the state it exchanges?
```

Interoperability does not answer:

```text
Can this context silently reinterpret protocol objects until the packet fits?
```

ClisTa state is not portable unless its meaning survives transfer.

## Required Profile

An interoperability profile must declare:

- exchange format
- required semantics
- optional semantics
- event types whose meanings are preserved
- protocol object semantics
- semantic profile hash
- semantic-loss guard fields

The profile must preserve meaning for claims, assumptions, evidence, decisions, authority, attribution, provenance, learning signals, adaptation recommendations, amendments, continuity, compatibility, interoperability, federation, and negotiation.

## Required Status

Interoperability status must be one of:

- `interoperable`
- `degraded`
- `incompatible`
- `rejected`

`interoperable` means the packet is compatible and all required semantics preserve meaning.

`degraded` means required semantics preserve meaning, but optional semantics or compatibility status require explicit degraded handling.

`incompatible` means the packet is structurally verified but required semantics, event meanings, or object meanings are unsupported.

`rejected` means compatibility or continuity verification rejected the packet.

## Required Commands

```text
clista interoperability check
clista interoperability show
clista interoperability verify
```

## Required Validation

ClisTa rejects interoperability when:

- exchange format is unsupported
- required semantics are unknown
- semantic profile hash does not match declared semantics
- source event types are not declared in the interoperability profile
- event types are unsupported
- object meanings do not match local protocol meanings
- semantic loss is accepted
- semantic reinterpretation is recorded
- semantic degradation is silent
- authority is flattened into metadata
- provenance is flattened into notes
- learning signals are treated as scores
- adaptation recommendations are treated as amendments
- continuity packets are treated as transcript summaries
- unsupported semantics are accepted as fully valid
- imported state is mutated to fit local semantics

## Examples

Interoperable:

```text
status: interoperable
hard_law: translation != reinterpretation
exchange_format: clista.continuity.packet.v0
required semantic: authority_context
```

Degraded:

```text
status: degraded
reason: compatible packet is valid but degraded
```

Incompatible:

```text
unknown required semantic: source_reputation
semantic meaning mismatch for authority
```

Rejected:

```text
compatibility check failed
continuity packet failed verification
```

## Anti-Goal

Interoperability is not semantic loss.

Interoperability does not flatten authority, provenance, learning, adaptation, amendments, continuity, compatibility, federation, or negotiation into generic notes or metadata.

Milestone 16 does not add UI, agents, network sync, graph databases, search, reputation, OAuth/login, signatures, distributed consensus, or automatic protocol translation.

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
