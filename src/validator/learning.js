const {
  validateAdaptationReview,
  validateDecisionGateReviewRecommendation,
  validateEvidenceRequirementReviewRecommendation,
  validateGovernanceReviewRecommendation,
  validateRevisitTriggerReviewRecommendation
} = require("../adaptation");
const {
  validateLearningRecommendation,
  validateLearningSignal,
  validateOutcomeReview,
  validatePatternObservation
} = require("../learning");
const { addError } = require("./shared");

function validateLearningSignalRecorded(event, state) {
  const signal = event.payload.learningSignal;
  if (!signal) {
    addError(state, event, "LearningSignalRecorded payload missing learningSignal");
    return;
  }
  for (const reason of validateLearningSignal(signal, state.events)) {
    addError(state, event, reason);
  }
}

function validatePatternObservationRecorded(event, state) {
  const observation = event.payload.patternObservation;
  if (!observation) {
    addError(state, event, "PatternObservationRecorded payload missing patternObservation");
    return;
  }
  for (const reason of validatePatternObservation(observation, state.events)) {
    addError(state, event, reason);
  }
}

function validateOutcomeReviewRecorded(event, state) {
  const review = event.payload.outcomeReview;
  if (!review) {
    addError(state, event, "OutcomeReviewRecorded payload missing outcomeReview");
    return;
  }
  for (const reason of validateOutcomeReview(review, state.events)) {
    addError(state, event, reason);
  }
}

function validateLearningRecommendationRecorded(event, state) {
  const recommendation = event.payload.learningRecommendation;
  if (!recommendation) {
    addError(state, event, "LearningRecommendationRecorded payload missing learningRecommendation");
    return;
  }
  for (const reason of validateLearningRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

function validateAdaptationReviewRecorded(event, state) {
  const review = event.payload.adaptationReview;
  if (!review) {
    addError(state, event, "AdaptationReviewRecorded payload missing adaptationReview");
    return;
  }
  for (const reason of validateAdaptationReview(review, state.events)) {
    addError(state, event, reason);
  }
}

function validateGovernanceReviewRecommendedEvent(event, state) {
  const recommendation = event.payload.governanceReviewRecommendation;
  if (!recommendation) {
    addError(state, event, "GovernanceReviewRecommended payload missing governanceReviewRecommendation");
    return;
  }
  for (const reason of validateGovernanceReviewRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

function validateEvidenceRequirementReviewRecommendedEvent(event, state) {
  const recommendation = event.payload.evidenceRequirementReviewRecommendation;
  if (!recommendation) {
    addError(state, event, "EvidenceRequirementReviewRecommended payload missing evidenceRequirementReviewRecommendation");
    return;
  }
  for (const reason of validateEvidenceRequirementReviewRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

function validateRevisitTriggerReviewRecommendedEvent(event, state) {
  const recommendation = event.payload.revisitTriggerReviewRecommendation;
  if (!recommendation) {
    addError(state, event, "RevisitTriggerReviewRecommended payload missing revisitTriggerReviewRecommendation");
    return;
  }
  for (const reason of validateRevisitTriggerReviewRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

function validateDecisionGateReviewRecommendedEvent(event, state) {
  const recommendation = event.payload.decisionGateReviewRecommendation;
  if (!recommendation) {
    addError(state, event, "DecisionGateReviewRecommended payload missing decisionGateReviewRecommendation");
    return;
  }
  for (const reason of validateDecisionGateReviewRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

module.exports = {
  validateAdaptationReviewRecorded,
  validateDecisionGateReviewRecommendedEvent,
  validateEvidenceRequirementReviewRecommendedEvent,
  validateGovernanceReviewRecommendedEvent,
  validateLearningRecommendationRecorded,
  validateLearningSignalRecorded,
  validateOutcomeReviewRecorded,
  validatePatternObservationRecorded,
  validateRevisitTriggerReviewRecommendedEvent
};
