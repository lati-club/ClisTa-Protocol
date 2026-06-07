# ClisTa Quickstart

Here’s a yes — now trace its shape.

This guide is for a fresh local checkout. It shows how to reproduce the documented workflow and replay the scenario where ClisTa turns a limited beta approval into accountable decision state.

The scenario proof is concrete: the approval carries evidence, assumptions, a preserved privacy objection, a minority report, authority context, provenance, and bounded scope. The quickstart uses existing commands only.

```text
release_quickstart = reproduce(first_successful_workflow, from_docs_alone)
documented release != usable release
```

## Prerequisite

ClisTa runs on Node.js 18 or newer.

```sh
node --version
```

## Setup

```sh
git clone https://github.com/lati-cooki/clista-protocol.git
cd clista-protocol
npm install
```

Run the CLI from the checkout with:

```sh
npm run clista -- help
```

When ClisTa is installed as a `clista` binary, the same commands can be run without `npm run clista --`.

## First Successful Workflow

Run these commands from the repository root:

```sh
npm run clista -- validate
npm run clista -- state show
npm run clista -- export
npm run clista -- continuity export --out continuity.json
npm run clista -- continuity verify --packet continuity.json
npm run clista -- release verify --tag v0.29.0-product-narrative-pass
npm run clista -- release manifest --out .clista/release-manifest.json --tag v0.29.0-product-narrative-pass
npm run clista -- runtime verify --manifest .clista/release-manifest.json
npm run clista -- runtime audit --manifest .clista/release-manifest.json
```

To replay the scenario demo and trace the yes shape:

```sh
node src/cli.js validate --events examples/scenario-demo/events.ndjson
node src/cli.js state show --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js export --events examples/scenario-demo/events.ndjson
node src/cli.js attribution list --thread thd_scenario_demo --events examples/scenario-demo/events.ndjson
node src/cli.js provenance trace dcr_limited_beta --events examples/scenario-demo/events.ndjson
```

This is the minimum release usage path:

1. Validate the append-only event log.
2. Reconstruct projected reasoning state.
3. Export portable protocol state.
4. Produce a continuity packet.
5. Verify the continuity packet.
6. Verify the release artifact against the published milestone tag.
7. Write a local release manifest for the same tag.
8. Verify the runtime against that existing manifest.
9. Audit that a fresh user can discover and execute runtime verification without insider context.

The scenario demo is a separate M27 replay path. M28 audits that a non-builder can reproduce that scenario from public docs and repo-relative files without hidden builder state. M29 changes the product narrative around that existing proof; it does not change protocol behavior.

## Reading The Scenario

The limited beta approval is the proof case:

```text
Run a bounded support assistant beta using redacted sample tickets only.
```

The approval is not just `approved`. It carries:

- 4 evidence items
- 2 assumptions
- 3 claims
- a privacy objection that survived the yes
- 2 governance reviews
- a minority report
- provenance
- authority context
- bounded scope

That is ClisTa's product shape: raw decision becomes accountable state.

## Reading Success

`validate` succeeds when it returns:

```json
{
  "valid": true,
  "errors": []
}
```

This means the event log passed protocol validation. It does not mean every claim is true or that every decision is wise.

`state show` succeeds when it prints JSON reasoning state. This proves projected state can be reconstructed from the append-only event log. It does not mean the transcript itself is memory or authority.

`export` succeeds when it prints JSON with `schema: "clista.protocol.v0"` and an `events` collection. This makes projected state portable. It does not grant trust, governance, or approval.

`continuity verify` succeeds when it returns `valid: true`. A result such as `resumeStatus: "degraded"` can still be valid; it means the packet is accepted under an explicit compatibility mode rather than strict continuity.

`release verify` succeeds when it returns `valid: true` and `releaseVerified: true`. It binds source, Git tag, package version, CLI entrypoint, schema hashes, source hashes, verifier results, and export expectations.

`runtime verify` succeeds when it returns `valid: true` and `runtimeVerified: true`. It compares the current Node version, package metadata, CLI entrypoint, source hashes, schema hashes, Git binding, worktree status, and verifier reproduction against an existing release manifest.

Generating `.clista/release-manifest.json` is useful for local practice. Independent runtime proof depends on comparing against a manifest produced at the release boundary, not silently generating one inside runtime verification.

`runtime audit` succeeds when it returns `valid: true` and `runtimeUsable: true`. It checks that README, quickstart, protocol docs, CLI help, missing-manifest behavior, valid-manifest behavior, and runtime verification boundaries are clear enough for a fresh user.

The scenario demo succeeds when `examples/scenario-demo/events.ndjson` validates, `state show` reconstructs thread `thd_scenario_demo`, and `export` serializes the resulting protocol state. External replay succeeds when those commands, plus `attribution list` and `provenance trace dcr_limited_beta`, work from a clean checkout using only repo-relative public files. Inspect `examples/scenario-demo/expected-state.json` manually for the compact expected decision, evidence, assumptions, claims, positions, objection, reviews, and minority report; there is no comparator command in M29.

