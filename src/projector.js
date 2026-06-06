const { nowIso } = require("./events");

function emptyProjection() {
  return {
    schema: "clista.projection.v0",
    projectedAt: nowIso(),
    participants: {},
    threads: {},
    evidence: {},
    assumptions: {},
    claims: {},
    positions: {},
    objections: {},
    decisionRequests: {},
    reviews: {},
    decisionRecords: {},
    minorityReports: {},
    expectedOutcomes: {},
    outcomeAudits: {},
    decisionScores: {},
    alignmentSnapshots: {},
    events: []
  };
}

function projectEvents(events) {
  const projection = emptyProjection();

  for (const event of events) {
    projection.events.push(event);
    const payload = event.payload || {};

    switch (eventType(event)) {
      case "ParticipantAdded":
        upsert(projection.participants, payload.participant);
        break;
      case "ThreadCreated":
        upsert(projection.threads, payload.thread);
        break;
      case "EvidenceCommitted":
        upsert(projection.evidence, payload.evidence);
        touchThread(projection, payload.evidence?.threadId, eventTimestamp(event));
        break;
      case "AssumptionDeclared":
        upsert(projection.assumptions, payload.assumption);
        touchThread(projection, payload.assumption?.threadId, eventTimestamp(event));
        break;
      case "ClaimCreated":
        upsert(projection.claims, payload.claim);
        touchThread(projection, payload.claim?.threadId, eventTimestamp(event));
        break;
      case "PositionTaken":
        upsert(projection.positions, payload.position);
        touchThread(projection, payload.position?.threadId, eventTimestamp(event));
        break;
      case "ObjectionRaised":
        upsert(projection.objections, payload.objection);
        markClaimContested(projection, payload.objection);
        markAssumptionContested(projection, payload.objection);
        touchThread(projection, payload.objection?.threadId, eventTimestamp(event));
        break;
      case "ObjectionResolved":
        resolveObjection(projection, payload.objectionId || payload.objection?.id, payload.resolution || payload.objection?.resolution);
        break;
      case "AlignmentCalculated":
        upsert(projection.alignmentSnapshots, payload.alignmentSnapshot);
        break;
      case "DecisionRequestOpened":
        upsert(projection.decisionRequests, payload.decisionRequest);
        setThreadStatus(projection, payload.decisionRequest?.threadId, "review", eventTimestamp(event));
        break;
      case "ReviewSubmitted":
        upsert(projection.reviews, payload.review);
        applyReviewStatus(projection, payload.review);
        break;
      case "DecisionMerged":
        upsert(projection.decisionRecords, payload.decisionRecord);
        applyDecisionRecord(projection, payload.decisionRecord, eventTimestamp(event));
        break;
      case "MinorityReportFiled":
        upsert(projection.minorityReports, payload.minorityReport);
        attachMinorityReport(projection, payload.minorityReport);
        break;
      case "ExpectedOutcomeDeclared":
        upsert(projection.expectedOutcomes, payload.expectedOutcome);
        touchThread(projection, payload.expectedOutcome?.threadId, eventTimestamp(event));
        break;
      case "OutcomeAudited":
        upsert(projection.outcomeAudits, payload.outcomeAudit);
        touchThread(projection, payload.outcomeAudit?.threadId, eventTimestamp(event));
        break;
      case "DecisionScored":
        upsert(projection.decisionScores, payload.decisionScore);
        touchThread(projection, payload.decisionScore?.threadId, eventTimestamp(event));
        break;
      default:
        break;
    }
  }

  return projection;
}

