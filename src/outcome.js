const { PROTOCOL_VERSION, contentHash } = require("./integrity");

const OUTCOME_SCHEMA = "clista.outcome.v0";
const OUTCOME_PROTOCOL_VERSION = "0.21.0";
const OUTCOME_THEOREM = "protocol_outcome = evaluate(execution_result, against_intended_effect)";
const OUTCOME_HARD_LAW = "completion != success";

const OUTCOME_EVENT_TYPES = new Set([
  "OutcomeExpected",
  "OutcomeObserved",
  "OutcomeEvaluated",
  "OutcomeDisputed",
  "OutcomeViolationRecorded"
]);

const STATUS_VALUES = new Set(["pending", "observed", "evaluated", "disputed", "violated"]);
const EVALUATION_RESULTS = new Set(["success", "partial_success", "failure", "inconclusive"]);

const GUARD_FIELDS = new Set([
  "completionAsSuccess",
  "successByAssertion",
  "outcomeAsConsensus",
  "consensusCreated",
  "governanceApproval",
  "amendmentApproval",
  "authorityCreated",
  "retroactiveExpectedEffect",
  "unmeasuredImpactAchieved",
  "silentUnintendedConsequence",
  "governanceMutation",
  "stateMutation"
]);

function emptyOutcomeState() {
  return {
    expectations: [],
    observations: [],
    evaluations: [],
    disputes: [],
    violations: []
  };
}

function buildOutcomeState(projection = {}) {
  const state = emptyOutcomeState();
  applyExplicitOutcomeEvents(projection.events || [], state);
  return state;
}

function applyExplicitOutcomeEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "OutcomeExpected":
        addRecord(state.expectations, normalizeOutcomeRecord(payload.outcomeRecord, event, "pending"));
        break;
      case "OutcomeObserved":
        addRecord(state.observations, normalizeOutcomeRecord(payload.outcomeRecord, event, "observed"));
        break;
      case "OutcomeEvaluated":
        addRecord(state.evaluations, normalizeOutcomeRecord(payload.outcomeRecord, event, "evaluated"));
        break;
      case "OutcomeDisputed":
        addRecord(state.disputes, normalizeOutcomeDispute(payload.outcomeDispute, event));
        break;
      case "OutcomeViolationRecorded":
        addRecord(state.violations, normalizeOutcomeViolation(payload.outcomeViolation, event));
        break;
      default:
        break;
    }
  }
}

function projectOutcome(state = emptyOutcomeState()) {
  const expectations = state.expectations.filter(Boolean);
  const observations = state.observations.filter(Boolean);
  const evaluations = state.evaluations.filter(Boolean);
  const disputes = state.disputes.filter(Boolean);
  const violations = state.violations.filter(Boolean);
  const records = expectations.map((expectation) => mergeOutcomeRecord(expectation, {
    observation: lastForOutcome(observations, expectation.id),
    evaluation: lastForOutcome(evaluations, expectation.id),
    disputes: disputes.filter((dispute) => dispute.outcomeId === expectation.id),
    violations: violations.filter((violation) => violation.outcomeId === expectation.id)
  }));

  return {
    schema: OUTCOME_SCHEMA,
    theorem: OUTCOME_THEOREM,
    hardLaw: OUTCOME_HARD_LAW,
    outcomeProtocolVersion: OUTCOME_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    statuses: Array.from(STATUS_VALUES),
    evaluationResults: Array.from(EVALUATION_RESULTS),
    records,
    expected: expectations,
    pending: records.filter((record) => record.status === "pending"),
    observed: records.filter((record) => record.status === "observed"),
    evaluated: records.filter((record) => record.status === "evaluated"),
    disputed: records.filter((record) => record.status === "disputed"),
    violated: records.filter((record) => record.status === "violated"),
    observations,
    evaluations,
    disputes,
    violations,
    byOutcome: indexBy(records, "id"),
    byExpected: indexBy(expectations, "id"),
    byObservation: indexBy(observations, "id"),
    byEvaluation: indexBy(evaluations, "id"),
    byDispute: indexBy(disputes, "id"),
    byViolation: indexBy(violations, "id"),
    observationsByOutcome: groupBy(observations, "id"),
    evaluationsByOutcome: groupBy(evaluations, "id"),
    disputesByOutcome: groupBy(disputes, "outcomeId"),
    violationsByOutcome: groupBy(violations, "outcomeId"),
    outcomeValidationStatus: {
      valid: true,
      recordCount: records.length,
      pendingCount: records.filter((record) => record.status === "pending").length,
      observedCount: records.filter((record) => record.status === "observed").length,
      evaluatedCount: records.filter((record) => record.status === "evaluated").length,
      disputeCount: disputes.length,
      violationCount: violations.length,
      completionAsSuccess: false,
      successByAssertion: false,
      outcomeAsConsensus: false,
      consensusCreated: false,
      governanceApproval: false,
      amendmentApproval: false,
      authorityCreated: false,
      retroactiveExpectedEffect: false,
      unmeasuredImpactAchieved: false,
      silentUnintendedConsequence: false,
      governanceMutation: false,
      stateMutation: false
    }
  };
}

