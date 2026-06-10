const { isBlockingObjection } = require("./governance");
const {
  applyIdentityEvent,
  authorizedParticipantIds,
  emptyIdentityState
} = require("./identity");
const { unique } = require("./utils");

const MERGE_REQUEST_CHANGES_STATUSES = new Set(["request_changes"]);
const MERGE_REJECT_STATUSES = new Set(["reject"]);

const MERGE_CONFLICT_RESOLUTIONS = new Set([
  "accept_parent",
  "accept_fork",
  "preserve_both",
  "supersede",
  "reject_fork"
]);

function evaluateMergeEligibility(events, requestId, options = {}) {
  const state = buildMergeState(events);
  const request = state.mergeRequests.get(requestId);
  const completion = options.completion || null;
  const completionEventId = options.eventId || null;
  const result = emptyMergeEligibilityResult(requestId);

  if (!request) {
    addReason(result, completionEventId, `merge request does not exist: ${requestId}`);
    return finish(result);
  }

  const requestEvent = state.objectEvents.get(request.id);
  const source = state.threads.get(request.sourceForkThreadId);
  const target = state.threads.get(request.targetThreadId);
  result.sourceForkThreadId = request.sourceForkThreadId;
  result.targetThreadId = request.targetThreadId;
  result.authorizedDecisionOwners = authorizedDecisionOwnerIds(state, request.targetThreadId);
  result.proposed = proposedIdsForRequest(request);
  result.reviews = mergeReviewsForRequest(state, request.id);
  result.conflicts = mergeConflictsForRequest(state, request.id);
  result.resolutions = mergeConflictResolutionsForRequest(state, request.id);
  result.completion = completion || state.mergeCompletionsByRequest.get(request.id) || null;

  if (!source?.fork) {
    addReason(result, requestEvent?.event_id, `merge request source is not a known fork: ${request.sourceForkThreadId}`);
  }
  if (!target) {
    addReason(result, requestEvent?.event_id, `merge request target thread does not exist: ${request.targetThreadId}`);
  }
  if (source?.fork && target && !threadDescendsFrom(state, request.sourceForkThreadId, request.targetThreadId)) {
    addReason(
      result,
      requestEvent?.event_id,
      `merge request source ${request.sourceForkThreadId} is not descended from target ${request.targetThreadId}`
    );
  }

  if (!result.authorizedDecisionOwners.length) {
    addReason(result, requestEvent?.event_id, "no decision_owner participant is authorized for this merge target");
  }

  const actorId = completion?.mergedBy || options.actorId;
  if (actorId && !result.authorizedDecisionOwners.includes(actorId)) {
    addReason(result, completionEventId, `merge completed without authorized decision owner ${actorId}`);
  }

  const existingCompletion = state.mergeCompletionsByRequest.get(request.id);
  if (existingCompletion) {
    const existingEvent = state.objectEvents.get(existingCompletion.id);
    addReason(result, existingEvent?.event_id, `merge request already completed: ${request.id}`);
  }

  evaluateMergeReviews(result, state, request);
  evaluateMergeConflicts(result, state, request);
  evaluateMergeObjects(result, state, request, completion, completionEventId);
  evaluateBlockingObjections(result, state, request, completion, completionEventId);

  return finish(result);
}

