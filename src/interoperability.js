const { PROTOCOL_VERSION, contentHash } = require("./integrity");

const INTEROPERABILITY_SCHEMA = "clista.interoperability.v0";
const INTEROPERABILITY_VERIFY_SCHEMA = "clista.interoperability.verify.v0";
const INTEROPERABILITY_PROTOCOL_VERSION = "0.18.0";
const INTEROPERABILITY_THEOREM = "protocol_interoperability = preserve(meaning, across_compatible_contexts)";
const INTEROPERABILITY_HARD_LAW = "translation != reinterpretation";

const INTEROPERABILITY_EXCHANGE_FORMAT = "clista.continuity.packet.v0";

const REQUIRED_SEMANTICS = [
  "append_only_event_log",
  "projected_reasoning_state",
  "participant_identity",
  "authority_context",
  "attribution",
  "source_provenance",
  "claims",
  "assumptions",
  "evidence",
  "decisions",
  "outcomes",
  "forks",
  "merges",
  "learning_signals",
  "adaptation_recommendations",
  "protocol_amendments",
  "continuity_status",
  "compatibility_status",
  "interoperability_status",
  "federation_status",
  "negotiation_status"
];

const SUPPORTED_SEMANTICS = REQUIRED_SEMANTICS;
const SUPPORTED_EXCHANGE_FORMATS = [INTEROPERABILITY_EXCHANGE_FORMAT];

const SUPPORTED_EVENT_TYPES = [
  "ThreadCreated",
  "ThreadForked",
  "ParticipantAdded",
  "ParticipantDeclared",
  "ParticipantRoleAssigned",
  "ParticipantAuthorityGranted",
  "ParticipantAuthorityRevoked",
  "ContributionAttributed",
  "ContributionAttributionCorrected",
  "ContributionAttributionDisputed",
  "ContributionAttributionRevoked",
  "LearningSignalRecorded",
  "PatternObservationRecorded",
  "OutcomeReviewRecorded",
  "LearningRecommendationRecorded",
  "AdaptationReviewRecorded",
  "GovernanceReviewRecommended",
  "EvidenceRequirementReviewRecommended",
  "RevisitTriggerReviewRecommended",
  "DecisionGateReviewRecommended",
  "ProtocolAmendmentProposed",
  "ProtocolAmendmentReviewed",
  "ProtocolAmendmentApproved",
  "ProtocolAmendmentRejected",
  "ProtocolAmendmentSuperseded",
  "CompatibilityCheckRecorded",
  "CapabilitySetDeclared",
  "CompatibilityFailureRecorded",
  "CompatibilityDegradationRecorded",
  "CompatibilityAcceptanceRecorded",
  "InteroperabilityProfileDeclared",
  "SemanticMappingRecorded",
  "InteroperabilityCheckRecorded",
  "SemanticDegradationRecorded",
  "InteroperabilityFailureRecorded",
  "InteroperabilityAcceptanceRecorded",
  "FederationContextDeclared",
  "FederationPeerRecorded",
  "FederatedStateReferenceRecorded",
  "FederatedPacketVerified",
  "FederatedPacketRejected",
  "FederationBoundaryRecorded",
  "NegotiationRequested",
  "NegotiationConstraintDeclared",
  "NegotiationDifferenceRecorded",
  "NegotiationTermsProposed",
  "NegotiationTermsAccepted",
  "NegotiationTermsRejected",
  "NegotiationDegradationAccepted",
  "NegotiationFailureRecorded",
  "AssumptionDeclared",
  "EvidenceCommitted",
  "ClaimCreated",
  "PositionTaken",
  "ObjectionRaised",
  "ObjectionResolved",
  "AlignmentCalculated",
  "DecisionRequestOpened",
  "ReviewSubmitted",
  "DecisionMerged",
  "MinorityReportFiled",
  "ExpectedOutcomeDeclared",
  "OutcomeAudited",
  "DecisionScored",
  "MergeRequestOpened",
  "MergeReviewSubmitted",
  "MergeConflictDeclared",
  "MergeConflictResolved",
  "MergeCompleted"
];

