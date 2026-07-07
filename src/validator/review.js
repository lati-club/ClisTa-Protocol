const {
  validateProtocolReview,
  validateReviewCompletion,
  validateReviewDispute,
  validateReviewViolation
} = require("../review");
const { normalizeType } = require("../utils");
const {
  addError,
  validateThreadObject
} = require("./shared");

function validateReviewRequiredEvent(event, state) {
  const review = event.payload.protocolReview;
  if (!review) {
    addError(state, event, "ReviewRequired payload missing protocolReview");
    return;
  }
  for (const reason of validateProtocolReview(review)) {
    addError(state, event, reason);
  }
  if (review.required !== true) {
    addError(state, event, "ReviewRequired requires protocolReview.required true");
  }
  if (review.status !== "required") {
    addError(state, event, "ReviewRequired protocolReview status must be required");
  }
  validateReviewThread(event, state, review, "required review");
  validateReviewParticipant(event, state, review.requiredByParticipantId, "required review");
  if (event.actor_id !== review.requiredByParticipantId) {
    addError(state, event, "required review actor_id must match requiredByParticipantId");
  }
  validateReviewSubject(event, state, review);
  validateReviewTriggerEvent(event, state, review);
  if (review.id && state.protocolReviews.has(review.id)) {
    addError(state, event, `duplicate protocol review ${review.id}`);
  }
  if (review.id) {
    state.protocolReviews.set(review.id, {
      ...review,
      status: "required"
    });
  }
}

function validateReviewOpenedEvent(event, state) {
  const review = event.payload.protocolReview;
  if (!review) {
    addError(state, event, "ReviewOpened payload missing protocolReview");
    return;
  }
  for (const reason of validateProtocolReview(review)) {
    addError(state, event, reason);
  }
  if (review.status !== "open") {
    addError(state, event, "ReviewOpened protocolReview status must be open");
  }
  validateReviewThread(event, state, review, "opened review");
  validateReviewParticipant(event, state, review.openedByParticipantId, "opened review");
  if (event.actor_id !== review.openedByParticipantId) {
    addError(state, event, "opened review actor_id must match openedByParticipantId");
  }
  validateReviewSubject(event, state, review);
  validateReviewTriggerEvent(event, state, review);
  if (review.requiredReviewId) {
    const required = state.protocolReviews.get(review.requiredReviewId);
    if (!required) {
      addError(state, event, `opened review references unknown required review ${review.requiredReviewId}`);
    } else {
      validateReviewMatchesRequired(event, state, review, required);
    }
  }
  if (review.id && state.protocolReviews.has(review.id) && review.id !== review.requiredReviewId) {
    addError(state, event, `duplicate protocol review ${review.id}`);
  }
  if (review.id) {
    const existing = state.protocolReviews.get(review.id);
    state.protocolReviews.set(review.id, {
      ...existing,
      ...review,
      required: existing?.required || review.required,
      requiredByParticipantId: existing?.requiredByParticipantId || review.requiredByParticipantId,
      requiredAt: existing?.requiredAt || review.requiredAt,
      status: "open"
    });
  }
}

function validateReviewCompletedEvent(event, state) {
  const completion = event.payload.protocolReviewCompletion;
  if (!completion) {
    addError(state, event, "ReviewCompleted payload missing protocolReviewCompletion");
    return;
  }
  for (const reason of validateReviewCompletion(completion)) {
    addError(state, event, reason);
  }
  validateReviewThread(event, state, completion, "review completion");
  validateReviewParticipant(event, state, completion.completedByParticipantId, "review completion");
  if (event.actor_id !== completion.completedByParticipantId) {
    addError(state, event, "review completion actor_id must match completedByParticipantId");
  }
  const review = completion.reviewId ? state.protocolReviews.get(completion.reviewId) : null;
  if (!review) {
    addError(state, event, `review completion references unknown review ${completion.reviewId}`);
  } else if (completion.threadId !== review.threadId) {
    addError(state, event, "review completion threadId must match review");
  }
  if (completion.id && state.protocolReviewCompletions.has(completion.id)) {
    addError(state, event, `duplicate protocol review completion ${completion.id}`);
  }
  if (completion.id) {
    state.protocolReviewCompletions.set(completion.id, completion);
  }
  if (review) {
    state.protocolReviews.set(review.id, {
      ...review,
      status: "reviewed",
      completedAt: completion.completedAt,
      completedByParticipantId: completion.completedByParticipantId
    });
  }
}

