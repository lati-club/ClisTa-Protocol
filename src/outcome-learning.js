const { PROTOCOL_VERSION, contentHash } = require("./integrity");
const { groupBy, indexBy, stripUndefined, unique } = require("./utils");

const OUTCOME_LEARNING_SCHEMA = "clista.outcome_learning.v0";
const OUTCOME_LEARNING_PROTOCOL_VERSION = "0.22.0";
const OUTCOME_LEARNING_THEOREM = "protocol_outcome_learning = derive(adaptation_signal, from_evaluated_outcome)";
const OUTCOME_LEARNING_HARD_LAW = "learning != retroactive justification";

const OUTCOME_LEARNING_EVENT_TYPES = new Set([
  "LearningSignalDerived",
  "LessonRecorded",
  "LearningDisputed",
  "LearningViolationRecorded"
]);

const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

const GUARD_FIELDS = new Set([
  "retroactiveJustification",
  "priorRationaleRewritten",
  "intendedEffectRewritten",
  "governanceMutation",
  "authorityMutation",
  "learningFromUnevaluatedOutcome",
  "universalTruthClaim",
  "failureRecastAsSuccess",
  "outcomeSuccessMutation",
  "stateMutation"
]);

function emptyOutcomeLearningState() {
  return {
    signals: [],
    lessons: [],
    disputes: [],
    violations: []
  };
}

function buildOutcomeLearningState(projection = {}) {
  const state = emptyOutcomeLearningState();
  applyExplicitOutcomeLearningEvents(projection.events || [], state);
  return state;
}

function applyExplicitOutcomeLearningEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "LearningSignalDerived":
        addRecord(state.signals, normalizeOutcomeLearningSignal(payload.outcomeLearningSignal, event));
        break;
      case "LessonRecorded":
        addRecord(state.lessons, normalizeOutcomeLesson(payload.outcomeLesson, event));
        break;
      case "LearningDisputed":
        addRecord(state.disputes, normalizeOutcomeLearningDispute(payload.outcomeLearningDispute, event));
        break;
      case "LearningViolationRecorded":
        addRecord(state.violations, normalizeOutcomeLearningViolation(payload.outcomeLearningViolation, event));
        break;
      default:
        break;
    }
  }
}

function projectOutcomeLearning(state = emptyOutcomeLearningState()) {
  const signals = state.signals.filter(Boolean);
  const lessons = state.lessons.filter(Boolean);
  const disputes = state.disputes.filter(Boolean);
  const violations = state.violations.filter(Boolean);

  return {
    schema: OUTCOME_LEARNING_SCHEMA,
    theorem: OUTCOME_LEARNING_THEOREM,
    hardLaw: OUTCOME_LEARNING_HARD_LAW,
    outcomeLearningProtocolVersion: OUTCOME_LEARNING_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    signals,
    lessons,
    disputes,
    violations,
    bySignal: indexBy(signals, "id"),
    byLesson: indexBy(lessons, "id"),
    byDispute: indexBy(disputes, "id"),
    byViolation: indexBy(violations, "id"),
    lessonsBySignal: groupBy(lessons, "learningSignalId"),
    disputesByLearning: groupBy(disputes, "learningId"),
    violationsByLearning: groupBy(violations, "learningId"),
    signalsByOutcome: groupBy(signals, "outcomeId"),
    lessonsByOutcome: groupBy(lessons, "outcomeId"),
    disputesByOutcome: groupBy(disputes, "outcomeId"),
    violationsByOutcome: groupBy(violations, "outcomeId"),
    outcomeLearningValidationStatus: {
      valid: true,
      signalCount: signals.length,
      lessonCount: lessons.length,
      disputeCount: disputes.length,
      violationCount: violations.length,
      retroactiveJustification: false,
      priorRationaleRewritten: false,
      intendedEffectRewritten: false,
      governanceMutation: false,
      authorityMutation: false,
      learningFromUnevaluatedOutcome: false,
      universalTruthClaim: false,
      failureRecastAsSuccess: false,
      outcomeSuccessMutation: false,
      stateMutation: false
    }
  };
}

