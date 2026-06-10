# Evidence Packet — Epic Sepsis Model Deployment Challenge

evidence_packet_convention: v0.1
case: Epic Sepsis Model (ESM / ESPM) for live clinical sepsis alerting
institution: **HYPOTHETICAL** — "Northgate Health System," a 600-bed academic medical center.
  Used only to frame the deployment question. No real institution is described, endorsed, or
  implicated.
compiled: 2026-06-10
sources: all items below are from public literature and public reporting. No confidential or
  proprietary documentation is used. Every item carries a source URL, a date, the model
  version it pertains to, and how the source was obtained.

## How to read this packet

This packet is deliberately **two-sided**. Sepsis early-warning is a domain where reasonable
reviewers can disagree: the same model has a damning multicenter external validation and
published single-center before/after results associated with reduced mortality. The packet
presents both at equal weight so that convergence in the challenge sessions is earned, not
manufactured by a one-sided brief.

**Source acquisition legend** (evidence discipline applied to the packet author, not just the
debaters):

- `FETCHED` — the source URL was retrieved and read by the packet author on 2026-06-10; figures
  below are transcribed from the retrieved text.
- `ABSTRACT-FETCHED` — the full text was paywalled; the figures are transcribed from the
  retrieved abstract/record. Full-text claims beyond the abstract are NOT relied upon.
- `UNVERIFIED` — could not be retrieved; flagged, not silently trusted. (None in this packet;
  the legend is kept so the discipline is visible.)

## Version discipline (binding for the data-lineage lane)

Two distinct models share the "Epic sepsis" name. Conflating them is an error the data-lineage
skeptic should catch:

- **ESM v1 / ESPMv1** — the original penalized logistic regression, developed on ~405,000
  encounters across 3 health systems (2013–2015), **not** locally retrained, and relying in
  part on clinician antibiotic-order timing. Items E1, E2, E5, E6 pertain to v1.
- **ESM v2 / ESPMv2** — the 2022 revision: a gradient-boosted-tree model Epic recommends be
  **trained on each hospital's own data**, with a revised sepsis-onset definition and reduced
  reliance on antibiotic orders. Item E3 pertains to v2. **No independent external validation
  of v2 performance is cited in this packet** — that absence is itself evidence (see E7).

---

## Affirmative evidence (supports a deployment case)

### E1 — Single-center before/after results associated with reduced sepsis mortality
- **Finding:** At Prisma Health (Greenville, SC; 746-bed academic level-1 trauma center), a
  before-and-after study of 11,512 inpatient encounters (1,171 [10.2%] with sepsis) reported,
  using the ESM score as a screening test at threshold ≥5: sensitivity 86.0%, specificity
  80.8%, PPV 33.8%, NPV 98.11%, local ROC AUC 0.834. Associated with a 44% reduction in the
  odds of sepsis-related mortality (OR 0.56, 95% CI 0.39–0.80); unadjusted mortality fell from
  24.3% to 15.9%.
- **Authors' own stated limitation (quoted):** "This study is hypothesis generating, and
  further work with more rigorous study design is needed."
- **Model version:** Not specified by the authors (a lineage gap — see E1 caveat).
- **Date:** Study period 2018-01-12 to 2019-07-31; published July 2023.
- **Source:** Cull J, et al. "Epic Sepsis Model Inpatient Predictive Analytic Tool: A
  Validation Study." *Critical Care Explorations*. PMID 37405252.
  https://pubmed.ncbi.nlm.nih.gov/37405252/
- **Acquisition:** `ABSTRACT-FETCHED` (full text returned HTTP 402 paywall; figures are from
  the PubMed record). Caveat: before/after design cannot isolate the model's contribution from
  co-occurring sepsis-program changes; "version not specified" is a real provenance gap.

### E2 — Base rate: the cost of no early-warning system at all
- **Finding (quoted):** "at least 1.7 million adults … in the U.S. develop sepsis" per year;
  "At least 350,000 adults … who develop sepsis die during their hospitalization or are
  discharged to hospice"; "1 in 3 adults who dies in a hospital had sepsis during their
  hospital stay." The CDC emphasizes that "Without fast treatment, sepsis can quickly lead to
  tissue damage, organ failure, and death."
- **Why it's affirmative:** the relevant counterfactual for a hospital with no sepsis
  early-warning system is not a perfect model — it is unaided clinician recognition against a
  high base rate of preventable death. The devil's-advocate lane is expected to press this.
- **Date:** CDC current figures as of retrieval; underlying references span 2009–2023.
- **Source:** CDC, "About Sepsis." https://www.cdc.gov/sepsis/about/index.html
- **Acquisition:** `FETCHED`. Caveat: the CDC page does NOT provide quantified survival gains
  tied to specific time-to-treatment intervals; do not cite it for a dose-response claim.

### E3 — Vendor revised the model (2022) specifically to address the known failures
- **Finding:** Epic revised the model in 2022. The revised ESM v2 is a gradient-boosted-tree
  model Epic recommends be **trained on each hospital's own historical data** before clinical
  use; it adopts "a more commonly accepted standard" for sepsis onset and reduces "reliance on
  clinician orders for antibiotics as a way to flag the condition." These changes target the
  exact mechanisms blamed for v1's poor performance and late alerts.
