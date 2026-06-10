const { contentHash } = require("./integrity");
const { groupBy, groupByByValues, indexBy, stripUndefined, unique } = require("./utils");

const LEARNING_SCHEMA = "clista.learning.v0";
const LEARNING_VERIFY_SCHEMA = "clista.learning.verify.v0";

const LEARNING_EVENT_TYPES = new Set([
  "LearningSignalRecorded",
  "PatternObservationRecorded",
  "OutcomeReviewRecorded",
  "LearningRecommendationRecorded"
]);

const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

const SCORING_KEY_PATTERNS = [
  /reputation/i,
  /trust.?score/i,
  /participant.?score/i,
  /actor.?score/i,
  /source.?score/i,
  /model.?rank/i,
  /agent.?rank/i,
  /participant.?rank/i,
  /actor.?rank/i,
  /people.?rank/i,
  /person.?rank/i
];

const AUTHORITY_MUTATION_KEY_PATTERNS = [
  /automatic.?authority/i,
  /authority.?mutation/i,
  /authority.?change/i,
  /modify.?authority/i,
  /revoke.?authority/i,
  /grant.?authority/i
];

function emptyLearningState() {
  return {
    signals: [],
    patternObservations: [],
    outcomeReviews: [],
    recommendations: []
  };
}

function buildLearningState(projection) {
  const state = emptyLearningState();
  deriveOutcomeLearning(projection, state);
  applyExplicitLearningEvents(projection.events || [], state);
  return state;
}

