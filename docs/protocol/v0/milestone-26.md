# Milestone 26: Protocol Runtime Verification

## Theorem

```text
protocol_runtime = verify(execution_environment, against_release_manifest)
```

## Hard Law

```text
running != verified
```

## Capability

Protocol runtime verification checks whether the local ClisTa runtime currently executing matches an existing verified release manifest.

M25 verifies the release artifact. M26 verifies the local execution environment against that artifact.

Runtime verification reports drift. It does not create trust.

## Boundary

Runtime verification may:

- read an existing release manifest
- verify the manifest with release verification rules
- compare Node version against `package.json` requirements
- compare package name, package version, and CLI entrypoint
- compare source file hashes against the manifest
- compare schema file hashes against the manifest
- verify Git commit and tag when running from a repository checkout
- report dirty tracked files as hard drift
- report untracked files as warnings
- rerun required verifier commands and compare reproducible verifier outputs
- return machine-readable runtime verification output

Runtime verification must not:

- generate a fresh manifest and treat that generated manifest as proof
- mutate `.clista/events.ndjson`
- append reasoning-state events
- mutate projected protocol state
- create protocol authority
- create governance approval
- create amendment approval
- create compatibility proof
- create package publishing trust
- create OS security attestation
- create CI trust
- create remote runtime trust
- claim runtime trust because the runtime is running

## Runtime Environment

For M26, runtime environment means:

- Node version from `process.versions.node`
- required Node version range from `package.json`
- `package.json` package name and version
- `package.json` `bin.clista`
- currently executing CLI path
- source files and schema files on disk
- supplied release manifest
- Git commit and tag when running inside a Git checkout
- working tree cleanliness
- required verifier command availability and reproducibility

Generated workflow artifacts such as `continuity.json` are not runtime identity.

## Release Manifest Dependency

Runtime verification requires an existing manifest:

```text
.clista/release-manifest.json
```

or an explicit path:

```text
clista runtime verify --manifest <path>
```

If the manifest is missing, runtime verification fails with `release_manifest_missing`.

Runtime verification may reuse M25 release verification logic, but it must not silently generate a manifest. Generated proof can describe drifted local files and would be circular.

## Output

The output schema is:

```text
clista.runtime.verify.v0
```

Important fields include:

- `valid`
- `runtimeVerified`
- `releaseManifestVerified`
- `nodeVersion`
- `requiredNodeVersion`
- `cliEntrypoint`
- `packageVersion`
- `manifestPackageVersion`
- `gitCommit`
- `manifestGitCommit`
- `gitTag`
- `manifestGitTag`
- `sourceHashesMatch`
- `schemaHashesMatch`
- `verifierCommandsAvailable`
- `verifierResultsReproduced`
- `workingTreeClean`
- `drift`
- `warnings`
- `violations`
- `proves`
- `doesNotProve`

Runtime output keeps these boundary flags false:

- `trusted`
- `protocolAuthority`
- `governanceApproval`
- `amendmentApproval`
- `compatibilityProof`

## Drift Model

Hard drift includes:

- release manifest missing
- release manifest not verified
- Node version mismatch
- package version mismatch
- CLI entrypoint missing or mismatched
- source hash mismatch
- schema hash mismatch
- Git commit mismatch in repository checkout mode
- Git tag mismatch in repository checkout mode
- dirty tracked files
- required verifier unavailable
- required verifier failure
- verifier result not reproduced

Warnings include:

- untracked files
- unsupported Node range syntax
- missing Git metadata when outside a repository checkout
- volatile verifier stdout hash changes when exit code and output schema reproduce

## CLI

```text
clista runtime verify [--manifest <path>]
```

There is no `runtime show` command in M26.

## Relation To Reasoning State

M26 does not add event types.

M26 does not change projector behavior.

M26 does not change protocol export.

Runtime verification is an artifact/runtime boundary like release verification, not append-only reasoning truth.

## Non-Goals

M26 does not implement CI infrastructure, package publishing trust, dependency lockfile expansion, OS attestation, remote runtime attestation, governance approval, amendment approval, compatibility proof, or protocol authority.
