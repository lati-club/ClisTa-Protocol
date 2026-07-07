# Milestone 37: Transitive Head Commitment (event_hash.v2)

## Theorem

```text
head_hash = content_hash(last_event) >>> commitment(entire prefix chain)
```

Under `clista.event_hash.v2`, each `content_hash` commits to the event's
`previous_hash`. By induction the head `content_hash` is a rolling
(Merkle-style) commitment to every event before it — so holding the head
alone is enough to detect any tampering or reordering in the prefix, and an
appended suffix can be verified against the head without re-reading the
whole log.

## Hard Law

```text
head_hash_commits_to_prefix == (previous_hash ∈ hashed_material)
```

A head hash that does not commit to `previous_hash` is not a chain
commitment; it is only a per-event checksum.

## Capability

M37 closes the gap filed as #63: `canonicalEventHashMaterial` (v1)
excludes **both** `content_hash` and `previous_hash` from the hashed
material, so an event's `content_hash` commits to its own fields but *not*
to its predecessor. Consequences under v1:

1. Prefix integrity cannot be verified from the head alone — a verifier
   must hold and walk the entire log.
2. A verifier holding only the head plus a relayed suffix cannot bind that
   suffix to the earlier events, because the head does not commit to them.
   This is exactly what broke independent verification in the
   staging-append exercise.

v2 retains `previous_hash` in the hashed material (it excludes only
`content_hash`). This is a clean, backward-compatible version bump:
`computeEventHash` already branches on `hash_version`, so every legacy v1
and pre-v1 event keeps verifying under its original material. The default
append path is unchanged — `prepareEventForAppend` still stamps
`clista.event_hash.v1`, so canonical logs, fixtures, and `npm run replay`
stay byte-identical. v2 is opt-in per event.

Because the head is now a transitive commitment, head-anchored suffix
verification becomes *sound*. A new `verifyEventSuffix(anchorHash,
suffixEvents)` (exposed as `clista integrity verify-suffix --anchor
<headHash>`) confirms that an appended suffix chains onto a trusted head
and is untampered, given only the head and the suffix bytes — never the
full prefix. It requires v2 on every suffix event, because under v1 the
soundness argument does not hold.

## Proof Case

- `test/integrity-v2.test.js` covers: a v2 chain passes strict
  integrity; `content_hash` commits to `previous_hash` under v2 but is
  invariant to it under v1 (the crisp theorem contrast); a suffix
  verifies against the correct head and reproduces the true head hash; a
  suffix anchored to the wrong head is rejected; a v1 suffix is rejected
  as unsound; prefix tampering changes the head so the old head no longer
  verifies the suffix; and the `integrity verify-suffix` CLI verb round
  trips (valid → exit 0, wrong anchor → exit 1).
- `node --test`: all prior tests green plus the new suite; unchanged
  count elsewhere.
- `npm run replay`: byte-identical for both M33 profiles (`hermes`,
  `claude-code`) — the default hash version is untouched.

## Boundary

M37 may:

- add the `clista.event_hash.v2` hash version and its canonical material
- teach `verifyEventIntegrity` to accept and check v2 events
- add `verifyEventSuffix` and the `integrity verify-suffix` CLI verb

M37 must not:

- change the default hash version emitted by `prepareEventForAppend`
  (default stays v1; v2 is opt-in) — this preserves byte-identical replay
- alter v1 or legacy hashing (both keep verifying unchanged)
- add or change protocol event types, the projector, or validator
  reasoning rules
- introduce a new object model — v2 is a hashing discipline, not a
  reasoning-state layer

## Relation To Protocol State

M37 is pure integrity discipline. No projector changes, no validator
reasoning changes, no new event types. `verifyEventIntegrity` gains v2 as
a supported `hash_version`; the existing pairwise `previous_hash` chain
check is unchanged. The new property is that under v2 the *head* is a
standalone transitive commitment, which the pairwise check alone never
provided.

The companion gap #64 (continuity packets carry no projector identity) is
about the *projection* hash being projector-version-stable and is left for
a later milestone; M37 addresses only the *event head* commitment.
