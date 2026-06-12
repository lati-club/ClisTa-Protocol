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

## Start here — run an external debate (this is the only deadline)

ClisTa's productization claim sits on a public, bidirectional gate: **five external
debate-pack runs by 2026-09-07, or the claim dies on the record** (`pack/GATES.md`). An
"external run" is a team we did not prompt, host, or grade, running the pack on their own
real decision in their own harness. Running one is the single highest-impact thing a
visitor can do here — it moves this project more than any code change, because the format's
own debate ruled that further clean closures *by us* confirm nothing.

You can go from here to a reportable run in under an hour:

1. **Get the pack.** `pack/PROMPT_PACK.md` (roles, rules, close protocol),
   `pack/LEDGER_TEMPLATE.md` (the artifact of record), `pack/RUNBOOK.md` (how to run and
   where to report). Works with AI agents from any vendor, humans, or both. No tooling
   required — one markdown ledger is the whole artifact.
2. **Pick a real decision** that passes the applicability check in `PROMPT_PACK.md` (hard
   to reverse, multi-party or multi-session, claims checkable against real artifacts).
3. **Run the rounds and keep the ledger.** Capture `failures.md` and `cost.md` alongside
   it — that instrumentation is what makes the run count (`pack/RUNBOOK.md`).
4. **Report it.** Easiest — no software needed:
   [**open a prefilled report issue**](https://github.com/lati-club/ClisTa-Protocol/issues/new?title=External%20run%20report%3A%20%3Cdecision%20title%3E&body=%3C%21--%20ClisTa%20external%20debate-pack%20run.%20Edit%20%3Cdecision%20title%3E%20in%20the%20issue%20title%20above.%20--%3E%0A%0AThis%20run%20was%20NOT%20prompted%2C%20hosted%2C%20refereed%2C%20or%20graded%20by%20the%20ClisTa%20project.%0Aepistemic_state%3A%20unaudited%20%E2%80%94%20a%20clean%20closure%20means%20well-shaped%2C%20not%20right.%0A%0A%23%23%20Artifacts%20%28attach%20or%20link%29%0A-%20%5B%20%5D%20LEDGER.md%20%E2%80%94%20closure_state%3A%20closed%2C%20every%20row%20terminal%2C%20Transfer%20State%20filled%0A-%20%5B%20%5D%20failures.md%20%E2%80%94%20discipline%20failures%20observed%20%28or%20%22none%20observed%22%29%0A-%20%5B%20%5D%20cost.md%20%E2%80%94%20wall-clock%2C%20rounds%2C%20tokens%2C%20human-minutes%20of%20format%20overhead%0A-%20%5B%20%5D%20outcome.md%20%E2%80%94%20later%2C%20if%20the%20decision%20gets%20executed%0A%0A%23%23%20One-line%20integrity%20verdict%0AWas%20the%20debate%20real%3F%0A)
   (the title and an artifact checklist are filled in for you), then attach `LEDGER.md`,
   `failures.md`, and `cost.md`. Or email them to `lati@clista.ai`.

   *Optional, only if you captured the run as a ClisTa event log:*
   `npm install && npm run clista -- run report --events <your-run>.ndjson --out submission.json`
   validates the log, writes a portable `submission.json`, and prints the same reporting link.
   It fails closed on an invalid log and keeps `trusted: false`.

**Failed and abandoned runs are wanted evidence** — a run that exposes the format is worth
more than one that flatters it. Nothing here becomes trusted by running it: verification of
structure is never endorsement of content, and only blind external judging
(`docs/judging.md`) decides whether a run counts toward the gate.

Everything below is the protocol tour — what the engine is, and how to verify it yourself.

## Try It in 30 Seconds

Prerequisites: Node.js >= 18, plus Python 3 (used only to re-ingest the session). Nothing to install — the engine itself has zero npm dependencies.

```sh
git clone https://github.com/lati-club/ClisTa-Protocol.git
cd clista-protocol
npm run replay
```

This reproduces the bundled agent-session example in a clean room and verifies it end to
end: it re-ingests a session into a canonical event log, confirms the result is
byte-identical to the committed one, validates it against the engine, and prints the
decision answer view — *what was decided, why, who dissented, what should happen next*. It
ends with `Clean-room replay PASSED`. No server, no account, no setup — the event log is the
source of truth.

## Quickstart

Prerequisite: Node.js >= 18.

```sh
git clone https://github.com/lati-club/ClisTa-Protocol.git
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

### Scope freeze until the gate lifts

The spine is frozen until the EXTERNAL-RUNS gate is decided (`pack/GATES.md`): no new
verifier layers until five external runs exist, and four existing layers (`amendment`,
`adaptation`, `learning`, `negotiation`) are frozen-but-supported — verifiers stay passing,
event families don't grow. Bugfixes, docs, tests, and the debate pack are always in scope.
See `CONTRIBUTING.md` for the full constraint and what it means for PRs.

## Worked example — a sample Challenge Record (`pilot-dryrun/`)

`pilot-dryrun/` is a full dress rehearsal of one application of the debate pack: the engine,
unchanged, used to produce a sample *Challenge Record* for a model-risk-management deployment
decision (the public Epic Sepsis Model case). It adapts the pack to MRM roles
(`pilot-dryrun/pack-mrm/`), runs five sealed review sessions as ClisTa event logs that each
`validate` and replay, and aggregates them into a 9-section Challenge Record with a verification
bundle (`pilot-dryrun/verification.md`, runnable cold). No new protocol code or layers — it
exercises the frozen spine, so it stays within the scope freeze above.

It is a **sample against public sources, not advice, and not productization evidence**:
`trusted: false` throughout; all five sessions came from one model family and one author, so the
Record discloses its convergence as **suspected single-author monoculture, not independent
corroboration**; and the sessions are producer-run, so — like everything we run ourselves — they
**count toward no gate** (`pack/GATES.md`). It is included as a worked example of what the
deliverable looks like and how the format surfaces its own weaknesses, nothing more.

## License

Code is licensed under Apache-2.0 (see `LICENSE`). Documentation and the debate prompt pack
are licensed under CC BY 4.0. Attribution: lati-cooki.

## Running Example: Governing Octopus CSV CLI Build with ClisTa + ThreadHub

This is the live, operationalized example of the full integration (as of 2026-06-12):

- Octopus runs the CSV CLI arms (parsing, stats, CLI integration + error handling).
- ThreadHub stores the execution signals (cascade-blocks → ObjectionRaised) in `octo-build`.
- ClisTa turns them into accountable governance in a dedicated ThreadHub thread `clista-csv-cli-build-v4` (and the clean event log `examples/clista-csv-cli-build.ndjson`).

Key artifacts:
- Clean combined log — **25 events, validates clean** (`node src/cli.js validate`, exit 0) and projects a full `clista.threadState.v0`: `examples/clista-csv-cli-build.ndjson`. Models the build arms as `DelegationGranted` → delegation-authorized `ExecutionStarted`, with the `DecisionMerged` last (governance ratifies after review, integrating 4 live cascade-blocks incl. the error-handling arm).
- Dedicated ThreadHub thread: slug `clista-csv-cli-build-v4` (id `thd_89cda49b0116`), 26 records, head `sha256:373e3d906a353131905e5c79251afb0f28aacc3b4cc6b0741d77e2a617c05612`. (Lineage: original `clista-csv-cli-build` / `thd_99f812b60f7c` was a pre-fix draft that didn't validate → `-v2` / `thd_f35bd1d6ffdc` first validating version → `-v3` adds the error-handling arm → `-v4` hash-chains the event log. Predecessors kept as immutable history.)
- N2 (resume without replay): the log is hash-chained (per-event `content_hash`/`previous_hash`), so a successor resumes the settled state from a continuity packet alone with `resumeStatus: verified` (strict), not degraded. See [N2](docs/protocol/v0/n2-resumption-without-replay.md).
- Raw signals: `octo-build` slug (8 records, the 3 live blocks at seq 5/6/7 with hashes `27226cae...`, `6c39ae70...`, `460f601d...`)
- Cross-links: ClisTa `EvidenceCommitted` events carry the exact ThreadHub record hashes as artifacts. Provenance traces "ThreadHub octo-build seq N (live arm-...)" + hash.
- Attribution: `par_octopus` for execution dissent; `id_troy` for governance (claims, evidence commits from the live blocks, review).

### Quick Exploration (from clista-protocol root)
```sh
node src/cli.js validate --events examples/clista-csv-cli-build.ndjson
node src/cli.js state show --thread thd_csv_cli_build_consensus_mqa0yqno_95493e23 --events examples/clista-csv-cli-build.ndjson
node src/cli.js attribution list --events examples/clista-csv-cli-build.ndjson
node src/cli.js provenance trace --contribution evd_live_p2 --events examples/clista-csv-cli-build.ndjson
```

### In ThreadHub (from ThreadHub root)
```sh
node bin/cli.js verify --thread clista-csv-cli-build-v4
node bin/cli.js verify --thread octo-build
node bin/cli.js export --thread clista-csv-cli-build-v4 | head -c 1000
```

See `docs/clista-csv-cli-build.md` (in the ThreadHub repo) for full details, how the 3 live arms were added one-at-a-time, commands, and operational notes for future arms (tests, docs, error handling).

This example is the reference for "ClisTa as the consensus layer over Octopus execution via ThreadHub as the verifiable substrate." The clean log + dedicated thread keep the demo pollution-free while the raw signals stay in the general Octopus log.

