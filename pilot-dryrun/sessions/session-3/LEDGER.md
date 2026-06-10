# ClisTa Ledger — Epic Sepsis Model live deployment at Northgate Health System (sealed session 3)

clista_convention: v0.1
title: Should Northgate Health System deploy the Epic Sepsis Model for live inpatient sepsis alerting?
closure_state: closed
epistemic_state: unaudited
applicability: irreversible=yes (live clinical alerting, patient impact); multi_party_or_multi_session=yes; artifact_verifiable=yes (E1–E7 + named local artifacts)
rounds_used: 3

Northgate (hypothetical 600-bed academic medical center) is weighing live clinical sepsis alerting using the Epic Sepsis Model. Two distinct models share the name: **v1** (penalized logistic regression, not locally retrained, antibiotic-order-timing dependent — E1/E2/E5/E6) and **v2** (2022 gradient-boosted-tree, recommended to be trained on the hospital's own data, reduced antibiotic-order reliance — E3). v1 has two damning external validations (E4 Michigan; E5 Harris Health) and a favorable single-center before/after study of unspecified version (E1). v2 has **no independent external validation at all** (E7). The advocate proposes the strongest concrete case the evidence supports.

## Advocate's concrete proposal (defended)

- **Version:** ESM **v2**, locally trained on Northgate's own historical encounters (E3).
- **Scope:** **Single pilot unit** (one ICU + its step-down), NOT all-inpatient, NOT live-autonomous house-wide.
- **Threshold:** Set **locally after local validation**, not Epic's default ≥6 (E4 shows ≥6 misses 67%); decision-curve-derived, with the v1 ≥5 Prisma operating point (E1) as a reference only.
- **Safeguards:** Silent (shadow) run first; alert as decision-support adjunct to clinician judgment, not autonomous; nurse-facing screening tier + physician escalation; mandatory local prospective validation gate before any live alerting; bias audit across subpopulations; monitoring dashboard with calibration drift triggers; pre-specified decommissioning criteria.

## Claims

- **C1** — v2's structural changes (local training, revised onset definition, reduced antibiotic-order reliance) target the exact mechanisms blamed for v1's failures, so v1's poor external numbers do not transfer to a locally-trained v2 deployment. *(E3, E6)*
- **C2** — The relevant counterfactual is not a perfect model but unaided clinician recognition against a high preventable-death base rate, so a credible early-warning layer has real upside. *(E2)*
- **C3** — A favorable single-center before/after deployment exists: threshold ≥5, sensitivity 86%, specificity 80.8%, local AUC 0.834, associated with 44% lower odds of sepsis mortality. *(E1)*
- **C4** — Local training + local threshold-setting + a mandatory local validation gate directly answer the population-mismatch failures seen in external v1 validations. *(E3, E4, E5)*
- **C5** — Limiting scope to a single pilot unit with silent-run-first and human-in-the-loop alerting makes the decision reversible and bounds harm during evidence generation. *(ASSUMPTION AS1; mitigates E4, E5, E7)*

## Objection ledger (terminal dispositions)

| ID  | TARGET | SEVERITY | DISPOSITION | RATIONALE-REF |
|-----|--------|----------|-------------|---------------|
| A1  | C1, C3 | BLOCKING | CONVERTED_TO_RESIDUAL_RISK | v2 unvalidated (E7); gate G1 |
| A2  | C3     | NON-BLOCKING | PARTIALLY_CONCEDED | E1 before/after cannot isolate model effect; version unspecified |
| B1  | C1, C4 | BLOCKING | CONVERTED_TO_RESIDUAL_RISK | local-training data/label quality; gate G2 |
| B2  | C3     | NON-BLOCKING | DEFENDED | E1 version-not-specified means it cannot be cited as v2 evidence |
| H1  | C2     | BLOCKING | CONVERTED_TO_RESIDUAL_RISK | E4/E5 false-negative harm; alerting must be additive-only; gates G1/G3 |
| H2  | C2     | NON-BLOCKING | CONVERTED_TO_RESIDUAL_RISK | E5 equity / population mismatch; gate G3 |
| H3  | C5     | NON-BLOCKING | ACCEPTED_AS_AMENDMENT | E4 false-positive burden |
| D1  | C5     | BLOCKING | CONVERTED_TO_RESIDUAL_RISK | no monitoring/decommission artifact exists yet; gate G4 |
| D2  | C1     | NON-BLOCKING | ACCEPTED_AS_AMENDMENT | silent-run-first/human-in-loop must be binding, not a vibe |
| E1x | C2     | NON-BLOCKING | DEFENDED | E2 base-rate cost weaponization risk |
| E2x | C5     | NON-BLOCKING | CONVERTED_TO_RESIDUAL_RISK | pilot ossification; needs hard sunset |

All rows terminal; closure_state = closed. The four BLOCKING survivors (A1, B1, H1, D1) are carried forward in the minority report as formal dissent.

## Round trace (condensed)

- **R1.** Advocate opens with v2/pilot/local-threshold proposal. Lanes file A1, B1, H1, D1 as BLOCKING; A2, B2, H2, H3, D2, E1x, E2x as NON-BLOCKING. Core blocking theme: every favorable number is wrong-version, wrong-design, or design-intent-only; every hard number is adverse; v2 (E7) has no evidence.
- **R2.** Advocate concedes A2 (before/after confounding), B2 (E1 version gap), drops any claim that E1 evidences v2. Accepts D2 and H3 as amendments. Converts A1, B1, H1, D1 into agreed gates that lift mechanically when a named local artifact exists.
- **R3.** Devil's advocate presses both directions: E1x (base-rate cost should not wave through an unvalidated model) — DEFENDED; E2x (pilot can ossify) — converted to residual risk with a hard sunset. All rows terminal. Close.

## Transfer State

- **DECISION:** **deploy_with_conditions** — Approve ESM **v2 only**, **locally trained on Northgate's own historical data** (E3), in a **bounded ICU + step-down pilot** in **silent/shadow mode first** (scores logged, no clinician-facing alerts), promoted to **live alerting only after a local prospective validation** demonstrates acceptable discrimination, calibration, and subgroup performance. v1 is rejected outright (E4, E5, E6). House-wide live alerting is not authorized by this session.
- **SETTLED (do not relitigate without a context change):**
  - ESM v1 in its as-validated configuration is not deployable for live alerting — two independent validations (E4 sens 33%, E5 sens 14.7%) plus leakage (E6) settle this.
  - Published v1 numbers (E4, E5) do NOT transfer to v2; v2 is a different model class (GBT vs penalized logistic regression) trained on different data (E3) — so v1 evidence neither approves nor condemns v2.
  - The before/after mortality association (E1) cannot carry a live-deployment claim: unspecified model version and confounding by co-occurring sepsis-program changes.
  - There is zero independent or vendor performance evidence for v2 (E7); "designed to be better" (E3) is not "shown to be better."
- **RESIDUAL RISKS:**
  - R1 (from A1): v2's deployed performance at Northgate is unknown (E7). Owner: Model Validation lead + vendor liaison. Trigger: local prospective validation must meet pre-registered thresholds before any live alert.
  - R2 (from H1): subgroup harm — v1 performed worst in a minority, low-income population (E5); v2 inherits no proof it corrects this. Owner: Health-equity reviewer. Trigger: validation reports sensitivity/PPV/calibration stratified by race, ethnicity, payer, sex, with a pre-set disparity stopping rule.
  - R3 (from D1): alert fatigue / false-positive burden in live use. Owner: Clinical informatics + nursing ops. Trigger: monitor alert volume, production PPV, override rate; decommission if PPV falls below a pre-set floor.
  - R4 (from B1): local training data quality and label definition determine whether v2 works; a weak local label reproduces v1's circularity. Owner: Data lineage lead. Trigger: documented label-adjudication audit before training sign-off.
- **OPEN GATES:**
  - G1 — Local prospective validation of v2 (shadow-mode silent period): AUC, calibration, sensitivity/specificity/PPV/NPV at the chosen threshold on Northgate patients, plus % of sepsis cases flagged BEFORE timely antibiotics (the E4 "added value" metric). Lift condition for live alerting; gate is hard.
  - G2 — Leakage/lead-time audit: shadow-phase artifact showing the model adds lead time over current recognition and does not merely echo antibiotic orders.
  - G3 — Subgroup equity report with pre-registered disparity stopping rule.
  - G4 — Operational monitoring + decommissioning plan: alert volume, production PPV, override/dismissal rate, recalibration schedule, explicit kill-switch. Lift condition for promotion from pilot to broader scope.
- **AUTHORITY BOUNDARY:** This session is challenge documentation only. It recommends a staged, conditioned path and defines the gates; it does NOT approve deployment. Only Northgate's named institutional authority (MRM officer, CMIO, IRB/quality governance) can grant deployment trust. `trusted: false` until that authority acts and a non-participant audits this ledger. This is not SR 11-7 certification and not clinical or legal advice.
- **CAVEATS (verbatim):**
  - Lane A: "No live alert fires before a local validation study of locally-trained v2 meets pre-registered discrimination AND calibration floors."
  - Lane B: "A documented local label/feature lineage with a passed leakage audit exists before the validation study is run."
  - Lane H: "Subgroup harm analysis is completed and the threshold is justified by an explicit false-negative/false-positive harm-asymmetry argument, with alerting kept adjunct to clinician judgment."
  - Lane D: "A monitoring, recalibration, incident-response, and decommissioning plan with a live drift dashboard and a hard pilot sunset is in place before go-live."
  - Lane E: "The gates are absolute pre-live blockers and the pilot has an immovable sunset forcing a deploy-or-decommission decision."
- **NEXT ACTION:** Stand up the locally-trained v2 model in silent/shadow mode and begin the prospective validation data collection. Earliest honest slip signal: if shadow-mode AUC or subgroup calibration on Northgate data is not materially better than the E4 v1 figures (AUC ~0.63), the local-training premise (C1) has failed and the deployment does not advance to live alerting.

## Minority report (lane E)

The gates are necessary but the honest baseline is that this packet contains ZERO evidence that the proposed configuration (locally-trained v2) works anywhere — E7 is a true evidential void, E1 is wrong-version and confounded, E3 is design intent only, and the only hard numbers (E4, E5) are failures. A "deploy_with_conditions" verdict risks being read as approval-in-waiting. If GATE-1 through GATE-4 are not enforced as absolute pre-live blockers with a hard sunset, the correct verdict is do_not_deploy. (References A1, B1, H1, D1, E2x.)

## Integrity verdict

Real challenge: the advocate conceded E1's causal claim and its v2-relevance (A2, B2), four BLOCKING objections survived as gated residual risks rather than being talked away, and a genuine minority report on the v2 evidential void (E7) holds.

*(Structured form: `session-data.json`; verifiable event log: `events.ndjson`.)*
