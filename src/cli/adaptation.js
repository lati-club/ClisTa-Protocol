const { adaptationForId } = require("../adaptation");
const { projectEvents } = require("../projector");
const { validateEvents } = require("../validator");
const {
  print,
  readEventsForOptions,
  readValidEventsForOptions
} = require("./shared");

function adaptationReview(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print({
    schema: "clista.adaptation.review.v0",
    theorem: projection.adaptation.theorem,
    hardLaw: projection.adaptation.hardLaw,
    threadId: options.thread || null,
    adaptation: options.thread
      ? adaptationProjectionForThread(projection.adaptation, options.thread)
      : projection.adaptation
  });
}

function adaptationList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const recommendations = options.thread
    ? projection.adaptation.recommendations.filter((recommendation) => recommendation.threadId === options.thread)
    : projection.adaptation.recommendations;
  return print({
    schema: "clista.adaptation.list.v0",
    threadId: options.thread || null,
    count: recommendations.length,
    recommendations
  });
}

function adaptationShow(options, cwd) {
  const adaptationId = options.adaptation || options.adaptationId || options.id;
  if (!adaptationId) {
    throw new Error("Missing required option --adaptation");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(adaptationForId(projection.adaptation, adaptationId));
}

function adaptationVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.adaptation.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.adaptation.verify.v0",
    valid: true,
    errors: [],
    adaptationValidationStatus: projection.adaptation.adaptationValidationStatus
  });
}

function adaptationProjectionForThread(adaptation, threadId) {
  const recommendations = adaptation.recommendations
    .filter((recommendation) => recommendation.threadId === threadId);
  const reviews = adaptation.reviews
    .filter((review) => review.threadId === threadId);
  const recommendationIds = new Set(recommendations.map((recommendation) => recommendation.id));
  const filterBucket = (bucket) => bucket.filter((recommendation) => recommendationIds.has(recommendation.id));
  return {
    ...adaptation,
    recommendations,
    reviews,
    adaptationReviews: reviews,
    governanceReviewRecommendations: filterBucket(adaptation.governanceReviewRecommendations),
    evidenceRequirementReviewRecommendations: filterBucket(adaptation.evidenceRequirementReviewRecommendations),
    revisitTriggerReviewRecommendations: filterBucket(adaptation.revisitTriggerReviewRecommendations),
    decisionGateReviewRecommendations: filterBucket(adaptation.decisionGateReviewRecommendations),
    provenanceRequirementReviewRecommendations: filterBucket(adaptation.provenanceRequirementReviewRecommendations),
    objectionResolutionReviewRecommendations: filterBucket(adaptation.objectionResolutionReviewRecommendations),
    outcomeWindowReviewRecommendations: filterBucket(adaptation.outcomeWindowReviewRecommendations),
    byRecommendation: recommendations.reduce((indexed, recommendation) => {
      indexed[recommendation.id] = recommendation;
      return indexed;
    }, {}),
    byLearningSignal: recommendations.reduce((indexed, recommendation) => {
      for (const learningSignalId of recommendation.learningSignalIds || []) {
        if (!indexed[learningSignalId]) {
          indexed[learningSignalId] = [];
        }
        indexed[learningSignalId].push(recommendation);
      }
      return indexed;
    }, {}),
    byPattern: recommendations.reduce((indexed, recommendation) => {
      if (!indexed[recommendation.pattern]) {
        indexed[recommendation.pattern] = [];
      }
      indexed[recommendation.pattern].push(recommendation);
      return indexed;
    }, {})
  };
}

module.exports = {
  adaptationList,
  adaptationReview,
  adaptationShow,
  adaptationVerify
};
