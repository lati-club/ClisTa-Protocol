const { verifyProtocolCompatibility } = require("../compatibility");
const { verifyContinuityPacket } = require("../continuity");
const {
  appendEvent,
  createEvent,
  nowIso
} = require("../events");
const {
  buildFederatedStateReference,
  federationForId,
  verifyProtocolFederation
} = require("../federation");
const { verifyProtocolInteroperability } = require("../interoperability");
const { projectEvents } = require("../projector");
const { validateEvents } = require("../validator");
const {
  appendParticipant,
  compatibilityOptionsFromCli,
  federationOptionsFromCli,
  interoperabilityOptionsFromCli,
  participantFrom,
  print,
  readContinuityPacketForOptions,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function federationRecord(options, cwd) {
  requireOption(options, "thread");
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = federationResultFromCli(packet, options);
  if (!result.valid) {
    print(result);
    process.exitCode = 1;
    return;
  }
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const reference = buildFederatedStateReference(packet, result, {
    id: options.id,
    threadId: options.thread,
    peerId: options.peer || options.peerId,
    remoteContextId: options.context || options.contextId || options.remoteContext,
    summary: options.summary,
    recordedBy: actor.id,
    recordedAt: at,
    verifiedAt: at
  });
  const event = createEvent({
    type: "FederatedStateReferenceRecorded",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { federatedStateReference: reference }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.federation.record.v0",
    recorded: true,
    federatedStateReference: reference,
    federation: result,
    event
  });
}

function federationCheck(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = federationResultFromCli(packet, options);
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function federationList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let references = projection.federation.references;
  if (options.thread) {
    references = references.filter((reference) => reference.threadId === options.thread);
  }
  if (options.status) {
    references = references.filter((reference) => reference.status === options.status);
  }
  return print({
    schema: "clista.federation.list.v0",
    theorem: projection.federation.theorem,
    hardLaw: projection.federation.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: references.length,
    references
  });
}

function federationShow(options, cwd) {
  const federationId = options.federation || options.federationId || options.id;
  if (!federationId) {
    throw new Error("Missing required option --federation");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(federationForId(projection.federation, federationId));
}

function federationVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.federation.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.federation.verify.v0",
    valid: true,
    errors: [],
    federationValidationStatus: projection.federation.federationValidationStatus
  });
}

function federationResultFromCli(packet, options) {
  const continuityVerification = verifyContinuityPacket(packet);
  const compatibilityResult = verifyProtocolCompatibility(packet, compatibilityOptionsFromCli(options, continuityVerification));
  const interoperabilityResult = verifyProtocolInteroperability(packet, interoperabilityOptionsFromCli(options, compatibilityResult));
  return verifyProtocolFederation(packet, federationOptionsFromCli(options, {
    continuityVerification,
    compatibilityResult,
    interoperabilityResult
  }));
}

module.exports = {
  federationCheck,
  federationList,
  federationRecord,
  federationShow,
  federationVerify
};
