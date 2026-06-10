# ClisTa Ledger — Epic Sepsis Model deployment at Northgate Health System (sealed session 1)

clista_convention: v0.1
title: Should Northgate Health System deploy the Epic Sepsis Model for live inpatient sepsis alerting?
closure_state: closed
epistemic_state: unaudited
applicability: irreversible=yes (live clinical alerting, patient-safety impact); multi_party_or_multi_session=yes; artifact_verifiable=yes

Northgate Health System (hypothetical 600-bed academic medical center) is deciding whether to turn on the Epic Sepsis Model for live inpatient sepsis alerting. The evidence is two-sided: a single-center before/after study associated ESM with reduced mortality (E1), a vendor revision targeted the known v1 failures (E3), and the base-rate cost of no early-warning system is large (E2); against this, two independent external validations of v1 found poor discrimination and high miss rates (E4, E5), the original model has documented opacity and antibiotic-order label leakage (E6), and there is no independent external validation of the revised v2 (E7). The advocate proposed the strongest concrete case the evidence supports; five lanes challenged it across three rounds.

## Advocate's defended proposal (claims)

- **C1** — Deploy **ESM v2 (gradient-boosted-tree), locally trained on Northgate's own historical encounter data**, never the off-the-shelf v1 configuration. (E3, E7)
- **C2** — Scope: **pilot on a single high-acuity adult inpatient unit**, not all inpatient units, not ED-only. (E4, E5)
- **C3** — Run the pilot in **silent (shadow) mode first** — model scores logged and validated against adjudicated sepsis outcomes locally before any alert fires to a clinician. (E1, E7)
- **C4** — The base-rate harm of no early-warning system is high; a locally validated tool plausibly improves on unaided recognition, citing the before/after mortality association. (E1, E2)
- **C5** — Set the alert **threshold by local calibration**, not by importing Epic's default ≥6 (which produced 67% misses at Michigan) or ≥5; pair every alert with a defined nurse/clinician response workflow and override capture. (E4, E1)
- **C6** — ESM v2 reduces reliance on antibiotic-order timing and uses a revised onset definition, addressing the leakage mechanism blamed for v1's late/circular alerts. (E3, E6)

## Objection ledger (terminal dispositions)

| ID  | TARGET   | SEVERITY     | DISPOSITION                  | RATIONALE-REF |
|-----|----------|--------------|------------------------------|---------------|
| A1  | C1,C6    | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | E7: no independent v2 validation exists; lifts only on local silent-mode study |
| A2  | C4       | NON-BLOCKING | PARTIALLY_CONCEDED           | E1 before/after cannot isolate model effect |
| A3  | C5       | BLOCKING     | RESOLVED                     | Local calibration + silent-mode threshold-setting gate |
| B1  | C1,C6    | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | E3/E7: v2 internals opaque; leakage-fix unverified |
| B2  | C3       | NON-BLOCKING | RESOLVED                     | Local label-adjudication protocol defined |
| H1  | C2,C5    | BLOCKING     | CONVERTED_TO_RESIDUAL_RISK   | E5: subgroup/equity performance unmeasured locally |
| H2  | C4,C5    | NON-BLOCKING | ACCEPTED_AS_AMENDMENT        | False-positive/alert-fatigue harm asymmetry |
| D1  | C3,C5    | BLOCKING     | RESOLVED                     | Monitoring, recalibration, decommissioning plan as gate |
| D2  | C2       | NON-BLOCKING | DEFENDED                     | Pilot scope limits blast radius |
| E1o | C4       | NON-BLOCKING | PARTIALLY_CONCEDED           | E2 base-rate cost of NOT deploying / over-conditioning into inaction |
| E2o | C3       | BLOCKING     | DEFENDED                     | Silent-mode is not a fig leaf if exit criteria are pre-registered |

Every BLOCKING row carries a RATIONALE-REF; all rows terminal; closure_state = closed.

## Transfer State

- **DECISION:** **deploy_with_conditions** — Approve a *staged* program, NOT live alerting now. Northgate may proceed to **locally train ESM v2 and run it in silent/shadow mode** on a single high-acuity adult inpatient pilot unit. Live alerting is **gated** behind a local validation study (discrimination, calibration, subgroup performance, and lead-time-over-clinician metrics) that meets pre-registered acceptance thresholds. Load-bearing amendments: H2 (alert burden / false-positive harm must be measured and bounded before go-live); E1o (silent-mode period is time-boxed so conditioning does not become permanent inaction).
- **SETTLED (do not relitigate without a context change):**
  - Off-the-shelf **ESM v1 must not be deployed for live alerting** — E4 (67% misses, AUC 0.63) and E5 (sensitivity 14.7%) are dispositive against v1.
  - Epic's **default threshold (≥6) must not be imported**; thresholds are set from local calibration only (A3).
  - A **silent-mode local validation precedes any live alert** (C3, D1, E2o).
  - The *live-alerting* stage is hard to reverse, so live-alerting approval is withheld pending artifacts.
