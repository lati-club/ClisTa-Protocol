# Milestone 19: Protocol Delegation

## Acceptance Criteria

ClisTa must allow an authorized actor to delegate a scoped action to another accountable actor without surrendering underlying authority.

The theorem is:

```text
protocol_delegation = authorize(scoped_action, accountable_actor)
```

The hard law is:

```text
delegation != authority surrender
```

## Boundary

Delegation answers:

```text
Who may perform this scoped action, under which limits, and with what attribution?
```

Delegation does not answer:

```text
Can authority, governance, amendment approval, or consensus move to the delegate?
```

Authority remains with the delegator or governance structure.

Delegation grants scoped permission to act.

## Required Objects

A delegation grant records:

- delegator participant
- delegate actor
- delegate type
- delegated action
- explicit scope
- explicit limits
- required delegator authority
- attribution requirement
- optional expiration

A delegated action records:

- delegation id
- delegate actor
- action performed
- scope used
- target object when relevant
- summary
- attribution back to the delegate and delegation

A delegation revocation records that a grant no longer permits action.

A delegation expiration records that a grant has expired.

A delegation violation records that an attempted or completed delegated action exceeded scope.

## Required Status

Delegation status must be one of:

- `active`
- `revoked`
- `expired`
- `violated`

`active` means the scoped action may be performed within declared limits.

`revoked` means the delegator or authorized controller ended the grant.

`expired` means an explicit expiration record ended the grant.

`violated` means an action exceeded the delegation boundary.

## Required Commands

```text
clista delegation grant
clista delegation record
clista delegation list
clista delegation show <delegationId>
clista delegation revoke
clista delegation verify
```

## Required Validation

ClisTa rejects delegation when:

- the delegator lacks required authority at event time
- a delegate is unknown when the delegate type is participant
- a grant omits action, scope, limits, or attribution requirement
- a delegated action references an unknown grant
- a delegated action is recorded after revocation
- a delegated action is recorded after expiration
- a delegated action uses a different delegate, action, or scope
- a delegated action lacks attribution to the delegate and delegation
- authority surrender is requested
- permanent authority transfer is requested
- governance mutation is requested
- unbounded action is requested
- automatic consensus is requested
- delegated consensus is requested

Delegated action may produce protocol objects only when a valid grant permits the scoped action.

Delegation may not mutate authority, governance, amendments, validation rules, local state, or remote state.

## Examples

Grant:

```text
action: verify
scope: thread:thd_thread_0001
limit: verify exported continuity packet only
authorityRequired: decision_owner
attributionRequired: true
authoritySurrender: false
```

Delegated Action:

```text
delegationId: dlg_verify_thread
delegateId: par_reviewer
action: verify
scope: thread:thd_thread_0001
attribution:
  delegateId: par_reviewer
  delegationId: dlg_verify_thread
```

Violation:

```text
reason: delegate attempted amendment approval outside granted scope
status: violated
```

## Anti-Goal

Delegation is not authority transfer.

Delegation is not governance merger.

Delegation does not create unbounded agent action, automatic consensus, automatic amendment approval, or authority surrender.

Milestone 19 does not add UI, agents, workflow orchestration, tool execution, signatures, distributed consensus, policy engines, or automatic amendment adoption.

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

Delegation makes scoped action accountable.
