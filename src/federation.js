const { PROTOCOL_VERSION, contentHash } = require("./integrity");
const { groupBy, indexBy, stripUndefined } = require("./utils");

const FEDERATION_SCHEMA = "clista.federation.v0";
const FEDERATION_VERIFY_SCHEMA = "clista.federation.verify.v0";
const FEDERATION_PROTOCOL_VERSION = "0.18.0";
const FEDERATION_THEOREM = "protocol_federation = align(independent_reasoning_states, shared_protocol_rules)";
const FEDERATION_HARD_LAW = "shared_state != shared_authority";

const FEDERATION_EVENT_TYPES = new Set([
  "FederationContextDeclared",
  "FederationPeerRecorded",
  "FederatedStateReferenceRecorded",
  "FederatedPacketVerified",
  "FederatedPacketRejected",
  "FederationBoundaryRecorded"
]);

const STATUS_VALUES = new Set(["accepted", "degraded", "rejected", "pending"]);

const GUARD_FIELDS = new Set([
  "sharedAuthority",
  "remoteAuthorityImported",
  "automaticAuthorityImport",
  "localGovernanceMutation",
  "remoteGovernanceMerged",
  "automaticAmendmentImport",
  "remoteAmendmentsImported",
  "automaticConsensus",
  "remoteStateMutation",
  "networkConsensus",
  "localAuthorityMutation"
]);

function emptyFederationState() {
  return {
    contexts: [],
    peers: [],
    references: [],
    verifications: [],
    rejections: [],
    boundaries: []
  };
}

function buildFederationState(projection = {}) {
  const state = emptyFederationState();
  applyExplicitFederationEvents(projection.events || [], state);
  return state;
}

function applyExplicitFederationEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "FederationContextDeclared":
        addRecord(state.contexts, normalizeFederationContext(
          payload.federationContext,
          event
        ));
        break;
      case "FederationPeerRecorded":
        addRecord(state.peers, normalizeFederationPeer(
          payload.federationPeer,
          event
        ));
        break;
      case "FederatedStateReferenceRecorded":
        addRecord(state.references, normalizeFederatedStateReference(
          payload.federatedStateReference,
          event
        ));
        break;
      case "FederatedPacketVerified":
        addRecord(state.verifications, normalizeFederatedPacketRecord(
          payload.federatedPacketVerification,
          event,
          "federatedPacketVerification"
        ));
        break;
      case "FederatedPacketRejected":
        addRecord(state.rejections, normalizeFederatedPacketRecord(
          payload.federatedPacketRejection,
          event,
          "federatedPacketRejection"
        ));
        break;
      case "FederationBoundaryRecorded":
        addRecord(state.boundaries, normalizeFederationBoundary(
          payload.federationBoundary,
          event
        ));
        break;
      default:
        break;
    }
  }
}

function projectFederation(state = emptyFederationState()) {
  const contexts = state.contexts.filter(Boolean);
  const peers = state.peers.filter(Boolean);
  const references = state.references.filter(Boolean);
  const verifications = state.verifications.filter(Boolean);
  const rejections = state.rejections.filter(Boolean);
  const boundaries = state.boundaries.filter(Boolean);

  return {
    schema: FEDERATION_SCHEMA,
    theorem: FEDERATION_THEOREM,
    hardLaw: FEDERATION_HARD_LAW,
    federationProtocolVersion: FEDERATION_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    statuses: Array.from(STATUS_VALUES),
    contexts,
    peers,
    references,
    verifications,
    rejections,
    boundaries,
    byContext: indexBy(contexts, "id"),
    byPeer: indexBy(peers, "id"),
    byReference: indexBy(references, "id"),
    byVerification: indexBy(verifications, "id"),
    byRejection: indexBy(rejections, "id"),
    boundariesByReference: groupBy(boundaries, "referenceId"),
    federationValidationStatus: {
      valid: true,
      contextCount: contexts.length,
      peerCount: peers.length,
      referenceCount: references.length,
      verificationCount: verifications.length,
      rejectionCount: rejections.length,
      boundaryCount: boundaries.length,
      sharedAuthority: false,
      remoteAuthorityImported: false,
      automaticAuthorityImport: false,
      localGovernanceMutation: false,
      remoteGovernanceMerged: false,
      automaticAmendmentImport: false,
      remoteAmendmentsImported: false,
      automaticConsensus: false,
      remoteStateMutation: false,
      networkConsensus: false
    }
  };
}

