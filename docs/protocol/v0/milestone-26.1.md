# Milestone 26.1: Runtime Usage Audit

## Theorem

```text
runtime_usability = verify(user_can_execute_runtime_verification, without_protocol_insider_context)
```

## Hard Law

```text
verified_runtime != usable_runtime
```

## Capability

Runtime usage audit verifies that a fresh user can discover, understand, and execute runtime verification from the documented path.

M26 proves that a local runtime can match an existing release manifest. M26.1 proves that the documented path to that verification is usable without insider context.

## Boundary

Runtime usage audit may:

- read README, quickstart, and protocol docs
- confirm that `clista runtime verify` is discoverable
- confirm that `clista runtime audit` is discoverable
- confirm that the documented path reaches actual CLI behavior
- confirm that a missing manifest failure is clear and actionable
- confirm that a valid manifest success is clear
- confirm that runtime verification success does not overclaim
- snapshot known event, projected-state, and export artifacts before and after audit checks
- return machine-readable runtime usage audit output

Runtime usage audit must not:

- mutate `.clista/events.ndjson`
- append reasoning-state events
- mutate projected protocol state
- mutate protocol export state
- generate a manifest as runtime proof
- create release trust
- create runtime trust
- create protocol authority
- create governance approval
- create amendment approval
- create compatibility proof

## Documented Runtime Path

A fresh checkout should be able to follow:

```text
npm run clista -- release verify
npm run clista -- release manifest --out .clista/release-manifest.json
npm run clista -- runtime verify --manifest .clista/release-manifest.json
npm run clista -- runtime audit --manifest .clista/release-manifest.json
```

The audit checks that README, quickstart, and protocol docs explain that runtime verification compares local runtime facts against an existing release manifest.

## Missing Manifest

If the manifest is missing, runtime verification must fail with:

```text
release_manifest_missing
```

The audit treats that as clear only when the failure names the missing release manifest path. It treats the failure as actionable only when the next command is explicit:

```text
clista release manifest --out .clista/release-manifest.json
```

## Valid Manifest

When a valid manifest is supplied, runtime verification success is clear only when output uses:

```text
clista.runtime.verify.v0
valid: true
runtimeVerified: true
```

Success remains bounded. A verified runtime does not mean trusted release, runtime trust, protocol authority, governance approval, amendment approval, compatibility proof, package publishing trust, OS security attestation, CI trust, or remote runtime trust.

## Output

The output schema is:

```text
clista.runtime.audit.v0
```

Important fields include:

- `valid`
- `runtimeUsable`
- `runtimeVerifyDiscoverable`
- `runtimeAuditDiscoverable`
- `runtimeVerificationBounded`
- `missingManifestFailureClear`
- `missingManifestFailureActionable`
- `validManifestSuccessClear`
- `validManifestSuccessBounded`
- `docsExplainRuntimeVerification`
- `docsExplainRuntimeBoundary`
- `mutation`
- `checks`
- `violations`

Runtime usage audit keeps these boundary flags false:

- `trusted`
- `protocolAuthority`
- `governanceApproval`
- `amendmentApproval`
- `compatibilityProof`

## CLI

```text
clista runtime audit [--manifest <path>]
```

The preferred command is `runtime audit` because it matches existing concise command style such as `outcome audit`, `release verify`, and `runtime verify`.

## Relation To Reasoning State

M26.1 does not add event types.

M26.1 does not change projector behavior.

M26.1 does not change protocol export.

Runtime usage audit is a usability verifier for the runtime verification path, not append-only reasoning truth.

## Non-Goals

M26.1 does not implement M27, UI, agents, graph storage, governance portal features, package publishing trust, dependency attestation, OS attestation, remote runtime attestation, governance approval, amendment approval, compatibility proof, or protocol authority.
