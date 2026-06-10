const { PROTOCOL_VERSION, contentHash } = require("./integrity");
const { groupBy, indexBy, normalizeType, stripUndefined } = require("./utils");

const REVIEW_SCHEMA = "clista.review.v0";
const REVIEW_PROTOCOL_VERSION = "0.23.0";
const REVIEW_THEOREM = "protocol_review = route(state_change, through_required_review)";
const REVIEW_HARD_LAW = "review != approval";

const REVIEW_EVENT_TYPES = new Set([
  "ReviewRequired",
  "ReviewOpened",
  "ReviewCompleted",
  "ReviewDisputed",
  "ReviewViolationRecorded"
]);

const REVIEW_STATUSES = ["required", "open", "reviewed", "disputed", "violated"];
const REVIEW_COMPLETION_STATUS = "reviewed";

const REVIEW_TRIGGER_TYPES = new Set([
  "state_change",
  "manual_review",
  "protocol_violation",
  "dispute",
  "delegation_violation",
  "execution_violation",
  "execution_rollback",
  "outcome_violation",
  "outcome_dispute",
  "failed_outcome",
  "inconclusive_outcome",
  "outcome_learning_dispute",
  "outcome_learning_violation",
  "degraded_exchange",
  "degraded_compatibility",
  "degraded_interoperability",
  "degraded_negotiation",
  "recovery_request",
  "recovery_plan",
  "recovery_quarantine",
  "recovery_apply",
  "recovery_verify",
  "rollback"
]);

const GUARD_FIELDS = new Set([
  "approved",
  "approval",
  "approvalStatus",
  "approvedByParticipantId",
  "approvedAt",
  "reviewAsApproval",
  "governanceMutation",
  "authorityCreated",
  "authorityMutation",
  "consensusCreated",
  "amendmentApproval",
  "recoveryPerformed",
  "rollbackPerformed",
  "accountabilityScoreAssigned",
  "blameAssigned",
  "violationResolved",
  "outcomeMutation",
  "executionMutation",
  "delegationMutation",
  "learningMutation",
  "stateMutation"
]);

function emptyReviewState() {
  return {
    records: [],
    completions: [],
    disputes: [],
    violations: []
  };
}

function buildReviewState(projection = {}) {
  const state = emptyReviewState();
  applyExplicitReviewEvents(projection.events || [], state);
  return state;
}

function applyExplicitReviewEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "ReviewRequired":
        mergeReviewRecord(state, normalizeProtocolReview(payload.protocolReview, event, "required"));
        break;
      case "ReviewOpened":
        mergeReviewRecord(state, normalizeProtocolReview(payload.protocolReview, event, "open"));
        break;
      case "ReviewCompleted":
        addRecord(state.completions, normalizeReviewCompletion(payload.protocolReviewCompletion, event));
        break;
      case "ReviewDisputed":
        addRecord(state.disputes, normalizeReviewDispute(payload.protocolReviewDispute, event));
        break;
      case "ReviewViolationRecorded":
        addRecord(state.violations, normalizeReviewViolation(payload.protocolReviewViolation, event));
        break;
      default:
        break;
    }
  }
}

