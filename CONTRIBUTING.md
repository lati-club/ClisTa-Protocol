# Contributing to ClisTa Protocol

Thank you for considering a contribution. ClisTa is a protocol engine first — an event-sourced
decision-accountability spine, not a platform. Read `README.md`, `AGENTS.md`, and
`docs/protocol/v0/` before opening a PR.

## The highest-impact contribution is not code

Before anything else: **run an external debate.** ClisTa's productization claim sits on a
public, bidirectional gate — five external debate-pack runs by **2026-09-07**, or the claim
dies on the record (`pack/GATES.md`). An external run moves this project more than any patch,
because the format's own debate ruled that further clean closures *by the authors* confirm
nothing. Start at the top of `README.md` ("Start here — run an external debate") and follow
`pack/RUNBOOK.md`. Failed and abandoned runs are wanted evidence too.

## Scope freeze until the gate lifts

The spine is frozen until the EXTERNAL-RUNS gate is decided. This is a deliberate, recorded
constraint, not inertia:

- **No new verifier layers until five external runs exist.** Every layer is permanent
  deterministic surface area — once shipped, `same events → same state` must hold for it
  forever. Adding layers before the productization claim is tested builds on an unverified
  foundation. PRs that add a new deterministic layer will be asked to wait until the gate
  lifts.
- **Frozen-but-supported layers — do not expand or remove:** `amendment`, `adaptation`,
  `learning`, `negotiation`. These are platform-shaped concerns already wearing protocol
  clothes. Keep their verifiers passing and `trusted: false`; do not grow their event
  families or rules, and do not remove them (removal breaks determinism for any log that used
  them).
- **Always in scope:** bugfixes, documentation, tests, the debate pack, and anything that
  lowers the cost of an external run materializing.

## Invariants every change must preserve

- `trusted: false` stays the default everywhere. Verification of structure is never
  endorsement of content.
- Determinism: the same events must always produce the same projected state. Never introduce
  wall-clock time, randomness, or environment-dependent output into projection.
- No new runtime dependencies in the engine.
- All existing commands still exit 0 on a fresh clone.

## Checks before you open a PR

```sh
npm test            # the JS test suite must pass
npm run replay      # must print "Clean-room replay PASSED" (byte-identical)
```

Follow the build rhythm in `AGENTS.md` (docs → schema → events → projector → validator → cli →
tests). Stay narrow: prove one protocol property per change, not a product feature.

## License

By contributing you agree your code is licensed under Apache-2.0 and your documentation under
CC BY 4.0, matching the repository's existing terms (`LICENSE`, `NOTICE`).
