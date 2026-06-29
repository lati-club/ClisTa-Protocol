#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { prepareEventForAppend } = require("../src/integrity");

const THREAD_ID = "thd_phase2_to_phase3_go_nogo_ltn_4481";
const BASE = "2026-06-29T09:00:00.000Z";

let seq = 0;
function ts() {
  const d = new Date(BASE);
  d.setMilliseconds(d.getMilliseconds() + seq * 35);
  seq++;
  return d.toISOString();
}

// Deterministic event ids: descriptive slug + zero-padded sequence.
// No randomness or wall-clock, so re-running regenerates a byte-identical log
// (matching the deterministic ids used by the sepsis scenario-demo companion).
let idSeq = 0;
function eid(type, hint) {
  const slug = hint.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
  const seqStr = String(++idSeq).padStart(3, "0");
  return `evt_${type.toLowerCase()}_${slug}_${seqStr}`;
}

const events = [];

// === Participants ===
const participants = [
  { id: "par_cmo", kind: "human", name: "Dr. R. Vasquez", role: "decision owner" },
  { id: "par_biostat", kind: "human", name: "Dr. K. Liang", role: "lead biostatistician" },
  { id: "par_clin_pharm", kind: "human", name: "Dr. A. Osei", role: "clinical pharmacologist" },
  { id: "par_reg_affairs", kind: "human", name: "J. Markova", role: "vp regulatory affairs" },
  { id: "par_safety_officer", kind: "human", name: "Dr. T. Nakamura", role: "drug safety officer" },
];

for (const p of participants) {
  events.push({
    event_id: eid("participantadded", p.id),
    event_type: "ParticipantAdded",
    thread_id: THREAD_ID,
    actor_id: p.id,
    timestamp: ts(),
    payload: { participant: { id: p.id, object: "participant", kind: p.kind, name: p.name, role: p.role } },
  });
}

// === ThreadCreated ===
events.push({
  event_id: eid("threadcreated", "phase_gate"),
  event_type: "ThreadCreated",
  thread_id: THREAD_ID,
  actor_id: "par_cmo",
  timestamp: ts(),
  payload: {
    thread: {
      id: THREAD_ID,
      object: "thread",
      title: "Phase II/III Go/No-Go — LTN-4481 (Moderate-to-Severe Ulcerative Colitis)",
      question: "Should LTN-4481 advance from Phase II to Phase III pivotal trials based on current efficacy, safety, and PK/PD data?",
      status: "active",
      participantIds: participants.map((p) => p.id),
      createdAt: BASE,
      updatedAt: BASE,
    },
  },
});

