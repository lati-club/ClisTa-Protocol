# ClisTa Roadmap

## Product Thesis

ClisTa changes the shape of yes.

Here’s a yes — now trace its shape.

A normal decision system records `approved / rejected`. ClisTa records the accountable state that made the decision durable: evidence, assumptions, objections, minority reports, authority trails, provenance traces, bounded scope, verification state, and proceed / blocked / degraded status.

Core law:

```text
Conversation is input.
Reasoning state is output.
```

Core slogan:

```text
Commit Evidence. Pull Decisions. Track Audit.
```

## Architectural Rule

ClisTa owns the protocol objects and audit model.

External systems are adapters or projections:

- Agent frameworks run participants.
- Workflow engines coordinate long-running reviews.
- Graph databases query relationships.
- Search systems retrieve evidence and decisions.
- Collaboration tools edit drafts.
- Governance platforms inspire review and authority models.

None of those systems should define the protocol.

## Protocol Milestone Runway

Verified baseline:

- Completed through M30: Agent Ingestion Adapter (Hermes bridge)

Next selected milestone:

- Not selected

Status:

- M28 complete
- M28 real external replay observed once: PASS
- Surrounding quickstart hygiene defects found and patched
- M29 product narrative pass complete
- M29 changed narrative documentation only
- M30 agent ingestion adapter (Hermes bridge) complete
- M30 selected from observed friction: the two-engine drift between the Python MVP export and the canonical event log
- M30 engine-validated: imported sessions are accepted byte-for-byte and projected by the reference engine
- Next decision: pause or select the next milestone from observed friction

M28 audited the existing M27 scenario. It did not expand the product surface.

M29 updated the public explanation so the README leads with what ClisTa does before the defensive boundary disclaimers.

The M29 theorem is:

```text
product_narrative = explain(accountable_decision_state, before_boundary_disclaimers)
```

Hard law:

```text
guardrails_are_required != guardrails_are_the_product
```

Allowed scope:

- README narrative opening
- quickstart product framing
- protocol milestone documentation
- roadmap milestone tracking
- package version / release metadata when required by milestone convention

Explicitly out of scope:

- runtime features
- protocol semantics
- schema changes
- verifier behavior
- new commands
- expected-state comparator
- M30
- UI
- agents
- platform features
- marketing fluff

M27 proved that a realistic demo workflow exists. M28 proved, by repository tests and one real external replay observation, that a non-builder can reproduce that workflow from the public artifact and understand the state it produces. M29 makes that value legible at the top of the public docs: the limited beta approval is not just a yes, but a yes with its accountability structure fused on.

M30 realizes Phase 3 (Agent Adapter): the Hermes ingestion adapter turns a raw agent session into the canonical append-only event log without becoming the protocol. A session now projects a full accountable thread — claim, evidence, a recorded concern, a named assumption, and an approved decision that considered them — validated by the reference engine itself. M30 was chosen from observed friction (the Python MVP export had drifted into a second, weaker representation) and also consolidated the tooling onto one representation, the event log, and one engine, retiring the parallel Python engine and flat export.

The M30 theorem is:

```text
agent_ingestion = emit(session_transcript) -> canonical_protocol_events
```

Hard law:

```text
adapter_emits_protocol != adapter_owns_protocol
```

Candidate next milestones remain unselected:

| Candidate | What it would prove |
| --- | --- |
| Artifact Installation | A fresh user can install and use the artifact path. |
| Protocol Distribution | Verified state can move across environments. |
| Next Replay Observation | Another non-builder reaches the same understanding from the public docs. |

Holding state:

```text
latest_verified_milestone = M30
m28_real_external_replay_observed_once = PASS
m29_product_narrative_pass = complete
m30_agent_ingestion_adapter = complete
agent_session_bridge = engine_validated
next_selected_milestone = none
decision_pause = pause_or_select_from_observed_friction
safe_to_build_from = yes
```

The protocol should choose the next milestone from observed friction rather than starting distribution, UI, agents, or platform work by default.

## Phase 0: Protocol Spike

Goal: prove that one real reasoning thread can be exported, reloaded, and continued without reading the original transcript.