function validateReviewDisputedEvent(event, state) {
  const dispute = event.payload.protocolReviewDispute;
  if (!dispute) {
    addError(state, event, "ReviewDisputed payload missing protocolReviewDispute");
    return;
  }
  for (const reason of validateReviewDispute(dispute)) {
    addError(state, event, reason);
  }
  validateReviewThread(event, state, dispute, "review dispute");
  validateReviewParticipant(event, state, dispute.disputedByParticipantId, "review dispute");
  if (event.actor_id !== dispute.disputedByParticipantId) {
    addError(state, event, "review dispute actor_id must match disputedByParticipantId");
  }
  const review = dispute.reviewId ? state.protocolReviews.get(dispute.reviewId) : null;
  if (!review) {
    addError(state, event, `review dispute references unknown review ${dispute.reviewId}`);
  } else if (dispute.threadId !== review.threadId) {
    addError(state, event, "review dispute threadId must match review");
  }
  if (dispute.id && state.protocolReviewDisputes.has(dispute.id)) {
    addError(state, event, `duplicate protocol review dispute ${dispute.id}`);
  }
  if (dispute.id) {
    state.protocolReviewDisputes.set(dispute.id, dispute);
  }
}

function validateReviewViolationRecordedEvent(event, state) {
  const violation = event.payload.protocolReviewViolation;
  if (!violation) {
    addError(state, event, "ReviewViolationRecorded payload missing protocolReviewViolation");
    return;
  }
  for (const reason of validateReviewViolation(violation)) {
    addError(state, event, reason);
  }
  validateReviewThread(event, state, violation, "review violation");
  validateReviewParticipant(event, state, violation.detectedByParticipantId, "review violation");
  if (event.actor_id !== violation.detectedByParticipantId) {
    addError(state, event, "review violation actor_id must match detectedByParticipantId");
  }
  const review = violation.reviewId ? state.protocolReviews.get(violation.reviewId) : null;
  if (!review) {
    addError(state, event, `review violation references unknown review ${violation.reviewId}`);
  } else if (violation.threadId !== review.threadId) {
    addError(state, event, "review violation threadId must match review");
  }
  if (violation.id && state.protocolReviewViolations.has(violation.id)) {
    addError(state, event, `duplicate protocol review violation ${violation.id}`);
  }
  if (violation.id) {
    state.protocolReviewViolations.set(violation.id, violation);
  }
}

function validateReviewThread(event, state, object, label) {
  validateThreadObject(event, object, state, `protocol ${label}`);
}

function validateReviewParticipant(event, state, participantId, label) {
  if (!participantId) {
    addError(state, event, `protocol ${label} requires accountable participant`);
  } else if (!state.participants.has(participantId)) {
    addError(state, event, `protocol ${label} references unknown participant ${participantId}`);
  }
}

function validateReviewSubject(event, state, review) {
  const subjectType = normalizeType(review.subjectType || review.subjectRef?.type);
  const subjectId = review.subjectId || review.subjectRef?.id;
  if (!subjectType || !subjectId) {
    return;
  }
  const subject = reviewSubjectForType(state, subjectType, subjectId);
  if (!subject.supported) {
    addError(state, event, `unsupported review subjectType ${review.subjectType}`);
    return;
  }
  if (!subject.record) {
    addError(state, event, `review subject does not exist: ${subjectType}:${subjectId}`);
    return;
  }
  if (subject.record.threadId && review.threadId && subject.record.threadId !== review.threadId) {
    addError(state, event, "protocol review threadId must match review subject");
  }
  if (subject.record.id && review.subjectRef?.id && subject.record.id !== review.subjectRef.id) {
    addError(state, event, "protocol review subjectRef.id must match subjectId");
  }
}

function validateReviewTriggerEvent(event, state, review) {
  if (!review.triggerEventId) {
    return;
  }
  if (!state.processedEventsById.has(review.triggerEventId)) {
    addError(state, event, `review trigger event does not exist: ${review.triggerEventId}`);
  }
}

