# Milestone 14: Protocol Continuity

## Acceptance Criteria

ClisTa must resume reasoning across contexts from verified projected state, not from transcript memory.

The theorem is:

```text
reasoning_continuity = resume(project(event_log), verification_state)
```

The hard law is:

```text
context transfer != memory trust
```

## Boundary

Continuity answers:

```text
Can this reasoning state be resumed because the event log, projection, and verification layers match?
```

Continuity does not answer:

```text
Can this transcript summary be trusted as protocol state?
```

ClisTa continuity is not remembering the conversation.

ClisTa continuity is verifying the reasoning state.

## Required Packet

A Continuity Packet must preserve:

- protocol version
- schema version
- ClisTa protocol version
- milestone capability set
- event log hash
- projection hash
- state hash
- source events
- projected continuity state
- verification state
- resume status

Resume status must be one of:

- `verified`
- `degraded`
- `rejected`

`degraded` means the packet is valid but not strict, such as legacy compatibility-mode event logs.

## Required Verification State

Verification state must preserve:

- event log validation status
- integrity verification status
- strict integrity status
- attribution verification status
- provenance verification status
- learning verification status
- adaptation verification status
- amendment verification status
- compatibility verification status
- interoperability verification status
- federation verification status
- negotiation verification status
- transcript replay disabled
- memory trust disabled
- authority creation disabled
- governance mutation disabled
- amendment approval disabled
- imported state mutation disabled

## Required Commands

```text
clista continuity export
clista continuity verify
clista continuity import <path>
clista continuity resume
clista continuity show
```

`summary` remains a compatibility alias for `show`.

## Required Validation

ClisTa rejects continuity packets when:

- imported event log hash chain is invalid
- projected state does not match the event log
- protocol version is unsupported
- schema version is unsupported
- required verification layers are missing
- required verification layers are invalid
- imported state bypasses validation
- packet creates authority
- packet approves amendments
- packet mutates governance
- packet mutates imported state
- packet trusts transcript replay
- packet trusts model memory

## Examples

Valid continuity:

```text
resume_status: verified
theorem: reasoning_continuity = resume(project(event_log), verification_state)
hard_law: context transfer != memory trust
memoryTrust: false
transcriptReplay: false
authorityCreated: false
governanceMutation: false
amendmentApproval: false
importedStateMutation: false
```

Invalid continuity:

```text
memoryTrust: true
transcriptReplay: true
authorityCreated: true
governanceMutation: true
amendmentApproval: true
importedStateMutation: true
```

## Anti-Goal

Continuity is not transcript replay.

A plain summary is not protocol state.

A continuity package does not create authority, approve amendments, mutate governance, or rewrite imported state.

Milestone 14 does not add UI, agents, network sync, graph databases, search, reputation, OAuth/login, signatures, distributed consensus, or automatic amendment application.

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
