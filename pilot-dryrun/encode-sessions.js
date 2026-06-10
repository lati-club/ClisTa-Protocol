#!/usr/bin/env node
// Encode each sealed session's structured data block into a ClisTa NDJSON event log.
// The session SUBSTANCE comes from sessions/session-N/session-data.json (produced by
// sealed, independent subagents). This script only performs the mechanical encoding into
// the engine's event grammar; it invents no challenge content.
//
// Mapping rules (documented for the verification bundle):
//  - 7 participants per session: deployment advocate, 5 challenge lanes, 1 referee.
//    The referee carries role "decision owner" so it can merge the session's recommendation
//    (the decisionRecord is the session's RECOMMENDATION artifact, not institutional approval).
//  - An objection is encoded as PRESERVED (open, blocking, carried with a minority report)
//    iff it is referenced by a minority_report AND its severity is BLOCKING. Every other
//    objection — including CONVERTED_TO_RESIDUAL_RISK survivors not carried as formal dissent —
//    is encoded as terminally RESOLVED via ObjectionResolved, with resolution text. This makes
//    "preserved" in the log mean "carried forward as formal dissent", matching the protocol's
//    scenario-demo precedent, while residual-risk gates live in the decision conditions.

const fs = require("node:fs");
const path = require("node:path");

const LANE_PARTICIPANT = {
  A: "par_lane_a",
  B: "par_lane_b",
  H: "par_lane_h",
  D: "par_lane_d",
  E: "par_lane_e"
};

const PARTICIPANTS = [
  { id: "par_advocate", kind: "agent", name: "Deployment Advocate", role: "deployment advocate" },
  { id: "par_lane_a", kind: "agent", name: "Model Validator", role: "model validator" },
  { id: "par_lane_b", kind: "agent", name: "Data Lineage Skeptic", role: "data lineage skeptic" },
  { id: "par_lane_h", kind: "agent", name: "Patient/Consumer-Harm Reviewer", role: "consumer harm reviewer" },
  { id: "par_lane_d", kind: "agent", name: "Ops & Monitoring Reviewer", role: "ops monitoring reviewer" },
  { id: "par_lane_e", kind: "agent", name: "Devil's Advocate", role: "devils advocate" },
  { id: "par_referee", kind: "agent", name: "Referee", role: "decision owner" }
];

// Evidence attribution: affirmative items to the advocate, adverse items to the lane that
// would raise them. Purely for attribution richness; does not affect validity.
const EVIDENCE_COMMITTER = {
  E1: "par_advocate", E2: "par_advocate", E3: "par_advocate",
  E4: "par_lane_a", E5: "par_lane_a", E6: "par_lane_b", E7: "par_lane_a"
};

