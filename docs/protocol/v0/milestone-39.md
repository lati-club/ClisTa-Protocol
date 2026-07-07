# Milestone 39: Event-Type Registry (validator/projector drift guard)

## Theorem

```text
known_event_types = validator_switch_cases = projector_switch_cases
```

There is one canonical set of protocol event types, and both engine
switches enumerate exactly it. Adding a type to one switch but not the
other — or not to the registry — fails a conformance test at merge time.

## Hard Law

```text
event_type_known_to_one_engine != event_type_known_to_the_protocol
```

A type the validator accepts but the projector silently ignores (or vice
versa) is not a protocol event type; it is drift.

## Capability

M39 addresses the preventive half of issue #51. The validator and the
projector each dispatch on `event_type` through a large `switch` with no
shared source of truth, so a type could be added to one and missed by the
other. The failure modes are asymmetric and easy to miss:

- validator `default` → loud `unsupported event_type` (fail-closed)
- projector `default` → silent `break` (fail-open)

This is the #40 / #45 fail-open class: a projected-but-unvalidated (or
validated-but-unprojected) type slips through the silent side. At the time
of writing the live drift was zero in the projected-but-unvalidated
direction (closed by #50), but four types — `CrossThreadEvidence`,
`ModelPruned`, `ObjectDeprecated`, `PruningReviewInitiated` — were
validated yet reached the projector's silent `default`.

M39 makes the set explicit and self-guarding:

1. `src/event-types.js` declares `PROTOCOL_EVENT_TYPES` — the single
   canonical, sorted, unique registry of every event type (plus
   `isKnownEventType`).
2. The projector switch now enumerates the full set: the four
   previously-defaulting types are explicit no-op cases (they are
   record-only / verified out-of-band; they mutate no projected field).
   No known type reaches `default` anymore.
3. `test/event-type-registry.test.js` extracts both switches' `case`
   labels from source and asserts each equals the registry exactly, and
   that the two switches agree. Adding a new event type now forces three
   coordinated edits — registry + validator switch + projector switch — or
   the suite fails loudly.

## Second Source Of Truth Removed

M39 also takes the consistency half of #51: the projector wrote
`projection.participants` via `upsert` on `ParticipantAdded` /
`ParticipantDeclared`, then **reassigned** the whole map from
`projection.identity.participants` after the loop, with no read in between.
The upserts were a divergent second derivation path whose result was
immediately discarded. They are removed; `identity.participants` is the
sole source of truth, and the two participant events join the existing
participant no-op case group.

## Proof Case

- `test/event-type-registry.test.js`: registry is sorted and unique; the
  validator switch equals the registry; the projector switch equals the
  registry; the two switches agree (zero drift in both directions).
- `node --test`: all prior tests green plus the new suite. Removing the
  discarded participant upserts changes no projected output — the existing
  projector, continuity, and identity suites pass unchanged.
- `npm run replay`: byte-identical for both M33 profiles.

## Boundary

M39 may:

- add `src/event-types.js` as the canonical registry
- make the projector switch enumerate the full registry (explicit no-op
  cases for record-only types)
- add a conformance test binding both switches to the registry
- remove the discarded `projection.participants` upsert (identity is the
  source of truth)

M39 must not:

- add or change protocol event types (the registry records the existing
  set; it introduces none)
- change validation rules or projected reasoning-state output
- rewrite the switches into a table-driven dispatcher (that larger
  refactor — collapsing the `validateXxx` wrappers, splitting the
  monolithic files — is issue #49, left for later); M39 delivers the
  drift *guarantee* without the churn

## Relation To Protocol State

M39 is structural hardening, not a new reasoning property. It makes an
existing invariant — "the validator and projector know the same event
types" — explicit and enforced, closing the #40 / #45 fail-open class at
its structural root. It composes with milestone-37 (event-head integrity)
and milestone-38 (projector-aware continuity) as the engine-integrity
group: what the log commits to, what a packet commits to, and what the two
engines agree exists.
