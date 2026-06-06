const { nowIso } = require("./events");
const { PROTOCOL_VERSION, verifyEventIntegrity } = require("./integrity");
const { evaluateMergeEligibility } = require("./merges");

function emptyProjection() {
  return {
    schema: "clista.projection.v0",
    projectedAt: nowIso(),
    participants: {},
    threads: {},
    forks: {},
    evidence: {},
    assumptions: {},
    claims: {},
    positions: {},
    objections: {},
    decisionRequests: {},
    reviews: {},
    decisionRecords: {},
    minorityReports: {},
    mergeRequests: {},
    mergeReviews: {},
    mergeConflicts: {},
    mergeConflictResolutions: {},
    mergeCompletions: {},
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
    projection.events.push(clone(event));
    const payload = clone(event.payload || {});

    switch (eventType(event)) {
      case "ParticipantAdded":
        upsert(projection.participants, payload.participant);
        break;
      case "ThreadCreated":
        upsert(projection.threads, payload.thread);
        break;
      case "ThreadForked":
        applyThreadFork(projection, payload.threadFork, eventTimestamp(event));
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
        resolveObjection(
          projection,
          payload.objectionId || payload.objection?.id,
          payload.resolution || payload.objection?.resolution,
          eventThreadId(event)
        );
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
      case "MergeRequestOpened":
        upsert(projection.mergeRequests, payload.mergeRequest);
        break;
      case "MergeReviewSubmitted":
        upsert(projection.mergeReviews, payload.mergeReview);
        applyMergeReviewStatus(projection, payload.mergeReview);
        break;
      case "MergeConflictDeclared":
        upsert(projection.mergeConflicts, payload.mergeConflict);
        break;
      case "MergeConflictResolved":
        upsert(projection.mergeConflictResolutions, payload.mergeConflictResolution);
        applyMergeConflictResolution(projection, payload.mergeConflictResolution);
        break;
      case "MergeCompleted":
        upsert(projection.mergeCompletions, payload.mergeCompletion);
        applyMergeCompletion(projection, payload.mergeCompletion, eventTimestamp(event));
        break;
      default:
        break;
    }
  }

  return projection;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

  const evidence = valuesForThreadScope(projection, threadId, "evidence");
  const assumptions = valuesForThreadScope(projection, threadId, "assumptions");
  const claims = valuesForThreadScope(projection, threadId, "claims");
  const positions = latestPositions(valuesForThreadScope(projection, threadId, "positions"));
  const objections = valuesForThreadScope(projection, threadId, "objections");
  const decisionRequests = valuesForThreadScope(projection, threadId, "decisionRequests");
  const reviews = valuesForThreadScope(projection, threadId, "reviews");
  const decisionRecords = valuesForThreadScope(projection, threadId, "decisionRecords");
  const minorityReports = valuesForThreadScope(projection, threadId, "minorityReports");
  const expectedOutcomes = valuesForThreadScope(projection, threadId, "expectedOutcomes");
  const outcomeAudits = valuesForThreadScope(projection, threadId, "outcomeAudits");
  const decisionScores = valuesForThreadScope(projection, threadId, "decisionScores");
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
  const forkLineage = selectForkLineage(projection, threadId);
  const changedAssumptions = selectChangedObjects(assumptionsWithParticipants, forkLineage?.changedAssumptionIds);
  const divergentClaims = forkLineage ? selectDivergentClaims(claims, forkLineage.changedClaimIds) : [];
  const mergeState = selectMergeState(projection, threadId);
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
    forkLineage,
    changedAssumptions,
    divergentClaims,
    mergeState,
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
    forkLineage,
    changedAssumptions,
    divergentClaims,
    mergeState,
    auditTrail: auditTrailForThread(projection, threadId)
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
  forkLineage,
  changedAssumptions,
  divergentClaims,
  mergeState,
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
    fork_lineage: forkLineage,
    changed_assumptions: changedAssumptions,
    divergent_claims: divergentClaims,
    merge_requests: mergeState.requests,
    merge_completions: mergeState.completed,
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
    objections: state.unresolvedObjections,
    mergeState: state.mergeState
  };
}