function verifyProtocolFederation(packet, options = {}) {
  const continuityVerification = options.continuityVerification || null;
  const compatibilityResult = options.compatibilityResult || null;
  const interoperabilityResult = options.interoperabilityResult || null;
  const reasons = [];
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

  if (!compatibilityResult) {
    reasons.push(reason("compatibility", "compatibility verification result is required"));
  } else if (!compatibilityResult.valid) {
    reasons.push(reason("compatibility", "compatibility check failed", {
      status: compatibilityResult.status,
      reasons: compatibilityResult.reasons || []
    }));
  }

  if (!interoperabilityResult) {
    reasons.push(reason("interoperability", "interoperability verification result is required"));
  } else if (!interoperabilityResult.valid) {
    reasons.push(reason("interoperability", "interoperability check failed", {
      status: interoperabilityResult.status,
      reasons: interoperabilityResult.reasons || []
    }));
  }

  if (packet && typeof packet === "object") {
    if (!packet.event_log_hash) {
      reasons.push(reason("event_log_hash", "federated packet requires event_log_hash"));
    }
    if (!packet.projection_hash) {
      reasons.push(reason("projection_hash", "federated packet requires projection_hash"));
    }
    if (!packet.state_hash) {
      reasons.push(reason("state_hash", "federated packet requires state_hash"));
    }
    if (!packet.source_thread_id) {
      reasons.push(reason("source_thread_id", "federated packet requires source_thread_id"));
    }
  }

  for (const [field, label] of [
    ["sharedAuthority", "federation cannot create shared authority"],
    ["remoteAuthorityImported", "remote authority cannot become local authority"],
    ["automaticAuthorityImport", "federation cannot import authority automatically"],
    ["localGovernanceMutation", "federation cannot mutate local governance"],
    ["remoteGovernanceMerged", "federation cannot merge remote governance automatically"],
    ["automaticAmendmentImport", "federation cannot import amendments automatically"],
    ["remoteAmendmentsImported", "remote amendments cannot become local amendments automatically"],
    ["automaticConsensus", "federation cannot create automatic consensus"],
    ["remoteStateMutation", "remote state cannot mutate local state"],
    ["networkConsensus", "federation is not network consensus"]
  ]) {
    if (options[field] === true) {
      reasons.push(reason(field, label));
    }
  }

  if (compatibilityResult?.status === "degraded") {
    degradations.push(reason("compatibility", "compatible packet is degraded"));
  }
  if (interoperabilityResult?.status === "degraded") {
    degradations.push(reason("interoperability", "interoperable packet is degraded"));
  }
  if (packet?.resume_status === "degraded") {
    degradations.push(reason("continuity", "continuity packet resumes with degraded status"));
  }

  const rejected = continuityVerification?.valid === false
    || compatibilityResult?.valid === false
    || interoperabilityResult?.valid === false;
  const status = rejected || reasons.length
    ? "rejected"
    : degradations.length
      ? "degraded"
      : "accepted";

  return {
    schema: FEDERATION_VERIFY_SCHEMA,
    valid: status === "accepted" || status === "degraded",
    status,
    theorem: FEDERATION_THEOREM,
    hardLaw: FEDERATION_HARD_LAW,
    packetContext: packetContext(packet),
    continuityVerification: continuityVerification || null,
    compatibilityResult: compatibilityResult || null,
    interoperabilityResult: interoperabilityResult || null,
    reasons,
    degradations,
    sharedAuthority: false,
    remoteAuthorityImported: false,
    localGovernanceMutation: false,
    automaticAmendmentImport: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    networkConsensus: false
  };
}

function summarizeProtocolFederation(result) {
  return {
    schema: "clista.federation.summary.v0",
    valid: result.valid,
    status: result.status,
    theorem: result.theorem,
    hardLaw: result.hardLaw,
    packet: result.packetContext,
    reasons: result.reasons,
    degradations: result.degradations,
    sharedAuthority: result.sharedAuthority,
    remoteAuthorityImported: result.remoteAuthorityImported,
    localGovernanceMutation: result.localGovernanceMutation,
    automaticAmendmentImport: result.automaticAmendmentImport,
    automaticConsensus: result.automaticConsensus,
    remoteStateMutation: result.remoteStateMutation,
    networkConsensus: result.networkConsensus
  };
}