function deriveOutcomeLearning(projection, state) {
  const outcomeAudits = Object.values(projection.outcomeAudits || {})
    .sort((a, b) => String(a.auditedAt || "").localeCompare(String(b.auditedAt || "")));

  for (const audit of outcomeAudits) {
    const expected = projection.expectedOutcomes[audit.expectedOutcomeId] || null;
    const decision = projection.decisionRecords[audit.decisionRecordId] || null;
    const request = decision ? projection.decisionRequests[decision.decisionRequestId] || null : null;
    const relatedClaims = selectObjects(projection.claims, [
      ...(request?.supportingClaimIds || []),
      ...(decision?.supportingClaimIds || [])
    ]);
    const relatedAssumptions = selectObjects(projection.assumptions, [
      ...(expected?.assumptionIds || []),
      ...(audit.failedAssumptionIds || []),
      ...(request?.supportingAssumptionIds || []),
      ...(decision?.supportingAssumptionIds || [])
    ]);
    const relatedEvidence = selectObjects(projection.evidence, [
      ...(expected?.evidenceIds || []),
      ...(audit.evidenceIds || []),
      ...(audit.failedEvidenceIds || []),
      ...(request?.supportingEvidenceIds || []),
      ...(decision?.supportingEvidenceIds || [])
    ]);
    const relatedObjections = selectObjects(projection.objections, [
      ...(request?.objectionIds || []),
      ...(decision?.objectionIds || []),
      ...(decision?.preservedObjectionIds || [])
    ]);
    const relatedReviews = selectObjects(projection.reviews, decision?.reviewIds || []);

    addSignal(state, {
      signalType: "outcome_review",
      pattern: patternForOutcomeResult(audit.result),
      threadId: audit.threadId,
      relatedContributions: unique([
        expected?.id,
        audit.id,
        decision?.id
      ]),
      outcomeRefs: unique([expected?.id, audit.id]),
      finding: findingForOutcome(audit, expected),
      confidence: confidenceForOutcome(audit.result),
      generatedFromEventIds: eventIdsForObjects(projection, [audit.id, expected?.id, decision?.id]),
      createdAt: audit.auditedAt
    });

    for (const assumption of selectObjects(projection.assumptions, audit.failedAssumptionIds || [])) {
      const provenance = provenanceForContribution(projection, assumption.id);
      addSignal(state, {
        signalType: "assumption_accuracy",
        pattern: hasEvidenceProvenance(provenance)
          ? "assumption_with_evidence_provenance_failed"
          : "assumption_without_evidence_provenance_failed",
        threadId: audit.threadId,
        relatedContributions: unique([assumption.id, expected?.id, audit.id]),
        outcomeRefs: unique([expected?.id, audit.id]),
        provenanceRefs: provenance.map((record) => record.id),
        finding: `Assumption ${assumption.id} was marked failed by outcome ${audit.id}.`,
        confidence: "medium",
        generatedFromEventIds: eventIdsForObjects(projection, [assumption.id, audit.id]),
        createdAt: audit.auditedAt
      });
    }

    for (const evidence of selectObjects(projection.evidence, audit.failedEvidenceIds || [])) {
      const provenance = provenanceForContribution(projection, evidence.id);
      addSignal(state, {
        signalType: "evidence_sufficiency",
        pattern: "evidence_linked_to_failed_outcome",
        threadId: audit.threadId,
        relatedContributions: unique([evidence.id, expected?.id, audit.id]),
        outcomeRefs: unique([expected?.id, audit.id]),
        provenanceRefs: provenance.map((record) => record.id),
        finding: `Evidence ${evidence.id} was linked to failed outcome ${audit.id}.`,
        confidence: "medium",
        generatedFromEventIds: eventIdsForObjects(projection, [evidence.id, audit.id]),
        createdAt: audit.auditedAt
      });
    }

    if (relatedClaims.length) {
      addSignal(state, {
        signalType: "claim_outcome_review",
        pattern: isFailedOutcome(audit.result)
          ? "claims_supported_failed_decision"
          : "claims_supported_confirmed_or_partial_decision",
        threadId: audit.threadId,
        relatedContributions: unique([
          ...relatedClaims.map((claim) => claim.id),
          expected?.id,
          audit.id,
          decision?.id
        ]),
        outcomeRefs: unique([expected?.id, audit.id]),
        finding: `Decision claims were reviewed against outcome ${audit.id}.`,
        confidence: "low",
        generatedFromEventIds: eventIdsForObjects(projection, [
          ...relatedClaims.map((claim) => claim.id),
          audit.id
        ]),
        createdAt: audit.auditedAt
      });
    }

    if (isFailedOutcome(audit.result)) {
      addObjectionLearning(projection, state, audit, expected, relatedObjections);
      addRecommendation(state, {
        recommendationType: "revisit",
        pattern: "failed_outcome_requires_revisit",
        threadId: audit.threadId,
        relatedSignals: [],
        relatedContributions: unique([
          decision?.id,
          expected?.id,
          audit.id,
          ...relatedAssumptions.map((assumption) => assumption.id),
          ...relatedEvidence.map((evidence) => evidence.id)
        ]),
        outcomeRefs: unique([expected?.id, audit.id]),
        finding: `Outcome ${audit.id} failed; revisit the decision pattern before reusing it.`,
        confidence: "medium",
        recommendation: "Open a future governance review before repeating this reasoning pattern.",
        authorityMutation: false,
        generatedFromEventIds: eventIdsForObjects(projection, [decision?.id, expected?.id, audit.id]),
        createdAt: audit.auditedAt
      });
    }

    addGovernanceLearning(projection, state, audit, expected, decision, relatedReviews);
  }
}

function addObjectionLearning(projection, state, audit, expected, objections) {
  if (!objections.length) {
    addSignal(state, {
      signalType: "objection_review",
      pattern: "failed_decision_without_recorded_objections",
      threadId: audit.threadId,
      relatedContributions: unique([expected?.id, audit.id]),
      outcomeRefs: unique([expected?.id, audit.id]),
      finding: `Outcome ${audit.id} failed without recorded objections on the decision request.`,
      confidence: "low",
      generatedFromEventIds: eventIdsForObjects(projection, [expected?.id, audit.id]),
      createdAt: audit.auditedAt
    });
    return;
  }

  const failedTargets = new Set([
    ...(audit.failedAssumptionIds || []),
    ...(audit.failedEvidenceIds || [])
  ]);
  const validated = objections.filter((objection) => failedTargets.has(objection.targetObjectId));
  addSignal(state, {
    signalType: "objection_review",
    pattern: validated.length
      ? "objection_later_validated_by_outcome"
      : "decision_with_objections_had_failed_outcome",
    threadId: audit.threadId,
    relatedContributions: unique([
      ...objections.map((objection) => objection.id),
      expected?.id,
      audit.id
    ]),
    outcomeRefs: unique([expected?.id, audit.id]),
    finding: validated.length
      ? `Outcome ${audit.id} validated ${validated.length} recorded objection target.`
      : `Outcome ${audit.id} failed after objections were recorded.`,
    confidence: validated.length ? "medium" : "low",
    generatedFromEventIds: eventIdsForObjects(projection, [
      ...objections.map((objection) => objection.id),
      audit.id
    ]),
    createdAt: audit.auditedAt
  });
}

