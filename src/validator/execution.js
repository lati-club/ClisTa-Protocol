const {
  validateExecutionCompletion,
  validateExecutionFailure,
  validateExecutionRollback,
  validateExecutionStart,
  validateExecutionViolation
} = require("../execution");
const { participantHasAuthority } = require("../identity");
const { normalizeType } = require("../utils");
const { validateDelegationDelegateActor } = require("../validator/delegation");
const {
  addError,
  arrayValues,
  validateThreadObject
} = require("./shared");

function validateExecutionStartedEvent(event, state) {
  const record = event.payload.executionRecord;
  if (!record) {
    addError(state, event, "ExecutionStarted payload missing executionRecord");
    return;
  }
  for (const reason of validateExecutionStart(record)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, record, state, "execution record");
  validateExecutionActor(event, state, record);
  if (record.id && state.executionStarts.has(record.id)) {
    addError(state, event, `duplicate execution start ${record.id}`);
  }
  validateExecutionAuthorization(event, state, record);
  if (record.id) {
    state.executionStarts.set(record.id, record);
    state.executionRecords.set(record.id, record);
    state.executionStatusById.set(record.id, "active");
  }
}

function validateExecutionCompletedEvent(event, state) {
  const record = event.payload.executionRecord;
  if (!record) {
    addError(state, event, "ExecutionCompleted payload missing executionRecord");
    return;
  }
  for (const reason of validateExecutionCompletion(record)) {
    addError(state, event, reason);
  }
  validateExecutionTransition(event, state, record, "completion");
  if (record.id) {
    state.executionCompletions.set(record.id, record);
    state.executionStatusById.set(record.id, "completed");
  }
}

function validateExecutionFailedEvent(event, state) {
  const record = event.payload.executionRecord;
  if (!record) {
    addError(state, event, "ExecutionFailed payload missing executionRecord");
    return;
  }
  for (const reason of validateExecutionFailure(record)) {
    addError(state, event, reason);
  }
  validateExecutionTransition(event, state, record, "failure");
  if (record.id) {
    state.executionFailures.set(record.id, record);
    state.executionStatusById.set(record.id, "failed");
  }
}

function validateExecutionRolledBackEvent(event, state) {
  const record = event.payload.executionRecord;
  if (!record) {
    addError(state, event, "ExecutionRolledBack payload missing executionRecord");
    return;
  }
  for (const reason of validateExecutionRollback(record)) {
    addError(state, event, reason);
  }
  validateExecutionTransition(event, state, record, "rollback", {
    allowedStatuses: new Set(["completed", "failed"])
  });
  if (record.id) {
    state.executionRollbacks.set(record.id, record);
    state.executionStatusById.set(record.id, "rolled_back");
  }
}

function validateExecutionViolationRecordedEvent(event, state) {
  const violation = event.payload.executionViolation;
  if (!violation) {
    addError(state, event, "ExecutionViolationRecorded payload missing executionViolation");
    return;
  }
  for (const reason of validateExecutionViolation(violation)) {
    addError(state, event, reason);
  }
  if (violation.threadId !== event.thread_id) {
    addError(state, event, "execution violation threadId must match event thread_id");
  }
  const prior = violation.executionId ? state.executionRecords.get(violation.executionId) : null;
  if (!prior) {
    addError(state, event, `execution violation references unknown execution ${violation.executionId}`);
  } else if (prior.threadId !== violation.threadId) {
    addError(state, event, "execution violation threadId must match execution record");
  }
  const detector = violation.detectedByParticipantId || event.actor_id;
  if (!state.participants.has(detector)) {
    addError(state, event, `execution violation references unknown participant ${detector}`);
  }
  if (event.actor_id !== detector) {
    addError(state, event, "execution violation actor_id must match detectedByParticipantId");
  }
  if (violation.id && state.executionViolations.has(violation.id)) {
    addError(state, event, `duplicate execution violation ${violation.id}`);
  }
  if (violation.id) {
    state.executionViolations.set(violation.id, violation);
  }
  if (violation.executionId) {
    state.executionStatusById.set(violation.executionId, "violated");
  }
}

function validateExecutionActor(event, state, record) {
  if (!record?.actorId) {
    return;
  }
  if (!state.participants.has(record.actorId)) {
    addError(state, event, `execution references unknown accountable actor ${record.actorId}`);
  }
  if (event.actor_id !== record.actorId) {
    addError(state, event, "execution actor_id must match execution actorId");
  }
}

function validateExecutionTransition(event, state, record, label, options = {}) {
  validateThreadObject(event, record, state, `execution ${label}`);
  validateExecutionActor(event, state, record);
  const prior = record.id ? state.executionRecords.get(record.id) : null;
  if (!prior) {
    addError(state, event, `execution ${label} references unknown execution ${record.id}`);
    return;
  }
  const currentStatus = state.executionStatusById.get(record.id) || prior.status || "active";
  const allowedStatuses = options.allowedStatuses || new Set(["active"]);
  if (!allowedStatuses.has(currentStatus)) {
    addError(state, event, `execution ${label} references ${currentStatus} execution ${record.id}`);
  }
  validateExecutionRecordMatchesPrior(event, state, record, prior, label);
  validateExecutionAuthorization(event, state, record);
}

