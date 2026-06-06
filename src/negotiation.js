const {
  buildLocalCompatibilityContext
} = require("./compatibility");
const {
  buildLocalInteroperabilityProfile
} = require("./interoperability");
const { PROTOCOL_VERSION, contentHash } = require("./integrity");

const NEGOTIATION_SCHEMA = "clista.negotiation.v0";
const NEGOTIATION_VERIFY_SCHEMA = "clista.negotiation.verify.v0";
const NEGOTIATION_PROTOCOL_VERSION = "0.18.0";
const NEGOTIATION_THEOREM = "protocol_negotiation = agree(exchange_terms, across_independent_contexts)";
const NEGOTIATION_HARD_LAW = "agreement != governance merger";

const NEGOTIATION_EVENT_TYPES = new Set([
  "NegotiationRequested",
  "NegotiationConstraintDeclared",
  "NegotiationDifferenceRecorded",
  "NegotiationTermsProposed",
  "NegotiationTermsAccepted",
  "NegotiationTermsRejected",
  "NegotiationDegradationAccepted",
  "NegotiationFailureRecorded"
]);

const STATUS_VALUES = new Set(["proposed", "accepted", "degraded", "rejected", "failed", "pending"]);
const DIFFERENCE_TYPES = new Set([
  "capability",
  "amendment",
  "validation_requirement",
  "interoperability_profile",
  "compatibility_status",
  "interoperability_status",
  "federation_status"
]);

const GUARD_FIELDS = new Set([
  "authorityTransfer",
  "remoteAuthorityImported",
  "automaticAuthorityImport",
  "governanceMerge",
  "localGovernanceMutation",
  "remoteGovernanceMerged",
  "automaticAmendmentAdoption",
  "automaticAmendmentImport",
  "remoteAmendmentsAdopted",
  "automaticConsensus",
  "remoteStateMutation",
  "stateMutation",
  "silentDowngrade",
  "negotiationAcceptanceAsAmendment",
  "termsAsProtocolAmendment",
  "validationRuleMutation",
  "authorityMutation"
]);

function emptyNegotiationState() {
  return {
    requests: [],
    constraints: [],
    differences: [],
    proposedTerms: [],
    acceptedTerms: [],
    rejectedTerms: [],
    degradedTerms: [],
    failures: []
  };
}

function buildNegotiationState(projection = {}) {
  const state = emptyNegotiationState();
  applyExplicitNegotiationEvents(projection.events || [], state);
  return state;
}

function applyExplicitNegotiationEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "NegotiationRequested":
        addRecord(state.requests, normalizeNegotiationRequest(
          payload.negotiationRequest,
          event
        ));
        break;
      case "NegotiationConstraintDeclared":
        addRecord(state.constraints, normalizeNegotiationConstraint(
          payload.negotiationConstraint,
          event
        ));
        break;
      case "NegotiationDifferenceRecorded":
        addRecord(state.differences, normalizeNegotiationDifference(
          payload.negotiationDifference,
          event
        ));
        break;
      case "NegotiationTermsProposed":
        addRecord(state.proposedTerms, normalizeNegotiationTerms(
          payload.negotiationTerms,
          event,
          "proposed"
        ));
        break;
      case "NegotiationTermsAccepted":
        addRecord(state.acceptedTerms, normalizeNegotiationTerms(
          payload.negotiationTerms,
          event,
          "accepted"
        ));
        break;
      case "NegotiationTermsRejected":
        addRecord(state.rejectedTerms, normalizeNegotiationTerms(
          payload.negotiationTerms,
          event,
          "rejected"
        ));
        break;
      case "NegotiationDegradationAccepted":
        addRecord(state.degradedTerms, normalizeNegotiationTerms(
          payload.negotiationTerms,
          event,
          "degraded"
        ));
        break;
      case "NegotiationFailureRecorded":
        addRecord(state.failures, normalizeNegotiationFailure(
          payload.negotiationFailure,
          event
        ));
        break;
      default:
        break;
    }
  }
}