// === Evidence ===
const evidenceItems = [
  {
    id: "evd_phase2_efficacy",
    source: "LTN-4481 Phase II top-line results (Study 4481-201, N=347, 16-week induction)",
    finding: "Modified Mayo Score remission at week 16: 38.2 percent in the 200mg arm vs 12.1 percent placebo (p<0.001). The 100mg arm showed 24.7 percent remission (p=0.003). Dose-response relationship confirmed. Endoscopic improvement: 52.4 percent in the 200mg arm vs 21.8 percent placebo.",
    confidence: 0.91,
    actor: "par_cmo",
  },
  {
    id: "evd_subgroup_analysis",
    source: "Post-hoc subgroup analysis (4481-201-SGA, data cut 2026-03-15)",
    finding: "Patients with prior biologic failure (n=89) showed higher remission rate (46.3 percent) than bio-naive patients (34.1 percent). This is a post-hoc finding. The subgroup was not pre-specified in the SAP. Confidence interval for the bio-failure subgroup is wide (32.8 to 59.8 percent) due to small sample size.",
    confidence: 0.62,
    actor: "par_biostat",
  },
  {
    id: "evd_pkpd_modeling",
    source: "Population PK/PD report (4481-PK-002, final 2026-04-20)",
    finding: "Exposure-response modeling supports the 200mg dose for Phase III. Cmin at steady state correlates with endoscopic improvement (R-squared 0.71). Model predicts 85 percent of patients achieve target exposure at 200mg Q4W. The model has not been validated against an external dataset.",
    confidence: 0.84,
    actor: "par_clin_pharm",
  },
  {
    id: "evd_safety_database",
    source: "Integrated safety database (4481-ISS-001, N=612 across Phase I/II, data lock 2026-05-01)",
    finding: "Serious adverse event rate: 6.8 percent in the 200mg arm vs 5.2 percent placebo. Two cases of serious hepatotoxicity (ALT greater than 10x ULN) in the 200mg arm, both resolved on discontinuation. No deaths. Infection rate: 14.3 percent vs 11.7 percent placebo. No opportunistic infections.",
    confidence: 0.88,
    actor: "par_safety_officer",
  },
  {
    id: "evd_hepatotox_signal",
    source: "Hepatotoxicity signal assessment (4481-SA-003, DILI expert panel review 2026-05-10)",
    finding: "Two serious hepatotoxicity cases reviewed by independent DILI expert panel. Both patients had pre-existing hepatic steatosis. Panel consensus: probable drug-related but confounded by baseline liver disease. Panel recommends excluding patients with baseline ALT greater than 2x ULN from Phase III and implementing enhanced liver monitoring (ALT/AST every 2 weeks for the first 12 weeks).",
    confidence: 0.79,
    actor: "par_safety_officer",
  },
  {
    id: "evd_regulatory_landscape",
    source: "Competitive and regulatory landscape assessment (Regulatory Affairs memo 2026-05-22)",
    finding: "Three approved JAK inhibitors and two IL-23 inhibitors already on market for moderate-to-severe UC. FDA has signaled heightened scrutiny on hepatotoxicity signals in UC drugs following two recent safety-based label changes in the class. Pre-IND meeting feedback indicated FDA expects a robust hepatic monitoring plan and would view bio-failure enrichment favorably if supported by pre-specified analysis.",
    confidence: 0.86,
    actor: "par_reg_affairs",
  },
  {
    id: "evd_fda_type_b_minutes",
    source: "FDA Type B End-of-Phase-2 meeting minutes (2026-02-14)",
    finding: "FDA agreed that the 200mg Q4W dose is reasonable for Phase III. FDA recommended a single pivotal trial with at least 500 patients if the trial includes a pre-specified interim futility analysis. FDA flagged the hepatotoxicity signal and stated that the Phase III protocol must include a hepatic monitoring plan and clear stopping rules for liver-related safety events.",
    confidence: 0.95,
    actor: "par_reg_affairs",
  },
];

for (const e of evidenceItems) {
  const committedAt = ts();
  events.push({
    event_id: eid("evidencecommitted", e.id),
    event_type: "EvidenceCommitted",
    thread_id: THREAD_ID,
    actor_id: e.actor,
    timestamp: committedAt,
    payload: {
      evidence: {
        id: e.id,
        object: "evidence",
        threadId: THREAD_ID,
        source: e.source,
        finding: e.finding,
        confidence: e.confidence,
        committedByParticipantId: e.actor,
        committedAt: committedAt,
        artifactIds: [],
        contentHash: `sha256:pharma_${e.id}`,
      },
    },
  });
}

// === Assumptions ===
const assumptions = [
  {
    id: "asm_phase2_responders_generalize",
    text: "The Phase II responder population is generalizable to the broader Phase III population. The 38.2 percent remission rate at 200mg is a reasonable estimate for powering the Phase III trial.",
    evidenceIds: ["evd_phase2_efficacy"],
    confidence: 0.78,
    actor: "par_biostat",
  },
  {
    id: "asm_bio_failure_subgroup_not_primary",
    text: "The bio-failure subgroup finding is hypothesis-generating only and should not drive Phase III enrichment or primary endpoint strategy, because the analysis was post-hoc and underpowered.",
    evidenceIds: ["evd_subgroup_analysis"],
    confidence: 0.72,
    actor: "par_biostat",
  },
  {
    id: "asm_hepatotox_manageable_with_monitoring",
    text: "The hepatotoxicity signal is manageable with enhanced monitoring and exclusion criteria. Baseline ALT greater than 2x ULN exclusion and biweekly liver function monitoring for the first 12 weeks will provide adequate safety coverage.",
    evidenceIds: ["evd_hepatotox_signal", "evd_safety_database"],
    confidence: 0.76,
    actor: "par_safety_officer",
  },
  {
    id: "asm_pkpd_model_holds_in_larger_population",
    text: "The population PK/PD model will hold in the larger, more heterogeneous Phase III population despite not having been externally validated.",
    evidenceIds: ["evd_pkpd_modeling"],
    confidence: 0.69,
    actor: "par_clin_pharm",
  },
];

