# ClisTa Ledger — Northgate Health System: Epic Sepsis Model for Live Inpatient Sepsis Alerting (sealed session 5)

clista_convention: v0.1
title: Should Northgate Health System deploy the Epic Sepsis Model for live clinical sepsis alerting across inpatient units?
closure_state: closed
epistemic_state: unaudited
applicability: irreversible=yes (live clinical alerting, patient-safety exposure); multi_party_or_multi_session=yes; artifact_verifiable=yes

The decision under challenge is a live inpatient sepsis-alerting deployment of the Epic Sepsis Model at a hypothetical 600-bed academic medical center. The evidence is two-sided: ESM v1 has two damning independent external validations (E4 Michigan AUC 0.63, sens 33%, missed 67%; E5 Harris Health sens 14.7% in a predominantly minority/low-income population) and a documented leakage pathway (E6), but also a single-center before/after study associated with reduced mortality (E1) and a vendor revision (E3, ESM v2) that targets v1's specific failure mechanisms. The catch: no independent external validation of v2 exists (E7). The advocate proposed the strongest concrete case the evidence supports — ESM v2, locally trained, ICU/step-down pilot, with mandatory local prospective validation before live alerting.

## Claims

- **C1** — A sepsis early-warning capability addresses a large, real preventable-harm burden, making some intervention preferable to none. *(E2)*
- **C2** — There is published evidence of an ESM deployment associated with reduced sepsis mortality (44% lower odds; mortality 24.3%→15.9%). *(E1)*
- **C3** — The deployable model is ESM v2, which Epic revised specifically to fix v1's failure mechanisms (GBT model, local training, revised onset definition, reduced antibiotic-order reliance). *(E3)*
- **C4** — v1's damning external-validation numbers do not transfer to v2 because v2 is a different model class trained on different data, so they cannot be cited to reject v2. *(E3, E4, E5)*
- **C5** — Proceeding via local training lets Northgate correct the population-mismatch problem that drove v1's worst (equity) failures. *(E3, E5)*
- **C6** — Operational safeguards (threshold tuning, monitoring, override, recalibration) can manage alert burden and keep the tool clinically usable. *(E4)*
- **C7** — Refusing to deploy any system is itself a decision with a quantified harm cost, not a safe default. *(E2)*

## Objection ledger (terminal dispositions)

| ID  | TARGET | SEVERITY | DISPOSITION | RATIONALE-REF |
|-----|--------|----------|-------------|---------------|
| A1  | C1     | BLOCKING | CONVERTED_TO_RESIDUAL_RISK | v2 unvalidated (E7); gate G1 |
| A2  | C2     | NON-BLOCKING | PARTIALLY_CONCEDED | E1 before/after, version-unspecified, hypothesis-generating |
| A3  | C4     | NON-BLOCKING | RESOLVED | version-segregation now a SETTLED principle |
| B1  | C1     | BLOCKING | CONVERTED_TO_RESIDUAL_RISK | local label/leakage risk (E6); gate G1/leakage audit |
| B2  | C3     | NON-BLOCKING | PARTIALLY_CONCEDED | v2 vendor opacity; folded into B1 label audit |
| H1  | C5     | BLOCKING | CONVERTED_TO_RESIDUAL_RISK | E5 equity / subgroup harm; gate G2 |
| H2  | C2     | NON-BLOCKING | ACCEPTED_AS_AMENDMENT | E4 false-positive / stewardship harm |
| D1  | C6     | BLOCKING | CONVERTED_TO_RESIDUAL_RISK | E4 alert fatigue; gate G3 |
| D2  | C6     | NON-BLOCKING | ACCEPTED_AS_AMENDMENT | no decommission/recalibration plan yet |
| E1o | C7     | BLOCKING | DEFENDED | gate-stacking could become de-facto do_not_deploy |
| E2o | C3     | NON-BLOCKING | PARTIALLY_CONCEDED | local-training may merely confirm failure after sunk cost |

All rows terminal; closure_state = closed. **No minority report:** every surviving blocker was terminally converted to an agreed empirical gate rather than carried as unresolved dissent — the strongest convergence shape the protocol describes. This is the one session of the five with no minority report.

