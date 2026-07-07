# SR 11-7 Clause Mapping — ClisTa Challenge Records

How sealed ClisTa event logs map onto the supervisory expectations of
SR 11-7 / OCC 2011-12 (*Supervisory Guidance on Model Risk Management*).
This is a working mapping for building and reviewing Challenge Records, not
legal advice; clause paraphrases are abridged — cite the guidance itself in
any formal document.

Reference use cases:

- **Ongoing Monitoring Effective Challenge — Concept Drift**
  (`examples/ongoing-monitoring-concept-drift/`) — Section VI focus, mapped
  in detail below.
- Epic Sepsis dry run (`pilot-dryrun/`) — validation-stage effective
  challenge across sealed sessions.

## The core mechanic

SR 11-7's spine is **effective challenge**: "critical analysis by objective,
informed parties who can identify model limitations and assumptions and
produce appropriate changes." Effective challenge only counts if it is
*incentivized, competent, and influential* — and an examiner can only credit
what is *documented*. A ClisTa Challenge Record makes the challenge
replayable and tamper-evident:

| SR 11-7 expectation | ClisTa artifact |
|---|---|
| Challenge is raised by a qualified, objective party | `ObjectionRaised` with `participantId` and role from `ParticipantAdded` — attribution is structural, not narrative |
| Challenge is grounded, not pro forma | `EvidenceCommitted` exhibits linked from the objection's target and the claims around it |
| Model owner responds | Line-of-business `EvidenceCommitted` / `ClaimCreated` / `PositionTaken` events, attributable to the owner |
| Challenge is influential (produces change or documented acceptance) | `ObjectionResolved` disposition text; `DecisionMerged.conditions[]`; preserved objections |
| Residual risk is accepted knowingly, by someone with authority | `DecisionMerged.preservedObjectionIds[]` + `authorityTrail[]` — surviving dissent is on the record with the accepter's identity |
| The record cannot be quietly rewritten | Hash chain: `content_hash`/`previous_hash` on every event; `validate --strict` fails closed on any edit |

## Section VI — Ongoing Monitoring (detailed mapping)

Mapped against `examples/ongoing-monitoring-concept-drift/challenge.ndjson`
(thread `thd_ongoing_monitoring_concept_drift_m471`, 24 events, head
`sha256:4219cd6f…a2ea`).

### "…confirm that the model … continues to perform as intended"

*Performance* is a property of the feature→outcome relationship P(y|X). An
input-distribution control (PSI, covariate-drift alarms, score-distribution
stability) watches P(X) only — it can confirm the model is being *fed* as
intended, never that it *performs* as intended.

| Section VI language (abridged) | Event(s) in the log | What it demonstrates |
|---|---|---|
| Ongoing monitoring confirms the model "continues to perform as intended" | `obj_pyx_monitoring_gap` targeting `asm_input_stability_implies_performance` | The plan's implicit premise — input stability ⇒ performance — is stated as an explicit assumption and challenged on the record |
| "…evaluate whether changes in products, exposures, activities, clients, or market conditions necessitate adjustment, redevelopment, or replacement" | `evd_lob_remediation_plan` regime-trigger inventory (rate moves >200bp, underwriting policy change, credit-cycle turn) | Re-validation triggers tied to the environmental changes that move P(y|X), not only to input alarms |
| "…verify that extensions and exceptions are appropriate" / know when the model "is not performing effectively" | `evd_psi_dashboard_green` + `evd_vintage_backtest_divergence` side by side | The exhibit pattern: monitoring green while outcomes degraded — the precise blind spot being challenged |
| **Outcome analysis**: "comparison of model outputs to corresponding actual outcomes" | `evd_vintage_backtest_divergence` (realized 4.1% vs predicted 2.9–3.1%; AUC 0.71→0.64) and condition 1 of `dcr_m471_concept_drift_disposition` (quarterly lag-adjusted vintage backtest) | Outcome analysis performed once by the challenger, then institutionalized as a scheduled control |
| "Back-testing" as a form of outcome analysis, with attention to the horizon of the forecast | `asm_label_lag_12_24_months`; `obj_label_lag_residual_window` (preserved) | The 12–24-month label lag is declared as an assumption, and the unobservable window it creates survives the decision as a preserved objection instead of disappearing into a footnote |
| Benchmarking / alternative estimates as a monitoring complement | Condition 2: champion/challenger shadow scoring with monthly divergence reporting | An outcome-facing proxy that operates *inside* the label-lag window |
| "If monitoring reveals deficiencies … adjust, redevelop, or replace" and track to resolution | `ObjectionResolved` on `obj_pyx_monitoring_gap` ("remediated with conditions… a missed gate reopens the challenge"); `DecisionMerged.conditions[]` with dates and a suspension clause | Deficiency → response → disposition → dated gates, all attributable |

### What an examiner gets

One command reconstructs the record from the sealed log:

```bash
node src/cli.js decision summary \
  --events examples/ongoing-monitoring-concept-drift/challenge.ndjson --format text
```

- **The challenge was raised** — by whom, targeting which stated premise, on
  which evidence.
- **The line responded** — with a concrete amendment, not a rebuttal of the
  data.
- **The disposition is recorded** — resolution text says what was accepted
  and what reopens it.
- **Residual risk is owned** — the label-lag window is a preserved objection
  on a decision signed by the decision owner (`authorityTrail`).
- **None of it can be silently edited** — `validate --strict` fails on any
  tampered event.

## Other sections touched by this use case

| Section | Expectation | Where the log meets it |
|---|---|---|
| III (Overview / effective challenge) | Challenge from objective, informed parties with authority and incentives | Distinct `par_mrm_challenger` vs `par_lob_model_owner` vs `par_mrm_head` roles; the challenger's review carries binding conditions |
| V (Validation — evaluation of conceptual soundness) | Assumptions identified and assessed | `AssumptionDeclared` makes the monitoring plan's premise a first-class, challengeable object |
| VII (Governance) | Documentation "detailed enough so that parties unfamiliar with a model can understand how it operates, its limitations, and its key assumptions"; board/senior-management reporting | The sealed log *is* the documentation: self-contained, replayable, attributable; `decision summary` renders the management report |

## Honest limits

- ClisTa evidences the **process** of effective challenge. It does not make
  the challenge competent — a pro forma objection sealed in a hash chain is
  still pro forma. The chain proves *what was recorded when, by whom*; it
  cannot prove diligence.
- A preserved objection documents accepted residual risk; it does not reduce
  it.
- `trusted: false` is the default stance: structural verification is not
  endorsement of the model, the monitoring plan, or the disposition.
