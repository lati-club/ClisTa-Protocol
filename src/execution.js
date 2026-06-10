const { PROTOCOL_VERSION, contentHash } = require("./integrity");
const { groupBy, indexBy, stripUndefined, unique } = require("./utils");

const EXECUTION_SCHEMA = "clista.execution.v0";
const EXECUTION_PROTOCOL_VERSION = "0.20.0";
const EXECUTION_THEOREM = "protocol_execution = perform(authorized_action, under_verified_constraints)";
const EXECUTION_HARD_LAW = "execution != intent";

const EXECUTION_EVENT_TYPES = new Set([
  "ExecutionStarted",
  "ExecutionCompleted",
  "ExecutionFailed",
  "ExecutionRolledBack",
  "ExecutionViolationRecorded"
]);

const STATUS_VALUES = new Set(["active", "completed", "failed", "rolled_back", "violated"]);
const AUTHORIZATION_TYPES = new Set(["decision", "delegation"]);

const GUARD_FIELDS = new Set([
  "authorityCreated",
  "authorityGranted",
  "executionAsAuthorization",
  "consensusCreated",
  "executionAsConsensus",
  "governanceApproval",
  "governanceMutation",
  "governanceMerge",
  "amendmentApproval",
  "automaticAmendment",
  "silentCompletion",
  "silentFailure",
  "silentRollback",
  "completionByAssertionOnly",
  "intentOnly"
]);

function emptyExecutionState() {
  return {
    starts: [],
    completions: [],
    failures: [],
    rollbacks: [],
    violations: []
  };
}

function buildExecutionState(projection = {}) {
  const state = emptyExecutionState();
  applyExplicitExecutionEvents(projection.events || [], state);
  return state;
}

function applyExplicitExecutionEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "ExecutionStarted":
        addRecord(state.starts, normalizeExecutionRecord(payload.executionRecord, event, "active"));
        break;
      case "ExecutionCompleted":
        addRecord(state.completions, normalizeExecutionRecord(payload.executionRecord, event, "completed"));
        break;
      case "ExecutionFailed":
        addRecord(state.failures, normalizeExecutionRecord(payload.executionRecord, event, "failed"));
        break;
      case "ExecutionRolledBack":
        addRecord(state.rollbacks, normalizeExecutionRecord(payload.executionRecord, event, "rolled_back"));
        break;
      case "ExecutionViolationRecorded":
        addRecord(state.violations, normalizeExecutionViolation(payload.executionViolation, event));
        break;
      default:
        break;
    }
  }
}

function projectExecution(state = emptyExecutionState()) {
  const starts = state.starts.filter(Boolean);
  const completions = state.completions.filter(Boolean);
  const failures = state.failures.filter(Boolean);
  const rollbacks = state.rollbacks.filter(Boolean);
  const violations = state.violations.filter(Boolean);
  const records = starts.map((start) => mergeExecutionRecord(start, {
    completion: lastForExecution(completions, start.id),
    failure: lastForExecution(failures, start.id),
    rollback: lastForExecution(rollbacks, start.id),
    violations: violations.filter((violation) => violation.executionId === start.id)
  }));

  return {
    schema: EXECUTION_SCHEMA,
    theorem: EXECUTION_THEOREM,
    hardLaw: EXECUTION_HARD_LAW,
    executionProtocolVersion: EXECUTION_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    statuses: Array.from(STATUS_VALUES),
    records,
    active: records.filter((record) => record.status === "active"),
    completed: records.filter((record) => record.status === "completed"),
    failed: records.filter((record) => record.status === "failed"),
    rolled_back: records.filter((record) => record.status === "rolled_back"),
    violated: records.filter((record) => record.status === "violated"),
    starts,
    completions,
    failures,
    rollbacks,
    violations,
    byExecution: indexBy(records, "id"),
    byStart: indexBy(starts, "id"),
    byCompletion: indexBy(completions, "id"),
    byFailure: indexBy(failures, "id"),
    byRollback: indexBy(rollbacks, "id"),
    byViolation: indexBy(violations, "id"),
    completionsByExecution: groupBy(completions, "id"),
    failuresByExecution: groupBy(failures, "id"),
    rollbacksByExecution: groupBy(rollbacks, "id"),
    violationsByExecution: groupBy(violations, "executionId"),
    executionValidationStatus: {
      valid: true,
      recordCount: records.length,
      activeCount: records.filter((record) => record.status === "active").length,
      completedCount: records.filter((record) => record.status === "completed").length,
      failedCount: records.filter((record) => record.status === "failed").length,
      rolledBackCount: records.filter((record) => record.status === "rolled_back").length,
      violationCount: violations.length,
      authorityCreated: false,
      executionAsAuthorization: false,
      consensusCreated: false,
      executionAsConsensus: false,
      governanceApproval: false,
      amendmentApproval: false,
      completionByAssertionOnly: false,
      silentCompletion: false,
      silentFailure: false,
      silentRollback: false
    }
  };
}