Build:

- Local JSON schema for ClisTa objects.
- One populated example thread.
- Deterministic export format.
- Reload test using only exported state.

Core objects:

- `participant`
- `thread`
- `message`
- `claim`
- `decision`
- `artifact`

Acceptance test:

```text
Given only the exported ClisTa JSON,
another agent can answer:
What was decided?
Why?
Who dissented?
What should happen next?
```

Status: started.

Existing artifacts:

- `schemas/clista-mvp.schema.json`
- `docs/first-real-thread.md`
- `docs/hermes-thread-emission.md`

## Phase 1: Reasoning Repo MVP

Goal: make ClisTa feel like Git for reasoning.

Add first-class protocol objects:

- `evidence`
- `position`
- `objection`
- `decisionRequest`
- `review`
- `alignmentSnapshot`
- `minorityReport`
- `outcomeAudit`

Add append-only events:

- `ThreadCreated`
- `ParticipantAdded`
- `EvidenceCommitted`
- `ClaimCreated`
- `PositionTaken`
- `ObjectionRaised`
- `AlignmentCalculated`
- `DecisionRequestOpened`
- `ReviewSubmitted`
- `DecisionMerged`
- `MinorityReportAttached`
- `OutcomeAudited`

Build CLI commands:

```text
clista init
clista thread create
clista participant add
clista evidence commit
clista claim create
clista position take
clista objection raise
clista decision open
clista review submit
clista decision merge
clista state show
clista audit show
```

Storage:

- Append-only NDJSON event log.
- JSON state projection.
- Content hashes for immutable evidence, decisions, and minority reports.

Acceptance test:

```text
Create a thread about whether ClisTa should start protocol-first.
Commit evidence, claims, positions, objections, and a decision request.
Merge a decision with one preserved dissent.
Run clista state show and clista audit show.
Both outputs must be understandable without the chat transcript.
```

## Phase 2: Projection Engine

Goal: separate history from current reasoning state.

Build:

- Event reducer.
- Current-state projection.
- Audit projection.
- Participant-position projection.
- Objection-resolution projection.
- Decision-package projection.

Key views:

- Current reasoning state.
- Open decision requests.
- Unresolved objections.
- Evidence supporting a claim.
- Evidence contradicting a claim.
- Minority reports by decision.
- Outcome audits by decision.

Acceptance test:

```text
Given the same event log,
ClisTa can reproduce the same current state deterministically.
```

## Phase 3: Agent Adapter

Goal: let agents contribute to the protocol without becoming the protocol.

Recommended first adapter:

- LangGraph.

Why:

- Role-based agents map cleanly to participants.
- Checkpointed graph execution maps cleanly to deliberation phases.
- Human interrupt maps cleanly to review gates.
- StateGraph persistence maps cleanly to ClisTa continuity.

Adapter rule:

```text
agent output is input to ClisTa;
ClisTa state is not agent memory
```

Implemented first adapter — Hermes ingestion (M30):

The first adapter built is a Hermes session adapter (`src/ingest_hermes.py`), not
LangGraph. It parses a raw transcript and emits the canonical append-only event
log the engine consumes, honoring the adapter rule above — the session is input;
the engine owns protocol state. One session maps to:

- participants -> `ParticipantAdded`
- session -> `ThreadCreated`
- substantive user messages -> `ClaimCreated`
- tool outputs -> `EvidenceCommitted`
- named concerns -> `ObjectionRaised` (non-blocking)
- an explicit recommendation backed by evidence -> `AssumptionDeclared` + `DecisionRequestOpened` + `ReviewSubmitted` + `DecisionMerged`

The generated log is accepted by the engine byte-for-byte (`src/clista_events.py`
reproduces the canonical event hashing), so an imported session projects a full
reasoning thread via `clista state show` and `clista audit show`. The mapping and
its extraction rules are documented in `docs/hermes-thread-emission.md`.

## Phase 4: Interop / Distribution

Goal: make ClisTa states portable across tools and institutions without merging authority.

Build only after protocol objects and verification boundaries are stable.
