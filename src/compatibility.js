const { PROTOCOL_VERSION, contentHash } = require("./integrity");

const COMPATIBILITY_SCHEMA = "clista.compatibility.v0";
const COMPATIBILITY_VERIFY_SCHEMA = "clista.compatibility.verify.v0";
const COMPATIBILITY_PROTOCOL_VERSION = "0.17.0";
const COMPATIBILITY_THEOREM = "protocol_compatibility = verify(capability_set, amendment_state, validation_requirements)";
const COMPATIBILITY_HARD_LAW = "unsupported_state != valid_state";

const LOCAL_CAPABILITY_SET = [
  "spine",
  "validity",
  "governance",
  "outcomes",
  "forks",
  "merges",
  "integrity",
  "continuity",
  "identity",
  "attribution",
  "provenance",
  "learning",
  "adaptation",
  "amendments",
  "compatibility",
  "interoperability",
  "federation"
];

const SUPPORTED_CONTINUITY_PROTOCOL_VERSIONS = ["0.17.0"];
const SUPPORTED_CONTINUITY_SCHEMA_VERSIONS = ["clista.continuity.packet.v0"];
const SUPPORTED_VERIFICATION_LAYERS = [
  "validity",
  "integrity",
  "attribution",
  "provenance",
  "learning",
  "adaptation",
  "amendments",
  "compatibility",
  "interoperability",
  "federation"
];

const SUPPORTED_AMENDMENT_TYPES = [
  "protocol_rule",
  "governance_requirement",
  "evidence_threshold",
  "revisit_trigger",
  "decision_gate",
  "schema",
  "validation_policy",
  "interpretive_guidance"
];

const COMPATIBILITY_EVENT_TYPES = new Set([
  "CompatibilityCheckRecorded",
  "CapabilitySetDeclared",
  "CompatibilityFailureRecorded",
  "CompatibilityDegradationRecorded",
  "CompatibilityAcceptanceRecorded"
]);

const STATUS_VALUES = new Set(["compatible", "degraded", "incompatible", "rejected"]);

const GUARD_FIELDS = new Set([
  "bestEffortAcceptance",
  "unsupportedStateAccepted",
  "silentDowngrade",
  "importedStateMutation",
  "governanceApproval",
  "amendmentApproval",
  "stateMutation"
]);

function emptyCompatibilityState() {
  return {
    declarations: [],
    checks: [],
    failures: [],
    degradations: [],
    acceptances: []
  };
}

function buildCompatibilityState(projection = {}) {
  const state = emptyCompatibilityState();
  applyExplicitCompatibilityEvents(projection.events || [], state);
  return state;
}

function applyExplicitCompatibilityEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "CapabilitySetDeclared":
        addRecord(state.declarations, normalizeCapabilitySetDeclaration(
          payload.capabilitySetDeclaration || payload.capabilitySet,
          event
        ));
        break;
      case "CompatibilityCheckRecorded":
        addRecord(state.checks, normalizeCompatibilityRecord(
          payload.compatibilityCheck,
          event,
          "compatibilityCheck"
        ));
        break;
      case "CompatibilityFailureRecorded":
        addRecord(state.failures, normalizeCompatibilityRecord(
          payload.compatibilityFailure,
          event,
          "compatibilityFailure"
        ));
        break;
      case "CompatibilityDegradationRecorded":
        addRecord(state.degradations, normalizeCompatibilityRecord(
          payload.compatibilityDegradation,
          event,
          "compatibilityDegradation"
        ));
        break;
      case "CompatibilityAcceptanceRecorded":
        addRecord(state.acceptances, normalizeCompatibilityRecord(
          payload.compatibilityAcceptance,
          event,
          "compatibilityAcceptance"
        ));
        break;
      default:
        break;
    }
  }
}

