const {
  buildDelegatedAction,
  buildDelegationGrant,
  buildDelegationRevocation,
  delegationForId
} = require("../delegation");
const {
  appendEvent,
  createEvent,
  nowIso,
  parseList
} = require("../events");
const { projectEvents } = require("../projector");
const { validateEvents } = require("../validator");
const {
  appendParticipant,
  participantFrom,
  print,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function delegationGrant(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "delegate");
  requireOption(options, "action");
  requireOption(options, "scope");
  requireOption(options, "limit");
  const delegator = participantFrom(options.delegator || options.actor || "Author", "decision_owner");
  const delegateType = normalizeDelegateTypeForCli(options.delegateType || "participant");
  const delegate = participantFrom(
    options.delegate,
    options.delegateRole || defaultDelegateRoleForType(delegateType),
    options.delegateKind || defaultDelegateKindForType(delegateType)
  );
  appendParticipant(delegator, cwd, options.thread);
  appendParticipant(delegate, cwd, options.thread);
  const at = nowIso();
  const grant = buildDelegationGrant({
    id: options.id || options.delegation,
    threadId: options.thread,
    delegatorParticipantId: delegator.id,
    delegateId: delegate.id,
    delegateType,
    action: options.action,
    scope: options.scope,
    limits: parseList(options.limit || options.limits),
    expiresAt: options.expiresAt || options.expires,
    summary: options.summary,
    grantedAt: at
  });
  const event = createEvent({
    type: "DelegationGranted",
    threadId: options.thread,
    actorId: delegator.id,
    at,
    payload: { delegationGrant: grant }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.delegation.grant.v0",
    granted: true,
    delegationGrant: grant,
    event
  });
}

function delegationRecord(options, cwd) {
  requireOption(options, "delegation");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const grant = projection.delegation.byGrant[options.delegation];
  if (!grant) {
    throw new Error(`Unknown delegation ${options.delegation}`);
  }
  const at = nowIso();
  const action = buildDelegatedAction({
    id: options.id || options.actionId,
    delegationId: grant.id,
    threadId: grant.threadId,
    delegateId: grant.delegateId,
    delegateType: grant.delegateType,
    action: options.action || grant.action,
    scope: options.scope || grant.scope,
    targetObjectType: options.targetType || options.targetObjectType,
    targetObjectId: options.target || options.targetObjectId,
    summary: options.summary,
    recordedAt: at
  });
  const event = createEvent({
    type: "DelegatedActionRecorded",
    threadId: grant.threadId,
    actorId: grant.delegateId,
    at,
    payload: { delegatedAction: action }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.delegation.record.v0",
    recorded: true,
    delegatedAction: action,
    event
  });
}

function delegationList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let grants = projection.delegation.grants;
  if (options.thread) {
    grants = grants.filter((grant) => grant.threadId === options.thread);
  }
  if (options.status) {
    grants = grants.filter((grant) => grant.status === options.status);
  }
  return print({
    schema: "clista.delegation.list.v0",
    theorem: projection.delegation.theorem,
    hardLaw: projection.delegation.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: grants.length,
    grants
  });
}

function delegationShow(options, cwd) {
  const delegationId = options.delegation || options.delegationId || options.id;
  if (!delegationId) {
    throw new Error("Missing required option --delegation");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(delegationForId(projection.delegation, delegationId));
}

function delegationRevoke(options, cwd) {
  requireOption(options, "delegation");
  requireOption(options, "reason");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const grant = projection.delegation.byGrant[options.delegation];
  if (!grant) {
    throw new Error(`Unknown delegation ${options.delegation}`);
  }
  const revoker = participantFrom(options.revoker || options.actor || grant.delegatorParticipantId, "decision_owner");
  appendParticipant(revoker, cwd, grant.threadId);
  const at = nowIso();
  const revocation = buildDelegationRevocation({
    id: options.id || options.revocation,
    delegationId: grant.id,
    threadId: grant.threadId,
    revokedByParticipantId: revoker.id,
    reason: options.reason,
    revokedAt: at
  });
  const event = createEvent({
    type: "DelegationRevoked",
    threadId: grant.threadId,
    actorId: revoker.id,
    at,
    payload: { delegationRevocation: revocation }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.delegation.revoke.v0",
    revoked: true,
    delegationRevocation: revocation,
    event
  });
}

function delegationVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.delegation.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.delegation.verify.v0",
    valid: true,
    errors: [],
    delegationValidationStatus: projection.delegation.delegationValidationStatus
  });
}

function normalizeDelegateTypeForCli(value) {
  return String(value || "participant")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function defaultDelegateKindForType(delegateType) {
  const kinds = {
    agent: "agent",
    tool: "tool",
    context: "system"
  };
  return kinds[delegateType] || "human";
}

function defaultDelegateRoleForType(delegateType) {
  const roles = {
    agent: "delegated_agent",
    tool: "delegated_tool",
    context: "context_controller"
  };
  return roles[delegateType] || "delegated_actor";
}

module.exports = {
  delegationGrant,
  delegationList,
  delegationRecord,
  delegationRevoke,
  delegationShow,
  delegationVerify
};