function buildOutcomeLearningSignal(options = {}) {
  const signal = stripUndefined({
    id: options.id || deterministicId("ols", "outcome_learning_signal", {
      outcomeId: options.outcomeId,
      lesson: options.lesson || options.finding
    }),
    object: "outcomeLearningSignal",
    signalType: normalizeText(options.signalType || "outcome_learning"),
    outcomeId: options.outcomeId || null,
    executionId: options.executionId || null,
    threadId: options.threadId || null,
    evaluationResult: normalizeText(options.evaluationResult || options.result),
    lesson: normalizeString(options.lesson || options.finding),
    confirmedAssumptionIds: unique(options.confirmedAssumptionIds || options.confirmedAssumptions || []),
    failedAssumptionIds: unique(options.failedAssumptionIds || options.failedAssumptions || []),
    recommendedConstraints: unique(options.recommendedConstraints || options.constraints || []),
    recommendedAmendments: unique(options.recommendedAmendments || options.amendments || []),
    evidence: normalizeEvidence(options.evidence),
    confidence: normalizeConfidence(options.confidence || "medium"),
    sourceOutcomeHash: options.sourceOutcomeHash || null,
    derivedByParticipantId: options.derivedByParticipantId || options.actorId || null,
    derivedAt: options.derivedAt || null,
    retroactiveJustification: false,
    priorRationaleRewritten: false,
    intendedEffectRewritten: false,
    governanceMutation: false,
    authorityMutation: false,
    learningFromUnevaluatedOutcome: false,
    universalTruthClaim: false,
    failureRecastAsSuccess: false,
    outcomeSuccessMutation: false,
    stateMutation: false
  });
  signal.outcomeLearningHash = outcomeLearningHash(signal);
  return signal;
}

function buildOutcomeLesson(options = {}) {
  const lesson = stripUndefined({
    id: options.id || deterministicId("les", "outcome_lesson", {
      learningSignalId: options.learningSignalId || options.signalId,
      lesson: options.lesson
    }),
    object: "outcomeLesson",
    learningSignalId: options.learningSignalId || options.signalId || null,
    outcomeId: options.outcomeId || null,
    executionId: options.executionId || null,
    threadId: options.threadId || null,
    lesson: normalizeString(options.lesson),
    evidence: normalizeEvidence(options.evidence),
    recordedByParticipantId: options.recordedByParticipantId || options.actorId || null,
    recordedAt: options.recordedAt || null,
    retroactiveJustification: false,
    priorRationaleRewritten: false,
    intendedEffectRewritten: false,
    governanceMutation: false,
    authorityMutation: false,
    learningFromUnevaluatedOutcome: false,
    universalTruthClaim: false,
    failureRecastAsSuccess: false,
    outcomeSuccessMutation: false,
    stateMutation: false
  });
  lesson.outcomeLearningHash = outcomeLearningHash(lesson);
  return lesson;
}

function buildOutcomeLearningDispute(options = {}) {
  const dispute = stripUndefined({
    id: options.id || deterministicId("old", "outcome_learning_dispute", {
      learningId: options.learningId,
      reason: options.reason
    }),
    object: "outcomeLearningDispute",
    learningId: options.learningId || null,
    outcomeId: options.outcomeId || null,
    executionId: options.executionId || null,
    threadId: options.threadId || null,
    reason: normalizeString(options.reason),
    disputedByParticipantId: options.disputedByParticipantId || options.actorId || null,
    disputedAt: options.disputedAt || null,
    retroactiveJustification: false,
    governanceMutation: false,
    authorityMutation: false,
    stateMutation: false
  });
  dispute.outcomeLearningHash = outcomeLearningHash(dispute);
  return dispute;
}

function buildOutcomeLearningViolation(options = {}) {
  const violation = stripUndefined({
    id: options.id || deterministicId("olv", "outcome_learning_violation", {
      learningId: options.learningId,
      violationType: options.violationType
    }),
    object: "outcomeLearningViolation",
    learningId: options.learningId || null,
    outcomeId: options.outcomeId || null,
    executionId: options.executionId || null,
    threadId: options.threadId || null,
    violationType: normalizeText(options.violationType),
    reason: normalizeString(options.reason),
    detectedByParticipantId: options.detectedByParticipantId || options.actorId || null,
    detectedAt: options.detectedAt || null,
    retroactiveJustification: false,
    priorRationaleRewritten: false,
    intendedEffectRewritten: false,
    governanceMutation: false,
    authorityMutation: false,
    learningFromUnevaluatedOutcome: false,
    universalTruthClaim: false,
    failureRecastAsSuccess: false,
    outcomeSuccessMutation: false,
    stateMutation: false
  });
  violation.outcomeLearningHash = outcomeLearningHash(violation);
  return violation;
}