- **RESIDUAL RISKS:**
  - **R1 (from A1/B1):** No independent or local evidence that v2-with-local-training actually discriminates/calibrates well; "designed to be better" (E3) is not "shown to be better" (E7). Owner: Model Risk / Validation lead. Trigger: silent-mode local validation report; abort live-alerting if AUC/sensitivity/lead-time miss pre-registered thresholds.
  - **R2 (from B1):** v2 internals remain vendor-opaque; the antibiotic-order leakage fix (E6/E3) cannot be independently inspected, only inferred from local lead-time-vs-clinician metrics. Owner: Data lineage lead. Trigger: local feature/leakage audit during silent mode.
  - **R3 (from H1):** Subpopulation/equity performance is unmeasured locally; v1 performed *worst* in a predominantly minority, lower-income population (E5). Owner: Equity/quality reviewer. Trigger: subgroup-stratified silent-mode results must be reported before go-live.
  - **R4 (from H2):** Alert fatigue / false-positive burden on the pilot unit. Owner: Ops & Nursing informatics. Trigger: alert-volume and override-rate monitoring during shadow and pilot-live phases.
- **OPEN GATES:**
  - **GATE-1 (lifts A1, B1, H1):** Local silent-mode validation study on Northgate data — reports AUC, calibration, sensitivity/PPV at the chosen local threshold, subgroup-stratified metrics, and fraction of cases flagged *before* clinician action (lead-time over existing recognition, addressing E6 leakage). Lift condition: results meet pre-registered acceptance thresholds. Deadline: before any live alert.
  - **GATE-2 (lifts D1):** Live monitoring + recalibration + decommissioning plan with named owners, alert-volume thresholds, and drift triggers. Lift condition: signed operational runbook. Deadline: before live-alert go-live.
  - **GATE-3 (lifts H2):** Pre-registered maximum tolerable alert burden and a clinician response workflow. Lift condition: documented workflow + override capture. Deadline: before live-alert go-live.
- **AUTHORITY BOUNDARY:** This session recommends only. It was authorized to evaluate whether the deployment case is well-shaped and to attach conditions; it was NOT authorized to approve live clinical deployment, to certify SR 11-7 compliance, or to grant institutional trust. Only Northgate's named clinical-governance and model-risk authority may approve go-live. `trusted: false` holds.
- **CAVEATS (verbatim):**
  - Lane A: "I endorse this recommendation only if no clinician-facing alert fires before a local silent-mode validation on Northgate data reports discrimination, calibration, and lead-time-over-clinician metrics meeting pre-registered acceptance thresholds."
  - Lane B: "I endorse this only if the local validation explicitly measures whether v2 alerts precede rather than trail clinician antibiotic action, so the E6 leakage pathway is ruled out locally rather than assumed fixed by vendor design."
  - Lane H: "I endorse this only if silent-mode results are stratified by race, ethnicity, and a socioeconomic proxy, and go-live is blocked if any subgroup shows materially worse sensitivity."
  - Lane D: "I endorse this only if a monitoring, recalibration, and decommissioning runbook with named owners and a hard alert-burden ceiling exists before the first live alert."
  - Lane E: "I endorse this only if the silent-mode period is time-boxed with a default decision date, so 'deploy_with_conditions' does not silently become permanent non-deployment and forfeit the E2 base-rate benefit."
- **NEXT ACTION:** Charter the local silent-mode validation: provision v2 local training on Northgate historical data and begin shadow scoring with adjudicated sepsis labels on the pilot unit. Earliest honest slip signal — if 60 days pass with no labeled adjudication pipeline stood up, the program is stalling and should be escalated or stopped, not left running as perpetual shadow mode.

## Integrity verdict

Real: the advocate conceded the E1 causal claim (A2) and accepted hard amendments (H2, D1, E1o), three blocking objections survived as correlated residual risks rather than being explained away, and lane E held a genuine two-directional dissent.

*(The machine-readable structured form of this session is in `session-data.json`; the verifiable event log is in `events.ndjson`.)*
