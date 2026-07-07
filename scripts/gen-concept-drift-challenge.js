#!/usr/bin/env node
"use strict";

// Generates examples/ongoing-monitoring-concept-drift/challenge.ndjson —
// "Ongoing Monitoring Effective Challenge — Concept Drift" (SR 11-7 Section VI).
//
// The scenario every input-distribution dashboard misses: PSI green, score
// distributions stable, model confidence high — and matured vintages defaulting
// well above predicted PD. Inputs in-distribution, outcomes wrong: concept
// drift (P(y|X) shifted while P(X) did not). The log records the challenge
// being raised, the line of business responding, the challenger's disposition,
// and the decision owner sealing the record — with the residual label-lag
// exposure preserved as a surviving objection rather than papered over.
//
// Deterministic ids and timestamps: re-running regenerates a byte-identical,
// fully hash-chained log (validate --strict passes).

const fs = require("node:fs");
const path = require("node:path");
const { prepareEventForAppend } = require("../src/integrity");

const THREAD_ID = "thd_ongoing_monitoring_concept_drift_m471";
const BASE = "2026-07-06T13:00:00.000Z";

let seq = 0;
function ts() {
  const d = new Date(BASE);
  d.setMilliseconds(d.getMilliseconds() + seq * 35);
  seq++;
  return d.toISOString();
}

let idSeq = 0;
function eid(type, hint) {
  const slug = hint.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
  const seqStr = String(++idSeq).padStart(3, "0");
  return `evt_${type.toLowerCase()}_${slug}_${seqStr}`;
}

const events = [];

// --- Participants FIRST (before ThreadCreated) ---
const participants = [
  { id: "par_mrm_head", kind: "human", name: "A. Chen", role: "decision owner" },
  { id: "par_mrm_challenger", kind: "human", name: "K. Osei", role: "model risk challenger" },
  { id: "par_lob_model_owner", kind: "human", name: "R. Delgado", role: "model owner, consumer credit" },
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
  event_id: eid("threadcreated", "concept_drift_m471"),
  event_type: "ThreadCreated",
  thread_id: THREAD_ID,
  actor_id: "par_mrm_head",
  timestamp: ts(),
  payload: {
    thread: {
      id: THREAD_ID,
      object: "thread",
      title: "Ongoing Monitoring Effective Challenge — Concept Drift (M-471)",
      question:
        "Does ongoing monitoring for consumer credit default model M-471 evidence that the model continues to perform as intended (SR 11-7 Section VI)? The monitoring plan watches the input distribution P(X). What watches the feature-to-outcome relationship P(y|X) between annual reviews?",
      status: "active",
      participantIds: participants.map((p) => p.id),
      createdAt: BASE,
      updatedAt: BASE,
    },
  },
});

// --- Challenger's evidence exhibits ---
const evidenceItems = [
  {
    id: "evd_monitoring_plan_extract",
    source: "M-471 Ongoing Monitoring Plan v3.2 (approved 2025-01)",
    finding:
      "Scheduled controls: monthly PSI on all 42 input features (threshold 0.10), score-distribution stability (KS), data-quality completeness checks. All controls test the input distribution P(X). No outcome-based test runs between annual reviews. Label lag for realized defaults (12-24 months) appears nowhere in the plan's trigger logic.",
    confidence: 0.95,
    actor: "par_mrm_challenger",
  },
  {
    id: "evd_psi_dashboard_green",
    source: "M-471 monitoring packs, 2025-Q3 through 2026-Q2",
    finding:
      "Four consecutive quarters green: every feature PSI below 0.10, zero covariate-drift alarms, score distribution KS stable, data-quality checks passing. Under the current monitoring plan, M-471 shows no reportable condition in any quarter.",
    confidence: 0.93,
    actor: "par_mrm_challenger",
  },
  {
    id: "evd_score_distribution_stable",
    source: "M-471 score and confidence diagnostics, 2026-Q2 pack",
    finding:
      "Score distribution and model confidence are stable and inputs are in-distribution. There is no covariate-shift signature. If performance has degraded, the current dashboards are structurally unable to show it.",
    confidence: 0.9,
    actor: "par_mrm_challenger",
  },
  {
    id: "evd_vintage_backtest_divergence",
    source: "Lag-adjusted vintage backtest, 2024-H2 originations at 12-month maturity (validation-run 2026-06)",
    finding:
      "Realized default rate 4.1% against predicted PD band 2.9-3.1% (+35% divergence), concentrated in near-prime segments. Rank-ordering degraded on matured vintages (AUC 0.71 to 0.64). Same features, different feature-to-default relationship: concept drift with inputs fully in-distribution.",
    confidence: 0.88,
    actor: "par_mrm_challenger",
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
        contentHash: `sha256:cdm_${e.id}`,
      },
    },
  });
}