function encode(sessionNum) {
  const dir = path.join(__dirname, "sessions", `session-${sessionNum}`);
  const data = JSON.parse(fs.readFileSync(path.join(dir, "session-data.json"), "utf8"));
  const thread = `thd_dryrun_s${sessionNum}`;
  const sfx = (kind, id) => `${kind}_s${sessionNum}_${String(id).toLowerCase()}`;

  const evd = (e) => sfx("evd", e);
  const asm = (a) => sfx("asm", a);
  const clm = (c) => sfx("clm", c);
  const obj = (o) => sfx("obj", o);

  // preserved = blocking objections referenced by any minority report
  const minorityRefs = new Set();
  for (const mr of data.minority_reports || []) {
    for (const oid of mr.objection_ids || []) minorityRefs.add(oid);
  }
  const objById = new Map(data.objections.map((o) => [o.id, o]));
  const preserved = new Set(
    [...minorityRefs].filter((oid) => objById.get(oid) && objById.get(oid).severity === "BLOCKING")
  );

  const events = [];
  let seq = 0;
  const base = Date.parse("2026-06-08T17:00:00.000Z");
  const push = (type, actor, payload) => {
    const ts = new Date(base + seq * 1000).toISOString();
    events.push({
      event_id: `evt_s${sessionNum}_${String(seq).padStart(3, "0")}`,
      event_type: type,
      thread_id: thread,
      actor_id: actor,
      timestamp: ts,
      payload
    });
    seq += 1;
  };

  // 1. participants
  for (const p of PARTICIPANTS) {
    push("ParticipantAdded", p.id, { participant: { id: p.id, object: "participant", kind: p.kind, name: p.name, role: p.role } });
  }

  // 2. thread
  push("ThreadCreated", "par_referee", {
    thread: {
      id: thread, object: "thread",
      title: `Effective challenge: Epic Sepsis Model live alerting at Northgate (sealed session ${sessionNum})`,
      question: "Should Northgate Health System deploy the Epic Sepsis Model for live clinical sepsis alerting across its inpatient units?",
      status: "active",
      participantIds: PARTICIPANTS.map((p) => p.id),
      createdAt: new Date(base).toISOString(),
      updatedAt: new Date(base).toISOString()
    }
  });

  // 3. evidence
  for (const e of data.evidence_used) {
    const committer = EVIDENCE_COMMITTER[e] || "par_referee";
    push("EvidenceCommitted", committer, {
      evidence: {
        id: evd(e), object: "evidence", threadId: thread,
        source: `Evidence packet item ${e}`,
        finding: `Packet item ${e} (see pilot-dryrun/evidence-packet.md for the full dated, sourced item).`,
        confidence: 0.8,
        committedByParticipantId: committer,
        committedAt: new Date(base).toISOString(),
        artifactIds: [`art_packet_${e.toLowerCase()}`]
      }
    });
  }

  // 4. assumptions
  for (const a of data.assumptions) {
    push("AssumptionDeclared", "par_advocate", {
      assumption: {
        id: asm(a.id), object: "assumption", threadId: thread,
        text: a.text, status: "active", evidenceIds: [], confidence: 0.6,
        declaredByParticipantId: "par_advocate", declaredAt: new Date(base).toISOString()
      }
    });
  }

  // 5. claims
  for (const c of data.claims) {
    push("ClaimCreated", "par_advocate", {
      claim: {
        id: clm(c.id), object: "claim", threadId: thread, text: c.text, status: "endorsed",
        evidenceIds: (c.evidence || []).map(evd),
        contradictingEvidenceIds: [],
        assumptionIds: (c.assumptions || []).map(asm),
        createdByParticipantId: "par_advocate", createdAt: new Date(base).toISOString()
      }
    });
  }

  const firstClaimId = clm(data.claims[0].id);
  const resolveTargetClaim = (target) => {
    const m = String(target || "").match(/C\d+/);
    return m ? clm(m[0]) : firstClaimId;
  };

  // 6. objections raised
  for (const o of data.objections) {
    const laneP = LANE_PARTICIPANT[o.lane] || "par_lane_e";
    push("ObjectionRaised", laneP, {
      objection: {
        id: obj(o.id), object: "objection", threadId: thread,
        participantId: laneP,
        targetObjectId: resolveTargetClaim(o.target), targetObjectType: "claim",
        assumption: o.failure_mode,
        text: `[${o.severity}] ${o.failure_mode} Consequence: ${o.consequence} Verification: ${o.verification}`,
        blocking: o.severity === "BLOCKING",
        status: "open",
        raisedAt: new Date(base).toISOString()
      }
    });
  }

  // 7. resolutions for every objection NOT preserved (resolved by the referee = decision owner)
  for (const o of data.objections) {
    if (preserved.has(o.id)) continue;
    const resolution = o.resolution_text && o.resolution_text.trim()
      ? o.resolution_text
      : `Terminal disposition ${o.final_disposition}: converted from an open challenge into a tracked residual risk / agreed gate recorded in the recommendation conditions; not carried as formal dissent.`;
    push("ObjectionResolved", "par_referee", { objectionId: obj(o.id), resolution });
  }

  // 8. decision request
  const drq = `drq_s${sessionNum}`;
  push("DecisionRequestOpened", "par_advocate", {
    decisionRequest: {
      id: drq, object: "decisionRequest", threadId: thread,
      proposal: data.proposal_defended,
      status: "review",
      supportingEvidenceIds: data.evidence_used.map(evd),
      supportingClaimIds: data.claims.map((c) => clm(c.id)),
      supportingAssumptionIds: data.assumptions.map((a) => asm(a.id)),
      objectionIds: data.objections.map((o) => obj(o.id)),
      openedByParticipantId: "par_advocate",
      openedAt: new Date(base).toISOString()
    }
  });

  // 9. reviews (one per lane caveat)
  const reviewIds = [];
  for (const cav of data.caveats) {
    const laneP = LANE_PARTICIPANT[cav.lane] || "par_referee";
    const rid = `rev_s${sessionNum}_${cav.lane.toLowerCase()}`;
    reviewIds.push(rid);
    push("ReviewSubmitted", laneP, {
      review: {
        id: rid, object: "review", threadId: thread,
        decisionRequestId: drq, reviewerParticipantId: laneP,
        status: "approve_with_conditions",
        conditions: [cav.endorse_only_if],
        comment: `Lane ${cav.lane} endorses the recommendation only under its stated condition.`,
        reviewedAt: new Date(base).toISOString()
      }
    });
  }

  // 10. decision merged (the session's recommendation artifact)
  const dcr = `dcr_s${sessionNum}`;
  const minorityIds = (data.minority_reports || []).map((_, i) => `mnr_s${sessionNum}_${i + 1}`);
  push("DecisionMerged", "par_referee", {
    decisionRecord: {
      id: dcr, object: "decisionRecord", threadId: thread,
      decisionRequestId: drq,
      status: "approved",
      recommendation: data.recommendation,
      summary: data.recommendation_summary,
      rationale: data.rationale,
      conditions: data.conditions,
      supportingEvidenceIds: data.evidence_used.map(evd),
      supportingClaimIds: data.claims.map((c) => clm(c.id)),
      supportingAssumptionIds: data.assumptions.map((a) => asm(a.id)),
      objectionIds: data.objections.map((o) => obj(o.id)),
      reviewIds,
      authorityTrail: [{ participantId: "par_referee", role: "decision owner", source: "ParticipantAdded.role" }],
      preservedObjectionIds: [...preserved].map(obj),
      minorityReportIds: minorityIds,
      nextAction: data.recommendation_summary,
      decidedByParticipantId: "par_referee",
      decidedAt: new Date(base).toISOString()
    }
  });

  // 11. minority reports
  (data.minority_reports || []).forEach((mr, i) => {
    const laneP = LANE_PARTICIPANT[mr.lane] || "par_lane_e";
    push("MinorityReportFiled", laneP, {
      minorityReport: {
        id: minorityIds[i], object: "minorityReport", threadId: thread,
        decisionRecordId: dcr, participantId: laneP,
        text: mr.text, objectionIds: (mr.objection_ids || []).map(obj),
        filedAt: new Date(base).toISOString()
      }
    });
  });

  const out = path.join(dir, "events.ndjson");
  fs.writeFileSync(out, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return { out, count: events.length, preserved: [...preserved], minorities: minorityIds.length };
}

for (let n = 1; n <= 5; n++) {
  const r = encode(n);
  console.log(`session-${n}: ${r.count} events -> ${path.relative(__dirname, r.out)} | preserved=[${r.preserved.join(",")}] minorityReports=${r.minorities}`);
}
