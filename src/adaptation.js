const { contentHash } = require("./integrity");
const { groupBy, groupByByValues, indexBy, stripUndefined, unique } = require("./utils");

const ADAPTATION_SCHEMA = "clista.adaptation.v0";
const ADAPTATION_VERIFY_SCHEMA = "clista.adaptation.verify.v0";

const ADAPTATION_EVENT_TYPES = new Set([
  "AdaptationReviewRecorded",
  "GovernanceReviewRecommended",
  "EvidenceRequirementReviewRecommended",
  "RevisitTriggerReviewRecommended",
  "DecisionGateReviewRecommended"
]);

const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

const FORBIDDEN_KEY_PATTERNS = [
  /reputation/i,
  /trust.?score/i,
  /participant.?score/i,
  /actor.?score/i,
  /source.?score/i,
  /model.?rank/i,
  /agent.?rank/i,
  /participant.?rank/i,
  /actor.?rank/i,
  /automatic.?authority/i,
  /authority.?mutation/i,
  /governance.?mutation/i,
  /rule.?mutation/i,
  /threshold.?mutation/i,
  /automatic.?rule/i,
  /automatic.?governance/i,
  /modify.?governance/i,
  /modify.?authority/i,
  /change.?threshold/i,
  /grant.?authority/i,
  /revoke.?authority/i
];

const GUARD_FIELDS = new Set([
  "authorityMutation",
  "governanceMutation",
  "ruleMutation",
  "thresholdMutation",
  "participantScoring",
  "sourceScoring",
  "modelRanking",
  "agentRanking"
]);

function emptyAdaptationState() {
  return {
    recommendations: [],
    reviews: []
  };
}

function buildAdaptationState(projection) {
  const state = emptyAdaptationState();
  deriveAdaptationRecommendations(projection, state);
  applyExplicitAdaptationEvents(projection.events || [], state);
  return state;
}

function deriveAdaptationRecommendations(projection, state) {
  const signals = projection.learning?.signals || [];
  const learningRecommendations = projection.learning?.revisitRecommendations || [];

  for (const signal of signals) {
    switch (signal.pattern) {
      case "expected_outcome_failed":
      case "failed_outcome_requires_revisit":
        addRecommendation(state, recommendationFromSignal(signal, {
          recommendationType: "revisit_trigger_review",
          pattern: "review_revisit_triggers_after_failed_outcome",
          finding: `Learning signal ${signal.id} indicates a failed outcome should trigger governance review.`,
          recommendation: "Review revisit triggers before this decision pattern is reused."
        }));
        break;
      case "expected_outcome_partially_confirmed":
      case "expected_outcome_inconclusive":
        addRecommendation(state, recommendationFromSignal(signal, {
          recommendationType: "outcome_window_review",
          pattern: "review_outcome_windows_after_uncertain_result",
          finding: `Learning signal ${signal.id} indicates the outcome window may not have produced a clear result.`,
          recommendation: "Review whether outcome windows or review dates should be adjusted for similar decisions."
        }));
        break;
      case "assumption_with_evidence_provenance_failed":
      case "assumption_without_evidence_provenance_failed":
        addRecommendation(state, recommendationFromSignal(signal, {
          recommendationType: "evidence_requirement_review",
          pattern: "review_evidence_requirements_for_failed_assumptions",
          finding: `Learning signal ${signal.id} indicates an assumption failed under outcome evidence.`,
          recommendation: "Review evidence requirements for assumptions used in this decision gate."
        }));
        break;
      case "evidence_linked_to_failed_outcome":
        addRecommendation(state, recommendationFromSignal(signal, {
          recommendationType: "provenance_requirement_review",
          pattern: "review_provenance_completeness_for_failed_evidence",
          finding: `Learning signal ${signal.id} links evidence to a failed outcome.`,
          recommendation: "Review whether evidence provenance completeness should be stricter for similar decisions."
        }));
        break;
      case "claims_supported_failed_decision":
        addRecommendation(state, recommendationFromSignal(signal, {
          recommendationType: "decision_gate_review",
          pattern: "review_decision_gates_for_failed_claim_support",
          finding: `Learning signal ${signal.id} shows claims supported a failed decision.`,
          recommendation: "Review whether decision gates should require stronger claim support before merge."
        }));
        break;
      case "failed_decision_without_recorded_objections":
        addRecommendation(state, recommendationFromSignal(signal, {
          recommendationType: "objection_resolution_review",
          pattern: "review_objection_requirements_for_failed_decision",
          finding: `Learning signal ${signal.id} shows a failed decision without recorded objections.`,
          recommendation: "Review whether decision gates should require explicit objection solicitation."
        }));
        break;
      case "objection_later_validated_by_outcome":
        addRecommendation(state, recommendationFromSignal(signal, {
          recommendationType: "objection_resolution_review",
          pattern: "review_preserved_objection_handling",
          finding: `Learning signal ${signal.id} shows an objection was later validated by outcome evidence.`,
          recommendation: "Review objection-resolution requirements for similar future decisions."
        }));
        break;
      case "governance_reviews_missing_rationale":
        addRecommendation(state, recommendationFromSignal(signal, {
          recommendationType: "governance_audit_review",
          pattern: "review_governance_review_rationale_requirements",
          finding: `Learning signal ${signal.id} indicates missing governance review rationale.`,
          recommendation: "Review whether governance reviews should require rationale before merge."
        }));
        break;
      default:
        break;
    }
  }

  for (const recommendation of learningRecommendations) {
    addRecommendation(state, recommendationFromSignal(recommendation, {
      recommendationType: "governance_review",
      pattern: "review_learning_revisit_recommendation",
      finding: `Learning recommendation ${recommendation.id} asks for future governance review.`,
      recommendation: "Route this learning recommendation into an explicit governance review."
    }));
  }
}

