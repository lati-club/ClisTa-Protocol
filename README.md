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

## Quickstart

Prerequisite:

```text
Node.js >=18
```

Clone and run from a local checkout:

```sh
git clone https://github.com/lati-cooki/clista-protocol.git
cd clista-protocol
npm install
```

Use the local CLI through the package script:

```sh
npm run clista -- help
```

First successful workflow:

```sh
npm run clista -- validate
npm run clista -- state show
npm run clista -- export
npm run clista -- continuity export --out continuity.json
npm run clista -- continuity verify --packet continuity.json
npm run clista -- release verify
npm run clista -- release manifest --out .clista/release-manifest.json
npm run clista -- runtime verify --manifest .clista/release-manifest.json
```

Success means:

| Command | Success means | Success does not mean |
| --- | --- | --- |
| `validate` | The append-only event log passed validator checks. | Every claim is true or wise. |
| `state show` | ClisTa reconstructed reasoning state from events. | The transcript is memory or authority. |
| `export` | Projected protocol state can be serialized for portability. | The export grants trust, governance, or approval. |
| `continuity verify` | A continuity packet matches its event log, projection, state hash, and required verification layers. | Context transfer is trusted memory or central authority. |
| `release verify` | The release artifact binds source, tag, package version, CLI, schema, hashes, and verifier results. | The release is trusted, approved, compatible by itself, or authorized as governance. |
| `runtime verify` | The local runtime matches an existing release manifest. | Running ClisTa is trust, OS attestation, CI trust, or remote runtime trust. |

Failure triage:

| Failure | What it means | Inspect next | Likely next command |
| --- | --- | --- | --- |
| Missing file | A path argument points to a file that does not exist. | The path and current directory. | `pwd` then rerun with the correct `--events`, `--packet`, or `--manifest` path. |
| Missing required option | A command needs another flag. | `npm run clista -- help` for the command shape. | Rerun with the missing `--<option>`. |
| Validation failure | The event log is not trusted protocol state. | The returned `event_id`, `event_type`, and `reason`. | `npm run clista -- validate --events <path>` |
| Integrity failure | Hashes or event-chain evidence do not match. | Integrity reasons and the event log head. | `npm run clista -- integrity verify --events <path>` |
| Continuity degraded | The packet is valid but not strict for the current boundary. | `verificationMode`, `resumeStatus`, and `reasons`. | `npm run clista -- continuity verify --packet continuity.json` |
| Release manifest missing | A supplied manifest path is absent. | The manifest path or whether one should be generated. | `npm run clista -- release manifest --out .clista/release-manifest.json` |
| Release verify failed | The release artifact does not match its manifest or boundary rules. | `reasons` and `violations`. | `npm run clista -- release verify` |
| Package/tag/version mismatch | `package.json` version and the release tag disagree, or the tag points elsewhere. | `package.json`, `git tag`, and `git rev-parse HEAD`. | `npm run clista -- release verify --tag <tag>` |
| Runtime verify failed | The current runtime drifted from the supplied manifest. | `drift`, `warnings`, and `violations`. | `npm run clista -- runtime verify --manifest .clista/release-manifest.json` |

Release exists does not mean release is trusted. `clista release verify` keeps `trusted: false` by design and does not create protocol authority, governance approval, amendment approval, publishing verification, or compatibility proof.

Runtime verification requires an existing release manifest. It does not silently generate a fresh manifest, because generated proof can describe the current drifted runtime. `clista runtime verify` keeps `trusted: false` by design and does not create protocol authority, governance approval, amendment approval, compatibility proof, package publishing trust, OS attestation, CI trust, or remote runtime trust.

M25 release manifests are repository artifacts, not reasoning-state events. `state show` and `export` may omit release state by design: conversation is input, reasoning state is output, and release verification proves the artifact boundary rather than the conversation state.

Continuity may report `protocolVersion: "0.24.0"` while the package release is `0.25.0` or a later artifact release such as `0.26.0`. Continuity reflects the latest reasoning-state portability boundary; the package version reflects the current released artifact. M25 binds the package artifact and M26 verifies the local runtime without adding a new continuity state layer.