function selectThreadState(projection, requestedThreadId) {
  const threadId = requestedThreadId || latestThreadId(projection);
  const thread = projection.threads[threadId];
  if (!thread) {
    return {
      schema: "clista.threadState.v0",
      threadId: threadId || null,
      error: "Thread not found"
    };
  }

  const evidence = valuesForThread(projection.evidence, threadId);
  const assumptions = valuesForThread(projection.assumptions, threadId);
  const claims = valuesForThread(projection.claims, threadId);
  const positions = latestPositions(valuesForThread(projection.positions, threadId));
  const objections = valuesForThread(projection.objections, threadId);
  const decisionRequests = valuesForThread(projection.decisionRequests, threadId);
  const reviews = valuesForThread(projection.reviews, threadId);
  const decisionRecords = valuesForThread(projection.decisionRecords, threadId);
  const minorityReports = valuesForThread(projection.minorityReports, threadId);
  const expectedOutcomes = valuesForThread(projection.expectedOutcomes, threadId);
  const outcomeAudits = valuesForThread(projection.outcomeAudits, threadId);
  const decisionScores = valuesForThread(projection.decisionScores, threadId);
  const currentProposal = latestBy(decisionRequests, "openedAt");
  const decisionRecord = latestBy(decisionRecords, "decidedAt");
  const supportingEvidence = selectSupportingEvidence(evidence, claims, currentProposal, decisionRecord);
  const alignmentSnapshot = latestBy(valuesForThread(projection.alignmentSnapshots, threadId), "createdAt")
    || calculateAlignment(threadId, claims, positions, objections);
  const assumptionsWithParticipants = assumptions.map((assumption) => ({
    ...assumption,
    participant: projection.participants[assumption.declaredByParticipantId] || null
  }));
  const outcomeState = buildOutcomeState({
    expectedOutcomes,
    outcomeAudits,
    decisionScores,
    assumptions: assumptionsWithParticipants,
    evidence
  });
  const positionsWithParticipants = positions.map((position) => ({
    ...position,
    participant: projection.participants[position.participantId] || null
  }));
  const objectionsWithParticipants = objections.map((objection) => ({
    ...objection,
    participant: projection.participants[objection.participantId] || null
  }));
  const unresolvedObjectionsWithParticipants = objectionsWithParticipants
    .filter((objection) => objection.status === "open" || objection.status === "preserved");
  const reasoningState = buildReasoningState({
    thread,
    evidence: supportingEvidence,
    assumptions: assumptionsWithParticipants,
    claims,
    positions: positionsWithParticipants,
    objections: objectionsWithParticipants,
    decisionRecord,
    minorityReports,
    outcomeState,
    events: projection.events
  });

  return {
    schema: "clista.threadState.v0",
    projectedAt: projection.projectedAt,
    reasoningState,
    thread,
    currentProposal: currentProposal || null,
    supportingEvidence,
    assumptions: assumptionsWithParticipants,
    claims,
    participantPositions: positionsWithParticipants,
    unresolvedObjections: unresolvedObjectionsWithParticipants,
    alignmentSnapshot,
    decisionStatus: {
      requestStatus: currentProposal?.status || "none",
      recordStatus: decisionRecord?.status || "none",
      decisionRecord: decisionRecord || null,
      reviews,
      minorityReports,
      expectedOutcomes,
      outcomeAudits,
      decisionScores,
      outcomeState
    },
    outcomeState,
    auditTrail: auditTrail(projection.events, threadId)
  };
}

function buildReasoningState({
  thread,
  evidence,
  assumptions,
  claims,
  positions,
  objections,
  decisionRecord,
  minorityReports,
  outcomeState,
  events
}) {
  return {
    question: thread.question,
    decision: decisionRecord
      ? {
          id: decisionRecord.id,
          status: decisionRecord.status,
          summary: decisionRecord.summary
        }
      : null,
    rationale: decisionRecord?.rationale || null,
    assumptions,
    evidence,
    claims,
    positions,
    objections,
    minority_reports: minorityReports,
    expected_outcomes: outcomeState.expectedOutcomes,
    outcome_audits: outcomeState.outcomeAudits,
    decision_score: outcomeState.latestDecisionScore,
    outcome_status: outcomeState.status,
    failed_assumptions: outcomeState.failedAssumptions,
    failed_evidence: outcomeState.failedEvidence,
    next_action: decisionRecord?.nextAction || null,
    audit_summary: {
      source: "append_only_event_log",
      events_replayed: events.length,
      external_state_used: false
    }
  };
}

function selectAudit(projection, requestedThreadId) {
  const threadId = requestedThreadId || latestThreadId(projection);
  const state = selectThreadState(projection, threadId);
  if (state.error) {
    return state;
  }
  return {
    schema: "clista.audit.v0",
    projectedAt: projection.projectedAt,
    thread: state.thread,
    decisionStatus: state.decisionStatus,
    auditTrail: state.auditTrail,
    evidence: state.supportingEvidence,
    assumptions: state.assumptions,
    claims: state.claims,
    positions: state.participantPositions,
    objections: state.unresolvedObjections
  };
}

