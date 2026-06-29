#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { prepareEventForAppend } = require("../src/integrity");

const THREAD_ID = "thd_vendor_dd_baas_partner_eval";
const BASE = "2026-06-28T14:00:00.000Z";

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

// --- Participants FIRST (before ThreadCreated) ---
const participants = [
  { id: "par_cro", kind: "human", name: "M. Reeves", role: "decision owner" },
  { id: "par_mrm", kind: "human", name: "D. Okoro", role: "model risk officer" },
  { id: "par_compliance", kind: "human", name: "J. Whitfield", role: "bsa_aml officer" },
  { id: "par_fintech_liaison", kind: "human", name: "S. Pratt", role: "fintech partnership liaison" },
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

// --- ThreadCreated ---
events.push({
  event_id: eid("threadcreated", "vendor_dd"),
  event_type: "ThreadCreated",
  thread_id: THREAD_ID,
  actor_id: "par_cro",
  timestamp: ts(),
  payload: {
    thread: {
      id: THREAD_ID,
      object: "thread",
      title: "Vendor Due Diligence — NovaPay BaaS Partnership",
      question: "Should the bank approve NovaPay as a BaaS partner for ACH and wire services?",
      status: "active",
      participantIds: participants.map((p) => p.id),
      createdAt: BASE,
      updatedAt: BASE,
    },
  },
});

// --- Evidence ---
const evidenceItems = [
  {
    id: "evd_soc2_type_ii",
    source: "NovaPay SOC 2 Type II Report (2025-09)",
    finding: "SOC 2 Type II report covers security, availability, and confidentiality trust service criteria. No exceptions noted. Report period ended 2025-09-30, issued by a Big Four firm.",
    confidence: 0.92,
    actor: "par_fintech_liaison",
  },
  {
    id: "evd_bsa_aml_program",
    source: "NovaPay BSA/AML Program Documentation (reviewed 2026-05)",
    finding: "BSA/AML program includes CDD/EDD procedures, SAR filing workflow, OFAC screening integration, and annual independent testing. Last independent test completed 2025-11.",
    confidence: 0.88,
    actor: "par_compliance",
  },
  {
    id: "evd_ffiec_exam_history",
    source: "FFIEC examination correspondence (NovaPay current sponsor bank)",
    finding: "NovaPay current sponsor bank received no MRAs or MRIAs related to NovaPay program in the most recent exam cycle (2025). One prior-cycle observation on transaction monitoring alert backlog was closed.",
    confidence: 0.85,
    actor: "par_compliance",
  },
  {
    id: "evd_txn_monitoring_assessment",
    source: "Internal assessment of NovaPay transaction monitoring system",
    finding: "Transaction monitoring covers ACH returns, velocity checks, and structuring patterns. Cross-border wire scenarios are not covered. Tuning documentation is incomplete for two of nine ACH scenarios.",
    confidence: 0.78,
    actor: "par_mrm",
  },
  {
    id: "evd_pen_test_gap",
    source: "NovaPay security assessment inventory",
    finding: "Last independent penetration test completed 2025-04. Company policy requires annual testing. Gap is now 14 months. NovaPay states a test is scheduled for Q3 2026 but no engagement letter has been provided.",
    confidence: 0.91,
    actor: "par_mrm",
  },
  {
    id: "evd_complaint_data",
    source: "CFPB complaint database and NovaPay internal complaint log",
    finding: "17 CFPB complaints in trailing 12 months, all related to delayed ACH credits. Internal resolution rate is 94 percent within 15 business days. No complaints related to unauthorized transactions or fraud.",
    confidence: 0.87,
    actor: "par_fintech_liaison",
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
        contentHash: `sha256:vdd_${e.id}`,
      },
    },
  });
}