function exportProtocol(projection) {
  return {
    schema: PROTOCOL_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    exportedAt: projection.projectedAt,
    integrity: verifyEventIntegrity(projection.events),
    threads: Object.values(projection.threads),
    forks: Object.values(projection.forks),
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
    mergeRequests: Object.values(projection.mergeRequests),
    mergeReviews: Object.values(projection.mergeReviews),
    mergeConflicts: Object.values(projection.mergeConflicts),
    mergeConflictResolutions: Object.values(projection.mergeConflictResolutions),
    mergeCompletions: Object.values(projection.mergeCompletions),
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

function applyThreadFork(projection, threadFork, at) {
  if (!threadFork?.forkThreadId) {
    return;
  }
  const fork = {
    id: threadFork.id || threadFork.forkThreadId,
    object: "threadFork",
    ...threadFork
  };
  projection.forks[fork.forkThreadId] = fork;

  const parent = projection.threads[fork.parentThreadId];
  projection.threads[fork.forkThreadId] = {
    id: fork.forkThreadId,
    object: "thread",
    title: fork.forkTitle,
    question: parent?.question || fork.forkTitle,
    status: "active",
    participantIds: unique([
      ...(parent?.participantIds || []),
      fork.forkedBy
    ]),
    parentThreadId: fork.parentThreadId,
    fork,
    createdAt: fork.forkedAt || at,
    updatedAt: fork.forkedAt || at
  };
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
  const claim = projection.claims[objection?.targetObjectId];
  if (objection?.targetObjectType === "claim" && claim?.threadId === objection.threadId) {
    projection.claims[objection.targetObjectId] = {
      ...claim,
      status: "contested"
    };
  }
}

function markAssumptionContested(projection, objection) {
  const assumption = projection.assumptions[objection?.targetObjectId];
  if (objection?.targetObjectType === "assumption" && assumption?.threadId === objection.threadId) {
    projection.assumptions[objection.targetObjectId] = {
      ...assumption,
      status: "contested"
    };
  }
}

function resolveObjection(projection, objectionId, resolution, threadId) {
  const objection = projection.objections[objectionId];
  if (!objection || objection.threadId !== threadId) {
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
  if (!request || request.threadId !== review?.threadId) {
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
  if (request?.threadId === decisionRecord.threadId) {
    request.status = decisionRecord.status === "approved" ? "merged" : "rejected";
  }
  for (const objectionId of decisionRecord.preservedObjectionIds || []) {
    if (projection.objections[objectionId]?.threadId === decisionRecord.threadId) {
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

function applyMergeReviewStatus(projection, review) {
  const request = projection.mergeRequests[review?.mergeRequestId];
  if (!request || request.targetThreadId !== review?.threadId) {
    return;
  }
  if (review.status === "request_changes") {
    request.status = "changes_requested";
  } else if (review.status === "reject") {
    request.status = "rejected";
  }
}

function applyMergeConflictResolution(projection, resolution) {
  if (!resolution?.conflictId) {
    return;
  }
  const conflict = projection.mergeConflicts[resolution.conflictId];
  if (conflict) {
    projection.mergeConflicts[conflict.id] = {
      ...conflict,
      status: "resolved",
      resolution
    };
  }
}

function applyMergeCompletion(projection, completion, at) {
  if (!completion) {
    return;
  }
  const request = projection.mergeRequests[completion.mergeRequestId];
  if (request) {
    request.status = "merged";
    touchThread(projection, request.targetThreadId, at);
  }
}

function valuesForThreadScope(projection, threadId, collectionName, visited = new Set()) {
  const thread = projection.threads[threadId];
  const collection = projection[collectionName] || {};
  const directValues = valuesForThread(collection, threadId);

  if (!thread?.fork || visited.has(threadId)) {
    return [
      ...directValues,
      ...mergedValuesForThread(projection, threadId, collectionName, directValues)
    ];
  }

  visited.add(threadId);
  const fork = thread.fork;
  const parentProjection = projectEvents(eventsThroughBoundary(projection.events, fork.inheritedThroughEventId));
  const inheritedValues = valuesForThreadScope(parentProjection, fork.parentThreadId, collectionName, visited)
    .map((object) => ({
      ...object,
      inheritedFromThreadId: object.inheritedFromThreadId || fork.parentThreadId
    }));
  return [
    ...inheritedValues,
    ...directValues,
    ...mergedValuesForThread(projection, threadId, collectionName, [...inheritedValues, ...directValues])
  ];
}

function mergedValuesForThread(projection, threadId, collectionName, existingValues = []) {
  const mergeableCollections = new Set([
    "evidence",
    "assumptions",
    "claims",
    "objections",
    "decisionRecords",
    "expectedOutcomes",
    "outcomeAudits",
    "decisionScores"
  ]);
  if (!mergeableCollections.has(collectionName)) {
    return [];
  }
  const existingIds = new Set(existingValues.map((object) => object.id));
  const merged = [];
  for (const completion of Object.values(projection.mergeCompletions)) {
    const request = projection.mergeRequests[completion.mergeRequestId];
    if (!request || request.targetThreadId !== threadId) {
      continue;
    }
    const sourceValues = valuesForThreadScope(projection, request.sourceForkThreadId, collectionName);
    for (const object of sourceValues) {
      if (!(completion.acceptedObjectIds || []).includes(object.id) || existingIds.has(object.id)) {
        continue;
      }
      if (object.inheritedFromThreadId && object.inheritedFromThreadId === threadId) {
        continue;
      }
      existingIds.add(object.id);
      merged.push({
        ...object,
        threadId,
        sourceObjectId: object.id,
        sourceThreadId: object.threadId,
        mergedFromThreadId: request.sourceForkThreadId,
        mergeRequestId: request.id,
        mergeCompletionId: completion.id,
        status: collectionName === "objections" && (completion.preservedObjectionIds || []).includes(object.id)
          ? "preserved"
          : object.status
      });
    }
  }
  return merged;
}

function eventsThroughBoundary(events, inheritedThroughEventId) {
  const boundaryIndex = events.findIndex((event) => eventId(event) === inheritedThroughEventId);
  if (boundaryIndex === -1) {
    return [];
  }
  return events.slice(0, boundaryIndex + 1);
}

function selectChangedObjects(objects, ids = []) {
  const wanted = new Set(ids || []);
  return objects.filter((object) => wanted.has(object.id));
}

function selectDivergentClaims(claims, changedClaimIds = []) {
  const wanted = new Set(changedClaimIds || []);
  return claims.filter((claim) => wanted.has(claim.id) || !claim.inheritedFromThreadId);
}

function selectMergeState(projection, threadId) {
  const requests = Object.values(projection.mergeRequests)
    .filter((request) => request.targetThreadId === threadId || request.sourceForkThreadId === threadId)
    .map((request) => selectMergeRequestState(projection, request.id));
  return {
    schema: "clista.mergeState.v0",
    threadId,
    requests,
    open: requests.filter((request) => !request.completion),
    completed: requests.filter((request) => request.completion),
    preservedDissent: requests.flatMap((request) => request.preservedObjections),
    rejectedObjects: requests.flatMap((request) => request.rejectedObjects)
  };
}

function selectMergeRequestState(projection, requestId) {
  const request = projection.mergeRequests[requestId];
  if (!request) {
    return {
      schema: "clista.mergeRequestState.v0",
      requestId,
      error: "Merge request not found"
    };
  }
  const reviews = Object.values(projection.mergeReviews)
    .filter((review) => review.mergeRequestId === request.id);
  const conflicts = Object.values(projection.mergeConflicts)
    .filter((conflict) => conflict.mergeRequestId === request.id);
  const resolutions = Object.values(projection.mergeConflictResolutions)
    .filter((resolution) => resolution.mergeRequestId === request.id);
  const completion = Object.values(projection.mergeCompletions)
    .find((candidate) => candidate.mergeRequestId === request.id) || null;
  const proposedObjects = selectProposedMergeObjects(projection, request);
  return {
    schema: "clista.mergeRequestState.v0",
    request,
    sourceForkThread: projection.threads[request.sourceForkThreadId] || null,
    targetThread: projection.threads[request.targetThreadId] || null,
    forkLineage: selectForkLineage(projection, request.sourceForkThreadId),
    proposedObjects,
    reviews,
    conflicts,
    resolutions,
    eligibility: evaluateMergeEligibility(projection.events, request.id),
    completion,
    acceptedObjects: completion ? selectObjectsByIds(proposedObjects.all, completion.acceptedObjectIds) : [],
    preservedObjections: completion ? selectObjectsByIds(proposedObjects.objections, completion.preservedObjectionIds) : [],
    rejectedObjects: completion ? selectObjectsByIds(proposedObjects.all, completion.rejectedObjectIds) : [],
    auditTrail: auditTrailForMergeRequest(projection, request.id)
  };
}

function selectProposedMergeObjects(projection, request) {
  const sourceObjects = objectsForThreadScope(projection, request.sourceForkThreadId);
  const assumptions = selectObjectsByIds(sourceObjects.assumptions, request.proposedAssumptionIds);
  const evidence = selectObjectsByIds(sourceObjects.evidence, request.proposedEvidenceIds);
  const claims = selectObjectsByIds(sourceObjects.claims, request.proposedClaimIds);
  const objections = selectObjectsByIds(sourceObjects.objections, request.proposedObjectionIds);
  const decisionRecords = selectObjectsByIds(sourceObjects.decisionRecords, request.proposedDecisionRecordIds);
  const all = [
    ...assumptions,
    ...evidence,
    ...claims,
    ...objections,
    ...decisionRecords
  ];
  return {
    assumptions,
    evidence,
    claims,
    objections,
    decisionRecords,
    all
  };
}

function objectsForThreadScope(projection, threadId) {
  return {
    evidence: valuesForThreadScope(projection, threadId, "evidence"),
    assumptions: valuesForThreadScope(projection, threadId, "assumptions"),
    claims: valuesForThreadScope(projection, threadId, "claims"),
    objections: valuesForThreadScope(projection, threadId, "objections"),
    decisionRecords: valuesForThreadScope(projection, threadId, "decisionRecords"),
    expectedOutcomes: valuesForThreadScope(projection, threadId, "expectedOutcomes"),
    outcomeAudits: valuesForThreadScope(projection, threadId, "outcomeAudits"),
    decisionScores: valuesForThreadScope(projection, threadId, "decisionScores")
  };
}

function selectObjectsByIds(objects, ids = []) {
  const byId = new Map((objects || []).map((object) => [object.id, object]));
  return (ids || []).map((id) => byId.get(id) || { id, missing: true });
}

function selectForkLineage(projection, threadId) {
  const thread = projection.threads[threadId];
  if (!thread?.fork) {
    return null;
  }
  const fork = thread.fork;
  const inheritedEvent = projection.events.find((event) => eventId(event) === fork.inheritedThroughEventId);
  return {
    parentThreadId: fork.parentThreadId,
    forkThreadId: fork.forkThreadId,
    forkTitle: fork.forkTitle,
    forkedBy: fork.forkedBy,
    forkedAt: fork.forkedAt,
    inheritedThroughEventId: fork.inheritedThroughEventId,
    inheritedThroughTimestamp: eventTimestamp(inheritedEvent) || null,
    forkReason: fork.forkReason,
    changedAssumptionIds: fork.changedAssumptionIds || [],
    changedClaimIds: fork.changedClaimIds || [],
    ancestors: forkAncestors(projection, fork.parentThreadId)
  };
}

function forkAncestors(projection, threadId) {
  const ancestors = [];
  const seen = new Set();
  let thread = projection.threads[threadId];
  while (thread?.fork && !seen.has(thread.id)) {
    seen.add(thread.id);
    ancestors.push({
      parentThreadId: thread.fork.parentThreadId,
      forkThreadId: thread.fork.forkThreadId,
      inheritedThroughEventId: thread.fork.inheritedThroughEventId,
      forkReason: thread.fork.forkReason
    });
    thread = projection.threads[thread.fork.parentThreadId];
  }
  return ancestors;
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

function auditTrailForThread(projection, threadId) {
  const thread = projection.threads[threadId];
  if (!thread?.fork) {
    return auditTrail(projection.events, threadId);
  }

  const parentProjection = projectEvents(eventsThroughBoundary(projection.events, thread.fork.inheritedThroughEventId));
  return [
    ...auditTrailForThread(parentProjection, thread.fork.parentThreadId).map((entry) => ({
      ...entry,
      inherited: true,
      inheritedFromThreadId: entry.thread_id
    })),
    ...auditTrail(projection.events, threadId)
  ];
}

function auditTrailForMergeRequest(projection, requestId) {
  return projection.events
    .filter((event) => {
      const payload = event.payload || {};
      return payload.mergeRequest?.id === requestId
        || payload.mergeReview?.mergeRequestId === requestId
        || payload.mergeConflict?.mergeRequestId === requestId
        || payload.mergeConflictResolution?.mergeRequestId === requestId
        || payload.mergeCompletion?.mergeRequestId === requestId;
    })
    .map((event) => ({
      event_id: eventId(event),
      event_type: eventType(event),
      timestamp: eventTimestamp(event),
      actor_id: eventActorId(event),
      thread_id: eventThreadId(event),
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
    || payload.threadFork
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
    || payload.mergeRequest
    || payload.mergeReview
    || payload.mergeConflict
    || payload.mergeConflictResolution
    || payload.mergeCompletion
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
  selectForkLineage,
  selectMergeRequestState,
  selectMergeState,
  selectThreadState
};