function exportProtocol(projection) {
  return {
    schema: "clista.protocol.v0",
    exportedAt: projection.projectedAt,
    threads: Object.values(projection.threads),
    participants: Object.values(projection.participants),
    evidence: Object.values(projection.evidence),
    assumptions: Object.values(projection.assumptions),
    claims: Object.values(projection.claims),
    positions: Object.values(projection.positions),
    objections: Object.values(projection.objections),
    decisionRequests: Object.values(projection.decisionRequests),
    reviews: Object.values(projection.reviews),
    decisionRecords: Object.values(projection.decisionRecords),
    minorityReports: Object.values(projection.minorityReports),
    expectedOutcomes: Object.values(projection.expectedOutcomes),
    outcomeAudits: Object.values(projection.outcomeAudits),
    decisionScores: Object.values(projection.decisionScores),
    alignmentSnapshots: Object.values(projection.alignmentSnapshots),
    events: projection.events
  };
}

function upsert(collection, object) {
  if (object?.id) {
    collection[object.id] = object;
  }
}

function touchThread(projection, threadId, at) {
  if (projection.threads[threadId]) {
    projection.threads[threadId] = {
      ...projection.threads[threadId],
      updatedAt: at || projection.threads[threadId].updatedAt
    };
  }
}

function setThreadStatus(projection, threadId, status, at) {
  if (projection.threads[threadId]) {
    projection.threads[threadId] = {
      ...projection.threads[threadId],
      status,
      updatedAt: at || projection.threads[threadId].updatedAt
    };
  }
}

function markClaimContested(projection, objection) {
  if (objection?.targetObjectType === "claim" && projection.claims[objection.targetObjectId]) {
    projection.claims[objection.targetObjectId] = {
      ...projection.claims[objection.targetObjectId],
      status: "contested"
    };
  }
}

function markAssumptionContested(projection, objection) {
  if (objection?.targetObjectType === "assumption" && projection.assumptions[objection.targetObjectId]) {
    projection.assumptions[objection.targetObjectId] = {
      ...projection.assumptions[objection.targetObjectId],
      status: "contested"
    };
  }
}

function resolveObjection(projection, objectionId, resolution) {
  const objection = projection.objections[objectionId];
  if (!objection) {
    return;
  }
  projection.objections[objectionId] = {
    ...objection,
    status: "resolved",
    resolution
  };
}

function applyReviewStatus(projection, review) {
  const request = projection.decisionRequests[review?.decisionRequestId];
  if (!request) {
    return;
  }
  if (review.status === "request_changes") {
    request.status = "changes_requested";
  }
}

function applyDecisionRecord(projection, decisionRecord, at) {
  if (!decisionRecord) {
    return;
  }
  const request = projection.decisionRequests[decisionRecord.decisionRequestId];
  if (request) {
    request.status = decisionRecord.status === "approved" ? "merged" : "rejected";
  }
  for (const objectionId of decisionRecord.preservedObjectionIds || []) {
    if (projection.objections[objectionId]) {
      projection.objections[objectionId] = {
        ...projection.objections[objectionId],
        status: "preserved"
      };
    }
  }
  setThreadStatus(projection, decisionRecord.threadId, "decided", at);
}

function attachMinorityReport(projection, minorityReport) {
  if (!minorityReport) {
    return;
  }
  const record = projection.decisionRecords[minorityReport.decisionRecordId];
  if (record) {
    const ids = new Set(record.minorityReportIds || []);
    ids.add(minorityReport.id);
    record.minorityReportIds = Array.from(ids);
  }
}

function buildOutcomeState({ expectedOutcomes, outcomeAudits, decisionScores, assumptions, evidence }) {
  const latestDecisionScore = latestBy(decisionScores, "scoredAt") || null;
  const failedAssumptionIds = unique(outcomeAudits.flatMap((audit) => audit.failedAssumptionIds || []));
  const failedEvidenceIds = unique(outcomeAudits.flatMap((audit) => audit.failedEvidenceIds || []));
  const assumptionsById = new Map(assumptions.map((assumption) => [assumption.id, assumption]));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  return {
    expectedOutcomes,
    outcomeAudits,
    decisionScores,
    latestDecisionScore,
    status: latestDecisionScore?.status || latestBy(outcomeAudits, "auditedAt")?.result || "unknown",
    score: latestDecisionScore?.score ?? null,
    failedAssumptions: failedAssumptionIds.map((id) => assumptionsById.get(id) || { id }),
    failedEvidence: failedEvidenceIds.map((id) => evidenceById.get(id) || { id })
  };
}

function valuesForThread(collection, threadId) {
  return Object.values(collection).filter((object) => object.threadId === threadId);
}

