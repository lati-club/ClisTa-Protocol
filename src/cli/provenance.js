const { projectEvents } = require("../projector");
const {
  isKnownContribution,
  provenanceForContribution,
  traceProvenance
} = require("../provenance");
const { validateEvents } = require("../validator");
const {
  print,
  readEventsForOptions,
  readValidEventsForOptions
} = require("./shared");

function provenanceList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const provenance = options.thread
    ? projection.provenance.provenance.filter((record) => record.threadId === options.thread)
    : projection.provenance.provenance;
  return print({
    schema: "clista.provenance.list.v0",
    threadId: options.thread || null,
    count: provenance.length,
    provenance
  });
}

function provenanceShow(options, cwd) {
  const contributionId = options.contribution || options.contributionId || options.id;
  if (!contributionId) {
    throw new Error("Missing required option --contribution");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  if (!isKnownContribution(projection, contributionId)) {
    throw new Error(`Unknown contribution id: ${contributionId}`);
  }
  return print(provenanceForContribution(projection.provenance, contributionId));
}

function provenanceTrace(options, cwd) {
  const contributionId = options.contribution || options.contributionId || options.id;
  if (!contributionId) {
    throw new Error("Missing required option --contribution");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  if (!isKnownContribution(projection, contributionId)) {
    throw new Error(`Unknown contribution id: ${contributionId}`);
  }
  return print(traceProvenance(projection.provenance, contributionId));
}

function provenanceVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.provenance.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.provenance.verify.v0",
    valid: true,
    errors: [],
    provenanceValidationStatus: projection.provenance.provenanceValidationStatus
  });
}

module.exports = {
  provenanceList,
  provenanceShow,
  provenanceTrace,
  provenanceVerify
};