## Reading Failures

| Failure | Meaning | Inspect next | Likely next command |
| --- | --- | --- | --- |
| Missing file | The command was given a path that does not exist. | Current directory and the path argument. | `pwd` then rerun with the corrected path. |
| Missing required option | The command needs a required flag. | The command usage line. | `npm run clista -- help` |
| Validation failure | The event log is not trusted protocol state. | Returned `event_id`, `event_type`, and `reason`. | `npm run clista -- validate --events <path>` |
| Integrity failure | Event hashes or chain links do not match. | Integrity reasons and head hash. | `npm run clista -- integrity verify --events <path>` |
| Continuity degraded | The packet is valid only under explicit compatibility mode. | `verificationMode`, `resumeStatus`, and `reasons`. | `npm run clista -- continuity verify --packet continuity.json` |
| Release manifest missing | The manifest path is absent. | The manifest path or whether a manifest should be generated. | `npm run clista -- release manifest --out .clista/release-manifest.json` |
| Release verify failed | Manifest, source, tag, package, hash, verifier, or boundary checks failed. | `reasons` and `violations`. | `npm run clista -- release verify --tag v0.29.0-product-narrative-pass` |
| Package/tag/version mismatch | `package.json` version and release tag version disagree, or the tag points to a different commit. | `package.json`, `git tag`, and `git rev-parse HEAD`. | `npm run clista -- release verify --tag <tag>` |
| Runtime verify failed | The local runtime does not match the supplied manifest. | `drift`, `warnings`, and `violations`. | `npm run clista -- runtime verify --manifest .clista/release-manifest.json` |
| Runtime audit failed | The documented runtime verification path is missing, unclear, not executable, or overclaims. | `checks` and `violations`. | `npm run clista -- runtime audit --manifest .clista/release-manifest.json` |

## Release Verification Boundary

Release exists does not mean release is trusted.

`clista release verify` proves that the repository artifact matches the release manifest. It keeps these fields false by design:

```text
trusted
protocolAuthority
governanceApproval
amendmentApproval
compatibilityProof
```

Release verification does not create protocol authority, approve governance, approve amendments, publish trust, or prove compatibility by itself.

## Runtime Verification Boundary

Running ClisTa does not mean the runtime is verified.

`clista runtime verify` requires an existing release manifest and compares the current local runtime against it. It does not silently generate a manifest, because that would turn the current runtime into circular proof.

Documented first-run artifacts such as `continuity.json` and `package-lock.json` are not runtime identity. Runtime verification may warn that they exist, but they do not create dirty runtime drift by themselves.

Runtime verification does not create runtime trust, protocol authority, governance approval, amendment approval, compatibility proof, package publishing trust, OS security attestation, CI trust, or remote runtime trust.

Runtime verification does not touch reasoning state, append events, or change projected state.

`clista runtime audit` verifies the usability of that path. It confirms runtime verification is discoverable and bounded, missing manifest failure is clear and actionable, valid manifest success is clear but does not overclaim, and docs explain what runtime verification does and does not prove.

Runtime usage audit does not create trusted release status, runtime trust, protocol authority, governance approval, amendment approval, compatibility proof, or any new reasoning-state record.

## Scenario Demo Boundary

The M27 scenario demo makes protocol state understandable, but it is not a product platform.

The M28 external replay audit proves reproducibility of the existing scenario from public docs and files. It does not prove product readiness.

The M29 product narrative pass proves the public explanation can lead with the verified scenario's affirmative value. It does not change runtime behavior, validation, projection, export, attribution, provenance, trust, protocol authority, governance approval, amendment approval, or compatibility proof.

## Release Versus Reasoning State

M25 release manifests are repository artifacts, not append-only reasoning events.

`state show` and `export` may omit release state by design. This preserves the core law:

```text
Conversation is input.
Reasoning state is output.
```

Release verification proves the artifact boundary. Reasoning state still comes from the event log and deterministic projection.

## Continuity Version Versus Package Version

Continuity may report:

```json
{
  "protocolVersion": "0.24.0"
}
```

while `package.json` reports `0.25.0` or a later package release such as `0.29.0`.

That is expected. Continuity reflects the latest reasoning-state portability boundary. Package and release versions reflect repository artifact releases. M25 verifies the release artifact, M26 verifies the local runtime, M26.1 audits runtime verification usability, M27 adds a documented scenario fixture, M28 audits external replay of that fixture, and M29 updates product narrative. They do not add a new continuity state layer.

## Next Useful Commands

```sh
npm run clista -- integrity verify
npm run clista -- compatibility verify --packet continuity.json
npm run clista -- interoperability verify --packet continuity.json
npm run clista -- federation verify
npm run clista -- negotiation verify
npm run clista -- delegation verify
npm run clista -- execution verify
npm run clista -- outcome verify
npm run clista -- outcome-learning verify
npm run clista -- review verify
npm run clista -- recovery verify
```
