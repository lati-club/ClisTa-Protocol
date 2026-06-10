# ClisTa Ledger — Northgate Health System: Epic Sepsis Model for Live Inpatient Sepsis Alerting (sealed session 4)

clista_convention: v0.1
title: Should Northgate Health System deploy the Epic Sepsis Model for live clinical sepsis alerting across inpatient units?
closure_state: closed
epistemic_state: unaudited
applicability: irreversible=yes (live clinical alerting, patient impact); multi_party_or_multi_session=yes; artifact_verifiable=yes

Northgate (hypothetical 600-bed academic medical center) is considering live sepsis alerting. The advocate proposes a concrete, narrowed configuration: ESM **v2 locally trained on Northgate data**, deployed as a **silent (shadow) phase first, then a single-unit supervised pilot** rather than house-wide go-live, with an explicit local validation gate, a calibrated threshold set against local prevalence, and decision-support framing (not autonomous action). The options on the table: deploy / deploy_with_conditions / do_not_deploy. The session converged on **deploy_with_conditions**: the affirmative case (E1, E2, E3) is real but every favorable performance number belongs either to a different model version (E1 unspecified, E4/E5 = v1) or to design intent (E3); no v2 deployed-performance evidence exists at all (E7). The conditions are the gates that turn that absence into something verifiable before any live alert fires.

## Claims

- **C1** — Deploy ESM v2 trained on Northgate's own data, not the v1 configuration that failed external validation. *(E3, E4, E7)*
- **C2** — The redesign targeted the exact mechanisms blamed for v1's failures (sepsis-onset definition, reduced antibiotic-order reliance), so v2 is the right candidate. *(E3, E6)*
- **C3** — A single-center before/after deployment was associated with strong operating characteristics (AUC 0.834, sens 86%) and a 44% reduction in odds of sepsis mortality. *(E1)*
- **C4** — Local training plus a locally calibrated threshold addresses the population-mismatch and default-threshold problems seen in the external validations. *(E3, E4, E5)*
- **C5** — Deployed as additive decision support in a supervised pilot, the model can add early warning without replacing clinician judgment. *(E4, E2)*
- **C6** — A shadow phase plus monitoring lets Northgate verify performance before any live alert and catch drift after. *(E7)*
- **C7** — Given the base-rate burden of sepsis, having an early-warning capability is worth pursuing rather than abandoning. *(E2)*

## Objection ledger (terminal dispositions)

| ID  | TARGET   | SEVERITY     | DISPOSITION                  | RATIONALE-REF |
|-----|----------|--------------|------------------------------|---------------|
| A1  | C1       | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | v2 unvalidated (E7); gate G1 |
| A2  | C3       | NON-BLOCKING | PARTIALLY_CONCEDED           | E1 before/after, version-unspecified |
| B1  | C1       | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | E6 antibiotic-order leakage can recur in local training; gate G2 |
| B2  | C3       | NON-BLOCKING | PARTIALLY_CONCEDED           | E1 version-not-specified |
| H1  | C2       | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | E5 equity / population mismatch; gate G3 |
| H2  | C5       | NON-BLOCKING | ACCEPTED_AS_AMENDMENT        | E4 false-reassurance harm |
| D1  | C5       | NON-BLOCKING | ACCEPTED_AS_AMENDMENT        | E4 alert fatigue |
| D2  | C6       | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | no monitoring/decommission plan yet; gate G4 |
| E1o | C1       | NON-BLOCKING | DEFENDED                     | gate-then-pilot could become permanent stall |
| E2o | C7       | BLOCKING     | DEFENDED (held open)         | E2 cost of NON-deployment / delay harm |

All rows terminal; closure_state = closed. The BLOCKING items (A1, B1, H1, D2, E2o) are carried forward as formal dissent in the minority report; E2o is a held-open two-directional tension rather than a veto.

## Transfer State

- **DECISION:** **deploy_with_conditions** — Northgate may proceed toward a locally-trained ESM v2 deployment only through a silent-shadow then single-unit supervised pilot, gated on local validation, leakage audit, equity stratification, and a monitoring/decommissioning plan. House-wide live alerting as posed is NOT approved. v1 is rejected.
- **SETTLED (do not relitigate without a context change):**
  - v1 in its evaluated configuration is not deployable for live alerting (E4 AUC 0.63, sens 33%, 67% missed; E5 sens 14.7%).
  - E1's favorable numbers cannot be cited as v2 evidence (version unspecified, before/after confounded, "hypothesis generating").
  - v2 has no independent external validation; design intent ≠ demonstrated performance (E3, E7).
  - Doing nothing is not safe: the base-rate burden (E2) is real; the comparator is unaided recognition, not a perfect model.
