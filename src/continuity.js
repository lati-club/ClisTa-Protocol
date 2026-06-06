const fs = require("node:fs");
const path = require("node:path");
const { initStore, nowIso, storeDir } = require("./events");
const {
  PROTOCOL_VERSION,
  contentHash,
  stableStringify,
  verifyEventIntegrity
} = require("./integrity");
const { buildInteroperabilityProfile } = require("./interoperability");
const { projectEvents, selectThreadState } = require("./projector");
const { validateEvents } = require("./validator");

const CONTINUITY_FILE = "continuity.json";
const CONTINUITY_PROTOCOL = "clista";
const CONTINUITY_PACKET_TYPE = "continuity";
const CONTINUITY_PROTOCOL_VERSION = "0.18.0";
const CONTINUITY_SCHEMA_VERSION = "clista.continuity.packet.v0";
const CONTINUITY_THEOREM = "reasoning_continuity = resume(project(event_log), verification_state)";
const CONTINUITY_HARD_LAW = "context transfer != memory trust";

const CONTINUITY_CAPABILITY_SET = [
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
  "federation",
  "negotiation"
];

const REQUIRED_VERIFICATION_LAYERS = [
  "validity",
  "integrity",
  "attribution",
  "provenance",
  "learning",
  "adaptation",
  "amendments",
  "compatibility",
  "interoperability",
  "federation",
  "negotiation"
];

function continuityPacketPath(cwd = process.cwd()) {
  return path.join(storeDir(cwd), CONTINUITY_FILE);
}

function exportContinuityPacket(events, options = {}) {
  const validation = validateEvents(events);
  if (!validation.valid) {
    throw new Error(formatContinuityReasons(validation.errors.map((error) => ({
      field: "source_events",
      event_id: error.event_id,
      reason: error.reason
    }))));
  }

  const materials = buildContinuityMaterials(events, options.threadId || options.thread);
  if (!materials.integrity.valid) {
    throw new Error(formatContinuityReasons(materials.integrity.reasons.map((reason) => ({
      field: "source_events",
      event_id: reason.event_id,
      reason: reason.reason
    }))));
  }
  if (materials.state.error) {
    throw new Error(materials.state.error);
  }

  const exportedAt = options.exportedAt || latestEventTimestamp(events);
  return {
    protocol: CONTINUITY_PROTOCOL,
    packet_type: CONTINUITY_PACKET_TYPE,
    protocol_version: CONTINUITY_PROTOCOL_VERSION,
    schema_version: CONTINUITY_SCHEMA_VERSION,
    theorem: CONTINUITY_THEOREM,
    hard_law: CONTINUITY_HARD_LAW,
    clista_protocol_version: PROTOCOL_VERSION,
    source_thread_id: materials.threadId,
    event_log_hash: materials.eventLogHash,
    projection_hash: materials.projectionHash,
    state_hash: materials.stateHash,
    capability_set: CONTINUITY_CAPABILITY_SET,
    integrity_verified: materials.integrity.valid,
    strict_integrity_verified: materials.strictIntegrity.valid,
    verification_mode: materials.strictIntegrity.valid ? "strict" : "compatibility",
    resume_status: materials.verificationState.status,
    exported_at: exportedAt,
    integrity: materials.integrity,
    verification_state: materials.verificationState,
    interoperability_profile: materials.interoperabilityProfile,
    source_events: clone(events),
    continuity_state: materials.continuityState
  };
}

