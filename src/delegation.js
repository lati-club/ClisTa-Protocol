const { PROTOCOL_VERSION, contentHash } = require("./integrity");
const { groupBy, indexBy, stripUndefined, unique } = require("./utils");

const DELEGATION_SCHEMA = "clista.delegation.v0";
const DELEGATION_PROTOCOL_VERSION = "0.19.0";
const DELEGATION_THEOREM = "protocol_delegation = authorize(scoped_action, accountable_actor)";
const DELEGATION_HARD_LAW = "delegation != authority surrender";

const DELEGATION_EVENT_TYPES = new Set([
  "DelegationGranted",
  "DelegatedActionRecorded",
  "DelegationRevoked",
  "DelegationExpired",
  "DelegationViolationRecorded"
]);

const STATUS_VALUES = new Set(["active", "revoked", "expired", "violated"]);
const DELEGATE_TYPES = new Set(["participant", "agent", "tool", "context"]);

const GUARD_FIELDS = new Set([
  "authoritySurrender",
  "authorityTransfer",
  "permanentAuthorityTransfer",
  "authorityExpanded",
  "authorityExpansion",
  "underlyingAuthorityTransferred",
  "implicitGovernanceChange",
  "governanceMutation",
  "unboundedAction",
  "delegationWithoutAttribution",
  "unattributedAction",
  "automaticConsensus",
  "delegatedConsensus",
  "stateMutation",
  "authorityMutation",
  "delegatedAmendmentApproval"
]);

function emptyDelegationState() {
  return {
    grants: [],
    actions: [],
    revocations: [],
    expirations: [],
    violations: []
  };
}

function buildDelegationState(projection = {}) {
  const state = emptyDelegationState();
  applyExplicitDelegationEvents(projection.events || [], state);
  return state;
}

function applyExplicitDelegationEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "DelegationGranted":
        addRecord(state.grants, normalizeDelegationGrant(payload.delegationGrant, event));
        break;
      case "DelegatedActionRecorded":
        addRecord(state.actions, normalizeDelegatedAction(payload.delegatedAction, event));
        break;
      case "DelegationRevoked":
        addRecord(state.revocations, normalizeDelegationRevocation(payload.delegationRevocation, event));
        break;
      case "DelegationExpired":
        addRecord(state.expirations, normalizeDelegationExpiration(payload.delegationExpiration, event));
        break;
      case "DelegationViolationRecorded":
        addRecord(state.violations, normalizeDelegationViolation(payload.delegationViolation, event));
        break;
      default:
        break;
    }
  }
}

function projectDelegation(state = emptyDelegationState()) {
  const revocations = state.revocations.filter(Boolean);
  const expirations = state.expirations.filter(Boolean);
  const violations = state.violations.filter(Boolean);
  const grants = state.grants.filter(Boolean).map((grant) => ({
    ...grant,
    status: delegationStatusForGrant(grant, { revocations, expirations, violations })
  }));
  const actions = state.actions.filter(Boolean);

  return {
    schema: DELEGATION_SCHEMA,
    theorem: DELEGATION_THEOREM,
    hardLaw: DELEGATION_HARD_LAW,
    delegationProtocolVersion: DELEGATION_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    statuses: Array.from(STATUS_VALUES),
    grants,
    activeGrants: grants.filter((grant) => grant.status === "active"),
    revokedGrants: grants.filter((grant) => grant.status === "revoked"),
    expiredGrants: grants.filter((grant) => grant.status === "expired"),
    violatedGrants: grants.filter((grant) => grant.status === "violated"),
    actions,
    revocations,
    expirations,
    violations,
    byGrant: indexBy(grants, "id"),
    byAction: indexBy(actions, "id"),
    byRevocation: indexBy(revocations, "id"),
    byExpiration: indexBy(expirations, "id"),
    byViolation: indexBy(violations, "id"),
    actionsByDelegation: groupBy(actions, "delegationId"),
    revocationsByDelegation: groupBy(revocations, "delegationId"),
    expirationsByDelegation: groupBy(expirations, "delegationId"),
    violationsByDelegation: groupBy(violations, "delegationId"),
    delegationValidationStatus: {
      valid: true,
      grantCount: grants.length,
      activeGrantCount: grants.filter((grant) => grant.status === "active").length,
      actionCount: actions.length,
      revocationCount: revocations.length,
      expirationCount: expirations.length,
      violationCount: violations.length,
      authoritySurrender: false,
      authorityTransfer: false,
      unboundedAction: false,
      delegationWithoutAttribution: false,
      governanceMutation: false,
      automaticConsensus: false,
      delegatedConsensus: false
    }
  };
}