function projectNegotiation(state = emptyNegotiationState()) {
  const requests = state.requests.filter(Boolean);
  const constraints = state.constraints.filter(Boolean);
  const differences = state.differences.filter(Boolean);
  const proposedTerms = state.proposedTerms.filter(Boolean);
  const acceptedTerms = state.acceptedTerms.filter(Boolean);
  const rejectedTerms = state.rejectedTerms.filter(Boolean);
  const degradedTerms = state.degradedTerms.filter(Boolean);
  const failures = state.failures.filter(Boolean);
  const terms = [
    ...proposedTerms,
    ...acceptedTerms,
    ...rejectedTerms,
    ...degradedTerms
  ];

  return {
    schema: NEGOTIATION_SCHEMA,
    theorem: NEGOTIATION_THEOREM,
    hardLaw: NEGOTIATION_HARD_LAW,
    negotiationProtocolVersion: NEGOTIATION_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    statuses: Array.from(STATUS_VALUES),
    requests,
    constraints,
    differences,
    terms,
    proposedTerms,
    acceptedTerms,
    rejectedTerms,
    degradedTerms,
    failures,
    byRequest: indexBy(requests, "id"),
    byConstraint: indexBy(constraints, "id"),
    byDifference: indexBy(differences, "id"),
    byTerm: indexBy(terms, "id"),
    byFailure: indexBy(failures, "id"),
    differencesByNegotiation: groupBy(differences, "negotiationId"),
    termsByNegotiation: groupBy(terms, "negotiationId"),
    failuresByNegotiation: groupBy(failures, "negotiationId"),
    negotiationValidationStatus: {
      valid: true,
      requestCount: requests.length,
      constraintCount: constraints.length,
      differenceCount: differences.length,
      termsCount: terms.length,
      acceptedCount: acceptedTerms.length,
      rejectedCount: rejectedTerms.length,
      degradedCount: degradedTerms.length,
      failureCount: failures.length,
      authorityTransfer: false,
      remoteAuthorityImported: false,
      governanceMerge: false,
      automaticAmendmentAdoption: false,
      automaticConsensus: false,
      remoteStateMutation: false,
      silentDowngrade: false,
      negotiationAcceptanceAsAmendment: false
    }
  };
}

function verifyProtocolNegotiation(packet, options = {}) {
  const continuityVerification = options.continuityVerification || null;
  const compatibilityResult = options.compatibilityResult || null;
  const interoperabilityResult = options.interoperabilityResult || null;
  const federationResult = options.federationResult || null;
  const reasons = [];
  const differences = [];
  const degradations = [];

  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    reasons.push(reason("packet", "continuity packet must be an object"));
  }

  if (!continuityVerification) {
    reasons.push(reason("continuity", "continuity verification result is required"));
  } else if (!continuityVerification.valid) {
    reasons.push(reason("continuity", "continuity packet failed verification", {
      reasons: continuityVerification.reasons || []
    }));
  }

  if (packet && typeof packet === "object") {
    compareCapabilityDifferences(packet, options, differences);
    compareAmendmentDifferences(packet, options, differences);
    compareValidationRequirementDifferences(packet, options, differences);
    compareInteroperabilityProfileDifferences(packet, options, differences);
  }

  compareGateStatus("compatibility", compatibilityResult, differences, degradations);
  compareGateStatus("interoperability", interoperabilityResult, differences, degradations);
  compareGateStatus("federation", federationResult, differences, degradations);

  for (const [field, label] of [
    ["authorityTransfer", "negotiation cannot transfer authority"],
    ["remoteAuthorityImported", "remote authority cannot become local authority through negotiation"],
    ["automaticAuthorityImport", "negotiation cannot import authority automatically"],
    ["governanceMerge", "agreement cannot merge governance"],
    ["localGovernanceMutation", "negotiation cannot mutate local governance"],
    ["remoteGovernanceMerged", "negotiation cannot merge remote governance automatically"],
    ["automaticAmendmentAdoption", "negotiation cannot adopt amendments automatically"],
    ["automaticAmendmentImport", "negotiation cannot import amendments automatically"],
    ["automaticConsensus", "negotiation cannot create automatic consensus"],
    ["remoteStateMutation", "remote state cannot mutate local state"],
    ["silentDowngrade", "negotiation cannot silently downgrade requirements"],
    ["negotiationAcceptanceAsAmendment", "negotiation acceptance cannot become a protocol amendment"]
  ]) {
    if (options[field] === true) {
      reasons.push(reason(field, label));
    }
  }

  if (packet?.resume_status === "degraded") {
    degradations.push(reason("continuity", "continuity packet resumes with degraded status"));
  }

  const status = reasons.length
    ? "rejected"
    : differences.length || degradations.length
      ? "degraded"
      : "accepted";

  return {
    schema: NEGOTIATION_VERIFY_SCHEMA,
    valid: reasons.length === 0,
    status,
    theorem: NEGOTIATION_THEOREM,
    hardLaw: NEGOTIATION_HARD_LAW,
    packetContext: packetContext(packet),
    continuityVerification: continuityVerification || null,
    compatibilityResult: compatibilityResult || null,
    interoperabilityResult: interoperabilityResult || null,
    federationResult: federationResult || null,
    differences,
    reasons,
    degradations,
    exchangeTerms: buildExchangeTermsSummary(packet, differences, degradations),
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  };
}