function verifyContinuityPacket(packet) {
  const reasons = [];
  validatePacketEnvelope(packet, reasons);

  const events = Array.isArray(packet?.source_events) ? packet.source_events : null;
  if (!events) {
    reasons.push(reason("source_events", "source_events must be an array"));
  }
  if (!packet?.continuity_state || typeof packet.continuity_state !== "object" || Array.isArray(packet.continuity_state)) {
    reasons.push(reason("continuity_state", "continuity_state must be an object"));
  }
  if (!packet?.verification_state || typeof packet.verification_state !== "object" || Array.isArray(packet.verification_state)) {
    reasons.push(reason("verification_state", "verification_state must be an object"));
  } else {
    validateVerificationStateShape(packet.verification_state, reasons);
    validateNoContinuityMutation(packet.verification_state, reasons);
  }
  if (!packet?.interoperability_profile || typeof packet.interoperability_profile !== "object" || Array.isArray(packet.interoperability_profile)) {
    reasons.push(reason("interoperability_profile", "interoperability_profile must be an object"));
  }
  validateCapabilitySet(packet?.capability_set, reasons);

  if (events) {
    const integrity = verifyEventIntegrity(events);
    if (!integrity.valid) {
      reasons.push(reason("integrity_verified", "source events failed integrity verification"));
      for (const item of integrity.reasons) {
        reasons.push(reason("source_events", item.reason, item));
      }
    }
    if (packet?.integrity_verified !== true) {
      reasons.push(reason("integrity_verified", "integrity_verified must be true"));
    }

    const strictIntegrity = verifyEventIntegrity(events, { strict: true });
    if (typeof packet?.strict_integrity_verified !== "boolean") {
      reasons.push(reason("strict_integrity_verified", "strict_integrity_verified must be boolean"));
    } else if (packet.strict_integrity_verified !== strictIntegrity.valid) {
      reasons.push(reason("strict_integrity_verified", "strict_integrity_verified does not match source events", {
        expected: strictIntegrity.valid,
        actual: packet.strict_integrity_verified
      }));
    }

    const verificationMode = strictIntegrity.valid ? "strict" : "compatibility";
    if (packet?.verification_mode !== verificationMode) {
      reasons.push(reason("verification_mode", "verification_mode does not match source events", {
        expected: verificationMode,
        actual: packet?.verification_mode
      }));
    }
    if (stableStringify(packet?.integrity || {}) !== stableStringify(integrity)) {
      reasons.push(reason("integrity", "integrity metadata does not match source events"));
    }

    const eventLogHash = hashEventLog(events);
    if (packet?.event_log_hash !== eventLogHash) {
      reasons.push(reason("event_log_hash", "event_log_hash does not match source events", {
        expected: eventLogHash,
        actual: packet?.event_log_hash
      }));
    }

    const validation = validateEvents(events);
    if (!validation.valid) {
      for (const error of validation.errors) {
        reasons.push(reason("source_events", error.reason, { event_id: error.event_id }));
      }
    } else if (packet?.source_thread_id) {
      const materials = buildContinuityMaterials(events, packet.source_thread_id);
      if (materials.state.error) {
        reasons.push(reason("source_thread_id", materials.state.error));
      } else {
        compareHash(reasons, "projection_hash", materials.projectionHash, packet?.projection_hash);
        compareHash(reasons, "state_hash", materials.stateHash, packet?.state_hash);
        if (packet?.resume_status !== materials.verificationState.status) {
          reasons.push(reason("resume_status", "resume_status does not match verification state", {
            expected: materials.verificationState.status,
            actual: packet?.resume_status
          }));
        }

        const packetStateHash = contentHash(packet.continuity_state || {});
        compareHash(reasons, "state_hash", packetStateHash, packet?.state_hash, "state_hash does not match continuity_state");
        if (stableStringify(packet.continuity_state || {}) !== stableStringify(materials.continuityState)) {
          reasons.push(reason("continuity_state", "continuity_state does not match projected thread state"));
        }
        if (stableStringify(packet.verification_state || {}) !== stableStringify(materials.verificationState)) {
          reasons.push(reason("verification_state", "verification_state does not match recomputed verification state"));
        }
        if (stableStringify(packet.interoperability_profile || {}) !== stableStringify(materials.interoperabilityProfile)) {
          reasons.push(reason("interoperability_profile", "interoperability_profile does not match recomputed semantic profile"));
        }
      }
    }
  }

  return {
    schema: "clista.continuity.verification.v0",
    valid: reasons.length === 0,
    packetType: packet?.packet_type || null,
    sourceThreadId: packet?.source_thread_id || null,
    protocolVersion: packet?.protocol_version || null,
    schemaVersion: packet?.schema_version || null,
    verificationMode: packet?.verification_mode || null,
    resumeStatus: packet?.resume_status || null,
    eventLogHash: packet?.event_log_hash || null,
    projectionHash: packet?.projection_hash || null,
    stateHash: packet?.state_hash || null,
    verificationState: packet?.verification_state || null,
    interoperabilityProfile: packet?.interoperability_profile || null,
    reasons
  };
}