function projectReview(state = emptyReviewState()) {
  const records = state.records.filter(Boolean);
  const completions = state.completions.filter(Boolean);
  const disputes = state.disputes.filter(Boolean);
  const violations = state.violations.filter(Boolean);
  const completionsByReview = groupBy(completions, "reviewId");
  const disputesByReview = groupBy(disputes, "reviewId");
  const violationsByReview = groupBy(violations, "reviewId");
  const projectedRecords = records.map((record) => {
    const reviewCompletions = completionsByReview[record.id] || [];
    const reviewDisputes = disputesByReview[record.id] || [];
    const reviewViolations = violationsByReview[record.id] || [];
    const latestCompletion = reviewCompletions.at(-1);
    const status = reviewViolations.length
      ? "violated"
      : reviewDisputes.length
        ? "disputed"
        : latestCompletion
          ? "reviewed"
          : record.status;
    return stripUndefined({
      ...record,
      status,
      completedAt: latestCompletion?.completedAt || record.completedAt,
      completedByParticipantId: latestCompletion?.completedByParticipantId || record.completedByParticipantId,
      completionSummary: latestCompletion?.summary || record.completionSummary,
      completions: reviewCompletions,
      disputes: reviewDisputes,
      violations: reviewViolations
    });
  });
  const completedIds = new Set(completions.map((completion) => completion.reviewId));
  const required = projectedRecords.filter((record) => record.required === true && !completedIds.has(record.id));
  const open = projectedRecords.filter((record) => record.status === "open");
  const completed = projectedRecords.filter((record) => record.status === "reviewed");
  const disputed = projectedRecords.filter((record) => record.status === "disputed");
  const violated = projectedRecords.filter((record) => record.status === "violated");

  return {
    schema: REVIEW_SCHEMA,
    theorem: REVIEW_THEOREM,
    hardLaw: REVIEW_HARD_LAW,
    reviewProtocolVersion: REVIEW_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    statuses: REVIEW_STATUSES,
    triggerTypes: Array.from(REVIEW_TRIGGER_TYPES),
    records: projectedRecords,
    required,
    open,
    completed,
    disputed,
    violated,
    completions,
    disputes,
    violations,
    byReview: indexBy(projectedRecords, "id"),
    bySubject: groupBy(projectedRecords, "subjectKey"),
    completionsByReview,
    disputesByReview,
    violationsByReview,
    reviewValidationStatus: {
      valid: true,
      recordCount: projectedRecords.length,
      requiredCount: required.length,
      openCount: open.length,
      completedCount: completed.length,
      disputeCount: disputes.length,
      violationCount: violations.length,
      pendingRequiredCount: required.length,
      reviewAsApproval: false,
      governanceMutation: false,
      authorityCreated: false,
      consensusCreated: false,
      amendmentApproval: false,
      recoveryPerformed: false,
      rollbackPerformed: false,
      accountabilityScoreAssigned: false,
      blameAssigned: false,
      stateMutation: false
    }
  };
}

function buildReviewRequirement(options = {}) {
  return buildProtocolReview({
    ...options,
    required: true,
    status: "required",
    requiredByParticipantId: options.requiredByParticipantId || options.actorId,
    requiredAt: options.requiredAt
  });
}

function buildReviewOpening(options = {}) {
  return buildProtocolReview({
    ...options,
    required: options.required === undefined ? false : Boolean(options.required),
    status: "open",
    openedByParticipantId: options.openedByParticipantId || options.actorId,
    openedAt: options.openedAt
  });
}

function buildProtocolReview(options = {}) {
  const subjectType = normalizeType(options.subjectType || options.objectType || "state_change");
  const subjectId = options.subjectId || options.subject || null;
  const triggerType = normalizeType(options.triggerType || options.trigger || "state_change");
  const review = stripUndefined({
    id: options.id || deterministicId("prv", "protocol_review", {
      subjectType,
      subjectId,
      triggerType,
      reason: options.reason
    }),
    object: "protocolReview",
    threadId: options.threadId || null,
    subjectType,
    subjectId,
    subjectRef: {
      type: subjectType,
      id: subjectId
    },
    subjectKey: subjectKey(subjectType, subjectId),
    triggerType,
    triggerEventId: options.triggerEventId || null,
    reason: normalizeString(options.reason),
    required: Boolean(options.required),
    status: normalizeStatus(options.status || (options.required ? "required" : "open")),
    requiredReviewerRole: normalizeString(options.requiredReviewerRole || options.reviewerRole),
    reviewerParticipantId: options.reviewerParticipantId || null,
    requiredReviewId: options.requiredReviewId || null,
    requiredByParticipantId: options.requiredByParticipantId || null,
    openedByParticipantId: options.openedByParticipantId || null,
    requiredAt: options.requiredAt || null,
    openedAt: options.openedAt || null,
    reviewAsApproval: false,
    governanceMutation: false,
    authorityCreated: false,
    authorityMutation: false,
    consensusCreated: false,
    amendmentApproval: false,
    recoveryPerformed: false,
    rollbackPerformed: false,
    accountabilityScoreAssigned: false,
    blameAssigned: false,
    violationResolved: false,
    outcomeMutation: false,
    executionMutation: false,
    delegationMutation: false,
    learningMutation: false,
    stateMutation: false
  });
  review.reviewHash = reviewHash(review);
  return review;
}