function recommendationFromSignal(signal, overrides) {
  return {
    recommendationType: overrides.recommendationType,
    pattern: overrides.pattern,
    threadId: signal.threadId,
    learningSignalIds: [signal.id],
    learningPatterns: [signal.pattern],
    relatedContributions: signal.relatedContributions || [],
    outcomeRefs: signal.outcomeRefs || [],
    provenanceRefs: signal.provenanceRefs || [],
    finding: overrides.finding,
    recommendation: overrides.recommendation,
    confidence: signal.confidence || "low",
    generatedFromEventIds: signal.generatedFromEventIds || [],
    createdAt: signal.createdAt
  };
}

function applyExplicitAdaptationEvents(events, state) {
  for (const event of events) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "AdaptationReviewRecorded":
        addReview(state, normalizeExplicitAdaptationObject(
          payload.adaptationReview,
          event,
          "adaptationReview",
          "adaptation_review"
        ));
        break;
      case "GovernanceReviewRecommended":
        addRecommendation(state, normalizeExplicitAdaptationObject(
          payload.governanceReviewRecommendation,
          event,
          "adaptationRecommendation",
          "governance_review"
        ));
        break;
      case "EvidenceRequirementReviewRecommended":
        addRecommendation(state, normalizeExplicitAdaptationObject(
          payload.evidenceRequirementReviewRecommendation,
          event,
          "adaptationRecommendation",
          "evidence_requirement_review"
        ));
        break;
      case "RevisitTriggerReviewRecommended":
        addRecommendation(state, normalizeExplicitAdaptationObject(
          payload.revisitTriggerReviewRecommendation,
          event,
          "adaptationRecommendation",
          "revisit_trigger_review"
        ));
        break;
      case "DecisionGateReviewRecommended":
        addRecommendation(state, normalizeExplicitAdaptationObject(
          payload.decisionGateReviewRecommendation,
          event,
          "adaptationRecommendation",
          "decision_gate_review"
        ));
        break;
      default:
        break;
    }
  }
}