function buildOutcomeExpectation(options = {}) {
  return buildOutcomeRecord({
    ...options,
    status: "pending",
    createdAt: options.createdAt
  });
}

function buildOutcomeObservation(options = {}) {
  return buildOutcomeRecord({
    ...options,
    status: "observed",
    observedAt: options.observedAt
  });
}

function buildOutcomeEvaluation(options = {}) {
  return buildOutcomeRecord({
    ...options,
    status: "evaluated",
    evaluatedAt: options.evaluatedAt
  });
}

function buildOutcomeRecord(options = {}) {
  const expectedEffect = normalizeEffect(options.expectedEffect || options.effect);
  const observedEffect = normalizeEffect(options.observedEffect);
  const evaluationResult = normalizeEvaluationResult(options.evaluationResult || options.result);
  const record = stripUndefined({
    id: options.id || deterministicId("oco", "outcome_record", {
      executionId: options.executionId,
      expectedEffect
    }),
    object: "outcomeRecord",
    executionId: options.executionId || null,
    threadId: options.threadId || null,
    actorId: options.actorId || null,
    expectedEffect,
    observedEffect: observedEffect || null,
    evidence: normalizeEvidence(options.evidence),
    evaluationResult: evaluationResult || null,
    comparison: options.comparison || null,
    confidence: numberOrNull(options.confidence),
    evaluatedByParticipantId: options.evaluatedByParticipantId || null,
    status: normalizeStatus(options.status || "pending"),
    createdAt: options.createdAt || null,
    observedAt: options.observedAt || null,
    evaluatedAt: options.evaluatedAt || null,
    attribution: buildOutcomeAttribution({
      actorId: options.actorId,
      executionId: options.executionId,
      outcomeId: options.id,
      evaluationResult
    }),
    completionAsSuccess: false,
    successByAssertion: false,
    outcomeAsConsensus: false,
    consensusCreated: false,
    governanceApproval: false,
    amendmentApproval: false,
    authorityCreated: false,
    retroactiveExpectedEffect: false,
    unmeasuredImpactAchieved: false,
    silentUnintendedConsequence: false
  });
  record.outcomeHash = outcomeHash(record);
  return record;
}

function buildOutcomeDispute(options = {}) {
  const dispute = stripUndefined({
    id: options.id || deterministicId("ods", "outcome_dispute", {
      outcomeId: options.outcomeId,
      disputedByParticipantId: options.disputedByParticipantId,
      reason: options.reason
    }),
    object: "outcomeDispute",
    outcomeId: options.outcomeId || null,
    executionId: options.executionId || null,
    threadId: options.threadId || null,
    reason: options.reason || null,
    disputedByParticipantId: options.disputedByParticipantId || null,
    disputedAt: options.disputedAt || null,
    completionAsSuccess: false,
    outcomeAsConsensus: false,
    consensusCreated: false,
    governanceApproval: false,
    amendmentApproval: false,
    authorityCreated: false
  });
  dispute.outcomeHash = outcomeHash(dispute);
  return dispute;
}

function buildOutcomeViolation(options = {}) {
  const violation = stripUndefined({
    id: options.id || deterministicId("ovl", "outcome_violation", {
      outcomeId: options.outcomeId,
      violationType: options.violationType
    }),
    object: "outcomeViolation",
    outcomeId: options.outcomeId || null,
    executionId: options.executionId || null,
    threadId: options.threadId || null,
    violationType: normalizeText(options.violationType),
    reason: options.reason || null,
    detectedByParticipantId: options.detectedByParticipantId || null,
    detectedAt: options.detectedAt || null,
    completionAsSuccess: false,
    successByAssertion: false,
    outcomeAsConsensus: false,
    consensusCreated: false,
    governanceApproval: false,
    amendmentApproval: false,
    authorityCreated: false,
    retroactiveExpectedEffect: false,
    unmeasuredImpactAchieved: false,
    silentUnintendedConsequence: false
  });
  violation.outcomeHash = outcomeHash(violation);
  return violation;
}

