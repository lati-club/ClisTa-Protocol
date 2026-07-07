const { learningForId } = require("../learning");
const { projectEvents } = require("../projector");
const { validateEvents } = require("../validator");
const {
  print,
  readEventsForOptions,
  readValidEventsForOptions
} = require("./shared");

function learningReview(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const learning = options.thread
    ? projection.learning.signals.filter((signal) => signal.threadId === options.thread)
    : projection.learning.signals;
  return print({
    schema: "clista.learning.review.v0",
    theorem: projection.learning.theorem,
    hardLaw: projection.learning.hardLaw,
    threadId: options.thread || null,
    learning: options.thread
      ? {
          ...projection.learning,
          signals: learning,
          patterns: projection.learning.patterns.filter((pattern) => {
            return pattern.signalIds.some((id) => learning.some((signal) => signal.id === id));
          }),
          revisitRecommendations: projection.learning.revisitRecommendations
            .filter((recommendation) => recommendation.threadId === options.thread)
        }
      : projection.learning
  });
}

function learningList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const signals = options.thread
    ? projection.learning.signals.filter((signal) => signal.threadId === options.thread)
    : projection.learning.signals;
  return print({
    schema: "clista.learning.list.v0",
    threadId: options.thread || null,
    count: signals.length,
    signals
  });
}

function learningShow(options, cwd) {
  const learningId = options.learning || options.learningId || options.id;
  if (!learningId) {
    throw new Error("Missing required option --learning");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(learningForId(projection.learning, learningId));
}

function learningVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.learning.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.learning.verify.v0",
    valid: true,
    errors: [],
    learningValidationStatus: projection.learning.learningValidationStatus
  });
}

module.exports = {
  learningList,
  learningReview,
  learningShow,
  learningVerify
};