function buildExecutionStart(options = {}) {
  return buildExecutionRecord({
    ...options,
    status: "active",
    startedAt: options.startedAt
  });
}

function buildExecutionCompletion(options = {}) {
  return buildExecutionRecord({
    ...options,
    status: "completed",
    completedAt: options.completedAt
  });
}

function buildExecutionFailure(options = {}) {
  return buildExecutionRecord({
    ...options,
    status: "failed",
    failedAt: options.failedAt
  });
}

function buildExecutionRollback(options = {}) {
  return buildExecutionRecord({
    ...options,
    status: "rolled_back",
    rolledBackAt: options.rolledBackAt
  });
}

function buildExecutionRecord(options = {}) {
  const authorizationRef = normalizeAuthorizationRef(options);
  const actionType = normalizeText(options.actionType || options.action);
  const scope = normalizeText(options.scope);
  const record = stripUndefined({
    id: options.id || deterministicId("exe", "execution_record", {
      actorId: options.actorId,
      authorizationRef,
      actionType,
      scope
    }),
    object: "executionRecord",
    threadId: options.threadId || null,
    actorId: options.actorId || null,
    authorizationRef,
    delegationId: options.delegationId || (authorizationRef?.type === "delegation" ? authorizationRef.id : null),
    decisionId: options.decisionId || (authorizationRef?.type === "decision" ? authorizationRef.id : null),
    actionType,
    scope,
    constraints: unique(arrayValues(options.constraints)),
    status: normalizeStatus(options.status || "active"),
    startedAt: options.startedAt || null,
    completedAt: options.completedAt || null,
    failedAt: options.failedAt || null,
    rolledBackAt: options.rolledBackAt || null,
    evidence: normalizeEvidence(options.evidence),
    summary: options.summary || null,
    failureReason: options.failureReason || options.reason || null,
    rollbackReason: options.rollbackReason || options.reason || null,
    attribution: buildExecutionAttribution({
      actorId: options.actorId,
      authorizationRef,
      actionType,
      delegationId: options.delegationId,
      decisionId: options.decisionId
    }),
    authorityCreated: false,
    executionAsAuthorization: false,
    consensusCreated: false,
    executionAsConsensus: false,
    governanceApproval: false,
    governanceMutation: false,
    governanceMerge: false,
    amendmentApproval: false,
    silentCompletion: false,
    silentFailure: false,
    silentRollback: false,
    completionByAssertionOnly: false,
    intentOnly: false
  });
  record.executionHash = executionHash(record);
  return record;
}

function buildExecutionViolation(options = {}) {
  const violation = stripUndefined({
    id: options.id || deterministicId("exv", "execution_violation", {
      executionId: options.executionId,
      violationType: options.violationType
    }),
    object: "executionViolation",
    executionId: options.executionId || null,
    threadId: options.threadId || null,
    violationType: normalizeText(options.violationType),
    reason: options.reason || null,
    detectedByParticipantId: options.detectedByParticipantId || null,
    detectedAt: options.detectedAt || null,
    authorityCreated: false,
    executionAsAuthorization: false,
    consensusCreated: false,
    executionAsConsensus: false,
    governanceApproval: false,
    amendmentApproval: false
  });
  violation.executionHash = executionHash(violation);
  return violation;
}