function buildDelegationGrant(options = {}) {
  const action = normalizeAction(options.action);
  const scope = normalizeText(options.scope || options.threadId || "thread");
  const grant = stripUndefined({
    id: options.id || deterministicId("dlg", "delegation_grant", {
      threadId: options.threadId,
      delegatorParticipantId: options.delegatorParticipantId,
      delegateId: options.delegateId,
      action,
      scope
    }),
    object: "delegationGrant",
    threadId: options.threadId || null,
    delegatorParticipantId: options.delegatorParticipantId || null,
    delegateId: options.delegateId || null,
    delegateType: normalizeDelegateType(options.delegateType || "participant"),
    action,
    scope,
    limits: unique(arrayValues(options.limits)),
    authorityRequired: normalizeAuthority(options.authorityRequired || "decision_owner"),
    attributionRequired: true,
    summary: options.summary || null,
    expiresAt: options.expiresAt || null,
    grantedAt: options.grantedAt || null,
    status: "active",
    authoritySurrender: false,
    authorityTransfer: false,
    permanentAuthorityTransfer: false,
    implicitGovernanceChange: false,
    governanceMutation: false,
    unboundedAction: false,
    delegationWithoutAttribution: false,
    automaticConsensus: false,
    delegatedConsensus: false
  });
  grant.delegationHash = delegationHash(grant);
  return grant;
}

function buildDelegatedAction(options = {}) {
  const action = normalizeAction(options.action);
  const delegatedAction = stripUndefined({
    id: options.id || deterministicId("dla", "delegated_action", {
      delegationId: options.delegationId,
      delegateId: options.delegateId,
      action,
      scope: options.scope
    }),
    object: "delegatedAction",
    delegationId: options.delegationId || null,
    threadId: options.threadId || null,
    delegateId: options.delegateId || null,
    delegateType: normalizeDelegateType(options.delegateType || "participant"),
    action,
    scope: normalizeText(options.scope),
    targetObjectType: options.targetObjectType || null,
    targetObjectId: options.targetObjectId || null,
    summary: options.summary || null,
    recordedAt: options.recordedAt || null,
    attribution: stripUndefined({
      delegateId: options.delegateId || null,
      delegationId: options.delegationId || null,
      action
    }),
    authoritySurrender: false,
    authorityTransfer: false,
    governanceMutation: false,
    unboundedAction: false,
    delegationWithoutAttribution: false,
    unattributedAction: false,
    automaticConsensus: false,
    delegatedConsensus: false
  });
  delegatedAction.delegationHash = delegationHash(delegatedAction);
  return delegatedAction;
}

function buildDelegationRevocation(options = {}) {
  const revocation = stripUndefined({
    id: options.id || deterministicId("dlr", "delegation_revocation", {
      delegationId: options.delegationId,
      revokedByParticipantId: options.revokedByParticipantId
    }),
    object: "delegationRevocation",
    delegationId: options.delegationId || null,
    threadId: options.threadId || null,
    revokedByParticipantId: options.revokedByParticipantId || null,
    reason: options.reason || null,
    revokedAt: options.revokedAt || null,
    authoritySurrender: false,
    authorityTransfer: false,
    governanceMutation: false,
    automaticConsensus: false
  });
  revocation.delegationHash = delegationHash(revocation);
  return revocation;
}

function buildDelegationExpiration(options = {}) {
  const expiration = stripUndefined({
    id: options.id || deterministicId("dle", "delegation_expiration", {
      delegationId: options.delegationId,
      expiredAt: options.expiredAt
    }),
    object: "delegationExpiration",
    delegationId: options.delegationId || null,
    threadId: options.threadId || null,
    expiredAt: options.expiredAt || null,
    reason: options.reason || null,
    authoritySurrender: false,
    authorityTransfer: false,
    governanceMutation: false,
    automaticConsensus: false
  });
  expiration.delegationHash = delegationHash(expiration);
  return expiration;
}

function buildDelegationViolation(options = {}) {
  const violation = stripUndefined({
    id: options.id || deterministicId("dlv", "delegation_violation", {
      delegationId: options.delegationId,
      actionId: options.actionId,
      violationType: options.violationType
    }),
    object: "delegationViolation",
    delegationId: options.delegationId || null,
    actionId: options.actionId || null,
    threadId: options.threadId || null,
    violationType: normalizeText(options.violationType),
    reason: options.reason || null,
    detectedByParticipantId: options.detectedByParticipantId || null,
    detectedAt: options.detectedAt || null,
    authoritySurrender: false,
    authorityTransfer: false,
    governanceMutation: false,
    automaticConsensus: false
  });
  violation.delegationHash = delegationHash(violation);
  return violation;
}

