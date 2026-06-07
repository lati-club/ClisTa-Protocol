# Scenario Demo Commands

Run from the repository root.

These commands are the public external replay path for the M27 scenario. They use repo-relative paths and existing CLI commands only.

```sh
node src/cli.js validate --events examples/scenario-demo/events.ndjson
node src/cli.js state show --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js export --events examples/scenario-demo/events.ndjson
node src/cli.js attribution list --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js provenance trace dcr_limited_beta --events examples/scenario-demo/events.ndjson
```

Inspect the result:

- `validate` proves the scenario event log is accepted protocol truth.
- `state show` shows the durable reasoning state for the demo thread.
- `export` serializes the projected state for reload or inspection.
- `attribution list` shows who contributed each durable object.
- `provenance trace dcr_limited_beta` shows the source trail behind the decision.

Expected compact state:

```text
examples/scenario-demo/expected-state.json
```

No new scenario command is required. This demo workflow makes protocol state understandable and externally replayable from the public artifact. It does not create trust, protocol authority, governance approval, amendment approval, compatibility proof, distribution proof, installation proof, product readiness, UI, agents, pitch cleanup, external user testing, or M29.
