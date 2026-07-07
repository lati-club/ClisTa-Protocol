const {
  validateOutcomeDispute,
  validateOutcomeEvaluation,
  validateOutcomeExpectation,
  validateOutcomeObservation,
  validateOutcomeViolation
} = require("../outcome");
const {
  validateOutcomeLearningDispute,
  validateOutcomeLearningSignal,
  validateOutcomeLearningViolation,
  validateOutcomeLesson
} = require("../outcome-learning");
const { normalizeType } = require("../utils");
const {
  addError,
  validateIdsExist,
  validateThreadObject
} = require("./shared");

function validateOutcomeExpectedEvent(event, state) {
  const record = event.payload.outcomeRecord;
  if (!record) {
    addError(state, event, "OutcomeExpected payload missing outcomeRecord");
    return;
  }
  for (const reason of validateOutcomeExpectation(record)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, record, state, "outcome expectation");
  validateOutcomeActor(event, state, record, "expectation");
  validateOutcomeExecutionReference(event, state, record, "expectation");
  const executionStatus = state.executionStatusById.get(record.executionId);
  if (executionStatus && executionStatus !== "active") {
    addError(state, event, "expected outcome must be declared before execution completion");
  }
  if (record.id && state.outcomeExpectations.has(record.id)) {
    addError(state, event, `duplicate outcome expectation ${record.id}`);
  }
  if (record.id) {
    state.outcomeExpectations.set(record.id, record);
    state.outcomeStatusById.set(record.id, "pending");
  }
}

function validateOutcomeObservedEvent(event, state) {
  const record = event.payload.outcomeRecord;
  if (!record) {
    addError(state, event, "OutcomeObserved payload missing outcomeRecord");
    return;
  }
  for (const reason of validateOutcomeObservation(record)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, record, state, "outcome observation");
  validateOutcomeActor(event, state, record, "observation");
  validateOutcomeExecutionReference(event, state, record, "observation");
  const expectation = validateOutcomeReferencesExpectation(event, state, record, "observation");
  if (expectation) {
    validateOutcomeRecordMatchesExpectation(event, state, record, expectation, "observation");
  }
  const status = state.outcomeStatusById.get(record.id);
  if (status && status !== "pending") {
    addError(state, event, `outcome observation references ${status} outcome ${record.id}`);
  }
  if (record.id) {
    state.outcomeObservations.set(record.id, record);
    state.outcomeStatusById.set(record.id, "observed");
  }
}

function validateOutcomeEvaluatedEvent(event, state) {
  const record = event.payload.outcomeRecord;
  if (!record) {
    addError(state, event, "OutcomeEvaluated payload missing outcomeRecord");
    return;
  }
  for (const reason of validateOutcomeEvaluation(record)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, record, state, "outcome evaluation");
  validateOutcomeActor(event, state, record, "evaluation");
  if (record.evaluatedByParticipantId && event.actor_id !== record.evaluatedByParticipantId) {
    addError(state, event, "outcome evaluation actor_id must match evaluatedByParticipantId");
  }
  validateOutcomeExecutionReference(event, state, record, "evaluation");
  const expectation = validateOutcomeReferencesExpectation(event, state, record, "evaluation");
  if (expectation) {
    validateOutcomeRecordMatchesExpectation(event, state, record, expectation, "evaluation");
  }
  if (!state.outcomeObservations.has(record.id)) {
    addError(state, event, `outcome evaluation requires observed outcome ${record.id}`);
  }
  const executionStatus = state.executionStatusById.get(record.executionId);
  if (executionStatus !== "completed") {
    addError(state, event, `outcome evaluation requires completed execution ${record.executionId}`);
  }
  const status = state.outcomeStatusById.get(record.id);
  if (status && status !== "observed") {
    addError(state, event, `outcome evaluation references ${status} outcome ${record.id}`);
  }
  if (record.id) {
    state.outcomeEvaluations.set(record.id, record);
    state.outcomeStatusById.set(record.id, "evaluated");
  }
}

