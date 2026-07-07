const {
  appendEvent,
  contentHash,
  createEvent,
  createParticipant,
  newId,
  nowIso,
  parseList
} = require("../events");
const {
  projectEvents,
  selectForkLineage
} = require("../projector");
const { unique } = require("../utils");
const {
  appendParticipant,
  participantFrom,
  print,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function threadCreate(options, cwd) {
  requireOption(options, "title");
  requireOption(options, "question");
  const actorKind = options.actorKind || (options.actor ? "human" : "system");
  const actor = participantFrom(options.actor || "System", options.actorRole || "system", actorKind);
  const participantSpecs = parseList(options.participant || options.participants);
  const participants = participantSpecs.length
    ? participantSpecs.map(parseParticipantSpec)
    : [actor];
  const at = nowIso();
  const thread = {
    id: options.id || newId("thd", options.title),
    object: "thread",
    title: options.title,
    question: options.question,
    status: "active",
    participantIds: unique(participants.map((participant) => participant.id)),
    createdAt: at,
    updatedAt: at
  };
  appendParticipant(actor, cwd, thread.id);
  for (const participant of participants) {
    appendParticipant(participant, cwd, thread.id);
  }
  const event = createEvent({
    type: "ThreadCreated",
    threadId: thread.id,
    actorId: actor.id,
    at,
    payload: { thread }
  });
  appendEvent(event, cwd);
  return print({ thread, event });
}

function threadFork(options, cwd) {
  requireOption(options, "parent");
  requireOption(options, "fork");
  requireOption(options, "title");
  requireOption(options, "reason");
  requireOption(options, "through");
  const actor = participantFrom(options.forkedBy || options.actor || "Author", options.role);
  appendParticipant(actor, cwd, options.parent);
  const at = nowIso();
  const threadFork = {
    id: options.fork,
    object: "threadFork",
    parentThreadId: options.parent,
    forkThreadId: options.fork,
    forkTitle: options.title,
    forkedBy: actor.id,
    forkedAt: at,
    inheritedThroughEventId: options.through,
    forkReason: options.reason,
    changedAssumptionIds: parseList(options.changedAssumptions || options.changedAssumptionIds),
    changedClaimIds: parseList(options.changedClaims || options.changedClaimIds),
    contentHash: contentHash({
      parentThreadId: options.parent,
      forkThreadId: options.fork,
      forkTitle: options.title,
      forkedBy: actor.id,
      forkedAt: at,
      inheritedThroughEventId: options.through,
      forkReason: options.reason,
      changedAssumptionIds: parseList(options.changedAssumptions || options.changedAssumptionIds),
      changedClaimIds: parseList(options.changedClaims || options.changedClaimIds)
    })
  };
  const event = createEvent({
    type: "ThreadForked",
    threadId: threadFork.forkThreadId,
    actorId: actor.id,
    at,
    payload: { threadFork }
  });
  appendEvent(event, cwd);
  return print({ threadFork, event });
}

function forkLineage(options, cwd) {
  requireOption(options, "thread");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const lineage = selectForkLineage(projection, options.thread);
  if (!lineage) {
    return print({
      schema: "clista.forkLineage.v0",
      threadId: options.thread,
      error: "Thread is not a fork"
    });
  }
  return print({
    schema: "clista.forkLineage.v0",
    ...lineage
  });
}

function parseParticipantSpec(spec) {
  const [idOrName, nameOrRole, maybeRole] = String(spec).split(":").map((part) => part.trim());
  if (idOrName.startsWith("par_")) {
    return {
      id: idOrName,
      object: "participant",
      kind: "human",
      name: nameOrRole || idOrName.replace(/^par_/, "").replace(/_/g, " "),
      role: maybeRole
    };
  }
  return createParticipant(idOrName, nameOrRole);
}

module.exports = {
  forkLineage,
  threadCreate,
  threadFork
};
