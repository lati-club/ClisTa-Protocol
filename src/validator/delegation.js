const {
  validateDelegatedAction,
  validateDelegationExpiration,
  validateDelegationGrant,
  validateDelegationRevocation,
  validateDelegationViolation
} = require("../delegation");
const { participantHasAuthority } = require("../identity");
const { normalizeType } = require("../utils");
const {
  addError,
  validateThreadObject
} = require("./shared");

function validateDelegationGrantedEvent(event, state) {
  const grant = event.payload.delegationGrant;
  if (!grant) {
    addError(state, event, "DelegationGranted payload missing delegationGrant");
    return;
  }
  for (const reason of validateDelegationGrant(grant, state.events)) {
    addError(state, event, reason);
  }
  if (grant.id && state.delegationGrants.has(grant.id)) {
    addError(state, event, `duplicate delegation grant ${grant.id}`);
  }
  validateThreadObject(event, grant, state, "delegation grant");
  if (grant.delegatorParticipantId && !state.participants.has(grant.delegatorParticipantId)) {
    addError(state, event, `delegation grant references unknown delegator ${grant.delegatorParticipantId}`);
  }
  validateDelegationDelegateActor(event, state, grant.delegateId, grant.delegateType, "grant");
  if (grant.delegatorParticipantId && event.actor_id !== grant.delegatorParticipantId) {
    addError(state, event, "delegation grant actor must be the delegator");
  }
  const requiredAuthority = normalizeType(grant.authorityRequired || "decision_owner");
  if (
    grant.delegatorParticipantId
    && !participantHasAuthority(state.identity, grant.delegatorParticipantId, requiredAuthority, grant.threadId)
  ) {
    addError(state, event, `delegation grant requires ${requiredAuthority} authority ${grant.delegatorParticipantId}`);
  }
  if (grant.id) {
    state.delegationGrants.set(grant.id, grant);
    state.delegationStatusByGrant.set(grant.id, "active");
  }
}

function validateDelegatedActionRecordedEvent(event, state) {
  const action = event.payload.delegatedAction;
  if (!action) {
    addError(state, event, "DelegatedActionRecorded payload missing delegatedAction");
    return;
  }
  for (const reason of validateDelegatedAction(action, state.events)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, action, state, "delegated action");
  const grant = action.delegationId ? state.delegationGrants.get(action.delegationId) : null;
  if (!grant) {
    addError(state, event, `delegated action references unknown delegation ${action.delegationId}`);
  } else {
    validateDelegatedActionAgainstGrant(event, state, action, grant);
  }
  if (action.id) {
    state.delegationActions.set(action.id, action);
  }
}

function validateDelegationRevokedEvent(event, state) {
  const revocation = event.payload.delegationRevocation;
  if (!revocation) {
    addError(state, event, "DelegationRevoked payload missing delegationRevocation");
    return;
  }
  for (const reason of validateDelegationRevocation(revocation, state.events)) {
    addError(state, event, reason);
  }
  const grant = revocation.delegationId ? state.delegationGrants.get(revocation.delegationId) : null;
  if (!grant) {
    addError(state, event, `delegation revocation references unknown delegation ${revocation.delegationId}`);
  } else {
    validateDelegationControlActor(event, state, revocation.revokedByParticipantId, grant, "revocation");
    if (state.delegationStatusByGrant.get(grant.id) !== "active") {
      addError(state, event, `delegation revocation references inactive delegation ${grant.id}`);
    }
    state.delegationStatusByGrant.set(grant.id, "revoked");
  }
  if (revocation.id) {
    state.delegationRevocations.set(revocation.id, revocation);
  }
}

function validateDelegationExpiredEvent(event, state) {
  const expiration = event.payload.delegationExpiration;
  if (!expiration) {
    addError(state, event, "DelegationExpired payload missing delegationExpiration");
    return;
  }
  for (const reason of validateDelegationExpiration(expiration, state.events)) {
    addError(state, event, reason);
  }
  const grant = expiration.delegationId ? state.delegationGrants.get(expiration.delegationId) : null;
  if (!grant) {
    addError(state, event, `delegation expiration references unknown delegation ${expiration.delegationId}`);
  } else {
    if (state.delegationStatusByGrant.get(grant.id) !== "active") {
      addError(state, event, `delegation expiration references inactive delegation ${grant.id}`);
    }
    state.delegationStatusByGrant.set(grant.id, "expired");
  }
  if (expiration.id) {
    state.delegationExpirations.set(expiration.id, expiration);
  }
}