- **Why it's affirmative:** a deployment proposed in 2026 would presumably deploy v2 with local
  training, not the v1 configuration that failed external validation.
- **Date:** Reported 2022-10-03.
- **Source:** Ross C. "Epic overhauls popular sepsis algorithm criticized for faulty alarms."
  *STAT News*. https://www.statnews.com/2022/10/03/epic-sepsis-algorithm-revamp-training/
- **Acquisition:** `FETCHED`. Caveat: the article reports structural changes only; it contains
  **no vendor or independent performance figures** for v2. "Designed to be better" is not
  "shown to be better."

---

## Adverse evidence (challenges a deployment case)

### E4 — Multicenter-relevant external validation found poor performance (the damning study)
- **Finding:** External validation at Michigan Medicine across 27,697 patients / 38,455
  hospitalizations (6.6% sepsis prevalence). At Epic's recommended alert threshold ≥6:
  AUC 0.63 (95% CI 0.62–0.64), sensitivity 33%, specificity 83%, PPV 12%, NPV 95%. The model
  generated alerts on 18% of hospitalizations (6,971), **missed 1,709 of 2,552 sepsis patients
  (67%)**, and identified only 7% of sepsis patients who had not already received timely
  antibiotics — i.e., minimal advantage over existing clinical recognition.
- **Model version:** ESM v1 (the configuration in wide deployment at the time).
- **Date:** Study period 2018-12-06 to 2019-10-20; published online 2021-06-21.
- **Source:** Wong A, Otles E, Donnelly JP, et al. "External Validation of a Widely Implemented
  Proprietary Sepsis Prediction Model in Hospitalized Patients." *JAMA Internal Medicine*
  181(8). https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2781307
- **Acquisition:** `FETCHED`.

### E5 — Independent validation in a different population also found poor performance (v1)
- **Finding:** External validation at Harris Health System (Houston; Ben Taub and LBJ
  Hospitals), 145,885 encounters in 2023, of ESPMv1 at threshold 6 (6-hour window): sensitivity
  14.7%, specificity 95.3%, PPV 7.6%, NPV 97.7%. The alert "only alerted providers in half of
  the cases prior to sepsis occurrence." The authors note the population (59% Hispanic, 26%
  Black, lower socioeconomic brackets) "most likely differs significantly from the original
  derivation population," underscoring population mismatch.
- **Model version:** ESPMv1, explicitly.
- **Date:** Study period 2023 calendar year; published 2024-11-13.
- **Source:** Ostermayer D, et al. "External validation of the Epic sepsis predictive model in
  2 county emergency departments." *JAMIA Open* 7(4):ooae133.
  https://academic.oup.com/jamiaopen/article/7/4/ooae133/7900014
- **Acquisition:** `FETCHED`. Note: this is the affirmative case's equity counterpoint — v1
  performed worst in a predominantly minority, lower-income population.

### E6 — Opaque development and label leakage in the original model
- **Finding:** The ESM is proprietary; the Wong validation notes "only limited information is
  publicly available" about its development. The model was developed on ~405,000 encounters
  across 3 health systems (2013–2015). STAT reporting and the validation literature identify
  reliance on clinician **antibiotic-order timing** as a predictor — a target-leakage pathway
  that can make the model appear to "predict" sepsis only after clinicians have already acted,
  producing late or circular alerts.
- **Model version:** ESM v1.
- **Date:** Development data 2013–2015; leakage critique 2021–2022.
- **Source:** Wong et al. 2021 (as E4); Ross/STAT 2022 (as E3).
- **Acquisition:** `FETCHED` (both underlying sources fetched).

### E7 — Absence of independent external validation of the revised model (v2)
- **Finding:** As of this packet's compilation, no peer-reviewed independent external validation
  of ESM **v2** performance is identified among the retrieved sources. The affirmative case for
  v2 (E3) rests on design intent and vendor recommendation, not on independent outcome
  evidence. Published validations with hard numbers (E4, E5) and the before/after study with
  unspecified version (E1) do not establish v2's deployed performance.
- **Why it matters:** the deployment proposal will likely rest on v2-with-local-training; the
  evidence that this configuration works at the proposing institution does not yet exist and
  must be generated locally.
- **Date:** Negative finding as of 2026-06-10.
- **Source:** Derived from the absence of such a study across E1–E6 sources and the searches
  conducted 2026-06-10.
- **Acquisition:** `FETCHED` (negative result from the same searches). Caveat: absence of
  evidence in retrieved public sources is not proof none exists; it is a flagged gap, and a
  reviewer with database access should confirm.

---

## The decision under challenge

> Should Northgate Health System (hypothetical) deploy the Epic Sepsis Model for **live
> clinical sepsis alerting** across its inpatient units?

Each session receives THIS packet and nothing else. Sessions must cite item IDs (E1–E7) or
declare assumptions. The version distinction (v1 vs v2) is part of the evidence; treating "the
Epic sepsis model" as one undifferentiated thing is a lineage error.