function buildNegotiationRequest(packet, negotiationResult, options = {}) {
  const packetHash = contentHash(packet || {});
  const request = stripUndefined({
    id: options.id || deterministicId("ngn", "negotiation_request", packetHash),
    object: "negotiationRequest",
    threadId: options.threadId || options.thread || null,
    remoteThreadId: packet?.source_thread_id || null,
    packetHash,
    packetProtocolVersion: packet?.protocol_version || null,
    packetSchemaVersion: packet?.schema_version || null,
    status: "pending",
    requestedBy: options.requestedBy || options.actor || null,
    requestedAt: options.requestedAt || null,
    summary: options.summary || null,
    negotiationStatus: negotiationResult?.status || "pending",
    differenceCount: (negotiationResult?.differences || []).length,
    degradationCount: (negotiationResult?.degradations || []).length,
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  });
  request.negotiationHash = negotiationHash(request);
  return request;
}

function buildNegotiationDifferenceRecords(packet, negotiationResult, options = {}) {
  const packetHash = contentHash(packet || {});
  return (negotiationResult?.differences || []).map((item, index) => {
    const record = stripUndefined({
      id: deterministicId("ngd", `negotiation_difference_${index}`, {
        packetHash,
        negotiationId: options.negotiationId,
        item
      }),
      object: "negotiationDifference",
      negotiationId: options.negotiationId || null,
      threadId: options.threadId || options.thread || null,
      differenceType: item.differenceType,
      field: item.field,
      reason: item.reason,
      localValue: item.localValue,
      remoteValue: item.remoteValue,
      recordedBy: options.recordedBy || null,
      recordedAt: options.recordedAt || null,
      authorityTransfer: false,
      remoteAuthorityImported: false,
      governanceMerge: false,
      automaticAmendmentAdoption: false,
      automaticConsensus: false,
      remoteStateMutation: false,
      silentDowngrade: false,
      negotiationAcceptanceAsAmendment: false
    });
    record.negotiationHash = negotiationHash(record);
    return record;
  });
}

function buildNegotiationTerms(packet, negotiationResult, options = {}) {
  const packetHash = contentHash(packet || {});
  const status = normalizeStatus(options.status || termsStatusFromResult(negotiationResult));
  const terms = stripUndefined({
    id: options.id || deterministicId("ngt", "negotiation_terms", {
      packetHash,
      status,
      negotiationId: options.negotiationId
    }),
    object: "negotiationTerms",
    negotiationId: options.negotiationId || null,
    threadId: options.threadId || options.thread || null,
    remoteThreadId: packet?.source_thread_id || null,
    packetHash,
    status,
    summary: options.summary || null,
    exchangeTerms: buildExchangeTermsSummary(
      packet,
      negotiationResult?.differences || [],
      negotiationResult?.degradations || []
    ),
    proposedBy: options.proposedBy || options.recordedBy || null,
    proposedAt: options.proposedAt || options.recordedAt || null,
    reasons: (negotiationResult?.reasons || []).map((item) => item.reason || String(item)),
    degradations: (negotiationResult?.degradations || []).map((item) => item.reason || String(item)),
    differenceCount: (negotiationResult?.differences || []).length,
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  });
  terms.negotiationHash = negotiationHash(terms);
  return terms;
}