// --- Assumptions ---
const assumptions = [
  {
    id: "asm_fraud_model_card_present_only",
    text: "NovaPay fraud detection model is trained on card-present transaction patterns and has not been validated for ACH or wire fraud typologies.",
    evidenceIds: ["evd_txn_monitoring_assessment"],
    confidence: 0.83,
    actor: "par_mrm",
  },
  {
    id: "asm_bsa_program_occ_compliant",
    text: "NovaPay BSA/AML program is currently OCC-compliant based on the independent test and exam history, but this depends on the program not having materially changed since the last test.",
    evidenceIds: ["evd_bsa_aml_program", "evd_ffiec_exam_history"],
    confidence: 0.82,
    actor: "par_compliance",
  },
  {
    id: "asm_no_cross_border_wire_demand",
    text: "Initial deployment scope does not include cross-border wires, so the gap in international wire monitoring is not immediately blocking.",
    evidenceIds: ["evd_txn_monitoring_assessment"],
    confidence: 0.75,
    actor: "par_fintech_liaison",
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
        contentHash: `sha256:vdd_${a.id}`,
      },
    },
  });
}

// --- Claims ---
const claims = [
  {
    id: "clm_controls_adequate_ach_domestic_wire",
    text: "NovaPay controls are adequate for ACH processing and domestic wire transfers within the scoped deployment.",
    evidenceIds: ["evd_soc2_type_ii", "evd_bsa_aml_program", "evd_ffiec_exam_history"],
    assumptionIds: ["asm_bsa_program_occ_compliant"],
    actor: "par_fintech_liaison",
  },
  {
    id: "clm_txn_monitoring_gaps_block_full_scope",
    text: "Transaction monitoring gaps in cross-border wire scenarios and incomplete ACH tuning documentation prevent full-scope approval.",
    evidenceIds: ["evd_txn_monitoring_assessment"],
    assumptionIds: [],
    actor: "par_mrm",
  },
  {
    id: "clm_pen_test_gap_is_material",
    text: "The 14-month penetration test gap represents a material control deficiency that must be remediated on a defined timeline regardless of deployment scope.",
    evidenceIds: ["evd_pen_test_gap"],
    assumptionIds: [],
    actor: "par_mrm",
  },
  {
    id: "clm_complaint_profile_acceptable",
    text: "NovaPay consumer complaint profile is within acceptable bounds and does not indicate systemic operational failure.",
    evidenceIds: ["evd_complaint_data"],
    assumptionIds: [],
    actor: "par_compliance",
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

// --- Positions ---
const positions = [
  { participantId: "par_cro", targetObjectId: "clm_controls_adequate_ach_domestic_wire", stance: "support", reason: "SOC 2 report and clean exam history support scoped approval for ACH and domestic wire." },
  { participantId: "par_mrm", targetObjectId: "clm_pen_test_gap_is_material", stance: "support", reason: "14-month gap exceeds policy threshold. Remediation timeline must be a condition of approval." },
  { participantId: "par_compliance", targetObjectId: "clm_controls_adequate_ach_domestic_wire", stance: "support", reason: "Controls are adequate for scoped deployment, but approval should be conditional on pen-test completion within 60 days." },
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

// --- Objections (match scenario-demo shape exactly) ---
events.push({
  event_id: eid("objectionraised", "pen_test_gap"),
  event_type: "ObjectionRaised",
  thread_id: THREAD_ID,
  actor_id: "par_compliance",
  timestamp: ts(),
  payload: {
    objection: {
      id: "obj_pen_test_gap_unresolved",
      object: "objection",
      threadId: THREAD_ID,
      participantId: "par_compliance",
      targetObjectId: "clm_controls_adequate_ach_domestic_wire",
      targetObjectType: "claim",
      assumption: "The pen-test gap can be remediated by a timeline condition alone.",
      text: "Approval should not proceed until the independent penetration test is completed. A 14-month gap with no engagement letter is not remediable by a timeline condition alone — the bank is accepting residual risk without current assurance of perimeter security.",
      status: "open",
      raisedAt: ts(),
    },
  },
});

events.push({
  event_id: eid("objectionraised", "scope_creep"),
  event_type: "ObjectionRaised",
  thread_id: THREAD_ID,
  actor_id: "par_mrm",
  timestamp: ts(),
  payload: {
    objection: {
      id: "obj_cross_border_wire_scope_creep",
      object: "objection",
      threadId: THREAD_ID,
      participantId: "par_mrm",
      targetObjectId: "clm_txn_monitoring_gaps_block_full_scope",
      targetObjectType: "claim",
      assumption: "Scoping exclusion of cross-border wires will hold without enforcement.",
      text: "Scoping the approval to exclude cross-border wires depends on the assumption that product demand will not drive scope expansion before monitoring gaps are closed. No enforcement mechanism prevents NovaPay from onboarding customers who need international wire capability.",
      status: "open",
      raisedAt: ts(),
    },
  },
});

// --- DecisionRequestOpened (camelCase decisionRequest) ---
const DR_ID = "drq_vendor_dd_novapay";
events.push({
  event_id: eid("decisionrequestopened", "vendor_dd"),
  event_type: "DecisionRequestOpened",
  thread_id: THREAD_ID,
  actor_id: "par_cro",
  timestamp: ts(),
  payload: {
    decisionRequest: {
      id: DR_ID,
      object: "decisionRequest",
      threadId: THREAD_ID,
      proposal: "Approve NovaPay for ACH origination/receipt and domestic wire processing, with conditions on pen-test remediation, monitoring documentation, and a scope gate on cross-border wires.",
      status: "review",
      supportingEvidenceIds: evidenceItems.map((e) => e.id),
      supportingClaimIds: claims.map((c) => c.id),
      supportingAssumptionIds: assumptions.map((a) => a.id),
      objectionIds: ["obj_pen_test_gap_unresolved", "obj_cross_border_wire_scope_creep"],
      openedByParticipantId: "par_cro",
      openedAt: ts(),
    },
  },
});

// --- Reviews (match scenario-demo shape) ---
events.push({
  event_id: eid("reviewsubmitted", "mrm_review"),
  event_type: "ReviewSubmitted",
  thread_id: THREAD_ID,
  actor_id: "par_mrm",
  timestamp: ts(),
  payload: {
    review: {
      id: "rev_mrm_approve_conditions",
      object: "review",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      reviewerParticipantId: "par_mrm",
      status: "approve_with_conditions",
      conditions: [
        "Independent pen test completed within 60 calendar days",
        "Cross-border wire capability blocked at API level until separate ClisTa thread governs expansion",
        "ACH tuning documentation for incomplete scenarios delivered within 30 calendar days",
      ],
      comment: "Controls are adequate for the scoped deployment. Conditions must be enforced as hard gates, not aspirational timelines.",
      reviewedAt: ts(),
    },
  },
});

events.push({
  event_id: eid("reviewsubmitted", "compliance_review"),
  event_type: "ReviewSubmitted",
  thread_id: THREAD_ID,
  actor_id: "par_compliance",
  timestamp: ts(),
  payload: {
    review: {
      id: "rev_compliance_request_changes",
      object: "review",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      reviewerParticipantId: "par_compliance",
      status: "approve_with_conditions",
      conditions: [
        "Pen-test completion within 60 days or defer approval",
        "CRO must document residual risk acceptance for the pen-test gap",
      ],
      comment: "BSA/AML program is sound for scoped deployment. Approving conditionally — if the CRO accepts documented residual risk for the pen-test gap, the scoped deployment can proceed.",
      reviewedAt: ts(),
    },
  },
});

// --- DecisionMerged (camelCase decisionRecord) ---
const DCR_ID = "dcr_vendor_dd_novapay";
events.push({
  event_id: eid("decisionmerged", "vendor_dd"),
  event_type: "DecisionMerged",
  thread_id: THREAD_ID,
  actor_id: "par_cro",
  timestamp: ts(),
  payload: {
    decisionRecord: {
      id: DCR_ID,
      object: "decisionRecord",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      status: "approved",
      summary: "Conditionally approved — NovaPay is approved for ACH and domestic wire only, with hard-gated remediation conditions.",
      rationale: "SOC 2 report, clean exam history, and sound BSA/AML program support scoped approval. The CRO accepts the residual risk of the pen-test gap as a documented exception, with automatic suspension of new customer onboarding if the 60-day deadline is missed. Cross-border wire capability is structurally blocked until a separate evaluation thread is opened and closed with MRM sign-off.",
      conditions: [
        "Independent penetration test must be completed within 60 calendar days. Failure triggers automatic suspension of new customer onboarding.",
        "ACH transaction monitoring tuning documentation for the two incomplete scenarios must be delivered within 30 calendar days.",
        "Cross-border wire capability requires a separate ClisTa thread with MRM sign-off before activation.",
        "Quarterly review of NovaPay complaint data, SAR filing volume, and transaction monitoring alert metrics for the first 12 months.",
      ],
      supportingEvidenceIds: evidenceItems.map((e) => e.id),
      supportingClaimIds: claims.map((c) => c.id),
      supportingAssumptionIds: assumptions.map((a) => a.id),
      objectionIds: ["obj_pen_test_gap_unresolved", "obj_cross_border_wire_scope_creep"],
      reviewIds: ["rev_mrm_approve_conditions", "rev_compliance_request_changes"],
      authorityTrail: [
        { participantId: "par_cro", role: "decision owner", source: "ParticipantAdded.role" },
      ],
      preservedObjectionIds: ["obj_pen_test_gap_unresolved", "obj_cross_border_wire_scope_creep"],
      minorityReportIds: ["mnr_compliance_pen_test_dissent"],
      nextAction: "NovaPay technical integration begins for ACH and domestic wire. Pen-test engagement letter due within 14 days. 60-day countdown to pen-test completion starts on decision date.",
      decidedByParticipantId: "par_cro",
      decidedAt: ts(),
      contentHash: "sha256:vdd_dcr_vendor_dd_novapay",
    },
  },
});

// --- MinorityReportFiled (camelCase minorityReport, after DecisionMerged) ---
events.push({
  event_id: eid("minorityreportfiled", "compliance_dissent"),
  event_type: "MinorityReportFiled",
  thread_id: THREAD_ID,
  actor_id: "par_compliance",
  timestamp: ts(),
  payload: {
    minorityReport: {
      id: "mnr_compliance_pen_test_dissent",
      object: "minorityReport",
      threadId: THREAD_ID,
      decisionRecordId: DCR_ID,
      participantId: "par_compliance",
      text: "The BSA/AML officer dissents from proceeding before pen-test completion and flags that the cross-border wire scope exclusion lacks enforcement. The bank third-party risk management policy requires current security assurance prior to onboarding. Approving with a 60-day remediation condition accepts a known gap. If the pen test reveals a critical finding, the bank will have already onboarded customers onto a platform with an unresolved vulnerability. Additionally, no API-level enforcement prevents NovaPay from expanding into cross-border wires before monitoring gaps are closed. This dissent is recorded to ensure the residual risk acceptance is attributable to the CRO.",
      objectionIds: ["obj_pen_test_gap_unresolved", "obj_cross_border_wire_scope_creep"],
      filedAt: ts(),
      contentHash: "sha256:vdd_mnr_compliance_pen_test_dissent",
    },
  },
});

// --- Generate with proper hash chain ---
let previousHash = null;
const prepared = events.map((e) => {
  const p = prepareEventForAppend(e, previousHash);
  previousHash = p.content_hash;
  return p;
});

const outPath = path.join(__dirname, "..", "examples", "vendor-due-diligence.ndjson");
fs.writeFileSync(outPath, prepared.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
console.log(`Wrote ${prepared.length} events to ${outPath}`);