function buildReviewCompletion(options = {}) {
  const completion = stripUndefined({
    id: options.id || deterministicId("prc", "protocol_review_completion", {
      reviewId: options.reviewId || options.review,
      summary: options.summary
    }),
    object: "protocolReviewCompletion",
    reviewId: options.reviewId || options.review || null,
    threadId: options.threadId || null,
    completionStatus: REVIEW_COMPLETION_STATUS,
    summary: normalizeString(options.summary),
    completedByParticipantId: options.completedByParticipantId || options.actorId || null,
    completedAt: options.completedAt || null,
    reviewAsApproval: false,
    governanceMutation: false,
    authorityCreated: false,
    authorityMutation: false,
    consensusCreated: false,
    amendmentApproval: false,
    recoveryPerformed: false,
    rollbackPerformed: false,
    accountabilityScoreAssigned: false,
    blameAssigned: false,
    violationResolved: false,
    outcomeMutation: false,
    executionMutation: false,
    delegationMutation: false,
    learningMutation: false,
    stateMutation: false
  });
  completion.reviewHash = reviewHash(completion);
  return completion;
}

function buildReviewDispute(options = {}) {
  const dispute = stripUndefined({
    id: options.id || deterministicId("prd", "protocol_review_dispute", {
      reviewId: options.reviewId || options.review,
      reason: options.reason
    }),
    object: "protocolReviewDispute",
    reviewId: options.reviewId || options.review || null,
    threadId: options.threadId || null,
    reason: normalizeString(options.reason),
    disputedByParticipantId: options.disputedByParticipantId || options.actorId || null,
    disputedAt: options.disputedAt || null,
    reviewAsApproval: false,
    governanceMutation: false,
    authorityCreated: false,
    consensusCreated: false,
    amendmentApproval: false,
    stateMutation: false
  });
  dispute.reviewHash = reviewHash(dispute);
  return dispute;
}

function buildReviewViolation(options = {}) {
  const violation = stripUndefined({
    id: options.id || deterministicId("prv", "protocol_review_violation", {
      reviewId: options.reviewId || options.review,
      violationType: options.violationType || options.type
    }),
    object: "protocolReviewViolation",
    reviewId: options.reviewId || options.review || null,
    threadId: options.threadId || null,
    violationType: normalizeType(options.violationType || options.type),
    reason: normalizeString(options.reason),
    detectedByParticipantId: options.detectedByParticipantId || options.actorId || null,
    detectedAt: options.detectedAt || null,
    reviewAsApproval: false,
    governanceMutation: false,
    authorityCreated: false,
    consensusCreated: false,
    amendmentApproval: false,
    stateMutation: false
  });
  violation.reviewHash = reviewHash(violation);
  return violation;
}

function reviewForId(reviewProjection, reviewId) {
  return {
    schema: "clista.review.item.v0",
    reviewId,
    review: reviewProjection.byReview[reviewId] || null,
    completions: reviewProjection.completionsByReview[reviewId] || [],
    disputes: reviewProjection.disputesByReview[reviewId] || [],
    violations: reviewProjection.violationsByReview[reviewId] || []
  };
}

