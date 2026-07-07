const {
  RECOVERY_SUBJECT_TYPES,
  checkpointHash,
  recoveryLogHash,
  restoredProjectionHash,
  restoredStateHash,
  subjectRequiresArtifactEvidence,
  validateRecoveryApplication,
  validateRecoveryPlan,
  validateRecoveryQuarantine,
  validateRecoveryRequest,
  validateRecoveryVerification,
  validateRecoveryViolation
} = require("../recovery");
const { normalizeType } = require("../utils");
const {
  addError,
  arrayValues,
  validateThreadObject
} = require("./shared");

function validateRecoveryRequestedEvent(event, state) {
  const request = event.payload.recoveryRequest;
  if (!request) {
    addError(state, event, "RecoveryRequested payload missing recoveryRequest");
    return;
  }
  for (const reason of validateRecoveryRequest(request)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, request, "request");
  validateRecoveryParticipant(event, state, request.requestedByParticipantId, "request");
  if (event.actor_id !== request.requestedByParticipantId) {
    addError(state, event, "recovery request actor_id must match requestedByParticipantId");
  }
  validateRecoverySubject(event, state, request, "request");
  if (request.id && state.recoveryRequests.has(request.id)) {
    addError(state, event, `duplicate recovery request ${request.id}`);
  }
  if (request.checkpointRef && request.checkpointHash && request.checkpointHash !== checkpointHash(request.checkpointRef)) {
    addError(state, event, "recovery request checkpointHash does not match checkpointRef");
  }
  if (request.id) {
    state.recoveryRequests.set(request.id, {
      ...request,
      status: "requested",
      checkpointHash: request.checkpointHash || checkpointHash(request.checkpointRef)
    });
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryPlanCreatedEvent(event, state) {
  const plan = event.payload.recoveryPlan;
  if (!plan) {
    addError(state, event, "RecoveryPlanCreated payload missing recoveryPlan");
    return;
  }
  for (const reason of validateRecoveryPlan(plan)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, plan, "plan");
  validateRecoveryParticipant(event, state, plan.plannedByParticipantId, "plan");
  if (event.actor_id !== plan.plannedByParticipantId) {
    addError(state, event, "recovery plan actor_id must match plannedByParticipantId");
  }
  const request = plan.recoveryId ? state.recoveryRequests.get(plan.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery plan references unknown recovery request ${plan.recoveryId}`);
  } else if (plan.threadId !== request.threadId) {
    addError(state, event, "recovery plan threadId must match recovery request");
  }
  const review = validateRecoveryReviewReference(event, state, plan.reviewId, "recovery plan", {
    requireCompleted: false,
    requirePendingOrCompleted: true
  });
  if (review && request) {
    validateRecoveryReviewMatchesRequest(event, state, review, request);
  }
  if (plan.id && state.recoveryPlans.has(plan.id)) {
    addError(state, event, `duplicate recovery plan ${plan.id}`);
  }
  if (plan.id) {
    state.recoveryPlans.set(plan.id, plan);
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryQuarantinedEvent(event, state) {
  const quarantine = event.payload.recoveryQuarantine;
  if (!quarantine) {
    addError(state, event, "RecoveryQuarantined payload missing recoveryQuarantine");
    return;
  }
  for (const reason of validateRecoveryQuarantine(quarantine)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, quarantine, "quarantine");
  validateRecoveryParticipant(event, state, quarantine.quarantinedByParticipantId, "quarantine");
  if (event.actor_id !== quarantine.quarantinedByParticipantId) {
    addError(state, event, "recovery quarantine actor_id must match quarantinedByParticipantId");
  }
  const request = quarantine.recoveryId ? state.recoveryRequests.get(quarantine.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery quarantine references unknown recovery request ${quarantine.recoveryId}`);
  } else {
    if (quarantine.threadId !== request.threadId) {
      addError(state, event, "recovery quarantine threadId must match recovery request");
    }
    validateRecoverySubjectMatchesRequest(event, state, quarantine, request, "quarantine");
  }
  const plan = quarantine.planId ? state.recoveryPlans.get(quarantine.planId) : null;
  if (!plan) {
    addError(state, event, `recovery quarantine references unknown recovery plan ${quarantine.planId}`);
  } else if (plan.recoveryId !== quarantine.recoveryId) {
    addError(state, event, "recovery quarantine planId must belong to recovery request");
  }
  validateRecoverySubject(event, state, quarantine, "quarantine");
  const review = validateRecoveryReviewReference(event, state, quarantine.reviewId, "recovery quarantine", {
    requireCompleted: quarantine.emergency !== true,
    requirePending: quarantine.emergency === true
  });
  if (review && request) {
    validateRecoveryReviewMatchesRequest(event, state, review, request);
  }
  if (quarantine.id && state.recoveryQuarantines.has(quarantine.id)) {
    addError(state, event, `duplicate recovery quarantine ${quarantine.id}`);
  }
  if (quarantine.id) {
    state.recoveryQuarantines.set(quarantine.id, {
      ...quarantine,
      status: quarantine.emergency === true ? "emergency_quarantined" : "quarantined",
      visible: true,
      trusted: false
    });
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryAppliedEvent(event, state) {
  const application = event.payload.recoveryApplication;
  if (!application) {
    addError(state, event, "RecoveryApplied payload missing recoveryApplication");
    return;
  }
  for (const reason of validateRecoveryApplication(application)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, application, "application");
  validateRecoveryParticipant(event, state, application.appliedByParticipantId, "application");
  if (event.actor_id !== application.appliedByParticipantId) {
    addError(state, event, "recovery application actor_id must match appliedByParticipantId");
  }
  const request = application.recoveryId ? state.recoveryRequests.get(application.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery application references unknown recovery request ${application.recoveryId}`);
  } else if (application.threadId !== request.threadId) {
    addError(state, event, "recovery application threadId must match recovery request");
  }
  const plan = application.planId ? state.recoveryPlans.get(application.planId) : null;
  if (!plan) {
    addError(state, event, `recovery application references unknown recovery plan ${application.planId}`);
  } else if (plan.recoveryId !== application.recoveryId) {
    addError(state, event, "recovery application planId must belong to recovery request");
  }
  const review = validateRecoveryReviewReference(event, state, application.reviewId, "recovery application", {
    requireCompleted: true
  });
  if (review && request) {
    validateRecoveryReviewMatchesRequest(event, state, review, request);
  }
  if (application.id && state.recoveryApplications.has(application.id)) {
    addError(state, event, `duplicate recovery application ${application.id}`);
  }
  if (application.id) {
    state.recoveryApplications.set(application.id, application);
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryVerifiedEvent(event, state) {
  const verification = event.payload.recoveryVerification;
  if (!verification) {
    addError(state, event, "RecoveryVerified payload missing recoveryVerification");
    return;
  }
  for (const reason of validateRecoveryVerification(verification)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, verification, "verification");
  validateRecoveryParticipant(event, state, verification.verifiedByParticipantId, "verification");
  if (event.actor_id !== verification.verifiedByParticipantId) {
    addError(state, event, "recovery verification actor_id must match verifiedByParticipantId");
  }
  const request = verification.recoveryId ? state.recoveryRequests.get(verification.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery verification references unknown recovery request ${verification.recoveryId}`);
  } else {
    if (verification.threadId !== request.threadId) {
      addError(state, event, "recovery verification threadId must match recovery request");
    }
    const expectedCheckpointHash = request.checkpointHash || checkpointHash(request.checkpointRef);
    if (verification.checkpointHash !== expectedCheckpointHash) {
      addError(state, event, "recovery verification checkpointHash does not match recovery checkpoint");
    }
  }
  const application = verification.applicationId ? state.recoveryApplications.get(verification.applicationId) : null;
  if (!application) {
    addError(state, event, `recovery verification references unknown application ${verification.applicationId}`);
  } else if (application.recoveryId !== verification.recoveryId) {
    addError(state, event, "recovery verification applicationId must belong to recovery request");
  }
  validateRecoveryReviewReference(event, state, verification.reviewId, "recovery verification", {
    requireCompleted: true
  });
  const expectedRecoveryLogHash = recoveryLogHash(state.recoveryEvents);
  if (verification.recoveryLogHash !== expectedRecoveryLogHash) {
    addError(state, event, "recovery verification recoveryLogHash does not match recovery log");
  }
  if (event.previous_hash && verification.originalHeadHash !== event.previous_hash) {
    addError(state, event, "recovery verification originalHeadHash must match event previous_hash");
  }
  if (event.previous_hash && verification.recoveryEventPreviousHash && verification.recoveryEventPreviousHash !== event.previous_hash) {
    addError(state, event, "recovery verification recoveryEventPreviousHash must match event previous_hash");
  }
  if (verification.restoredStateHash !== restoredStateHash(verification.recoveryId, state)) {
    addError(state, event, "recovery verification restoredStateHash does not match recomputed restored state");
  }
  if (verification.restoredProjectionHash !== restoredProjectionHash(verification.recoveryId, state)) {
    addError(state, event, "recovery verification restoredProjectionHash does not match recomputed restored projection");
  }
  if (verification.id && state.recoveryVerifications.has(verification.id)) {
    addError(state, event, `duplicate recovery verification ${verification.id}`);
  }
  if (verification.id) {
    state.recoveryVerifications.set(verification.id, verification);
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryViolationRecordedEvent(event, state) {
  const violation = event.payload.recoveryViolation;
  if (!violation) {
    addError(state, event, "RecoveryViolationRecorded payload missing recoveryViolation");
    return;
  }
  for (const reason of validateRecoveryViolation(violation)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, violation, "violation");
  validateRecoveryParticipant(event, state, violation.detectedByParticipantId, "violation");
  if (event.actor_id !== violation.detectedByParticipantId) {
    addError(state, event, "recovery violation actor_id must match detectedByParticipantId");
  }
  const request = violation.recoveryId ? state.recoveryRequests.get(violation.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery violation references unknown recovery request ${violation.recoveryId}`);
  } else if (violation.threadId !== request.threadId) {
    addError(state, event, "recovery violation threadId must match recovery request");
  }
  if (violation.id && state.recoveryViolations.has(violation.id)) {
    addError(state, event, `duplicate recovery violation ${violation.id}`);
  }
  if (violation.id) {
    state.recoveryViolations.set(violation.id, violation);
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryThread(event, state, object, label) {
  validateThreadObject(event, object, state, `recovery ${label}`);
}

function validateRecoveryParticipant(event, state, participantId, label) {
  if (!participantId) {
    addError(state, event, `recovery ${label} requires accountable participant`);
  } else if (!state.participants.has(participantId)) {
    addError(state, event, `recovery ${label} references unknown participant ${participantId}`);
  }
}

function validateRecoverySubject(event, state, record, label) {
  const subjectType = normalizeType(record.subjectType || record.subjectRef?.type);
  const subjectId = record.subjectId || record.subjectRef?.id;
  if (!subjectType || !subjectId || !RECOVERY_SUBJECT_TYPES.has(subjectType)) {
    return;
  }
  if (subjectRequiresArtifactEvidence(subjectType)) {
    const artifactHash = record.artifactHash
      || record.artifact_hash
      || record.artifactRef?.hash
      || record.artifact_ref?.hash
      || state.recoveryRequests.get(record.recoveryId)?.artifactHash
      || state.recoveryRequests.get(record.recoveryId)?.artifactRef?.hash;
    const evidence = [
      ...arrayValues(record.evidence),
      ...arrayValues(record.artifactRef?.evidence || record.artifact_ref?.evidence),
      ...arrayValues(state.recoveryRequests.get(record.recoveryId)?.evidence),
      ...arrayValues(state.recoveryRequests.get(record.recoveryId)?.artifactRef?.evidence)
    ];
    if (!artifactHash) {
      addError(state, event, `recovery ${label} external subject requires artifact hash`);
    }
    if (!evidence.length) {
      addError(state, event, `recovery ${label} external subject requires evidence`);
    }
    return;
  }

  const subject = recoverySubjectForType(state, subjectType, subjectId);
  if (!subject.supported) {
    addError(state, event, `unsupported recovery subjectType ${record.subjectType}`);
    return;
  }
  if (!subject.record) {
    addError(state, event, `recovery subject does not exist: ${subjectType}:${subjectId}`);
    return;
  }
  if (subject.record.threadId && record.threadId && subject.record.threadId !== record.threadId) {
    addError(state, event, `recovery ${label} threadId must match recovery subject`);
  }
}

function validateRecoverySubjectMatchesRequest(event, state, record, request, label) {
  const recordType = normalizeType(record.subjectType || record.subjectRef?.type);
  const requestType = normalizeType(request.subjectType || request.subjectRef?.type);
  const recordId = record.subjectId || record.subjectRef?.id;
  const requestId = request.subjectId || request.subjectRef?.id;
  if (recordType !== requestType || recordId !== requestId) {
    addError(state, event, `recovery ${label} subject must match recovery request`);
  }
}

function validateRecoveryReviewReference(event, state, reviewId, label, options = {}) {
  const review = reviewId ? state.protocolReviews.get(reviewId) : null;
  if (!review) {
    addError(state, event, `${label} references unknown review ${reviewId}`);
    return null;
  }
  if (options.requireCompleted && review.status !== "reviewed") {
    addError(state, event, `${label} requires completed M23 review ${reviewId}`);
  }
  if (options.requirePending && !["required", "open"].includes(review.status)) {
    addError(state, event, `${label} emergency quarantine requires pending M23 review ${reviewId}`);
  }
  if (options.requirePendingOrCompleted && !["required", "open", "reviewed"].includes(review.status)) {
    addError(state, event, `${label} requires required, open, or completed M23 review ${reviewId}`);
  }
  return review;
}

function validateRecoveryReviewMatchesRequest(event, state, review, request) {
  const subjectType = normalizeType(review.subjectType || review.subjectRef?.type);
  const subjectId = review.subjectId || review.subjectRef?.id;
  if (!["recovery", "recovery_request"].includes(subjectType) || subjectId !== request.id) {
    addError(state, event, "recovery review must reference the recovery request");
  }
  if (review.threadId !== request.threadId) {
    addError(state, event, "recovery review threadId must match recovery request");
  }
}

function recoverySubjectForType(state, subjectType, subjectId) {
  const normalized = normalizeType(subjectType);
  const collections = {
    invalid_event: state.processedEventsById,
    event_hash_mismatch: state.processedEventsById,
    hash_chain_mismatch: state.processedEventsById,
    bad_execution_rollback: state.executionRollbacks,
    bad_outcome_chain: state.outcomeExpectations,
    bad_outcome_learning_chain: state.outcomeLearningSignals
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

module.exports = {
  validateRecoveryAppliedEvent,
  validateRecoveryPlanCreatedEvent,
  validateRecoveryQuarantinedEvent,
  validateRecoveryRequestedEvent,
  validateRecoveryVerifiedEvent,
  validateRecoveryViolationRecordedEvent
};