function outcomeForId(outcomeProjection, outcomeId) {
  return {
    schema: "clista.outcome.item.v0",
    outcomeId,
    record: outcomeProjection.byOutcome[outcomeId] || null,
    expected: outcomeProjection.expected.filter((record) => record.id === outcomeId),
    observations: outcomeProjection.observationsByOutcome[outcomeId] || [],
    evaluations: outcomeProjection.evaluationsByOutcome[outcomeId] || [],
    disputes: outcomeProjection.disputesByOutcome[outcomeId] || [],
    violations: outcomeProjection.violationsByOutcome[outcomeId] || []
  };
}

function selectOutcomeForThread(outcomeProjection, threadId) {
  const records = outcomeProjection.records.filter((record) => record.threadId === threadId);
  const outcomeIds = new Set(records.map((record) => record.id));
  const byThreadOrOutcome = (record) => record.threadId === threadId || outcomeIds.has(record.id || record.outcomeId);
  return {
    schema: "clista.outcome.thread.v0",
    threadId,
    theorem: outcomeProjection.theorem,
    hardLaw: outcomeProjection.hardLaw,
    records,
    expected: outcomeProjection.expected.filter(byThreadOrOutcome),
    pending: records.filter((record) => record.status === "pending"),
    observed: records.filter((record) => record.status === "observed"),
    evaluated: records.filter((record) => record.status === "evaluated"),
    disputed: records.filter((record) => record.status === "disputed"),
    violated: records.filter((record) => record.status === "violated"),
    observations: outcomeProjection.observations.filter(byThreadOrOutcome),
    evaluations: outcomeProjection.evaluations.filter(byThreadOrOutcome),
    disputes: outcomeProjection.disputes.filter(byThreadOrOutcome),
    violations: outcomeProjection.violations.filter(byThreadOrOutcome)
  };
}

function validateOutcomeExpectation(record) {
  const reasons = validateOutcomeRecordBase(record);
  if (normalizeStatus(record?.status) !== "pending") {
    reasons.push("outcome expectation status must be pending");
  }
  if (!record?.createdAt) {
    reasons.push("outcome expectation requires createdAt");
  }
  return reasons;
}

function validateOutcomeObservation(record) {
  const reasons = validateOutcomeRecordBase(record);
  if (normalizeStatus(record?.status) !== "observed") {
    reasons.push("outcome observation status must be observed");
  }
  if (!record?.observedAt) {
    reasons.push("outcome observation requires observedAt");
  }
  if (!normalizeEffect(record?.observedEffect)) {
    reasons.push("outcome observation requires observedEffect");
  }
  if (!normalizeEvidence(record?.evidence).length) {
    reasons.push("outcome observation requires evidence");
  }
  return reasons;
}

function validateOutcomeEvaluation(record) {
  const reasons = validateOutcomeRecordBase(record);
  if (normalizeStatus(record?.status) !== "evaluated") {
    reasons.push("outcome evaluation status must be evaluated");
  }
  if (!record?.evaluatedAt) {
    reasons.push("outcome evaluation requires evaluatedAt");
  }
  if (!EVALUATION_RESULTS.has(normalizeEvaluationResult(record?.evaluationResult))) {
    reasons.push("outcome evaluation requires result success, partial_success, failure, or inconclusive");
  }
  if (!String(record?.comparison || "").trim()) {
    reasons.push("outcome evaluation requires comparison");
  }
  if (!normalizeEvidence(record?.evidence).length) {
    reasons.push("outcome evaluation requires evidence");
  }
  if (!record?.evaluatedByParticipantId) {
    reasons.push("outcome evaluation requires evaluatedByParticipantId");
  }
  return reasons;
}

function validateOutcomeDispute(dispute) {
  const reasons = [];
  if (!dispute?.id) {
    reasons.push("outcome dispute requires id");
  }
  if (dispute?.object && dispute.object !== "outcomeDispute") {
    reasons.push("outcome dispute object must be outcomeDispute");
  }
  if (!dispute?.outcomeId) {
    reasons.push("outcome dispute requires outcomeId");
  }
  if (!dispute?.executionId) {
    reasons.push("outcome dispute requires executionId");
  }
  if (!dispute?.threadId) {
    reasons.push("outcome dispute requires threadId");
  }
  if (!dispute?.reason) {
    reasons.push("outcome dispute requires reason");
  }
  if (!dispute?.disputedByParticipantId) {
    reasons.push("outcome dispute requires disputedByParticipantId");
  }
  reasons.push(...rejectOutcomeGuardFields(dispute));
  return reasons;
}

