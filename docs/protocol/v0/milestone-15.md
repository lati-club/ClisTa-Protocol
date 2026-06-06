# Milestone 15: Protocol Compatibility

## Acceptance Criteria

ClisTa must only resume a continuity packet when the receiving context supports its required protocol capabilities, active amendments, validation requirements, and verification layers.

The theorem is:

```text
protocol_compatibility = verify(capability_set, amendment_state, validation_requirements)
```

The hard law is:

```text
unsupported_state != valid_state
```

## Boundary

Compatibility answers:

```text
Can this local protocol context safely resume the packet it can verify?
```

Compatibility does not answer:

```text
Can the local context silently downgrade the packet until it fits?
```

ClisTa may resume only what it can verify.

## Required Context

A compatibility context must declare:

- local protocol version
- compatibility protocol version
- local capability set
- supported continuity packet versions
- supported continuity schema versions
- supported verification layers
- supported amendment types
- explicitly supported active amendment ids

## Required Status

Compatibility status must be one of:

- `compatible`
- `degraded`
- `incompatible`
- `rejected`

`degraded` means the packet can be resumed but only with explicit degraded status, such as compatibility-mode continuity.

`incompatible` means the packet is valid continuity but the receiving context lacks required support.

`rejected` means the packet itself failed continuity verification.

## Required Commands

```text
clista compatibility check
clista compatibility show
clista compatibility verify
```

## Required Validation

ClisTa rejects compatibility when:

- packet protocol version is missing or unsupported
- local protocol version is missing
- required capabilities are unknown
- required verification layers are unsupported
- required verification layers are missing or invalid
- active amendments are unsupported
- imported state mutation is requested
- governance mutation is requested
- amendment approval is requested
- best effort acceptance is recorded
- unsupported state is treated as valid state

## Examples

Compatible:

```text
status: compatible
hard_law: unsupported_state != valid_state
required capability: compatibility
active amendments: explicitly supported
```

Degraded:

```text
status: degraded
reason: continuity packet is valid but not strict
```

Incompatible:

```text
unsupported required capability: distributed_consensus
unsupported active amendment: amd_future_rule
```

Rejected:

```text
continuity packet failed verification
```

## Anti-Goal

Compatibility is not best effort acceptance.

Compatibility does not mutate imported state, approve amendments, downgrade validation silently, ignore unsupported capabilities, or treat unsupported amendments as understood.

Milestone 15 does not add UI, agents, network sync, graph databases, search, reputation, OAuth/login, signatures, distributed consensus, or automatic protocol translation.

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