function resumeContinuityPacket(packet) {
  const verification = verifyContinuityPacket(packet);
  if (!verification.valid) {
    return {
      schema: "clista.continuity.resume.v0",
      resumed: false,
      resumeStatus: "rejected",
      hardLaw: CONTINUITY_HARD_LAW,
      reason: "continuity packet failed verification",
      verification
    };
  }
  return {
    schema: "clista.continuity.resume.v0",
    resumed: true,
    resumeStatus: packet.resume_status,
    theorem: CONTINUITY_THEOREM,
    hardLaw: CONTINUITY_HARD_LAW,
    source_thread_id: packet.source_thread_id,
    protocol_version: packet.protocol_version,
    clista_protocol_version: packet.clista_protocol_version,
    verification_state: packet.verification_state,
    interoperability_profile: packet.interoperability_profile,
    continuity_state: packet.continuity_state
  };
}

function summarizeContinuityPacket(packet) {
  const verification = verifyContinuityPacket(packet);
  if (!verification.valid) {
    return {
      schema: "clista.continuity.summary.v0",
      valid: false,
      reasons: verification.reasons
    };
  }

  const state = packet.continuity_state;
  return {
    schema: "clista.continuity.summary.v0",
    valid: true,
    source_thread_id: packet.source_thread_id,
    protocol_version: packet.protocol_version,
    schema_version: packet.schema_version,
    theorem: packet.theorem,
    hard_law: packet.hard_law,
    resume_status: packet.resume_status,
    verification_mode: packet.verification_mode,
    current_question: state.current_question,
    current_decision: state.current_decision,
    status: state.status,
    next_action: state.next_action,
    active_assumption_ids: state.active_assumptions.map((assumption) => assumption.id),
    accepted_claim_ids: state.accepted_claims.map((claim) => claim.id),
    open_objection_ids: state.open_objections.map((objection) => objection.id),
    governance_status: state.governance_status,
    outcome_status: state.outcome_state?.status || null,
    fork_lineage: state.fork_lineage,
    merge_state: state.merge_state,
    attribution_count: (state.attribution_state?.attributions || []).length,
    attribution_state: state.attribution_state,
    provenance_state: state.provenance_state,
    learning_state: state.learning_state,
    adaptation_state: state.adaptation_state,
    amendment_state: state.amendment_state,
    compatibility_state: state.compatibility_state,
    interoperability_state: state.interoperability_state,
    federation_state: state.federation_state,
    negotiation_state: state.negotiation_state,
    integrity_state: state.integrity_state,
    verification_state: packet.verification_state
  };
}

function readContinuityPacketAt(packetPath) {
  if (!fs.existsSync(packetPath)) {
    throw new Error(`Continuity packet not found: ${packetPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(packetPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid continuity packet JSON at ${packetPath}: ${error.message}`);
  }
}