function executionForId(executionProjection, executionId) {
  return {
    schema: "clista.execution.item.v0",
    executionId,
    record: executionProjection.byExecution[executionId] || null,
    starts: executionProjection.starts.filter((record) => record.id === executionId),
    completions: executionProjection.completionsByExecution[executionId] || [],
    failures: executionProjection.failuresByExecution[executionId] || [],
    rollbacks: executionProjection.rollbacksByExecution[executionId] || [],
    violations: executionProjection.violationsByExecution[executionId] || []
  };
}

function selectExecutionForThread(executionProjection, threadId) {
  const records = executionProjection.records.filter((record) => record.threadId === threadId);
  const executionIds = new Set(records.map((record) => record.id));
  const byThreadOrExecution = (record) => record.threadId === threadId || executionIds.has(record.id || record.executionId);
  return {
    schema: "clista.execution.thread.v0",
    threadId,
    theorem: executionProjection.theorem,
    hardLaw: executionProjection.hardLaw,
    records,
    active: records.filter((record) => record.status === "active"),
    completed: records.filter((record) => record.status === "completed"),
    failed: records.filter((record) => record.status === "failed"),
    rolled_back: records.filter((record) => record.status === "rolled_back"),
    violated: records.filter((record) => record.status === "violated"),
    starts: executionProjection.starts.filter(byThreadOrExecution),
    completions: executionProjection.completions.filter(byThreadOrExecution),
    failures: executionProjection.failures.filter(byThreadOrExecution),
    rollbacks: executionProjection.rollbacks.filter(byThreadOrExecution),
    violations: executionProjection.violations.filter(byThreadOrExecution)
  };
}

function validateExecutionStart(record) {
  const reasons = validateExecutionRecordBase(record);
  if (record?.status && normalizeStatus(record.status) !== "active") {
    reasons.push("execution start status must be active");
  }
  if (!record?.startedAt) {
    reasons.push("execution start requires startedAt");
  }
  return reasons;
}

function validateExecutionCompletion(record) {
  const reasons = validateExecutionRecordBase(record);
  if (normalizeStatus(record?.status) !== "completed") {
    reasons.push("execution completion status must be completed");
  }
  if (!record?.completedAt) {
    reasons.push("execution completion requires completedAt");
  }
  if (!normalizeEvidence(record?.evidence).length) {
    reasons.push("execution completion requires evidence");
  }
  return reasons;
}

function validateExecutionFailure(record) {
  const reasons = validateExecutionRecordBase(record);
  if (normalizeStatus(record?.status) !== "failed") {
    reasons.push("execution failure status must be failed");
  }
  if (!record?.failedAt) {
    reasons.push("execution failure requires failedAt");
  }
  if (!record?.failureReason) {
    reasons.push("execution failure requires failureReason");
  }
  return reasons;
}

function validateExecutionRollback(record) {
  const reasons = validateExecutionRecordBase(record);
  if (normalizeStatus(record?.status) !== "rolled_back") {
    reasons.push("execution rollback status must be rolled_back");
  }
  if (!record?.rolledBackAt) {
    reasons.push("execution rollback requires rolledBackAt");
  }
  if (!record?.rollbackReason) {
    reasons.push("execution rollback requires rollbackReason");
  }
  if (!normalizeEvidence(record?.evidence).length) {
    reasons.push("execution rollback requires evidence");
  }
  return reasons;
}

function validateExecutionViolation(violation) {
  const reasons = [];
  if (!violation?.id) {
    reasons.push("execution violation requires id");
  }
  if (violation?.object && violation.object !== "executionViolation") {
    reasons.push("execution violation object must be executionViolation");
  }
  if (!violation?.executionId) {
    reasons.push("execution violation requires executionId");
  }
  if (!violation?.threadId) {
    reasons.push("execution violation requires threadId");
  }
  if (!normalizeText(violation?.violationType)) {
    reasons.push("execution violation requires violationType");
  }
  if (!violation?.reason) {
    reasons.push("execution violation requires reason");
  }
  if (!violation?.detectedByParticipantId) {
    reasons.push("execution violation requires detectedByParticipantId");
  }
  reasons.push(...rejectExecutionGuardFields(violation));
  return reasons;
}