function delegationForId(delegationProjection, delegationId) {
  return {
    schema: "clista.delegation.item.v0",
    delegationId,
    grant: delegationProjection.byGrant[delegationId] || null,
    actions: delegationProjection.actionsByDelegation[delegationId] || [],
    revocations: delegationProjection.revocationsByDelegation[delegationId] || [],
    expirations: delegationProjection.expirationsByDelegation[delegationId] || [],
    violations: delegationProjection.violationsByDelegation[delegationId] || []
  };
}

function selectDelegationForThread(delegationProjection, threadId) {
  const grants = delegationProjection.grants.filter((grant) => grant.threadId === threadId);
  const grantIds = new Set(grants.map((grant) => grant.id));
  const byThreadOrGrant = (record) => record.threadId === threadId || grantIds.has(record.delegationId);
  return {
    schema: "clista.delegation.thread.v0",
    threadId,
    theorem: delegationProjection.theorem,
    hardLaw: delegationProjection.hardLaw,
    grants,
    activeGrants: grants.filter((grant) => grant.status === "active"),
    revokedGrants: grants.filter((grant) => grant.status === "revoked"),
    expiredGrants: grants.filter((grant) => grant.status === "expired"),
    violatedGrants: grants.filter((grant) => grant.status === "violated"),
    actions: delegationProjection.actions.filter(byThreadOrGrant),
    revocations: delegationProjection.revocations.filter(byThreadOrGrant),
    expirations: delegationProjection.expirations.filter(byThreadOrGrant),
    violations: delegationProjection.violations.filter(byThreadOrGrant)
  };
}

function validateDelegationGrant(grant) {
  const reasons = [];
  if (!grant?.id) {
    reasons.push("delegation grant requires id");
  }
  if (grant?.object && grant.object !== "delegationGrant") {
    reasons.push("delegation grant object must be delegationGrant");
  }
  if (!grant?.threadId) {
    reasons.push("delegation grant requires threadId");
  }
  if (!grant?.delegatorParticipantId) {
    reasons.push("delegation grant requires delegatorParticipantId");
  }
  if (!grant?.delegateId) {
    reasons.push("delegation grant requires delegateId");
  }
  if (!grant?.delegateType) {
    reasons.push("delegation grant requires delegateType participant, agent, tool, or context");
  } else if (!DELEGATE_TYPES.has(normalizeDelegateType(grant.delegateType))) {
    reasons.push("delegation grant requires delegateType participant, agent, tool, or context");
  }
  if (!normalizeAction(grant?.action)) {
    reasons.push("delegation grant requires action");
  }
  if (!normalizeText(grant?.scope)) {
    reasons.push("delegation grant requires scope");
  }
  if (!arrayValues(grant?.limits).length) {
    reasons.push("delegation grant requires at least one limit");
  }
  if (grant?.attributionRequired !== true) {
    reasons.push("delegation grant requires attributionRequired true");
  }
  if (grant?.status && !STATUS_VALUES.has(normalizeStatus(grant.status))) {
    reasons.push("delegation grant requires status active, revoked, expired, or violated");
  }
  if (grant?.expiresAt && !isValidDateString(grant.expiresAt)) {
    reasons.push("delegation grant expiresAt must be a valid date");
  }
  reasons.push(...rejectDelegationGuardFields(grant));
  return reasons;
}

function validateDelegatedAction(action) {
  const reasons = [];
  if (!action?.id) {
    reasons.push("delegated action requires id");
  }
  if (action?.object && action.object !== "delegatedAction") {
    reasons.push("delegated action object must be delegatedAction");
  }
  if (!action?.delegationId) {
    reasons.push("delegated action requires delegationId");
  }
  if (!action?.threadId) {
    reasons.push("delegated action requires threadId");
  }
  if (!action?.delegateId) {
    reasons.push("delegated action requires delegateId");
  }
  if (!action?.delegateType) {
    reasons.push("delegated action requires delegateType participant, agent, tool, or context");
  } else if (!DELEGATE_TYPES.has(normalizeDelegateType(action.delegateType))) {
    reasons.push("delegated action requires delegateType participant, agent, tool, or context");
  }
  if (!normalizeAction(action?.action)) {
    reasons.push("delegated action requires action");
  }
  if (!normalizeText(action?.scope)) {
    reasons.push("delegated action requires scope");
  }
  if (!action?.summary) {
    reasons.push("delegated action requires summary");
  }
  if (!action?.attribution || typeof action.attribution !== "object") {
    reasons.push("delegated action requires attribution");
  } else {
    if (action.attribution.delegateId !== action.delegateId) {
      reasons.push("delegated action attribution must match delegateId");
    }
    if (action.attribution.delegationId !== action.delegationId) {
      reasons.push("delegated action attribution must match delegationId");
    }
  }
  reasons.push(...rejectDelegationGuardFields(action));
  return reasons;
}