// --- Assumptions ---
const assumptions = [
  {
    id: "asm_label_lag_12_24_months",
    text: "Realized default outcomes for M-471 originations mature 12-24 months after decision. Any purely outcome-based control therefore observes the model's past, not its present; the most recent 12-24 months of originations are structurally unobservable by outcome tests.",
    evidenceIds: ["evd_vintage_backtest_divergence"],
    confidence: 0.92,
    actor: "par_mrm_challenger",
  },
  {
    id: "asm_input_stability_implies_performance",
    text: "The monitoring plan's implicit premise, stated explicitly so it can be challenged: if the input distribution P(X) is stable, model performance is stable — input stability is treated as sufficient evidence that the model continues to perform as intended.",
    evidenceIds: ["evd_monitoring_plan_extract"],
    confidence: 0.55,
    actor: "par_mrm_challenger",
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
        contentHash: `sha256:cdm_${a.id}`,
      },
    },
  });
}

// --- Challenger's claims ---
const challengerClaims = [
  {
    id: "clm_monitoring_watches_px_only",
    text: "M-471 ongoing monitoring evidences input-distribution stability only. Between annual reviews, no scheduled control observes whether the relationship between features and outcomes still holds. Concept drift — P(y|X) shifting while P(X) does not — passes through every control in the current plan undetected.",
    evidenceIds: ["evd_monitoring_plan_extract", "evd_psi_dashboard_green", "evd_score_distribution_stable"],
    assumptionIds: ["asm_label_lag_12_24_months"],
    actor: "par_mrm_challenger",
  },
  {
    id: "clm_concept_drift_underway",
    text: "Concept drift is not hypothetical for M-471: matured 2024-H2 vintages default 35% above predicted PD with degraded rank-ordering, while every input-side control reads green. The monitoring plan reported four clean quarters over a period in which the model was materially mis-predicting.",
    evidenceIds: ["evd_vintage_backtest_divergence", "evd_psi_dashboard_green"],
    assumptionIds: [],
    actor: "par_mrm_challenger",
  },
];