function selectReviewForThread(reviewProjection, threadId) {
  const records = reviewProjection.records.filter((record) => record.threadId === threadId);
  const recordIds = new Set(records.map((record) => record.id));
  const byThreadOrReview = (record) => record.threadId === threadId || recordIds.has(record.reviewId);
  return {
    schema: "clista.review.thread.v0",
    threadId,
    theorem: reviewProjection.theorem,
    hardLaw: reviewProjection.hardLaw,
    records,
    required: records.filter((record) => record.required === true && !(record.completions || []).length),
    open: records.filter((record) => record.status === "open"),
    completed: records.filter((record) => record.status === "reviewed"),
    disputed: records.filter((record) => record.status === "disputed"),
    violated: records.filter((record) => record.status === "violated"),
    completions: reviewProjection.completions.filter(byThreadOrReview),
    disputes: reviewProjection.disputes.filter(byThreadOrReview),
    violations: reviewProjection.violations.filter(byThreadOrReview)
  };
}

function validateProtocolReview(review) {
  const reasons = [];
  if (!review?.id) {
    reasons.push("protocol review requires id");
  }
  if (review?.object && review.object !== "protocolReview") {
    reasons.push("protocol review object must be protocolReview");
  }
  if (!review?.threadId) {
    reasons.push("protocol review requires threadId");
  }
  if (!normalizeType(review?.subjectType)) {
    reasons.push("protocol review requires subjectType");
  }
  if (!review?.subjectId) {
    reasons.push("protocol review requires subjectId");
  }
  const triggerType = normalizeType(review?.triggerType);
  if (!triggerType) {
    reasons.push("protocol review requires triggerType");
  } else if (!REVIEW_TRIGGER_TYPES.has(triggerType)) {
    reasons.push(`protocol review unsupported triggerType ${review.triggerType}`);
  }
  if (!normalizeString(review?.reason)) {
    reasons.push("protocol review requires reason");
  }
  const status = normalizeStatus(review?.status);
  if (!REVIEW_STATUSES.includes(status) || ["reviewed", "disputed", "violated"].includes(status)) {
    reasons.push("protocol review status must be required or open before completion");
  }
  if (review?.required === true && !review.requiredReviewerRole) {
    reasons.push("required protocol review requires requiredReviewerRole");
  }
  if (review?.required === true && !review.requiredByParticipantId) {
    reasons.push("required protocol review requires requiredByParticipantId");
  }
  if (status === "open" && !review.openedByParticipantId) {
    reasons.push("opened protocol review requires openedByParticipantId");
  }
  reasons.push(...rejectReviewGuardFields(review));
  return reasons;
}

function validateReviewCompletion(completion) {
  const reasons = [];
  if (!completion?.id) {
    reasons.push("protocol review completion requires id");
  }
  if (completion?.object && completion.object !== "protocolReviewCompletion") {
    reasons.push("protocol review completion object must be protocolReviewCompletion");
  }
  if (!completion?.reviewId) {
    reasons.push("protocol review completion requires reviewId");
  }
  if (!completion?.threadId) {
    reasons.push("protocol review completion requires threadId");
  }
  if (completion?.completionStatus !== REVIEW_COMPLETION_STATUS) {
    reasons.push("protocol review completion status must be reviewed");
  }
  if (!normalizeString(completion?.summary)) {
    reasons.push("protocol review completion requires summary");
  }
  if (!completion?.completedByParticipantId) {
    reasons.push("protocol review completion requires completedByParticipantId");
  }
  reasons.push(...rejectReviewGuardFields(completion));
  return reasons;
}

function validateReviewDispute(dispute) {
  const reasons = [];
  if (!dispute?.id) {
    reasons.push("protocol review dispute requires id");
  }
  if (dispute?.object && dispute.object !== "protocolReviewDispute") {
    reasons.push("protocol review dispute object must be protocolReviewDispute");
  }
  if (!dispute?.reviewId) {
    reasons.push("protocol review dispute requires reviewId");
  }
  if (!dispute?.threadId) {
    reasons.push("protocol review dispute requires threadId");
  }
  if (!normalizeString(dispute?.reason)) {
    reasons.push("protocol review dispute requires reason");
  }
  if (!dispute?.disputedByParticipantId) {
    reasons.push("protocol review dispute requires disputedByParticipantId");
  }
  reasons.push(...rejectReviewGuardFields(dispute));
  return reasons;
}