function writeContinuityPacket(packet, cwd = process.cwd(), options = {}) {
  initStore(cwd);
  const target = continuityPacketPath(cwd);
  if (fs.existsSync(target) && !options.replace) {
    throw new Error("Refusing to replace existing continuity packet; pass --replace true");
  }
  fs.writeFileSync(target, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  return target;
}

function buildContinuityMaterials(events, requestedThreadId) {
  const validation = validateEvents(events);
  const integrity = verifyEventIntegrity(events);
  const strictIntegrity = verifyEventIntegrity(events, { strict: true });
  const projection = projectEvents(events);
  const state = selectThreadState(projection, requestedThreadId);
  const threadId = state.thread?.id || requestedThreadId || null;
  const eventLogHash = hashEventLog(events);
  const projectionHash = contentHash(projectionMaterial(projection));
  const verificationStatus = determineResumeStatus({
    validation,
    integrity,
    strictIntegrity,
    projection
  });
  const continuityState = state.error
    ? null
    : buildContinuityState(state, {
        eventLogHash,
        integrity,
        strictIntegrity,
        verificationStatus
      });
  const stateHash = continuityState ? contentHash(continuityState) : null;
  const interoperabilityProfile = buildInteroperabilityProfile();
  const verificationState = buildVerificationState({
    validation,
    integrity,
    strictIntegrity,
    projection,
    eventLogHash,
    projectionHash,
    stateHash,
    status: verificationStatus.status
  });
  return {
    validation,
    integrity,
    strictIntegrity,
    projection,
    state,
    threadId,
    eventLogHash,
    projectionHash,
    continuityState,
    stateHash,
    verificationState,
    interoperabilityProfile
  };
}

function buildContinuityState(state, { eventLogHash, integrity, strictIntegrity, verificationStatus }) {
  const assumptions = state.assumptions || [];
  const claims = state.claims || [];
  const openObjections = state.unresolvedObjections || [];
  const decisionStatus = state.decisionStatus || {};
  const activeAssumptions = assumptions.filter((assumption) => assumption.status === "active");
  const acceptedClaims = claims.filter((claim) => (
    ["accepted", "approved", "endorsed"].includes(claim.status)
  ));

  return {
    mission: "Conversation is input. Reasoning state is output.",
    continuity_claim: "Projected reasoning state is continuity.",
    theorem: CONTINUITY_THEOREM,
    hard_law: CONTINUITY_HARD_LAW,
    resume_status: verificationStatus.status,
    capability_set: CONTINUITY_CAPABILITY_SET,
    source_thread_id: state.thread.id,
    current_question: state.thread.question,
    current_request: state.currentProposal || null,
    current_decision: decisionStatus.decisionRecord || null,
    assumptions,
    active_assumptions: activeAssumptions,
    claims,
    accepted_claims: acceptedClaims,
    open_objections: openObjections,
    governance_status: {
      request_status: decisionStatus.requestStatus || "none",
      record_status: decisionStatus.recordStatus || "none",
      review_count: (decisionStatus.reviews || []).length,
      minority_report_count: (decisionStatus.minorityReports || []).length,
      reviews: decisionStatus.reviews || [],
      minority_reports: decisionStatus.minorityReports || []
    },
    outcome_state: state.outcomeState || {},
    fork_lineage: state.forkLineage || null,
    merge_state: state.mergeState || {},
    attribution_state: state.attributionState || {},
    provenance_state: state.provenanceState || {},
    learning_state: state.learningState || {},
    adaptation_state: state.adaptationState || {},
    amendment_state: state.amendmentState || {},
    compatibility_state: state.compatibilityState || {},
    interoperability_state: state.interoperabilityState || {},
    federation_state: state.federationState || {},
    negotiation_state: state.negotiationState || {},
    verification_status: {
      status: verificationStatus.status,
      verification_mode: strictIntegrity.valid ? "strict" : "compatibility",
      required_layers: REQUIRED_VERIFICATION_LAYERS,
      missing_layers: verificationStatus.missingLayers,
      failed_layers: verificationStatus.failedLayers,
      transcript_replay: false,
      memory_trust: false
    },
    integrity_state: {
      event_count: integrity.eventCount,
      event_log_hash: eventLogHash,
      head_hash: integrity.headHash,
      integrity_verified: integrity.valid,
      strict_integrity_verified: strictIntegrity.valid,
      verification_mode: strictIntegrity.valid ? "strict" : "compatibility"
    },
    status: state.thread.status,
    next_action: state.reasoningState?.next_action || null
  };
}

function projectionMaterial(projection) {
  const material = {};
  for (const [key, value] of Object.entries(projection)) {
    if (key !== "projectedAt" && key !== "events" && key !== "schema") {
      material[key] = value;
    }
  }
  return material;
}

function hashEventLog(events) {
  return contentHash({ events });
}

function validatePacketEnvelope(packet, reasons) {
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    reasons.push(reason("packet", "packet must be an object"));
    return;
  }
  if (packet.protocol !== CONTINUITY_PROTOCOL) {
    reasons.push(reason("protocol", "protocol must be clista", { actual: packet.protocol }));
  }
  if (packet.packet_type !== CONTINUITY_PACKET_TYPE) {
    reasons.push(reason("packet_type", `unsupported packet_type ${packet.packet_type}`));
  }
  if (packet.protocol_version !== CONTINUITY_PROTOCOL_VERSION) {
    reasons.push(reason("protocol_version", `unsupported protocol_version ${packet.protocol_version}`));
  }
  if (packet.schema_version !== CONTINUITY_SCHEMA_VERSION) {
    reasons.push(reason("schema_version", `unsupported schema_version ${packet.schema_version}`));
  }
  if (packet.theorem !== CONTINUITY_THEOREM) {
    reasons.push(reason("theorem", `unsupported theorem ${packet.theorem}`));
  }
  if (packet.hard_law !== CONTINUITY_HARD_LAW) {
    reasons.push(reason("hard_law", `unsupported hard_law ${packet.hard_law}`));
  }
  if (packet.clista_protocol_version !== PROTOCOL_VERSION) {
    reasons.push(reason("clista_protocol_version", `unsupported clista_protocol_version ${packet.clista_protocol_version}`));
  }
  if (!["strict", "compatibility"].includes(packet.verification_mode)) {
    reasons.push(reason("verification_mode", `unsupported verification_mode ${packet.verification_mode}`));
  }
  for (const field of [
    "source_thread_id",
    "event_log_hash",
    "projection_hash",
    "state_hash",
    "capability_set",
    "exported_at",
    "integrity_verified",
    "strict_integrity_verified",
    "verification_mode",
    "resume_status",
    "integrity"
  ]) {
    if (packet[field] === undefined || packet[field] === null || packet[field] === "") {
      reasons.push(reason(field, `missing ${field}`));
    }
  }
  if (packet.exported_at && Number.isNaN(Date.parse(packet.exported_at))) {
    reasons.push(reason("exported_at", `malformed exported_at ${packet.exported_at}`));
  }
}

