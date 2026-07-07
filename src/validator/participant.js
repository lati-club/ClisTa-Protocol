const {
  VALID_AUTHORITIES,
  VALID_AUTHORITY_SCOPES,
  applyIdentityEvent,
  participantHasAuthority
} = require("../identity");
const { normalizeType } = require("../utils");
const { addError } = require("./shared");

function validateParticipantAdded(event, state) {
  const participant = event.payload.participant;
  if (!participant?.id) {
    addError(state, event, "ParticipantAdded payload missing participant.id");
    return;
  }
  if (state.participants.has(participant.id)) {
    addError(state, event, `duplicate participant id ${participant.id}`);
  }
  state.participants.set(participant.id, participant);
  applyIdentityEvent(state.identity, event);
}

function validateParticipantDeclared(event, state) {
  const participant = event.payload.participant;
  if (!participant?.id) {
    addError(state, event, "ParticipantDeclared payload missing participant.id");
    return;
  }
  if (state.participants.has(participant.id)) {
    addError(state, event, `duplicate participant id ${participant.id}`);
  }
  state.participants.set(participant.id, participant);
  applyIdentityEvent(state.identity, event);
}

function validateParticipantRoleAssigned(event, state) {
  const role = event.payload.participantRole;
  if (!role?.participantId) {
    addError(state, event, "ParticipantRoleAssigned payload missing participantRole.participantId");
    return;
  }
  if (!state.participants.has(role.participantId)) {
    addError(state, event, `role assignment references unknown participant ${role.participantId}`);
  }
  if (!role.role) {
    addError(state, event, "participant role assignment requires role");
  }
  validateAuthorityScope(event, state, role.scope, role.threadId);
  applyIdentityEvent(state.identity, event);
}

function validateParticipantAuthorityGranted(event, state) {
  const authority = event.payload.participantAuthority;
  if (!authority?.participantId) {
    addError(state, event, "ParticipantAuthorityGranted payload missing participantAuthority.participantId");
    return;
  }
  if (!state.participants.has(authority.participantId)) {
    addError(state, event, `authority grant references unknown participant ${authority.participantId}`);
  }
  validateAuthorityName(event, state, authority.authority);
  validateAuthorityScope(event, state, authority.scope, authority.threadId);
  applyIdentityEvent(state.identity, event);
}

function validateParticipantAuthorityRevoked(event, state) {
  const revocation = event.payload.participantAuthorityRevocation;
  if (!revocation?.participantId) {
    addError(state, event, "ParticipantAuthorityRevoked payload missing participantAuthorityRevocation.participantId");
    return;
  }
  if (!state.participants.has(revocation.participantId)) {
    addError(state, event, `authority revocation references unknown participant ${revocation.participantId}`);
  }
  validateAuthorityName(event, state, revocation.authority);
  validateAuthorityScope(event, state, revocation.scope, revocation.threadId);
  if (!participantHasAuthority(state.identity, revocation.participantId, revocation.authority, revocation.threadId)) {
    addError(state, event, `authority revocation references inactive authority ${revocation.authority} for ${revocation.participantId}`);
  }
  applyIdentityEvent(state.identity, event);
}

function validateAuthorityName(event, state, authority) {
  const normalized = normalizeType(authority);
  if (!VALID_AUTHORITIES.has(normalized)) {
    addError(state, event, `unsupported authority ${authority}`);
  }
}

function validateAuthorityScope(event, state, scope = "global", threadId) {
  if (!VALID_AUTHORITY_SCOPES.has(scope)) {
    addError(state, event, `unsupported authority scope ${scope}`);
    return;
  }
  if (scope === "thread") {
    if (!threadId) {
      addError(state, event, "thread authority scope requires threadId");
    } else if (!state.threads.has(threadId)) {
      addError(state, event, `authority scope references unknown thread ${threadId}`);
    }
  }
}

module.exports = {
  validateParticipantAdded,
  validateParticipantAuthorityGranted,
  validateParticipantAuthorityRevoked,
  validateParticipantDeclared,
  validateParticipantRoleAssigned
};