function validateReviewViolation(violation) {
  const reasons = [];
  if (!violation?.id) {
    reasons.push("protocol review violation requires id");
  }
  if (violation?.object && violation.object !== "protocolReviewViolation") {
    reasons.push("protocol review violation object must be protocolReviewViolation");
  }
  if (!violation?.reviewId) {
    reasons.push("protocol review violation requires reviewId");
  }
  if (!violation?.threadId) {
    reasons.push("protocol review violation requires threadId");
  }
  if (!normalizeType(violation?.violationType)) {
    reasons.push("protocol review violation requires violationType");
  }
  if (!normalizeString(violation?.reason)) {
    reasons.push("protocol review violation requires reason");
  }
  if (!violation?.detectedByParticipantId) {
    reasons.push("protocol review violation requires detectedByParticipantId");
  }
  reasons.push(...rejectReviewGuardFields(violation));
  return reasons;
}

function normalizeProtocolReview(review, event, defaultStatus) {
  if (!review) {
    return null;
  }
  const subjectType = normalizeType(review.subjectType || review.subjectRef?.type);
  const subjectId = review.subjectId || review.subjectRef?.id;
  const normalized = stripUndefined({
    ...review,
    id: review.id || deterministicId("prv", "protocol_review", event.event_id),
    object: "protocolReview",
    threadId: review.threadId || event.thread_id,
    subjectType,
    subjectId,
    subjectRef: {
      type: subjectType,
      id: subjectId
    },
    subjectKey: subjectKey(subjectType, subjectId),
    triggerType: normalizeType(review.triggerType || review.trigger || "state_change"),
    reason: normalizeString(review.reason),
    required: Boolean(review.required),
    status: normalizeStatus(review.status || defaultStatus),
    requiredReviewerRole: normalizeString(review.requiredReviewerRole || review.reviewerRole),
    requiredReviewId: review.requiredReviewId || null,
    requiredByParticipantId: review.requiredByParticipantId || (review.required ? event.actor_id : null),
    openedByParticipantId: review.openedByParticipantId || (defaultStatus === "open" ? event.actor_id : null),
    requiredAt: review.requiredAt || (review.required ? event.timestamp : null),
    openedAt: review.openedAt || (defaultStatus === "open" ? event.timestamp : null),
    sourceEventId: event.event_id,
    reviewAsApproval: false,
    governanceMutation: false,
    authorityCreated: false,
    authorityMutation: false,
    consensusCreated: false,
    amendmentApproval: false,
    recoveryPerformed: false,
    rollbackPerformed: false,
    accountabilityScoreAssigned: false,
    blameAssigned: false,
    violationResolved: false,
    outcomeMutation: false,
    executionMutation: false,
    delegationMutation: false,
    learningMutation: false,
    stateMutation: false
  });
  normalized.reviewHash = reviewHash(normalized);
  return normalized;
}

function normalizeReviewCompletion(completion, event) {
  if (!completion) {
    return null;
  }
  const normalized = stripUndefined({
    ...completion,
    id: completion.id || deterministicId("prc", "protocol_review_completion", event.event_id),
    object: "protocolReviewCompletion",
    threadId: completion.threadId || event.thread_id,
    completionStatus: REVIEW_COMPLETION_STATUS,
    summary: normalizeString(completion.summary),
    completedByParticipantId: completion.completedByParticipantId || event.actor_id,
    completedAt: completion.completedAt || event.timestamp,
    sourceEventId: event.event_id,
    reviewAsApproval: false,
    governanceMutation: false,
    authorityCreated: false,
    authorityMutation: false,
    consensusCreated: false,
    amendmentApproval: false,
    recoveryPerformed: false,
    rollbackPerformed: false,
    accountabilityScoreAssigned: false,
    blameAssigned: false,
    violationResolved: false,
    outcomeMutation: false,
    executionMutation: false,
    delegationMutation: false,
    learningMutation: false,
    stateMutation: false
  });
  normalized.reviewHash = reviewHash(normalized);
  return normalized;
}

