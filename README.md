# ClisTa Protocol

Here's a yes — now trace its shape.

A normal decision system records:

```text
approved / rejected
```

ClisTa records an accountable decision state:

- evidence carried into the decision
- assumptions that shaped it
- objections that survived approval
- minority reports
- authority trails
- provenance traces
- bounded scope and verification state

In the bundled scenario, a team approves an AI support-assistant beta. The approval is not a
boolean. It is a yes with its accountability structure fused on: 4 evidence items, 2
assumptions, 3 claims, a privacy objection that survived the yes, 2 governance reviews, a
minority report, a provenance trace, authority context — and a scope *narrower than the
question asked*: redacted sample tickets only.

That is the product value: ClisTa does not just record that a decision was made. It records
the shape that made the decision accountable — and anyone holding the event log can
reconstruct that shape.

```text
conversation -> event log -> projection -> verification -> accountable state
```

Operating law: **conversation is input; reasoning state is output.**

## Quickstart

Prerequisite: Node.js >= 18.

```sh
git clone https://github.com/lati-club/clista-protocol.git
cd clista-protocol
npm install
npm run clista -- help
```

First successful workflow:

```sh
npm run clista -- validate
npm run clista -- state show
npm run clista -- export
npm run clista -- continuity export --out continuity.json
npm run clista -- continuity verify --packet continuity.json
npm run clista -- release verify --tag v0.30.2-protocol-release
npm run clista -- release manifest --out .clista/release-manifest.json --tag v0.30.2-protocol-release
npm run clista -- runtime verify --manifest .clista/release-manifest.json
npm run clista -- runtime audit --manifest .clista/release-manifest.json
```

Expected outcomes on a fresh clone: every command above exits 0. The two continuity steps
report `resumeStatus: "degraded"` — the bundled origin thread predates v0.24 — and list the
legacy causes in `degradationReasons`. Degraded continuity on this fixture is the documented
boundary, not a broken install.

For the expanded first-run guide and failure triage, see `docs/quickstart.md`.

## The Scenario Demo — Trace a Yes Yourself

```sh
node src/cli.js validate --events examples/scenario-demo/events.ndjson
node src/cli.js state show --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js export --events examples/scenario-demo/events.ndjson
node src/cli.js attribution list --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js provenance trace dcr_limited_beta --events examples/scenario-demo/events.ndjson
```

Twenty-three events in `examples/scenario-demo/events.ndjson` encode the full deliberation.
The five commands above reconstruct it: validation, the projected decision state, a portable
integrity-checked export, 18 attributions binding every contribution to a participant and
their event-time authority, and a provenance trace from the approved decision
(`dcr_limited_beta`) back through the claims, reviews, and surviving objection to the raw
evidence. Compare what you see against `examples/scenario-demo/expected-state.json` (a compact
summary for manual inspection; there is no comparator command yet).

This replay has been audited externally: a reviewer with no insider knowledge reproduced it
from a clean public checkout — no hidden builder state, no unpublished files, no absolute
local paths. What the replay proves is reproducibility of structure. What it does not prove:
that the decision was good, that the evidence is true, or that anything here is trusted,
approved, or production-ready. Ask the four questions of any year-old decision in your own
organization — *what did we know, what did we assume, who disagreed, who had authority* —
then ask them of `dcr_limited_beta`. That difference is the protocol.

## Success Means

| Command | Success means | Success does not mean |
| --- | --- | --- |
| `validate` | The append-only event log passed validator checks. | Every claim is true or wise. |
| `state show` | Reasoning state reconstructed from events alone. | The transcript is memory or authority. |
| `export` | Projected state serialized portably, integrity-checked. | Trust or approval is granted. |
| `continuity verify` | A continuity packet matches its event log, projection, and hashes. | Context transfer is trusted memory. |
| `release verify` | The release artifact binds source, tag, version, hashes, verifiers. | The release is trusted or approved. |
| `runtime verify` | The local runtime matches an existing release manifest. | Running code is verified by default. |
| `runtime audit` | The documented verification path works for a fresh user. | Anything beyond that path is proven. |
| Scenario demo | One realistic reasoning lifecycle is durable, replayable state. | A product platform exists. |

## Protocol Spine

