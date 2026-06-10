const {
  applyIdentityEvent,
  authorizedParticipantIds,
  emptyIdentityState,
  isDecisionOwnerRole
} = require("./identity");
const { unique } = require("./utils");

const APPROVAL_REVIEW_STATUSES = new Set([
  "approve",
  "approved",
  "approve_with_conditions"
]);

const REQUEST_CHANGES_STATUSES = new Set([
  "request_changes",
  "changes_requested"
]);

const MERGEABLE_REQUEST_STATUSES = new Set([
  "open",
  "review",
  "ready",
  "pending_review"
]);

function evaluateDecisionEligibility(events, requestId, options = {}) {
  const state = buildGovernanceState(events);
  const request = state.decisionRequests.get(requestId);
  const decisionRecord = options.decisionRecord || null;
  const decisionEventId = options.eventId || null;
  const result = emptyEligibilityResult(requestId);

  if (!request) {
    addReason(result, decisionEventId, `decision request does not exist: ${requestId}`);
    return finish(result);
  }

  const requestEvent = state.objectEvents.get(request.id);
  result.threadId = request.threadId;
  result.authorizedDecisionOwners = authorizedDecisionOwnerIds(state, request.threadId);

  if (!result.authorizedDecisionOwners.length) {
    addReason(result, requestEvent?.event_id, "no decision_owner participant is authorized for this request");
  }

  const deciderId = decisionRecord?.decidedByParticipantId || options.actorId;
  if (deciderId && !result.authorizedDecisionOwners.includes(deciderId)) {
    addReason(result, decisionEventId, `decision merged without authorized decision owner ${deciderId}`);
  }

  if (!isMergeableRequestStatus(request.status)) {
    addReason(result, requestEvent?.event_id, `decision request status is not mergeable: ${request.status}`);
  }

  const existingDecision = state.decisionsByRequest.get(request.id);
  if (existingDecision) {
    const existingEvent = state.objectEvents.get(existingDecision.id);
    addReason(result, existingEvent?.event_id, `decision request already has final decision ${existingDecision.id}`);
  }

  evaluateReviewRequirements(result, state, request, decisionRecord, decisionEventId);
  evaluateSupportRequirements(result, request, decisionRecord, requestEvent?.event_id, decisionEventId);
  evaluateObjectionRequirements(result, state, request, decisionRecord);

  result.recorded = buildRecordedDecisionPackage(state, request, decisionRecord, deciderId);

  return finish(result);
}

function buildGovernanceState(events) {
  const state = {
    participants: new Map(),
    participantThreadIds: new Map(),
    identity: emptyIdentityState(),
    threads: new Map(),
    evidence: new Map(),
    assumptions: new Map(),
    claims: new Map(),
    objections: new Map(),
    decisionRequests: new Map(),
    reviews: new Map(),
    reviewsByRequest: new Map(),
    decisionRecords: new Map(),
    decisionsByRequest: new Map(),
    objectEvents: new Map()
  };

  for (const event of events || []) {
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
      case "DecisionRequestOpened":
        upsert(state.decisionRequests, payload.decisionRequest, event, state);
        break;
      case "ReviewSubmitted":
        upsert(state.reviews, payload.review, event, state);
        addToMapList(state.reviewsByRequest, payload.review?.decisionRequestId, payload.review);
        break;
      case "DecisionMerged":
        upsert(state.decisionRecords, payload.decisionRecord, event, state);
        if (payload.decisionRecord?.decisionRequestId) {
          state.decisionsByRequest.set(payload.decisionRecord.decisionRequestId, payload.decisionRecord);
        }
        break;
      case "MinorityReportFiled":
        if (payload.minorityReport?.id) {
          state.objectEvents.set(payload.minorityReport.id, event);
        }
        break;
      default:
        break;
    }
  }

  return state;
}

function emptyEligibilityResult(requestId) {
  return {
    schema: "clista.governance.eligibility.v0",
    eligible: false,
    requestId,
    threadId: null,
    authorizedDecisionOwners: [],
    blockingObjections: [],
    nonBlockingObjections: [],
    missingReviews: [],
    requiredMinorityReports: [],
    recorded: {
      supportingEvidenceIds: [],
      supportingClaimIds: [],
      supportingAssumptionIds: [],
      objectionIds: [],
      reviewIds: [],
      authorityTrail: []
    },
    reasons: []
  };
}

function evaluateReviewRequirements(result, state, request, decisionRecord, decisionEventId) {
  const reviews = state.reviewsByRequest.get(request.id) || [];
  const latestReviews = latestReviewsByReviewer(reviews);
  const approvingReviews = latestReviews.filter((review) => isApprovalReview(review.status));
  const requiredReviewers = request.requiredReviewerParticipantIds || [];

  if (requiredReviewers.length) {
    const approvedReviewerIds = new Set(approvingReviews.map((review) => review.reviewerParticipantId));
    for (const reviewerId of requiredReviewers) {
      if (!approvedReviewerIds.has(reviewerId)) {
        result.missingReviews.push(reviewerId);
      }
    }
    if (result.missingReviews.length) {
      addReason(result, decisionEventId || state.objectEvents.get(request.id)?.event_id, "required reviews are missing");
    }
  } else if (!approvingReviews.length) {
    result.missingReviews.push("approval_review");
    addReason(
      result,
      decisionRecord ? decisionEventId : state.objectEvents.get(request.id)?.event_id,
      decisionRecord ? "decision merged without review" : "decision request has no approving review"
    );
  }

  for (const review of latestReviews) {
    if (isRequestChangesReview(review.status)) {
      const reviewEvent = state.objectEvents.get(review.id);
      addReason(result, reviewEvent?.event_id, `review ${review.id} has unresolved request_changes`);
    }
  }
}

