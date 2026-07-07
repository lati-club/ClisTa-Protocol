const {
  appendEvent,
  createEvent,
  newId,
  nowIso,
  participantIdFor
} = require("../events");
const {
  buildIdentityState,
  identityForParticipant
} = require("../identity");
const { stripUndefined } = require("../utils");
const {
  print,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function participantDeclare(options, cwd) {
  requireOption(options, "name");
  const id = options.id || participantIdFor(options.name);
  const at = nowIso();
  const participant = {
    id,
    object: "participant",
    kind: options.kind || "human",
    name: options.name,
    declaredBy: options.declaredBy || options.actor || id,
    declaredAt: at
  };
  if (options.role) {
    participant.role = options.role;
  }
  const event = createEvent({
    type: "ParticipantDeclared",
    threadId: options.thread || "thd_identity",
    actorId: participant.declaredBy,
    at,
    payload: { participant }
  });
  appendEvent(event, cwd);
  return print({ participant, event });
}

function participantRoleAssign(options, cwd) {
  requireOption(options, "participant");
  requireOption(options, "role");
  const at = nowIso();
  const participantId = participantIdFor(options.participant);
  const scope = options.scope || (options.thread ? "thread" : "global");
  const participantRole = {
    id: options.id || newId("rol", `${participantId}_${options.role}`),
    object: "participantRole",
    participantId,
    role: options.role,
    scope,
    threadId: options.thread,
    assignedBy: participantIdFor(options.actor || options.assignedBy || options.participant),
    assignedAt: at
  };
  stripUndefined(participantRole);
  const event = createEvent({
    type: "ParticipantRoleAssigned",
    threadId: options.thread || "thd_identity",
    actorId: participantRole.assignedBy,
    at,
    payload: { participantRole }
  });
  appendEvent(event, cwd);
  return print({ participantRole, event });
}

function participantAuthorityGrant(options, cwd) {
  requireOption(options, "participant");
  requireOption(options, "authority");
  const at = nowIso();
  const participantId = participantIdFor(options.participant);
  const scope = options.scope || (options.thread ? "thread" : "global");
  const participantAuthority = {
    id: options.id || newId("auth", `${participantId}_${options.authority}`),
    object: "participantAuthority",
    participantId,
    authority: options.authority,
    scope,
    threadId: options.thread,
    grantedBy: participantIdFor(options.actor || options.grantedBy || options.participant),
    grantedAt: at,
    reason: options.reason
  };
  stripUndefined(participantAuthority);
  const event = createEvent({
    type: "ParticipantAuthorityGranted",
    threadId: options.thread || "thd_identity",
    actorId: participantAuthority.grantedBy,
    at,
    payload: { participantAuthority }
  });
  appendEvent(event, cwd);
  return print({ participantAuthority, event });
}

function participantAuthorityRevoke(options, cwd) {
  requireOption(options, "participant");
  requireOption(options, "authority");
  const at = nowIso();
  const participantId = participantIdFor(options.participant);
  const scope = options.scope || (options.thread ? "thread" : "global");
  const participantAuthorityRevocation = {
    id: options.id || newId("rev", `${participantId}_${options.authority}`),
    object: "participantAuthorityRevocation",
    authorityId: options.authorityId,
    participantId,
    authority: options.authority,
    scope,
    threadId: options.thread,
    revokedBy: participantIdFor(options.actor || options.revokedBy || options.participant),
    revokedAt: at,
    reason: options.reason
  };
  stripUndefined(participantAuthorityRevocation);
  const event = createEvent({
    type: "ParticipantAuthorityRevoked",
    threadId: options.thread || "thd_identity",
    actorId: participantAuthorityRevocation.revokedBy,
    at,
    payload: { participantAuthorityRevocation }
  });
  appendEvent(event, cwd);
  return print({ participantAuthorityRevocation, event });
}

function identityShow(options, cwd) {
  requireOption(options, "participant");
  const events = readValidEventsForOptions(options, cwd);
  const participantId = participantIdFor(options.participant);
  return print(identityForParticipant(buildIdentityState(events), participantId));
}

module.exports = {
  identityShow,
  participantAuthorityGrant,
  participantAuthorityRevoke,
  participantDeclare,
  participantRoleAssign
};