function buildFederatedStateReference(packet, federationResult, options = {}) {
  const packetHash = contentHash(packet || {});
  const federationStatus = normalizeStatus(federationResult?.status || "pending");
  const reference = stripUndefined({
    id: options.id || deterministicId("fed", "federated_state_reference", packetHash),
    object: "federatedStateReference",
    threadId: options.threadId || options.thread || null,
    peerId: options.peerId || options.peer || null,
    remoteContextId: options.remoteContextId || options.contextId || options.context || null,
    remoteThreadId: packet?.source_thread_id || null,
    packetProtocolVersion: packet?.protocol_version || null,
    packetSchemaVersion: packet?.schema_version || null,
    packetHash,
    eventLogHash: packet?.event_log_hash || null,
    projectionHash: packet?.projection_hash || null,
    stateHash: packet?.state_hash || null,
    continuityStatus: packet?.resume_status || null,
    compatibilityStatus: federationResult?.compatibilityResult?.status || null,
    interoperabilityStatus: federationResult?.interoperabilityResult?.status || null,
    federationStatus,
    status: federationStatus,
    summary: options.summary || null,
    recordedBy: options.recordedBy || null,
    recordedAt: options.recordedAt || null,
    verifiedAt: options.verifiedAt || options.recordedAt || null,
    reasons: (federationResult?.reasons || []).map((item) => item.reason || String(item)),
    degradations: (federationResult?.degradations || []).map((item) => item.reason || String(item)),
    sharedAuthority: false,
    remoteAuthorityImported: false,
    automaticAuthorityImport: false,
    localGovernanceMutation: false,
    remoteGovernanceMerged: false,
    automaticAmendmentImport: false,
    remoteAmendmentsImported: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    networkConsensus: false
  });
  reference.federationHash = federationHash(reference);
  return reference;
}

function federationForId(federationProjection, federationId) {
  return {
    schema: "clista.federation.item.v0",
    federationId,
    reference: federationProjection.byReference[federationId] || null,
    peer: federationProjection.byPeer[federationId] || null,
    context: federationProjection.byContext[federationId] || null,
    verification: federationProjection.byVerification[federationId] || null,
    rejection: federationProjection.byRejection[federationId] || null,
    boundaries: federationProjection.boundariesByReference[federationId] || []
  };
}

function selectFederationForThread(federationProjection, threadId) {
  const references = federationProjection.references.filter((reference) => reference.threadId === threadId);
  const referenceIds = new Set(references.map((reference) => reference.id));
  return {
    schema: "clista.federation.thread.v0",
    threadId,
    theorem: federationProjection.theorem,
    hardLaw: federationProjection.hardLaw,
    references,
    acceptedReferences: references.filter((reference) => reference.status === "accepted"),
    degradedReferences: references.filter((reference) => reference.status === "degraded"),
    rejectedReferences: references.filter((reference) => reference.status === "rejected"),
    pendingReferences: references.filter((reference) => reference.status === "pending"),
    boundaries: federationProjection.boundaries.filter((boundary) => referenceIds.has(boundary.referenceId))
  };
}

function validateFederationContext(context) {
  const reasons = [];
  if (!context?.id) {
    reasons.push("federation context requires id");
  }
  if (!context?.name) {
    reasons.push("federation context requires name");
  }
  if (!context?.protocolVersion) {
    reasons.push("federation context requires protocolVersion");
  }
  reasons.push(...rejectFederationGuardFields(context));
  return reasons;
}

function validateFederationPeer(peer, priorEvents = []) {
  const reasons = [];
  const index = federationReferenceIndex(priorEvents);
  if (!peer?.id) {
    reasons.push("federation peer requires id");
  }
  if (!peer?.peerContextId) {
    reasons.push("federation peer requires peerContextId");
  }
  if (peer?.contextId && !index.contexts.has(peer.contextId)) {
    reasons.push(`federation peer references unknown context ${peer.contextId}`);
  }
  reasons.push(...rejectFederationGuardFields(peer));
  return reasons;
}

function validateFederatedStateReference(reference, priorEvents = []) {
  const reasons = [];
  const index = federationReferenceIndex(priorEvents);
  if (!reference?.id) {
    reasons.push("federated state reference requires id");
  } else if (index.references.has(reference.id)) {
    reasons.push(`duplicate federated state reference ${reference.id}`);
  }
  if (!STATUS_VALUES.has(normalizeStatus(reference?.status || reference?.federationStatus))) {
    reasons.push("federated state reference requires status accepted, degraded, rejected, or pending");
  }
  for (const field of [
    "remoteThreadId",
    "packetHash",
    "eventLogHash",
    "projectionHash",
    "stateHash",
    "packetProtocolVersion",
    "packetSchemaVersion",
    "continuityStatus",
    "compatibilityStatus",
    "interoperabilityStatus"
  ]) {
    if (!reference?.[field]) {
      reasons.push(`federated state reference requires ${field}`);
    }
  }
  reasons.push(...rejectFederationGuardFields(reference));
  return reasons;
}

