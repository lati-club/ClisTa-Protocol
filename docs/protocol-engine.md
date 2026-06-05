# ClisTa Protocol Engine

This project is intentionally protocol-first.

ClisTa is not an agent platform, chat UI, graph database, or governance portal yet. The MVP proves one thing:

```text
A messy reasoning conversation can become durable structured state
that another human or agent can reload later.
```

## Layers

1. JSON Schema Protocol Core
2. Append-only NDJSON event log
3. Deterministic state projection
4. CLI-first workflow
5. First test thread

## Protocol Objects

The protocol core defines:

- `evidence`
- `assumption`
- `claim`
- `position`
- `objection`
- `decisionRequest`
- `review`
- `decisionRecord`
- `minorityReport`
- `outcomeAudit`

See `schemas/clista-protocol.schema.json`.

## Event Log

Every protocol action is stored as an immutable NDJSON event.

Every event shares the same envelope:

```text
event_id
event_type
thread_id
actor_id
timestamp
payload
```

`payload` carries the protocol object for that action. The envelope stays stable as the object model grows.

Supported events:

- `AssumptionDeclared`
- `EvidenceCommitted`
- `ClaimCreated`
- `PositionTaken`
- `ObjectionRaised`
- `DecisionRequestOpened`
- `ReviewSubmitted`
- `DecisionMerged`
- `MinorityReportFiled`
- `OutcomeAudited`

The local store lives at:

```text
.clista/events.ndjson
```

## CLI

```text
npm run clista -- init
npm run clista -- thread create --title "ClisTa MVP protocol shape" --question "Should ClisTa MVP begin as a local-first JSON protocol before UI?"
npm run clista -- evidence commit --thread thd_example --source "Research" --finding "Protocol-first state can be reloaded."
npm run clista -- claim create --thread thd_example --text "ClisTa should start protocol-first." --evidence evd_example
npm run clista -- position take --thread thd_example --participant "Troy" --stance support
npm run clista -- objection raise --thread thd_example --participant "Dissent Agent" --target clm_example --text "The schema may be too broad."
npm run clista -- decision open --thread thd_example --proposal "Build the protocol engine first."
npm run clista -- review submit --thread thd_example --request drq_example --reviewer "Troy" --status approve_with_conditions
npm run clista -- decision merge --thread thd_example --request drq_example --decider "Troy"
npm run clista -- state show --thread thd_example
npm run clista -- audit show --thread thd_example
```

## First Test Thread

The first test thread asks:

```text
Should ClisTa MVP begin as a local-first JSON protocol before UI?
```

Fixture:

```text
examples/first-test-thread/events.ndjson
```

It must answer:

- What was decided?
- Why?
- What evidence supported it?
- Who dissented?
- What objections remain?
- What happens next?

## Architecture Rule

Agents may be added later through LangGraph, but agents must emit ClisTa protocol objects.

Agents must not define the architecture.

## Core Principle

```text
ClisTa is not where reasoning happens.
ClisTa is where reasoning becomes accountable.
```