for (const a of assumptions) {
  const declaredAt = ts();
  events.push({
    event_id: eid("assumptiondeclared", a.id),
    event_type: "AssumptionDeclared",
    thread_id: THREAD_ID,
    actor_id: a.actor,
    timestamp: declaredAt,
    payload: {
      assumption: {
        id: a.id,
        object: "assumption",
        threadId: THREAD_ID,
        text: a.text,
        status: "active",
        evidenceIds: a.evidenceIds,
        confidence: a.confidence,
        declaredByParticipantId: a.actor,
        declaredAt: declaredAt,
        contentHash: `sha256:pharma_${a.id}`,
      },
    },
  });
}

// === Claims ===
const claims = [
  {
    id: "clm_efficacy_supports_advancement",
    text: "Phase II efficacy data at 200mg supports advancement to Phase III. The treatment effect size is clinically meaningful and statistically robust for the primary endpoint.",
    evidenceIds: ["evd_phase2_efficacy", "evd_fda_type_b_minutes"],
    assumptionIds: ["asm_phase2_responders_generalize"],
    actor: "par_cmo",
  },
  {
    id: "clm_safety_profile_acceptable_with_mitigation",
    text: "The safety profile is acceptable for Phase III advancement with protocol-level hepatic mitigation measures. The benefit-risk balance favors advancement given the unmet need in the bio-failure population.",
    evidenceIds: ["evd_safety_database", "evd_hepatotox_signal"],
    assumptionIds: ["asm_hepatotox_manageable_with_monitoring"],
    actor: "par_safety_officer",
  },
  {
    id: "clm_dose_selection_supported",
    text: "The 200mg Q4W dose is supported by exposure-response data and FDA alignment. No dose-finding uncertainty remains.",
    evidenceIds: ["evd_pkpd_modeling", "evd_fda_type_b_minutes"],
    assumptionIds: ["asm_pkpd_model_holds_in_larger_population"],
    actor: "par_clin_pharm",
  },
  {
    id: "clm_subgroup_analysis_unreliable_for_design",
    text: "The post-hoc bio-failure subgroup analysis should not drive Phase III trial design decisions. Enrichment based on an underpowered post-hoc finding creates regulatory and scientific risk.",
    evidenceIds: ["evd_subgroup_analysis"],
    assumptionIds: ["asm_bio_failure_subgroup_not_primary"],
    actor: "par_biostat",
  },
  {
    id: "clm_regulatory_path_viable",
    text: "The regulatory path is viable with a single pivotal trial if the design includes a pre-specified interim futility analysis and robust hepatic monitoring, consistent with FDA Type B meeting feedback.",
    evidenceIds: ["evd_fda_type_b_minutes", "evd_regulatory_landscape"],
    assumptionIds: [],
    actor: "par_reg_affairs",
  },
];

for (const c of claims) {
  events.push({
    event_id: eid("claimcreated", c.id),
    event_type: "ClaimCreated",
    thread_id: THREAD_ID,
    actor_id: c.actor,
    timestamp: ts(),
    payload: {
      claim: {
        id: c.id,
        object: "claim",
        threadId: THREAD_ID,
        text: c.text,
        status: "endorsed",
        evidenceIds: c.evidenceIds,
        assumptionIds: c.assumptionIds,
        contradictingEvidenceIds: [],
        createdByParticipantId: c.actor,
        createdAt: ts(),
      },
    },
  });
}

// === Positions ===
const positions = [
  { participantId: "par_cmo", targetObjectId: "clm_efficacy_supports_advancement", stance: "support", reason: "Treatment effect is clinically meaningful and Phase III design can be powered from Phase II estimates." },
  { participantId: "par_reg_affairs", targetObjectId: "clm_regulatory_path_viable", stance: "support", reason: "FDA alignment on dose, single-pivotal strategy, and monitoring plan reduces regulatory risk to acceptable level." },
  { participantId: "par_safety_officer", targetObjectId: "clm_safety_profile_acceptable_with_mitigation", stance: "support", reason: "Hepatotoxicity signal is concerning but addressable with the DILI panel recommendations built into the Phase III protocol." },
  { participantId: "par_biostat", targetObjectId: "clm_efficacy_supports_advancement", stance: "support", reason: "Primary endpoint effect size is sufficient for powering. My concern is about the subgroup analysis influencing the design, not the overall go decision." },
];

for (const p of positions) {
  const posId = `pos_${p.participantId.replace("par_", "")}_${p.stance}`;
  events.push({
    event_id: eid("positiontaken", p.participantId),
    event_type: "PositionTaken",
    thread_id: THREAD_ID,
    actor_id: p.participantId,
    timestamp: ts(),
    payload: {
      position: {
        id: posId,
        object: "position",
        threadId: THREAD_ID,
        participantId: p.participantId,
        targetObjectId: p.targetObjectId,
        targetObjectType: "claim",
        stance: p.stance,
        reason: p.reason,
        takenAt: ts(),
      },
    },
  });
}