function buildMergeState(events) {
  const state = {
    events: [],
    participants: new Map(),
    participantThreadIds: new Map(),
    identity: emptyIdentityState(),
    threads: new Map(),
    forks: new Map(),
    evidence: new Map(),
    assumptions: new Map(),
    claims: new Map(),
    objections: new Map(),
    decisionRecords: new Map(),
    expectedOutcomes: new Map(),
    outcomeAudits: new Map(),
    decisionScores: new Map(),
    mergeRequests: new Map(),
    mergeReviews: new Map(),
    mergeReviewsByRequest: new Map(),
    mergeConflicts: new Map(),
    mergeConflictsByRequest: new Map(),
    mergeConflictResolutions: new Map(),
    mergeConflictResolutionsByConflict: new Map(),
    mergeCompletions: new Map(),
    mergeCompletionsByRequest: new Map(),
    objectEvents: new Map()
  };

  for (const event of events || []) {
    state.events.push(event);
    const payload = event?.payload || {};
    switch (event?.event_type) {
      case "ParticipantAdded":
        upsert(state.participants, payload.participant, event, state);
        addParticipantThread(state, payload.participant?.id, event.thread_id);
        applyIdentityEvent(state.identity, event);
        break;
      case "ParticipantDeclared":
        upsert(state.participants, payload.participant, event, state);
        addParticipantThread(state, payload.participant?.id, event.thread_id);
        applyIdentityEvent(state.identity, event);
        break;
      case "ParticipantRoleAssigned":
      case "ParticipantAuthorityGranted":
      case "ParticipantAuthorityRevoked":
        applyIdentityEvent(state.identity, event);
        break;
      case "ThreadCreated":
        upsert(state.threads, payload.thread, event, state);
        break;
      case "ThreadForked":
        applyThreadFork(state, payload.threadFork, event);
        break;
      case "EvidenceCommitted":
        upsert(state.evidence, payload.evidence, event, state);
        break;
      case "AssumptionDeclared":
        upsert(state.assumptions, payload.assumption, event, state);
        break;
      case "ClaimCreated":
        upsert(state.claims, payload.claim, event, state);
        break;
      case "ObjectionRaised":
        upsert(state.objections, payload.objection, event, state);
        break;
      case "ObjectionResolved":
        applyObjectionResolution(state, event);
        break;
      case "DecisionMerged":
        upsert(state.decisionRecords, payload.decisionRecord, event, state);
        break;
      case "ExpectedOutcomeDeclared":
        upsert(state.expectedOutcomes, payload.expectedOutcome, event, state);
        break;
      case "OutcomeAudited":
        upsert(state.outcomeAudits, payload.outcomeAudit, event, state);
        break;
      case "DecisionScored":
        upsert(state.decisionScores, payload.decisionScore, event, state);
        break;
      case "MergeRequestOpened":
        upsert(state.mergeRequests, payload.mergeRequest, event, state);
        break;
      case "MergeReviewSubmitted":
        upsert(state.mergeReviews, payload.mergeReview, event, state);
        addToMapList(state.mergeReviewsByRequest, payload.mergeReview?.mergeRequestId, payload.mergeReview);
        break;
      case "MergeConflictDeclared":
        upsert(state.mergeConflicts, payload.mergeConflict, event, state);
        addToMapList(state.mergeConflictsByRequest, payload.mergeConflict?.mergeRequestId, payload.mergeConflict);
        break;
      case "MergeConflictResolved":
        upsert(state.mergeConflictResolutions, payload.mergeConflictResolution, event, state);
        applyMergeConflictResolution(state, payload.mergeConflictResolution);
        break;
      case "MergeCompleted":
        upsert(state.mergeCompletions, payload.mergeCompletion, event, state);
        if (payload.mergeCompletion?.mergeRequestId) {
          state.mergeCompletionsByRequest.set(payload.mergeCompletion.mergeRequestId, payload.mergeCompletion);
        }
        break;
      default:
        break;
    }
  }

  return state;
}

function emptyMergeEligibilityResult(requestId) {
  return {
    schema: "clista.merge.eligibility.v0",
    eligible: false,
    requestId,
    sourceForkThreadId: null,
    targetThreadId: null,
    authorizedDecisionOwners: [],
    proposed: {
      assumptionIds: [],
      evidenceIds: [],
      claimIds: [],
      objectionIds: [],
      decisionRecordIds: []
    },
    reviews: [],
    conflicts: [],
    resolutions: [],
    unresolvedConflicts: [],
    unresolvedRequestChanges: [],
    rejectedReviews: [],
    blockingObjections: [],
    requiredPreservedObjections: [],
    missingAcceptedObjects: [],
    missingRejectedObjects: [],
    completion: null,
    reasons: []
  };
}

