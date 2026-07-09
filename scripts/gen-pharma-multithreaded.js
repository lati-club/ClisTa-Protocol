#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { prepareEventForAppend } = require("../src/integrity");

const OUT_DIR = path.join(__dirname, "..", "examples", "pharma-phase-gate-multithreaded");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = "2026-06-29T09:00:00.000Z";
const BASE_MS = Date.parse(BASE);
let globalSeq = 0;

function ts() {
  const d = new Date(BASE);
  d.setMilliseconds(d.getMilliseconds() + globalSeq * 22);
  globalSeq++;
  return d.toISOString();
}

// Deterministic on purpose: the same source produces byte-identical logs, so the
// committed example is reproducible and a content change yields a minimal diff.
// Both the time and entropy components derive from a stable per-event counter —
// never Date.now()/randomBytes, which would re-churn every id and hash per run.
let eidSeq = 0;
function eid(type, hint) {
  const slug = hint.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
  const n = eidSeq++;
  const time = (BASE_MS + n * 22).toString(36);
  const entropy = crypto.createHash("sha256").update(`${type}|${hint}|${n}`).digest("hex").slice(0, 8);
  return `evt_${type.toLowerCase()}_${slug}_${time}_${entropy}`;
}

function chainAndWrite(events, filename) {
  let previousHash = null;
  const prepared = events.map((e) => {
    const p = prepareEventForAppend(e, previousHash);
    previousHash = p.content_hash;
    return p;
  });
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, prepared.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  // Cross-thread references anchor on the DecisionMerged event, NOT the last event in
  // the file: an arm may append a MinorityReportFiled after its decision, so the last
  // hash is not the decision hash. Map each decisionRecord id to its event content hash.
  const decisionHashById = {};
  for (const e of prepared) {
    if (e.event_type === "DecisionMerged") {
      decisionHashById[e.payload.decisionRecord.id] = e.content_hash;
    }
  }
  return { hash: previousHash, decisionHashById, events: prepared, path: outPath, count: prepared.length };
}

// ============================================================
// SHARED PARTICIPANTS (used across arms)
// ============================================================
function addParticipants(events, threadId, participants) {
  for (const p of participants) {
    events.push({
      event_id: eid("participantadded", p.id),
      event_type: "ParticipantAdded",
      thread_id: threadId,
      actor_id: p.id,
      timestamp: ts(),
      payload: { participant: { id: p.id, object: "participant", kind: p.kind, name: p.name, role: p.role } },
    });
  }
}

function addThread(events, threadId, title, question, participantIds, actorId) {
  events.push({
    event_id: eid("threadcreated", threadId),
    event_type: "ThreadCreated",
    thread_id: threadId,
    actor_id: actorId,
    timestamp: ts(),
    payload: {
      thread: { id: threadId, object: "thread", title, question, status: "active", participantIds, createdAt: BASE, updatedAt: BASE },
    },
  });
}

function addEvidence(events, threadId, id, source, finding, confidence, actor) {
  const at = ts();
  events.push({
    event_id: eid("evidencecommitted", id),
    event_type: "EvidenceCommitted",
    thread_id: threadId,
    actor_id: actor,
    timestamp: at,
    payload: {
      evidence: { id, object: "evidence", threadId, source, finding, confidence, committedByParticipantId: actor, committedAt: at, artifactIds: [], contentHash: `sha256:arm_${id}` },
    },
  });
}

function addAssumption(events, threadId, id, text, evidenceIds, confidence, actor) {
  const at = ts();
  events.push({
    event_id: eid("assumptiondeclared", id),
    event_type: "AssumptionDeclared",
    thread_id: threadId,
    actor_id: actor,
    timestamp: at,
    payload: {
      assumption: { id, object: "assumption", threadId, text, status: "active", evidenceIds, confidence, declaredByParticipantId: actor, declaredAt: at, contentHash: `sha256:arm_${id}` },
    },
  });
}

function addClaim(events, threadId, id, text, evidenceIds, assumptionIds, actor) {
  events.push({
    event_id: eid("claimcreated", id),
    event_type: "ClaimCreated",
    thread_id: threadId,
    actor_id: actor,
    timestamp: ts(),
    payload: {
      claim: { id, object: "claim", threadId, text, status: "endorsed", evidenceIds, assumptionIds, contradictingEvidenceIds: [], createdByParticipantId: actor, createdAt: ts() },
    },
  });
}

function addPosition(events, threadId, participantId, targetObjectId, stance, reason) {
  events.push({
    event_id: eid("positiontaken", participantId),
    event_type: "PositionTaken",
    thread_id: threadId,
    actor_id: participantId,
    timestamp: ts(),
    payload: {
      position: { id: `pos_${participantId.replace("par_","")}_${stance}`, object: "position", threadId, participantId, targetObjectId, targetObjectType: "claim", stance, reason, takenAt: ts() },
    },
  });
}

function addDR(events, threadId, drId, proposal, evidenceIds, claimIds, assumptionIds, objectionIds, actor) {
  events.push({
    event_id: eid("decisionrequestopened", drId),
    event_type: "DecisionRequestOpened",
    thread_id: threadId,
    actor_id: actor,
    timestamp: ts(),
    payload: {
      decisionRequest: { id: drId, object: "decisionRequest", threadId, proposal, status: "review", supportingEvidenceIds: evidenceIds, supportingClaimIds: claimIds, supportingAssumptionIds: assumptionIds, objectionIds, openedByParticipantId: actor, openedAt: ts() },
    },
  });
}

function addReview(events, threadId, revId, drId, reviewer, status, conditions, comment) {
  events.push({
    event_id: eid("reviewsubmitted", revId),
    event_type: "ReviewSubmitted",
    thread_id: threadId,
    actor_id: reviewer,
    timestamp: ts(),
    payload: {
      review: { id: revId, object: "review", threadId, decisionRequestId: drId, reviewerParticipantId: reviewer, status, conditions, comment, reviewedAt: ts() },
    },
  });
}

