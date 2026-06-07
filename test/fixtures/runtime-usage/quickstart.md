# Runtime Usage Quickstart Fixture

```sh
npm run clista -- release verify
npm run clista -- release manifest --out .clista/release-manifest.json
npm run clista -- runtime verify --manifest .clista/release-manifest.json
npm run clista -- runtime audit --manifest .clista/release-manifest.json
```

`runtime verify` compares the current runtime against an existing release manifest and returns `runtimeVerified: true` only when the runtime matches.

If the release manifest is missing, run:

```sh
npm run clista -- release manifest --out .clista/release-manifest.json
```

Runtime verification does not prove runtime trust, protocol authority, governance approval, amendment approval, compatibility proof, package publishing trust, OS security attestation, CI trust, or remote runtime trust.