function normalizeReviewDispute(dispute, event) {
  if (!dispute) {
    return null;
  }
  const normalized = stripUndefined({
    ...dispute,
    id: dispute.id || deterministicId("prd", "protocol_review_dispute", event.event_id),
    object: "protocolReviewDispute",
    threadId: dispute.threadId || event.thread_id,
    reason: normalizeString(dispute.reason),
    disputedByParticipantId: dispute.disputedByParticipantId || event.actor_id,
    disputedAt: dispute.disputedAt || event.timestamp,
    sourceEventId: event.event_id,
    reviewAsApproval: false,
    governanceMutation: false,
    authorityCreated: false,
    consensusCreated: false,
    amendmentApproval: false,
    stateMutation: false
  });
  normalized.reviewHash = reviewHash(normalized);
  return normalized;
}

function normalizeReviewViolation(violation, event) {
  if (!violation) {
    return null;
  }
  const normalized = stripUndefined({
    ...violation,
    id: violation.id || deterministicId("prv", "protocol_review_violation", event.event_id),
    object: "protocolReviewViolation",
    threadId: violation.threadId || event.thread_id,
    violationType: normalizeType(violation.violationType || violation.type),
    reason: normalizeString(violation.reason),
    detectedByParticipantId: violation.detectedByParticipantId || event.actor_id,
    detectedAt: violation.detectedAt || event.timestamp,
    sourceEventId: event.event_id,
    reviewAsApproval: false,
    governanceMutation: false,
    authorityCreated: false,
    consensusCreated: false,
    amendmentApproval: false,
    stateMutation: false
  });
  normalized.reviewHash = reviewHash(normalized);
  return normalized;
}

function rejectReviewGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child !== false && child !== undefined && child !== null) {
        reasons.push(`protocol review field ${fullPath.join(".")} must be false or absent`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectReviewGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function mergeReviewRecord(state, record) {
  if (!record) {
    return;
  }
  const existingIndex = state.records.findIndex((item) => item.id === record.id);
  if (existingIndex === -1) {
    state.records.push(record);
    return;
  }
  state.records[existingIndex] = stripUndefined({
    ...state.records[existingIndex],
    ...record,
    required: state.records[existingIndex].required || record.required,
    requiredByParticipantId: state.records[existingIndex].requiredByParticipantId || record.requiredByParticipantId,
    requiredAt: state.records[existingIndex].requiredAt || record.requiredAt
  });
}

function addRecord(records, record) {
  if (record) {
    records.push(record);
  }
}

function reviewHash(record) {
  return contentHash({
    id: record.id,
    object: record.object,
    threadId: record.threadId,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    triggerType: record.triggerType,
    reviewId: record.reviewId,
    status: record.status,
    completionStatus: record.completionStatus,
    reason: record.reason,
    summary: record.summary,
    violationType: record.violationType,
    reviewAsApproval: false,
    governanceMutation: false,
    authorityCreated: false,
    consensusCreated: false,
    amendmentApproval: false,
    stateMutation: false
  });
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizeType(type).slice(0, 24) || "review"}_${hash}`;
}

function normalizeStatus(status) {
  return normalizeType(status || "open");
}


function normalizeString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function subjectKey(subjectType, subjectId) {
  return `${normalizeType(subjectType)}:${subjectId || ""}`;
}




module.exports = {
  REVIEW_EVENT_TYPES,
  REVIEW_HARD_LAW,
  REVIEW_PROTOCOL_VERSION,
  REVIEW_SCHEMA,
  REVIEW_STATUSES,
  REVIEW_THEOREM,
  REVIEW_TRIGGER_TYPES,
  buildReviewCompletion,
  buildReviewDispute,
  buildReviewOpening,
  buildReviewRequirement,
  buildReviewState,
  buildReviewViolation,
  projectReview,
  reviewForId,
  selectReviewForThread,
  validateProtocolReview,
  validateReviewCompletion,
  validateReviewDispute,
  validateReviewViolation
};