function addDecision(events, threadId, dcrId, drId, summary, rationale, conditions, evidenceIds, claimIds, assumptionIds, objectionIds, reviewIds, preservedObjectionIds, minorityReportIds, nextAction, actor) {
  events.push({
    event_id: eid("decisionmerged", dcrId),
    event_type: "DecisionMerged",
    thread_id: threadId,
    actor_id: actor,
    timestamp: ts(),
    payload: {
      decisionRecord: { id: dcrId, object: "decisionRecord", threadId, decisionRequestId: drId, status: "approved", summary, rationale, conditions, supportingEvidenceIds: evidenceIds, supportingClaimIds: claimIds, supportingAssumptionIds: assumptionIds, objectionIds, reviewIds, authorityTrail: [{ participantId: actor, role: "decision owner", source: "ParticipantAdded.role" }], preservedObjectionIds, minorityReportIds, nextAction, decidedByParticipantId: actor, decidedAt: ts(), contentHash: `sha256:arm_${dcrId}` },
    },
  });
}

// ============================================================
// ARM 1: PK/PD MODELING
// ============================================================
function buildPkpdArm() {
  const TH = "thd_arm_pkpd_modeling_ltn4481";
  const events = [];
  const parts = [
    { id: "par_clin_pharm", kind: "human", name: "Dr. A. Osei", role: "decision owner" },
    { id: "par_pk_modeler", kind: "human", name: "Dr. F. Chen", role: "pk modeling scientist" },
  ];
  addParticipants(events, TH, parts);
  addThread(events, TH, "PK/PD Modeling — LTN-4481 Dose Confirmation", "Is the 200mg Q4W dose supported by exposure-response data for Phase III?", parts.map(p=>p.id), "par_clin_pharm");

  addEvidence(events, TH, "evd_pkpd_pop_model", "Population PK/PD analysis (4481-PK-002)", "Exposure-response modeling on Phase II data (N=347). Cmin at steady state correlates with endoscopic improvement (R-squared 0.71). 200mg Q4W predicts 85 percent of patients achieve target exposure.", 0.84, "par_pk_modeler");
  addEvidence(events, TH, "evd_pkpd_internal_validation", "Internal model validation (bootstrap, VPC)", "1000-replicate bootstrap shows parameter stability. Visual predictive check covers 90 percent of observed data within prediction interval. No external dataset available for external validation.", 0.79, "par_pk_modeler");
  addEvidence(events, TH, "evd_dose_response_phase2", "Phase II dose-response (100mg vs 200mg vs placebo)", "Clear dose-response: placebo 12.1 percent, 100mg 24.7 percent, 200mg 38.2 percent remission. Exposure-response is monotonic and still rising at 200mg — the top of the dose-response was not characterized above 200mg (only two active levels tested).", 0.91, "par_clin_pharm");
  addEvidence(events, TH, "evd_hepatic_exposure_response", "Hepatic safety exposure-response check (4481-PK-005)", "Both serious transaminase elevations occurred at 200mg, but with two active dose levels and n=2 events no exposure-response for hepatotoxicity could be established. Dose selection therefore rests on the efficacy exposure-response; the hepatic signal is managed by monitoring and stopping rules, not by dose reduction.", 0.61, "par_pk_modeler");

  addAssumption(events, TH, "asm_pkpd_model_generalizes", "The PK/PD model developed on Phase II data will generalize to the larger, more heterogeneous Phase III population without external validation.", ["evd_pkpd_internal_validation"], 0.69, "par_clin_pharm");
  addAssumption(events, TH, "asm_no_hepatic_exposure_response", "No dose-safety exposure-response was established for the hepatic signal; the 200mg selection is efficacy-driven, and dose is not being used as a lever to manage hepatotoxicity.", ["evd_hepatic_exposure_response"], 0.6, "par_clin_pharm");
  addClaim(events, TH, "clm_dose_confirmed", "200mg Q4W is the confirmed Phase III maintenance dose (with a defined induction regimen through week 12) based on the efficacy exposure-response and FDA alignment; safety is managed by monitoring rather than a dose-safety relationship.", ["evd_pkpd_pop_model", "evd_dose_response_phase2"], ["asm_pkpd_model_generalizes", "asm_no_hepatic_exposure_response"], "par_clin_pharm");
  addPosition(events, TH, "par_pk_modeler", "clm_dose_confirmed", "support", "Model supports 200mg. External validation gap is a monitoring item, not a blocker.");
  addPosition(events, TH, "par_clin_pharm", "clm_dose_confirmed", "support", "Dose-response is clear. Recommend protocol-specified PK sampling at weeks 4 and 12 for early model check.");

  const DR = "drq_pkpd_dose_confirm";
  addDR(events, TH, DR, "Confirm 200mg Q4W for Phase III with protocol-specified early PK sampling for model validation.", ["evd_pkpd_pop_model","evd_pkpd_internal_validation","evd_dose_response_phase2"], ["clm_dose_confirmed"], ["asm_pkpd_model_generalizes"], [], "par_clin_pharm");
  addReview(events, TH, "rev_pk_modeler", DR, "par_pk_modeler", "approve_with_conditions", ["Protocol-specified PK sampling at weeks 4 and 12", "Dose adjustment pathway pre-specified if observed exposure deviates more than 30 percent from prediction"], "Model supports the dose. Conditions protect against generalization failure.");
  addDecision(events, TH, "dcr_pkpd_dose_confirmed", DR, "200mg Q4W confirmed for Phase III. Early PK sampling and dose adjustment pathway required.", "Exposure-response is monotonic and model-supported. External validation gap mitigated by in-stream PK checks.", ["Protocol-specified PK sampling at weeks 4 and 12", "Dose adjustment pathway activates if observed exposure deviates more than 30 percent from model prediction"], ["evd_pkpd_pop_model","evd_pkpd_internal_validation","evd_dose_response_phase2"], ["clm_dose_confirmed"], ["asm_pkpd_model_generalizes"], [], ["rev_pk_modeler"], [], [], "Include PK sampling schedule and dose adjustment trigger in Phase III protocol.", "par_clin_pharm");

  return chainAndWrite(events, "arm-pkpd-modeling.ndjson");
}

