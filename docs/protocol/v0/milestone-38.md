# Milestone 38: Projector-Aware Continuity Verification

## Theorem

```text
continuity_verify(packet) on divergent projector
  = projector_mismatch(sealed_version, this_version)   -- NOT corruption
```

A continuity packet seals a `projection_hash` computed by the projector
that produced it. Recomputing that hash on a different checkout is only
meaningful if both projectors share an output contract. M38 records the
sealing projector's identity in the packet so `continuity verify` can tell
a *legitimate projector change* apart from a *corrupt packet*.

## Hard Law

```text
projection_hash_mismatch != packet_corruption
```

A `projection_hash` that differs because the verifier's projector changed
is not evidence of tampering. Verification must say which it is.

## Capability

M38 closes the gap filed as #64. A continuity packet is a portability
artifact: a different party, on a different machine and a different
checkout, runs `continuity verify` later. The packet stored a
`projection_hash` but carried **nothing identifying which projector
computed it**. So a verifier whose `src/projector.js` differed recomputed a
different projection and failed with a bare `projection_hash does not match
recomputed value` — indistinguishable from a corrupt or tampered packet,
even when the events were byte-identical, valid, and strict-integrity-clean.
That is a false-negative class: a benign projector change (e.g. a
determinism fix, PR #53 in the worked example) silently breaks verification
of every previously-sealed packet, and the failure reads as tampering.

M38 adds `PROJECTION_VERSION` — the identity of the projector's **output
contract**, declared in `src/projector.js`. Every exported packet records
the version that sealed it (`projection_version`). On verify:

- If the packet's `projection_version` differs from this checkout's, report
  `projector mismatch: packet sealed under <sealed>, this checkout is
  <current> — regenerate the packet or align the checkout`, and skip the
  projector-dependent recompute comparisons (projection_hash,
  continuity_state, verification_state, interoperability_profile). The
  events are still fully integrity- and validity-checked, and the packet's
  own `state_hash` must still commit to its own `continuity_state` — a
  projector mismatch never waives the packet's self-consistency.
- If the versions match, verification proceeds exactly as before, including
  the bare `projection_hash` comparison. Same declared version + differing
  hash is now the *correct* signal for genuine corruption.

`PROJECTION_VERSION` is a semantic version, bumped by hand whenever a
projector change alters projected-state output. Packets sealed across
compatible projector revisions (output unchanged, version unchanged) still
verify — the version tracks the output contract, not the source bytes.

## Design Notes

Recording the raw `src/projector.js` content hash (or git commit) was
considered and rejected as the primary identity: it is brittle — a comment
or whitespace edit that leaves projected output byte-identical would bump
it and produce a *false* projector mismatch. A semantic output-contract
version is the honest granularity. The source-hash option remains available
as a future belt-and-suspenders field if needed.

## Proof Case

- `test/continuity-projector-identity.test.js` covers: export records
  `projection_version`; a same-projector packet verifies with
  `projectorMismatch: false`; a divergent `projection_version` yields an
  honest `projector mismatch` reason and does **not** emit the bare
  `projection_hash` / `continuity_state` corruption reasons; a projector
  mismatch still catches tampering with the packet's own `continuity_state`
  via the self-consistency `state_hash` check; legacy packets without
  `projection_version` keep verifying against a matching projector; and the
  `continuity verify` CLI surfaces `projectorMismatch` and exits nonzero.
- `node --test`: all prior tests green plus the new suite.
- `npm run replay`: byte-identical for both M33 profiles (`hermes`,
  `claude-code`) — replay does not seal continuity packets, and the
  projector output contract is unchanged.

## Boundary

M38 may:

- declare `PROJECTION_VERSION` in the projector and export it
- record `projection_version` in the continuity packet
- gate `verifyContinuityPacket`'s projector-dependent comparisons on that
  version and report an honest projector mismatch
- surface `projectionVersion` / `projectorMismatch` in the verify result

M38 must not:

- change projected-state output (no `PROJECTION_VERSION` bump is warranted;
  this milestone adds the field, it does not alter the projection)
- make `projection_version` a required packet field (legacy packets without
  it must keep verifying against a matching projector)
- waive event integrity, event validity, or packet self-consistency when a
  projector mismatch is reported
- add or change protocol event types, projection semantics, or the
  validator

## Relation To Protocol State

M38 is portability hardening for the continuity layer. It does not change
projection semantics or add reasoning state — it makes continuity
verification *honest about why it failed*. It is the companion to
milestone-37: M37 makes the **event head** a transitive commitment (#63);
M38 makes the **projection hash** projector-version-aware (#64). Together
they let an independent holder of an event log — or a sealed continuity
packet — verify it across engine upgrades without mistaking a version skew
for tampering.