function addGovernanceLearning(projection, state, audit, expected, decision, reviews) {
  const documentedReviews = reviews.filter((review) => {
    return String(review.comment || review.summary || "").trim() || (review.conditions || []).length;
  });
  addSignal(state, {
    signalType: "governance_review_quality",
    pattern: documentedReviews.length === reviews.length && reviews.length
      ? "governance_reviews_documented_rationale"
      : "governance_reviews_missing_rationale",
    threadId: audit.threadId,
    relatedContributions: unique([
      decision?.id,
      expected?.id,
      audit.id,
      ...reviews.map((review) => review.id)
    ]),
    outcomeRefs: unique([expected?.id, audit.id]),
    finding: reviews.length
      ? `Governance reviews for decision ${decision?.id || "unknown"} were checked for audit rationale.`
      : `Decision ${decision?.id || "unknown"} had no projected governance reviews to learn from.`,
    confidence: "low",
    generatedFromEventIds: eventIdsForObjects(projection, [
      decision?.id,
      audit.id,
      ...reviews.map((review) => review.id)
    ]),
    createdAt: audit.auditedAt
  });
}

function applyExplicitLearningEvents(events, state) {
  for (const event of events) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "LearningSignalRecorded":
        addSignal(state, normalizeExplicitLearningObject(
          payload.learningSignal,
          event,
          "learningSignal",
          "learning_signal"
        ));
        break;
      case "PatternObservationRecorded":
        state.patternObservations.push(normalizeExplicitLearningObject(
          payload.patternObservation,
          event,
          "patternObservation",
          "pattern_observation"
        ));
        break;
      case "OutcomeReviewRecorded":
        state.outcomeReviews.push(normalizeExplicitLearningObject(
          payload.outcomeReview,
          event,
          "outcomeReview",
          "outcome_review"
        ));
        break;
      case "LearningRecommendationRecorded":
        addRecommendation(state, normalizeExplicitLearningObject(
          payload.learningRecommendation,
          event,
          "learningRecommendation",
          "learning_recommendation"
        ));
        break;
      default:
        break;
    }
  }
}

function normalizeExplicitLearningObject(object, event, objectType, defaultType) {
  if (!object) {
    return null;
  }
  return stripUndefined({
    id: object.id || deterministicId("lrn", defaultType, event.event_id),
    object: object.object || objectType,
    signalType: object.signalType || object.observationType || object.recommendationType || defaultType,
    recommendationType: object.recommendationType,
    pattern: normalizePattern(object.pattern),
    threadId: object.threadId || event.thread_id,
    relatedContributions: unique(object.relatedContributions || object.relatedContributionIds || []),
    outcomeRefs: unique(object.outcomeRefs || object.outcomeIds || []),
    provenanceRefs: unique(object.provenanceRefs || object.provenanceIds || []),
    relatedSignals: unique(object.relatedSignals || object.relatedSignalIds || []),
    finding: object.finding || object.summary,
    confidence: normalizeConfidence(object.confidence),
    recommendation: object.recommendation,
    actorScoring: false,
    sourceScoring: false,
    modelRanking: false,
    authorityMutation: false,
    generatedFromEventIds: unique([...(object.generatedFromEventIds || []), event.event_id]),
    sourceEventId: event.event_id,
    explicit: true,
    derived: false,
    createdAt: object.createdAt || event.timestamp
  });
}