// ============================================================
// ARM 2: SAFETY SIGNAL ASSESSMENT
// ============================================================
function buildSafetyArm() {
  const TH = "thd_arm_safety_assessment_ltn4481";
  const events = [];
  const parts = [
    { id: "par_safety_officer", kind: "human", name: "Dr. T. Nakamura", role: "decision owner" },
    { id: "par_dili_panel", kind: "human", name: "DILI Expert Panel", role: "independent reviewer" },
  ];
  addParticipants(events, TH, parts);
  addThread(events, TH, "Safety Signal Assessment — LTN-4481 Hepatotoxicity", "Is the hepatotoxicity signal manageable for Phase III advancement?", parts.map(p=>p.id), "par_safety_officer");

  addEvidence(events, TH, "evd_integrated_safety", "Integrated safety database (4481-ISS-001, N=612)", "SAE rate 6.8 percent vs 5.2 percent placebo. Two serious hepatotoxicity cases (ALT greater than 10x ULN) in 200mg arm; in both, total bilirubin remained below 2x ULN, so neither met Hy's Law criteria (isolated transaminase elevation, Temple's Corollary), and both resolved on discontinuation. No deaths. Infection rate 14.3 percent vs 11.7 percent placebo.", 0.88, "par_safety_officer");
  addEvidence(events, TH, "evd_dili_panel_review", "DILI expert panel assessment (4481-SA-003)", "Panel consensus: probable drug-related hepatotoxicity (RUCAM 'probable'). Baseline hepatic steatosis was considered and rejected as sole cause — steatosis does not produce ALT greater than 10x ULN. Recommends excluding baseline ALT greater than 2x ULN, biweekly liver monitoring for first 12 weeks, and protocol-defined Hy's Law stopping and rechallenge rules.", 0.79, "par_dili_panel");
  addEvidence(events, TH, "evd_class_context", "Hepatotoxicity class context (FDA safety communications 2024-2026)", "FDA has issued two safety-based label changes for UC drugs in the past 18 months related to hepatic signals. Heightened scrutiny expected.", 0.86, "par_safety_officer");

  addAssumption(events, TH, "asm_monitoring_sufficient", "Enhanced monitoring (biweekly ALT/AST for 12 weeks) and exclusion criteria (baseline ALT greater than 2x ULN) are sufficient to manage the hepatotoxicity risk in Phase III.", ["evd_dili_panel_review", "evd_integrated_safety"], 0.76, "par_safety_officer");

  addClaim(events, TH, "clm_safety_manageable", "Hepatotoxicity signal is manageable for Phase III with protocol-level mitigation per DILI panel recommendations.", ["evd_integrated_safety", "evd_dili_panel_review"], ["asm_monitoring_sufficient"], "par_safety_officer");
  addPosition(events, TH, "par_dili_panel", "clm_safety_manageable", "support", "Signal is concerning but pattern is consistent with known mechanism. Mitigation measures are standard for the class.");

  // Objection: stopping rules
  events.push({
    event_id: eid("objectionraised", "stopping_rules"),
    event_type: "ObjectionRaised",
    thread_id: TH,
    actor_id: "par_safety_officer",
    timestamp: ts(),
    payload: {
      objection: {
        id: "obj_arm_stopping_rules",
        object: "objection",
        threadId: TH,
        participantId: "par_safety_officer",
        targetObjectId: "clm_safety_manageable",
        targetObjectType: "claim",
        assumption: "Monitoring alone is a complete safety plan.",
        text: "Monitoring without quantitative stopping rules is not a safety plan. The DSMB must have pre-specified criteria for recommending clinical hold on hepatic events. These must be finalized before first patient dosed.",
        status: "open",
        raisedAt: ts(),
      },
    },
  });

  const DR = "drq_safety_assessment";
  addDR(events, TH, DR, "Safety profile is acceptable for Phase III with DILI panel mitigation measures and hepatic stopping rules.", ["evd_integrated_safety","evd_dili_panel_review","evd_class_context"], ["clm_safety_manageable"], ["asm_monitoring_sufficient"], ["obj_arm_stopping_rules"], "par_safety_officer");
  addReview(events, TH, "rev_dili_panel", DR, "par_dili_panel", "approve_with_conditions", ["Baseline ALT greater than 2x ULN exclusion", "Biweekly ALT/AST monitoring first 12 weeks", "Quantitative stopping rules in protocol before FPD"], "Panel endorses advancement with mitigation.");
  addDecision(events, TH, "dcr_safety_acceptable", DR, "Safety profile acceptable for Phase III with three hard-gated conditions.", "Two hepatotoxicity cases are concerning; neither met Hy's Law criteria and both resolved on discontinuation. DILI panel consensus supports advancement. Stopping rules objection is incorporated as a binding pre-FPD condition.", ["Baseline ALT greater than 2x ULN exclusion criterion", "Biweekly ALT/AST monitoring for first 12 weeks", "Quantitative hepatic stopping rules finalized before first patient dosed — hard gate"], ["evd_integrated_safety","evd_dili_panel_review","evd_class_context"], ["clm_safety_manageable"], ["asm_monitoring_sufficient"], ["obj_arm_stopping_rules"], ["rev_dili_panel"], ["obj_arm_stopping_rules"], ["mnr_arm_stopping_rules_gate"], "Stopping rules and DSMB charter are critical path items.", "par_safety_officer");

  events.push({
    event_id: eid("minorityreportfiled", "stopping_rules"),
    event_type: "MinorityReportFiled",
    thread_id: TH,
    actor_id: "par_safety_officer",
    timestamp: ts(),
    payload: {
      minorityReport: {
        id: "mnr_arm_stopping_rules_gate",
        object: "minorityReport",
        threadId: TH,
        decisionRecordId: "dcr_safety_acceptable",
        participantId: "par_safety_officer",
        text: "The safety officer files this report to ensure the stopping-rules condition is treated as a hard gate. Monitoring without quantitative decision criteria is surveillance without a trigger. If enrollment begins before stopping rules are finalized, this record documents that the risk was identified and the condition was explicitly designated as non-negotiable.",
        objectionIds: ["obj_arm_stopping_rules"],
        filedAt: ts(),
        contentHash: "sha256:arm_mnr_stopping_rules_gate",
      },
    },
  });

  return chainAndWrite(events, "arm-safety-assessment.ndjson");
}