const OBJECT_SEMANTICS = {
  claim: "assertion_under_evidence_and_assumptions",
  assumption: "uncertainty_declared_as_reasoning_input",
  evidence: "supporting_observation_or_artifact_reference",
  decision: "authorized_resolution_of_decision_request",
  authority: "event_time_governance_permission",
  attribution: "contribution_linked_to_participant_and_authority_context",
  provenance: "source_lineage_and_transformation_record",
  learning_signal: "pattern_level_outcome_learning_not_reputation",
  adaptation_recommendation: "governance_review_recommendation_not_mutation",
  amendment: "explicit_authorized_protocol_change",
  continuity: "verified_resume_state_not_transcript_memory",
  compatibility: "receiver_support_verification_not_acceptance_by_best_effort",
  interoperability: "meaning_preservation_status_not_structural_acceptance",
  federation: "independent_context_alignment_not_shared_authority",
  negotiation: "explicit_exchange_terms_not_authority_transfer"
};

const INTEROPERABILITY_EVENT_TYPES = new Set([
  "InteroperabilityProfileDeclared",
  "SemanticMappingRecorded",
  "InteroperabilityCheckRecorded",
  "SemanticDegradationRecorded",
  "InteroperabilityFailureRecorded",
  "InteroperabilityAcceptanceRecorded"
]);

const STATUS_VALUES = new Set(["interoperable", "degraded", "incompatible", "rejected"]);

const GUARD_FIELDS = new Set([
  "semanticLossAccepted",
  "semanticReinterpretation",
  "silentSemanticDegradation",
  "authorityFlattened",
  "provenanceFlattened",
  "learningSignalsAsScores",
  "adaptationRecommendationsAsAmendments",
  "continuityAsTranscriptSummary",
  "unsupportedSemanticsAccepted",
  "stateMutation"
]);

function emptyInteroperabilityState() {
  return {
    profiles: [],
    mappings: [],
    checks: [],
    degradations: [],
    failures: [],
    acceptances: []
  };
}

function buildInteroperabilityState(projection = {}) {
  const state = emptyInteroperabilityState();
  applyExplicitInteroperabilityEvents(projection.events || [], state);
  return state;
}

function applyExplicitInteroperabilityEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "InteroperabilityProfileDeclared":
        addRecord(state.profiles, normalizeInteroperabilityProfile(
          payload.interoperabilityProfile,
          event
        ));
        break;
      case "SemanticMappingRecorded":
        addRecord(state.mappings, normalizeSemanticMapping(
          payload.semanticMapping,
          event
        ));
        break;
      case "InteroperabilityCheckRecorded":
        addRecord(state.checks, normalizeInteroperabilityRecord(
          payload.interoperabilityCheck,
          event,
          "interoperabilityCheck"
        ));
        break;
      case "SemanticDegradationRecorded":
        addRecord(state.degradations, normalizeInteroperabilityRecord(
          payload.semanticDegradation,
          event,
          "semanticDegradation"
        ));
        break;
      case "InteroperabilityFailureRecorded":
        addRecord(state.failures, normalizeInteroperabilityRecord(
          payload.interoperabilityFailure,
          event,
          "interoperabilityFailure"
        ));
        break;
      case "InteroperabilityAcceptanceRecorded":
        addRecord(state.acceptances, normalizeInteroperabilityRecord(
          payload.interoperabilityAcceptance,
          event,
          "interoperabilityAcceptance"
        ));
        break;
      default:
        break;
    }
  }
}