function projectLearning(state) {
  const signals = state.signals.filter(Boolean);
  const patternObservations = state.patternObservations.filter(Boolean);
  const outcomeReviews = state.outcomeReviews.filter(Boolean);
  const recommendations = state.recommendations.filter(Boolean);
  const patterns = summarizePatterns(signals, patternObservations);

  return {
    schema: LEARNING_SCHEMA,
    theorem: "protocol_learning = update(reasoning_patterns, outcome_evidence)",
    hardLaw: "learning != reputation",
    patterns,
    signals,
    outcomeCorrelations: signals.filter((signal) => signal.signalType === "outcome_review" || signal.signalType === "claim_outcome_review"),
    assumptionReviews: signals.filter((signal) => signal.signalType === "assumption_accuracy"),
    objectionReviews: signals.filter((signal) => signal.signalType === "objection_review"),
    evidenceReviews: signals.filter((signal) => signal.signalType === "evidence_sufficiency"),
    governanceReviews: signals.filter((signal) => signal.signalType === "governance_review_quality"),
    patternObservations,
    outcomeReviews,
    revisitRecommendations: recommendations,
    bySignal: indexBy(signals, "id"),
    byPattern: groupBy([...signals, ...patternObservations, ...recommendations], "pattern"),
    byOutcome: groupByByValues(signals, "outcomeRefs"),
    learningValidationStatus: {
      valid: true,
      signalCount: signals.length,
      patternCount: patterns.length,
      recommendationCount: recommendations.length,
      actorScoring: false,
      sourceScoring: false,
      modelRanking: false,
      authorityMutation: false
    }
  };
}

function learningForId(learningProjection, learningId) {
  return {
    schema: "clista.learning.item.v0",
    learningId,
    item: learningProjection.bySignal[learningId]
      || learningProjection.patternObservations.find((item) => item.id === learningId)
      || learningProjection.outcomeReviews.find((item) => item.id === learningId)
      || learningProjection.revisitRecommendations.find((item) => item.id === learningId)
      || null
  };
}

function selectLearningForThread(learningProjection, threadId) {
  const signals = learningProjection.signals
    .filter((signal) => signal.threadId === threadId)
    .map(compactLearningRecord);
  const recommendations = learningProjection.revisitRecommendations
    .filter((recommendation) => recommendation.threadId === threadId)
    .map(compactLearningRecord);
  return {
    schema: "clista.learning.thread.v0",
    threadId,
    theorem: learningProjection.theorem,
    hardLaw: learningProjection.hardLaw,
    patterns: summarizePatterns(signals, []),
    signals,
    revisitRecommendations: recommendations,
    byPattern: groupBy([...signals, ...recommendations], "pattern")
  };
}

function validateLearningSignal(signal, priorEvents = []) {
  return validateLearningObject(signal, priorEvents, "learning signal");
}

function validatePatternObservation(observation, priorEvents = []) {
  return validateLearningObject(observation, priorEvents, "pattern observation");
}

function validateOutcomeReview(review, priorEvents = []) {
  return validateLearningObject(review, priorEvents, "outcome review");
}

function validateLearningRecommendation(recommendation, priorEvents = []) {
  return validateLearningObject(recommendation, priorEvents, "learning recommendation");
}

function validateLearningObject(object, priorEvents, label) {
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
  const confidence = normalizeConfidence(object?.confidence);
  if (!VALID_CONFIDENCE.has(confidence)) {
    reasons.push(`${label} requires confidence low, medium, or high`);
  }

  for (const reason of rejectScoringFields(object)) {
    reasons.push(reason);
  }
  for (const reason of validateLearningReferences(object, priorEvents)) {
    reasons.push(reason);
  }

  return reasons;
}

function rejectScoringFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }

  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (["actorScoring", "sourceScoring", "modelRanking", "authorityMutation"].includes(key)) {
      if (child === true) {
        reasons.push(`learning field ${fullPath.join(".")} must be false`);
        if (key === "authorityMutation") {
          reasons.push(`learning cannot automatically mutate governance authority via ${fullPath.join(".")}`);
        } else {
          reasons.push(`learning cannot include reputation, scoring, or ranking field ${fullPath.join(".")}`);
        }
      }
      continue;
    }
    if (SCORING_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      reasons.push(`learning cannot include reputation, scoring, or ranking field ${fullPath.join(".")}`);
    }
    if (AUTHORITY_MUTATION_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      reasons.push(`learning cannot automatically mutate governance authority via ${fullPath.join(".")}`);
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectScoringFields(child, fullPath));
    }
  }

  return reasons;
}

function validateLearningReferences(object, priorEvents = []) {
  const reasons = [];
  const index = learningReferenceIndex(priorEvents);
  for (const id of object?.relatedContributions || object?.relatedContributionIds || []) {
    if (!index.contributions.has(id)) {
      reasons.push(`learning references unknown or future contribution ${id}`);
    }
  }
  for (const id of object?.outcomeRefs || object?.outcomeIds || []) {
    if (!index.outcomes.has(id)) {
      reasons.push(`learning references unknown or future outcome ${id}`);
    }
  }
  for (const id of object?.governanceRefs || object?.governanceIds || []) {
    if (!index.governance.has(id)) {
      reasons.push(`learning references unknown or future governance event ${id}`);
    }
  }
  for (const id of object?.provenanceRefs || object?.provenanceIds || []) {
    if (!index.provenance.has(id)) {
      reasons.push(`learning references unknown or future provenance ${id}`);
    }
  }
  for (const eventId of object?.generatedFromEventIds || []) {
    if (!index.events.has(eventId)) {
      reasons.push(`learning references unknown or future event ${eventId}`);
    }
  }
  return reasons;
}