function normalizeExplicitAdaptationObject(object, event, objectType, defaultType) {
  if (!object) {
    return null;
  }
  return stripUndefined({
    id: object.id || deterministicId("adp", defaultType, event.event_id),
    object: object.object || objectType,
    recommendationType: object.recommendationType || defaultType,
    pattern: normalizePattern(object.pattern),
    threadId: object.threadId || event.thread_id,
    learningSignalIds: unique(object.learningSignalIds || object.relatedLearningSignalIds || []),
    learningPatterns: unique(object.learningPatterns || []),
    relatedContributions: unique(object.relatedContributions || object.relatedContributionIds || []),
    outcomeRefs: unique(object.outcomeRefs || object.outcomeIds || []),
    provenanceRefs: unique(object.provenanceRefs || object.provenanceIds || []),
    finding: object.finding || object.summary,
    recommendation: object.recommendation,
    confidence: normalizeConfidence(object.confidence),
    authorityMutation: false,
    governanceMutation: false,
    ruleMutation: false,
    thresholdMutation: false,
    participantScoring: false,
    sourceScoring: false,
    modelRanking: false,
    agentRanking: false,
    generatedFromEventIds: unique([...(object.generatedFromEventIds || []), event.event_id]),
    sourceEventId: event.event_id,
    explicit: true,
    derived: false,
    createdAt: object.createdAt || event.timestamp
  });
}

function projectAdaptation(state) {
  const recommendations = state.recommendations.filter(Boolean);
  const reviews = state.reviews.filter(Boolean);
  return {
    schema: ADAPTATION_SCHEMA,
    theorem: "governance_adaptation = recommend(governance_review, learning_signals)",
    hardLaw: "adaptation != governance mutation",
    recommendations,
    reviews,
    adaptationReviews: reviews,
    governanceReviewRecommendations: recommendations.filter((item) => item.recommendationType === "governance_review" || item.recommendationType === "governance_audit_review"),
    evidenceRequirementReviewRecommendations: recommendations.filter((item) => item.recommendationType === "evidence_requirement_review"),
    revisitTriggerReviewRecommendations: recommendations.filter((item) => item.recommendationType === "revisit_trigger_review"),
    decisionGateReviewRecommendations: recommendations.filter((item) => item.recommendationType === "decision_gate_review"),
    provenanceRequirementReviewRecommendations: recommendations.filter((item) => item.recommendationType === "provenance_requirement_review"),
    objectionResolutionReviewRecommendations: recommendations.filter((item) => item.recommendationType === "objection_resolution_review"),
    outcomeWindowReviewRecommendations: recommendations.filter((item) => item.recommendationType === "outcome_window_review"),
    byRecommendation: indexBy(recommendations, "id"),
    byLearningSignal: groupByByValues(recommendations, "learningSignalIds"),
    byPattern: groupBy(recommendations, "pattern"),
    adaptationValidationStatus: {
      valid: true,
      recommendationCount: recommendations.length,
      reviewCount: reviews.length,
      governanceMutation: false,
      authorityMutation: false,
      ruleMutation: false,
      thresholdMutation: false,
      participantScoring: false,
      sourceScoring: false,
      modelRanking: false,
      agentRanking: false
    }
  };
}

function adaptationForId(adaptationProjection, adaptationId) {
  return {
    schema: "clista.adaptation.item.v0",
    adaptationId,
    item: adaptationProjection.byRecommendation[adaptationId]
      || adaptationProjection.reviews.find((item) => item.id === adaptationId)
      || null
  };
}

function selectAdaptationForThread(adaptationProjection, threadId) {
  const recommendations = adaptationProjection.recommendations
    .filter((item) => item.threadId === threadId)
    .map(compactAdaptationRecord);
  const reviews = adaptationProjection.reviews
    .filter((item) => item.threadId === threadId)
    .map(compactAdaptationRecord);
  return {
    schema: "clista.adaptation.thread.v0",
    threadId,
    theorem: adaptationProjection.theorem,
    hardLaw: adaptationProjection.hardLaw,
    recommendations,
    reviews,
    byPattern: groupBy(recommendations, "pattern")
  };
}

function validateAdaptationReview(review, priorEvents = []) {
  return validateAdaptationObject(review, priorEvents, "adaptation review", { allowWithoutLearningSignal: true });
}

function validateGovernanceReviewRecommendation(recommendation, priorEvents = []) {
  return validateAdaptationObject(recommendation, priorEvents, "governance review recommendation");
}

function validateEvidenceRequirementReviewRecommendation(recommendation, priorEvents = []) {
  return validateAdaptationObject(recommendation, priorEvents, "evidence requirement review recommendation");
}

function validateRevisitTriggerReviewRecommendation(recommendation, priorEvents = []) {
  return validateAdaptationObject(recommendation, priorEvents, "revisit trigger review recommendation");
}

function validateDecisionGateReviewRecommendation(recommendation, priorEvents = []) {
  return validateAdaptationObject(recommendation, priorEvents, "decision gate review recommendation");
}