// === Objections ===
events.push({
  event_id: eid("objectionraised", "subgroup_driven_design"),
  event_type: "ObjectionRaised",
  thread_id: THREAD_ID,
  actor_id: "par_biostat",
  timestamp: ts(),
  payload: {
    objection: {
      id: "obj_subgroup_design_risk",
      object: "objection",
      threadId: THREAD_ID,
      participantId: "par_biostat",
      targetObjectId: "clm_efficacy_supports_advancement",
      targetObjectType: "claim",
      assumption: "Phase II responder rates will generalize to Phase III without accounting for population heterogeneity introduced by the bio-failure subgroup finding.",
      text: "If the Phase III protocol incorporates any stratification, enrichment, or secondary endpoint derived from the post-hoc bio-failure subgroup analysis, the trial is at risk of a false-positive primary endpoint result or an FDA challenge on multiplicity. The subgroup finding should be tested only as an exploratory objective, not embedded in the design. I support the go decision but object to any design element that relies on the subgroup finding as though it were pre-specified.",
      status: "open",
      raisedAt: ts(),
    },
  },
});

events.push({
  event_id: eid("objectionraised", "hepatotox_stopping_rules"),
  event_type: "ObjectionRaised",
  thread_id: THREAD_ID,
  actor_id: "par_safety_officer",
  timestamp: ts(),
  payload: {
    objection: {
      id: "obj_hepatotox_stopping_rules_undefined",
      object: "objection",
      threadId: THREAD_ID,
      participantId: "par_safety_officer",
      targetObjectId: "clm_safety_profile_acceptable_with_mitigation",
      targetObjectType: "claim",
      assumption: "Enhanced monitoring alone is sufficient to manage the hepatotoxicity risk.",
      text: "The DILI panel recommended monitoring and exclusion criteria, but the Phase III protocol does not yet define quantitative stopping rules for hepatic safety events at the trial level. If a third serious hepatotoxicity case occurs in Phase III before stopping rules are in place, the DSMB will not have pre-specified criteria for recommending a clinical hold. The stopping rules must be finalized and included in the protocol before the first patient is dosed, not addressed as a protocol amendment after enrollment begins.",
      status: "open",
      raisedAt: ts(),
    },
  },
});

events.push({
  event_id: eid("objectionraised", "pkpd_external_validation"),
  event_type: "ObjectionRaised",
  thread_id: THREAD_ID,
  actor_id: "par_clin_pharm",
  timestamp: ts(),
  payload: {
    objection: {
      id: "obj_pkpd_no_external_validation",
      object: "objection",
      threadId: THREAD_ID,
      participantId: "par_clin_pharm",
      targetObjectId: "clm_dose_selection_supported",
      targetObjectType: "claim",
      assumption: "The PK/PD model will hold in a larger, more heterogeneous population.",
      text: "The exposure-response model was developed and evaluated on the same Phase II dataset. Without external validation, the prediction that 85 percent of patients will achieve target exposure at 200mg is based on model-internal consistency, not demonstrated generalizability. I support the dose selection but flag that if early Phase III PK data diverge from the model prediction, a protocol-specified dose adjustment pathway should already exist rather than requiring an amendment.",
      status: "open",
      raisedAt: ts(),
    },
  },
});

// === DecisionRequestOpened ===
const DR_ID = "drq_phase2_phase3_ltn4481";
events.push({
  event_id: eid("decisionrequestopened", "phase_gate"),
  event_type: "DecisionRequestOpened",
  thread_id: THREAD_ID,
  actor_id: "par_cmo",
  timestamp: ts(),
  payload: {
    decisionRequest: {
      id: DR_ID,
      object: "decisionRequest",
      threadId: THREAD_ID,
      proposal: "Advance LTN-4481 to a single Phase III pivotal trial at 200mg Q4W with an adaptive design including a pre-specified interim futility analysis, hepatic monitoring and exclusion criteria per the DILI panel, and the bio-failure subgroup as an exploratory objective only.",
      status: "review",
      supportingEvidenceIds: evidenceItems.map((e) => e.id),
      supportingClaimIds: claims.map((c) => c.id),
      supportingAssumptionIds: assumptions.map((a) => a.id),
      objectionIds: ["obj_subgroup_design_risk", "obj_hepatotox_stopping_rules_undefined", "obj_pkpd_no_external_validation"],
      openedByParticipantId: "par_cmo",
      openedAt: ts(),
    },
  },
});

