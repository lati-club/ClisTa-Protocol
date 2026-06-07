# Runtime Usage Fixture

```sh
npm run clista -- release verify
npm run clista -- release manifest --out .clista/release-manifest.json
npm run clista -- runtime verify --manifest .clista/release-manifest.json
npm run clista -- runtime audit --manifest .clista/release-manifest.json
```

`runtime verify` succeeds when it returns `valid: true` and `runtimeVerified: true`. It compares local runtime facts against an existing release manifest.

Runtime verification does not create runtime trust, protocol authority, governance approval, amendment approval, compatibility proof, package publishing trust, OS security attestation, CI trust, or remote runtime trust.

Runtime usage audit proves the documented path is usable. It does not create trusted release status, runtime trust, protocol authority, governance approval, amendment approval, or compatibility proof.
