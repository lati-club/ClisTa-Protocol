const {
  MERGE_CONFLICT_RESOLUTIONS,
  buildMergeState,
  evaluateMergeEligibility,
  objectIdsForThreadScope,
  threadDescendsFrom
} = require("../merges");
const {
  addError,
  addToMapList,
  isDecisionOwner
} = require("./shared");

const MERGE_REVIEW_STATUSES = new Set([
  "approve",
  "request_changes",
  "reject"
]);

const MERGE_CONFLICT_TYPES = new Set([
  "assumption",
  "claim",
  "evidence",
  "objection",
  "decision",
  "outcome"
]);

function validateMergeRequestOpened(event, state) {
  const request = event.payload.mergeRequest;
  if (!request?.id) {
    addError(state, event, "MergeRequestOpened payload missing mergeRequest.id");
    return;
  }
  if (request.id !== request.mergeRequestId) {
    addError(state, event, "mergeRequest.id must match mergeRequestId");
  }
  if (request.threadId !== event.thread_id || request.targetThreadId !== event.thread_id) {
    addError(state, event, "merge request targetThreadId must match event thread_id");
  }
  if (!state.threads.has(request.targetThreadId)) {
    addError(state, event, `merge request target thread does not exist: ${request.targetThreadId}`);
  }
  const sourceThread = state.threads.get(request.sourceForkThreadId);
  if (!sourceThread?.fork) {
    addError(state, event, `merge request source is not a known fork: ${request.sourceForkThreadId}`);
  } else {
    const mergeState = buildMergeState(state.events);
    if (!threadDescendsFrom(mergeState, request.sourceForkThreadId, request.targetThreadId)) {
      addError(
        state,
        event,
        `merge request source ${request.sourceForkThreadId} is not descended from target ${request.targetThreadId}`
      );
    }
    validateMergeProposalIds(event, state, request, mergeState);
  }
  if (!state.participants.has(request.openedBy)) {
    addError(state, event, `merge request opened by unknown participant ${request.openedBy}`);
  }
  if (state.mergeRequests.has(request.id)) {
    addError(state, event, `duplicate merge request ${request.id}`);
  }
  state.mergeRequests.set(request.id, request);
}

function validateMergeReviewSubmitted(event, state) {
  const review = event.payload.mergeReview;
  if (!review?.id) {
    addError(state, event, "MergeReviewSubmitted payload missing mergeReview.id");
    return;
  }
  const request = state.mergeRequests.get(review.mergeRequestId);
  if (!request) {
    addError(state, event, `merge review references unknown merge request ${review.mergeRequestId}`);
  } else if (review.threadId !== event.thread_id || review.threadId !== request.targetThreadId) {
    addError(state, event, "merge review threadId must match merge request target thread");
  }
  if (!MERGE_REVIEW_STATUSES.has(String(review.status || ""))) {
    addError(state, event, `unsupported merge review status ${review.status}`);
  }
  const reviewerId = review.reviewerId || review.reviewerParticipantId;
  if (!state.participants.has(reviewerId)) {
    addError(state, event, `merge review references unknown reviewer ${reviewerId}`);
  }
  state.mergeReviews.set(review.id, review);
  addToMapList(state.mergeReviewsByRequest, review.mergeRequestId, review);
}

function validateMergeConflictDeclared(event, state) {
  const conflict = event.payload.mergeConflict;
  if (!conflict?.id) {
    addError(state, event, "MergeConflictDeclared payload missing mergeConflict.id");
    return;
  }
  if (conflict.id !== conflict.conflictId) {
    addError(state, event, "mergeConflict.id must match conflictId");
  }
  const request = state.mergeRequests.get(conflict.mergeRequestId);
  if (!request) {
    addError(state, event, `merge conflict references unknown merge request ${conflict.mergeRequestId}`);
  } else {
    if (conflict.threadId !== event.thread_id || conflict.threadId !== request.targetThreadId) {
      addError(state, event, "merge conflict threadId must match merge request target thread");
    }
    const mergeState = buildMergeState(state.events);
    const parentObjectIds = objectIdsForThreadScope(mergeState, request.targetThreadId);
    const forkObjectIds = objectIdsForThreadScope(mergeState, request.sourceForkThreadId);
    if (!parentObjectIds.has(conflict.parentObjectId)) {
      addError(state, event, `merge conflict parent object does not exist in target state: ${conflict.parentObjectId}`);
    }
    if (!forkObjectIds.has(conflict.forkObjectId)) {
      addError(state, event, `merge conflict fork object does not exist in source fork state: ${conflict.forkObjectId}`);
    }
  }
  if (!MERGE_CONFLICT_TYPES.has(String(conflict.conflictType || ""))) {
    addError(state, event, `unsupported merge conflict type ${conflict.conflictType}`);
  }
  if (state.mergeConflicts.has(conflict.id)) {
    addError(state, event, `duplicate merge conflict ${conflict.id}`);
  }
  state.mergeConflicts.set(conflict.id, {
    status: "open",
    ...conflict
  });
  addToMapList(state.mergeConflictsByRequest, conflict.mergeRequestId, conflict);
}