function evaluateMergeReviews(result, state, request) {
  const latestReviews = latestMergeReviewsByReviewer(mergeReviewsForRequest(state, request.id));
  for (const review of latestReviews) {
    if (MERGE_REQUEST_CHANGES_STATUSES.has(review.status)) {
      result.unresolvedRequestChanges.push(review.id);
      addReason(result, state.objectEvents.get(review.id)?.event_id, `merge review ${review.id} has unresolved request_changes`);
    }
    if (MERGE_REJECT_STATUSES.has(review.status)) {
      result.rejectedReviews.push(review.id);
      addReason(result, state.objectEvents.get(review.id)?.event_id, `merge review ${review.id} rejects merge`);
    }
  }
}

function evaluateMergeConflicts(result, state, request) {
  for (const conflict of mergeConflictsForRequest(state, request.id)) {
    if (!state.mergeConflictResolutionsByConflict.has(conflict.id)) {
      result.unresolvedConflicts.push(conflict.id);
      addReason(result, state.objectEvents.get(conflict.id)?.event_id, `merge conflict remains unresolved: ${conflict.id}`);
    }
  }
}

function evaluateMergeObjects(result, state, request, completion, completionEventId) {
  if (!completion) {
    return;
  }
  const sourceObjectIds = objectIdsForThreadScope(state, request.sourceForkThreadId);
  for (const objectId of completion.acceptedObjectIds || []) {
    if (!sourceObjectIds.has(objectId)) {
      result.missingAcceptedObjects.push(objectId);
      addReason(result, completionEventId, `acceptedObjectId does not exist in source fork state: ${objectId}`);
    }
  }
  for (const objectId of completion.rejectedObjectIds || []) {
    if (!sourceObjectIds.has(objectId)) {
      result.missingRejectedObjects.push(objectId);
      addReason(result, completionEventId, `rejectedObjectId does not exist in source fork state: ${objectId}`);
    }
  }
}

function evaluateBlockingObjections(result, state, request, completion, completionEventId) {
  if (!completion) {
    return;
  }
  const sourceObjects = objectsForThreadScope(state, request.sourceForkThreadId);
  const sourceObjections = new Map(sourceObjects.objections.map((objection) => [objection.id, objection]));
  const acceptedObjectIds = new Set(completion.acceptedObjectIds || []);
  const preservedObjectionIds = new Set(completion.preservedObjectionIds || []);
  const rejectedObjectIds = new Set(completion.rejectedObjectIds || []);
  const rejectedWithRationale = rejectionRationaleObjectIds(state, request.id);

  for (const objectionId of request.proposedObjectionIds || []) {
    const objection = sourceObjections.get(objectionId);
    if (!isBlockingObjection(objection)) {
      continue;
    }
    result.blockingObjections.push(objectionId);
    if (acceptedObjectIds.has(objectionId) || preservedObjectionIds.has(objectionId)) {
      result.requiredPreservedObjections.push(objectionId);
      continue;
    }
    if (rejectedObjectIds.has(objectionId) && rejectedWithRationale.has(objectionId)) {
      continue;
    }
    result.requiredPreservedObjections.push(objectionId);
    addReason(
      result,
      completionEventId,
      `blocking objection ${objectionId} dropped without preservation or rejection rationale`
    );
  }
}

function proposedIdsForRequest(request) {
  return {
    assumptionIds: request.proposedAssumptionIds || [],
    evidenceIds: request.proposedEvidenceIds || [],
    claimIds: request.proposedClaimIds || [],
    objectionIds: request.proposedObjectionIds || [],
    decisionRecordIds: request.proposedDecisionRecordIds || []
  };
}