function validateExecutionRecordMatchesPrior(event, state, record, prior, label) {
  if (record.threadId !== prior.threadId) {
    addError(state, event, `execution ${label} threadId must match execution start`);
  }
  if (record.actorId !== prior.actorId) {
    addError(state, event, `execution ${label} actorId must match execution start`);
  }
  if (
    normalizeType(record.authorizationRef?.type) !== normalizeType(prior.authorizationRef?.type)
    || record.authorizationRef?.id !== prior.authorizationRef?.id
  ) {
    addError(state, event, `execution ${label} authorizationRef must match execution start`);
  }
  if (record.delegationId !== prior.delegationId) {
    addError(state, event, `execution ${label} delegationId must match execution start`);
  }
  if (record.decisionId !== prior.decisionId) {
    addError(state, event, `execution ${label} decisionId must match execution start`);
  }
  if (normalizeType(record.actionType) !== normalizeType(prior.actionType)) {
    addError(state, event, `execution ${label} actionType must match execution start`);
  }
  if (normalizeType(record.scope) !== normalizeType(prior.scope)) {
    addError(state, event, `execution ${label} scope must match execution start`);
  }
}

function validateExecutionAuthorization(event, state, record) {
  const ref = record?.authorizationRef || {};
  const type = normalizeType(ref.type);
  if (type === "delegation") {
    const grant = ref.id ? state.delegationGrants.get(ref.id) : null;
    if (!grant) {
      addError(state, event, `execution references unknown delegation ${ref.id}`);
      return;
    }
    validateExecutionAgainstDelegation(event, state, record, grant);
    return;
  }
  if (type === "decision") {
    const decision = ref.id ? state.decisionRecords.get(ref.id) : null;
    if (!decision) {
      addError(state, event, `execution references unknown decision ${ref.id}`);
      return;
    }
    validateExecutionAgainstDecision(event, state, record, decision);
  }
}

function validateExecutionAgainstDelegation(event, state, record, grant) {
  const status = state.delegationStatusByGrant.get(grant.id) || "active";
  if (status !== "active") {
    addError(state, event, `execution references ${status} delegation ${grant.id}`);
  }
  if (grant.expiresAt && Date.parse(event.timestamp) > Date.parse(grant.expiresAt)) {
    addError(state, event, `execution references expired delegation ${grant.id}`);
  }
  validateDelegationDelegateActor(event, state, grant.delegateId, grant.delegateType, "execution");
  if (record.threadId !== grant.threadId) {
    addError(state, event, "execution threadId must match delegation grant");
  }
  if (record.actorId !== grant.delegateId) {
    addError(state, event, "delegated execution actorId must match accountable delegate");
  }
  if (record.delegationId !== grant.id) {
    addError(state, event, "delegated execution must identify delegationId");
  }
  if (normalizeType(record.actionType) !== normalizeType(grant.action)) {
    addError(state, event, "delegated execution must match granted action");
  }
  if (normalizeType(record.scope) !== normalizeType(grant.scope)) {
    addError(state, event, "delegated execution must stay within granted scope");
  }
  requireExecutionConstraints(event, state, record, grant.limits || [], "delegation limits");
  if (record.attribution?.delegationId !== grant.id) {
    addError(state, event, "delegated execution attribution must identify delegation");
  }
}

function validateExecutionAgainstDecision(event, state, record, decision) {
  if (decision.status !== "approved") {
    addError(state, event, `execution references non-approved decision ${decision.id}`);
  }
  if (record.threadId !== decision.threadId) {
    addError(state, event, "execution threadId must match decision");
  }
  if (record.decisionId !== decision.id) {
    addError(state, event, "decision execution must identify decisionId");
  }
  const actorPermitted = record.actorId === decision.decidedByParticipantId
    || participantHasAuthority(state.identity, record.actorId, "decision_owner", decision.threadId);
  if (!actorPermitted) {
    addError(state, event, `execution requires decision actor or decision_owner authority ${record.actorId}`);
  }
  const allowedScopes = new Set([
    decision.threadId,
    `thread:${decision.threadId}`,
    decision.id,
    `decision:${decision.id}`
  ].map(normalizeType));
  if (!allowedScopes.has(normalizeType(record.scope))) {
    addError(state, event, "decision execution must stay within decision scope");
  }
  requireExecutionConstraints(event, state, record, decision.conditions || [], "decision conditions");
  if (record.attribution?.decisionId !== decision.id) {
    addError(state, event, "decision execution attribution must identify decision");
  }
}

function requireExecutionConstraints(event, state, record, requiredConstraints, label) {
  const required = arrayValues(requiredConstraints).map(normalizeType).filter(Boolean);
  if (!required.length) {
    return;
  }
  const actual = new Set(arrayValues(record.constraints).map(normalizeType));
  for (const constraint of required) {
    if (!actual.has(constraint)) {
      addError(state, event, `execution constraints must include ${label} ${constraint}`);
    }
  }
}

module.exports = {
  validateExecutionCompletedEvent,
  validateExecutionFailedEvent,
  validateExecutionRolledBackEvent,
  validateExecutionStartedEvent,
  validateExecutionViolationRecordedEvent
};
