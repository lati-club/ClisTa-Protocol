# Runtime Fixture Milestone 26

```text
running != verified
```

Runtime verification compares local runtime facts against an existing release manifest.

If the manifest is missing, runtime verification fails with `release_manifest_missing`.

`clista runtime verify --manifest .clista/release-manifest.json` does not mutate `.clista/events.ndjson`, projected state, or export state.

Runtime verification does not prove runtime trust, protocol authority, governance approval, amendment approval, compatibility proof, package publishing trust, OS security attestation, CI trust, or remote runtime trust.
