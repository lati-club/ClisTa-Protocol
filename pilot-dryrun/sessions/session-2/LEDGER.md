# ClisTa Ledger — Epic Sepsis Model deployment at Northgate Health System (sealed session 2)

clista_convention: v0.1
title: Should Northgate Health System deploy the Epic Sepsis Model for live clinical sepsis alerting across its inpatient units?
closure_state: closed
epistemic_state: unaudited
applicability: irreversible=yes (live clinical alerting, patient-safety exposure); multi_party_or_multi_session=yes; artifact_verifiable=yes

Northgate Health System (hypothetical, 600-bed academic medical center) is deciding whether to turn on the Epic Sepsis Model for live inpatient sepsis alerting. The evidence is deliberately two-sided: a damning multicenter external validation of v1 (E4, AUC 0.63, 67% of sepsis missed) and a single-center before/after study associated with a 44% mortality-odds reduction at threshold ≥5 (E1), against a high base rate of preventable sepsis death (E2). Epic released a structurally revised v2 in 2022 (E3) recommended for local training, but no independent external validation of v2 exists (E7). Options on the table: deploy v1 broadly, deploy v2 broadly, deploy in a scoped pilot with conditions, or do not deploy.

## Advocate's defended proposal

Deploy **ESM v2 (gradient-boosted-tree, E3), locally trained on Northgate's own historical encounter data**, in a **single-unit / scoped pilot** (not house-wide), running in **silent/shadow mode first**, then **advisory alerting** at a locally calibrated threshold (anchored near the E1 ≥5 operating point only after local calibration confirms it), with **mandatory clinician-in-the-loop** review, a **local prospective validation study** as the gate to expansion, an **alert-rate/alert-fatigue monitor**, a **subgroup equity audit**, and a **predefined decommissioning trigger**. The advocate explicitly does NOT defend deploying v1 in any configuration, nor house-wide go-live before local validation.

## Objection ledger (terminal dispositions)

| ID  | TARGET | SEVERITY     | DISPOSITION                  | RATIONALE-REF |
|-----|--------|--------------|------------------------------|---------------|
| A1  | C1,C4  | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | E7, E4: no independent v2 validation; lifts only on local prospective study |
| A2  | C2     | NON-BLOCKING | PARTIALLY_CONCEDED           | E1 design weakness |
| A3  | C3     | NON-BLOCKING | DEFENDED                     | — |
| B1  | C4     | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | E6, E7: vendor opacity on v2 features/leakage; lifts on lineage attestation + leakage check |
| B2  | C1     | NON-BLOCKING | ACCEPTED_AS_AMENDMENT        | E1 version-not-specified gap |
| H1  | C2,C5  | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | E5: equity/population mismatch in minority, low-SES population; lifts on subgroup audit |
| H2  | C3     | NON-BLOCKING | DEFENDED                     | — |
| H3  | C5     | NON-BLOCKING | ACCEPTED_AS_AMENDMENT        | E4 false-negative harm |
| D1  | C3,C5  | NON-BLOCKING | ACCEPTED_AS_AMENDMENT        | E4 alert burden |
| D2  | C5     | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | no monitoring/decommission artifact exists yet; lifts on signed monitoring plan |
| E1o | C5     | NON-BLOCKING | PARTIALLY_CONCEDED           | E2 base-rate cost of inaction |
| E2o | C1     | NON-BLOCKING | DEFENDED                     | E4,E5 vs E1 |

Every BLOCKING row carries a RATIONALE-REF and a named lift condition. All rows terminal; closure_state = closed. (Of the surviving BLOCKING objections, A1 and B1 are carried forward as formal dissent in the minority report; H1 and D2 are terminally converted to monitored residual-risk gates.)

## Transfer State

- **DECISION:** deploy_with_conditions. Northgate may proceed toward live sepsis alerting **only** with ESM **v2 locally trained (E3)**, in a **scoped single-unit pilot starting in silent/shadow mode**, with five load-bearing amendments: (1) local prospective validation gate before any live alert influences care house-wide; (2) data-lineage + leakage attestation for v2 features; (3) prospective subgroup/equity audit; (4) signed monitoring + recalibration + decommissioning plan with an alert-fatigue metric; (5) clinician-in-the-loop advisory-only alerting (never autonomous). v1 deployment in any form is rejected.
- **SETTLED (do not relitigate without a context change):**
  - v1 is not deployable: external validation shows AUC 0.63, 33% sensitivity, 67% of sepsis missed at threshold ≥6 (E4), and 14.7% sensitivity in a different population (E5). The advocate conceded v1 entirely.
  - "The Epic sepsis model" is two models; v1 and v2 must not be conflated (E3 vs E4/E5/E6). Version discipline is settled.
  - The counterfactual to deployment is not zero harm — unaided recognition against a high base rate of preventable sepsis death (E2). Doing nothing also carries cost.
  - v2's affirmative case is design intent and vendor recommendation only (E3), not demonstrated performance (E7). "Designed to be better" ≠ "shown to be better."