function validateOutcomeViolation(violation) {
  const reasons = [];
  if (!violation?.id) {
    reasons.push("outcome violation requires id");
  }
  if (violation?.object && violation.object !== "outcomeViolation") {
    reasons.push("outcome violation object must be outcomeViolation");
  }
  if (!violation?.outcomeId) {
    reasons.push("outcome violation requires outcomeId");
  }
  if (!violation?.executionId) {
    reasons.push("outcome violation requires executionId");
  }
  if (!violation?.threadId) {
    reasons.push("outcome violation requires threadId");
  }
  if (!normalizeText(violation?.violationType)) {
    reasons.push("outcome violation requires violationType");
  }
  if (!violation?.reason) {
    reasons.push("outcome violation requires reason");
  }
  if (!violation?.detectedByParticipantId) {
    reasons.push("outcome violation requires detectedByParticipantId");
  }
  reasons.push(...rejectOutcomeGuardFields(violation));
  return reasons;
}

function validateOutcomeRecordBase(record) {
  const reasons = [];
  if (!record?.id) {
    reasons.push("outcome record requires id");
  }
  if (record?.object && record.object !== "outcomeRecord") {
    reasons.push("outcome record object must be outcomeRecord");
  }
  if (!record?.executionId) {
    reasons.push("outcome record requires executionId");
  }
  if (!record?.threadId) {
    reasons.push("outcome record requires threadId");
  }
  if (!record?.actorId) {
    reasons.push("outcome record requires actorId");
  }
  if (!normalizeEffect(record?.expectedEffect)) {
    reasons.push("outcome record requires expectedEffect");
  }
  if (!arrayValues(record?.evidence).every(Boolean)) {
    reasons.push("outcome evidence entries must be non-empty");
  }
  if (!STATUS_VALUES.has(normalizeStatus(record?.status))) {
    reasons.push("outcome record requires status pending, observed, evaluated, disputed, or violated");
  }
  if (!record?.attribution || typeof record.attribution !== "object") {
    reasons.push("outcome record requires attribution");
  } else {
    if (record.attribution.actorId !== record.actorId) {
      reasons.push("outcome attribution must match actorId");
    }
    if (record.attribution.executionId !== record.executionId) {
      reasons.push("outcome attribution must match executionId");
    }
  }
  reasons.push(...rejectOutcomeGuardFields(record));
  return reasons;
}

function normalizeOutcomeRecord(record, event, status) {
  if (!record) {
    return null;
  }
  const normalized = stripUndefined({
    ...record,
    id: record.id || deterministicId("oco", "outcome_record", event.event_id),
    object: "outcomeRecord",
    executionId: record.executionId || null,
    threadId: record.threadId || event.thread_id,
    actorId: record.actorId || event.actor_id,
    expectedEffect: normalizeEffect(record.expectedEffect || record.effect),
    observedEffect: normalizeEffect(record.observedEffect) || null,
    evidence: normalizeEvidence(record.evidence),
    evaluationResult: normalizeEvaluationResult(record.evaluationResult || record.result) || null,
    status: normalizeStatus(status || record.status || "pending"),
    sourceEventId: event.event_id,
    completionAsSuccess: false,
    successByAssertion: false,
    outcomeAsConsensus: false,
    consensusCreated: false,
    governanceApproval: false,
    amendmentApproval: false,
    authorityCreated: false,
    retroactiveExpectedEffect: false,
    unmeasuredImpactAchieved: false,
    silentUnintendedConsequence: false
  });
  normalized.attribution = normalized.attribution || buildOutcomeAttribution(normalized);
  normalized.outcomeHash = outcomeHash(normalized);
  return normalized;
}

function normalizeOutcomeDispute(dispute, event) {
  if (!dispute) {
    return null;
  }
  const normalized = stripUndefined({
    ...dispute,
    id: dispute.id || deterministicId("ods", "outcome_dispute", event.event_id),
    object: "outcomeDispute",
    threadId: dispute.threadId || event.thread_id,
    disputedAt: dispute.disputedAt || event.timestamp,
    sourceEventId: event.event_id,
    completionAsSuccess: false,
    outcomeAsConsensus: false,
    consensusCreated: false,
    governanceApproval: false,
    amendmentApproval: false,
    authorityCreated: false
  });
  normalized.outcomeHash = outcomeHash(normalized);
  return normalized;
}

