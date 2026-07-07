# Draft scope: split monolithic cli.js / validator.js + de-dup helpers (#49)

Status: **deferred / not started.** This is a saved scope, not an active
milestone. Maintainability refactor — no protocol property, no behavior
change intended (except where noted for `primaryObject`).

## Current state (measured, not from the issue's stale numbers)

| File | Lines | Nature |
|------|------:|--------|
| `src/cli.js` | ~5,151 | 132 `case` labels across ~30 noun groups |
| `src/validator.js` | ~3,776 | ~108-case switch + ~120 `validateXxx` wrappers |
| `src/projector.js` | ~1,976 | central `switch (eventType(event))` |
| `schemas/clista-protocol.schema.json` | ~8,220 | data, not code |

## ⚠️ Key finding: `primaryObject` has already drifted

The two `primaryObject` copies are **not identical** — they diverged in
coverage:

- `src/validator.js` covers `executionRecord`, `outcomeRecord`,
  `recovery*` … but **not** federation/negotiation payload keys.
- `src/projector.js` covers `federationContext`, `negotiation*` … but
  **not** execution/outcome-learning/recovery payload keys.

So each returns `null` for the event families the other resolves. This is
exactly the hand-sync hazard the issue predicted. Unifying them is
therefore **not a pure no-op** — the shared function must be the union of
both key sets, and the change alters behavior for events currently hitting
`null` on one side. This is the one sub-task with genuine correctness
surface: it needs a covering test and may expose a latent bug. Tie the
guard to the M39 event-type registry (assert every registered primary-object
key resolves).

(By contrast, the three `normalize*Text` helpers in `validator.js`
— `normalizeDelegationText`, `normalizeReviewText`, `normalizeRecoveryText`,
plus a 4th inlined in `validateAuthorityName` — **are** byte-identical: a
clean extraction.)

## Workstreams, ordered safest-first

**A — Shared engine helpers** (small, high value)
- **A1.** Collapse the identical `normalize*Text` helpers (+ the inlined 4th)
  into one `normalizeToken` in a shared util. Byte-identical → pure no-op.
- **A2.** Extract `primaryObject` into a shared module built as the **union**
  of both copies, ordering preserved. Add a guard test (reuse the M39
  registry) asserting every event type resolves its object via the shared
  function. *Behavior-changing — treat with care.*

**B — Split `cli.js`** (biggest LOC win, mechanical)
- Move each noun's handlers into `src/cli/<noun>.js`; keep
  `main`/parse/print/usage/dispatch in `cli.js`. Noun groups by frequency:
  review (9), recovery (8), outcome (8), outcome-learning (7), execution (7),
  merge (6), delegation (6), continuity (6), negotiation (5), federation (5),
  decision (5), …
- Add a `makeListCommand(schema, selector)` factory for the ~15 repeated
  read→project→filter-by-thread→print triplets.
- Replace `normalizeCommand`'s ~200 lines of positional-capture with a
  `{prefix → optionKey}` table.
- Do it **noun-by-noun**, tests green after each — no big-bang.

**C — Split `validator.js`** (denser, riskier, lower priority)
- Extract per-layer validators into `src/validator/<layer>.js`, leaving the
  main switch + shared helpers behind. The full table-driven collapse of the
  `validateXxx` wrappers is a bigger swing; defer or gate behind the M39
  registry.

**D — `schemas/*.json` (~8,220 lines)** — **defer.** It's data; splitting via
`$ref` is a separate effort with its own risk and no code-quality payoff for
this issue.

## Suggested milestone breakdown (each independently mergeable)

- **M40** = A1 + A2 (shared helpers; `primaryObject` unification is the real
  content and the only real risk). Ship as a standalone PR first.
- **M41** = B (cli.js split + factories) — ~5–8 incremental commits.
- **M42** = C (validator split) — optional.

## Invariants for every step

- `npm test` green **and** `npm run replay` byte-identical after every commit.
- Each extraction is behavior-preserving **except A2**, which gets new tests.
- Hard-cap each milestone; stop at green. This is churn — resist scope creep.

## Recommendation

Start with **M40 (A1 + A2)**: small, carries the only correctness risk, and
leaves behind a permanent drift guard for `primaryObject` (like M39 did for
the switches). Reassess B/C after it lands — the cli.js split is valuable but
pure churn, so confirm the review appetite before moving ~5k lines.