function validateDelegationViolationRecordedEvent(event, state) {
  const violation = event.payload.delegationViolation;
  if (!violation) {
    addError(state, event, "DelegationViolationRecorded payload missing delegationViolation");
    return;
  }
  for (const reason of validateDelegationViolation(violation, state.events)) {
    addError(state, event, reason);
  }
  const grant = violation.delegationId ? state.delegationGrants.get(violation.delegationId) : null;
  if (!grant) {
    addError(state, event, `delegation violation references unknown delegation ${violation.delegationId}`);
  } else {
    validateDelegationControlActor(event, state, violation.detectedByParticipantId || event.actor_id, grant, "violation");
    state.delegationStatusByGrant.set(grant.id, "violated");
  }
  if (violation.actionId && !state.delegationActions.has(violation.actionId)) {
    addError(state, event, `delegation violation references unknown action ${violation.actionId}`);
  }
  if (violation.id) {
    state.delegationViolations.set(violation.id, violation);
  }
}

function validateDelegatedActionAgainstGrant(event, state, action, grant) {
  const status = state.delegationStatusByGrant.get(grant.id) || "active";
  if (status !== "active") {
    addError(state, event, `delegated action references ${status} delegation ${grant.id}`);
  }
  validateDelegationDelegateActor(event, state, action.delegateId, action.delegateType || grant.delegateType, "action");
  if (event.actor_id !== action.delegateId) {
    addError(state, event, "delegated action actor_id must match accountable delegate");
  }
  if (grant.expiresAt && Date.parse(event.timestamp) > Date.parse(grant.expiresAt)) {
    addError(state, event, `delegated action references expired delegation ${grant.id}`);
  }
  if (action.threadId !== grant.threadId) {
    addError(state, event, "delegated action threadId must match delegation grant");
  }
  if (action.delegateId !== grant.delegateId) {
    addError(state, event, "delegated action delegateId must match delegation grant");
  }
  if (normalizeType(action.action) !== normalizeType(grant.action)) {
    addError(state, event, "delegated action must match granted action");
  }
  if (normalizeType(action.scope) !== normalizeType(grant.scope)) {
    addError(state, event, "delegated action must stay within granted scope");
  }
  if (action.attribution?.delegateId !== action.delegateId) {
    addError(state, event, "delegated action attribution must identify delegate");
  }
  if (action.attribution?.delegationId !== action.delegationId) {
    addError(state, event, "delegated action attribution must identify delegation");
  }
}

function validateDelegationDelegateActor(event, state, delegateId, delegateType, label) {
  if (!delegateId) {
    return;
  }
  const participant = state.participants.get(delegateId);
  if (!participant) {
    addError(state, event, `delegation ${label} references unknown accountable delegate ${delegateId}`);
    return;
  }
  const normalizedType = normalizeType(delegateType || "participant");
  const normalizedKind = normalizeType(participant.kind || "human");
  const permittedKinds = {
    participant: null,
    agent: new Set(["agent"]),
    tool: new Set(["tool", "system"]),
    context: new Set(["system"])
  };
  const expectedKinds = permittedKinds[normalizedType];
  if (expectedKinds && !expectedKinds.has(normalizedKind)) {
    addError(
      state,
      event,
      `delegation ${label} delegateType ${normalizedType} requires participant kind ${Array.from(expectedKinds).join(" or ")}`
    );
  }
}

function validateDelegationControlActor(event, state, participantId, grant, label) {
  if (!participantId) {
    addError(state, event, `delegation ${label} requires controlling participant`);
    return;
  }
  if (!state.participants.has(participantId)) {
    addError(state, event, `delegation ${label} references unknown participant ${participantId}`);
    return;
  }
  const permitted = participantId === grant.delegatorParticipantId
    || participantHasAuthority(state.identity, participantId, grant.authorityRequired || "decision_owner", grant.threadId);
  if (!permitted) {
    addError(state, event, `delegation ${label} requires delegator or decision_owner authority ${participantId}`);
  }
}

module.exports = {
  validateDelegatedActionRecordedEvent,
  validateDelegationDelegateActor,
  validateDelegationExpiredEvent,
  validateDelegationGrantedEvent,
  validateDelegationRevokedEvent,
  validateDelegationViolationRecordedEvent
};