- **RESIDUAL RISKS:**
  - R1 (from A1/B2): v2 deployed performance at Northgate is unknown; E1's favorable numbers are single-center, before/after (cannot isolate the model from co-occurring program changes), and version-unspecified. Owner: Model Validation lead. Trigger: local prospective validation must report AUC/sensitivity/PPV before expansion beyond pilot.
  - R2 (from B1): v2 feature set and possible residual antibiotic-order/label leakage (E6) are vendor-opaque; local GBT training does not by itself remove a leaked predictor. Owner: Data Governance + vendor liaison. Trigger: feature-list attestation + leakage audit on local training run.
  - R3 (from H1): performance may degrade in Northgate's minority/low-SES subpopulations, as v1 did worst in a 59% Hispanic / 26% Black, lower-SES population (E5). Owner: Health Equity reviewer. Trigger: stratified performance audit; any subgroup sensitivity gap beyond a preset bound halts expansion.
  - R4 (from D2): alert fatigue and override behavior — v1 alerted on 18% of hospitalizations (E4); an uncalibrated v2 could repeat this. Owner: Clinical Informatics / Ops. Trigger: alert-rate and clinician-override dashboard; breach of preset alert-burden threshold triggers recalibration or pause.
- **OPEN GATES:**
  - G1 — Local prospective validation study (named artifact) lifts A1. Deadline: before any expansion past the single pilot unit.
  - G2 — v2 data-lineage + leakage attestation lifts B1. Deadline: before local training is accepted as deployable.
  - G3 — Prospective subgroup/equity audit lifts H1. Deadline: before house-wide go-live.
  - G4 — Signed monitoring/recalibration/decommissioning plan with alert-fatigue metric lifts D2. Deadline: before silent mode flips to live advisory alerting.
- **AUTHORITY BOUNDARY:** This session recommends only. It is challenge documentation, not approval. It did NOT certify SR 11-7 compliance, did not approve the local validation design, and did not grant institutional trust (trusted: false). Only Northgate's named model-risk authority and clinical governance may approve go-live. The session was not authorized to set the final numeric local threshold — that is an output of the local calibration the gates require.
- **CAVEATS (verbatim):**
  - Lane A: "a local prospective validation study (G1) reports v2's AUC, sensitivity, specificity, and PPV on Northgate data before any live alert influences care beyond the silent-mode pilot, and the result materially exceeds the v1 external benchmark of AUC 0.63 (E4)."
  - Lane B: "Epic provides a v2 feature/lineage attestation and a leakage audit (G2) confirms the locally-trained model does not depend on post-hoc antibiotic-order timing or other label-leakage signals (E6)."
  - Lane H: "a prospective stratified equity audit (G3) is completed with a preset subgroup-sensitivity floor, and expansion halts automatically if any subpopulation — especially minority/low-SES groups (E5) — shows a sensitivity gap beyond that bound."
  - Lane D: "a signed monitoring, recalibration, and decommissioning plan (G4) with an alert-fatigue metric, override tracking, and named owners is in place before silent mode flips to live advisory alerting."
  - Lane E: "the gates carry real deadlines and the pilot never influences clinical care before G1-G4 close; absent that, my endorsement is withdrawn and my position is do_not_deploy."
- **NEXT ACTION:** Stand up v2 local training on Northgate historical data + run silent/shadow-mode evaluation on the pilot unit; pull the lineage attestation (G2) in parallel. Earliest honest slip signal: if the vendor cannot produce a v2 feature list sufficient to run a leakage check, or if silent-mode AUC fails to materially exceed the E4 v1 figure (0.63), the pilot stalls at the gate rather than advancing.

## Minority report (lane E)

The defensible reading of this packet may be do_not_deploy, not deploy_with_conditions. The only model with favorable hard numbers in wide use (v1) failed independent external validation in two distinct populations (E4, E5). The model that would actually run (v2) has zero independent external validation anywhere (E7); its case is pure design intent (E3). The one favorable study (E1) is single-center, before/after, cannot separate model from program effect, and does not even specify its version. This dissent is recorded as a minority report rather than a blocking survivor only because silent/shadow mode exposes no patient to model-driven decisions while the local validation gate (G1) runs; if any gate is weakened or the pilot is allowed to influence care before G1-G4 close, this position reverts to do_not_deploy. (References A1, B1, E2o.)

## Integrity verdict

Real: the advocate conceded v1 entirely, downgraded E1 from proof to weak prior, and accepted four amendments; three BLOCKING objections survived as gated residual risks and a do_not_deploy minority report stands — nothing was rubber-stamped and nothing real was suppressed.

*(Structured form: `session-data.json`; verifiable event log: `events.ndjson`.)*