function outcomeLearningForId(outcomeLearningProjection, learningId) {
  return {
    schema: "clista.outcome_learning.item.v0",
    learningId,
    signal: outcomeLearningProjection.bySignal[learningId] || null,
    lesson: outcomeLearningProjection.byLesson[learningId] || null,
    disputes: outcomeLearningProjection.disputesByLearning[learningId] || [],
    violations: outcomeLearningProjection.violationsByLearning[learningId] || []
  };
}

function selectOutcomeLearningForThread(outcomeLearningProjection, threadId) {
  const signals = outcomeLearningProjection.signals.filter((signal) => signal.threadId === threadId);
  const signalIds = new Set(signals.map((signal) => signal.id));
  const byThreadOrSignal = (record) => record.threadId === threadId || signalIds.has(record.learningSignalId || record.learningId);
  return {
    schema: "clista.outcome_learning.thread.v0",
    threadId,
    theorem: outcomeLearningProjection.theorem,
    hardLaw: outcomeLearningProjection.hardLaw,
    signals,
    lessons: outcomeLearningProjection.lessons.filter(byThreadOrSignal),
    disputes: outcomeLearningProjection.disputes.filter(byThreadOrSignal),
    violations: outcomeLearningProjection.violations.filter(byThreadOrSignal)
  };
}

function validateOutcomeLearningSignal(signal) {
  const reasons = [];
  if (!signal?.id) {
    reasons.push("outcome learning signal requires id");
  }
  if (signal?.object && signal.object !== "outcomeLearningSignal") {
    reasons.push("outcome learning signal object must be outcomeLearningSignal");
  }
  if (!signal?.outcomeId) {
    reasons.push("outcome learning signal requires outcomeId");
  }
  if (!signal?.executionId) {
    reasons.push("outcome learning signal requires executionId");
  }
  if (!signal?.threadId) {
    reasons.push("outcome learning signal requires threadId");
  }
  if (!signal?.evaluationResult) {
    reasons.push("outcome learning signal requires evaluationResult");
  }
  if (!normalizeString(signal?.lesson)) {
    reasons.push("outcome learning signal requires lesson");
  }
  if (!normalizeEvidence(signal?.evidence).length) {
    reasons.push("outcome learning signal requires evidence");
  }
  if (!VALID_CONFIDENCE.has(normalizeConfidence(signal?.confidence))) {
    reasons.push("outcome learning signal requires confidence low, medium, or high");
  }
  if (!signal?.derivedByParticipantId) {
    reasons.push("outcome learning signal requires derivedByParticipantId");
  }
  reasons.push(...rejectOutcomeLearningGuardFields(signal));
  return reasons;
}

function validateOutcomeLesson(lesson) {
  const reasons = [];
  if (!lesson?.id) {
    reasons.push("outcome lesson requires id");
  }
  if (lesson?.object && lesson.object !== "outcomeLesson") {
    reasons.push("outcome lesson object must be outcomeLesson");
  }
  if (!lesson?.learningSignalId) {
    reasons.push("outcome lesson requires learningSignalId");
  }
  if (!lesson?.outcomeId) {
    reasons.push("outcome lesson requires outcomeId");
  }
  if (!lesson?.executionId) {
    reasons.push("outcome lesson requires executionId");
  }
  if (!lesson?.threadId) {
    reasons.push("outcome lesson requires threadId");
  }
  if (!normalizeString(lesson?.lesson)) {
    reasons.push("outcome lesson requires lesson");
  }
  if (!normalizeEvidence(lesson?.evidence).length) {
    reasons.push("outcome lesson requires evidence");
  }
  if (!lesson?.recordedByParticipantId) {
    reasons.push("outcome lesson requires recordedByParticipantId");
  }
  reasons.push(...rejectOutcomeLearningGuardFields(lesson));
  return reasons;
}