// === Reviews ===
events.push({
  event_id: eid("reviewsubmitted", "reg_affairs_review"),
  event_type: "ReviewSubmitted",
  thread_id: THREAD_ID,
  actor_id: "par_reg_affairs",
  timestamp: ts(),
  payload: {
    review: {
      id: "rev_reg_affairs_approve",
      object: "review",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      reviewerParticipantId: "par_reg_affairs",
      status: "approve_with_conditions",
      conditions: [
        "Hepatic stopping rules finalized in the protocol before first patient dosed",
        "Bio-failure subgroup analysis designated as exploratory only in the SAP — no alpha allocation",
        "Protocol-specified PK sampling at weeks 4 and 12 to enable early exposure-response model validation",
      ],
      comment: "Regulatory path is viable. The conditions align with FDA Type B feedback and protect against the objections raised. Advancement is supportable if these conditions are met before IND amendment submission.",
      reviewedAt: ts(),
    },
  },
});

events.push({
  event_id: eid("reviewsubmitted", "biostat_review"),
  event_type: "ReviewSubmitted",
  thread_id: THREAD_ID,
  actor_id: "par_biostat",
  timestamp: ts(),
  payload: {
    review: {
      id: "rev_biostat_approve",
      object: "review",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      reviewerParticipantId: "par_biostat",
      status: "approve_with_conditions",
      conditions: [
        "Primary endpoint analysis powered on the ITT population at the overall Phase II effect size — no enrichment",
        "Interim futility analysis pre-specified with binding futility boundary at conditional power below 20 percent",
        "Bio-failure subgroup analysis isolated as an exploratory objective with no impact on the primary alpha",
        "Enrollment capped at 60 percent before interim futility readout",
      ],
      comment: "I support advancement. My objection is about design discipline, not the go decision itself. If the subgroup finding leaks into the primary analysis framework, I will escalate to the development governance committee.",
      reviewedAt: ts(),
    },
  },
});

events.push({
  event_id: eid("reviewsubmitted", "safety_review"),
  event_type: "ReviewSubmitted",
  thread_id: THREAD_ID,
  actor_id: "par_safety_officer",
  timestamp: ts(),
  payload: {
    review: {
      id: "rev_safety_approve",
      object: "review",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      reviewerParticipantId: "par_safety_officer",
      status: "approve_with_conditions",
      conditions: [
        "Quantitative hepatic stopping rules included in the protocol before first patient dosed",
        "DSMB charter includes explicit hepatotoxicity review criteria and authority to recommend clinical hold",
        "Baseline ALT greater than 2x ULN exclusion criterion in effect from enrollment start",
        "Biweekly ALT/AST monitoring for first 12 weeks per DILI panel recommendation",
      ],
      comment: "Safety profile supports advancement with mitigation. The stopping rules are the critical gap — monitoring without decision criteria is not a safety plan. This condition is non-negotiable.",
      reviewedAt: ts(),
    },
  },
});