function negotiationForId(negotiationProjection, negotiationId) {
  return {
    schema: "clista.negotiation.item.v0",
    negotiationId,
    request: negotiationProjection.byRequest[negotiationId] || null,
    constraint: negotiationProjection.byConstraint[negotiationId] || null,
    difference: negotiationProjection.byDifference[negotiationId] || null,
    term: negotiationProjection.byTerm[negotiationId] || null,
    failure: negotiationProjection.byFailure[negotiationId] || null,
    differences: negotiationProjection.differencesByNegotiation[negotiationId] || [],
    terms: negotiationProjection.termsByNegotiation[negotiationId] || [],
    failures: negotiationProjection.failuresByNegotiation[negotiationId] || []
  };
}

function selectNegotiationForThread(negotiationProjection, threadId) {
  const requests = negotiationProjection.requests.filter((request) => request.threadId === threadId);
  const requestIds = new Set(requests.map((request) => request.id));
  const byThreadOrRequest = (record) => record.threadId === threadId || requestIds.has(record.negotiationId);
  const terms = negotiationProjection.terms.filter(byThreadOrRequest);
  return {
    schema: "clista.negotiation.thread.v0",
    threadId,
    theorem: negotiationProjection.theorem,
    hardLaw: negotiationProjection.hardLaw,
    requests,
    constraints: negotiationProjection.constraints.filter(byThreadOrRequest),
    differences: negotiationProjection.differences.filter(byThreadOrRequest),
    terms,
    acceptedTerms: terms.filter((term) => term.status === "accepted"),
    rejectedTerms: terms.filter((term) => term.status === "rejected"),
    degradedTerms: terms.filter((term) => term.status === "degraded"),
    failures: negotiationProjection.failures.filter(byThreadOrRequest)
  };
}

function validateNegotiationRequest(request, priorEvents = []) {
  const reasons = [];
  const index = negotiationReferenceIndex(priorEvents);
  if (!request?.id) {
    reasons.push("negotiation request requires id");
  } else if (index.requests.has(request.id)) {
    reasons.push(`duplicate negotiation request ${request.id}`);
  }
  if (!request?.threadId) {
    reasons.push("negotiation request requires threadId");
  }
  if (!request?.packetHash) {
    reasons.push("negotiation request requires packetHash");
  }
  reasons.push(...rejectNegotiationGuardFields(request));
  return reasons;
}

function validateNegotiationConstraint(constraint, priorEvents = []) {
  const reasons = [];
  const index = negotiationReferenceIndex(priorEvents);
  if (!constraint?.id) {
    reasons.push("negotiation constraint requires id");
  }
  if (!constraint?.negotiationId) {
    reasons.push("negotiation constraint requires negotiationId");
  } else if (!index.requests.has(constraint.negotiationId)) {
    reasons.push(`negotiation constraint references unknown negotiation ${constraint.negotiationId}`);
  }
  if (!constraint?.constraintType) {
    reasons.push("negotiation constraint requires constraintType");
  }
  if (!constraint?.description) {
    reasons.push("negotiation constraint requires description");
  }
  reasons.push(...rejectNegotiationGuardFields(constraint));
  return reasons;
}