function validateExecutionRecordBase(record) {
  const reasons = [];
  if (!record?.id) {
    reasons.push("execution record requires id");
  }
  if (record?.object && record.object !== "executionRecord") {
    reasons.push("execution record object must be executionRecord");
  }
  if (!record?.threadId) {
    reasons.push("execution record requires threadId");
  }
  if (!record?.actorId) {
    reasons.push("execution record requires actorId");
  }
  const authorizationReasons = validateAuthorizationRef(record?.authorizationRef);
  reasons.push(...authorizationReasons);
  if (!normalizeText(record?.actionType)) {
    reasons.push("execution record requires actionType");
  }
  if (!normalizeText(record?.scope)) {
    reasons.push("execution record requires scope");
  }
  if (!arrayValues(record?.constraints).length) {
    reasons.push("execution record requires at least one constraint");
  }
  if (record?.status && !STATUS_VALUES.has(normalizeStatus(record.status))) {
    reasons.push("execution record requires status active, completed, failed, rolled_back, or violated");
  }
  if (!record?.attribution || typeof record.attribution !== "object") {
    reasons.push("execution record requires attribution");
  } else {
    if (record.attribution.actorId !== record.actorId) {
      reasons.push("execution attribution must match actorId");
    }
    if (record.attribution.authorizationRef?.id !== record.authorizationRef?.id
      || record.attribution.authorizationRef?.type !== record.authorizationRef?.type) {
      reasons.push("execution attribution must match authorizationRef");
    }
  }
  reasons.push(...rejectExecutionGuardFields(record));
  return reasons;
}

function validateAuthorizationRef(ref) {
  const reasons = [];
  if (!ref || typeof ref !== "object") {
    reasons.push("execution record requires authorizationRef");
    return reasons;
  }
  if (!AUTHORIZATION_TYPES.has(normalizeText(ref.type))) {
    reasons.push("execution authorizationRef type must be decision or delegation");
  }
  if (!ref.id) {
    reasons.push("execution authorizationRef requires id");
  }
  return reasons;
}

function normalizeExecutionRecord(record, event, status) {
  if (!record) {
    return null;
  }
  const normalized = stripUndefined({
    ...record,
    id: record.id || deterministicId("exe", "execution_record", event.event_id),
    object: "executionRecord",
    threadId: record.threadId || event.thread_id,
    actorId: record.actorId || event.actor_id,
    authorizationRef: normalizeAuthorizationRef(record),
    delegationId: record.delegationId || (record.authorizationRef?.type === "delegation" ? record.authorizationRef.id : null),
    decisionId: record.decisionId || (record.authorizationRef?.type === "decision" ? record.authorizationRef.id : null),
    actionType: normalizeText(record.actionType || record.action),
    scope: normalizeText(record.scope),
    constraints: unique(arrayValues(record.constraints)),
    status: normalizeStatus(status || record.status || "active"),
    evidence: normalizeEvidence(record.evidence),
    sourceEventId: event.event_id,
    authorityCreated: false,
    executionAsAuthorization: false,
    consensusCreated: false,
    executionAsConsensus: false,
    governanceApproval: false,
    governanceMutation: false,
    governanceMerge: false,
    amendmentApproval: false,
    silentCompletion: false,
    silentFailure: false,
    silentRollback: false,
    completionByAssertionOnly: false,
    intentOnly: false
  });
  normalized.attribution = normalized.attribution || buildExecutionAttribution(normalized);
  normalized.executionHash = executionHash(normalized);
  return normalized;
}

function normalizeExecutionViolation(violation, event) {
  if (!violation) {
    return null;
  }
  const normalized = stripUndefined({
    ...violation,
    id: violation.id || deterministicId("exv", "execution_violation", event.event_id),
    object: "executionViolation",
    threadId: violation.threadId || event.thread_id,
    violationType: normalizeText(violation.violationType),
    detectedAt: violation.detectedAt || event.timestamp,
    sourceEventId: event.event_id,
    authorityCreated: false,
    executionAsAuthorization: false,
    consensusCreated: false,
    executionAsConsensus: false,
    governanceApproval: false,
    amendmentApproval: false
  });
  normalized.executionHash = executionHash(normalized);
  return normalized;
}