function validateFederatedPacketVerification(record, priorEvents = []) {
  return validateFederatedPacketRecord(record, priorEvents, "federated packet verification");
}

function validateFederatedPacketRejection(record, priorEvents = []) {
  return validateFederatedPacketRecord(record, priorEvents, "federated packet rejection");
}

function validateFederationBoundary(boundary, priorEvents = []) {
  const reasons = [];
  const index = federationReferenceIndex(priorEvents);
  if (!boundary?.id) {
    reasons.push("federation boundary requires id");
  }
  if (!boundary?.referenceId) {
    reasons.push("federation boundary requires referenceId");
  } else if (!index.references.has(boundary.referenceId)) {
    reasons.push(`federation boundary references unknown federated state reference ${boundary.referenceId}`);
  }
  if (!boundary?.boundaryType) {
    reasons.push("federation boundary requires boundaryType");
  }
  if (!boundary?.description) {
    reasons.push("federation boundary requires description");
  }
  reasons.push(...rejectFederationGuardFields(boundary));
  return reasons;
}

function validateFederatedPacketRecord(record, priorEvents, label) {
  const reasons = [];
  const index = federationReferenceIndex(priorEvents);
  if (!record?.id) {
    reasons.push(`${label} requires id`);
  }
  if (!record?.referenceId) {
    reasons.push(`${label} requires referenceId`);
  } else if (!index.references.has(record.referenceId)) {
    reasons.push(`${label} references unknown federated state reference ${record.referenceId}`);
  }
  if (!STATUS_VALUES.has(normalizeStatus(record?.status))) {
    reasons.push(`${label} requires status accepted, degraded, rejected, or pending`);
  }
  if (!record?.packetHash) {
    reasons.push(`${label} requires packetHash`);
  }
  reasons.push(...rejectFederationGuardFields(record));
  return reasons;
}

function rejectFederationGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`federation field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectFederationGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function normalizeFederationContext(context, event) {
  if (!context) {
    return null;
  }
  const normalized = stripUndefined({
    id: context.id || deterministicId("ctx", "federation_context", event.event_id),
    object: "federationContext",
    name: context.name,
    contextType: context.contextType || "local",
    protocolVersion: context.protocolVersion || PROTOCOL_VERSION,
    federationProtocolVersion: context.federationProtocolVersion || FEDERATION_PROTOCOL_VERSION,
    governanceBoundary: context.governanceBoundary || "local_authority",
    declaredBy: context.declaredBy || event.actor_id,
    declaredAt: context.declaredAt || event.timestamp,
    sourceEventId: event.event_id,
    sharedAuthority: false,
    remoteAuthorityImported: false,
    localGovernanceMutation: false,
    automaticAmendmentImport: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    networkConsensus: false
  });
  normalized.federationHash = federationHash(normalized);
  return normalized;
}

function normalizeFederationPeer(peer, event) {
  if (!peer) {
    return null;
  }
  const normalized = stripUndefined({
    id: peer.id || deterministicId("peer", "federation_peer", event.event_id),
    object: "federationPeer",
    contextId: peer.contextId,
    peerContextId: peer.peerContextId,
    peerName: peer.peerName || peer.name,
    peerProtocolVersion: peer.peerProtocolVersion || peer.protocolVersion,
    status: normalizeStatus(peer.status || "pending"),
    recordedBy: peer.recordedBy || event.actor_id,
    recordedAt: peer.recordedAt || event.timestamp,
    sourceEventId: event.event_id,
    sharedAuthority: false,
    remoteAuthorityImported: false,
    localGovernanceMutation: false,
    automaticAmendmentImport: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    networkConsensus: false
  });
  normalized.federationHash = federationHash(normalized);
  return normalized;
}

function normalizeFederatedStateReference(reference, event) {
  if (!reference) {
    return null;
  }
  const normalized = stripUndefined({
    ...reference,
    id: reference.id || deterministicId("fed", "federated_state_reference", event.event_id),
    object: "federatedStateReference",
    threadId: reference.threadId || event.thread_id,
    status: normalizeStatus(reference.status || reference.federationStatus || "pending"),
    federationStatus: normalizeStatus(reference.federationStatus || reference.status || "pending"),
    recordedBy: reference.recordedBy || event.actor_id,
    recordedAt: reference.recordedAt || event.timestamp,
    sourceEventId: event.event_id,
    sharedAuthority: false,
    remoteAuthorityImported: false,
    automaticAuthorityImport: false,
    localGovernanceMutation: false,
    remoteGovernanceMerged: false,
    automaticAmendmentImport: false,
    remoteAmendmentsImported: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    networkConsensus: false
  });
  normalized.federationHash = federationHash(normalized);
  return normalized;
}

function normalizeFederatedPacketRecord(record, event, objectType) {
  if (!record) {
    return null;
  }
  const normalized = stripUndefined({
    ...record,
    id: record.id || deterministicId("fed", objectType, event.event_id),
    object: objectType,
    status: normalizeStatus(record.status || (objectType === "federatedPacketRejection" ? "rejected" : "accepted")),
    checkedBy: record.checkedBy || event.actor_id,
    checkedAt: record.checkedAt || event.timestamp,
    sourceEventId: event.event_id,
    sharedAuthority: false,
    remoteAuthorityImported: false,
    localGovernanceMutation: false,
    automaticAmendmentImport: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    networkConsensus: false
  });
  normalized.federationHash = federationHash(normalized);
  return normalized;
}

function normalizeFederationBoundary(boundary, event) {
  if (!boundary) {
    return null;
  }
  const normalized = stripUndefined({
    ...boundary,
    id: boundary.id || deterministicId("fed", "federation_boundary", event.event_id),
    object: "federationBoundary",
    recordedBy: boundary.recordedBy || event.actor_id,
    recordedAt: boundary.recordedAt || event.timestamp,
    sourceEventId: event.event_id,
    sharedAuthority: false,
    remoteAuthorityImported: false,
    localGovernanceMutation: false,
    automaticAmendmentImport: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    networkConsensus: false
  });
  normalized.federationHash = federationHash(normalized);
  return normalized;
}

function federationReferenceIndex(events = []) {
  const index = {
    contexts: new Set(),
    peers: new Set(),
    references: new Set()
  };
  for (const event of events || []) {
    const payload = event.payload || {};
    if (event.event_type === "FederationContextDeclared" && payload.federationContext?.id) {
      index.contexts.add(payload.federationContext.id);
    }
    if (event.event_type === "FederationPeerRecorded" && payload.federationPeer?.id) {
      index.peers.add(payload.federationPeer.id);
    }
    if (event.event_type === "FederatedStateReferenceRecorded" && payload.federatedStateReference?.id) {
      index.references.add(payload.federatedStateReference.id);
    }
  }
  return index;
}

function packetContext(packet) {
  return {
    packetType: packet?.packet_type || null,
    protocolVersion: packet?.protocol_version || null,
    schemaVersion: packet?.schema_version || null,
    sourceThreadId: packet?.source_thread_id || null,
    resumeStatus: packet?.resume_status || null,
    eventLogHash: packet?.event_log_hash || null,
    projectionHash: packet?.projection_hash || null,
    stateHash: packet?.state_hash || null,
    packetHash: packet ? contentHash(packet) : null
  };
}

function federationHash(record) {
  return contentHash({
    object: record.object,
    id: record.id,
    threadId: record.threadId || null,
    peerId: record.peerId || null,
    remoteContextId: record.remoteContextId || null,
    remoteThreadId: record.remoteThreadId || null,
    packetHash: record.packetHash || null,
    eventLogHash: record.eventLogHash || null,
    projectionHash: record.projectionHash || null,
    stateHash: record.stateHash || null,
    status: record.status || null,
    federationStatus: record.federationStatus || null,
    sharedAuthority: false,
    remoteAuthorityImported: false,
    localGovernanceMutation: false,
    automaticAmendmentImport: false,
    automaticConsensus: false,
    remoteStateMutation: false,
    networkConsensus: false
  });
}

function addRecord(records, record) {
  if (record) {
    records.push(record);
  }
}

function reason(field, message, details = {}) {
  return {
    field,
    reason: message,
    ...details
  };
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizeText(type).slice(0, 24) || "federation"}_${hash}`;
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




module.exports = {
  FEDERATION_EVENT_TYPES,
  FEDERATION_HARD_LAW,
  FEDERATION_PROTOCOL_VERSION,
  FEDERATION_SCHEMA,
  FEDERATION_THEOREM,
  FEDERATION_VERIFY_SCHEMA,
  buildFederatedStateReference,
  buildFederationState,
  federationForId,
  projectFederation,
  selectFederationForThread,
  summarizeProtocolFederation,
  validateFederatedPacketRejection,
  validateFederatedPacketVerification,
  validateFederatedStateReference,
  validateFederationBoundary,
  validateFederationContext,
  validateFederationPeer,
  verifyProtocolFederation
};
