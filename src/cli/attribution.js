const {
  attributionForContribution,
  attributionsForParticipant
} = require("../attribution");
const { participantIdFor } = require("../events");
const { projectEvents } = require("../projector");
const { validateEvents } = require("../validator");
const {
  print,
  readEventsForOptions,
  readValidEventsForOptions
} = require("./shared");

function attributionList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const attributions = options.thread
    ? projection.attribution.attributions.filter((record) => record.threadId === options.thread)
    : projection.attribution.attributions;
  return print({
    schema: "clista.attribution.list.v0",
    threadId: options.thread || null,
    count: attributions.length,
    attributions
  });
}

function attributionShow(options, cwd) {
  const contributionId = options.contribution || options.contributionId || options.id;
  if (!contributionId) {
    throw new Error("Missing required option --contribution");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(attributionForContribution(projection.attribution, contributionId));
}

function attributionByParticipant(options, cwd) {
  const participant = options.participant || options.participantId || options.id;
  if (!participant) {
    throw new Error("Missing required option --participant");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(attributionsForParticipant(projection.attribution, participantIdFor(participant)));
}

function attributionVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.attribution.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.attribution.verify.v0",
    valid: true,
    errors: [],
    attributionValidationStatus: projection.attribution.attributionValidationStatus
  });
}

module.exports = {
  attributionByParticipant,
  attributionList,
  attributionShow,
  attributionVerify
};