For the expanded first-run guide, see:

```text
docs/quickstart.md
```

## Protocol Spine

- Append-only NDJSON event log.
- Event log as source of truth.
- Projected state derived from events.
- CLI-first protocol engine.

The compressed M0-M25 primitive map is:

```text
docs/protocol/v0/primitive-map.md
```

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

The execution command is:

```text
clista execution verify
```

If it verifies performed action with evidence under authorized scope and constraints, execution can be trusted without treating intent as completion.

The outcome command is:

```text
clista outcome verify
```

If it verifies observed effect against intended effect with evidence, completed execution can be evaluated without treating completion as success.

Terminology note: M3 decision outcomes compare a decision's declared expected consequence against later audits for decision scoring. M21 protocol outcomes evaluate an execution-linked observed effect against its intended effect. The CLI namespace overlaps, but the event families are distinct.

The outcome-learning command is:

```text
clista outcome-learning verify
```

If it verifies lessons derived from evaluated outcomes without rewriting prior reasoning, the protocol can improve without retroactive justification.

`clista outcome-learning derive` accepts optional `--evidence`. When omitted, the learning signal uses the latest outcome evaluation evidence. `clista outcome-learning lesson` also accepts optional `--evidence`; when omitted, the lesson uses the source signal evidence. Read-only outcome-learning commands accept `--events <path>` for fixture and export inspection.

The protocol review command is:

```text
clista review verify
```

If it verifies required review routing without treating review as approval, state changes that require examination can be held for review without mutating governance, authority, recovery, rollback, accountability, or the reviewed object.

M23 review commands are distinct from `clista review submit`, which remains the M3 decision-review command for decision requests.

The protocol recovery command is:

```text
clista recovery verify
```

If it verifies reviewed recovery records without rewriting history, ClisTa can quarantine unsafe subjects and restore recovery-aware trusted projection while keeping invalid history visible and auditable.

M24 recovery commands append recovery records only. Recovery is not approval, amendment, consensus, governance mutation, authority creation, rollback, or event replacement.

The protocol release command is:

```text
clista release verify
```

If it verifies a release manifest, ClisTa can bind package version, Git commit, Git tag, CLI entrypoint, schema hashes, source hashes, capability declarations, verifier results, and export shape without treating the release itself as trust.

M25 release manifests are repository artifacts, not reasoning-state events. Release is not trust, protocol authority, governance approval, amendment approval, publishing verification, or compatibility proof by itself.

The protocol runtime command is:

```text
clista runtime verify --manifest .clista/release-manifest.json
```

If it verifies the local execution environment against an existing release manifest, ClisTa can detect runtime drift without treating running code as verified by default.

M26 runtime verification is not trust, protocol authority, governance approval, amendment approval, compatibility proof, package publishing trust, OS security attestation, CI trust, or remote runtime trust. It does not mutate the event log or projected reasoning state.

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

Delegation is not authority surrender. Delegated action is scoped and attributable.

Non-participant delegation is not actor exemption. Every delegate that records action resolves to an accountable participant.

Execution is not intent. Completion requires evidence that the authorized action was performed under verified scope and constraints.

Completion is not success. Outcome evidence must satisfy the intended effect before performed action can be evaluated as successful.

Learning is not retroactive justification. Lessons can derive from evaluated outcomes, but they cannot rewrite prior rationale, intended effect, governance, or authority.

Review is not approval. Required review routes state changes through examination before further action; it does not approve, repair, recover, roll back, score accountability, create authority, create consensus, or mutate the reviewed state.

Recovery is not history rewrite. It can restore trusted projection membership from verified checkpoints and repair records, but it cannot delete, replace, hide, or normalize invalid events.

Layer versions are capability boundaries, not release numbers. A cleanup release can advance the package or tag version while unchanged layers keep the protocol version where that capability was introduced.

The export schema describes projected protocol state. The validator is the strict trust contract for event logs.

## Repository Boundary

This repository is `clista-protocol`.

It is not `clista-app`, `clista-ui`, or `clista-platform`.

Do not build UI, agent orchestration, graph databases, governance portals, or platform features until the protocol spine works.