function latestThreadId(projection) {
  return latestBy(Object.values(projection.threads), "updatedAt")?.id;
}

function latestBy(items, field) {
  return items
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(a[field] || "").localeCompare(String(b[field] || "")))
    .at(-1);
}

function latestPositions(positions) {
  const byParticipantAndTarget = new Map();
  for (const position of positions) {
    const key = `${position.participantId}:${position.targetObjectId || "thread"}`;
    const existing = byParticipantAndTarget.get(key);
    if (!existing || String(existing.takenAt).localeCompare(String(position.takenAt)) < 0) {
      byParticipantAndTarget.set(key, position);
    }
  }
  return Array.from(byParticipantAndTarget.values());
}

function selectSupportingEvidence(evidence, claims, currentProposal, decisionRecord) {
  const evidenceIds = new Set([
    ...(currentProposal?.supportingEvidenceIds || []),
    ...(decisionRecord?.supportingEvidenceIds || [])
  ]);
  const claimIds = new Set([
    ...(currentProposal?.supportingClaimIds || []),
    ...(decisionRecord?.supportingClaimIds || [])
  ]);
  for (const claim of claims) {
    if (claimIds.has(claim.id)) {
      for (const evidenceId of claim.evidenceIds || []) {
        evidenceIds.add(evidenceId);
      }
    }
  }
  if (!evidenceIds.size) {
    return evidence;
  }
  return evidence.filter((item) => evidenceIds.has(item.id));
}

function calculateAlignment(threadId, claims, positions, objections) {
  const evidencedClaims = claims.filter((claim) => (claim.evidenceIds || []).length > 0).length;
  const evidenceAlignment = claims.length ? evidencedClaims / claims.length : 1;
  const positionCounts = positions.reduce((counts, position) => {
    counts[position.stance] = (counts[position.stance] || 0) + 1;
    return counts;
  }, {});
  const largestPositionGroup = Math.max(0, ...Object.values(positionCounts));
  const positionAlignment = positions.length ? largestPositionGroup / positions.length : 1;
  const unresolved = objections.filter((objection) => objection.status === "open" || objection.status === "preserved").length;
  const riskAlignment = objections.length ? Math.max(0, 1 - unresolved / objections.length) : 1;
  const overallAlignment = (evidenceAlignment + positionAlignment + riskAlignment) / 3;

  return {
    id: "aln_calculated",
    object: "alignmentSnapshot",
    threadId,
    createdAt: nowIso(),
    evidenceAlignment: round(evidenceAlignment),
    positionAlignment: round(positionAlignment),
    riskAlignment: round(riskAlignment),
    overallAlignment: round(overallAlignment),
    metadata: {
      method: "calculated_from_projected_state"
    }
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function auditTrail(events, threadId) {
  return events
    .filter((event) => !threadId || eventThreadId(event) === threadId || event.payload?.thread?.id === threadId)
    .map((event) => ({
      event_id: eventId(event),
      event_type: eventType(event),
      timestamp: eventTimestamp(event),
      actor_id: eventActorId(event),
      thread_id: eventThreadId(event) || event.payload?.thread?.id,
      object_id: primaryObject(event)?.id,
      summary: summarizeEvent(event)
    }));
}

function eventId(event) {
  return event.event_id || event.id;
}

function eventType(event) {
  return event.event_type || event.type;
}

function eventTimestamp(event) {
  return event.timestamp || event.at;
}

function eventActorId(event) {
  return event.actor_id || event.actorId;
}

function eventThreadId(event) {
  return event.thread_id || event.threadId;
}

function primaryObject(event) {
  const payload = event.payload || {};
  return payload.thread
    || payload.participant
    || payload.evidence
    || payload.assumption
    || payload.claim
    || payload.position
    || payload.objection
    || payload.alignmentSnapshot
    || payload.decisionRequest
    || payload.review
    || payload.decisionRecord
    || payload.minorityReport
    || payload.expectedOutcome
    || payload.outcomeAudit
    || payload.decisionScore
    || null;
}

function summarizeEvent(event) {
  const object = primaryObject(event);
  if (!object) {
    return eventType(event);
  }
  return object.finding
    || object.text
    || object.proposal
    || object.summary
    || object.title
    || object.name
    || `${eventType(event)} ${object.id}`;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

module.exports = {
  exportProtocol,
  projectEvents,
  selectAudit,
  selectThreadState
};