// ============================================================
// ARM 3: SUBGROUP ANALYSIS REVIEW
// ============================================================
function buildSubgroupArm() {
  const TH = "thd_arm_subgroup_review_ltn4481";
  const events = [];
  const parts = [
    { id: "par_biostat", kind: "human", name: "Dr. K. Liang", role: "decision owner" },
    { id: "par_cmo", kind: "human", name: "Dr. R. Vasquez", role: "clinical sponsor" },
  ];
  addParticipants(events, TH, parts);
  addThread(events, TH, "Subgroup Analysis Review — LTN-4481 Bio-Failure Responders", "Should the post-hoc bio-failure subgroup finding influence Phase III trial design?", parts.map(p=>p.id), "par_biostat");

  addEvidence(events, TH, "evd_subgroup_data", "Post-hoc subgroup analysis (4481-201-SGA)", "Bio-failure patients (n=89) showed 46.3 percent remission (95 percent CI 35.9-56.7, Wald) vs 34.1 percent in bio-naive patients (n=258). Post-hoc, not pre-specified; the treatment-by-subgroup interaction is not statistically significant and the nominal difference is unadjusted for multiplicity. Sample size inadequate for confirmatory inference.", 0.62, "par_biostat");
  addEvidence(events, TH, "evd_fda_subgroup_guidance", "FDA guidance on subgroup analyses in clinical trials (2023)", "FDA expects subgroup analyses to be pre-specified in the SAP. Post-hoc findings may be hypothesis-generating but should not drive primary endpoint strategy or enrichment without independent confirmation.", 0.93, "par_biostat");

  addAssumption(events, TH, "asm_subgroup_exploratory_only", "The bio-failure subgroup finding is hypothesis-generating only and should not drive Phase III enrichment, stratification, or primary endpoint strategy.", ["evd_subgroup_data", "evd_fda_subgroup_guidance"], 0.72, "par_biostat");
  addClaim(events, TH, "clm_no_subgroup_design_influence", "Phase III design must not incorporate the post-hoc bio-failure finding as anything other than an exploratory objective with no alpha allocation.", ["evd_subgroup_data", "evd_fda_subgroup_guidance"], ["asm_subgroup_exploratory_only"], "par_biostat");
  addPosition(events, TH, "par_biostat", "clm_no_subgroup_design_influence", "support", "Statistical integrity of the Phase III pivotal trial depends on this discipline.");
  addPosition(events, TH, "par_cmo", "clm_no_subgroup_design_influence", "support", "Agree the finding is interesting but premature for design-level decisions.");

  const DR = "drq_subgroup_designation";
  addDR(events, TH, DR, "Designate bio-failure subgroup as exploratory only in Phase III.", ["evd_subgroup_data","evd_fda_subgroup_guidance"], ["clm_no_subgroup_design_influence"], ["asm_subgroup_exploratory_only"], [], "par_biostat");
  addReview(events, TH, "rev_cmo_subgroup", DR, "par_cmo", "approve", [], "Agreed. Exploratory only.");
  addDecision(events, TH, "dcr_subgroup_exploratory", DR, "Bio-failure subgroup designated exploratory only. No alpha allocation, no enrichment, no stratification in Phase III primary analysis.", "Post-hoc finding with wide CI on 89 patients does not meet the evidentiary bar for design-level influence. FDA guidance reinforces this.", ["No alpha allocation to bio-failure subgroup analysis", "No enrichment or stratification based on prior biologic exposure", "Subgroup analysis isolated as exploratory objective in SAP"], ["evd_subgroup_data","evd_fda_subgroup_guidance"], ["clm_no_subgroup_design_influence"], ["asm_subgroup_exploratory_only"], [], ["rev_cmo_subgroup"], [], [], "Encode exploratory designation in SAP. Monitor for internal pressure to promote.", "par_biostat");

  // Minority report for the TMF
  events.push({
    event_id: eid("minorityreportfiled", "subgroup_discipline"),
    event_type: "MinorityReportFiled",
    thread_id: TH,
    actor_id: "par_biostat",
    timestamp: ts(),
    payload: {
      minorityReport: {
        id: "mnr_arm_subgroup_discipline",
        object: "minorityReport",
        threadId: TH,
        decisionRecordId: "dcr_subgroup_exploratory",
        participantId: "par_biostat",
        text: "This minority report is filed proactively for the trial master file. The bio-failure subgroup finding (46.3 percent remission, n=89, 95 percent CI 35.9-56.7) will generate organizational pressure to promote it from exploratory to confirmatory — as enrichment, stratification, or a co-primary endpoint. Any such promotion would compromise the statistical integrity of the Phase III trial and create regulatory risk. This dissent is recorded at the arm-level decision so that if a future protocol amendment attempts to change the subgroup designation, there is a traceable record that the lead biostatistician objected at the earliest decision point.",
        objectionIds: [],
        filedAt: ts(),
        contentHash: "sha256:arm_mnr_subgroup_discipline",
      },
    },
  });

  return chainAndWrite(events, "arm-subgroup-review.ndjson");
}