function validateOutcomeLearningDispute(dispute) {
  const reasons = [];
  if (!dispute?.id) {
    reasons.push("outcome learning dispute requires id");
  }
  if (dispute?.object && dispute.object !== "outcomeLearningDispute") {
    reasons.push("outcome learning dispute object must be outcomeLearningDispute");
  }
  if (!dispute?.learningId) {
    reasons.push("outcome learning dispute requires learningId");
  }
  if (!dispute?.outcomeId) {
    reasons.push("outcome learning dispute requires outcomeId");
  }
  if (!dispute?.executionId) {
    reasons.push("outcome learning dispute requires executionId");
  }
  if (!dispute?.threadId) {
    reasons.push("outcome learning dispute requires threadId");
  }
  if (!normalizeString(dispute?.reason)) {
    reasons.push("outcome learning dispute requires reason");
  }
  if (!dispute?.disputedByParticipantId) {
    reasons.push("outcome learning dispute requires disputedByParticipantId");
  }
  reasons.push(...rejectOutcomeLearningGuardFields(dispute));
  return reasons;
}

function validateOutcomeLearningViolation(violation) {
  const reasons = [];
  if (!violation?.id) {
    reasons.push("outcome learning violation requires id");
  }
  if (violation?.object && violation.object !== "outcomeLearningViolation") {
    reasons.push("outcome learning violation object must be outcomeLearningViolation");
  }
  if (!violation?.learningId) {
    reasons.push("outcome learning violation requires learningId");
  }
  if (!violation?.outcomeId) {
    reasons.push("outcome learning violation requires outcomeId");
  }
  if (!violation?.executionId) {
    reasons.push("outcome learning violation requires executionId");
  }
  if (!violation?.threadId) {
    reasons.push("outcome learning violation requires threadId");
  }
  if (!normalizeText(violation?.violationType)) {
    reasons.push("outcome learning violation requires violationType");
  }
  if (!normalizeString(violation?.reason)) {
    reasons.push("outcome learning violation requires reason");
  }
  if (!violation?.detectedByParticipantId) {
    reasons.push("outcome learning violation requires detectedByParticipantId");
  }
  reasons.push(...rejectOutcomeLearningGuardFields(violation));
  return reasons;
}

function normalizeOutcomeLearningSignal(signal, event) {
  if (!signal) {
    return null;
  }
  const normalized = stripUndefined({
    ...signal,
    id: signal.id || deterministicId("ols", "outcome_learning_signal", event.event_id),
    object: "outcomeLearningSignal",
    signalType: normalizeText(signal.signalType || "outcome_learning"),
    threadId: signal.threadId || event.thread_id,
    evaluationResult: normalizeText(signal.evaluationResult || signal.result),
    lesson: normalizeString(signal.lesson || signal.finding),
    confirmedAssumptionIds: unique(signal.confirmedAssumptionIds || signal.confirmedAssumptions || []),
    failedAssumptionIds: unique(signal.failedAssumptionIds || signal.failedAssumptions || []),
    recommendedConstraints: unique(signal.recommendedConstraints || signal.constraints || []),
    recommendedAmendments: unique(signal.recommendedAmendments || signal.amendments || []),
    evidence: normalizeEvidence(signal.evidence),
    confidence: normalizeConfidence(signal.confidence || "medium"),
    derivedByParticipantId: signal.derivedByParticipantId || event.actor_id,
    derivedAt: signal.derivedAt || event.timestamp,
    sourceEventId: event.event_id,
    retroactiveJustification: false,
    priorRationaleRewritten: false,
    intendedEffectRewritten: false,
    governanceMutation: false,
    authorityMutation: false,
    learningFromUnevaluatedOutcome: false,
    universalTruthClaim: false,
    failureRecastAsSuccess: false,
    outcomeSuccessMutation: false,
    stateMutation: false
  });
  normalized.outcomeLearningHash = outcomeLearningHash(normalized);
  return normalized;
}

function normalizeOutcomeLesson(lesson, event) {
  if (!lesson) {
    return null;
  }
  const normalized = stripUndefined({
    ...lesson,
    id: lesson.id || deterministicId("les", "outcome_lesson", event.event_id),
    object: "outcomeLesson",
    threadId: lesson.threadId || event.thread_id,
    lesson: normalizeString(lesson.lesson),
    evidence: normalizeEvidence(lesson.evidence),
    recordedByParticipantId: lesson.recordedByParticipantId || event.actor_id,
    recordedAt: lesson.recordedAt || event.timestamp,
    sourceEventId: event.event_id,
    retroactiveJustification: false,
    priorRationaleRewritten: false,
    intendedEffectRewritten: false,
    governanceMutation: false,
    authorityMutation: false,
    learningFromUnevaluatedOutcome: false,
    universalTruthClaim: false,
    failureRecastAsSuccess: false,
    outcomeSuccessMutation: false,
    stateMutation: false
  });
  normalized.outcomeLearningHash = outcomeLearningHash(normalized);
  return normalized;
}