- Append-only NDJSON event log — the source of truth.
- Deterministic projection — same events, same state, for anyone, no privileged server.
- CLI-first protocol engine — every capability is a verifiable command.

The two load-bearing commands: `clista state show` (if it can reconstruct current reasoning
state from only the log, the spine works) and `clista validate` (if it rejects invalid logs
with event-level errors, the protocol governs state instead of merely projecting it).

The full capability set, by layer — each command verifies one boundary and fails closed:

| Layer | Command | Passing proves |
| --- | --- | --- |
| Integrity | `integrity verify [--strict]` | The log is verifiable history, not just readable data. |
| Continuity (N2) | `continuity export / resume / verify` | A successor resumes settled state from the verified packet without transcript replay — see [N2: Resumption Without Replay](docs/protocol/v0/n2-resumption-without-replay.md). |
| Compatibility | `compatibility verify` | Unsupported state fails closed instead of best-effort accepted. |
| Interoperability | `interoperability verify` | Declared semantics survive transfer; translation isn't reinterpretation. |
| Federation | `federation verify` | External state can be referenced without importing remote authority. |
| Negotiation | `negotiation verify` | Contexts can resolve differences without merging governance. |
| Execution | `execution verify` | Performed action is evidenced under authorized scope — intent ≠ completion. |
| Outcome | `outcome verify` | Observed effect is checked against intended effect — completion ≠ success. |
| Learning | `outcome-learning verify`, `learning review` | Lessons derive from outcomes without rewriting prior rationale or ranking people. |
| Review | `review verify` | Required examination routes without becoming approval. |
| Recovery | `recovery verify` | Trusted projection restores without rewriting or hiding invalid history. |
| Release | `release verify` | The repository artifact is bound and reproducible. |
| Runtime | `runtime verify / audit` | The running code matches a manifest; the documented path works cold. |
| Identity | `identity show` | Roles and authority history reconstruct from the log. |
| Attribution | `attribution list` | Every contribution traces to a participant and event-time authority. |
| Provenance | `provenance verify / trace` | Each contribution's source lineage and transformation are auditable. |
| Adaptation | `adaptation review` | Learning can recommend governance review without mutating governance. |
| Amendment | `amendment verify` | Protocol changes require explicit approval — recommendations don't mutate rules. |

Layer details, event families, and the primitive map: `docs/protocol/v0/`.

## Boundaries — What Green Checks Do Not Mean

This section exists once, on purpose. Every verifier in ClisTa keeps `trusted: false` until
something *outside* the protocol grants trust — verification of structure is never endorsement
of content. The anti-pattern ClisTa refuses to be:

```text
vibes with hashes
```

— a system that hashes artifacts without proving who authored them, under what authority, or
why their contributions should be trusted.

The standing boundary rules, each load-bearing:

- Provenance is not truth ranking. Learning is not reputation. Adaptation is not governance
  mutation. Recommendation is not amendment.
- Continuity is not transcript replay. Compatibility is not best-effort acceptance.
  Federation is not centralization. Negotiation is not authority transfer.
- Execution is not intent. Completion is not success. Learning is not retroactive
  justification. Review is not approval. Recovery is not history rewrite.
- Release is not trust. Runtime verification is not attestation. Layer versions are
  capability boundaries, not release numbers — continuity may honestly report an older
  `protocolVersion` than the package version, because the portability boundary moved less
  recently than the artifact.

This repository is `clista-protocol` — the protocol spine only. UI, agent orchestration, and
platform features are out of scope until the spine has earned them.

## Run the Debate Pack on Your Own Decision

`pack/` is the distributable Stage 0 debate pack: `PROMPT_PACK.md` (roles, rules, close
protocol), `LEDGER_TEMPLATE.md` (the artifact of record), and `RUNBOOK.md` (how to run an
instrumented external run and where to report it). It works with AI agents from any vendor,
humans, or both. External runs feed a public, bidirectional gate (`pack/GATES.md`): if five
external runs don't materialize by 2026-09-07, or runs show no advantage, the productization
claim dies on the record. Failed and abandoned runs are explicitly wanted evidence.

## License

Code is licensed under Apache-2.0 (see `LICENSE`). Documentation and the debate prompt pack
are licensed under CC BY 4.0. Attribution: lati-cooki.