// ============================================================
// ARM 4: REGULATORY STRATEGY
// ============================================================
function buildRegArm() {
  const TH = "thd_arm_regulatory_strategy_ltn4481";
  const events = [];
  const parts = [
    { id: "par_reg_affairs", kind: "human", name: "J. Markova", role: "decision owner" },
    { id: "par_reg_writer", kind: "human", name: "M. Torres", role: "regulatory writer" },
  ];
  addParticipants(events, TH, parts);
  addThread(events, TH, "Regulatory Strategy — LTN-4481 Phase III Path", "What is the viable regulatory path for LTN-4481 Phase III?", parts.map(p=>p.id), "par_reg_affairs");

  addEvidence(events, TH, "evd_type_b_minutes", "FDA Type B End-of-Phase-2 meeting minutes (2026-02-14)", "FDA agreed 200mg Q4W reasonable. A single pivotal trial is acceptable as a treat-through study covering both induction and maintenance, at least 500 patients, with pre-specified interim futility — provided the induction study serves as the confirmatory source. Hepatic monitoring plan and stopping rules required.", 0.95, "par_reg_affairs");
  addEvidence(events, TH, "evd_competitive_landscape", "Competitive landscape memo (2026-05-22)", "Three JAK inhibitors and two IL-23 inhibitors approved for UC. FDA heightened scrutiny on hepatotoxicity. Bio-failure enrichment viewed favorably if supported by pre-specified analysis.", 0.86, "par_reg_writer");

  addAssumption(events, TH, "asm_fda_alignment_holds", "FDA Type B meeting agreements will hold through IND amendment review. No material change in FDA regulatory posture on UC drugs is expected.", ["evd_type_b_minutes"], 0.88, "par_reg_affairs");
  addClaim(events, TH, "clm_single_pivotal_viable", "Single pivotal trial strategy is viable as a treat-through study covering induction and maintenance, with adaptive design, interim futility, and hepatic monitoring per FDA feedback; the induction phase supplies the confirmatory evidence the single-pivotal path requires.", ["evd_type_b_minutes", "evd_competitive_landscape"], ["asm_fda_alignment_holds"], "par_reg_affairs");
  addPosition(events, TH, "par_reg_affairs", "clm_single_pivotal_viable", "support", "FDA alignment de-risks the regulatory path substantially.");
  addPosition(events, TH, "par_reg_writer", "clm_single_pivotal_viable", "support", "Meeting minutes provide clear design guidance.");

  const DR = "drq_reg_strategy";
  addDR(events, TH, DR, "Pursue single pivotal trial with adaptive design per FDA Type B alignment.", ["evd_type_b_minutes","evd_competitive_landscape"], ["clm_single_pivotal_viable"], [], [], "par_reg_affairs");
  addReview(events, TH, "rev_reg_writer", DR, "par_reg_writer", "approve", [], "Path is clear. IND amendment can reference meeting minutes directly.");
  addDecision(events, TH, "dcr_reg_strategy_confirmed", DR, "Single pivotal trial strategy confirmed. Adaptive design with interim futility, at least 500 patients, hepatic monitoring plan.", "FDA alignment on dose, design, and monitoring requirements provides a clear regulatory path. IND amendment should reference Type B meeting minutes.", ["Minimum 500 patients", "Pre-specified interim futility analysis", "Hepatic monitoring plan per FDA feedback", "IND amendment references Type B meeting agreement"], ["evd_type_b_minutes","evd_competitive_landscape"], ["clm_single_pivotal_viable"], ["asm_fda_alignment_holds"], [], ["rev_reg_writer"], [], [], "Draft IND amendment incorporating FDA meeting agreements.", "par_reg_affairs");

  return chainAndWrite(events, "arm-regulatory-strategy.ndjson");
}

