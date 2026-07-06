# Ongoing Monitoring Effective Challenge — Concept Drift

**A Challenge Record for the failure mode where everything looked fine.**

Consumer credit default model M-471 posted four consecutive green quarters:
every feature PSI under threshold, zero covariate-drift alarms, score
distributions stable, model confidence high. Over the same period, its matured
2024-H2 vintages defaulted **35% above predicted PD** with rank-ordering
degraded from AUC 0.71 to 0.64.

Same features. Different feature→default relationship. That is **concept
drift** — P(y|X) shifted while P(X) did not — and it passes through every
control in a standard input-distribution monitoring plan undetected, because
those controls watch the inputs, not the relationship. Label feedback on
credit default lags 12–24 months, so the rot is silent for exactly as long as
it is most expensive.

The challenge question this record exists to ask:

> **Your monitoring watches P(X). What watches P(y|X)?**

## What the sealed log records

One thread, 24 hash-chained events, replayable end to end:

| Stage | Events | What SR 11-7 calls it |
|---|---|---|
| Challenge raised | `obj_pyx_monitoring_gap` (blocking) targeting the plan's stated premise `asm_input_stability_implies_performance`, grounded in four evidence exhibits | Effective challenge — critical analysis by objective, qualified parties (Section III) |
| Evidence attached | `evd_monitoring_plan_extract`, `evd_psi_dashboard_green`, `evd_score_distribution_stable`, `evd_vintage_backtest_divergence` — the PSI-green-but-outcomes-degraded exhibit pattern | Outcome analysis: comparing model outputs to actual outcomes (Section VI) |
| Line response | `evd_lob_remediation_plan` + `clm_remediation_restores_outcome_coverage`: lag-adjusted quarterly vintage backtesting, champion/challenger shadow scoring, regime-triggered re-validation | Response and remediation by the model owner |
| Challenger disposition | `ObjectionResolved` on `obj_pyx_monitoring_gap`: *remediated with conditions* — resolution text records what was accepted and what reopens it | Disposition of challenge, tracked to closure |
| Sealed decision | `dcr_m471_concept_drift_disposition`: approved with five dated, hard-gated conditions; residual exposure **preserved, not papered over** | Documentation of model adjustments and acceptance of residual risk |

The second objection, `obj_label_lag_residual_window`, deliberately **survives**
the decision as a preserved objection: no amendment can observe realized
outcomes inside the 12–24-month label-lag window, and the record says so, so
the next examiner and the next validator inherit that exposure explicitly.

## Why this is the SR 11-7 Section VI wedge

Section VI expects ongoing monitoring to confirm the model **"continues to
perform as intended"** and names **outcome analysis** — comparing model
outputs to actual outcomes — as a core component. An input-distribution
dashboard cannot evidence either one: performance is a property of P(y|X),
and PSI never looks at y.

The honest mitigations a challenger should probe — and this log does — are:

- **Lag-adjusted outcome backtesting** (vintage curves at maturity vs
  predicted PD bands), not just annual-review backtests;
- **Champion/challenger** shadow scoring to surface relationship shift ahead
  of label maturity;
- **Regime-triggered re-validation** (rate environment, underwriting policy
  shocks, credit-cycle turn) instead of re-validation gated only on
  input-side alarms.

See [`docs/sr11-7-mapping.md`](../../docs/sr11-7-mapping.md) for the
clause-by-clause mapping from Section VI language to events in this log.

## Exam-day verification

Everything below runs from a fresh clone with zero dependencies:

```bash
# Regenerate the log byte-identically (deterministic ids and timestamps)
node scripts/gen-concept-drift-challenge.js

# Structural validation
node src/cli.js validate --events examples/ongoing-monitoring-concept-drift/challenge.ndjson

# Sealed = complete, intact hash chain (fail-closed)
node src/cli.js validate --strict --events examples/ongoing-monitoring-concept-drift/challenge.ndjson

# Chain head, event count, integrity report
node src/cli.js integrity verify --events examples/ongoing-monitoring-concept-drift/challenge.ndjson

# The record a model risk officer hands to an examiner
node src/cli.js decision summary --events examples/ongoing-monitoring-concept-drift/challenge.ndjson --format text
```

Chain head: `sha256:4219cd6f4d8d77883d347ad6744aeb9f6ccef6365721c5feb1c7227a3d01a2ea`
(24 events). Any edit to any event breaks `--strict` validation.

## Thread

| Role | Thread | File |
|---|---|---|
| single | `thd_ongoing_monitoring_concept_drift_m471` | `challenge.ndjson` |

Participants: `par_mrm_head` (decision owner), `par_mrm_challenger` (model
risk challenger), `par_lob_model_owner` (model owner, consumer credit).

## Boundary statement

ClisTa records the *shape* of this challenge — who raised what, on which
evidence, who responded, how it was disposed, and what survived. It does not
rank truth, score the model, or certify that M-471 is safe. `trusted: false`
until your own validation says otherwise; the value is that the challenge is
**replayable and tamper-evident**, not that the tool endorsed the outcome.