function mergeReviewsForRequest(state, requestId) {
  return state.mergeReviewsByRequest.get(requestId) || [];
}

function mergeConflictsForRequest(state, requestId) {
  return state.mergeConflictsByRequest.get(requestId) || [];
}

function mergeConflictResolutionsForRequest(state, requestId) {
  return Array.from(state.mergeConflictResolutions.values())
    .filter((resolution) => resolution.mergeRequestId === requestId);
}

function rejectionRationaleObjectIds(state, requestId) {
  const ids = new Set();
  for (const conflict of mergeConflictsForRequest(state, requestId)) {
    const resolution = state.mergeConflictResolutionsByConflict.get(conflict.id);
    if (resolution?.resolution === "reject_fork" && String(resolution.rationale || "").trim()) {
      ids.add(conflict.forkObjectId);
    }
  }
  return ids;
}

function latestMergeReviewsByReviewer(reviews) {
  const latest = new Map();
  for (const review of reviews) {
    const reviewerId = review.reviewerId || review.reviewerParticipantId;
    if (!reviewerId) {
      continue;
    }
    const existing = latest.get(reviewerId);
    if (!existing || String(existing.reviewedAt || "").localeCompare(String(review.reviewedAt || "")) < 0) {
      latest.set(reviewerId, review);
    }
  }
  return Array.from(latest.values());
}

function objectsForThreadScope(state, threadId, visited = new Set()) {
  if (!threadId || visited.has(threadId)) {
    return emptyScopedObjects();
  }
  visited.add(threadId);
  const scoped = directObjectsForThread(state, threadId);
  const thread = state.threads.get(threadId);
  if (!thread?.fork) {
    return scoped;
  }
  const boundaryState = buildMergeState(eventsThroughBoundary(state.events, thread.fork.inheritedThroughEventId));
  return mergeScopedObjects(
    objectsForThreadScope(boundaryState, thread.fork.parentThreadId, visited),
    scoped
  );
}

function objectIdsForThreadScope(state, threadId) {
  const scoped = objectsForThreadScope(state, threadId);
  return new Set(Object.values(scoped).flatMap((objects) => objects.map((object) => object.id)));
}

function directObjectsForThread(state, threadId) {
  return {
    evidence: valuesForThread(state.evidence, threadId),
    assumptions: valuesForThread(state.assumptions, threadId),
    claims: valuesForThread(state.claims, threadId),
    objections: valuesForThread(state.objections, threadId),
    decisionRecords: valuesForThread(state.decisionRecords, threadId),
    expectedOutcomes: valuesForThread(state.expectedOutcomes, threadId),
    outcomeAudits: valuesForThread(state.outcomeAudits, threadId),
    decisionScores: valuesForThread(state.decisionScores, threadId)
  };
}

function mergeScopedObjects(left, right) {
  const merged = {};
  for (const key of Object.keys(emptyScopedObjects())) {
    merged[key] = [...(left[key] || []), ...(right[key] || [])];
  }
  return merged;
}

function emptyScopedObjects() {
  return {
    evidence: [],
    assumptions: [],
    claims: [],
    objections: [],
    decisionRecords: [],
    expectedOutcomes: [],
    outcomeAudits: [],
    decisionScores: []
  };
}

function valuesForThread(collection, threadId) {
  return Array.from(collection.values()).filter((object) => object.threadId === threadId);
}

function threadDescendsFrom(state, sourceThreadId, targetThreadId) {
  const seen = new Set();
  let thread = state.threads.get(sourceThreadId);
  while (thread?.fork && !seen.has(thread.id)) {
    seen.add(thread.id);
    if (thread.fork.parentThreadId === targetThreadId) {
      return true;
    }
    thread = state.threads.get(thread.fork.parentThreadId);
  }
  return false;
}