function normalizeOutcomeViolation(violation, event) {
  if (!violation) {
    return null;
  }
  const normalized = stripUndefined({
    ...violation,
    id: violation.id || deterministicId("ovl", "outcome_violation", event.event_id),
    object: "outcomeViolation",
    threadId: violation.threadId || event.thread_id,
    violationType: normalizeText(violation.violationType),
    detectedAt: violation.detectedAt || event.timestamp,
    sourceEventId: event.event_id,
    completionAsSuccess: false,
    successByAssertion: false,
    outcomeAsConsensus: false,
    consensusCreated: false,
    governanceApproval: false,
    amendmentApproval: false,
    authorityCreated: false,
    retroactiveExpectedEffect: false,
    unmeasuredImpactAchieved: false,
    silentUnintendedConsequence: false
  });
  normalized.outcomeHash = outcomeHash(normalized);
  return normalized;
}

function mergeOutcomeRecord(expectation, { observation, evaluation, disputes, violations }) {
  const applied = {
    ...expectation,
    status: outcomeStatus({ observation, evaluation, disputes, violations }),
    observedEffect: observation?.observedEffect || null,
    observedAt: observation?.observedAt || null,
    evaluationResult: evaluation?.evaluationResult || null,
    comparison: evaluation?.comparison || null,
    confidence: evaluation?.confidence ?? null,
    evaluatedByParticipantId: evaluation?.evaluatedByParticipantId || null,
    evaluatedAt: evaluation?.evaluatedAt || null,
    evidence: [
      ...normalizeEvidence(expectation.evidence),
      ...normalizeEvidence(observation?.evidence),
      ...normalizeEvidence(evaluation?.evidence)
    ],
    disputes,
    violations
  };
  applied.outcomeHash = outcomeHash(applied);
  return stripUndefined(applied);
}

function outcomeStatus({ observation, evaluation, disputes, violations }) {
  if (violations?.length) {
    return "violated";
  }
  if (disputes?.length) {
    return "disputed";
  }
  if (evaluation) {
    return "evaluated";
  }
  if (observation) {
    return "observed";
  }
  return "pending";
}

function buildOutcomeAttribution(options = {}) {
  return stripUndefined({
    actorId: options.actorId || null,
    executionId: options.executionId || null,
    outcomeId: options.outcomeId || options.id || null,
    evaluationResult: normalizeEvaluationResult(options.evaluationResult) || null
  });
}

function rejectOutcomeGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`outcome field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectOutcomeGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function outcomeHash(record) {
  return contentHash({
    object: record.object,
    id: record.id,
    outcomeId: record.outcomeId || null,
    executionId: record.executionId || null,
    threadId: record.threadId || null,
    actorId: record.actorId || null,
    expectedEffect: record.expectedEffect || null,
    observedEffect: record.observedEffect || null,
    evidence: record.evidence || [],
    evaluationResult: record.evaluationResult || null,
    comparison: record.comparison || null,
    confidence: record.confidence ?? null,
    status: record.status || null,
    reason: record.reason || null,
    violationType: record.violationType || null,
    completionAsSuccess: false,
    successByAssertion: false,
    outcomeAsConsensus: false,
    consensusCreated: false,
    governanceApproval: false,
    amendmentApproval: false
  });
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizeText(type).slice(0, 24) || "outcome"}_${hash}`;
}

function lastForOutcome(records, outcomeId) {
  return records.filter((record) => record.id === outcomeId).at(-1) || null;
}

function normalizeEvaluationResult(result) {
  const normalized = normalizeText(result);
  return normalized || null;
}

function normalizeStatus(status) {
  return normalizeText(status || "pending");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeEffect(value) {
  return String(value || "").trim();
}

function normalizeEvidence(value) {
  return arrayValues(value).map((item) => {
    if (item && typeof item === "object") {
      return item;
    }
    return { type: "text", value: String(item) };
  }).filter((item) => item.value || item.id || item.contentHash || item.source);
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function addRecord(records, record) {
  if (record) {
    records.push(record);
  }
}

function indexBy(records, key) {
  return records.reduce((indexed, record) => {
    if (record[key]) {
      indexed[record[key]] = record;
    }
    return indexed;
  }, {});
}

function groupBy(records, key) {
  return records.reduce((grouped, record) => {
    const value = record[key];
    if (!value) {
      return grouped;
    }
    grouped[value] ||= [];
    grouped[value].push(record);
    return grouped;
  }, {});
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

function stripUndefined(object) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) {
      delete object[key];
    }
  }
  return object;
}

module.exports = {
  OUTCOME_EVENT_TYPES,
  buildOutcomeDispute,
  buildOutcomeEvaluation,
  buildOutcomeExpectation,
  buildOutcomeObservation,
  buildOutcomeState,
  buildOutcomeViolation,
  outcomeForId,
  projectOutcome,
  selectOutcomeForThread,
  validateOutcomeDispute,
  validateOutcomeEvaluation,
  validateOutcomeExpectation,
  validateOutcomeObservation,
  validateOutcomeViolation
};
