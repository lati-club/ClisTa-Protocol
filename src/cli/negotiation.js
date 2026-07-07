const { verifyProtocolCompatibility } = require("../compatibility");
const { verifyContinuityPacket } = require("../continuity");
const {
  appendEvent,
  createEvent,
  nowIso,
  parseList
} = require("../events");
const { verifyProtocolFederation } = require("../federation");
const { verifyProtocolInteroperability } = require("../interoperability");
const {
  buildNegotiationDifferenceRecords,
  buildNegotiationRequest,
  buildNegotiationTerms,
  negotiationForId,
  verifyProtocolNegotiation
} = require("../negotiation");
const { projectEvents } = require("../projector");
const { validateEvents } = require("../validator");
const {
  appendParticipant,
  booleanOption,
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

function negotiationPropose(options, cwd) {
  requireOption(options, "thread");
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = negotiationResultFromCli(packet, options);
  if (!result.valid) {
    print(result);
    process.exitCode = 1;
    return;
  }
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const request = buildNegotiationRequest(packet, result, {
    id: options.id || options.negotiation,
    threadId: options.thread,
    requestedBy: actor.id,
    requestedAt: at,
    summary: options.summary
  });
  const requestEvent = createEvent({
    type: "NegotiationRequested",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { negotiationRequest: request }
  });
  appendEvent(requestEvent, cwd);

  const differenceRecords = buildNegotiationDifferenceRecords(packet, result, {
    negotiationId: request.id,
    threadId: options.thread,
    recordedBy: actor.id,
    recordedAt: at
  });
  const differenceEvents = differenceRecords.map((negotiationDifference) => createEvent({
    type: "NegotiationDifferenceRecorded",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { negotiationDifference }
  }));
  for (const event of differenceEvents) {
    appendEvent(event, cwd);
  }

  const terms = buildNegotiationTerms(packet, result, {
    id: options.termsId,
    negotiationId: request.id,
    threadId: options.thread,
    status: "proposed",
    summary: options.terms || options.summary,
    proposedBy: actor.id,
    proposedAt: at
  });
  const termsEvent = createEvent({
    type: "NegotiationTermsProposed",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { negotiationTerms: terms }
  });
  appendEvent(termsEvent, cwd);

  return print({
    schema: "clista.negotiation.propose.v0",
    proposed: true,
    negotiationRequest: request,
    negotiationDifferences: differenceRecords,
    negotiationTerms: terms,
    negotiation: result,
    events: [requestEvent, ...differenceEvents, termsEvent]
  });
}

function negotiationCheck(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = negotiationResultFromCli(packet, options);
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function negotiationList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let terms = projection.negotiation.terms;
  if (options.thread) {
    terms = terms.filter((term) => term.threadId === options.thread);
  }
  if (options.status) {
    terms = terms.filter((term) => term.status === options.status);
  }
  return print({
    schema: "clista.negotiation.list.v0",
    theorem: projection.negotiation.theorem,
    hardLaw: projection.negotiation.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    requestCount: projection.negotiation.requests.length,
    differenceCount: projection.negotiation.differences.length,
    count: terms.length,
    terms
  });
}

function negotiationShow(options, cwd) {
  const negotiationId = options.negotiation || options.negotiationId || options.id;
  if (!negotiationId) {
    throw new Error("Missing required option --negotiation");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(negotiationForId(projection.negotiation, negotiationId));
}

function negotiationVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.negotiation.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.negotiation.verify.v0",
    valid: true,
    errors: [],
    negotiationValidationStatus: projection.negotiation.negotiationValidationStatus
  });
}

function negotiationResultFromCli(packet, options) {
  const continuityVerification = verifyContinuityPacket(packet);
  const compatibilityResult = verifyProtocolCompatibility(packet, compatibilityOptionsFromCli(options, continuityVerification));
  const interoperabilityResult = verifyProtocolInteroperability(packet, interoperabilityOptionsFromCli(options, compatibilityResult));
  const federationResult = verifyProtocolFederation(packet, federationOptionsFromCli(options, {
    continuityVerification,
    compatibilityResult,
    interoperabilityResult
  }));
  return verifyProtocolNegotiation(packet, negotiationOptionsFromCli(options, {
    continuityVerification,
    compatibilityResult,
    interoperabilityResult,
    federationResult
  }));
}

function negotiationOptionsFromCli(options, results) {
  const supportedAmendmentIds = parseList(options.supportAmendment || options.supportedAmendment || options.supportedAmendments);
  const supportedCapabilities = parseList(options.supportCapability || options.supportedCapability || options.supportedCapabilities);
  const supportedVerificationLayers = parseList(options.supportLayer || options.supportedLayer || options.supportedVerificationLayers);
  const supportedSemantics = parseList(options.supportSemantic || options.supportedSemantic || options.supportedSemantics);
  const supportedEventTypes = parseList(options.supportEventType || options.supportedEventType || options.supportedEventTypes);
  const supportedExchangeFormats = parseList(options.supportExchangeFormat || options.supportedExchangeFormat || options.supportedExchangeFormats);
  return {
    ...results,
    supportedAmendmentIds,
    supportedCapabilities: supportedCapabilities.length ? supportedCapabilities : undefined,
    supportedVerificationLayers: supportedVerificationLayers.length ? supportedVerificationLayers : undefined,
    supportedSemantics: supportedSemantics.length ? supportedSemantics : undefined,
    supportedEventTypes: supportedEventTypes.length ? supportedEventTypes : undefined,
    supportedExchangeFormats: supportedExchangeFormats.length ? supportedExchangeFormats : undefined,
    authorityTransfer: booleanOption(options.authorityTransfer, false),
    remoteAuthorityImported: booleanOption(options.remoteAuthorityImported, false),
    automaticAuthorityImport: booleanOption(options.automaticAuthorityImport, false),
    governanceMerge: booleanOption(options.governanceMerge, false),
    localGovernanceMutation: booleanOption(options.localGovernanceMutation, false),
    remoteGovernanceMerged: booleanOption(options.remoteGovernanceMerged, false),
    automaticAmendmentAdoption: booleanOption(options.automaticAmendmentAdoption, false),
    automaticAmendmentImport: booleanOption(options.automaticAmendmentImport, false),
    automaticConsensus: booleanOption(options.automaticConsensus, false),
    remoteStateMutation: booleanOption(options.remoteStateMutation, false),
    silentDowngrade: booleanOption(options.silentDowngrade, false),
    negotiationAcceptanceAsAmendment: booleanOption(options.negotiationAcceptanceAsAmendment, false)
  };
}

module.exports = {
  negotiationCheck,
  negotiationList,
  negotiationPropose,
  negotiationShow,
  negotiationVerify
};