function validateDelegationRevocation(revocation) {
  const reasons = [];
  if (!revocation?.id) {
    reasons.push("delegation revocation requires id");
  }
  if (revocation?.object && revocation.object !== "delegationRevocation") {
    reasons.push("delegation revocation object must be delegationRevocation");
  }
  if (!revocation?.delegationId) {
    reasons.push("delegation revocation requires delegationId");
  }
  if (!revocation?.revokedByParticipantId) {
    reasons.push("delegation revocation requires revokedByParticipantId");
  }
  if (!revocation?.reason) {
    reasons.push("delegation revocation requires reason");
  }
  reasons.push(...rejectDelegationGuardFields(revocation));
  return reasons;
}

function validateDelegationExpiration(expiration) {
  const reasons = [];
  if (!expiration?.id) {
    reasons.push("delegation expiration requires id");
  }
  if (expiration?.object && expiration.object !== "delegationExpiration") {
    reasons.push("delegation expiration object must be delegationExpiration");
  }
  if (!expiration?.delegationId) {
    reasons.push("delegation expiration requires delegationId");
  }
  if (!expiration?.expiredAt) {
    reasons.push("delegation expiration requires expiredAt");
  } else if (!isValidDateString(expiration.expiredAt)) {
    reasons.push("delegation expiration expiredAt must be a valid date");
  }
  reasons.push(...rejectDelegationGuardFields(expiration));
  return reasons;
}

function validateDelegationViolation(violation) {
  const reasons = [];
  if (!violation?.id) {
    reasons.push("delegation violation requires id");
  }
  if (violation?.object && violation.object !== "delegationViolation") {
    reasons.push("delegation violation object must be delegationViolation");
  }
  if (!violation?.delegationId) {
    reasons.push("delegation violation requires delegationId");
  }
  if (!violation?.violationType) {
    reasons.push("delegation violation requires violationType");
  }
  if (!violation?.reason) {
    reasons.push("delegation violation requires reason");
  }
  reasons.push(...rejectDelegationGuardFields(violation));
  return reasons;
}

function normalizeDelegationGrant(grant, event) {
  if (!grant) {
    return null;
  }
  const normalized = stripUndefined({
    ...grant,
    id: grant.id || deterministicId("dlg", "delegation_grant", event.event_id),
    object: "delegationGrant",
    threadId: grant.threadId || event.thread_id,
    delegateType: normalizeDelegateType(grant.delegateType || "participant"),
    action: normalizeAction(grant.action),
    scope: normalizeText(grant.scope),
    authorityRequired: normalizeAuthority(grant.authorityRequired || "decision_owner"),
    limits: unique(arrayValues(grant.limits)),
    attributionRequired: true,
    status: normalizeStatus(grant.status || "active"),
    grantedAt: grant.grantedAt || event.timestamp,
    sourceEventId: event.event_id,
    authoritySurrender: false,
    authorityTransfer: false,
    permanentAuthorityTransfer: false,
    implicitGovernanceChange: false,
    governanceMutation: false,
    unboundedAction: false,
    delegationWithoutAttribution: false,
    automaticConsensus: false,
    delegatedConsensus: false
  });
  normalized.delegationHash = delegationHash(normalized);
  return normalized;
}

function normalizeDelegatedAction(action, event) {
  if (!action) {
    return null;
  }
  const normalized = stripUndefined({
    ...action,
    id: action.id || deterministicId("dla", "delegated_action", event.event_id),
    object: "delegatedAction",
    threadId: action.threadId || event.thread_id,
    delegateType: normalizeDelegateType(action.delegateType || "participant"),
    action: normalizeAction(action.action),
    scope: normalizeText(action.scope),
    recordedAt: action.recordedAt || event.timestamp,
    sourceEventId: event.event_id,
    authoritySurrender: false,
    authorityTransfer: false,
    governanceMutation: false,
    unboundedAction: false,
    delegationWithoutAttribution: false,
    unattributedAction: false,
    automaticConsensus: false,
    delegatedConsensus: false
  });
  normalized.delegationHash = delegationHash(normalized);
  return normalized;
}

