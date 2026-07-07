const { amendmentForId } = require("../amendments");
const {
  appendEvent,
  createEvent,
  newId,
  nowIso,
  parseList
} = require("../events");
const { projectEvents } = require("../projector");
const { stripUndefined } = require("../utils");
const { validateEvents } = require("../validator");
const {
  appendParticipant,
  participantFrom,
  print,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function amendmentPropose(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "title");
  requireOption(options, "type");
  requireOption(options, "target");
  requireOption(options, "rationale");
  requireOption(options, "change");
  const actor = participantFrom(options.proposedBy || options.actor || "Author", options.role || "contributor", options.kind || "human");
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const protocolAmendment = {
    id: options.id || newId("amd", options.title),
    object: "protocolAmendment",
    title: options.title,
    amendmentType: options.type,
    target: options.target,
    rationale: options.rationale,
    proposedChange: options.change,
    effectScope: options.effectScope || "future_only",
    threadId: options.thread,
    adaptationRecommendationIds: parseList(options.adaptation || options.adaptationRecommendation || options.adaptationRecommendations),
    learningSignalIds: parseList(options.learning || options.learningSignal || options.learningSignals),
    sourceEventIds: parseList(options.sourceEvent || options.sourceEvents),
    proposedBy: actor.id,
    proposedAt: at,
    automaticAmendment: false,
    implicitMutation: false,
    hiddenPolicyMutation: false,
    retroactiveMutation: false,
    rewritesPastEvents: false,
    recommendationBecomesAmendment: false
  };
  stripUndefined(protocolAmendment);
  const event = createEvent({
    type: "ProtocolAmendmentProposed",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { protocolAmendment }
  });
  appendEvent(event, cwd);
  return print({ protocolAmendment, event });
}

function amendmentList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let amendments = options.thread
    ? projection.amendments.amendments.filter((amendment) => amendment.threadId === options.thread)
    : projection.amendments.amendments;
  if (options.status) {
    amendments = amendments.filter((amendment) => amendment.status === options.status);
  }
  return print({
    schema: "clista.amendment.list.v0",
    theorem: projection.amendments.theorem,
    hardLaw: projection.amendments.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: amendments.length,
    amendments
  });
}

function amendmentShow(options, cwd) {
  const amendmentId = options.amendment || options.amendmentId || options.id;
  if (!amendmentId) {
    throw new Error("Missing required option --amendment");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(amendmentForId(projection.amendments, amendmentId));
}

function amendmentVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.amendment.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.amendment.verify.v0",
    valid: true,
    errors: [],
    amendmentValidationStatus: projection.amendments.amendmentValidationStatus
  });
}

function prunePropose(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "objectId");
  requireOption(options, "reason");
  const actor = participantFrom(options.proposedBy || options.actor || "Author", options.role || "contributor", options.kind || "human");
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const pruning = {
    id: options.id || newId("prn", options.objectId),
    object: "pruning",
    threadId: options.thread,
    objectId: options.objectId,
    objectType: options.objectType || "unknown",
    reason: options.reason,
    proposedBy: actor.id,
    proposedAt: at,
    deprecationEvent: "ObjectDeprecated",
    status: "proposed"
  };
  const event = createEvent({
    type: "ObjectDeprecated",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { pruning }
  });
  appendEvent(event, cwd);
  return print({ pruning, event });
}

function pruneList(options, cwd) {
  const events = readEventsForOptions(options, cwd);  // use raw to support new event types during bootstrap
  const pruningEvents = events.filter(e => e.event_type === "ObjectDeprecated");
  return print({
    schema: "clista.pruning.list.v0",
    threadId: options.thread || null,
    count: pruningEvents.length,
    prunings: pruningEvents.map(e => e.payload.pruning || e.payload)
  });
}

module.exports = {
  amendmentList,
  amendmentPropose,
  amendmentShow,
  amendmentVerify,
  pruneList,
  prunePropose
};