function evaluateSupportRequirements(result, request, decisionRecord, requestEventId, decisionEventId) {
  const supportingEvidenceIds = unique([
    ...(request.supportingEvidenceIds || []),
    ...(decisionRecord?.supportingEvidenceIds || [])
  ]);
  const supportingClaimIds = unique([
    ...(request.supportingClaimIds || []),
    ...(decisionRecord?.supportingClaimIds || [])
  ]);
  const supportingAssumptionIds = unique([
    ...(request.supportingAssumptionIds || []),
    ...(decisionRecord?.supportingAssumptionIds || [])
  ]);

  if (!supportingEvidenceIds.length) {
    addReason(
      result,
      decisionRecord ? decisionEventId : requestEventId,
      decisionRecord ? "decision merged without evidence" : "decision request has no supporting evidence"
    );
  }
  if (!supportingClaimIds.length) {
    addReason(
      result,
      decisionRecord ? decisionEventId : requestEventId,
      decisionRecord ? "decision merged without supporting claims" : "decision request has no supporting claims"
    );
  }
  if (!supportingAssumptionIds.length) {
    addReason(
      result,
      decisionRecord ? decisionEventId : requestEventId,
      decisionRecord ? "decision merged without supporting assumptions" : "decision request has no supporting assumptions"
    );
  }
}

function evaluateObjectionRequirements(result, state, request, decisionRecord) {
  const preservedObjectionIds = new Set(decisionRecord?.preservedObjectionIds || []);

  for (const objectionId of request.objectionIds || []) {
    const objection = state.objections.get(objectionId);
    if (!objection || isResolvedObjection(objection)) {
      continue;
    }

    if (!isBlockingObjection(objection)) {
      result.nonBlockingObjections.push(objectionId);
      continue;
    }

    if (preservedObjectionIds.has(objectionId) || objection.status === "preserved") {
      pushUnique(result.requiredMinorityReports, objectionId);
      continue;
    }

    pushUnique(result.blockingObjections, objectionId);
    pushUnique(result.requiredMinorityReports, objectionId);
    addReason(
      result,
      state.objectEvents.get(objectionId)?.event_id,
      "blocking objection remains unresolved and unpreserved"
    );
  }
}

function buildRecordedDecisionPackage(state, request, decisionRecord, deciderId) {
  const reviews = state.reviewsByRequest.get(request.id) || [];
  const reviewIds = reviews.map((review) => review.id).filter(Boolean);
  const objectionIds = unique([
    ...(request.objectionIds || []),
    ...(decisionRecord?.objectionIds || []),
    ...(decisionRecord?.preservedObjectionIds || [])
  ]);
  const authorityTrail = deciderId
    ? [{
        participantId: deciderId,
        role: state.participants.get(deciderId)?.role || null,
        source: "ParticipantAdded.role"
      }]
    : [];

  return {
    supportingEvidenceIds: unique([
      ...(request.supportingEvidenceIds || []),
      ...(decisionRecord?.supportingEvidenceIds || [])
    ]),
    supportingClaimIds: unique([
      ...(request.supportingClaimIds || []),
      ...(decisionRecord?.supportingClaimIds || [])
    ]),
    supportingAssumptionIds: unique([
      ...(request.supportingAssumptionIds || []),
      ...(decisionRecord?.supportingAssumptionIds || [])
    ]),
    objectionIds,
    reviewIds: unique([
      ...reviewIds,
      ...(decisionRecord?.reviewIds || [])
    ]),
    authorityTrail: decisionRecord?.authorityTrail || authorityTrail
  };
}

function latestReviewsByReviewer(reviews) {
  const latest = new Map();
  for (const review of reviews) {
    if (!review?.reviewerParticipantId) {
      continue;
    }
    const existing = latest.get(review.reviewerParticipantId);
    if (!existing || String(existing.reviewedAt || "").localeCompare(String(review.reviewedAt || "")) < 0) {
      latest.set(review.reviewerParticipantId, review);
    }
  }
  return Array.from(latest.values());
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

function applyObjectionResolution(state, event) {
  const objectionId = event.payload?.objectionId || event.payload?.objection?.id;
  const objection = state.objections.get(objectionId);
  if (!objection) {
    return;
  }
  state.objections.set(objectionId, {
    ...objection,
    status: "resolved",
    resolution: event.payload?.resolution || event.payload?.objection?.resolution
  });
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
  result.blockingObjections = unique(result.blockingObjections);
  result.nonBlockingObjections = unique(result.nonBlockingObjections);
  result.missingReviews = unique(result.missingReviews);
  result.requiredMinorityReports = unique(result.requiredMinorityReports);
  result.eligible = result.reasons.length === 0;
  return result;
}

function isApprovalReview(status) {
  return APPROVAL_REVIEW_STATUSES.has(String(status || "").toLowerCase());
}

function isRequestChangesReview(status) {
  return REQUEST_CHANGES_STATUSES.has(String(status || "").toLowerCase());
}

function isMergeableRequestStatus(status) {
  return MERGEABLE_REQUEST_STATUSES.has(String(status || "").toLowerCase());
}

function isBlockingObjection(objection) {
  return objection?.blocking !== false && (objection.status === "open" || objection.status === "preserved");
}

function isResolvedObjection(objection) {
  return objection?.status === "resolved";
}

function pushUnique(values, value) {
  if (value && !values.includes(value)) {
    values.push(value);
  }
}


module.exports = {
  buildGovernanceState,
  evaluateDecisionEligibility,
  isBlockingObjection,
  isDecisionOwnerRole
};
