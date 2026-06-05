# ClisTa Roadmap

## Product Thesis

ClisTa is a protocol engine for accountable reasoning.

It does not try to preserve every conversation as long-term memory. It converts reasoning into structured artifacts that can be reloaded, reviewed, challenged, merged, and audited.

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
- Human review maps cleanly to governance review.

Initial roles:

- Author
- Research Agent
- Dissent Agent
- Risk Agent
- Decision Owner

Agent rule:

```text
Agents may propose ClisTa objects.
Only authorized participants can endorse, review, or merge them.
```

Acceptance test:

```text
A LangGraph flow opens a decision request,
adds evidence and objections,
then pauses for a human decision owner to review and merge.
```

## Phase 4: Search And Retrieval

Goal: retrieve relevant evidence, claims, objections, and prior decisions.

Use later, not in the MVP:

- Qdrant for semantic retrieval.
- OpenSearch for keyword, faceted, timeline, and hybrid search.

Index:

- Evidence text.
- Artifact summaries.
- Claim text.
- Objection text.
- Decision records.
- Minority reports.
- Outcome audits.

Acceptance test:

```text
Ask: "Have we made a similar decision before?"
ClisTa returns prior decisions, evidence, dissent, and outcomes.
```

## Phase 5: Graph Projection

Goal: query reasoning relationships directly.

Use later:

- Neo4j if graph queries become a central product surface.
- Apache AGE if Postgres should remain the main operational database.

Graph relationships:

- evidence supports claim
- evidence contradicts claim
- claim supports decision request
- objection challenges claim
- position endorses claim
- review approves decision request
- decision preserves minority report
- outcome audit evaluates decision

Acceptance test:

```text
Show every decision that depended on a claim later contradicted by audited outcomes.
```

## Phase 6: Collaboration Layer

Goal: support live and local-first editing of draft artifacts.

Use later:

- Yjs for browser-native live collaboration.
- Automerge for local-first/offline reasoning documents.

Important boundary:

Drafts can be collaborative.
Committed evidence, merged decisions, and minority reports are immutable.

Acceptance test:

```text
Multiple participants edit a draft decision request together.
When submitted, ClisTa records an immutable decision request event.
```

## Phase 7: Governance Workflows

Goal: support real institutional decision rules.

Use later:

- Temporal for long-running review workflows, reminders, deadlines, scheduled audits, and retries.
- Decidim as a design reference for participatory proposals and voting.
- Open Collective as a design reference for financial accountability and public ledger patterns.

Governance checks:

- Is evidence sufficient?
- Are unresolved objections visible?
- Are decision owners authorized?
- Are minority reports preserved?
- Is an outcome review scheduled?

Acceptance test:

```text
A decision request cannot merge until required reviewers have responded,
open objections are either resolved or preserved,
and an outcome audit date is recorded.
```

## Phase 8: Public Reasoning Network

Goal: make reasoning forkable, reviewable, and improvable across groups.

Network workflow:

```text
Create Thread
Commit Evidence
Take Positions
Deliberate
Pull Decision
Publish
Fork
Improve
Merge
Track Outcomes
```

Public features:

- Published decision records.
- Forkable reasoning threads.
- Public evidence bundles.
- Reviewable decision requests.
- Preserved dissent.
- Outcome comparison.
- Reputation based on evidence quality and decision outcomes.

Acceptance test:

```text
Another group forks a public decision thread,
adds new evidence,
opens an improved decision request,
and links its outcome back to the original.
```

## Recommended Build Order

1. Finish the protocol spike.
2. Add append-only events.
3. Add first-class evidence, position, objection, decision request, review, alignment, minority report, and outcome audit objects.
4. Build `state show` and `audit show`.
5. Run the first real ClisTa decision through the protocol.
6. Add a LangGraph adapter only after the protocol objects are stable.
7. Add search when there are enough evidence commits to justify retrieval.
8. Add graph projection when relationship queries become painful in JSON.
9. Add collaboration when drafts become multi-user.
10. Add Temporal when governance becomes long-running.

## Near-Term Milestone

The next milestone is not a UI.

It is this:

```text
One real ClisTa thread becomes a durable reasoning repository.
```

Definition of done:

- The thread has committed evidence.
- Claims are linked to evidence.
- Participants have declared positions.
- Objections are preserved.
- A decision request is opened.
- A decision owner merges or rejects it.
- Minority dissent remains attached.
- `state show` explains the current state.
- `audit show` explains how the decision happened.
