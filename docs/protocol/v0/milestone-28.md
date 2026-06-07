# Milestone 28: External Replay Audit

## Theorem

```text
external_replay = verify(non_builder_can_reproduce_scenario, from_public_artifact_and_docs)
```

## Hard Law

```text
scenario_exists != externally_reproducible_scenario
```

## Capability

M28 audits the existing M27 scenario/demo workflow for external reproducibility.

M27 proved that a realistic scenario exists. M28 proves the narrower replay property: a non-builder can start from a clean public checkout, find the scenario, follow documented commands, validate the fixture, reconstruct durable state, export projected state, and inspect attribution and provenance without private builder context.

M28 is not a new protocol primitive. It is not a new product command. It is an audit around the existing scenario replay path.

## Public Artifact Assumption

The public artifact is the repository-visible checkout:

```text
README.md
docs/quickstart.md
docs/protocol/v0/milestone-27.md
docs/protocol/v0/milestone-28.md
examples/scenario-demo/
src/
schemas/
package.json
```

The replay path must not depend on:

- unpublished files
- hidden builder state
- `.clista/release-manifest.json`
- the canonical `.clista/events.ndjson`
- absolute local paths
- local machine-specific paths
- mutation of unrelated repository state

## Replay Path

From the repository root of a clean checkout:

```sh
node src/cli.js validate --events examples/scenario-demo/events.ndjson
node src/cli.js state show --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js export --events examples/scenario-demo/events.ndjson
```

Inspect attribution and provenance:

```sh
node src/cli.js attribution list --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js provenance trace dcr_limited_beta --events examples/scenario-demo/events.ndjson
```

The expected compact state summary is:

```text
examples/scenario-demo/expected-state.json
```

No `clista scenario audit`, `clista replay audit`, or `clista external-replay audit` command is required for M28. The audit is proven by docs and tests over the existing CLI surface.

## Success Criteria

External replay succeeds when:

- the scenario path is discoverable from repository docs
- documented commands use repo-relative paths
- the fixture exists at `examples/scenario-demo/events.ndjson`
- the fixture validates
- `state show` reconstructs thread `thd_scenario_demo`
- `export` serializes durable protocol state
- expected state matches the projected decision, evidence, assumptions, claims, positions, objection, reviews, and minority report
- attribution for `dcr_limited_beta` identifies the decision owner and authority context
- provenance for `dcr_limited_beta` traces evidence, claims, assumptions, objection, and reviews
- repeated replay produces the same durable result
- replay does not mutate the scenario fixture
- replay does not mutate unrelated `.clista` state

## Boundary

M28 may:

- clarify scenario replay documentation
- add an external replay milestone document
- test clean-checkout replay assumptions
- test deterministic durable replay output
- test attribution and provenance inspectability
- test that replay remains read-only
- test that replay does not overclaim

M28 must not:

- implement installation
- implement distribution
- implement network behavior
- build UI
- add agents
- do pitch cleanup
- start an external testing program
- start M29
- create trust
- create protocol authority
- create governance approval
- create amendment approval
- create compatibility proof
- create distribution proof
- create installation proof
- claim product readiness

## Relation To Protocol State

M28 does not add event types.

M28 does not change validation rules.

M28 does not change projection behavior.

M28 does not change export behavior.

M28 does not append events or mutate projected reasoning state.

M28 proves external reproducibility of the existing scenario only. It does not prove product readiness, package installation, artifact distribution, trust, governance approval, amendment approval, compatibility, or protocol authority.
