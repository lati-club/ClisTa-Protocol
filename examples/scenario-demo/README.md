# Scenario Demo: Support Assistant Beta Decision

This scenario is a realistic reasoning lifecycle for a team deciding whether to run a limited support assistant beta.

It demonstrates ClisTa's core law:

```text
Conversation is input.
Reasoning state is output.
```

The scenario includes:

- evidence from support metrics, staffing, privacy review, and fixture planning
- assumptions about beta scope and redaction
- claims for and against the beta shape
- positions from delivery, research, and privacy reviewers
- a preserved privacy objection
- conditional reviews
- an approved decision
- a minority report preserving the objection
- derived attribution and provenance trails

## Run It

From the repository root:

```sh
node src/cli.js validate --events examples/scenario-demo/events.ndjson
node src/cli.js state show --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js export --events examples/scenario-demo/events.ndjson
```

Optional inspection:

```sh
node src/cli.js attribution list --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js provenance trace dcr_limited_beta --events examples/scenario-demo/events.ndjson
node src/cli.js decision summary --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
```

The `decision summary` command surfaces the Phase 0 "answer view": a concise response to "what was decided, why, who dissented, what next" derived strictly from the event log via the projector. It is the executable realization of the Phase 0 acceptance test. It prints JSON by default; add `--format text` (or `md`) for a human-readable markdown rendering of the same four answers.

## External Replay

The scenario replay path uses only repository-visible files and repo-relative paths. A non-builder should be able to start from a clean checkout, find `examples/scenario-demo/`, run the documented commands, compare the result with `examples/scenario-demo/expected-state.json`, and inspect attribution and provenance without private builder context.

The replay path does not require `.clista/release-manifest.json`, the canonical `.clista/events.ndjson`, unpublished files, absolute local paths, or mutation of unrelated repo state.

## Expected State

The compact expected state summary is:

```text
examples/scenario-demo/expected-state.json
```

M28.1 keeps comparison manual. There is no expected-state comparator command.

The key durable output is an approved decision:

```text
Run a bounded support assistant beta using redacted sample tickets only.
```

The exported state should also preserve the privacy objection and minority report. That is the point of alignment before action: the team can move while the unresolved risk remains visible.

## Boundary

This is M27 Protocol Scenario / Demo Workflow, externally audited by M28.

```text
scenario_usability = reproduce(realistic_reasoning_lifecycle, from_documented_commands_and_projected_state)
demo_workflow != product
external_replay = verify(non_builder_can_reproduce_scenario, from_public_artifact_and_docs)
scenario_exists != externally_reproducible_scenario
```

The demo workflow makes protocol state understandable. The external replay audit proves reproducibility of this scenario only. It does not create trust, protocol authority, governance approval, amendment approval, compatibility proof, distribution proof, installation proof, product readiness, UI, agents, pitch cleanup, external user testing, or M29.