function mergeExecutionRecord(start, { completion, failure, rollback, violations }) {
  const applied = {
    ...start,
    status: executionStatus({ completion, failure, rollback, violations }),
    completedAt: completion?.completedAt || null,
    failedAt: failure?.failedAt || null,
    rolledBackAt: rollback?.rolledBackAt || null,
    evidence: [
      ...normalizeEvidence(start.evidence),
      ...normalizeEvidence(completion?.evidence),
      ...normalizeEvidence(rollback?.evidence)
    ],
    summary: completion?.summary || failure?.summary || rollback?.summary || start.summary || null,
    failureReason: failure?.failureReason || null,
    rollbackReason: rollback?.rollbackReason || null,
    violations
  };
  applied.executionHash = executionHash(applied);
  return stripUndefined(applied);
}

function executionStatus({ completion, failure, rollback, violations }) {
  if (violations?.length) {
    return "violated";
  }
  if (rollback) {
    return "rolled_back";
  }
  if (failure) {
    return "failed";
  }
  if (completion) {
    return "completed";
  }
  return "active";
}

function buildExecutionAttribution(options = {}) {
  return stripUndefined({
    actorId: options.actorId || null,
    authorizationRef: options.authorizationRef || null,
    delegationId: options.delegationId || (options.authorizationRef?.type === "delegation" ? options.authorizationRef.id : null),
    decisionId: options.decisionId || (options.authorizationRef?.type === "decision" ? options.authorizationRef.id : null),
    actionType: options.actionType || null
  });
}

function normalizeAuthorizationRef(options = {}) {
  const ref = options.authorizationRef;
  if (ref && typeof ref === "object") {
    return {
      type: normalizeText(ref.type),
      id: ref.id || null
    };
  }
  if (options.delegationId) {
    return { type: "delegation", id: options.delegationId };
  }
  if (options.decisionId) {
    return { type: "decision", id: options.decisionId };
  }
  return null;
}

function rejectExecutionGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`execution field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectExecutionGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function executionHash(record) {
  return contentHash({
    object: record.object,
    id: record.id,
    threadId: record.threadId || null,
    actorId: record.actorId || null,
    authorizationRef: record.authorizationRef || null,
    actionType: record.actionType || null,
    scope: record.scope || null,
    constraints: record.constraints || [],
    status: record.status || null,
    startedAt: record.startedAt || null,
    completedAt: record.completedAt || null,
    failedAt: record.failedAt || null,
    rolledBackAt: record.rolledBackAt || null,
    evidence: record.evidence || [],
    failureReason: record.failureReason || null,
    rollbackReason: record.rollbackReason || null,
    violationType: record.violationType || null,
    reason: record.reason || null,
    authorityCreated: false,
    executionAsAuthorization: false,
    consensusCreated: false,
    governanceApproval: false,
    amendmentApproval: false
  });
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizeText(type).slice(0, 24) || "execution"}_${hash}`;
}

function lastForExecution(records, executionId) {
  return records.filter((record) => record.id === executionId).at(-1) || null;
}

function normalizeStatus(status) {
  return String(status || "active").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeEvidence(value) {
  return arrayValues(value).map((item) => {
    if (item && typeof item === "object") {
      return item;
    }
    return { type: "text", value: String(item) };
  }).filter((item) => item.value || item.id || item.contentHash || item.source);
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
  EXECUTION_EVENT_TYPES,
  buildExecutionCompletion,
  buildExecutionFailure,
  buildExecutionRollback,
  buildExecutionStart,
  buildExecutionState,
  buildExecutionViolation,
  executionForId,
  projectExecution,
  selectExecutionForThread,
  validateExecutionCompletion,
  validateExecutionFailure,
  validateExecutionRollback,
  validateExecutionStart,
  validateExecutionViolation
};