function projectInteroperability(state = emptyInteroperabilityState()) {
  const profiles = state.profiles.filter(Boolean);
  const mappings = state.mappings.filter(Boolean);
  const checks = state.checks.filter(Boolean);
  const degradations = state.degradations.filter(Boolean);
  const failures = state.failures.filter(Boolean);
  const acceptances = state.acceptances.filter(Boolean);

  return {
    schema: INTEROPERABILITY_SCHEMA,
    theorem: INTEROPERABILITY_THEOREM,
    hardLaw: INTEROPERABILITY_HARD_LAW,
    interoperabilityProtocolVersion: INTEROPERABILITY_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    supportedExchangeFormats: SUPPORTED_EXCHANGE_FORMATS,
    supportedSemantics: SUPPORTED_SEMANTICS,
    supportedEventTypes: SUPPORTED_EVENT_TYPES,
    objectSemantics: OBJECT_SEMANTICS,
    profiles,
    mappings,
    checks,
    degradations,
    failures,
    acceptances,
    byProfile: indexBy(profiles, "id"),
    byMapping: indexBy(mappings, "id"),
    interoperabilityValidationStatus: {
      valid: true,
      semanticCount: SUPPORTED_SEMANTICS.length,
      eventTypeCount: SUPPORTED_EVENT_TYPES.length,
      profileCount: profiles.length,
      mappingCount: mappings.length,
      checkCount: checks.length,
      degradationCount: degradations.length,
      failureCount: failures.length,
      acceptanceCount: acceptances.length,
      semanticLossAccepted: false,
      semanticReinterpretation: false,
      silentSemanticDegradation: false,
      authorityFlattened: false,
      provenanceFlattened: false,
      learningSignalsAsScores: false,
      adaptationRecommendationsAsAmendments: false,
      continuityAsTranscriptSummary: false
    }
  };
}

function buildInteroperabilityProfile(options = {}) {
  const requiredSemantics = unique(options.requiredSemantics || REQUIRED_SEMANTICS);
  const optionalSemantics = unique(options.optionalSemantics || []);
  const eventTypes = unique(options.eventTypes || SUPPORTED_EVENT_TYPES);
  const objectSemantics = options.objectSemantics || OBJECT_SEMANTICS;
  const profile = {
    schema: "clista.interoperability.profile.v0",
    theorem: INTEROPERABILITY_THEOREM,
    hardLaw: INTEROPERABILITY_HARD_LAW,
    interoperabilityProtocolVersion: options.interoperabilityProtocolVersion || INTEROPERABILITY_PROTOCOL_VERSION,
    localProtocolVersion: options.localProtocolVersion || PROTOCOL_VERSION,
    exchangeFormat: options.exchangeFormat || INTEROPERABILITY_EXCHANGE_FORMAT,
    requiredSemantics,
    optionalSemantics,
    eventTypes,
    objectSemantics,
    semanticLossAccepted: false,
    semanticReinterpretation: false,
    silentSemanticDegradation: false,
    authorityFlattened: false,
    provenanceFlattened: false,
    learningSignalsAsScores: false,
    adaptationRecommendationsAsAmendments: false,
    continuityAsTranscriptSummary: false
  };
  profile.semanticHash = semanticProfileHash(profile);
  return profile;
}

function verifyProtocolInteroperability(packet, options = {}) {
  const localProfile = buildLocalInteroperabilityProfile(options);
  const compatibilityResult = options.compatibilityResult || null;
  const reasons = [];
  const degradations = [];

  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    reasons.push(reason("packet", "continuity packet must be an object"));
  }

  if (compatibilityResult && !compatibilityResult.valid) {
    reasons.push(reason("compatibility", "compatibility check failed", {
      status: compatibilityResult.status,
      reasons: compatibilityResult.reasons || []
    }));
  }

  const profile = packet?.interoperability_profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    reasons.push(reason("interoperability_profile", "interoperability profile must be declared"));
  } else {
    validateInteroperabilityProfileShape(profile, reasons);
    validateSemanticHash(profile, reasons);
    validateSemanticMeaning(profile, localProfile, packet, reasons, degradations);
  }

  const compatibilityRejected = compatibilityResult && compatibilityResult.status === "rejected";
  const compatibilityInvalid = compatibilityResult && !compatibilityResult.valid;
  const status = compatibilityRejected
    ? "rejected"
    : compatibilityInvalid || reasons.length
      ? "incompatible"
      : degradations.length || compatibilityResult?.status === "degraded" || packet?.resume_status === "degraded"
        ? "degraded"
        : "interoperable";

  return {
    schema: INTEROPERABILITY_VERIFY_SCHEMA,
    valid: status === "interoperable" || status === "degraded",
    status,
    theorem: INTEROPERABILITY_THEOREM,
    hardLaw: INTEROPERABILITY_HARD_LAW,
    packetContext: packetContext(packet),
    localProfile,
    compatibilityResult: compatibilityResult || null,
    reasons,
    degradations
  };
}