function buildVerificationState({
  validation,
  integrity,
  strictIntegrity,
  projection,
  eventLogHash,
  projectionHash,
  stateHash,
  status
}) {
  const verificationMode = strictIntegrity.valid ? "strict" : "compatibility";
  return {
    schema: "clista.continuity.verification_state.v0",
    theorem: CONTINUITY_THEOREM,
    hardLaw: CONTINUITY_HARD_LAW,
    status,
    clistaProtocolVersion: PROTOCOL_VERSION,
    continuityProtocolVersion: CONTINUITY_PROTOCOL_VERSION,
    capabilitySet: CONTINUITY_CAPABILITY_SET,
    requiredLayers: REQUIRED_VERIFICATION_LAYERS,
    verificationMode,
    eventLogHash,
    projectionHash,
    stateHash,
    validity: {
      valid: validation.valid,
      errorCount: validation.errors.length
    },
    integrity: {
      valid: integrity.valid,
      strict: strictIntegrity.valid,
      eventCount: integrity.eventCount,
      headHash: integrity.headHash,
      verificationMode
    },
    attributionValidationStatus: projection.attribution?.attributionValidationStatus || null,
    provenanceValidationStatus: projection.provenance?.provenanceValidationStatus || null,
    learningValidationStatus: projection.learning?.learningValidationStatus || null,
    adaptationValidationStatus: projection.adaptation?.adaptationValidationStatus || null,
    amendmentValidationStatus: projection.amendments?.amendmentValidationStatus || null,
    compatibilityValidationStatus: projection.compatibility?.compatibilityValidationStatus || null,
    interoperabilityValidationStatus: projection.interoperability?.interoperabilityValidationStatus || null,
    federationValidationStatus: projection.federation?.federationValidationStatus || null,
    negotiationValidationStatus: projection.negotiation?.negotiationValidationStatus || null,
    transcriptReplay: false,
    memoryTrust: false,
    authorityCreated: false,
    governanceMutation: false,
    amendmentApproval: false,
    importedStateMutation: false
  };
}

function determineResumeStatus({ validation, integrity, strictIntegrity, projection }) {
  const missingLayers = [];
  const failedLayers = [];
  const layers = {
    validity: validation.valid,
    integrity: integrity.valid,
    attribution: projection.attribution?.attributionValidationStatus?.valid,
    provenance: projection.provenance?.provenanceValidationStatus?.valid,
    learning: projection.learning?.learningValidationStatus?.valid,
    adaptation: projection.adaptation?.adaptationValidationStatus?.valid,
    amendments: projection.amendments?.amendmentValidationStatus?.valid,
    compatibility: projection.compatibility?.compatibilityValidationStatus?.valid,
    interoperability: projection.interoperability?.interoperabilityValidationStatus?.valid,
    federation: projection.federation?.federationValidationStatus?.valid,
    negotiation: projection.negotiation?.negotiationValidationStatus?.valid
  };

  for (const layer of REQUIRED_VERIFICATION_LAYERS) {
    if (layers[layer] === undefined || layers[layer] === null) {
      missingLayers.push(layer);
    } else if (layers[layer] !== true) {
      failedLayers.push(layer);
    }
  }

  if (missingLayers.length || failedLayers.length) {
    return {
      status: "rejected",
      missingLayers,
      failedLayers
    };
  }
  return {
    status: strictIntegrity.valid ? "verified" : "degraded",
    missingLayers,
    failedLayers
  };
}