- **RESIDUAL RISKS:**
  - R1 (from A1): v2 may underperform locally as v1 did externally. Owner: model validation lead. Trigger: local validation AUC/sensitivity/calibration below pre-registered floor.
  - R2 (from B1): label-leakage (antibiotic-order timing, E6) or label-definition error recurs in the local pipeline. Owner: data engineering / clinical informatics. Trigger: feature-importance audit shows order-timing dominance or alert-after-treatment pattern.
  - R3 (from H1): subgroup performance disparity (E5). Owner: equity/quality officer. Trigger: subgroup sensitivity gap beyond pre-set tolerance.
  - R4 (from D2): drift/decay without monitoring. Owner: ops & monitoring lead. Trigger: calibration drift or alert-volume shift past threshold.
  - R5 (from E2o): cost of delay — gates could defer a plausibly-helpful tool indefinitely while the base-rate harm continues. Owner: governance committee. Trigger: gate timeline slips past bound.
- **OPEN GATES:**
  - G1 — Local validation gate: no clinician-facing alert until a Northgate-data v2 study reports discrimination, calibration, and threshold-specific operating characteristics on a held-out local cohort against a pre-registered performance floor.
  - G2 — Leakage/lead-time audit: shadow-phase evidence that v2 adds warning ahead of the antibiotic order rather than echoing it.
  - G3 — Equity stratification: subgroup performance (race, ethnicity, language, payer) reported and acted on before pilot scale-up.
  - G4 — Ops package: monitoring dashboard, recalibration cadence, alert-fatigue governance, decommissioning/kill-switch threshold live and owned before any pilot alert.
- **AUTHORITY BOUNDARY:** This session is a documented effective-challenge deliberation. It recommends a staged, conditioned path and defines the gates; it does NOT approve deployment. Only Northgate's named institutional authority (MRM officer, CMIO, IRB/quality governance) can grant deployment trust. `trusted: false` until that authority acts and a non-participant audits this ledger. Not SR 11-7 certification and not clinical or legal advice.
- **CAVEATS (verbatim):**
  - Lane A: "No clinician-facing alert fires before a Northgate-data v2 validation reports pre-registered discrimination and calibration on a held-out local cohort (G1)."
  - Lane B: "A shadow-phase lead-time/leakage audit (G2) demonstrates the model adds warning ahead of, not after, the antibiotic order, and the v2 feature set used at Northgate is documented."
  - Lane H: "Equity-stratified performance (G3) is reported and acted on, and the model is deployed strictly additively — never as grounds to withhold clinician escalation."
  - Lane D: "A monitoring dashboard, recalibration cadence, and a pre-defined decommissioning threshold (G4) are live before any pilot alert, with an owner named."
  - Lane E: "The gating timeline is bounded and the existing clinician-driven sepsis workflow is preserved unchanged throughout, so conditioning the model does not itself become a cause of untreated-sepsis delay (E2)."
- **NEXT ACTION:** Stand up the silent/shadow scoring of locally trained v2 and begin accruing the held-out cohort for G1. Earliest honest slip signal: if shadow data cannot be accrued or the vendor cannot support local training/feature documentation within the planned window, the local-validation gate cannot lift and the project must hold at shadow — do not let schedule pressure convert "unvalidated" into "deployed."

## Minority report (lane E)

Survives as a tension, not a veto: the evidence the conditioned recommendation leans on to justify proceeding at all (E1, E2, E3) is weaker than the evidence it leans on to refuse (E4, E5, E6, E7). A defensible reading is do_not_deploy until v2 validation exists somewhere independent — i.e., do not let Northgate be the first published validation of a live patient-facing tool. The conditioned recommendation answers this by making the shadow/validation phase explicitly non-patient-facing and additive-only, which is why E2o (cost-of-delay) is held open rather than resolved: the honest residual tension is between "don't experiment on patients with an unvalidated model" and "don't withhold a plausibly helpful tool from a high-mortality condition." (References E2o, A1, B1, H1, D2.)

## Integrity verdict

Real challenge: the advocate conceded v1 outright (A1), conceded E1's transferability (A2/B2), and accepted two binding amendments (H2, D1); four BLOCKING objections survived as gated residual risks and lane E's cost-of-delay tension (E2o) was held open, not papered over.

*(Structured form: `session-data.json`; verifiable event log: `events.ndjson`.)*