function normalizeDelegationRevocation(revocation, event) {
  if (!revocation) {
    return null;
  }
  const normalized = stripUndefined({
    ...revocation,
    id: revocation.id || deterministicId("dlr", "delegation_revocation", event.event_id),
    object: "delegationRevocation",
    threadId: revocation.threadId || event.thread_id,
    revokedAt: revocation.revokedAt || event.timestamp,
    sourceEventId: event.event_id,
    authoritySurrender: false,
    authorityTransfer: false,
    governanceMutation: false,
    automaticConsensus: false
  });
  normalized.delegationHash = delegationHash(normalized);
  return normalized;
}

function normalizeDelegationExpiration(expiration, event) {
  if (!expiration) {
    return null;
  }
  const normalized = stripUndefined({
    ...expiration,
    id: expiration.id || deterministicId("dle", "delegation_expiration", event.event_id),
    object: "delegationExpiration",
    threadId: expiration.threadId || event.thread_id,
    expiredAt: expiration.expiredAt || event.timestamp,
    sourceEventId: event.event_id,
    authoritySurrender: false,
    authorityTransfer: false,
    governanceMutation: false,
    automaticConsensus: false
  });
  normalized.delegationHash = delegationHash(normalized);
  return normalized;
}

function normalizeDelegationViolation(violation, event) {
  if (!violation) {
    return null;
  }
  const normalized = stripUndefined({
    ...violation,
    id: violation.id || deterministicId("dlv", "delegation_violation", event.event_id),
    object: "delegationViolation",
    threadId: violation.threadId || event.thread_id,
    violationType: normalizeText(violation.violationType),
    detectedAt: violation.detectedAt || event.timestamp,
    sourceEventId: event.event_id,
    authoritySurrender: false,
    authorityTransfer: false,
    governanceMutation: false,
    automaticConsensus: false
  });
  normalized.delegationHash = delegationHash(normalized);
  return normalized;
}

function delegationStatusForGrant(grant, records) {
  if (records.revocations.some((record) => record.delegationId === grant.id)) {
    return "revoked";
  }
  if (records.expirations.some((record) => record.delegationId === grant.id)) {
    return "expired";
  }
  if (records.violations.some((record) => record.delegationId === grant.id)) {
    return "violated";
  }
  return "active";
}

function rejectDelegationGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`delegation field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectDelegationGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function delegationHash(record) {
  return contentHash({
    object: record.object,
    id: record.id,
    delegationId: record.delegationId || null,
    threadId: record.threadId || null,
    delegatorParticipantId: record.delegatorParticipantId || null,
    delegateId: record.delegateId || null,
    action: record.action || null,
    scope: record.scope || null,
    status: record.status || null,
    authoritySurrender: false,
    authorityTransfer: false,
    governanceMutation: false,
    automaticConsensus: false
  });
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizeText(type).slice(0, 24) || "delegation"}_${hash}`;
}

function normalizeStatus(status) {
  return String(status || "active").trim().toLowerCase();
}

function normalizeAction(action) {
  return normalizeText(action);
}

function normalizeDelegateType(type) {
  return normalizeText(type || "participant");
}

function normalizeAuthority(authority) {
  return normalizeText(authority || "decision_owner");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isValidDateString(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const date = new Date(`${value}T00:00:00.000Z`);
    return date.getUTCFullYear() === Number(year)
      && date.getUTCMonth() + 1 === Number(month)
      && date.getUTCDate() === Number(day);
  }
  return !Number.isNaN(Date.parse(value));
}

function addRecord(records, record) {
  if (record) {
    records.push(record);
  }
}



function arrayValues(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
}



module.exports = {
  DELEGATION_EVENT_TYPES,
  buildDelegatedAction,
  buildDelegationExpiration,
  buildDelegationGrant,
  buildDelegationRevocation,
  buildDelegationState,
  buildDelegationViolation,
  delegationForId,
  projectDelegation,
  selectDelegationForThread,
  validateDelegatedAction,
  validateDelegationExpiration,
  validateDelegationGrant,
  validateDelegationRevocation,
  validateDelegationViolation
};