function summarizeProtocolInteroperability(result) {
  return {
    schema: "clista.interoperability.summary.v0",
    valid: result.valid,
    status: result.status,
    theorem: result.theorem,
    hardLaw: result.hardLaw,
    packet: result.packetContext,
    local: {
      exchangeFormats: result.localProfile.supportedExchangeFormats,
      supportedSemantics: result.localProfile.supportedSemantics,
      supportedEventTypes: result.localProfile.supportedEventTypes,
      objectSemantics: result.localProfile.objectSemantics
    },
    reasons: result.reasons,
    degradations: result.degradations
  };
}

function buildLocalInteroperabilityProfile(options = {}) {
  return {
    schema: "clista.interoperability.local_profile.v0",
    theorem: INTEROPERABILITY_THEOREM,
    hardLaw: INTEROPERABILITY_HARD_LAW,
    localProtocolVersion: options.localProtocolVersion || PROTOCOL_VERSION,
    interoperabilityProtocolVersion: options.interoperabilityProtocolVersion || INTEROPERABILITY_PROTOCOL_VERSION,
    supportedExchangeFormats: unique(options.supportedExchangeFormats || SUPPORTED_EXCHANGE_FORMATS),
    supportedSemantics: unique(options.supportedSemantics || SUPPORTED_SEMANTICS),
    supportedEventTypes: unique(options.supportedEventTypes || SUPPORTED_EVENT_TYPES),
    objectSemantics: options.objectSemantics || OBJECT_SEMANTICS
  };
}

function validateInteroperabilityProfile(profile) {
  return validateProfileObject(profile, "interoperability profile");
}

function validateSemanticMapping(mapping) {
  const reasons = [];
  if (!mapping?.id) {
    reasons.push("semantic mapping requires id");
  }
  if (!mapping?.sourceSemantic) {
    reasons.push("semantic mapping requires sourceSemantic");
  }
  if (!mapping?.targetSemantic) {
    reasons.push("semantic mapping requires targetSemantic");
  }
  if (mapping?.sourceSemantic && mapping?.targetSemantic && mapping.sourceSemantic !== mapping.targetSemantic) {
    reasons.push("semantic mapping cannot reinterpret sourceSemantic");
  }
  reasons.push(...rejectInteroperabilityGuardFields(mapping));
  return reasons;
}

function validateInteroperabilityCheck(record) {
  return validateInteroperabilityRecord(record, "interoperability check");
}

function validateSemanticDegradation(record) {
  return validateInteroperabilityRecord(record, "semantic degradation");
}

function validateInteroperabilityFailure(record) {
  return validateInteroperabilityRecord(record, "interoperability failure");
}

function validateInteroperabilityAcceptance(record) {
  return validateInteroperabilityRecord(record, "interoperability acceptance");
}

function validateProfileObject(profile, label) {
  const reasons = [];
  if (!profile?.id && label !== "packet interoperability profile") {
    reasons.push(`${label} requires id`);
  }
  if (!profile?.exchangeFormat) {
    reasons.push(`${label} requires exchangeFormat`);
  }
  if (!arrayValues(profile?.requiredSemantics).length) {
    reasons.push(`${label} requires requiredSemantics`);
  }
  reasons.push(...rejectInteroperabilityGuardFields(profile));
  return reasons;
}

function validateInteroperabilityRecord(record, label) {
  const reasons = [];
  if (!record?.id) {
    reasons.push(`${label} requires id`);
  }
  const status = normalizeStatus(record?.status);
  if (!STATUS_VALUES.has(status)) {
    reasons.push(`${label} requires status interoperable, degraded, incompatible, or rejected`);
  }
  if (!record?.exchangeFormat) {
    reasons.push(`${label} requires exchangeFormat`);
  }
  reasons.push(...rejectInteroperabilityGuardFields(record));
  return reasons;
}

function rejectInteroperabilityGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`interoperability field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectInteroperabilityGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function normalizeInteroperabilityProfile(profile, event) {
  if (!profile) {
    return null;
  }
  const normalized = {
    ...buildInteroperabilityProfile(profile),
    id: profile.id || deterministicId("iop", "interoperability_profile", event.event_id),
    object: "interoperabilityProfile",
    declaredBy: profile.declaredBy || event.actor_id,
    declaredAt: profile.declaredAt || event.timestamp,
    sourceEventId: event.event_id
  };
  normalized.semanticHash = semanticProfileHash(normalized);
  return normalized;
}

function normalizeSemanticMapping(mapping, event) {
  if (!mapping) {
    return null;
  }
  const normalized = stripUndefined({
    id: mapping.id || deterministicId("sem", "semantic_mapping", event.event_id),
    object: "semanticMapping",
    sourceSemantic: normalizeSemantic(mapping.sourceSemantic),
    targetSemantic: normalizeSemantic(mapping.targetSemantic),
    exchangeFormat: mapping.exchangeFormat || INTEROPERABILITY_EXCHANGE_FORMAT,
    rationale: mapping.rationale,
    mappedBy: mapping.mappedBy || event.actor_id,
    mappedAt: mapping.mappedAt || event.timestamp,
    sourceEventId: event.event_id,
    semanticLossAccepted: false,
    semanticReinterpretation: false,
    silentSemanticDegradation: false,
    authorityFlattened: false,
    provenanceFlattened: false,
    learningSignalsAsScores: false,
    adaptationRecommendationsAsAmendments: false,
    continuityAsTranscriptSummary: false
  });
  normalized.semanticHash = contentHash({
    sourceSemantic: normalized.sourceSemantic,
    targetSemantic: normalized.targetSemantic,
    exchangeFormat: normalized.exchangeFormat
  });
  return normalized;
}

function normalizeInteroperabilityRecord(record, event, objectType) {
  if (!record) {
    return null;
  }
  const normalized = stripUndefined({
    id: record.id || deterministicId("iop", objectType, event.event_id),
    object: objectType,
    status: normalizeStatus(record.status),
    exchangeFormat: record.exchangeFormat || INTEROPERABILITY_EXCHANGE_FORMAT,
    requiredSemantics: unique(record.requiredSemantics || []),
    unsupportedSemantics: unique(record.unsupportedSemantics || []),
    unsupportedEventTypes: unique(record.unsupportedEventTypes || []),
    reasons: unique(record.reasons || []),
    checkedBy: record.checkedBy || event.actor_id,
    checkedAt: record.checkedAt || event.timestamp,
    sourceEventId: event.event_id,
    semanticLossAccepted: false,
    semanticReinterpretation: false,
    silentSemanticDegradation: false,
    authorityFlattened: false,
    provenanceFlattened: false,
    learningSignalsAsScores: false,
    adaptationRecommendationsAsAmendments: false,
    continuityAsTranscriptSummary: false
  });
  normalized.semanticHash = contentHash({
    status: normalized.status,
    exchangeFormat: normalized.exchangeFormat,
    requiredSemantics: normalized.requiredSemantics,
    unsupportedSemantics: normalized.unsupportedSemantics,
    unsupportedEventTypes: normalized.unsupportedEventTypes,
    reasons: normalized.reasons
  });
  return normalized;
}

function validateInteroperabilityProfileShape(profile, reasons) {
  for (const item of validateProfileObject(profile, "packet interoperability profile")) {
    reasons.push(reason("interoperability_profile", item));
  }
  if (profile.theorem !== INTEROPERABILITY_THEOREM) {
    reasons.push(reason("interoperability_profile.theorem", "interoperability theorem mismatch"));
  }
  if (profile.hardLaw !== INTEROPERABILITY_HARD_LAW) {
    reasons.push(reason("interoperability_profile.hardLaw", "interoperability hard law mismatch"));
  }
}

function validateSemanticHash(profile, reasons) {
  const expected = semanticProfileHash(profile);
  if (profile.semanticHash !== expected) {
    reasons.push(reason("interoperability_profile.semanticHash", "semantic profile hash does not match declared semantics", {
      expected,
      actual: profile.semanticHash
    }));
  }
}

function validateSemanticMeaning(profile, localProfile, packet, reasons, degradations) {
  if (!localProfile.supportedExchangeFormats.includes(profile.exchangeFormat)) {
    reasons.push(reason("interoperability_profile.exchangeFormat", `unsupported exchange format ${profile.exchangeFormat}`));
  }

  for (const semantic of arrayValues(profile.requiredSemantics)) {
    if (!localProfile.supportedSemantics.includes(semantic)) {
      reasons.push(reason("interoperability_profile.requiredSemantics", `unknown required semantic ${semantic}`));
    }
  }
  for (const semantic of arrayValues(profile.optionalSemantics)) {
    if (!localProfile.supportedSemantics.includes(semantic)) {
      degradations.push(reason("interoperability_profile.optionalSemantics", `unsupported optional semantic ${semantic}`));
    }
  }

  for (const eventType of arrayValues(profile.eventTypes)) {
    if (!localProfile.supportedEventTypes.includes(eventType)) {
      reasons.push(reason("interoperability_profile.eventTypes", `unsupported event type semantic ${eventType}`));
    }
  }
  for (const event of packet?.source_events || []) {
    if (!profile.eventTypes?.includes(event.event_type)) {
      reasons.push(reason("source_events", `source event type ${event.event_type} is not declared in interoperability profile`, {
        event_id: event.event_id
      }));
    }
  }

  for (const [objectName, expectedMeaning] of Object.entries(localProfile.objectSemantics)) {
    if (profile.objectSemantics?.[objectName] !== expectedMeaning) {
      reasons.push(reason("interoperability_profile.objectSemantics", `semantic meaning mismatch for ${objectName}`));
    }
  }
}

function semanticProfileHash(profile) {
  return contentHash({
    theorem: profile.theorem,
    hardLaw: profile.hardLaw,
    interoperabilityProtocolVersion: profile.interoperabilityProtocolVersion,
    localProtocolVersion: profile.localProtocolVersion,
    exchangeFormat: profile.exchangeFormat,
    requiredSemantics: arrayValues(profile.requiredSemantics),
    optionalSemantics: arrayValues(profile.optionalSemantics),
    eventTypes: arrayValues(profile.eventTypes),
    objectSemantics: profile.objectSemantics || {},
    semanticLossAccepted: false,
    semanticReinterpretation: false,
    silentSemanticDegradation: false,
    authorityFlattened: false,
    provenanceFlattened: false,
    learningSignalsAsScores: false,
    adaptationRecommendationsAsAmendments: false,
    continuityAsTranscriptSummary: false
  });
}

function packetContext(packet) {
  return {
    packetType: packet?.packet_type || null,
    protocolVersion: packet?.protocol_version || null,
    schemaVersion: packet?.schema_version || null,
    sourceThreadId: packet?.source_thread_id || null,
    resumeStatus: packet?.resume_status || null,
    exchangeFormat: packet?.interoperability_profile?.exchangeFormat || null,
    requiredSemantics: arrayValues(packet?.interoperability_profile?.requiredSemantics),
    optionalSemantics: arrayValues(packet?.interoperability_profile?.optionalSemantics),
    eventTypeCount: arrayValues(packet?.interoperability_profile?.eventTypes).length
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
  return `${prefix}_${normalizeSemantic(type).slice(0, 24) || "interoperability"}_${hash}`;
}

function normalizeStatus(status) {
  return String(status || "incompatible").trim().toLowerCase();
}

function normalizeSemantic(value) {
  return String(value || "")
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
  INTEROPERABILITY_EVENT_TYPES,
  INTEROPERABILITY_EXCHANGE_FORMAT,
  INTEROPERABILITY_HARD_LAW,
  INTEROPERABILITY_PROTOCOL_VERSION,
  INTEROPERABILITY_SCHEMA,
  INTEROPERABILITY_THEOREM,
  INTEROPERABILITY_VERIFY_SCHEMA,
  OBJECT_SEMANTICS,
  REQUIRED_SEMANTICS,
  SUPPORTED_EVENT_TYPES,
  SUPPORTED_EXCHANGE_FORMATS,
  SUPPORTED_SEMANTICS,
  buildInteroperabilityProfile,
  buildInteroperabilityState,
  buildLocalInteroperabilityProfile,
  projectInteroperability,
  summarizeProtocolInteroperability,
  validateInteroperabilityAcceptance,
  validateInteroperabilityCheck,
  validateInteroperabilityFailure,
  validateInteroperabilityProfile,
  validateSemanticDegradation,
  validateSemanticMapping,
  verifyProtocolInteroperability
};