for (const c of challengerClaims) {
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

// --- The challenge: blocking objection on the monitoring plan's premise ---
events.push({
  event_id: eid("objectionraised", "pyx_monitoring_gap"),
  event_type: "ObjectionRaised",
  thread_id: THREAD_ID,
  actor_id: "par_mrm_challenger",
  timestamp: ts(),
  payload: {
    objection: {
      id: "obj_pyx_monitoring_gap",
      object: "objection",
      threadId: THREAD_ID,
      participantId: "par_mrm_challenger",
      targetObjectId: "asm_input_stability_implies_performance",
      targetObjectType: "assumption",
      assumption: "Input-distribution stability is sufficient evidence that the model continues to perform as intended.",
      text:
        "The monitoring plan watches P(X); nothing watches P(y|X). SR 11-7 Section VI requires ongoing monitoring to confirm the model 'continues to perform as intended' — performance is a property of the feature-to-outcome relationship, not of the input distribution. The vintage backtest shows that relationship has already shifted while every planned control read green. Until an outcome-facing control exists between annual reviews, the plan cannot evidence continued performance, and the assumption it rests on is contradicted by the model's own matured vintages.",
      status: "open",
      raisedAt: ts(),
    },
  },
});

// --- Line-of-business response: remediation evidence + claim ---
{
  const committedAt = ts();
  events.push({
    event_id: eid("evidencecommitted", "evd_lob_remediation_plan"),
    event_type: "EvidenceCommitted",
    thread_id: THREAD_ID,
    actor_id: "par_lob_model_owner",
    timestamp: committedAt,
    payload: {
      evidence: {
        id: "evd_lob_remediation_plan",
        object: "evidence",
        threadId: THREAD_ID,
        source: "Consumer Credit response to challenge (M-471 monitoring plan amendment, draft v0.9)",
        finding:
          "Line remediation plan: (1) quarterly lag-adjusted vintage backtesting against predicted PD bands, run on every vintage as it reaches 12-month maturity; (2) champion/challenger deployment with a quarterly-refit challenger scored in shadow on all new originations, divergence reported monthly; (3) a ratified regime-trigger inventory (policy rate moves over 200bp, underwriting policy changes, macro credit-cycle turn indicators) any of which forces off-cycle re-validation regardless of input-side alarms.",
        confidence: 0.85,
        committedByParticipantId: "par_lob_model_owner",
        committedAt: committedAt,
        artifactIds: [],
        contentHash: "sha256:cdm_evd_lob_remediation_plan",
      },
    },
  });
}

events.push({
  event_id: eid("claimcreated", "clm_remediation_restores_coverage"),
  event_type: "ClaimCreated",
  thread_id: THREAD_ID,
  actor_id: "par_lob_model_owner",
  timestamp: ts(),
  payload: {
    claim: {
      id: "clm_remediation_restores_outcome_coverage",
      object: "claim",
      threadId: THREAD_ID,
      text: "The amended monitoring plan restores outcome-facing coverage between annual reviews: lag-adjusted vintage backtesting observes P(y|X) as outcomes mature, the shadow challenger surfaces relationship shift ahead of label maturity, and regime triggers force re-validation on the environmental changes most likely to move P(y|X).",
      status: "endorsed",
      evidenceIds: ["evd_lob_remediation_plan"],
      assumptionIds: ["asm_label_lag_12_24_months"],
      contradictingEvidenceIds: [],
      createdByParticipantId: "par_lob_model_owner",
      createdAt: ts(),
    },
  },
});

// --- Positions ---
const positions = [
  {
    participantId: "par_lob_model_owner",
    targetObjectId: "clm_monitoring_watches_px_only",
    stance: "support",
    reason:
      "The line does not dispute the gap. The plan was built around input-drift tooling; the vintage divergence shows that was not sufficient. Response is the amended plan, not a defense of the status quo.",
  },
  {
    participantId: "par_mrm_challenger",
    targetObjectId: "clm_remediation_restores_outcome_coverage",
    stance: "support",
    reason:
      "The amendment is directionally correct and adds genuine P(y|X) coverage. Support is conditional on the controls landing on the committed dates; the residual label-lag window remains and is recorded separately.",
  },
  {
    participantId: "par_mrm_head",
    targetObjectId: "clm_concept_drift_underway",
    stance: "support",
    reason:
      "The exhibit pattern — four green quarters over a period of +35% PD divergence — is exactly the failure mode Section VI ongoing monitoring exists to catch. The challenge stands on the model's own outcomes.",
  },
];

for (const p of positions) {
  const posId = `pos_${p.participantId.replace("par_", "")}_${p.targetObjectId.replace("clm_", "")}`.slice(0, 60);
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

// --- Residual-risk objection: survives the decision (non-blocking, preserved) ---
events.push({
  event_id: eid("objectionraised", "label_lag_residual_window"),
  event_type: "ObjectionRaised",
  thread_id: THREAD_ID,
  actor_id: "par_mrm_challenger",
  timestamp: ts(),
  payload: {
    objection: {
      id: "obj_label_lag_residual_window",
      object: "objection",
      threadId: THREAD_ID,
      participantId: "par_mrm_challenger",
      targetObjectId: "clm_remediation_restores_outcome_coverage",
      targetObjectType: "claim",
      assumption: "The amended controls close the concept-drift exposure entirely.",
      text:
        "Even with the amendment, a residual blind window remains: vintage backtesting only observes originations after 12 months of seasoning, so a P(y|X) shift beginning today is invisible to outcome tests until mid-2027. The shadow challenger and regime triggers mitigate but are proxies — neither directly observes realized outcomes inside the lag window. This residual exposure should be preserved on the decision record, not treated as closed, so the next examiner and the next validator inherit it explicitly.",
      status: "open",
      blocking: false,
      raisedAt: ts(),
    },
  },
});

// --- DecisionRequestOpened: dispose of the challenge ---
const DR_ID = "drq_m471_concept_drift_challenge";
events.push({
  event_id: eid("decisionrequestopened", "m471_disposition"),
  event_type: "DecisionRequestOpened",
  thread_id: THREAD_ID,
  actor_id: "par_mrm_head",
  timestamp: ts(),
  payload: {
    decisionRequest: {
      id: DR_ID,
      object: "decisionRequest",
      threadId: THREAD_ID,
      proposal:
        "Dispose of effective challenge CH-M471-2026-07: accept the line's amended monitoring plan as restoring Section VI outcome-analysis coverage for M-471, subject to dated conditions, with the residual label-lag exposure preserved as an open objection on the record.",
      status: "review",
      supportingEvidenceIds: [...evidenceItems.map((e) => e.id), "evd_lob_remediation_plan"],
      supportingClaimIds: [
        "clm_monitoring_watches_px_only",
        "clm_concept_drift_underway",
        "clm_remediation_restores_outcome_coverage",
      ],
      supportingAssumptionIds: assumptions.map((a) => a.id),
      objectionIds: ["obj_pyx_monitoring_gap", "obj_label_lag_residual_window"],
      openedByParticipantId: "par_mrm_head",
      openedAt: ts(),
    },
  },
});

// --- Reviews ---
events.push({
  event_id: eid("reviewsubmitted", "challenger_review"),
  event_type: "ReviewSubmitted",
  thread_id: THREAD_ID,
  actor_id: "par_mrm_challenger",
  timestamp: ts(),
  payload: {
    review: {
      id: "rev_challenger_approve_conditions",
      object: "review",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      reviewerParticipantId: "par_mrm_challenger",
      status: "approve_with_conditions",
      conditions: [
        "Quarterly lag-adjusted vintage backtest is written into the M-471 monitoring plan and produces its first report by end of 2026-Q3.",
        "Champion/challenger shadow deployment is live on all new originations by end of 2026-Q4, with monthly divergence reporting to MRM.",
        "The regime-trigger inventory is ratified by MRM and wired to a 30-day off-cycle re-validation SLA before the next monitoring cycle.",
        "M-471 PD estimates for near-prime segments carry a documented conservatism overlay until the first two quarterly backtests pass within band.",
      ],
      comment:
        "Challenge disposition: the response is accepted as remediation, not as refutation. The gap was real, the line acknowledged it, and the amendment adds outcome-facing controls. Conditions are hard gates. The residual label-lag window is preserved as an open objection and must survive onto the decision record.",
      reviewedAt: ts(),
    },
  },
});

events.push({
  event_id: eid("reviewsubmitted", "lob_review"),
  event_type: "ReviewSubmitted",
  thread_id: THREAD_ID,
  actor_id: "par_lob_model_owner",
  timestamp: ts(),
  payload: {
    review: {
      id: "rev_lob_owner_approve",
      object: "review",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      reviewerParticipantId: "par_lob_model_owner",
      status: "approve",
      conditions: [],
      comment:
        "The line commits to the amendment and the dates in the challenger's conditions. The conservatism overlay for near-prime is accepted as an interim measure while the backtest track record accrues.",
      reviewedAt: ts(),
    },
  },
});

// --- Challenger disposition: the blocking objection is resolved on the record ---
events.push({
  event_id: eid("objectionresolved", "pyx_monitoring_gap"),
  event_type: "ObjectionResolved",
  thread_id: THREAD_ID,
  actor_id: "par_mrm_challenger",
  timestamp: ts(),
  payload: {
    objectionId: "obj_pyx_monitoring_gap",
    resolution:
      "Remediated with conditions. The amended monitoring plan adds outcome-facing controls (quarterly lag-adjusted vintage backtesting, shadow champion/challenger, regime-triggered re-validation), which answers the challenge as raised: something now watches P(y|X) between annual reviews. Resolution holds only while the dated conditions on rev_challenger_approve_conditions are met; a missed gate reopens the challenge. The narrower residual exposure is tracked separately as obj_label_lag_residual_window.",
  },
});

// --- DecisionMerged: the decision owner seals the disposition ---
const DCR_ID = "dcr_m471_concept_drift_disposition";
events.push({
  event_id: eid("decisionmerged", "m471_disposition"),
  event_type: "DecisionMerged",
  thread_id: THREAD_ID,
  actor_id: "par_mrm_head",
  timestamp: ts(),
  payload: {
    decisionRecord: {
      id: DCR_ID,
      object: "decisionRecord",
      threadId: THREAD_ID,
      decisionRequestId: DR_ID,
      status: "approved",
      summary:
        "Effective challenge disposed: M-471 ongoing monitoring is amended to watch P(y|X), not only P(X). The challenge, the line's response, and the disposition are on the record; the residual label-lag exposure survives as a preserved objection.",
      rationale:
        "The challenger demonstrated, from the model's own matured vintages, that the monitoring plan could report four clean quarters while the model mis-predicted default by 35%. The line did not dispute the gap and produced an amendment with outcome-facing controls. Accepting the amendment with dated, hard-gated conditions restores the Section VI evidentiary basis for 'continues to perform as intended'. The label-lag window cannot be engineered away and is therefore preserved as an open objection rather than resolved — the record must show what remains unobservable, not only what was fixed.",
      conditions: [
        "Quarterly lag-adjusted vintage backtest in the monitoring plan; first report due end of 2026-Q3.",
        "Champion/challenger shadow scoring live on all new originations by end of 2026-Q4; monthly divergence reporting to MRM.",
        "Regime-trigger inventory ratified and wired to a 30-day off-cycle re-validation SLA before the next monitoring cycle.",
        "Documented conservatism overlay on near-prime PD estimates until two consecutive quarterly backtests land within the predicted band.",
        "Any missed gate reopens obj_pyx_monitoring_gap and suspends reliance on M-471 outputs for new-origination pricing until cured.",
      ],
      supportingEvidenceIds: [...evidenceItems.map((e) => e.id), "evd_lob_remediation_plan"],
      supportingClaimIds: [
        "clm_monitoring_watches_px_only",
        "clm_concept_drift_underway",
        "clm_remediation_restores_outcome_coverage",
      ],
      supportingAssumptionIds: assumptions.map((a) => a.id),
      objectionIds: ["obj_pyx_monitoring_gap", "obj_label_lag_residual_window"],
      reviewIds: ["rev_challenger_approve_conditions", "rev_lob_owner_approve"],
      authorityTrail: [{ participantId: "par_mrm_head", role: "decision owner", source: "ParticipantAdded.role" }],
      preservedObjectionIds: ["obj_label_lag_residual_window"],
      minorityReportIds: [],
      nextAction:
        "Line delivers the amended monitoring plan for MRM sign-off. First quarterly vintage backtest report due end of 2026-Q3. obj_label_lag_residual_window is re-examined at each quarterly backtest and at the 2027 annual review.",
      decidedByParticipantId: "par_mrm_head",
      decidedAt: ts(),
      contentHash: "sha256:cdm_dcr_m471_concept_drift_disposition",
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

const outDir = path.join(__dirname, "..", "examples", "ongoing-monitoring-concept-drift");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "challenge.ndjson");
fs.writeFileSync(outPath, prepared.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
console.log(`Wrote ${prepared.length} events to ${outPath}`);