function learningReferenceIndex(events = []) {
  const eventsById = new Map();
  const contributions = new Set();
  const outcomes = new Set();
  const governance = new Set();
  const provenance = new Set();

  for (const event of events) {
    if (event?.event_id) {
      eventsById.set(event.event_id, event);
      provenance.add(`prv_atr_${event.event_id}`);
    }
    const object = primaryObject(event);
    if (object?.id) {
      contributions.add(object.id);
      provenance.add(`prv_atr_${event.event_id}`);
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
    if (event.event_type === "ReviewSubmitted" && object?.id) {
      governance.add(object.id);
    }
    if (event.event_type === "MergeReviewSubmitted" && object?.id) {
      governance.add(object.id);
    }
  }

  return {
    events: eventsById,
    contributions,
    outcomes,
    governance,
    provenance
  };
}

function addSignal(state, signal) {
  if (!signal) {
    return;
  }
  state.signals.push(normalizeLearningRecord(signal, "learningSignal"));
}

function addRecommendation(state, recommendation) {
  if (!recommendation) {
    return;
  }
  state.recommendations.push(normalizeLearningRecord(recommendation, "learningRecommendation"));
}

function normalizeLearningRecord(record, objectType) {
  const normalized = stripUndefined({
    id: record.id || deterministicId("lrn", record.signalType || record.recommendationType || "signal", [
      record.pattern,
      ...(record.outcomeRefs || []),
      ...(record.relatedContributions || [])
    ].join(":")),
    object: record.object || objectType,
    signalType: record.signalType,
    recommendationType: record.recommendationType,
    pattern: normalizePattern(record.pattern),
    threadId: record.threadId || null,
    relatedContributions: unique(record.relatedContributions || []),
    outcomeRefs: unique(record.outcomeRefs || []),
    provenanceRefs: unique(record.provenanceRefs || []),
    relatedSignals: unique(record.relatedSignals || []),
    finding: record.finding,
    confidence: normalizeConfidence(record.confidence),
    recommendation: record.recommendation,
    actorScoring: false,
    sourceScoring: false,
    modelRanking: false,
    authorityMutation: false,
    generatedFromEventIds: unique(record.generatedFromEventIds || []),
    sourceEventId: record.sourceEventId,
    explicit: Boolean(record.explicit),
    derived: record.derived !== false,
    createdAt: record.createdAt || null
  });
  normalized.learningHash = contentHash({
    signalType: normalized.signalType,
    recommendationType: normalized.recommendationType,
    pattern: normalized.pattern,
    relatedContributions: normalized.relatedContributions,
    outcomeRefs: normalized.outcomeRefs,
    provenanceRefs: normalized.provenanceRefs,
    finding: normalized.finding,
    confidence: normalized.confidence,
    recommendation: normalized.recommendation
  });
  return normalized;
}

function summarizePatterns(signals, observations) {
  const grouped = groupBy([...signals, ...observations], "pattern");
  return Object.entries(grouped).map(([pattern, records]) => ({
    id: deterministicId("ptn", pattern, records.map((record) => record.id).join(":")),
    object: "learningPattern",
    pattern,
    signalCount: records.length,
    signalIds: records.map((record) => record.id),
    confidence: summarizeConfidence(records.map((record) => record.confidence)),
    actorScoring: false,
    sourceScoring: false,
    modelRanking: false
  }));
}

function compactLearningRecord(record) {
  return {
    id: record.id,
    object: record.object,
    signalType: record.signalType,
    recommendationType: record.recommendationType,
    pattern: record.pattern,
    threadId: record.threadId,
    relatedContributions: record.relatedContributions,
    outcomeRefs: record.outcomeRefs,
    provenanceRefs: record.provenanceRefs,
    finding: record.finding,
    confidence: record.confidence,
    recommendation: record.recommendation,
    actorScoring: false,
    sourceScoring: false,
    modelRanking: false,
    authorityMutation: false,
    learningHash: record.learningHash
  };
}

function patternForOutcomeResult(result) {
  switch (result) {
    case "confirmed":
      return "expected_outcome_confirmed";
    case "partially_confirmed":
      return "expected_outcome_partially_confirmed";
    case "failed":
      return "expected_outcome_failed";
    default:
      return "expected_outcome_inconclusive";
  }
}

function findingForOutcome(audit, expected) {
  const expectedText = expected?.metric
    ? `${expected.metric} ${expected.operator || ""} ${expected.target ?? ""}`.trim()
    : audit.expectedOutcomeId;
  return `Outcome ${audit.id} reviewed expectation ${expectedText} with result ${audit.result}.`;
}

function confidenceForOutcome(result) {
  if (result === "confirmed" || result === "failed") {
    return "medium";
  }
  return "low";
}

function isFailedOutcome(result) {
  return result === "failed" || result === "partially_confirmed";
}

function hasEvidenceProvenance(records) {
  return records.some((record) => {
    return (record.sourceRefs || []).some((sourceRef) => sourceRef.sourceType === "evidence");
  });
}

function provenanceForContribution(projection, contributionId) {
  return projection.provenance?.byContribution?.[contributionId] || [];
}

function selectObjects(collection, ids = []) {
  return unique(ids).map((id) => collection?.[id]).filter(Boolean);
}

function eventIdsForObjects(projection, objectIds = []) {
  const wanted = new Set(unique(objectIds));
  return unique((projection.events || [])
    .filter((event) => wanted.has(primaryObject(event)?.id))
    .map((event) => event.event_id));
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

function summarizeConfidence(confidences) {
  if (confidences.includes("high")) {
    return "high";
  }
  if (confidences.includes("medium")) {
    return "medium";
  }
  return "low";
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizePattern(type).slice(0, 24) || "signal"}_${hash}`;
}






module.exports = {
  LEARNING_EVENT_TYPES,
  LEARNING_SCHEMA,
  LEARNING_VERIFY_SCHEMA,
  buildLearningState,
  emptyLearningState,
  learningForId,
  projectLearning,
  rejectScoringFields,
  selectLearningForThread,
  validateLearningRecommendation,
  validateLearningSignal,
  validateOutcomeReview,
  validatePatternObservation
};