function validateVerificationStateShape(verificationState, reasons) {
  if (verificationState.schema !== "clista.continuity.verification_state.v0") {
    reasons.push(reason("verification_state.schema", "unsupported verification_state schema"));
  }
  if (verificationState.theorem !== CONTINUITY_THEOREM) {
    reasons.push(reason("verification_state.theorem", "verification_state theorem mismatch"));
  }
  if (verificationState.hardLaw !== CONTINUITY_HARD_LAW) {
    reasons.push(reason("verification_state.hardLaw", "verification_state hard law mismatch"));
  }
  if (!["verified", "degraded", "rejected"].includes(verificationState.status)) {
    reasons.push(reason("verification_state.status", `unsupported verification_state status ${verificationState.status}`));
  }
  for (const layer of REQUIRED_VERIFICATION_LAYERS) {
    if (!verificationState.requiredLayers?.includes(layer)) {
      reasons.push(reason("verification_state.requiredLayers", `missing required verification layer ${layer}`));
    }
  }
  for (const [field, status] of [
    ["validity", verificationState.validity],
    ["integrity", verificationState.integrity],
    ["attributionValidationStatus", verificationState.attributionValidationStatus],
    ["provenanceValidationStatus", verificationState.provenanceValidationStatus],
    ["learningValidationStatus", verificationState.learningValidationStatus],
    ["adaptationValidationStatus", verificationState.adaptationValidationStatus],
    ["amendmentValidationStatus", verificationState.amendmentValidationStatus],
    ["compatibilityValidationStatus", verificationState.compatibilityValidationStatus],
    ["interoperabilityValidationStatus", verificationState.interoperabilityValidationStatus],
    ["federationValidationStatus", verificationState.federationValidationStatus],
    ["negotiationValidationStatus", verificationState.negotiationValidationStatus]
  ]) {
    if (!status || typeof status !== "object") {
      reasons.push(reason(`verification_state.${field}`, `missing verification layer ${field}`));
    } else if (status.valid !== true) {
      reasons.push(reason(`verification_state.${field}`, `verification layer ${field} is not valid`));
    }
  }
}

function validateCapabilitySet(capabilitySet, reasons) {
  if (!Array.isArray(capabilitySet)) {
    reasons.push(reason("capability_set", "capability_set must be an array"));
    return;
  }
  for (const capability of CONTINUITY_CAPABILITY_SET) {
    if (!capabilitySet.includes(capability)) {
      reasons.push(reason("capability_set", `missing capability ${capability}`));
    }
  }
}

function validateNoContinuityMutation(value, reasons) {
  for (const [field, label] of [
    ["transcriptReplay", "continuity cannot trust transcript replay"],
    ["memoryTrust", "continuity cannot trust model memory"],
    ["authorityCreated", "continuity package cannot create authority"],
    ["governanceMutation", "continuity package cannot mutate governance"],
    ["amendmentApproval", "continuity package cannot approve amendments"],
    ["importedStateMutation", "continuity package cannot mutate imported state"]
  ]) {
    if (value[field] !== false) {
      reasons.push(reason(`verification_state.${field}`, label));
    }
  }
}

function compareHash(reasons, field, expected, actual, message = `${field} does not match recomputed value`) {
  if (expected !== actual) {
    reasons.push(reason(field, message, { expected, actual }));
  }
}

function latestEventTimestamp(events) {
  return events.at(-1)?.timestamp || nowIso();
}

function reason(field, message, extra = {}) {
  return {
    field,
    reason: message,
    ...extra
  };
}

function formatContinuityReasons(reasons) {
  return reasons.map((item) => {
    const field = item.field || item.event_id || "packet";
    return `${field}: ${item.reason}`;
  }).join("\n");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  CONTINUITY_FILE,
  CONTINUITY_PACKET_TYPE,
  CONTINUITY_PROTOCOL,
  CONTINUITY_PROTOCOL_VERSION,
  CONTINUITY_SCHEMA_VERSION,
  CONTINUITY_THEOREM,
  CONTINUITY_HARD_LAW,
  buildContinuityMaterials,
  continuityPacketPath,
  exportContinuityPacket,
  formatContinuityReasons,
  hashEventLog,
  readContinuityPacketAt,
  resumeContinuityPacket,
  summarizeContinuityPacket,
  verifyContinuityPacket,
  writeContinuityPacket
};