function projectCompatibility(state = emptyCompatibilityState()) {
  const declarations = state.declarations.filter(Boolean);
  const checks = state.checks.filter(Boolean);
  const failures = state.failures.filter(Boolean);
  const degradations = state.degradations.filter(Boolean);
  const acceptances = state.acceptances.filter(Boolean);

  return {
    schema: COMPATIBILITY_SCHEMA,
    theorem: COMPATIBILITY_THEOREM,
    hardLaw: COMPATIBILITY_HARD_LAW,
    compatibilityProtocolVersion: COMPATIBILITY_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    localCapabilitySet: LOCAL_CAPABILITY_SET,
    supportedContinuityProtocolVersions: SUPPORTED_CONTINUITY_PROTOCOL_VERSIONS,
    supportedContinuitySchemaVersions: SUPPORTED_CONTINUITY_SCHEMA_VERSIONS,
    supportedVerificationLayers: SUPPORTED_VERIFICATION_LAYERS,
    supportedAmendmentTypes: SUPPORTED_AMENDMENT_TYPES,
    declarations,
    checks,
    failures,
    degradations,
    acceptances,
    byCheck: indexBy(checks, "id"),
    compatibilityValidationStatus: {
      valid: true,
      capabilityCount: LOCAL_CAPABILITY_SET.length,
      verificationLayerCount: SUPPORTED_VERIFICATION_LAYERS.length,
      checkCount: checks.length,
      failureCount: failures.length,
      degradationCount: degradations.length,
      acceptanceCount: acceptances.length,
      unsupportedStateAccepted: false,
      bestEffortAcceptance: false,
      silentDowngrade: false,
      importedStateMutation: false,
      governanceApproval: false,
      amendmentApproval: false
    }
  };
}

function verifyProtocolCompatibility(packet, options = {}) {
  const localContext = buildLocalCompatibilityContext(options);
  const continuityVerification = options.continuityVerification || null;
  const reasons = [];
  const degradations = [];

  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    reasons.push(reason("packet", "continuity packet must be an object"));
  }

  if (continuityVerification && !continuityVerification.valid) {
    reasons.push(reason("continuity", "continuity packet failed verification", {
      reasons: continuityVerification.reasons || []
    }));
  }

  if (!packet?.protocol_version) {
    reasons.push(reason("protocol_version", "packet protocol version must be declared"));
  } else if (!localContext.supportedContinuityProtocolVersions.includes(packet.protocol_version)) {
    reasons.push(reason("protocol_version", `unsupported continuity protocol version ${packet.protocol_version}`));
  }

  if (!packet?.schema_version) {
    reasons.push(reason("schema_version", "packet schema version must be declared"));
  } else if (!localContext.supportedContinuitySchemaVersions.includes(packet.schema_version)) {
    reasons.push(reason("schema_version", `unsupported continuity schema version ${packet.schema_version}`));
  }

  if (!packet?.clista_protocol_version) {
    reasons.push(reason("clista_protocol_version", "local protocol version must be declared"));
  } else if (packet.clista_protocol_version !== localContext.localProtocolVersion) {
    reasons.push(reason("clista_protocol_version", `unsupported ClisTa protocol version ${packet.clista_protocol_version}`));
  }

  const requiredCapabilities = arrayValues(packet?.capability_set);
  if (!requiredCapabilities.length) {
    reasons.push(reason("capability_set", "required capabilities must be declared"));
  }
  for (const capability of requiredCapabilities) {
    if (!localContext.localCapabilitySet.includes(capability)) {
      reasons.push(reason("capability_set", `unsupported required capability ${capability}`));
    }
  }

  const optionalCapabilities = arrayValues(packet?.optional_capability_set || packet?.optional_capabilities);
  for (const capability of optionalCapabilities) {
    if (!localContext.localCapabilitySet.includes(capability)) {
      degradations.push(reason("optional_capability_set", `unsupported optional capability ${capability}`));
    }
  }

  const requiredLayers = arrayValues(packet?.verification_state?.requiredLayers);
  if (!requiredLayers.length) {
    reasons.push(reason("verification_state.requiredLayers", "required verification layers must be declared"));
  }
  for (const layer of requiredLayers) {
    if (!localContext.supportedVerificationLayers.includes(layer)) {
      reasons.push(reason("verification_state.requiredLayers", `unsupported verification layer ${layer}`));
    }
  }

  for (const layer of requiredLayers) {
    const status = verificationLayerStatus(packet?.verification_state, layer);
    if (!status) {
      reasons.push(reason("verification_state", `missing verification layer ${layer}`));
    } else if (status.valid !== true) {
      reasons.push(reason("verification_state", `verification layer ${layer} is not valid`));
    }
  }

  validateNoCompatibilityMutation(packet?.verification_state, reasons);
  validateActiveAmendmentCompatibility(packet, localContext, reasons);

  const continuityRejected = continuityVerification && !continuityVerification.valid;
  const incompatible = reasons.length > (continuityRejected ? 1 : 0) || (!continuityRejected && reasons.length > 0);
  const status = continuityRejected
    ? "rejected"
    : incompatible
      ? "incompatible"
      : degradations.length || packet?.resume_status === "degraded" || packet?.verification_mode === "compatibility"
        ? "degraded"
        : "compatible";

  return {
    schema: COMPATIBILITY_VERIFY_SCHEMA,
    valid: status === "compatible" || status === "degraded",
    status,
    theorem: COMPATIBILITY_THEOREM,
    hardLaw: COMPATIBILITY_HARD_LAW,
    packetContext: packetContext(packet),
    localContext,
    continuityVerification: continuityVerification || null,
    reasons,
    degradations
  };
}