function validateNegotiationDifference(difference, priorEvents = []) {
  const reasons = [];
  const index = negotiationReferenceIndex(priorEvents);
  if (!difference?.id) {
    reasons.push("negotiation difference requires id");
  }
  if (!difference?.negotiationId) {
    reasons.push("negotiation difference requires negotiationId");
  } else if (!index.requests.has(difference.negotiationId)) {
    reasons.push(`negotiation difference references unknown negotiation ${difference.negotiationId}`);
  }
  if (!DIFFERENCE_TYPES.has(difference?.differenceType)) {
    reasons.push("negotiation difference requires known differenceType");
  }
  if (!difference?.field) {
    reasons.push("negotiation difference requires field");
  }
  if (!difference?.reason) {
    reasons.push("negotiation difference requires reason");
  }
  reasons.push(...rejectNegotiationGuardFields(difference));
  return reasons;
}

function validateNegotiationTermsProposed(terms, priorEvents = []) {
  return validateNegotiationTerms(terms, priorEvents, "proposed");
}

function validateNegotiationTermsAccepted(terms, priorEvents = []) {
  return validateNegotiationTerms(terms, priorEvents, "accepted");
}

function validateNegotiationTermsRejected(terms, priorEvents = []) {
  return validateNegotiationTerms(terms, priorEvents, "rejected");
}

function validateNegotiationDegradationAccepted(terms, priorEvents = []) {
  return validateNegotiationTerms(terms, priorEvents, "degraded");
}

function validateNegotiationFailure(failure, priorEvents = []) {
  const reasons = [];
  const index = negotiationReferenceIndex(priorEvents);
  if (!failure?.id) {
    reasons.push("negotiation failure requires id");
  }
  if (!failure?.negotiationId) {
    reasons.push("negotiation failure requires negotiationId");
  } else if (!index.requests.has(failure.negotiationId)) {
    reasons.push(`negotiation failure references unknown negotiation ${failure.negotiationId}`);
  }
  if (!failure?.reason) {
    reasons.push("negotiation failure requires reason");
  }
  reasons.push(...rejectNegotiationGuardFields(failure));
  return reasons;
}

function validateNegotiationTerms(terms, priorEvents, expectedStatus) {
  const reasons = [];
  const index = negotiationReferenceIndex(priorEvents);
  if (!terms?.id) {
    reasons.push("negotiation terms require id");
  }
  if (!terms?.negotiationId) {
    reasons.push("negotiation terms require negotiationId");
  } else if (!index.requests.has(terms.negotiationId)) {
    reasons.push(`negotiation terms reference unknown negotiation ${terms.negotiationId}`);
  }
  const status = normalizeStatus(terms?.status);
  if (status !== expectedStatus) {
    reasons.push(`negotiation terms status must be ${expectedStatus}`);
  }
  if (!terms?.exchangeTerms && !terms?.summary) {
    reasons.push("negotiation terms require exchangeTerms or summary");
  }
  reasons.push(...rejectNegotiationGuardFields(terms));
  return reasons;
}

function compareCapabilityDifferences(packet, options, differences) {
  const localContext = buildLocalCompatibilityContext(options);
  for (const capability of arrayValues(packet?.capability_set)) {
    if (!localContext.localCapabilitySet.includes(capability)) {
      differences.push(difference(
        "capability",
        "capability_set",
        `unsupported required capability ${capability}`,
        "unsupported",
        capability
      ));
    }
  }
}

function compareAmendmentDifferences(packet, options, differences) {
  const supportedAmendmentIds = arrayValues(options.supportedAmendmentIds);
  for (const amendmentId of activeAmendmentIds(packet)) {
    if (!supportedAmendmentIds.includes(amendmentId)) {
      differences.push(difference(
        "amendment",
        "activeAmendments",
        `active amendment requires explicit local support ${amendmentId}`,
        supportedAmendmentIds,
        amendmentId
      ));
    }
  }
}