function validateOutcomeDisputedEvent(event, state) {
  const dispute = event.payload.outcomeDispute;
  if (!dispute) {
    addError(state, event, "OutcomeDisputed payload missing outcomeDispute");
    return;
  }
  for (const reason of validateOutcomeDispute(dispute)) {
    addError(state, event, reason);
  }
  validateOutcomeThread(event, state, dispute, "dispute");
  const expectation = state.outcomeExpectations.get(dispute.outcomeId);
  if (!expectation) {
    addError(state, event, `outcome dispute references unknown outcome ${dispute.outcomeId}`);
  } else {
    validateOutcomeSideRecordMatchesExpectation(event, state, dispute, expectation, "dispute");
  }
  validateOutcomeParticipant(event, state, dispute.disputedByParticipantId, "dispute");
  if (event.actor_id !== dispute.disputedByParticipantId) {
    addError(state, event, "outcome dispute actor_id must match disputedByParticipantId");
  }
  if (dispute.id && state.outcomeDisputes.has(dispute.id)) {
    addError(state, event, `duplicate outcome dispute ${dispute.id}`);
  }
  if (dispute.id) {
    state.outcomeDisputes.set(dispute.id, dispute);
  }
  if (dispute.outcomeId) {
    state.outcomeStatusById.set(dispute.outcomeId, "disputed");
  }
}

function validateOutcomeViolationRecordedEvent(event, state) {
  const violation = event.payload.outcomeViolation;
  if (!violation) {
    addError(state, event, "OutcomeViolationRecorded payload missing outcomeViolation");
    return;
  }
  for (const reason of validateOutcomeViolation(violation)) {
    addError(state, event, reason);
  }
  validateOutcomeThread(event, state, violation, "violation");
  const expectation = state.outcomeExpectations.get(violation.outcomeId);
  if (!expectation) {
    addError(state, event, `outcome violation references unknown outcome ${violation.outcomeId}`);
  } else {
    validateOutcomeSideRecordMatchesExpectation(event, state, violation, expectation, "violation");
  }
  validateOutcomeParticipant(event, state, violation.detectedByParticipantId, "violation");
  if (event.actor_id !== violation.detectedByParticipantId) {
    addError(state, event, "outcome violation actor_id must match detectedByParticipantId");
  }
  if (violation.id && state.outcomeViolations.has(violation.id)) {
    addError(state, event, `duplicate outcome violation ${violation.id}`);
  }
  if (violation.id) {
    state.outcomeViolations.set(violation.id, violation);
  }
  if (violation.outcomeId) {
    state.outcomeStatusById.set(violation.outcomeId, "violated");
  }
}

function validateLearningSignalDerivedEvent(event, state) {
  const signal = event.payload.outcomeLearningSignal;
  if (!signal) {
    addError(state, event, "LearningSignalDerived payload missing outcomeLearningSignal");
    return;
  }
  for (const reason of validateOutcomeLearningSignal(signal)) {
    addError(state, event, reason);
  }
  validateOutcomeLearningReferences(event, state, signal, "signal", signal.derivedByParticipantId);
  validateIdsExist(event, state, signal.confirmedAssumptionIds, state.assumptions, "confirmed assumption");
  validateIdsExist(event, state, signal.failedAssumptionIds, state.assumptions, "failed assumption");
  if (signal.id && state.outcomeLearningSignals.has(signal.id)) {
    addError(state, event, `duplicate outcome learning signal ${signal.id}`);
  }
  if (signal.id) {
    state.outcomeLearningSignals.set(signal.id, signal);
  }
}

function validateLessonRecordedEvent(event, state) {
  const lesson = event.payload.outcomeLesson;
  if (!lesson) {
    addError(state, event, "LessonRecorded payload missing outcomeLesson");
    return;
  }
  for (const reason of validateOutcomeLesson(lesson)) {
    addError(state, event, reason);
  }
  validateOutcomeLearningReferences(event, state, lesson, "lesson", lesson.recordedByParticipantId);
  const signal = lesson.learningSignalId ? state.outcomeLearningSignals.get(lesson.learningSignalId) : null;
  if (!signal) {
    addError(state, event, `outcome lesson references unknown learning signal ${lesson.learningSignalId}`);
  } else {
    validateOutcomeLearningMatchesTarget(state, event, lesson, signal, "lesson", "learning signal");
  }
  if (lesson.id && state.outcomeLessons.has(lesson.id)) {
    addError(state, event, `duplicate outcome lesson ${lesson.id}`);
  }
  if (lesson.id) {
    state.outcomeLessons.set(lesson.id, lesson);
  }
}