function summarizeProtocolCompatibility(result) {
  return {
    schema: "clista.compatibility.summary.v0",
    valid: result.valid,
    status: result.status,
    theorem: result.theorem,
    hardLaw: result.hardLaw,
    packet: result.packetContext,
    local: {
      localProtocolVersion: result.localContext.localProtocolVersion,
      compatibilityProtocolVersion: result.localContext.compatibilityProtocolVersion,
      localCapabilitySet: result.localContext.localCapabilitySet,
      supportedVerificationLayers: result.localContext.supportedVerificationLayers,
      supportedContinuityProtocolVersions: result.localContext.supportedContinuityProtocolVersions,
      supportedAmendmentIds: result.localContext.supportedAmendmentIds
    },
    reasons: result.reasons,
    degradations: result.degradations
  };
}

function buildLocalCompatibilityContext(options = {}) {
  return {
    schema: "clista.compatibility.local_context.v0",
    theorem: COMPATIBILITY_THEOREM,
    hardLaw: COMPATIBILITY_HARD_LAW,
    localProtocolVersion: options.localProtocolVersion || PROTOCOL_VERSION,
    compatibilityProtocolVersion: options.compatibilityProtocolVersion || COMPATIBILITY_PROTOCOL_VERSION,
    localCapabilitySet: unique(options.localCapabilitySet || options.supportedCapabilities || LOCAL_CAPABILITY_SET),
    supportedContinuityProtocolVersions: unique(
      options.supportedContinuityProtocolVersions || SUPPORTED_CONTINUITY_PROTOCOL_VERSIONS
    ),
    supportedContinuitySchemaVersions: unique(
      options.supportedContinuitySchemaVersions || SUPPORTED_CONTINUITY_SCHEMA_VERSIONS
    ),
    supportedVerificationLayers: unique(
      options.supportedVerificationLayers || SUPPORTED_VERIFICATION_LAYERS
    ),
    supportedAmendmentTypes: unique(options.supportedAmendmentTypes || SUPPORTED_AMENDMENT_TYPES),
    supportedAmendmentIds: unique(options.supportedAmendmentIds || [])
  };
}

function validateCapabilitySetDeclaration(declaration) {
  const reasons = [];
  if (!declaration?.id) {
    reasons.push("capability set declaration requires id");
  }
  const capabilities = arrayValues(declaration?.capabilitySet || declaration?.capabilities);
  if (!capabilities.length) {
    reasons.push("capability set declaration requires capabilities");
  }
  reasons.push(...rejectCompatibilityGuardFields(declaration));
  return reasons;
}

function validateCompatibilityCheck(record) {
  return validateCompatibilityRecord(record, "compatibility check");
}

function validateCompatibilityFailure(record) {
  return validateCompatibilityRecord(record, "compatibility failure");
}

function validateCompatibilityDegradation(record) {
  return validateCompatibilityRecord(record, "compatibility degradation");
}

function validateCompatibilityAcceptance(record) {
  return validateCompatibilityRecord(record, "compatibility acceptance");
}