function normalizeOutcomeLearningDispute(dispute, event) {
  if (!dispute) {
    return null;
  }
  const normalized = stripUndefined({
    ...dispute,
    id: dispute.id || deterministicId("old", "outcome_learning_dispute", event.event_id),
    object: "outcomeLearningDispute",
    threadId: dispute.threadId || event.thread_id,
    reason: normalizeString(dispute.reason),
    disputedByParticipantId: dispute.disputedByParticipantId || event.actor_id,
    disputedAt: dispute.disputedAt || event.timestamp,
    sourceEventId: event.event_id,
    retroactiveJustification: false,
    governanceMutation: false,
    authorityMutation: false,
    stateMutation: false
  });
  normalized.outcomeLearningHash = outcomeLearningHash(normalized);
  return normalized;
}

function normalizeOutcomeLearningViolation(violation, event) {
  if (!violation) {
    return null;
  }
  const normalized = stripUndefined({
    ...violation,
    id: violation.id || deterministicId("olv", "outcome_learning_violation", event.event_id),
    object: "outcomeLearningViolation",
    threadId: violation.threadId || event.thread_id,
    violationType: normalizeText(violation.violationType),
    reason: normalizeString(violation.reason),
    detectedByParticipantId: violation.detectedByParticipantId || event.actor_id,
    detectedAt: violation.detectedAt || event.timestamp,
    sourceEventId: event.event_id,
    retroactiveJustification: false,
    priorRationaleRewritten: false,
    intendedEffectRewritten: false,
    governanceMutation: false,
    authorityMutation: false,
    learningFromUnevaluatedOutcome: false,
    universalTruthClaim: false,
    failureRecastAsSuccess: false,
    outcomeSuccessMutation: false,
    stateMutation: false
  });
  normalized.outcomeLearningHash = outcomeLearningHash(normalized);
  return normalized;
}

function rejectOutcomeLearningGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`outcome learning field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectOutcomeLearningGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function outcomeLearningHash(record) {
  return contentHash({
    object: record.object,
    id: record.id,
    learningSignalId: record.learningSignalId || null,
    learningId: record.learningId || null,
    outcomeId: record.outcomeId || null,
    executionId: record.executionId || null,
    threadId: record.threadId || null,
    evaluationResult: record.evaluationResult || null,
    lesson: record.lesson || null,
    evidence: record.evidence || [],
    confirmedAssumptionIds: record.confirmedAssumptionIds || [],
    failedAssumptionIds: record.failedAssumptionIds || [],
    recommendedConstraints: record.recommendedConstraints || [],
    recommendedAmendments: record.recommendedAmendments || [],
    reason: record.reason || null,
    violationType: record.violationType || null,
    retroactiveJustification: false,
    priorRationaleRewritten: false,
    intendedEffectRewritten: false,
    governanceMutation: false,
    authorityMutation: false,
    learningFromUnevaluatedOutcome: false,
    universalTruthClaim: false,
    failureRecastAsSuccess: false,
    outcomeSuccessMutation: false,
    stateMutation: false
  });
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizeText(type).slice(0, 24) || "outcome_learning"}_${hash}`;
}

function normalizeEvidence(value) {
  return arrayValues(value).map((item) => {
    if (item && typeof item === "object") {
      return item;
    }
    return { type: "text", value: String(item) };
  }).filter((item) => item.value || item.id || item.contentHash || item.source);
}

function normalizeConfidence(value) {
  return normalizeText(value || "medium");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeString(value) {
  return String(value || "").trim();
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
  OUTCOME_LEARNING_EVENT_TYPES,
  OUTCOME_LEARNING_HARD_LAW,
  OUTCOME_LEARNING_PROTOCOL_VERSION,
  OUTCOME_LEARNING_SCHEMA,
  OUTCOME_LEARNING_THEOREM,
  buildOutcomeLearningDispute,
  buildOutcomeLearningSignal,
  buildOutcomeLearningState,
  buildOutcomeLearningViolation,
  buildOutcomeLesson,
  outcomeLearningForId,
  projectOutcomeLearning,
  selectOutcomeLearningForThread,
  validateOutcomeLearningDispute,
  validateOutcomeLearningSignal,
  validateOutcomeLearningViolation,
  validateOutcomeLesson
};