function validateLearningDisputedEvent(event, state) {
  const dispute = event.payload.outcomeLearningDispute;
  if (!dispute) {
    addError(state, event, "LearningDisputed payload missing outcomeLearningDispute");
    return;
  }
  for (const reason of validateOutcomeLearningDispute(dispute)) {
    addError(state, event, reason);
  }
  validateOutcomeLearningReferences(event, state, dispute, "dispute", dispute.disputedByParticipantId);
  validateOutcomeLearningTarget(event, state, dispute, "dispute");
  if (dispute.id && state.outcomeLearningDisputes.has(dispute.id)) {
    addError(state, event, `duplicate outcome learning dispute ${dispute.id}`);
  }
  if (dispute.id) {
    state.outcomeLearningDisputes.set(dispute.id, dispute);
  }
}

function validateLearningViolationRecordedEvent(event, state) {
  const violation = event.payload.outcomeLearningViolation;
  if (!violation) {
    addError(state, event, "LearningViolationRecorded payload missing outcomeLearningViolation");
    return;
  }
  for (const reason of validateOutcomeLearningViolation(violation)) {
    addError(state, event, reason);
  }
  validateOutcomeLearningReferences(event, state, violation, "violation", violation.detectedByParticipantId);
  validateOutcomeLearningTarget(event, state, violation, "violation");
  if (violation.id && state.outcomeLearningViolations.has(violation.id)) {
    addError(state, event, `duplicate outcome learning violation ${violation.id}`);
  }
  if (violation.id) {
    state.outcomeLearningViolations.set(violation.id, violation);
  }
}

function validateOutcomeActor(event, state, record, label) {
  if (!record?.actorId) {
    return;
  }
  validateOutcomeParticipant(event, state, record.actorId, label);
  if (event.actor_id !== record.actorId) {
    addError(state, event, `outcome ${label} actor_id must match actorId`);
  }
}

function validateOutcomeParticipant(event, state, participantId, label) {
  if (!participantId) {
    addError(state, event, `outcome ${label} requires accountable participant`);
    return;
  }
  if (!state.participants.has(participantId)) {
    addError(state, event, `outcome ${label} references unknown participant ${participantId}`);
  }
}

function validateOutcomeExecutionReference(event, state, record, label) {
  const execution = record?.executionId ? state.executionRecords.get(record.executionId) : null;
  if (!execution) {
    addError(state, event, `outcome ${label} references unknown execution ${record?.executionId}`);
    return null;
  }
  if (execution.threadId !== record.threadId) {
    addError(state, event, `outcome ${label} threadId must match execution record`);
  }
  return execution;
}

function validateOutcomeReferencesExpectation(event, state, record, label) {
  const expectation = record?.id ? state.outcomeExpectations.get(record.id) : null;
  if (!expectation) {
    addError(state, event, `outcome ${label} references unknown expected outcome ${record?.id}`);
    return null;
  }
  return expectation;
}

function validateOutcomeRecordMatchesExpectation(event, state, record, expectation, label) {
  if (record.executionId !== expectation.executionId) {
    addError(state, event, `outcome ${label} executionId must match expected outcome`);
  }
  if (record.threadId !== expectation.threadId) {
    addError(state, event, `outcome ${label} threadId must match expected outcome`);
  }
  if (normalizeOutcomeEffect(record.expectedEffect) !== normalizeOutcomeEffect(expectation.expectedEffect)) {
    addError(state, event, `outcome ${label} must not rewrite expected effect`);
  }
}

function validateOutcomeSideRecordMatchesExpectation(event, state, record, expectation, label) {
  if (record.executionId !== expectation.executionId) {
    addError(state, event, `outcome ${label} executionId must match expected outcome`);
  }
  if (record.threadId !== expectation.threadId) {
    addError(state, event, `outcome ${label} threadId must match expected outcome`);
  }
}