function validateCompatibilityRecord(record, label) {
  const reasons = [];
  if (!record?.id) {
    reasons.push(`${label} requires id`);
  }
  const status = normalizeStatus(record?.status);
  if (!STATUS_VALUES.has(status)) {
    reasons.push(`${label} requires status compatible, degraded, incompatible, or rejected`);
  }
  if (!record?.packetProtocolVersion && !record?.protocolVersion) {
    reasons.push(`${label} requires packetProtocolVersion`);
  }
  if (!record?.localProtocolVersion) {
    reasons.push(`${label} requires localProtocolVersion`);
  }
  reasons.push(...rejectCompatibilityGuardFields(record));
  return reasons;
}

function rejectCompatibilityGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }

  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`compatibility field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectCompatibilityGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function normalizeCapabilitySetDeclaration(declaration, event) {
  if (!declaration) {
    return null;
  }
  const capabilities = unique(declaration.capabilitySet || declaration.capabilities || []);
  const requiredCapabilities = unique(declaration.requiredCapabilities || capabilities);
  const optionalCapabilities = unique(declaration.optionalCapabilities || []);
  const normalized = stripUndefined({
    id: declaration.id || deterministicId("cap", "capability_set", event.event_id),
    object: "capabilitySetDeclaration",
    protocolVersion: declaration.protocolVersion || PROTOCOL_VERSION,
    compatibilityProtocolVersion: declaration.compatibilityProtocolVersion || COMPATIBILITY_PROTOCOL_VERSION,
    capabilitySet: capabilities,
    requiredCapabilities,
    optionalCapabilities,
    declaredBy: declaration.declaredBy || event.actor_id,
    declaredAt: declaration.declaredAt || event.timestamp,
    sourceEventId: event.event_id,
    bestEffortAcceptance: false,
    unsupportedStateAccepted: false,
    silentDowngrade: false,
    importedStateMutation: false,
    governanceApproval: false,
    amendmentApproval: false
  });
  normalized.compatibilityHash = contentHash({
    protocolVersion: normalized.protocolVersion,
    compatibilityProtocolVersion: normalized.compatibilityProtocolVersion,
    capabilitySet: normalized.capabilitySet,
    requiredCapabilities: normalized.requiredCapabilities,
    optionalCapabilities: normalized.optionalCapabilities
  });
  return normalized;
}

function normalizeCompatibilityRecord(record, event, objectType) {
  if (!record) {
    return null;
  }
  const normalized = stripUndefined({
    id: record.id || deterministicId("cmp", objectType, event.event_id),
    object: objectType,
    status: normalizeStatus(record.status),
    packetProtocolVersion: record.packetProtocolVersion || record.protocolVersion,
    localProtocolVersion: record.localProtocolVersion || PROTOCOL_VERSION,
    requiredCapabilities: unique(record.requiredCapabilities || []),
    unsupportedCapabilities: unique(record.unsupportedCapabilities || []),
    unsupportedVerificationLayers: unique(record.unsupportedVerificationLayers || []),
    unsupportedAmendmentIds: unique(record.unsupportedAmendmentIds || []),
    reasons: unique(record.reasons || []),
    checkedBy: record.checkedBy || event.actor_id,
    checkedAt: record.checkedAt || event.timestamp,
    sourceEventId: event.event_id,
    bestEffortAcceptance: false,
    unsupportedStateAccepted: false,
    silentDowngrade: false,
    importedStateMutation: false,
    governanceApproval: false,
    amendmentApproval: false
  });
  normalized.compatibilityHash = contentHash({
    status: normalized.status,
    packetProtocolVersion: normalized.packetProtocolVersion,
    localProtocolVersion: normalized.localProtocolVersion,
    requiredCapabilities: normalized.requiredCapabilities,
    unsupportedCapabilities: normalized.unsupportedCapabilities,
    unsupportedVerificationLayers: normalized.unsupportedVerificationLayers,
    unsupportedAmendmentIds: normalized.unsupportedAmendmentIds,
    reasons: normalized.reasons
  });
  return normalized;
}

function validateNoCompatibilityMutation(value, reasons) {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [field, label] of [
    ["authorityCreated", "compatibility cannot create authority"],
    ["governanceMutation", "compatibility cannot mutate governance"],
    ["amendmentApproval", "compatibility cannot approve amendments"],
    ["importedStateMutation", "compatibility cannot mutate imported state"]
  ]) {
    if (value[field] !== false) {
      reasons.push(reason(`verification_state.${field}`, label));
    }
  }
}

function validateActiveAmendmentCompatibility(packet, localContext, reasons) {
  const activeAmendments = activeAmendmentsFromPacket(packet);
  for (const amendment of activeAmendments) {
    const amendmentType = normalizeType(amendment.amendmentType || amendment.type);
    if (amendmentType && !localContext.supportedAmendmentTypes.includes(amendmentType)) {
      reasons.push(reason("amendment_state.activeAmendments", `unsupported active amendment type ${amendmentType}`));
    }
    if (!localContext.supportedAmendmentIds.includes(amendment.id)) {
      reasons.push(reason("amendment_state.activeAmendments", `unsupported active amendment ${amendment.id}`));
    }
  }
}

function activeAmendmentsFromPacket(packet) {
  const amendmentState = packet?.continuity_state?.amendment_state || packet?.continuity_state?.amendments || {};
  return arrayValues(amendmentState.activeAmendments || amendmentState.active_amendments);
}

function verificationLayerStatus(verificationState, layer) {
  if (!verificationState) {
    return null;
  }
  const fieldByLayer = {
    validity: "validity",
    integrity: "integrity",
    attribution: "attributionValidationStatus",
    provenance: "provenanceValidationStatus",
    learning: "learningValidationStatus",
    adaptation: "adaptationValidationStatus",
    amendments: "amendmentValidationStatus",
    compatibility: "compatibilityValidationStatus",
    interoperability: "interoperabilityValidationStatus",
    federation: "federationValidationStatus"
  };
  return verificationState[fieldByLayer[layer]] || null;
}

function packetContext(packet) {
  return {
    packetType: packet?.packet_type || null,
    protocolVersion: packet?.protocol_version || null,
    schemaVersion: packet?.schema_version || null,
    clistaProtocolVersion: packet?.clista_protocol_version || null,
    sourceThreadId: packet?.source_thread_id || null,
    resumeStatus: packet?.resume_status || null,
    verificationMode: packet?.verification_mode || null,
    requiredCapabilities: arrayValues(packet?.capability_set),
    optionalCapabilities: arrayValues(packet?.optional_capability_set || packet?.optional_capabilities),
    requiredVerificationLayers: arrayValues(packet?.verification_state?.requiredLayers),
    activeAmendmentIds: activeAmendmentsFromPacket(packet).map((amendment) => amendment.id)
  };
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
  return `${prefix}_${normalizeType(type).slice(0, 24) || "compatibility"}_${hash}`;
}

function normalizeStatus(status) {
  return String(status || "incompatible").trim().toLowerCase();
}

function normalizeType(type) {
  return String(type || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function indexBy(records, key) {
  return records.reduce((indexed, record) => {
    if (record[key]) {
      indexed[record[key]] = record;
    }
    return indexed;
  }, {});
}

function arrayValues(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return [];
}

function unique(values) {
  return Array.from(new Set(arrayValues(values)));
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
  COMPATIBILITY_EVENT_TYPES,
  COMPATIBILITY_HARD_LAW,
  COMPATIBILITY_PROTOCOL_VERSION,
  COMPATIBILITY_SCHEMA,
  COMPATIBILITY_THEOREM,
  COMPATIBILITY_VERIFY_SCHEMA,
  LOCAL_CAPABILITY_SET,
  SUPPORTED_AMENDMENT_TYPES,
  SUPPORTED_CONTINUITY_PROTOCOL_VERSIONS,
  SUPPORTED_CONTINUITY_SCHEMA_VERSIONS,
  SUPPORTED_VERIFICATION_LAYERS,
  buildCompatibilityState,
  buildLocalCompatibilityContext,
  projectCompatibility,
  summarizeProtocolCompatibility,
  validateCapabilitySetDeclaration,
  validateCompatibilityAcceptance,
  validateCompatibilityCheck,
  validateCompatibilityDegradation,
  validateCompatibilityFailure,
  verifyProtocolCompatibility
};
