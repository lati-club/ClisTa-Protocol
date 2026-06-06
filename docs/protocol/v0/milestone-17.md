# Milestone 17: Protocol Federation

## Acceptance Criteria

ClisTa must allow independent contexts to exchange, compare, reference, and align verified reasoning state without merging authority domains.

The theorem is:

```text
protocol_federation = align(independent_reasoning_states, shared_protocol_rules)
```

The hard law is:

```text
shared_state != shared_authority
```

## Boundary

Federation answers:

```text
Can independent verified contexts align under shared protocol rules?
```

Federation does not answer:

```text
Can remote authority become local authority by default?
```

ClisTa contexts may align without surrendering authority.

## Required Objects

A federation context declares an independent protocol context.

A federation peer records an external context identity for audit.

A federated state reference records verified packet metadata:

- remote thread id
- packet protocol version
- packet schema version
- packet hash
- event-log hash
- projection hash
- state hash
- continuity status
- compatibility status
- interoperability status
- federation status

A federation boundary records what remote state cannot do locally.

## Required Status

Federation status must be one of:

- `accepted`
- `degraded`
- `rejected`
- `pending`

`accepted` means the packet passed continuity, compatibility, interoperability, and federation checks.

`degraded` means the packet passed required checks but carries explicit degraded status.

`rejected` means a required verification gate failed.

`pending` means a reference or peer is recorded but not accepted as a verified federated state reference.

## Required Commands

```text
clista federation record
clista federation check
clista federation list
clista federation show <federationId>
clista federation verify
```

## Required Validation

ClisTa rejects federation when:

- continuity verification fails
- compatibility verification fails
- interoperability verification fails
- federated state reference metadata is incomplete
- remote authority is imported automatically
- remote amendments are imported automatically
- remote governance mutates local governance
- remote state mutates local state
- shared state is treated as shared authority
- federation is treated as automatic consensus
- federation is treated as network consensus

## Examples

Accepted:

```text
status: accepted
hard_law: shared_state != shared_authority
remote authority imported: false
automatic amendment import: false
```

Degraded:

```text
status: degraded
reason: compatible and interoperable packet is valid but degraded
```

Rejected:

```text
interoperability check failed
remote authority cannot become local authority
```

Boundary:

```text
remote verification may inform local reasoning
remote authority may not become local authority without explicit local governance
```

## Anti-Goal

Federation is not centralization.

Federation does not create shared authority, import remote participants as trusted local participants, import remote amendments as local amendments, merge governance automatically, create consensus automatically, mutate local state from remote state, or provide distributed consensus.

Milestone 17 does not add UI, agents, network sync, graph databases, search, reputation, OAuth/login, signatures, distributed consensus, or automatic protocol translation.

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