// === DecisionMerged ===
const DCR_ID = "dcr_phase2_phase3_ltn4481";
events.push({
  event_id: eid("decisionmerged", "phase_gate"),
  event_type: "DecisionMerged",
  thread_id: THREAD_ID,
  actor_id: "par_cmo",
  timestamp: ts(),
  payload: {
    decisionRecord: {
      id: DCR_ID,
      object: "decisionRecord",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      status: "approved",
      summary: "LTN-4481 advances to Phase III — single pivotal trial, 200mg Q4W, adaptive design with pre-specified interim futility analysis. Scope narrower than requested: bio-failure subgroup is exploratory only, enrollment capped at 60 percent pre-interim, and hepatic stopping rules must be finalized before first patient dosed.",
      rationale: "Phase II efficacy at 200mg is clinically meaningful (38.2 percent remission vs 12.1 percent placebo), dose selection is FDA-aligned, and the safety profile is acceptable with protocol-level hepatic mitigation. The three reviewer objections are incorporated as binding conditions rather than grounds for delay: (1) subgroup isolation protects statistical integrity, (2) hepatic stopping rules close the safety gap before dosing begins, and (3) early PK sampling enables model validation in-stream. The CMO accepts residual risk that the PK/PD model may not generalize, mitigated by the protocol-specified dose adjustment pathway.",
      conditions: [
        "Hepatic stopping rules finalized in the Phase III protocol before the first patient is dosed. This is a hard gate — no dosing without stopping rules.",
        "DSMB charter includes explicit hepatotoxicity review criteria with authority to recommend clinical hold.",
        "Baseline ALT greater than 2x ULN is an exclusion criterion from enrollment start.",
        "Biweekly ALT/AST monitoring for the first 12 weeks per DILI panel recommendation.",
        "Bio-failure subgroup analysis is exploratory only. No alpha allocation. No enrichment. No stratification based on prior biologic exposure in the primary analysis.",
        "Interim futility analysis pre-specified with binding futility boundary at conditional power below 20 percent.",
        "Enrollment capped at 60 percent before interim futility readout.",
        "Protocol-specified PK sampling at weeks 4 and 12 to enable early exposure-response model validation. If observed exposure deviates more than 30 percent from model prediction, the dose adjustment pathway activates automatically.",
        "Phase III primary endpoint: Modified Mayo Score remission at week 16, powered on the ITT population using the overall Phase II effect size.",
      ],
      supportingEvidenceIds: evidenceItems.map((e) => e.id),
      supportingClaimIds: claims.map((c) => c.id),
      supportingAssumptionIds: assumptions.map((a) => a.id),
      objectionIds: ["obj_subgroup_design_risk", "obj_hepatotox_stopping_rules_undefined", "obj_pkpd_no_external_validation"],
      reviewIds: ["rev_reg_affairs_approve", "rev_biostat_approve", "rev_safety_approve"],
      authorityTrail: [
        { participantId: "par_cmo", role: "decision owner", source: "ParticipantAdded.role" },
      ],
      preservedObjectionIds: ["obj_subgroup_design_risk", "obj_hepatotox_stopping_rules_undefined", "obj_pkpd_no_external_validation"],
      minorityReportIds: ["mnr_biostat_subgroup_discipline"],
      nextAction: "Protocol team finalizes Phase III protocol with all nine conditions incorporated. Hepatic stopping rules and DSMB charter are the critical path — no IND amendment submission until both are complete. Target IND amendment: 8 weeks.",
      decidedByParticipantId: "par_cmo",
      decidedAt: ts(),
      contentHash: "sha256:pharma_dcr_phase2_phase3_ltn4481",
    },
  },
});

// === MinorityReportFiled ===
events.push({
  event_id: eid("minorityreportfiled", "biostat_dissent"),
  event_type: "MinorityReportFiled",
  thread_id: THREAD_ID,
  actor_id: "par_biostat",
  timestamp: ts(),
  payload: {
    minorityReport: {
      id: "mnr_biostat_subgroup_discipline",
      object: "minorityReport",
      threadId: THREAD_ID,
      decisionRecordId: DCR_ID,
      participantId: "par_biostat",
      text: "I support the go decision and the adaptive design. This minority report documents a structural concern for the trial master file: the post-hoc bio-failure subgroup analysis (46.3 percent remission in 89 patients, CI 32.8-59.8) will generate internal and external pressure to incorporate the finding into the Phase III design — as a stratification factor, a co-primary endpoint, or an enrichment strategy. Any of these would compromise the statistical integrity of the trial. The conditions in the decision record designate the subgroup as exploratory only with no alpha allocation, and I record this dissent to ensure that if a future protocol amendment attempts to promote the subgroup finding from exploratory to confirmatory, there is a traceable record that this risk was identified at the go/no-go decision and the biostatistician objected to any design element that treats a post-hoc finding as pre-specified. Additionally, the hepatic stopping rules objection is incorporated as a hard gate, but I note that if organizational pressure to accelerate enrollment leads to first-patient-dosed before the stopping rules are finalized, this decision record documents that the safety officer and the development team identified this as a non-negotiable precondition.",
      objectionIds: ["obj_subgroup_design_risk", "obj_hepatotox_stopping_rules_undefined", "obj_pkpd_no_external_validation"],
      filedAt: ts(),
      contentHash: "sha256:pharma_mnr_biostat_subgroup_discipline",
    },
  },
});

// === Generate with proper hash chain ===
let previousHash = null;
const prepared = events.map((e) => {
  const p = prepareEventForAppend(e, previousHash);
  previousHash = p.content_hash;
  return p;
});

const outPath = path.join(__dirname, "..", "examples", "pharma-phase-gate.ndjson");
fs.writeFileSync(outPath, prepared.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
console.log(`Wrote ${prepared.length} events to ${outPath}`);