function compareValidationRequirementDifferences(packet, options, differences) {
  const localContext = buildLocalCompatibilityContext(options);
  const requiredLayers = arrayValues(packet?.verification_state?.requiredLayers);
  for (const layer of requiredLayers) {
    if (!localContext.supportedVerificationLayers.includes(layer)) {
      differences.push(difference(
        "validation_requirement",
        "verification_state.requiredLayers",
        `unsupported validation requirement ${layer}`,
        localContext.supportedVerificationLayers,
        layer
      ));
      continue;
    }
    const status = verificationLayerStatus(packet?.verification_state, layer);
    if (!status || status.valid !== true) {
      differences.push(difference(
        "validation_requirement",
        `verification_state.${layer}`,
        `validation layer ${layer} is not verified`,
        "valid",
        status || null
      ));
    }
  }
}

function compareInteroperabilityProfileDifferences(packet, options, differences) {
  const localProfile = buildLocalInteroperabilityProfile(options);
  const profile = packet?.interoperability_profile;
  if (!profile || typeof profile !== "object") {
    differences.push(difference(
      "interoperability_profile",
      "interoperability_profile",
      "interoperability profile is missing",
      localProfile,
      null
    ));
    return;
  }
  if (!localProfile.supportedExchangeFormats.includes(profile.exchangeFormat)) {
    differences.push(difference(
      "interoperability_profile",
      "interoperability_profile.exchangeFormat",
      `unsupported exchange format ${profile.exchangeFormat}`,
      localProfile.supportedExchangeFormats,
      profile.exchangeFormat
    ));
  }
  for (const semantic of arrayValues(profile.requiredSemantics)) {
    if (!localProfile.supportedSemantics.includes(semantic)) {
      differences.push(difference(
        "interoperability_profile",
        "interoperability_profile.requiredSemantics",
        `unsupported required semantic ${semantic}`,
        localProfile.supportedSemantics,
        semantic
      ));
    }
  }
  for (const eventType of arrayValues(profile.eventTypes)) {
    if (!localProfile.supportedEventTypes.includes(eventType)) {
      differences.push(difference(
        "interoperability_profile",
        "interoperability_profile.eventTypes",
        `unsupported event type ${eventType}`,
        "unsupported",
        eventType
      ));
    }
  }
  for (const [objectName, remoteMeaning] of Object.entries(profile.objectSemantics || {})) {
    const localMeaning = localProfile.objectSemantics[objectName];
    if (localMeaning && localMeaning !== remoteMeaning) {
      differences.push(difference(
        "interoperability_profile",
        `interoperability_profile.objectSemantics.${objectName}`,
        `semantic meaning differs for ${objectName}`,
        localMeaning,
        remoteMeaning
      ));
    } else if (!localMeaning) {
      differences.push(difference(
        "interoperability_profile",
        `interoperability_profile.objectSemantics.${objectName}`,
        `unsupported object semantic ${objectName}`,
        "unsupported",
        remoteMeaning
      ));
    }
  }
}

function compareGateStatus(label, result, differences, degradations) {
  if (!result) {
    differences.push(difference(
      `${label}_status`,
      label,
      `${label} result is missing`,
      "required",
      null
    ));
    return;
  }
  if (result.valid === false) {
    differences.push(difference(
      `${label}_status`,
      label,
      `${label} check is not valid`,
      "valid",
      {
        status: result.status,
        reasons: result.reasons || []
      }
    ));
  } else if (result.status === "degraded") {
    degradations.push(reason(label, `${label} check is explicitly degraded`));
  }
}

function buildExchangeTermsSummary(packet, differences, degradations) {
  return {
    schema: "clista.negotiation.exchange_terms.v0",
    exchangeFormat: packet?.interoperability_profile?.exchangeFormat || null,
    remoteThreadId: packet?.source_thread_id || null,
    requiredCapabilities: arrayValues(packet?.capability_set),
    activeAmendmentIds: activeAmendmentIds(packet),
    requiredVerificationLayers: arrayValues(packet?.verification_state?.requiredLayers),
    requiredSemantics: arrayValues(packet?.interoperability_profile?.requiredSemantics),
    differenceCount: differences.length,
    degradationCount: degradations.length,
    explicitReviewRequired: differences.length > 0 || degradations.length > 0,
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  };
}