function validateAdaptationObject(object, priorEvents, label, options = {}) {
  const reasons = [];
  if (!object?.id) {
    reasons.push(`${label} requires id`);
  }
  if (!String(object?.pattern || "").trim()) {
    reasons.push(`${label} requires pattern`);
  }
  if (!String(object?.finding || object?.summary || "").trim()) {
    reasons.push(`${label} requires finding`);
  }
  if (!String(object?.recommendation || "").trim() && label !== "adaptation review") {
    reasons.push(`${label} requires recommendation`);
  }
  const confidence = normalizeConfidence(object?.confidence);
  if (!VALID_CONFIDENCE.has(confidence)) {
    reasons.push(`${label} requires confidence low, medium, or high`);
  }

  for (const reason of rejectMutationAndScoringFields(object)) {
    reasons.push(reason);
  }
  for (const reason of validateAdaptationReferences(object, priorEvents, options)) {
    reasons.push(reason);
  }

  return reasons;
}

function rejectMutationAndScoringFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }

  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`adaptation field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      reasons.push(`adaptation cannot automatically mutate governance or score actors via ${fullPath.join(".")}`);
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectMutationAndScoringFields(child, fullPath));
    }
  }

  return reasons;
}

function validateAdaptationReferences(object, priorEvents = [], options = {}) {
  const reasons = [];
  const index = adaptationReferenceIndex(priorEvents);
  const learningSignalIds = object?.learningSignalIds || object?.relatedLearningSignalIds || [];
  if (!options.allowWithoutLearningSignal && !learningSignalIds.length) {
    reasons.push("adaptation recommendation requires learningSignalIds");
  }
  for (const id of learningSignalIds) {
    if (!index.learningSignals.has(id)) {
      reasons.push(`adaptation references unknown or future learning signal ${id}`);
    }
  }
  for (const id of object?.relatedContributions || object?.relatedContributionIds || []) {
    if (!index.contributions.has(id)) {
      reasons.push(`adaptation references unknown or future contribution ${id}`);
    }
  }
  for (const id of object?.outcomeRefs || object?.outcomeIds || []) {
    if (!index.outcomes.has(id)) {
      reasons.push(`adaptation references unknown or future outcome ${id}`);
    }
  }
  for (const eventId of object?.generatedFromEventIds || []) {
    if (!index.events.has(eventId)) {
      reasons.push(`adaptation references unknown or future event ${eventId}`);
    }
  }
  return reasons;
}

function adaptationReferenceIndex(events = []) {
  const eventsById = new Map();
  const learningSignals = new Set();
  const contributions = new Set();
  const outcomes = new Set();

  for (const event of events) {
    if (event?.event_id) {
      eventsById.set(event.event_id, event);
    }
    const object = primaryObject(event);
    if (object?.id) {
      contributions.add(object.id);
    }
    if (event.event_type === "LearningSignalRecorded" && event.payload?.learningSignal?.id) {
      learningSignals.add(event.payload.learningSignal.id);
    }
    if (event.event_type === "ExpectedOutcomeDeclared" && object?.id) {
      outcomes.add(object.id);
    }
    if (event.event_type === "OutcomeAudited" && object?.id) {
      outcomes.add(object.id);
    }
    if (event.event_type === "DecisionScored" && object?.id) {
      outcomes.add(object.id);
    }
  }

  return {
    events: eventsById,
    learningSignals,
    contributions,
    outcomes
  };
}

function addRecommendation(state, recommendation) {
  if (!recommendation) {
    return;
  }
  state.recommendations.push(normalizeAdaptationRecord(recommendation, "adaptationRecommendation"));
}

function addReview(state, review) {
  if (!review) {
    return;
  }
  state.reviews.push(normalizeAdaptationRecord(review, "adaptationReview"));
}

function normalizeAdaptationRecord(record, objectType) {
  const normalized = stripUndefined({
    id: record.id || deterministicId("adp", record.recommendationType || "recommendation", [
      record.pattern,
      ...(record.learningSignalIds || []),
      ...(record.outcomeRefs || [])
    ].join(":")),
    object: record.object || objectType,
    recommendationType: record.recommendationType,
    pattern: normalizePattern(record.pattern),
    threadId: record.threadId || null,
    learningSignalIds: unique(record.learningSignalIds || []),
    learningPatterns: unique(record.learningPatterns || []),
    relatedContributions: unique(record.relatedContributions || []),
    outcomeRefs: unique(record.outcomeRefs || []),
    provenanceRefs: unique(record.provenanceRefs || []),
    finding: record.finding,
    recommendation: record.recommendation,
    confidence: normalizeConfidence(record.confidence),
    authorityMutation: false,
    governanceMutation: false,
    ruleMutation: false,
    thresholdMutation: false,
    participantScoring: false,
    sourceScoring: false,
    modelRanking: false,
    agentRanking: false,
    generatedFromEventIds: unique(record.generatedFromEventIds || []),
    sourceEventId: record.sourceEventId,
    explicit: Boolean(record.explicit),
    derived: record.derived !== false,
    createdAt: record.createdAt || null
  });
  normalized.adaptationHash = contentHash({
    recommendationType: normalized.recommendationType,
    pattern: normalized.pattern,
    learningSignalIds: normalized.learningSignalIds,
    learningPatterns: normalized.learningPatterns,
    relatedContributions: normalized.relatedContributions,
    outcomeRefs: normalized.outcomeRefs,
    finding: normalized.finding,
    recommendation: normalized.recommendation,
    confidence: normalized.confidence
  });
  return normalized;
}

function compactAdaptationRecord(record) {
  return {
    id: record.id,
    object: record.object,
    recommendationType: record.recommendationType,
    pattern: record.pattern,
    threadId: record.threadId,
    learningSignalIds: record.learningSignalIds,
    learningPatterns: record.learningPatterns,
    relatedContributions: record.relatedContributions,
    outcomeRefs: record.outcomeRefs,
    finding: record.finding,
    recommendation: record.recommendation,
    confidence: record.confidence,
    authorityMutation: false,
    governanceMutation: false,
    ruleMutation: false,
    thresholdMutation: false,
    participantScoring: false,
    sourceScoring: false,
    modelRanking: false,
    agentRanking: false,
    adaptationHash: record.adaptationHash
  };
}

function primaryObject(event) {
  const payload = event?.payload || {};
  return payload.thread
    || payload.threadFork
    || payload.participant
    || payload.participantRole
    || payload.participantAuthority
    || payload.participantAuthorityRevocation
    || payload.contributionAttribution
    || payload.attributionCorrection
    || payload.attributionDispute
    || payload.attributionRevocation
    || payload.evidence
    || payload.assumption
    || payload.claim
    || payload.position
    || payload.objection
    || payload.alignmentSnapshot
    || payload.decisionRequest
    || payload.review
    || payload.decisionRecord
    || payload.minorityReport
    || payload.mergeRequest
    || payload.mergeReview
    || payload.mergeConflict
    || payload.mergeConflictResolution
    || payload.mergeCompletion
    || payload.expectedOutcome
    || payload.outcomeAudit
    || payload.decisionScore
    || payload.learningSignal
    || payload.patternObservation
    || payload.outcomeReview
    || payload.learningRecommendation
    || payload.adaptationReview
    || payload.governanceReviewRecommendation
    || payload.evidenceRequirementReviewRecommendation
    || payload.revisitTriggerReviewRecommendation
    || payload.decisionGateReviewRecommendation
    || null;
}

function normalizePattern(pattern) {
  return String(pattern || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeConfidence(confidence) {
  const normalized = String(confidence || "low").trim().toLowerCase();
  return VALID_CONFIDENCE.has(normalized) ? normalized : normalized;
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizePattern(type).slice(0, 24) || "recommendation"}_${hash}`;
}






module.exports = {
  ADAPTATION_EVENT_TYPES,
  ADAPTATION_SCHEMA,
  ADAPTATION_VERIFY_SCHEMA,
  adaptationForId,
  buildAdaptationState,
  emptyAdaptationState,
  projectAdaptation,
  rejectMutationAndScoringFields,
  selectAdaptationForThread,
  validateAdaptationReview,
  validateDecisionGateReviewRecommendation,
  validateEvidenceRequirementReviewRecommendation,
  validateGovernanceReviewRecommendation,
  validateRevisitTriggerReviewRecommendation
};