## Transfer State

- **DECISION:** **deploy_with_conditions** — Approve only ESM **v2 trained on Northgate's own data**, in a silent shadow-mode ICU/step-down pilot, promotable to live alerting only after a local prospective validation clears pre-registered discrimination, calibration, and subgroup gates. Reject v1 and house-wide live alerting.
- **SETTLED (do not relitigate without a context change):**
  - ESM v1 in its as-validated configuration is not deployable for live alerting (E4, E5, E6).
  - Published v1 numbers do NOT transfer to v2 and v2 (E3) is judged on its own (absent) evidence per E7. Version non-transfer is a SETTLED principle (A3).
  - E1 cannot justify live deployment (version unspecified, before/after, hypothesis-generating).
  - Doing nothing is not a safe default: the base-rate burden (E2) is real.
- **RESIDUAL RISKS:**
  - R1 (from A1/B1): v2 deployed performance at Northgate is unknown (E7); must be generated locally before any live alert. Owner: Model Validation lead. Trigger: local prospective validation below pre-registered floor.
  - R2 (from H1): subgroup/equity disparity (E5). Owner: Health-equity reviewer. Trigger: subgroup sensitivity gap beyond pre-set bound.
  - R3 (from D1): alert fatigue / false-positive burden (E4). Owner: Clinical informatics + ops. Trigger: production PPV below floor or alert volume past threshold.
  - R4 (from B1): local label adjudication and antibiotic-order leakage. Owner: Data lineage lead. Trigger: leakage audit shows order-timing dominance.
- **OPEN GATES:**
  - G1 — Local prospective validation on Northgate patients (AUC, calibration, sensitivity/specificity/PPV/NPV at the chosen threshold, % flagged before timely antibiotics) meeting pre-registered thresholds. No clinician-facing alert before this.
  - G2 — Subgroup performance stratified by race, ethnicity, payer, sex, with a pre-registered disparity stopping rule.
  - G3 — Operational monitoring + explicit decommissioning/kill-switch criterion (production PPV floor, alert volume, override rate, recalibration schedule) live before the first alert.
- **AUTHORITY BOUNDARY:** This session is challenge documentation only. It recommends; it does not approve. It decided the SHAPE of a defensible deployment (v2-only, local-train, shadow-first, gated promotion) and rejected v1 and house-wide live alerting. It did NOT and could not certify that v2 works at Northgate (no such artifact exists — E7), did not grant clinical sign-off, and does not certify SR 11-7 compliance. Only Northgate's named clinical-governance and model-risk authority may approve live use. `trusted: false`.
- **CAVEATS (verbatim):**
  - Lane A: "No clinician-facing alert is enabled until a local prospective validation of v2 on Northgate patients meets pre-registered discrimination and calibration thresholds."
  - Lane B: "The local training label (sepsis onset) is independently adjudicated and the antibiotic-order leakage pathway is documented as removed or quantified before training sign-off."
  - Lane H: "Subgroup performance is reported with a pre-set disparity stopping rule, given v1's worst performance in a minority, low-income population (E5)."
  - Lane D: "A kill-switch decommissioning criterion and production PPV/override monitoring are live before the first clinician-facing alert."
  - Lane E: "The shadow-mode period is time-boxed with an explicit decision point so 'gather more evidence' cannot silently become 'never deploy' while the E2 base-rate harm continues."
- **NEXT ACTION:** Stand up the locally-trained v2 in silent/shadow mode and begin the prospective validation data collection. Earliest honest slip signal: if shadow AUC/calibration is not materially better than the E4 v1 figures (~0.63), the local-training premise has failed and deployment stops before live alerting and before further sunk cost.

## Integrity verdict

Real: the advocate conceded E1's load-bearing weakness (A2) and that v2 is unvalidated (A1/E7), three blockers survived as gated residual risks rather than being talked down, and Lane E's pro-deployment attack genuinely reshaped the consensus into a time-boxed gate rather than an open-ended veto.

*(Structured form: `session-data.json`; verifiable event log: `events.ndjson`.)*