function validateMergeConflictResolved(event, state) {
  const resolution = event.payload.mergeConflictResolution;
  if (!resolution?.id) {
    addError(state, event, "MergeConflictResolved payload missing mergeConflictResolution.id");
    return;
  }
  const request = state.mergeRequests.get(resolution.mergeRequestId);
  const conflict = state.mergeConflicts.get(resolution.conflictId);
  if (!request) {
    addError(state, event, `merge conflict resolution references unknown merge request ${resolution.mergeRequestId}`);
  }
  if (!conflict) {
    addError(state, event, `merge conflict resolution references unknown conflict ${resolution.conflictId}`);
  } else if (conflict.mergeRequestId !== resolution.mergeRequestId) {
    addError(state, event, `merge conflict ${resolution.conflictId} does not belong to merge request ${resolution.mergeRequestId}`);
  }
  if (request && (resolution.threadId !== event.thread_id || resolution.threadId !== request.targetThreadId)) {
    addError(state, event, "merge conflict resolution threadId must match merge request target thread");
  }
  if (!MERGE_CONFLICT_RESOLUTIONS.has(String(resolution.resolution || ""))) {
    addError(state, event, `unsupported merge conflict resolution ${resolution.resolution}`);
  }
  if (!String(resolution.rationale || "").trim()) {
    addError(state, event, "merge conflict resolution requires rationale");
  }
  if (!state.participants.has(resolution.resolvedBy)) {
    addError(state, event, `merge conflict resolution references unknown resolver ${resolution.resolvedBy}`);
  }
  state.mergeConflictResolutions.set(resolution.id, resolution);
  state.mergeConflictResolutionsByConflict.set(resolution.conflictId, resolution);
  if (conflict) {
    state.mergeConflicts.set(conflict.id, {
      ...conflict,
      status: "resolved",
      resolution
    });
  }
}

function validateMergeCompleted(event, state) {
  const completion = event.payload.mergeCompletion;
  if (!completion?.id) {
    addError(state, event, "MergeCompleted payload missing mergeCompletion.id");
    return;
  }
  const request = state.mergeRequests.get(completion.mergeRequestId);
  if (!request) {
    addError(state, event, `merge completion before merge request exists: ${completion.mergeRequestId}`);
  } else if (completion.threadId !== event.thread_id || completion.threadId !== request.targetThreadId) {
    addError(state, event, "merge completion threadId must match merge request target thread");
  }
  if (state.mergeCompletionsByRequest.has(completion.mergeRequestId)) {
    addError(state, event, `duplicate merge completion for request ${completion.mergeRequestId}`);
  }
  if (!state.participants.has(completion.mergedBy)) {
    addError(state, event, `merge completion references unknown merger ${completion.mergedBy}`);
  }
  if (!isDecisionOwner(completion.mergedBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `merge completed without authorized decision owner ${completion.mergedBy}`);
  }

  const eligibility = evaluateMergeEligibility(state.events, completion.mergeRequestId, {
    actorId: event.actor_id,
    completion,
    eventId: event.event_id
  });
  for (const reason of eligibility.reasons) {
    addError(state, {
      event_id: reason.event_id || event.event_id,
      event_type: event.event_type
    }, reason.reason);
  }

  state.mergeCompletions.set(completion.id, completion);
  state.mergeCompletionsByRequest.set(completion.mergeRequestId, completion);
}

function validateMergeProposalIds(event, state, request, mergeState) {
  const sourceObjectIds = objectIdsForThreadScope(mergeState, request.sourceForkThreadId);
  const proposalGroups = [
    ["assumption", request.proposedAssumptionIds],
    ["evidence", request.proposedEvidenceIds],
    ["claim", request.proposedClaimIds],
    ["objection", request.proposedObjectionIds],
    ["decision record", request.proposedDecisionRecordIds]
  ];
  for (const [label, ids] of proposalGroups) {
    for (const id of ids || []) {
      if (!sourceObjectIds.has(id)) {
        addError(state, event, `merge request proposed ${label} does not exist in source fork state: ${id}`);
      }
    }
  }
}

module.exports = {
  validateMergeCompleted,
  validateMergeConflictDeclared,
  validateMergeConflictResolved,
  validateMergeRequestOpened,
  validateMergeReviewSubmitted
};
