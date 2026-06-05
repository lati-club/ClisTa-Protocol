# Thread 0001: Build ClisTa Protocol

## Origin Note

This file is a manual reasoning projection of the first ClisTa design conversation.

The raw conversation is not the durable asset. The durable asset is the reasoning state produced by that conversation.

## Thread

```yaml
id: thread-0001
title: Build ClisTa Protocol
status: accepted
```

## Question

How should ClisTa be architected?

## Decision

Build ClisTa as a protocol-first append-only reasoning engine before building UI, agent orchestration, graph databases, governance portals, reputation systems, or network features.

## Rationale

ClisTa should prove that a messy reasoning conversation can become durable structured state that another human or agent can reload later.

The protocol spine is:

```text
reasoning_state = project(append_only_event_log)
```

## Supporting Evidence

- Context windows are not durable memory.
- Chat history is a poor long-term memory system.
- Structured state survives model changes, session loss, and tool changes.
- Git demonstrates scalable coordination through immutable state transitions, review, merge, and audit.
- Protocols scale because they convert conversations into structured artifacts.

## Assumptions

- Future models will improve.
- Durable reasoning should not depend on model memory.
- Coordination is a more durable bottleneck than generation.
- Reasoning systems need accountability as much as intelligence.
- The minimum useful memory is projected reasoning state, not raw conversation.

## Claims

- Conversations are not the asset.
- Reasoning state is the asset.
- Conversation is input.
- Reasoning state is output.
- ClisTa should preserve reasoning transitions, not every sentence.
- Assumptions should be first-class because many disagreements are assumption disagreements.

## Objections

### Future Models May Make Governance Unnecessary

Future AI systems may become capable enough to remember, summarize, and govern reasoning without an explicit protocol.

Status: resolved.

Resolution: ClisTa separates memory and accountability from model capability. Better models can emit better protocol objects, but they should not replace the durable protocol state.

### The Object Model May Be Too Broad

The initial object model may include more structure than the first thread requires.

Status: preserved.

Resolution: Milestone 0 must prove the spine using only the append-only log and projection. Objects that do not help reconstruct reasoning state should be removed or deferred.

## Accepted Architecture

- Repository name: `clista-protocol`
- Visibility: private until the protocol spine is proven
- Storage: append-only NDJSON events
- Source of truth: event log
- Derived state: projector output
- Critical command: `clista state show`
- First object expansion after evidence/claims/decisions: `assumption`

## Next Action

Implement and prove Milestone 0: Protocol Spine Proven.

Given only:

```text
.clista/events.ndjson
```

the system must produce:

```text
question:
decision:
rationale:
assumptions:
evidence:
claims:
positions:
objections:
minority_reports:
next_action:
audit_summary:
```

without consulting chat history, prompts, memory, LLMs, or external state.

## Historical Significance

The first ClisTa thread is about ClisTa itself.

The protocol's first successful act is explaining why the protocol should exist.