function validateOutcomeThread(event, state, object, label) {
  if (object.threadId !== event.thread_id) {
    addError(state, event, `outcome ${label} threadId must match event thread_id`);
  }
  if (!state.threads.has(object.threadId)) {
    addError(state, event, `outcome ${label} references unknown thread ${object.threadId}`);
  }
}

function validateOutcomeLearningReferences(event, state, object, label, participantId) {
  validateThreadObject(event, object, state, `outcome learning ${label}`);
  if (!participantId) {
    addError(state, event, `outcome learning ${label} requires accountable participant`);
  } else if (!state.participants.has(participantId)) {
    addError(state, event, `outcome learning ${label} references unknown participant ${participantId}`);
  }
  if (participantId && event.actor_id !== participantId) {
    addError(state, event, `outcome learning ${label} actor_id must match accountable participant`);
  }

  const expectation = object.outcomeId ? state.outcomeExpectations.get(object.outcomeId) : null;
  if (!expectation) {
    addError(state, event, `outcome learning ${label} references unknown outcome ${object.outcomeId}`);
  } else {
    if (object.executionId !== expectation.executionId) {
      addError(state, event, `outcome learning ${label} executionId must match evaluated outcome`);
    }
    if (object.threadId !== expectation.threadId) {
      addError(state, event, `outcome learning ${label} threadId must match evaluated outcome`);
    }
    if (object.expectedEffect && normalizeOutcomeEffect(object.expectedEffect) !== normalizeOutcomeEffect(expectation.expectedEffect)) {
      addError(state, event, `outcome learning ${label} must not rewrite intended effect`);
    }
  }

  const execution = object.executionId ? state.executionRecords.get(object.executionId) : null;
  if (!execution) {
    addError(state, event, `outcome learning ${label} references unknown execution ${object.executionId}`);
  } else if (execution.threadId !== object.threadId) {
    addError(state, event, `outcome learning ${label} threadId must match execution record`);
  }

  const evaluation = object.outcomeId ? state.outcomeEvaluations.get(object.outcomeId) : null;
  if (!evaluation) {
    addError(state, event, `outcome learning ${label} requires evaluated outcome ${object.outcomeId}`);
    return;
  }
  if (
    object.evaluationResult
    && normalizeType(object.evaluationResult) !== normalizeType(evaluation.evaluationResult)
  ) {
    addError(state, event, `outcome learning ${label} evaluationResult must match evaluated outcome`);
  }
  if (object.sourceOutcomeHash && evaluation.outcomeHash && object.sourceOutcomeHash !== evaluation.outcomeHash) {
    addError(state, event, `outcome learning ${label} sourceOutcomeHash must match evaluated outcome`);
  }
}

function validateOutcomeLearningTarget(event, state, record, label) {
  const target = state.outcomeLearningSignals.get(record.learningId)
    || state.outcomeLessons.get(record.learningId);
  if (!target) {
    addError(state, event, `outcome learning ${label} references unknown learning ${record.learningId}`);
    return;
  }
  validateOutcomeLearningMatchesTarget(state, event, record, target, label, "learning record");
}

function validateOutcomeLearningMatchesTarget(state, event, record, target, label, targetLabel) {
  if (record.outcomeId !== target.outcomeId) {
    addError(state, event, `outcome learning ${label} outcomeId must match ${targetLabel}`);
  }
  if (record.executionId !== target.executionId) {
    addError(state, event, `outcome learning ${label} executionId must match ${targetLabel}`);
  }
  if (record.threadId !== target.threadId) {
    addError(state, event, `outcome learning ${label} threadId must match ${targetLabel}`);
  }
}

function normalizeOutcomeEffect(value) {
  return String(value || "").trim();
}

module.exports = {
  validateLearningDisputedEvent,
  validateLearningSignalDerivedEvent,
  validateLearningViolationRecordedEvent,
  validateLessonRecordedEvent,
  validateOutcomeDisputedEvent,
  validateOutcomeEvaluatedEvent,
  validateOutcomeExpectedEvent,
  validateOutcomeObservedEvent,
  validateOutcomeViolationRecordedEvent
};
