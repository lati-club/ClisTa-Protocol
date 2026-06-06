# ClisTa Protocol

ClisTa is a protocol engine for accountable reasoning.

It does not preserve conversations as the primary asset. It preserves the reasoning state produced by conversations.

```text
Conversation is input.
Reasoning state is output.
```

## Core Loop

```text
Commit Evidence -> Pull Decision -> Track Audit
```

## Protocol Spine

- Append-only NDJSON event log.
- Event log as source of truth.
- Projected state derived from events.
- CLI-first protocol engine.

The critical command is:

```text
clista state show
```

If it can reconstruct the current reasoning state from only the append-only log, the protocol spine works.

The validity command is:

```text
clista validate
```

If it rejects invalid event logs with clear event-level errors, the protocol can govern reasoning state instead of merely projecting it.

The integrity command is:

```text
clista integrity verify
```

If it verifies canonical hashes, the event log can be trusted as history rather than just read as data.

For v0.6 chained logs, add `--strict` to require protocol versions, hash versions, and previous-hash links.

The continuity command is:

```text
clista continuity export --out continuity.json
clista continuity resume --packet continuity.json
```

If it produces and resumes a verifiable Continuity Packet, projected reasoning state can survive context loss without treating the transcript as memory.

The compatibility command is:

```text
clista compatibility verify --packet continuity.json
```

If it verifies the packet against the local protocol capability set, required verification layers, and active amendment support, portable reasoning can fail closed instead of relying on best effort acceptance.

The interoperability command is:

```text
clista interoperability verify --packet continuity.json
```

If it verifies declared semantics, event meanings, and object meanings, portable reasoning can preserve protocol meaning instead of merely matching packet structure.

The federation command is:

```text
clista federation verify
```

If it verifies external state references without importing remote authority, independent ClisTa contexts can align without centralizing governance.

The negotiation command is:

```text
clista negotiation verify
```

If it verifies exchange terms without authority transfer, independent ClisTa contexts can resolve differences without merging governance.

The identity command is:

```text
clista identity show --participant par_troy
```

If it reconstructs roles, active authority, revoked authority, and authority history from the event log, portable reasoning stays accountable after it leaves its original context.

The attribution command is:

```text
clista attribution list
```

If it traces claims, assumptions, evidence, objections, decisions, outcomes, forks, merges, and governance reviews back to participants and event-time authority context, reasoning contributions are accountable without becoming reputation.

The provenance command is:

```text
clista provenance verify
```

If it verifies where each contribution came from, what transformation introduced it, and whether source lineage was available at contribution time, accountability becomes auditability without becoming scoring.

The learning command is:

```text
clista learning review
```

If it derives pattern-level learning signals from outcomes without ranking participants, sources, agents, or models, reasoning can improve without becoming reputation.

The adaptation command is:

```text
clista adaptation review
```

If it recommends governance review from learning signals without changing authority, rules, gates, or thresholds, governance can adapt without becoming hidden mutation.

The amendment command is:

```text
clista amendment verify
```

If it verifies explicit approved protocol changes without treating recommendations as amendments, governance can authorize improvement without implicit mutation.

Anti-pattern:

```text
vibes with hashes
```

A system that hashes artifacts without proving who authored them, what authority they carried, or why their contributions should be trusted.

Provenance is not truth ranking. It records source lineage; it does not score sources, participants, or models.

Learning is not reputation. It updates reasoning patterns from outcome evidence; it does not change participant authority or assign trust scores.

Adaptation is not governance mutation. It recommends authorized review; it does not execute governance changes.

Recommendation is not amendment. Amendments require explicit approval by active governance authority.

Continuity is not transcript replay. A resumed thread is trusted because projected state verifies, not because a model remembers the conversation.

Compatibility is not best effort acceptance. Unsupported state is not valid state.

Interoperability is not semantic loss. Translation is not reinterpretation.

Federation is not centralization. Shared state is not shared authority.

Negotiation is not authority transfer. Agreement is not governance merger.

## Repository Boundary

This repository is `clista-protocol`.

It is not `clista-app`, `clista-ui`, or `clista-platform`.

Do not build UI, agent orchestration, graph databases, governance portals, or platform features until the protocol spine works.