function validateReviewMatchesRequired(event, state, review, required) {
  if (review.subjectType !== required.subjectType || review.subjectId !== required.subjectId) {
    addError(state, event, "opened review subject must match required review");
  }
  if (review.threadId !== required.threadId) {
    addError(state, event, "opened review threadId must match required review");
  }
}

function reviewSubjectForType(state, subjectType, subjectId) {
  const normalized = normalizeType(subjectType);
  const collections = {
    thread: state.threads,
    evidence: state.evidence,
    assumption: state.assumptions,
    claim: state.claims,
    position: state.positions,
    objection: state.objections,
    decision_request: state.decisionRequests,
    decisionrequest: state.decisionRequests,
    decision_record: state.decisionRecords,
    decisionrecord: state.decisionRecords,
    decision_review: state.reviews,
    decisionreview: state.reviews,
    minority_report: mapArrayById(state.minorityReports),
    minorityreport: mapArrayById(state.minorityReports),
    merge_request: state.mergeRequests,
    mergerequest: state.mergeRequests,
    merge_review: state.mergeReviews,
    mergereview: state.mergeReviews,
    merge_conflict: state.mergeConflicts,
    mergeconflict: state.mergeConflicts,
    merge_conflict_resolution: state.mergeConflictResolutions,
    mergeconflictresolution: state.mergeConflictResolutions,
    merge_completion: state.mergeCompletions,
    mergecompletion: state.mergeCompletions,
    expected_outcome: state.expectedOutcomes,
    expectedoutcome: state.expectedOutcomes,
    outcome_audit: state.outcomeAudits,
    outcomeaudit: state.outcomeAudits,
    decision_score: state.decisionScores,
    decisionscore: state.decisionScores,
    delegation: state.delegationGrants,
    delegation_grant: state.delegationGrants,
    delegated_action: state.delegationActions,
    delegatedaction: state.delegationActions,
    delegation_violation: state.delegationViolations,
    delegationviolation: state.delegationViolations,
    execution: state.executionRecords,
    execution_record: state.executionRecords,
    execution_violation: state.executionViolations,
    executionviolation: state.executionViolations,
    outcome: state.outcomeExpectations,
    protocol_outcome: state.outcomeExpectations,
    outcome_dispute: state.outcomeDisputes,
    outcomedispute: state.outcomeDisputes,
    outcome_violation: state.outcomeViolations,
    outcomeviolation: state.outcomeViolations,
    outcome_learning_signal: state.outcomeLearningSignals,
    outcomelearningsignal: state.outcomeLearningSignals,
    outcome_lesson: state.outcomeLessons,
    outcomelesson: state.outcomeLessons,
    outcome_learning_dispute: state.outcomeLearningDisputes,
    outcomelearningdispute: state.outcomeLearningDisputes,
    outcome_learning_violation: state.outcomeLearningViolations,
    outcomelearningviolation: state.outcomeLearningViolations,
    protocol_review: state.protocolReviews,
    protocolreview: state.protocolReviews,
    review: state.protocolReviews,
    recovery: state.recoveryRequests,
    recovery_request: state.recoveryRequests,
    recoveryrequest: state.recoveryRequests,
    recovery_plan: state.recoveryPlans,
    recoveryplan: state.recoveryPlans,
    recovery_quarantine: state.recoveryQuarantines,
    recoveryquarantine: state.recoveryQuarantines,
    recovery_application: state.recoveryApplications,
    recoveryapplication: state.recoveryApplications,
    recovery_verification: state.recoveryVerifications,
    recoveryverification: state.recoveryVerifications,
    recovery_violation: state.recoveryViolations,
    recoveryviolation: state.recoveryViolations
  };
  const collection = collections[normalized];
  if (!collection) {
    return { supported: false, record: null };
  }
  return {
    supported: true,
    record: collection.get(subjectId) || null
  };
}

function mapArrayById(values) {
  return new Map((values || []).map((value) => [value.id, value]).filter(([id]) => id));
}

module.exports = {
  validateReviewCompletedEvent,
  validateReviewDisputedEvent,
  validateReviewOpenedEvent,
  validateReviewRequiredEvent,
  validateReviewViolationRecordedEvent
};