function authorizedDecisionOwnerIds(state, threadId) {
  return authorizedParticipantIds(state.identity, "decision_owner", threadId)
    .filter((participantId) => {
      const authorities = Array.from(state.identity.activeAuthorities.values())
        .filter((authority) => authority.participantId === participantId && authority.authority === "decision_owner");
      return authorities.some((authority) => authority.scope === "global")
        || participantBelongsToThread(state, participantId, threadId)
        || authorities.some((authority) => authority.threadId === threadId);
    });
}

function participantBelongsToThread(state, participantId, threadId) {
  const thread = state.threads.get(threadId);
  const eventThreadIds = state.participantThreadIds.get(participantId) || new Set();
  return Boolean(thread?.participantIds?.includes(participantId) || eventThreadIds.has(threadId));
}

function applyThreadFork(state, threadFork, event) {
  if (!threadFork?.forkThreadId) {
    return;
  }
  const parent = state.threads.get(threadFork.parentThreadId);
  const fork = {
    id: threadFork.id || threadFork.forkThreadId,
    object: "threadFork",
    ...threadFork
  };
  state.forks.set(fork.forkThreadId, fork);
  state.objectEvents.set(fork.id, event);
  state.threads.set(fork.forkThreadId, {
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
    createdAt: fork.forkedAt || event.timestamp,
    updatedAt: fork.forkedAt || event.timestamp
  });
}

function applyObjectionResolution(state, event) {
  const objectionId = event.payload?.objectionId || event.payload?.objection?.id;
  const objection = state.objections.get(objectionId);
  if (!objection || objection.threadId !== event.thread_id) {
    return;
  }
  state.objections.set(objectionId, {
    ...objection,
    status: "resolved",
    resolution: event.payload?.resolution || event.payload?.objection?.resolution
  });
}

function applyMergeConflictResolution(state, resolution) {
  if (!resolution?.conflictId) {
    return;
  }
  state.mergeConflictResolutionsByConflict.set(resolution.conflictId, resolution);
  const conflict = state.mergeConflicts.get(resolution.conflictId);
  if (conflict) {
    state.mergeConflicts.set(conflict.id, {
      ...conflict,
      status: "resolved",
      resolution
    });
  }
}

function upsert(collection, object, event, state) {
  if (!object?.id) {
    return;
  }
  collection.set(object.id, object);
  state.objectEvents.set(object.id, event);
}

function addParticipantThread(state, participantId, threadId) {
  if (!participantId || !threadId) {
    return;
  }
  if (!state.participantThreadIds.has(participantId)) {
    state.participantThreadIds.set(participantId, new Set());
  }
  state.participantThreadIds.get(participantId).add(threadId);
}

function addToMapList(map, key, value) {
  if (!key || !value) {
    return;
  }
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
}

function addReason(result, eventId, reason) {
  result.reasons.push({
    event_id: eventId || null,
    reason
  });
}

function finish(result) {
  result.authorizedDecisionOwners = unique(result.authorizedDecisionOwners);
  result.unresolvedConflicts = unique(result.unresolvedConflicts);
  result.unresolvedRequestChanges = unique(result.unresolvedRequestChanges);
  result.rejectedReviews = unique(result.rejectedReviews);
  result.blockingObjections = unique(result.blockingObjections);
  result.requiredPreservedObjections = unique(result.requiredPreservedObjections);
  result.missingAcceptedObjects = unique(result.missingAcceptedObjects);
  result.missingRejectedObjects = unique(result.missingRejectedObjects);
  result.eligible = result.reasons.length === 0;
  return result;
}

function eventsThroughBoundary(events, inheritedThroughEventId) {
  const boundaryIndex = events.findIndex((event) => event?.event_id === inheritedThroughEventId);
  if (boundaryIndex === -1) {
    return [];
  }
  return events.slice(0, boundaryIndex + 1);
}


module.exports = {
  MERGE_CONFLICT_RESOLUTIONS,
  buildMergeState,
  evaluateMergeEligibility,
  objectIdsForThreadScope,
  objectsForThreadScope,
  threadDescendsFrom
};
