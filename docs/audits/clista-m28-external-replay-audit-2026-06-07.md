# ClisTa M28 External Replay Audit — Observation Report

- **Date:** 2026-06-07
- **Repo:** github.com/lati-cooki/clista-protocol (clean `--depth 1` clone at `/tmp/clista-replay-audit`)
- **Package version:** 0.28.0
- **Method:** Fresh agent with zero insider context, restricted to the cloned repo, instructed to follow the documented M27 scenario replay end to end and report one lightweight observation.

## Verdicts

1. **Can I reproduce the M27 scenario from the docs without insider help?** Yes — the 5 scenario commands work verbatim from a clean checkout with no insider knowledge; only the surrounding quickstart (release/runtime verify) breaks.
2. **Can I tell what durable state ClisTa produced?** Yes — an approved, evidence-linked decision with a preserved objection and minority report, matching `expected-state.json` (verified manually, since no comparator exists).
3. **Can I tell what the replay proves and what it does not?** Yes — the docs are almost pathologically explicit about boundaries; the replay proves reproducibility of one fixture, not trust, truth, or product readiness.

## Observation

### Where did they start?
`README.md` at the repo root — the only obvious entry point, with a Quickstart section plus an explicit "scenario demo" block pointing at `examples/scenario-demo/`. Also read `examples/scenario-demo/README.md` and `commands.md`, which restate the replay commands cleanly.

### What command did they try first?
`npm install`, then `npm run clista -- help` (exactly as the README orders them). Both worked instantly — zero dependencies, Node 22 vs required >=18.

### Did install/setup block them?
No. `npm install` finished in ~0.3s ("up to date, audited 1 package"). No build step, no env vars, no config. The smoothest part of the whole experience.

### Did the scenario replay work?
Yes, completely. All five documented commands ran from repo root with repo-relative paths and exit code 0:

- `node src/cli.js validate --events examples/scenario-demo/events.ndjson` → `{"valid": true, "errors": []}`
- `state show --thread thd_scenario_demo ...` → full projected reasoning state
- `export ...` → full protocol export, integrity `valid: true`, `eventCount: 23`
- `attribution list --thread thd_scenario_demo ...` → 18 attributions
- `provenance trace dcr_limited_beta ...` → full source trail for the decision

However, the README's broader "first successful workflow" did NOT fully succeed:

- **`release verify` failed twice** — the clone had no tags; after `git fetch --tags` it still failed because the default expected tag `v0.28.0-protocol-release` doesn't exist. The real tag is `v0.28.0-external-replay-audit`, and master HEAD `334bacc` is one commit past that tag at `991acd0`. It only passed after checking out the tag AND passing `--tag` explicitly.
- **`runtime verify` reported `valid: false` with `dirty_working_tree`** — caused by `continuity.json` and `package-lock.json`, files that the README's own quickstart commands created. The documented happy path defeats itself. `runtime audit` consequently also reported `valid: false` / `runtimeUsable: false`.

### Did state/export make sense?
Yes. The durable state is legible: an approved decision (`dcr_limited_beta`: "Run a bounded support assistant beta using redacted sample tickets only"), with its rationale, 4 evidence items, 2 assumptions, 3 claims, 3 positions, a preserved privacy objection (`obj_unredacted_data_risk`), 2 reviews, and a minority report (`mnr_privacy_gate`). All 17 object IDs from `expected-state.json` appear in the projection, and event count 23 matches.

**Caveat:** there is no documented comparison command — "compare with expected-state.json" means eyeballing/grepping, and the expected file is a compact summary, not a byte-comparable output.

### Did attribution/provenance make sense?
Yes, surprisingly well. `attribution list` ties each contribution to a participant, their role at event time, and whether they had authority (e.g., research lead committed evidence as `analyst`). `provenance trace dcr_limited_beta` shows the decision was `observed` from 4 evidence items, `summarized` from claims/objection/reviews, and `inferred` from assumptions, with per-source hashes and `sourceIntegrityVerified: true`, and that the decision maker `par_maya` held thread-scoped `decision_owner` authority. The chain from raw evidence to approved decision is genuinely traceable.

### What confused them?
1. `release verify` failing on a clean clone with `git_tag does not resolve: v0.28.0-protocol-release` — that tag name appears to be a hardcoded default that never matched any published tag; had to guess `--tag v0.28.0-external-replay-audit` from `git tag` output.
2. `runtime verify` failing because of files the quickstart itself just told the user to create — a fresh user following the README in order cannot get a clean runtime verify.
3. `continuity verify` returns `valid: true` but `resumeStatus: "degraded"` and `protocolVersion: 0.24.0` on a 0.28.0 package — the README pre-explains the version skew, but valid-yet-degraded with empty `reasons` left them unsure whether they'd succeeded.
4. No pass/fail comparator for `expected-state.json`; "compare" is left to the user.
5. The README's wall of "X is not Y" boundary disclaimers (~30 of them) drowns out the actual instructions; it's easier to find what ClisTa is NOT than what it does.

### What did they think ClisTa was proving?
As an outsider: ClisTa is an append-only event log plus a deterministic projector for team reasoning. The M27 scenario proves that a deliberation (evidence → assumptions → claims → positions → objection → reviews → decision → minority report) can be stored as 23 NDJSON events and reconstructed by anyone into the same durable state — including who said what under what authority, and crucially that the dissenting privacy objection survives the approval rather than being papered over. The M28 replay proves a stranger can do this from public files alone. It does NOT prove the decision was good, that any hash chains to external reality, that the release/runtime is trustworthy (the tooling itself insists `trusted: false`), or that this is usable as a product — and the repo says so, loudly.

## Decision-rule call

| Rule | Result |
|---|---|
| Setup/install blocks → M29 Artifact Installation | No — setup was frictionless |
| Replay works but meaning unclear → M29 Product Narrative Pass | No — verdict 3 was clean |
| Replay works, meaning clear, portability the issue → M29 Protocol Distribution | No — clean clone, repo-relative paths, zero deps |
| Nothing material breaks → pause or invite a second replay | **Yes, for the M27 replay itself** |

**Call: pause or invite a second replay** — but two material defects in the surrounding documented first-workflow (M25/M26 surface, not M27) would contaminate any second observation and should be fixed first:

1. **`release verify` tag default** — points at nonexistent `v0.28.0-protocol-release`; the published tag is `v0.28.0-external-replay-audit`.
2. **`runtime verify` self-defeat** — `dirty_working_tree` triggered by `continuity.json` and `package-lock.json`, files the README's own quickstart creates. Gitignore or exempt them.

Both look like one-line fixes.