// ============================================================
// PARENT THREAD: GO/NO-GO DECISION
// ============================================================
function buildParentThread(armResults) {
  const TH = "thd_phase2_to_phase3_go_nogo_ltn4481";
  const events = [];

  const participants = [
    { id: "par_cmo", kind: "human", name: "Dr. R. Vasquez", role: "decision owner" },
    { id: "par_biostat", kind: "human", name: "Dr. K. Liang", role: "lead biostatistician" },
    { id: "par_clin_pharm", kind: "human", name: "Dr. A. Osei", role: "clinical pharmacologist" },
    { id: "par_reg_affairs", kind: "human", name: "J. Markova", role: "vp regulatory affairs" },
    { id: "par_safety_officer", kind: "human", name: "Dr. T. Nakamura", role: "drug safety officer" },
    { id: "par_dsmb_chair", kind: "human", name: "Dr. E. Rowe", role: "independent dsmb chair" },
    { id: "par_octopus", kind: "agent", name: "Octopus", role: "execution orchestrator" },
  ];
  addParticipants(events, TH, participants);
  addThread(events, TH, "Phase II/III Go/No-Go — LTN-4481 (Moderate-to-Severe Ulcerative Colitis)", "Should LTN-4481 advance from Phase II to Phase III based on arm-level workstream outputs?", participants.map(p=>p.id), "par_cmo");

  // Delegations to Octopus for each arm
  const arms = [
    { id: "dlg_pkpd", action: "pkpd-modeling", summary: "Octopus delegated to execute PK/PD modeling arm" },
    { id: "dlg_safety", action: "safety-signal-assessment", summary: "Octopus delegated to execute safety signal assessment arm" },
    { id: "dlg_subgroup", action: "subgroup-analysis-review", summary: "Octopus delegated to execute subgroup analysis review arm" },
    { id: "dlg_reg", action: "regulatory-strategy", summary: "Octopus delegated to execute regulatory strategy arm" },
  ];
  for (const arm of arms) {
    events.push({
      event_id: eid("delegationgranted", arm.id),
      event_type: "DelegationGranted",
      thread_id: TH,
      actor_id: "par_cmo",
      timestamp: ts(),
      payload: {
        delegationGrant: {
          id: arm.id,
          object: "delegationGrant",
          threadId: TH,
          delegatorParticipantId: "par_cmo",
          delegateId: "par_octopus",
          delegateType: "participant",
          action: arm.action,
          scope: `thread:${TH}`,
          authorityRequired: "decision_owner",
          limits: [`scope:thread:${TH}`],
          summary: arm.summary,
          status: "active",
          grantedBy: "par_cmo",
          grantedAt: ts(),
          expiresAt: null,
          attributionRequired: true,
          authoritySurrender: false,
          authorityTransfer: false,
          automaticConsensus: false,
          delegatedConsensus: false,
          delegationWithoutAttribution: false,
          governanceMutation: false,
          implicitGovernanceChange: false,
          permanentAuthorityTransfer: false,
          unboundedAction: false,
        },
      },
    });
  }

  // Execution records
  const executions = [
    { id: "exe_pkpd", action: "pkpd-modeling", dlg: "dlg_pkpd" },
    { id: "exe_safety", action: "safety-signal-assessment", dlg: "dlg_safety" },
    { id: "exe_subgroup", action: "subgroup-analysis-review", dlg: "dlg_subgroup" },
    { id: "exe_reg", action: "regulatory-strategy", dlg: "dlg_reg" },
  ];
  for (const exe of executions) {
    events.push({
      event_id: eid("executionstarted", exe.id),
      event_type: "ExecutionStarted",
      thread_id: TH,
      actor_id: "par_octopus",
      timestamp: ts(),
      payload: {
        executionRecord: {
          id: exe.id,
          object: "executionRecord",
          threadId: TH,
          actorId: "par_octopus",
          authorizationRef: { type: "delegation", id: exe.dlg },
          decisionId: null,
          actionType: exe.action,
          scope: `thread:${TH}`,
          constraints: [`scope:thread:${TH}`],
          status: "active",
          startedAt: ts(),
          attribution: { actorId: "par_octopus", authorizationRef: { type: "delegation", id: exe.dlg }, delegationId: exe.dlg, decisionId: null },
          delegationId: exe.dlg,
        },
      },
    });
  }

  // === CrossThreadEvidence: import arm outputs ===
  const crossThreadItems = [
    {
      id: "cte_pkpd_output",
      sourceThreadId: "thd_arm_pkpd_modeling_ltn4481",
      sourceDecisionRecordId: "dcr_pkpd_dose_confirmed",
      sourceEventHash: armResults.pkpd.decisionHashById["dcr_pkpd_dose_confirmed"],
      derivation: "decision_output",
      finding: "200mg Q4W dose confirmed by exposure-response modeling. Cmin correlates with endoscopic improvement (R-squared 0.71). Early PK sampling at weeks 4 and 12 required. Dose adjustment pathway triggers if observed exposure deviates more than 30 percent from model prediction.",
      confidence: 0.84,
      actor: "par_clin_pharm",
    },
    {
      id: "cte_safety_output",
      sourceThreadId: "thd_arm_safety_assessment_ltn4481",
      sourceDecisionRecordId: "dcr_safety_acceptable",
      sourceEventHash: armResults.safety.decisionHashById["dcr_safety_acceptable"],
      derivation: "decision_output",
      finding: "Safety profile acceptable for Phase III with three hard-gated conditions: baseline ALT greater than 2x ULN exclusion, biweekly ALT/AST monitoring for 12 weeks, and quantitative hepatic stopping rules finalized before first patient dosed. Stopping rules condition is a preserved objection from the safety arm.",
      confidence: 0.79,
      actor: "par_safety_officer",
    },
    {
      id: "cte_safety_objection",
      sourceThreadId: "thd_arm_safety_assessment_ltn4481",
      sourceDecisionRecordId: "dcr_safety_acceptable",
      sourceEventHash: armResults.safety.decisionHashById["dcr_safety_acceptable"],
      derivation: "preserved_objection",
      finding: "Hepatic stopping rules must be finalized before first patient dosed. Monitoring without quantitative stopping criteria is not a safety plan. This objection survived the arm-level decision and propagates to the parent.",
      confidence: 0.91,
      actor: "par_safety_officer",
    },
    {
      id: "cte_subgroup_output",
      sourceThreadId: "thd_arm_subgroup_review_ltn4481",
      sourceDecisionRecordId: "dcr_subgroup_exploratory",
      sourceEventHash: armResults.subgroup.decisionHashById["dcr_subgroup_exploratory"],
      derivation: "decision_output",
      finding: "Bio-failure subgroup designated exploratory only. No alpha allocation, no enrichment, no stratification in Phase III primary analysis. Lead biostatistician filed proactive minority report documenting risk of organizational pressure to promote the finding.",
      confidence: 0.72,
      actor: "par_biostat",
    },
    {
      id: "cte_subgroup_minority",
      sourceThreadId: "thd_arm_subgroup_review_ltn4481",
      sourceDecisionRecordId: "dcr_subgroup_exploratory",
      sourceEventHash: armResults.subgroup.decisionHashById["dcr_subgroup_exploratory"],
      derivation: "minority_report",
      finding: "Biostatistician minority report: any future protocol amendment promoting the bio-failure subgroup from exploratory to confirmatory was flagged as a statistical integrity risk at the earliest decision point. Traceable for TMF.",
      confidence: 0.95,
      actor: "par_biostat",
    },
    {
      id: "cte_reg_output",
      sourceThreadId: "thd_arm_regulatory_strategy_ltn4481",
      sourceDecisionRecordId: "dcr_reg_strategy_confirmed",
      sourceEventHash: armResults.reg.decisionHashById["dcr_reg_strategy_confirmed"],
      derivation: "decision_output",
      finding: "Single pivotal trial strategy confirmed. Adaptive design with interim futility, at least 500 patients, hepatic monitoring plan per FDA Type B meeting alignment. IND amendment to reference meeting minutes.",
      confidence: 0.95,
      actor: "par_reg_affairs",
    },
  ];

  for (const cte of crossThreadItems) {
    const at = ts();
    events.push({
      event_id: eid("crossthreadevidence", cte.id),
      event_type: "CrossThreadEvidence",
      thread_id: TH,
      actor_id: cte.actor,
      timestamp: at,
      payload: {
        crossThreadEvidence: {
          id: cte.id,
          object: "crossThreadEvidence",
          threadId: TH,
          sourceThreadId: cte.sourceThreadId,
          sourceDecisionRecordId: cte.sourceDecisionRecordId,
          sourceEventHash: cte.sourceEventHash,
          derivation: cte.derivation,
          finding: cte.finding,
          confidence: cte.confidence,
          committedByParticipantId: cte.actor,
          committedAt: at,
          contentHash: `sha256:cte_${cte.id}`,
        },
      },
    });
  }

  // Phase II top-line (direct evidence, not from an arm)
  addEvidence(events, TH, "evd_phase2_topline", "LTN-4481 Phase II top-line results (Study 4481-201, N=347)", "Modified Mayo Score remission at week 16: 38.2 percent (200mg) vs 12.1 percent (placebo), p<0.001. Endoscopic improvement: 52.4 percent vs 21.8 percent.", 0.91, "par_cmo");

  // Assumptions that synthesize across arms
  addAssumption(events, TH, "asm_arms_converge", "All four arm-level decisions support advancement, each with binding conditions. Advancement is conditional, not unconditional: the safety arm's hepatic stopping-rules gate is a hard precondition, so 'no blocking finding' overstates — no arm blocked outright, but the safety gate must clear before dosing.", ["cte_pkpd_output", "cte_safety_output", "cte_subgroup_output", "cte_reg_output"], 0.8, "par_cmo");

  // Claims
  addClaim(events, TH, "clm_go_supported", "Phase III advancement is supported by converging arm-level decisions on dose, safety, subgroup discipline, and regulatory path.", ["cte_pkpd_output", "cte_safety_output", "cte_subgroup_output", "cte_reg_output", "evd_phase2_topline"], ["asm_arms_converge"], "par_cmo");

  // Positions
  addPosition(events, TH, "par_cmo", "clm_go_supported", "support", "Arms converge. Conditions from each arm are incorporated as binding.");
  addPosition(events, TH, "par_biostat", "clm_go_supported", "support", "Go decision is supported. Subgroup discipline conditions are non-negotiable.");
  addPosition(events, TH, "par_clin_pharm", "clm_go_supported", "support", "Dose is confirmed. PK monitoring conditions protect against model failure.");
  addPosition(events, TH, "par_safety_officer", "clm_go_supported", "support", "Safety is acceptable with conditions. Stopping rules are the critical path.");
  addPosition(events, TH, "par_reg_affairs", "clm_go_supported", "support", "Regulatory path is clear with FDA alignment.");
  addPosition(events, TH, "par_dsmb_chair", "clm_go_supported", "oppose", "Not opposed to the science, but a single ~500-patient pivotal is too small a safety database to carry a known hepatic signal to a label. Advise delay for a larger exposed population or a second confirmatory study before committing.");

  // A genuine advancement-level dissent (issue #79): the independent DSMB chair
  // argues WHETHER to advance now, not just how — the single pivotal doubles as
  // the labeling safety database for a known hepatic risk. Raised, preserved into
  // the decision, and carried in its own minority report; the decision still
  // proceeds to GO, so the dissent survives the approval rather than blocking it.
  events.push({
    event_id: eid("objectionraised", "advancement_premature"),
    event_type: "ObjectionRaised",
    thread_id: TH,
    actor_id: "par_dsmb_chair",
    timestamp: ts(),
    payload: {
      objection: {
        id: "obj_advancement_premature",
        object: "objection",
        threadId: TH,
        participantId: "par_dsmb_chair",
        targetObjectId: "clm_go_supported",
        targetObjectType: "claim",
        assumption: "A single ~500-patient pivotal provides an adequate labeling safety database for a drug with a known hepatotoxicity signal.",
        text: "The advancement decision itself is premature as scoped. A single ~500-patient pivotal doubles as the labeling safety database, but ICH E1 expects on the order of 1000-1500 exposed for a chronic, non-life-threatening indication — more so with an active hepatic signal. Recommend either an enlarged safety database or a second confirmatory study before committing to Phase III, rather than advancing on a single pivotal. Recorded as a dissent on the go decision, not merely on its conditions.",
        status: "open",
        raisedAt: ts(),
      },
    },
  });

  // Objections that propagate from arms
  events.push({
    event_id: eid("objectionraised", "propagated_stopping"),
    event_type: "ObjectionRaised",
    thread_id: TH,
    actor_id: "par_safety_officer",
    timestamp: ts(),
    payload: {
      objection: {
        id: "obj_stopping_rules_propagated",
        object: "objection",
        threadId: TH,
        participantId: "par_safety_officer",
        targetObjectId: "clm_go_supported",
        targetObjectType: "claim",
        assumption: "Arm-level safety conditions will be enforced in the parent decision.",
        text: "Propagated from safety arm (thd_arm_safety_assessment_ltn4481): hepatic stopping rules must be finalized before first patient dosed. This is a hard gate, not a timeline target. If organizational pressure accelerates enrollment before stopping rules are complete, this decision record documents the safety officer identified it as a non-negotiable precondition.",
        status: "open",
        raisedAt: ts(),
      },
    },
  });

  events.push({
    event_id: eid("objectionraised", "propagated_subgroup"),
    event_type: "ObjectionRaised",
    thread_id: TH,
    actor_id: "par_biostat",
    timestamp: ts(),
    payload: {
      objection: {
        id: "obj_subgroup_discipline_propagated",
        object: "objection",
        threadId: TH,
        participantId: "par_biostat",
        targetObjectId: "clm_go_supported",
        targetObjectType: "claim",
        assumption: "The exploratory-only designation for the bio-failure subgroup will hold against organizational pressure.",
        text: "Propagated from subgroup arm (thd_arm_subgroup_review_ltn4481): any future protocol amendment promoting the bio-failure subgroup from exploratory to confirmatory was flagged as a statistical integrity risk. This objection is recorded at the go/no-go level to ensure the escalation path is documented.",
        status: "open",
        raisedAt: ts(),
      },
    },
  });

  // Decision request
  const DR = "drq_go_nogo_ltn4481";
  addDR(events, TH, DR, "Advance LTN-4481 to Phase III with all arm-level conditions incorporated as binding.", ["cte_pkpd_output","cte_safety_output","cte_safety_objection","cte_subgroup_output","cte_subgroup_minority","cte_reg_output","evd_phase2_topline"], ["clm_go_supported"], ["asm_arms_converge"], ["obj_stopping_rules_propagated","obj_subgroup_discipline_propagated","obj_advancement_premature"], "par_cmo");

  // Reviews
  addReview(events, TH, "rev_biostat_parent", DR, "par_biostat", "approve_with_conditions", ["Subgroup exploratory-only designation is binding", "Enrollment capped at 60 percent before interim futility"], "Go decision supported. Subgroup conditions from arm thread must be enforced.");
  addReview(events, TH, "rev_safety_parent", DR, "par_safety_officer", "approve_with_conditions", ["Hepatic stopping rules before FPD — hard gate", "DSMB charter includes hepatotoxicity review authority"], "Safety conditions from arm thread propagate as binding conditions.");
  addReview(events, TH, "rev_reg_parent", DR, "par_reg_affairs", "approve_with_conditions", ["IND amendment incorporates all arm-level conditions", "FDA Type B agreements referenced in protocol"], "Regulatory path clear. All conditions must appear in IND amendment.");

  // Decision merged
  addDecision(events, TH, "dcr_go_nogo_ltn4481", DR,
    "LTN-4481 advances to Phase III. Single pivotal trial, 200mg Q4W, adaptive design. All arm-level conditions are binding. Scope narrower than requested: subgroup exploratory only, enrollment capped pre-interim, stopping rules before FPD.",
    "Four arm-level workstreams converge: dose confirmed (PK/PD), safety acceptable with mitigation (safety assessment), subgroup disciplined to exploratory (subgroup review), regulatory path clear (regulatory strategy). Two objections propagate from arms and survive the parent decision: stopping rules hard gate and subgroup discipline. A third, distinct dissent — the independent DSMB chair's objection that a single ~500-patient pivotal is an inadequate labeling safety database for a known hepatic signal — is on the go decision itself; the CMO acknowledges it, elects to advance on the FDA-aligned single-pivotal path, and preserves the dissent rather than resolving it. The CMO accepts residual risk on PK/PD model generalization, mitigated by in-stream sampling.",
    [
      "Hepatic stopping rules finalized before first patient dosed — hard gate (propagated from safety arm)",
      "DSMB charter includes hepatotoxicity review authority (propagated from safety arm)",
      "Baseline ALT greater than 2x ULN exclusion (propagated from safety arm)",
      "Biweekly ALT/AST monitoring for first 12 weeks (propagated from safety arm)",
      "Bio-failure subgroup exploratory only — no alpha, no enrichment, no stratification (propagated from subgroup arm)",
      "Enrollment capped at 60 percent before interim futility readout",
      "Binding futility boundary at conditional power below 20 percent",
      "PK sampling at weeks 4 and 12 — dose adjustment if exposure deviates more than 30 percent (propagated from PK/PD arm)",
      "IND amendment references FDA Type B meeting agreements (propagated from regulatory arm)",
    ],
    ["cte_pkpd_output","cte_safety_output","cte_safety_objection","cte_subgroup_output","cte_subgroup_minority","cte_reg_output","evd_phase2_topline"],
    ["clm_go_supported"],
    ["asm_arms_converge"],
    ["obj_stopping_rules_propagated","obj_subgroup_discipline_propagated","obj_advancement_premature"],
    ["rev_biostat_parent","rev_safety_parent","rev_reg_parent"],
    ["obj_stopping_rules_propagated","obj_subgroup_discipline_propagated","obj_advancement_premature"],
    ["mnr_parent_biostat_discipline","mnr_parent_advancement_dissent"],
    "Protocol team finalizes Phase III protocol incorporating all nine conditions from the four arm threads. Stopping rules and DSMB charter are critical path. Target IND amendment: 8 weeks.",
    "par_cmo"
  );

  // Minority report
  events.push({
    event_id: eid("minorityreportfiled", "parent_dissent"),
    event_type: "MinorityReportFiled",
    thread_id: TH,
    actor_id: "par_biostat",
    timestamp: ts(),
    payload: {
      minorityReport: {
        id: "mnr_parent_biostat_discipline",
        object: "minorityReport",
        threadId: TH,
        decisionRecordId: "dcr_go_nogo_ltn4481",
        participantId: "par_biostat",
        text: "This minority report propagates and reinforces the arm-level dissent from thd_arm_subgroup_review_ltn4481. At the go/no-go level, the risk is compounded: now that the program has a green light to Phase III, the commercial and timeline pressures to incorporate the bio-failure subgroup finding into the design will intensify. This report documents that the lead biostatistician objects to any protocol amendment that promotes the subgroup from exploratory to confirmatory, and that the stopping-rules hard gate from the safety arm must not be softened under enrollment pressure. Both objections survive the approval and are traceable through cross-thread provenance to the arm-level decisions that originated them.",
        objectionIds: ["obj_stopping_rules_propagated", "obj_subgroup_discipline_propagated"],
        filedAt: ts(),
        contentHash: "sha256:mnr_parent_biostat_discipline",
      },
    },
  });

  // The DSMB chair's advancement-level dissent, preserved as its own minority
  // report (issue #79) — distinct from the biostatistician's discipline report,
  // it records that the go decision was challenged on whether to advance at all.
  events.push({
    event_id: eid("minorityreportfiled", "advancement_dissent"),
    event_type: "MinorityReportFiled",
    thread_id: TH,
    actor_id: "par_dsmb_chair",
    timestamp: ts(),
    payload: {
      minorityReport: {
        id: "mnr_parent_advancement_dissent",
        object: "minorityReport",
        threadId: TH,
        decisionRecordId: "dcr_go_nogo_ltn4481",
        participantId: "par_dsmb_chair",
        text: "The independent DSMB chair dissents from the advancement decision as scoped. The program is advancing to Phase III on a single ~500-patient pivotal that will also serve as the labeling safety database for a drug with two serious transaminase elevations in Phase II. ICH E1 expects roughly 1000-1500 exposed for a chronic, non-life-threatening indication, and a live hepatic signal argues for more, not fewer. This report records that the chair recommended an enlarged safety database or a second confirmatory study before committing, that the decision proceeded on the FDA-aligned single-pivotal path notwithstanding, and that this dissent is on whether to advance — not merely on the conditions of advancement.",
        objectionIds: ["obj_advancement_premature"],
        filedAt: ts(),
        contentHash: "sha256:mnr_parent_advancement_dissent",
      },
    },
  });

  return chainAndWrite(events, "parent-go-nogo.ndjson");
}

// ============================================================
// MAIN
// ============================================================
const pkpd = buildPkpdArm();
const safety = buildSafetyArm();
const subgroup = buildSubgroupArm();
const reg = buildRegArm();
const parent = buildParentThread({ pkpd, safety, subgroup, reg });

console.log(`\nGenerated pharma multi-threaded phase gate:`);
console.log(`  ${pkpd.count} events  arm-pkpd-modeling.ndjson`);
console.log(`  ${safety.count} events  arm-safety-assessment.ndjson`);
console.log(`  ${subgroup.count} events  arm-subgroup-review.ndjson`);
console.log(`  ${reg.count} events  arm-regulatory-strategy.ndjson`);
console.log(`  ${parent.count} events  parent-go-nogo.ndjson`);
console.log(`  ---`);
console.log(`  ${pkpd.count + safety.count + subgroup.count + reg.count + parent.count} events total across 5 threads`);