function normalizeNegotiationRequest(request, event) {
  if (!request) {
    return null;
  }
  const normalized = stripUndefined({
    ...request,
    id: request.id || deterministicId("ngn", "negotiation_request", event.event_id),
    object: "negotiationRequest",
    threadId: request.threadId || event.thread_id,
    status: normalizeStatus(request.status || "pending"),
    requestedBy: request.requestedBy || event.actor_id,
    requestedAt: request.requestedAt || event.timestamp,
    sourceEventId: event.event_id,
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  });
  normalized.negotiationHash = negotiationHash(normalized);
  return normalized;
}

function normalizeNegotiationConstraint(constraint, event) {
  if (!constraint) {
    return null;
  }
  const normalized = stripUndefined({
    ...constraint,
    id: constraint.id || deterministicId("ngc", "negotiation_constraint", event.event_id),
    object: "negotiationConstraint",
    threadId: constraint.threadId || event.thread_id,
    declaredBy: constraint.declaredBy || event.actor_id,
    declaredAt: constraint.declaredAt || event.timestamp,
    sourceEventId: event.event_id,
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  });
  normalized.negotiationHash = negotiationHash(normalized);
  return normalized;
}

function normalizeNegotiationDifference(differenceRecord, event) {
  if (!differenceRecord) {
    return null;
  }
  const normalized = stripUndefined({
    ...differenceRecord,
    id: differenceRecord.id || deterministicId("ngd", "negotiation_difference", event.event_id),
    object: "negotiationDifference",
    threadId: differenceRecord.threadId || event.thread_id,
    recordedBy: differenceRecord.recordedBy || event.actor_id,
    recordedAt: differenceRecord.recordedAt || event.timestamp,
    sourceEventId: event.event_id,
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  });
  normalized.negotiationHash = negotiationHash(normalized);
  return normalized;
}

function normalizeNegotiationTerms(terms, event, status) {
  if (!terms) {
    return null;
  }
  const normalized = stripUndefined({
    ...terms,
    id: terms.id || deterministicId("ngt", "negotiation_terms", event.event_id),
    object: "negotiationTerms",
    threadId: terms.threadId || event.thread_id,
    status,
    recordedBy: terms.recordedBy || terms.proposedBy || event.actor_id,
    recordedAt: terms.recordedAt || terms.proposedAt || event.timestamp,
    sourceEventId: event.event_id,
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  });
  normalized.negotiationHash = negotiationHash(normalized);
  return normalized;
}

function normalizeNegotiationFailure(failure, event) {
  if (!failure) {
    return null;
  }
  const normalized = stripUndefined({
    ...failure,
    id: failure.id || deterministicId("ngf", "negotiation_failure", event.event_id),
    object: "negotiationFailure",
    threadId: failure.threadId || event.thread_id,
    recordedBy: failure.recordedBy || event.actor_id,
    recordedAt: failure.recordedAt || event.timestamp,
    sourceEventId: event.event_id,
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  });
  normalized.negotiationHash = negotiationHash(normalized);
  return normalized;
}

function negotiationReferenceIndex(events = []) {
  const index = {
    requests: new Set(),
    terms: new Set()
  };
  for (const event of events || []) {
    const payload = event.payload || {};
    if (event.event_type === "NegotiationRequested" && payload.negotiationRequest?.id) {
      index.requests.add(payload.negotiationRequest.id);
    }
    if (
      [
        "NegotiationTermsProposed",
        "NegotiationTermsAccepted",
        "NegotiationTermsRejected",
        "NegotiationDegradationAccepted"
      ].includes(event.event_type)
      && payload.negotiationTerms?.id
    ) {
      index.terms.add(payload.negotiationTerms.id);
    }
  }
  return index;
}

function rejectNegotiationGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`negotiation field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectNegotiationGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function activeAmendmentIds(packet) {
  const amendmentState = packet?.continuity_state?.amendment_state
    || packet?.continuity_state?.amendments
    || {};
  const active = arrayValues(amendmentState.activeAmendments || amendmentState.active_amendments);
  return active.map((item) => {
    if (typeof item === "string") {
      return item;
    }
    return item?.id || item?.amendmentId || null;
  }).filter(Boolean);
}

function verificationLayerStatus(verificationState, layer) {
  const mapping = {
    validity: "validity",
    integrity: "integrity",
    attribution: "attributionValidationStatus",
    provenance: "provenanceValidationStatus",
    learning: "learningValidationStatus",
    adaptation: "adaptationValidationStatus",
    amendments: "amendmentValidationStatus",
    compatibility: "compatibilityValidationStatus",
    interoperability: "interoperabilityValidationStatus",
    federation: "federationValidationStatus",
    negotiation: "negotiationValidationStatus"
  };
  return verificationState?.[mapping[layer] || layer];
}

function packetContext(packet) {
  return {
    packetType: packet?.packet_type || null,
    protocolVersion: packet?.protocol_version || null,
    schemaVersion: packet?.schema_version || null,
    sourceThreadId: packet?.source_thread_id || null,
    resumeStatus: packet?.resume_status || null,
    capabilitySet: arrayValues(packet?.capability_set),
    activeAmendmentIds: activeAmendmentIds(packet),
    requiredVerificationLayers: arrayValues(packet?.verification_state?.requiredLayers),
    eventLogHash: packet?.event_log_hash || null,
    projectionHash: packet?.projection_hash || null,
    stateHash: packet?.state_hash || null,
    packetHash: packet ? contentHash(packet) : null
  };
}

function termsStatusFromResult(result) {
  if (!result?.valid || result?.status === "rejected") {
    return "rejected";
  }
  if (result.status === "degraded") {
    return "degraded";
  }
  return "accepted";
}

function negotiationHash(record) {
  return contentHash({
    object: record.object,
    id: record.id,
    negotiationId: record.negotiationId || null,
    threadId: record.threadId || null,
    packetHash: record.packetHash || null,
    status: record.status || null,
    differenceType: record.differenceType || null,
    field: record.field || null,
    authorityTransfer: false,
    remoteAuthorityImported: false,
    governanceMerge: false,
    automaticAmendmentAdoption: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    silentDowngrade: false,
    negotiationAcceptanceAsAmendment: false
  });
}

function reason(field, message, details = {}) {
  return {
    field,
    reason: message,
    ...details
  };
}

function difference(differenceType, field, message, localValue, remoteValue) {
  return {
    differenceType,
    field,
    reason: message,
    localValue,
    remoteValue
  };
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizeText(type).slice(0, 24) || "negotiation"}_${hash}`;
}

function normalizeStatus(status) {
  return String(status || "pending").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function addRecord(records, record) {
  if (record) {
    records.push(record);
  }
}

function indexBy(records, key) {
  return records.reduce((indexed, record) => {
    if (record[key]) {
      indexed[record[key]] = record;
    }
    return indexed;
  }, {});
}

function groupBy(records, key) {
  return records.reduce((grouped, record) => {
    const value = record[key];
    if (!value) {
      return grouped;
    }
    grouped[value] ||= [];
    grouped[value].push(record);
    return grouped;
  }, {});
}

function arrayValues(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return [];
}

function stripUndefined(object) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) {
      delete object[key];
    }
  }
  return object;
}

module.exports = {
  NEGOTIATION_EVENT_TYPES,
  NEGOTIATION_HARD_LAW,
  NEGOTIATION_PROTOCOL_VERSION,
  NEGOTIATION_SCHEMA,
  NEGOTIATION_THEOREM,
  NEGOTIATION_VERIFY_SCHEMA,
  buildNegotiationDifferenceRecords,
  buildNegotiationRequest,
  buildNegotiationState,
  buildNegotiationTerms,
  negotiationForId,
  projectNegotiation,
  selectNegotiationForThread,
  validateNegotiationConstraint,
  validateNegotiationDegradationAccepted,
  validateNegotiationDifference,
  validateNegotiationFailure,
  validateNegotiationRequest,
  validateNegotiationTermsAccepted,
  validateNegotiationTermsProposed,
  validateNegotiationTermsRejected,
  verifyProtocolNegotiation
};
