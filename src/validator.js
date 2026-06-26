const { evaluateDecisionEligibility, isBlockingObjection } = require("./governance");
const {
  validateAdaptationReview,
  validateDecisionGateReviewRecommendation,
  validateEvidenceRequirementReviewRecommendation,
  validateGovernanceReviewRecommendation,
  validateRevisitTriggerReviewRecommendation
} = require("./adaptation");
const {
  validateProtocolAmendment,
  validateProtocolAmendmentApproval,
  validateProtocolAmendmentRejection,
  validateProtocolAmendmentReview,
  validateProtocolAmendmentSupersession
} = require("./amendments");
const {
  validateCapabilitySetDeclaration,
  validateCompatibilityAcceptance,
  validateCompatibilityCheck,
  validateCompatibilityDegradation,
  validateCompatibilityFailure
} = require("./compatibility");
const {
  validateDelegatedAction,
  validateDelegationExpiration,
  validateDelegationGrant,
  validateDelegationRevocation,
  validateDelegationViolation
} = require("./delegation");
const {
  validateExecutionCompletion,
  validateExecutionFailure,
  validateExecutionRollback,
  validateExecutionStart,
  validateExecutionViolation
} = require("./execution");
const {
  validateFederatedPacketRejection,
  validateFederatedPacketVerification,
  validateFederatedStateReference,
  validateFederationBoundary,
  validateFederationContext,
  validateFederationPeer
} = require("./federation");
const {
  validateAttributionCorrection,
  validateAttributionDispute,
  validateAttributionRevocation,
  validateContributionAttribution
} = require("./attribution");
const {
  validateContributionProvenance
} = require("./provenance");
const {
  EVENT_HASH_VERSION,
  HASH_PATTERN,
  PROTOCOL_VERSION,
  computeEventHash
} = require("./integrity");
const {
  validateInteroperabilityAcceptance,
  validateInteroperabilityCheck,
  validateInteroperabilityFailure,
  validateInteroperabilityProfile,
  validateSemanticDegradation,
  validateSemanticMapping
} = require("./interoperability");
const {
  validateLearningRecommendation,
  validateLearningSignal,
  validateOutcomeReview,
  validatePatternObservation
} = require("./learning");
const {
  validateNegotiationConstraint,
  validateNegotiationDegradationAccepted,
  validateNegotiationDifference,
  validateNegotiationFailure,
  validateNegotiationRequest,
  validateNegotiationTermsAccepted,
  validateNegotiationTermsProposed,
  validateNegotiationTermsRejected
} = require("./negotiation");
const {
  validateOutcomeDispute,
  validateOutcomeEvaluation,
  validateOutcomeExpectation,
  validateOutcomeObservation,
  validateOutcomeViolation
} = require("./outcome");
const {
  validateOutcomeLearningDispute,
  validateOutcomeLearningSignal,
  validateOutcomeLearningViolation,
  validateOutcomeLesson
} = require("./outcome-learning");
const {
  validateProtocolReview,
  validateReviewCompletion,
  validateReviewDispute,
  validateReviewViolation
} = require("./review");
const {
  RECOVERY_SUBJECT_TYPES,
  buildRecoveryState,
  checkpointHash,
  projectRecovery,
  recoveryLogHash,
  restoredProjectionHash,
  restoredStateHash,
  subjectRequiresArtifactEvidence,
  validateRecoveryApplication,
  validateRecoveryPlan,
  validateRecoveryQuarantine,
  validateRecoveryRequest,
  validateRecoveryVerification,
  validateRecoveryViolation
} = require("./recovery");
const {
  VALID_AUTHORITIES,
  VALID_AUTHORITY_SCOPES,
  applyIdentityEvent,
  emptyIdentityState,
  participantHasAuthority
} = require("./identity");
const {
  MERGE_CONFLICT_RESOLUTIONS,
  buildMergeState,
  evaluateMergeEligibility,
  objectIdsForThreadScope,
  threadDescendsFrom
} = require("./merges");
const { unique } = require("./utils");

class ValidationError extends Error {
  constructor(errors) {
    super(formatValidationErrors(errors));
    this.name = "ValidationError";
    this.errors = errors;
  }
}

const ENVELOPE_FIELDS = [
  "event_id",
  "event_type",
  "thread_id",
  "actor_id",
  "timestamp",
  "payload"
];

const OUTCOME_STATUSES = new Set([
  "confirmed",
  "partially_confirmed",
  "failed",
  "inconclusive"
]);

const MERGE_REVIEW_STATUSES = new Set([
  "approve",
  "request_changes",
  "reject"
]);

const MERGE_CONFLICT_TYPES = new Set([
  "assumption",
  "claim",
  "evidence",
  "objection",
  "decision",
  "outcome"
]);

function validateEvents(events) {
  const state = emptyValidationState(events);

  events.forEach((event, index) => {
    validateEnvelope(event, index, state);
    validateAuditIntegrity(event, index, state);

    if (!event || typeof event !== "object" || !event.event_type || !event.payload) {
      return;
    }

    validateActor(event, state);
    validateForkEvent(event, state);

    switch (event.event_type) {
      case "ParticipantAdded":
        validateParticipantAdded(event, state);
        break;
      case "ParticipantDeclared":
        validateParticipantDeclared(event, state);
        break;
      case "ParticipantRoleAssigned":
        validateParticipantRoleAssigned(event, state);
        break;
      case "ParticipantAuthorityGranted":
        validateParticipantAuthorityGranted(event, state);
        break;
      case "ParticipantAuthorityRevoked":
        validateParticipantAuthorityRevoked(event, state);
        break;
      case "ContributionAttributed":
        validateContributionAttributed(event, index, state);
        break;
      case "ContributionAttributionCorrected":
        validateContributionAttributionCorrected(event, state);
        break;
      case "ContributionAttributionDisputed":
        validateContributionAttributionDisputed(event, state);
        break;
      case "ContributionAttributionRevoked":
        validateContributionAttributionRevoked(event, state);
        break;
      case "LearningSignalRecorded":
        validateLearningSignalRecorded(event, state);
        break;
      case "PatternObservationRecorded":
        validatePatternObservationRecorded(event, state);
        break;
      case "OutcomeReviewRecorded":
        validateOutcomeReviewRecorded(event, state);
        break;
      case "LearningRecommendationRecorded":
        validateLearningRecommendationRecorded(event, state);
        break;
      case "AdaptationReviewRecorded":
      case "ObjectDeprecated":
        // Pruning / deprecation event - basic acceptance for Milestone 0 pruning discipline
        break;
      case "PruningReviewInitiated":
        break;
      case "ModelPruned":
        break;
        validateAdaptationReviewRecorded(event, state);
        break;
      case "GovernanceReviewRecommended":
        validateGovernanceReviewRecommendedEvent(event, state);
        break;
      case "EvidenceRequirementReviewRecommended":
        validateEvidenceRequirementReviewRecommendedEvent(event, state);
        break;
      case "RevisitTriggerReviewRecommended":
        validateRevisitTriggerReviewRecommendedEvent(event, state);
        break;
      case "DecisionGateReviewRecommended":
        validateDecisionGateReviewRecommendedEvent(event, state);
        break;
      case "ProtocolAmendmentProposed":
        validateProtocolAmendmentProposed(event, state);
        break;
      case "ProtocolAmendmentReviewed":
        validateProtocolAmendmentReviewed(event, state);
        break;
      case "ProtocolAmendmentApproved":
        validateProtocolAmendmentApprovedEvent(event, state);
        break;
      case "ProtocolAmendmentRejected":
        validateProtocolAmendmentRejectedEvent(event, state);
        break;
      case "ProtocolAmendmentSuperseded":
        validateProtocolAmendmentSupersededEvent(event, state);
        break;
      case "CapabilitySetDeclared":
        validateCapabilitySetDeclaredEvent(event, state);
        break;
      case "CompatibilityCheckRecorded":
        validateCompatibilityCheckRecordedEvent(event, state);
        break;
      case "CompatibilityFailureRecorded":
        validateCompatibilityFailureRecordedEvent(event, state);
        break;
      case "CompatibilityDegradationRecorded":
        validateCompatibilityDegradationRecordedEvent(event, state);
        break;
      case "CompatibilityAcceptanceRecorded":
        validateCompatibilityAcceptanceRecordedEvent(event, state);
        break;
      case "InteroperabilityProfileDeclared":
        validateInteroperabilityProfileDeclaredEvent(event, state);
        break;
      case "SemanticMappingRecorded":
        validateSemanticMappingRecordedEvent(event, state);
        break;
      case "InteroperabilityCheckRecorded":
        validateInteroperabilityCheckRecordedEvent(event, state);
        break;
      case "SemanticDegradationRecorded":
        validateSemanticDegradationRecordedEvent(event, state);
        break;
      case "InteroperabilityFailureRecorded":
        validateInteroperabilityFailureRecordedEvent(event, state);
        break;
      case "InteroperabilityAcceptanceRecorded":
        validateInteroperabilityAcceptanceRecordedEvent(event, state);
        break;
      case "FederationContextDeclared":
        validateFederationContextDeclaredEvent(event, state);
        break;
      case "FederationPeerRecorded":
        validateFederationPeerRecordedEvent(event, state);
        break;
      case "FederatedStateReferenceRecorded":
        validateFederatedStateReferenceRecordedEvent(event, state);
        break;
      case "FederatedPacketVerified":
        validateFederatedPacketVerifiedEvent(event, state);
        break;
      case "FederatedPacketRejected":
        validateFederatedPacketRejectedEvent(event, state);
        break;
      case "FederationBoundaryRecorded":
        validateFederationBoundaryRecordedEvent(event, state);
        break;
      case "NegotiationRequested":
        validateNegotiationRequestedEvent(event, state);
        break;
      case "NegotiationConstraintDeclared":
        validateNegotiationConstraintDeclaredEvent(event, state);
        break;
      case "NegotiationDifferenceRecorded":
        validateNegotiationDifferenceRecordedEvent(event, state);
        break;
      case "NegotiationTermsProposed":
        validateNegotiationTermsProposedEvent(event, state);
        break;
      case "NegotiationTermsAccepted":
        validateNegotiationTermsAcceptedEvent(event, state);
        break;
      case "NegotiationTermsRejected":
        validateNegotiationTermsRejectedEvent(event, state);
        break;
      case "NegotiationDegradationAccepted":
        validateNegotiationDegradationAcceptedEvent(event, state);
        break;
      case "NegotiationFailureRecorded":
        validateNegotiationFailureRecordedEvent(event, state);
        break;
      case "DelegationGranted":
        validateDelegationGrantedEvent(event, state);
        break;
      case "DelegatedActionRecorded":
        validateDelegatedActionRecordedEvent(event, state);
        break;
      case "DelegationRevoked":
        validateDelegationRevokedEvent(event, state);
        break;
      case "DelegationExpired":
        validateDelegationExpiredEvent(event, state);
        break;
      case "DelegationViolationRecorded":
        validateDelegationViolationRecordedEvent(event, state);
        break;
      case "ExecutionStarted":
        validateExecutionStartedEvent(event, state);
        break;
      case "ExecutionCompleted":
        validateExecutionCompletedEvent(event, state);
        break;
      case "ExecutionFailed":
        validateExecutionFailedEvent(event, state);
        break;
      case "ExecutionRolledBack":
        validateExecutionRolledBackEvent(event, state);
        break;
      case "ExecutionViolationRecorded":
        validateExecutionViolationRecordedEvent(event, state);
        break;
      case "OutcomeExpected":
        validateOutcomeExpectedEvent(event, state);
        break;
      case "OutcomeObserved":
        validateOutcomeObservedEvent(event, state);
        break;
      case "OutcomeEvaluated":
        validateOutcomeEvaluatedEvent(event, state);
        break;
      case "OutcomeDisputed":
        validateOutcomeDisputedEvent(event, state);
        break;
      case "OutcomeViolationRecorded":
        validateOutcomeViolationRecordedEvent(event, state);
        break;
      case "LearningSignalDerived":
        validateLearningSignalDerivedEvent(event, state);
        break;
      case "LessonRecorded":
        validateLessonRecordedEvent(event, state);
        break;
      case "LearningDisputed":
        validateLearningDisputedEvent(event, state);
        break;
      case "LearningViolationRecorded":
        validateLearningViolationRecordedEvent(event, state);
        break;
      case "ReviewRequired":
        validateReviewRequiredEvent(event, state);
        break;
      case "ReviewOpened":
        validateReviewOpenedEvent(event, state);
        break;
      case "ReviewCompleted":
        validateReviewCompletedEvent(event, state);
        break;
      case "ReviewDisputed":
        validateReviewDisputedEvent(event, state);
        break;
      case "ReviewViolationRecorded":
        validateReviewViolationRecordedEvent(event, state);
        break;
      case "RecoveryRequested":
        validateRecoveryRequestedEvent(event, state);
        break;
      case "RecoveryPlanCreated":
        validateRecoveryPlanCreatedEvent(event, state);
        break;
      case "RecoveryQuarantined":
        validateRecoveryQuarantinedEvent(event, state);
        break;
      case "RecoveryApplied":
        validateRecoveryAppliedEvent(event, state);
        break;
      case "RecoveryVerified":
        validateRecoveryVerifiedEvent(event, state);
        break;
      case "RecoveryViolationRecorded":
        validateRecoveryViolationRecordedEvent(event, state);
        break;
      case "ThreadCreated":
        validateThreadCreated(event, state);
        break;
      case "ThreadForked":
        validateThreadForked(event, index, state);
        break;
      case "EvidenceCommitted":
        validateEvidenceCommitted(event, state);
        break;
      case "AssumptionDeclared":
        validateAssumptionDeclared(event, state);
        break;
      case "ClaimCreated":
        validateClaimCreated(event, state);
        break;
      case "PositionTaken":
        validatePositionTaken(event, state);
        break;
      case "ObjectionRaised":
        validateObjectionRaised(event, state);
        break;
      case "ObjectionResolved":
        validateObjectionResolved(event, state);
        break;
      case "DecisionRequestOpened":
        validateDecisionRequestOpened(event, state);
        break;
      case "ReviewSubmitted":
        validateReviewSubmitted(event, state);
        break;
      case "DecisionMerged":
        validateDecisionMerged(event, state);
        break;
      case "ReviewTriggered":
        validateReviewTriggered(event, state);
        break;
      case "MinorityReportFiled":
        validateMinorityReportFiled(event, state);
        break;
      case "ExpectedOutcomeDeclared":
        validateExpectedOutcomeDeclared(event, state);
        break;
      case "OutcomeAudited":
        validateOutcomeAudited(event, state);
        break;
      case "DecisionScored":
        validateDecisionScored(event, state);
        break;
      case "MergeRequestOpened":
        validateMergeRequestOpened(event, state);
        break;
      case "MergeReviewSubmitted":
        validateMergeReviewSubmitted(event, state);
        break;
      case "MergeConflictDeclared":
        validateMergeConflictDeclared(event, state);
        break;
      case "MergeConflictResolved":
        validateMergeConflictResolved(event, state);
        break;
      case "MergeCompleted":
        validateMergeCompleted(event, state);
        break;
      case "AlignmentCalculated":
        break;
      default:
        addError(state, event, `unsupported event_type ${event.event_type}`);
        break;
    }

    state.events.push(event);
    if (event.event_id) {
      state.processedEventsById.set(event.event_id, event);
    }
  });

  validateFinalDecisionIntegrity(state);

  return {
    valid: state.errors.length === 0,
    errors: state.errors
  };
}

function assertValidEvents(events) {
  const result = validateEvents(events);
  if (!result.valid) {
    throw new ValidationError(result.errors);
  }
  return result;
}

function emptyValidationState(events = []) {
  return {
    errors: [],
    eventIds: new Set(),
    allEventIndexById: new Map(events.map((event, index) => [event?.event_id, index]).filter(([id]) => id)),
    processedEventsById: new Map(),
    participants: new Map(),
    identity: emptyIdentityState(),
    threads: new Map(),
    forks: new Map(),
    forkInheritedObjectIds: new Map(),
    evidence: new Map(),
    assumptions: new Map(),
    claims: new Map(),
    positions: new Map(),
    objections: new Map(),
    decisionRequests: new Map(),
    reviews: new Map(),
    reviewsByRequest: new Map(),
    decisionsByRequest: new Map(),
    decisionRecords: new Map(),
    decisionEventsByRecord: new Map(),
    minorityReports: [],
    mergeRequests: new Map(),
    mergeReviews: new Map(),
    mergeReviewsByRequest: new Map(),
    mergeConflicts: new Map(),
    mergeConflictsByRequest: new Map(),
    mergeConflictResolutions: new Map(),
    mergeConflictResolutionsByConflict: new Map(),
    mergeCompletions: new Map(),
    mergeCompletionsByRequest: new Map(),
    expectedOutcomes: new Map(),
    outcomeAudits: new Map(),
    decisionScores: new Map(),
    delegationGrants: new Map(),
    delegationActions: new Map(),
    delegationRevocations: new Map(),
    delegationExpirations: new Map(),
    delegationViolations: new Map(),
    delegationStatusByGrant: new Map(),
    executionStarts: new Map(),
    executionRecords: new Map(),
    executionCompletions: new Map(),
    executionFailures: new Map(),
    executionRollbacks: new Map(),
    executionViolations: new Map(),
    executionStatusById: new Map(),
    outcomeExpectations: new Map(),
    outcomeObservations: new Map(),
    outcomeEvaluations: new Map(),
    outcomeDisputes: new Map(),
    outcomeViolations: new Map(),
    outcomeStatusById: new Map(),
    outcomeLearningSignals: new Map(),
    outcomeLessons: new Map(),
    outcomeLearningDisputes: new Map(),
    outcomeLearningViolations: new Map(),
    protocolReviews: new Map(),
    protocolReviewCompletions: new Map(),
    protocolReviewDisputes: new Map(),
    protocolReviewViolations: new Map(),
    recoveryRequests: new Map(),
    recoveryPlans: new Map(),
    recoveryQuarantines: new Map(),
    recoveryApplications: new Map(),
    recoveryVerifications: new Map(),
    recoveryViolations: new Map(),
    recoveryEvents: [],
    lastContentHash: undefined,
    lastSequence: undefined,
    events: []
  };
}

function validateEnvelope(event, index, state) {
  if (!event || typeof event !== "object") {
    addError(state, { event_id: null, event_type: null }, `event at index ${index} is not an object`);
    return;
  }

  for (const field of ENVELOPE_FIELDS) {
    if (event[field] === undefined || event[field] === null || event[field] === "") {
      addError(state, event, `missing ${field}`);
    }
  }

  if (event.event_id) {
    if (state.eventIds.has(event.event_id)) {
      addError(state, event, `duplicate event_id ${event.event_id}`);
    }
    state.eventIds.add(event.event_id);
  }

  if (event.timestamp && Number.isNaN(Date.parse(event.timestamp))) {
    addError(state, event, `malformed timestamp ${event.timestamp}`);
  }

  if (event.payload && (typeof event.payload !== "object" || Array.isArray(event.payload))) {
    addError(state, event, "payload must be an object");
  }
}

function validateAuditIntegrity(event, index, state) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return;
  }

  if (event.protocol_version && event.protocol_version !== PROTOCOL_VERSION) {
    addError(state, event, `unsupported protocol_version ${event.protocol_version}`);
  }
  if (event.hash_version && event.hash_version !== EVENT_HASH_VERSION) {
    addError(state, event, `unsupported hash_version ${event.hash_version}`);
  }
  if (event.content_hash && !HASH_PATTERN.test(event.content_hash)) {
    addError(state, event, `malformed content_hash ${event.content_hash}`);
  }
  if (event.previous_hash && !HASH_PATTERN.test(event.previous_hash)) {
    addError(state, event, `malformed previous_hash ${event.previous_hash}`);
  }
  if (event.hash_version && !event.content_hash) {
    addError(state, event, "hash_version requires content_hash");
  }
  if (event.content_hash && (!event.hash_version || event.hash_version === EVENT_HASH_VERSION)) {
    const expectedHash = computeEventHash(event);
    if (event.content_hash !== expectedHash) {
      addError(state, event, "content_hash does not match canonical event serialization");
    }
  }

  if (event.previous_hash && event.previous_hash !== state.lastContentHash) {
    addError(state, event, "invalid previous_hash chain");
  }

  const sequence = event.sequence_number ?? event.sequence;
  if (sequence !== undefined) {
    if (typeof sequence !== "number" || !Number.isFinite(sequence)) {
      addError(state, event, "sequence number must be numeric");
    } else if (state.lastSequence !== undefined && sequence <= state.lastSequence) {
      addError(state, event, "events applied out of order by sequence number");
    } else {
      state.lastSequence = sequence;
    }
  }

  if (event.content_hash) {
    state.lastContentHash = event.content_hash;
  } else if (index === 0) {
    state.lastContentHash = undefined;
  }
}

function validateActor(event, state) {
  if (event.event_type === "ParticipantAdded") {
    return;
  }
  if (event.event_type === "ParticipantDeclared") {
    const participantId = event.payload?.participant?.id;
    if (event.actor_id && event.actor_id !== participantId && !state.participants.has(event.actor_id)) {
      addError(state, event, `actor_id ${event.actor_id} is not a declared participant`);
    }
    return;
  }
  if (event.actor_id && !state.participants.has(event.actor_id)) {
    addError(state, event, `actor_id ${event.actor_id} is not a known participant`);
  }
}

function validateParticipantAdded(event, state) {
  const participant = event.payload.participant;
  if (!participant?.id) {
    addError(state, event, "ParticipantAdded payload missing participant.id");
    return;
  }
  if (state.participants.has(participant.id)) {
    addError(state, event, `duplicate participant id ${participant.id}`);
  }
  state.participants.set(participant.id, participant);
  applyIdentityEvent(state.identity, event);
}

function validateParticipantDeclared(event, state) {
  const participant = event.payload.participant;
  if (!participant?.id) {
    addError(state, event, "ParticipantDeclared payload missing participant.id");
    return;
  }
  if (state.participants.has(participant.id)) {
    addError(state, event, `duplicate participant id ${participant.id}`);
  }
  state.participants.set(participant.id, participant);
  applyIdentityEvent(state.identity, event);
}

function validateParticipantRoleAssigned(event, state) {
  const role = event.payload.participantRole;
  if (!role?.participantId) {
    addError(state, event, "ParticipantRoleAssigned payload missing participantRole.participantId");
    return;
  }
  if (!state.participants.has(role.participantId)) {
    addError(state, event, `role assignment references unknown participant ${role.participantId}`);
  }
  if (!role.role) {
    addError(state, event, "participant role assignment requires role");
  }
  validateAuthorityScope(event, state, role.scope, role.threadId);
  applyIdentityEvent(state.identity, event);
}

function validateParticipantAuthorityGranted(event, state) {
  const authority = event.payload.participantAuthority;
  if (!authority?.participantId) {
    addError(state, event, "ParticipantAuthorityGranted payload missing participantAuthority.participantId");
    return;
  }
  if (!state.participants.has(authority.participantId)) {
    addError(state, event, `authority grant references unknown participant ${authority.participantId}`);
  }
  validateAuthorityName(event, state, authority.authority);
  validateAuthorityScope(event, state, authority.scope, authority.threadId);
  applyIdentityEvent(state.identity, event);
}

function validateParticipantAuthorityRevoked(event, state) {
  const revocation = event.payload.participantAuthorityRevocation;
  if (!revocation?.participantId) {
    addError(state, event, "ParticipantAuthorityRevoked payload missing participantAuthorityRevocation.participantId");
    return;
  }
  if (!state.participants.has(revocation.participantId)) {
    addError(state, event, `authority revocation references unknown participant ${revocation.participantId}`);
  }
  validateAuthorityName(event, state, revocation.authority);
  validateAuthorityScope(event, state, revocation.scope, revocation.threadId);
  if (!participantHasAuthority(state.identity, revocation.participantId, revocation.authority, revocation.threadId)) {
    addError(state, event, `authority revocation references inactive authority ${revocation.authority} for ${revocation.participantId}`);
  }
  applyIdentityEvent(state.identity, event);
}

function validateContributionAttributed(event, index, state) {
  const attribution = event.payload.contributionAttribution;
  if (!attribution) {
    addError(state, event, "ContributionAttributed payload missing contributionAttribution");
    return;
  }
  if (attribution.participantId && !state.participants.has(attribution.participantId)) {
    addError(state, event, `attribution references unknown participant ${attribution.participantId}`);
  }
  validateAttributionSourceBoundary(event, state, attribution.sourceEventId || attribution.eventId, index);
  for (const reason of validateContributionAttribution(attribution, state.events)) {
    addError(state, event, reason);
  }
  for (const reason of validateContributionProvenance(attribution, state.events)) {
    addError(state, event, reason);
  }
}

function validateContributionAttributionCorrected(event, state) {
  const correction = event.payload.attributionCorrection;
  if (!correction) {
    addError(state, event, "ContributionAttributionCorrected payload missing attributionCorrection");
    return;
  }
  if (!state.participants.has(correction.correctedBy || event.actor_id)) {
    addError(state, event, `attribution correction references unknown participant ${correction.correctedBy || event.actor_id}`);
  }
  for (const reason of validateAttributionCorrection(correction, state.events)) {
    addError(state, event, reason);
  }
}

function validateContributionAttributionDisputed(event, state) {
  const dispute = event.payload.attributionDispute;
  if (!dispute) {
    addError(state, event, "ContributionAttributionDisputed payload missing attributionDispute");
    return;
  }
  if (!state.participants.has(dispute.disputedBy || event.actor_id)) {
    addError(state, event, `attribution dispute references unknown participant ${dispute.disputedBy || event.actor_id}`);
  }
  for (const reason of validateAttributionDispute(dispute, state.events)) {
    addError(state, event, reason);
  }
}

function validateContributionAttributionRevoked(event, state) {
  const revocation = event.payload.attributionRevocation;
  if (!revocation) {
    addError(state, event, "ContributionAttributionRevoked payload missing attributionRevocation");
    return;
  }
  const revokedBy = revocation.revokedBy || event.actor_id;
  if (!state.participants.has(revokedBy)) {
    addError(state, event, `attribution revocation references unknown participant ${revokedBy}`);
  }
  if (!isDecisionOwner(revokedBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `attribution revocation requires decision_owner authority ${revokedBy}`);
  }
  for (const reason of validateAttributionRevocation(revocation, state.events)) {
    addError(state, event, reason);
  }
}

function validateLearningSignalRecorded(event, state) {
  const signal = event.payload.learningSignal;
  if (!signal) {
    addError(state, event, "LearningSignalRecorded payload missing learningSignal");
    return;
  }
  for (const reason of validateLearningSignal(signal, state.events)) {
    addError(state, event, reason);
  }
}

function validatePatternObservationRecorded(event, state) {
  const observation = event.payload.patternObservation;
  if (!observation) {
    addError(state, event, "PatternObservationRecorded payload missing patternObservation");
    return;
  }
  for (const reason of validatePatternObservation(observation, state.events)) {
    addError(state, event, reason);
  }
}

function validateOutcomeReviewRecorded(event, state) {
  const review = event.payload.outcomeReview;
  if (!review) {
    addError(state, event, "OutcomeReviewRecorded payload missing outcomeReview");
    return;
  }
  for (const reason of validateOutcomeReview(review, state.events)) {
    addError(state, event, reason);
  }
}

function validateLearningRecommendationRecorded(event, state) {
  const recommendation = event.payload.learningRecommendation;
  if (!recommendation) {
    addError(state, event, "LearningRecommendationRecorded payload missing learningRecommendation");
    return;
  }
  for (const reason of validateLearningRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

function validateAdaptationReviewRecorded(event, state) {
  const review = event.payload.adaptationReview;
  if (!review) {
    addError(state, event, "AdaptationReviewRecorded payload missing adaptationReview");
    return;
  }
  for (const reason of validateAdaptationReview(review, state.events)) {
    addError(state, event, reason);
  }
}

function validateGovernanceReviewRecommendedEvent(event, state) {
  const recommendation = event.payload.governanceReviewRecommendation;
  if (!recommendation) {
    addError(state, event, "GovernanceReviewRecommended payload missing governanceReviewRecommendation");
    return;
  }
  for (const reason of validateGovernanceReviewRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

function validateEvidenceRequirementReviewRecommendedEvent(event, state) {
  const recommendation = event.payload.evidenceRequirementReviewRecommendation;
  if (!recommendation) {
    addError(state, event, "EvidenceRequirementReviewRecommended payload missing evidenceRequirementReviewRecommendation");
    return;
  }
  for (const reason of validateEvidenceRequirementReviewRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

function validateRevisitTriggerReviewRecommendedEvent(event, state) {
  const recommendation = event.payload.revisitTriggerReviewRecommendation;
  if (!recommendation) {
    addError(state, event, "RevisitTriggerReviewRecommended payload missing revisitTriggerReviewRecommendation");
    return;
  }
  for (const reason of validateRevisitTriggerReviewRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

function validateDecisionGateReviewRecommendedEvent(event, state) {
  const recommendation = event.payload.decisionGateReviewRecommendation;
  if (!recommendation) {
    addError(state, event, "DecisionGateReviewRecommended payload missing decisionGateReviewRecommendation");
    return;
  }
  for (const reason of validateDecisionGateReviewRecommendation(recommendation, state.events)) {
    addError(state, event, reason);
  }
}

function validateProtocolAmendmentProposed(event, state) {
  const amendment = event.payload.protocolAmendment || event.payload.amendment;
  if (!amendment) {
    addError(state, event, "ProtocolAmendmentProposed payload missing protocolAmendment");
    return;
  }
  for (const reason of validateProtocolAmendment(amendment, state.events)) {
    addError(state, event, reason);
  }
}

function validateProtocolAmendmentReviewed(event, state) {
  const review = event.payload.protocolAmendmentReview || event.payload.amendmentReview;
  if (!review) {
    addError(state, event, "ProtocolAmendmentReviewed payload missing protocolAmendmentReview");
    return;
  }
  for (const reason of validateProtocolAmendmentReview(review, state.events)) {
    addError(state, event, reason);
  }
}

function validateProtocolAmendmentApprovedEvent(event, state) {
  const approval = event.payload.protocolAmendmentApproval || event.payload.amendmentApproval;
  if (!approval) {
    addError(state, event, "ProtocolAmendmentApproved payload missing protocolAmendmentApproval");
    return;
  }
  for (const reason of validateProtocolAmendmentApproval(approval, state.events)) {
    addError(state, event, reason);
  }
  const approvedBy = approval.approvedBy || event.actor_id;
  if (!isDecisionOwner(approvedBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `protocol amendment approval requires decision_owner authority ${approvedBy}`);
  }
}

function validateProtocolAmendmentRejectedEvent(event, state) {
  const rejection = event.payload.protocolAmendmentRejection || event.payload.amendmentRejection;
  if (!rejection) {
    addError(state, event, "ProtocolAmendmentRejected payload missing protocolAmendmentRejection");
    return;
  }
  for (const reason of validateProtocolAmendmentRejection(rejection, state.events)) {
    addError(state, event, reason);
  }
  const rejectedBy = rejection.rejectedBy || event.actor_id;
  if (!isDecisionOwner(rejectedBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `protocol amendment rejection requires decision_owner authority ${rejectedBy}`);
  }
}

function validateProtocolAmendmentSupersededEvent(event, state) {
  const supersession = event.payload.protocolAmendmentSupersession || event.payload.amendmentSupersession;
  if (!supersession) {
    addError(state, event, "ProtocolAmendmentSuperseded payload missing protocolAmendmentSupersession");
    return;
  }
  for (const reason of validateProtocolAmendmentSupersession(supersession, state.events)) {
    addError(state, event, reason);
  }
  const supersededBy = supersession.supersededBy || event.actor_id;
  if (!isDecisionOwner(supersededBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `protocol amendment supersession requires decision_owner authority ${supersededBy}`);
  }
}

function validateCapabilitySetDeclaredEvent(event, state) {
  const declaration = event.payload.capabilitySetDeclaration || event.payload.capabilitySet;
  if (!declaration) {
    addError(state, event, "CapabilitySetDeclared payload missing capabilitySetDeclaration");
    return;
  }
  for (const reason of validateCapabilitySetDeclaration(declaration, state.events)) {
    addError(state, event, reason);
  }
}

function validateCompatibilityCheckRecordedEvent(event, state) {
  const check = event.payload.compatibilityCheck;
  if (!check) {
    addError(state, event, "CompatibilityCheckRecorded payload missing compatibilityCheck");
    return;
  }
  for (const reason of validateCompatibilityCheck(check, state.events)) {
    addError(state, event, reason);
  }
}

function validateCompatibilityFailureRecordedEvent(event, state) {
  const failure = event.payload.compatibilityFailure;
  if (!failure) {
    addError(state, event, "CompatibilityFailureRecorded payload missing compatibilityFailure");
    return;
  }
  for (const reason of validateCompatibilityFailure(failure, state.events)) {
    addError(state, event, reason);
  }
}

function validateCompatibilityDegradationRecordedEvent(event, state) {
  const degradation = event.payload.compatibilityDegradation;
  if (!degradation) {
    addError(state, event, "CompatibilityDegradationRecorded payload missing compatibilityDegradation");
    return;
  }
  for (const reason of validateCompatibilityDegradation(degradation, state.events)) {
    addError(state, event, reason);
  }
}

function validateCompatibilityAcceptanceRecordedEvent(event, state) {
  const acceptance = event.payload.compatibilityAcceptance;
  if (!acceptance) {
    addError(state, event, "CompatibilityAcceptanceRecorded payload missing compatibilityAcceptance");
    return;
  }
  for (const reason of validateCompatibilityAcceptance(acceptance, state.events)) {
    addError(state, event, reason);
  }
}

function validateInteroperabilityProfileDeclaredEvent(event, state) {
  const profile = event.payload.interoperabilityProfile;
  if (!profile) {
    addError(state, event, "InteroperabilityProfileDeclared payload missing interoperabilityProfile");
    return;
  }
  for (const reason of validateInteroperabilityProfile(profile, state.events)) {
    addError(state, event, reason);
  }
}

function validateSemanticMappingRecordedEvent(event, state) {
  const mapping = event.payload.semanticMapping;
  if (!mapping) {
    addError(state, event, "SemanticMappingRecorded payload missing semanticMapping");
    return;
  }
  for (const reason of validateSemanticMapping(mapping, state.events)) {
    addError(state, event, reason);
  }
}

function validateInteroperabilityCheckRecordedEvent(event, state) {
  const check = event.payload.interoperabilityCheck;
  if (!check) {
    addError(state, event, "InteroperabilityCheckRecorded payload missing interoperabilityCheck");
    return;
  }
  for (const reason of validateInteroperabilityCheck(check, state.events)) {
    addError(state, event, reason);
  }
}

function validateSemanticDegradationRecordedEvent(event, state) {
  const degradation = event.payload.semanticDegradation;
  if (!degradation) {
    addError(state, event, "SemanticDegradationRecorded payload missing semanticDegradation");
    return;
  }
  for (const reason of validateSemanticDegradation(degradation, state.events)) {
    addError(state, event, reason);
  }
}

function validateInteroperabilityFailureRecordedEvent(event, state) {
  const failure = event.payload.interoperabilityFailure;
  if (!failure) {
    addError(state, event, "InteroperabilityFailureRecorded payload missing interoperabilityFailure");
    return;
  }
  for (const reason of validateInteroperabilityFailure(failure, state.events)) {
    addError(state, event, reason);
  }
}

function validateInteroperabilityAcceptanceRecordedEvent(event, state) {
  const acceptance = event.payload.interoperabilityAcceptance;
  if (!acceptance) {
    addError(state, event, "InteroperabilityAcceptanceRecorded payload missing interoperabilityAcceptance");
    return;
  }
  for (const reason of validateInteroperabilityAcceptance(acceptance, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederationContextDeclaredEvent(event, state) {
  const context = event.payload.federationContext;
  if (!context) {
    addError(state, event, "FederationContextDeclared payload missing federationContext");
    return;
  }
  for (const reason of validateFederationContext(context, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederationPeerRecordedEvent(event, state) {
  const peer = event.payload.federationPeer;
  if (!peer) {
    addError(state, event, "FederationPeerRecorded payload missing federationPeer");
    return;
  }
  for (const reason of validateFederationPeer(peer, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederatedStateReferenceRecordedEvent(event, state) {
  const reference = event.payload.federatedStateReference;
  if (!reference) {
    addError(state, event, "FederatedStateReferenceRecorded payload missing federatedStateReference");
    return;
  }
  for (const reason of validateFederatedStateReference(reference, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederatedPacketVerifiedEvent(event, state) {
  const verification = event.payload.federatedPacketVerification;
  if (!verification) {
    addError(state, event, "FederatedPacketVerified payload missing federatedPacketVerification");
    return;
  }
  for (const reason of validateFederatedPacketVerification(verification, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederatedPacketRejectedEvent(event, state) {
  const rejection = event.payload.federatedPacketRejection;
  if (!rejection) {
    addError(state, event, "FederatedPacketRejected payload missing federatedPacketRejection");
    return;
  }
  for (const reason of validateFederatedPacketRejection(rejection, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederationBoundaryRecordedEvent(event, state) {
  const boundary = event.payload.federationBoundary;
  if (!boundary) {
    addError(state, event, "FederationBoundaryRecorded payload missing federationBoundary");
    return;
  }
  for (const reason of validateFederationBoundary(boundary, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationRequestedEvent(event, state) {
  const request = event.payload.negotiationRequest;
  if (!request) {
    addError(state, event, "NegotiationRequested payload missing negotiationRequest");
    return;
  }
  for (const reason of validateNegotiationRequest(request, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationConstraintDeclaredEvent(event, state) {
  const constraint = event.payload.negotiationConstraint;
  if (!constraint) {
    addError(state, event, "NegotiationConstraintDeclared payload missing negotiationConstraint");
    return;
  }
  for (const reason of validateNegotiationConstraint(constraint, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationDifferenceRecordedEvent(event, state) {
  const difference = event.payload.negotiationDifference;
  if (!difference) {
    addError(state, event, "NegotiationDifferenceRecorded payload missing negotiationDifference");
    return;
  }
  for (const reason of validateNegotiationDifference(difference, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationTermsProposedEvent(event, state) {
  const terms = event.payload.negotiationTerms;
  if (!terms) {
    addError(state, event, "NegotiationTermsProposed payload missing negotiationTerms");
    return;
  }
  for (const reason of validateNegotiationTermsProposed(terms, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationTermsAcceptedEvent(event, state) {
  const terms = event.payload.negotiationTerms;
  if (!terms) {
    addError(state, event, "NegotiationTermsAccepted payload missing negotiationTerms");
    return;
  }
  for (const reason of validateNegotiationTermsAccepted(terms, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationTermsRejectedEvent(event, state) {
  const terms = event.payload.negotiationTerms;
  if (!terms) {
    addError(state, event, "NegotiationTermsRejected payload missing negotiationTerms");
    return;
  }
  for (const reason of validateNegotiationTermsRejected(terms, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationDegradationAcceptedEvent(event, state) {
  const terms = event.payload.negotiationTerms;
  if (!terms) {
    addError(state, event, "NegotiationDegradationAccepted payload missing negotiationTerms");
    return;
  }
  for (const reason of validateNegotiationDegradationAccepted(terms, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationFailureRecordedEvent(event, state) {
  const failure = event.payload.negotiationFailure;
  if (!failure) {
    addError(state, event, "NegotiationFailureRecorded payload missing negotiationFailure");
    return;
  }
  for (const reason of validateNegotiationFailure(failure, state.events)) {
    addError(state, event, reason);
  }
}

function validateDelegationGrantedEvent(event, state) {
  const grant = event.payload.delegationGrant;
  if (!grant) {
    addError(state, event, "DelegationGranted payload missing delegationGrant");
    return;
  }
  for (const reason of validateDelegationGrant(grant, state.events)) {
    addError(state, event, reason);
  }
  if (grant.id && state.delegationGrants.has(grant.id)) {
    addError(state, event, `duplicate delegation grant ${grant.id}`);
  }
  validateThreadObject(event, grant, state, "delegation grant");
  if (grant.delegatorParticipantId && !state.participants.has(grant.delegatorParticipantId)) {
    addError(state, event, `delegation grant references unknown delegator ${grant.delegatorParticipantId}`);
  }
  validateDelegationDelegateActor(event, state, grant.delegateId, grant.delegateType, "grant");
  if (grant.delegatorParticipantId && event.actor_id !== grant.delegatorParticipantId) {
    addError(state, event, "delegation grant actor must be the delegator");
  }
  const requiredAuthority = normalizeDelegationText(grant.authorityRequired || "decision_owner");
  if (
    grant.delegatorParticipantId
    && !participantHasAuthority(state.identity, grant.delegatorParticipantId, requiredAuthority, grant.threadId)
  ) {
    addError(state, event, `delegation grant requires ${requiredAuthority} authority ${grant.delegatorParticipantId}`);
  }
  if (grant.id) {
    state.delegationGrants.set(grant.id, grant);
    state.delegationStatusByGrant.set(grant.id, "active");
  }
}

function validateDelegatedActionRecordedEvent(event, state) {
  const action = event.payload.delegatedAction;
  if (!action) {
    addError(state, event, "DelegatedActionRecorded payload missing delegatedAction");
    return;
  }
  for (const reason of validateDelegatedAction(action, state.events)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, action, state, "delegated action");
  const grant = action.delegationId ? state.delegationGrants.get(action.delegationId) : null;
  if (!grant) {
    addError(state, event, `delegated action references unknown delegation ${action.delegationId}`);
  } else {
    validateDelegatedActionAgainstGrant(event, state, action, grant);
  }
  if (action.id) {
    state.delegationActions.set(action.id, action);
  }
}

function validateDelegationRevokedEvent(event, state) {
  const revocation = event.payload.delegationRevocation;
  if (!revocation) {
    addError(state, event, "DelegationRevoked payload missing delegationRevocation");
    return;
  }
  for (const reason of validateDelegationRevocation(revocation, state.events)) {
    addError(state, event, reason);
  }
  const grant = revocation.delegationId ? state.delegationGrants.get(revocation.delegationId) : null;
  if (!grant) {
    addError(state, event, `delegation revocation references unknown delegation ${revocation.delegationId}`);
  } else {
    validateDelegationControlActor(event, state, revocation.revokedByParticipantId, grant, "revocation");
    if (state.delegationStatusByGrant.get(grant.id) !== "active") {
      addError(state, event, `delegation revocation references inactive delegation ${grant.id}`);
    }
    state.delegationStatusByGrant.set(grant.id, "revoked");
  }
  if (revocation.id) {
    state.delegationRevocations.set(revocation.id, revocation);
  }
}

function validateDelegationExpiredEvent(event, state) {
  const expiration = event.payload.delegationExpiration;
  if (!expiration) {
    addError(state, event, "DelegationExpired payload missing delegationExpiration");
    return;
  }
  for (const reason of validateDelegationExpiration(expiration, state.events)) {
    addError(state, event, reason);
  }
  const grant = expiration.delegationId ? state.delegationGrants.get(expiration.delegationId) : null;
  if (!grant) {
    addError(state, event, `delegation expiration references unknown delegation ${expiration.delegationId}`);
  } else {
    if (state.delegationStatusByGrant.get(grant.id) !== "active") {
      addError(state, event, `delegation expiration references inactive delegation ${grant.id}`);
    }
    state.delegationStatusByGrant.set(grant.id, "expired");
  }
  if (expiration.id) {
    state.delegationExpirations.set(expiration.id, expiration);
  }
}

function validateDelegationViolationRecordedEvent(event, state) {
  const violation = event.payload.delegationViolation;
  if (!violation) {
    addError(state, event, "DelegationViolationRecorded payload missing delegationViolation");
    return;
  }
  for (const reason of validateDelegationViolation(violation, state.events)) {
    addError(state, event, reason);
  }
  const grant = violation.delegationId ? state.delegationGrants.get(violation.delegationId) : null;
  if (!grant) {
    addError(state, event, `delegation violation references unknown delegation ${violation.delegationId}`);
  } else {
    validateDelegationControlActor(event, state, violation.detectedByParticipantId || event.actor_id, grant, "violation");
    state.delegationStatusByGrant.set(grant.id, "violated");
  }
  if (violation.actionId && !state.delegationActions.has(violation.actionId)) {
    addError(state, event, `delegation violation references unknown action ${violation.actionId}`);
  }
  if (violation.id) {
    state.delegationViolations.set(violation.id, violation);
  }
}

function validateExecutionStartedEvent(event, state) {
  const record = event.payload.executionRecord;
  if (!record) {
    addError(state, event, "ExecutionStarted payload missing executionRecord");
    return;
  }
  for (const reason of validateExecutionStart(record)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, record, state, "execution record");
  validateExecutionActor(event, state, record);
  if (record.id && state.executionStarts.has(record.id)) {
    addError(state, event, `duplicate execution start ${record.id}`);
  }
  validateExecutionAuthorization(event, state, record);
  if (record.id) {
    state.executionStarts.set(record.id, record);
    state.executionRecords.set(record.id, record);
    state.executionStatusById.set(record.id, "active");
  }
}

function validateExecutionCompletedEvent(event, state) {
  const record = event.payload.executionRecord;
  if (!record) {
    addError(state, event, "ExecutionCompleted payload missing executionRecord");
    return;
  }
  for (const reason of validateExecutionCompletion(record)) {
    addError(state, event, reason);
  }
  validateExecutionTransition(event, state, record, "completion");
  if (record.id) {
    state.executionCompletions.set(record.id, record);
    state.executionStatusById.set(record.id, "completed");
  }
}

function validateExecutionFailedEvent(event, state) {
  const record = event.payload.executionRecord;
  if (!record) {
    addError(state, event, "ExecutionFailed payload missing executionRecord");
    return;
  }
  for (const reason of validateExecutionFailure(record)) {
    addError(state, event, reason);
  }
  validateExecutionTransition(event, state, record, "failure");
  if (record.id) {
    state.executionFailures.set(record.id, record);
    state.executionStatusById.set(record.id, "failed");
  }
}

function validateExecutionRolledBackEvent(event, state) {
  const record = event.payload.executionRecord;
  if (!record) {
    addError(state, event, "ExecutionRolledBack payload missing executionRecord");
    return;
  }
  for (const reason of validateExecutionRollback(record)) {
    addError(state, event, reason);
  }
  validateExecutionTransition(event, state, record, "rollback", {
    allowedStatuses: new Set(["completed", "failed"])
  });
  if (record.id) {
    state.executionRollbacks.set(record.id, record);
    state.executionStatusById.set(record.id, "rolled_back");
  }
}

function validateExecutionViolationRecordedEvent(event, state) {
  const violation = event.payload.executionViolation;
  if (!violation) {
    addError(state, event, "ExecutionViolationRecorded payload missing executionViolation");
    return;
  }
  for (const reason of validateExecutionViolation(violation)) {
    addError(state, event, reason);
  }
  if (violation.threadId !== event.thread_id) {
    addError(state, event, "execution violation threadId must match event thread_id");
  }
  const prior = violation.executionId ? state.executionRecords.get(violation.executionId) : null;
  if (!prior) {
    addError(state, event, `execution violation references unknown execution ${violation.executionId}`);
  } else if (prior.threadId !== violation.threadId) {
    addError(state, event, "execution violation threadId must match execution record");
  }
  const detector = violation.detectedByParticipantId || event.actor_id;
  if (!state.participants.has(detector)) {
    addError(state, event, `execution violation references unknown participant ${detector}`);
  }
  if (event.actor_id !== detector) {
    addError(state, event, "execution violation actor_id must match detectedByParticipantId");
  }
  if (violation.id && state.executionViolations.has(violation.id)) {
    addError(state, event, `duplicate execution violation ${violation.id}`);
  }
  if (violation.id) {
    state.executionViolations.set(violation.id, violation);
  }
  if (violation.executionId) {
    state.executionStatusById.set(violation.executionId, "violated");
  }
}

function validateOutcomeExpectedEvent(event, state) {
  const record = event.payload.outcomeRecord;
  if (!record) {
    addError(state, event, "OutcomeExpected payload missing outcomeRecord");
    return;
  }
  for (const reason of validateOutcomeExpectation(record)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, record, state, "outcome expectation");
  validateOutcomeActor(event, state, record, "expectation");
  validateOutcomeExecutionReference(event, state, record, "expectation");
  const executionStatus = state.executionStatusById.get(record.executionId);
  if (executionStatus && executionStatus !== "active") {
    addError(state, event, "expected outcome must be declared before execution completion");
  }
  if (record.id && state.outcomeExpectations.has(record.id)) {
    addError(state, event, `duplicate outcome expectation ${record.id}`);
  }
  if (record.id) {
    state.outcomeExpectations.set(record.id, record);
    state.outcomeStatusById.set(record.id, "pending");
  }
}

function validateOutcomeObservedEvent(event, state) {
  const record = event.payload.outcomeRecord;
  if (!record) {
    addError(state, event, "OutcomeObserved payload missing outcomeRecord");
    return;
  }
  for (const reason of validateOutcomeObservation(record)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, record, state, "outcome observation");
  validateOutcomeActor(event, state, record, "observation");
  validateOutcomeExecutionReference(event, state, record, "observation");
  const expectation = validateOutcomeReferencesExpectation(event, state, record, "observation");
  if (expectation) {
    validateOutcomeRecordMatchesExpectation(event, state, record, expectation, "observation");
  }
  const status = state.outcomeStatusById.get(record.id);
  if (status && status !== "pending") {
    addError(state, event, `outcome observation references ${status} outcome ${record.id}`);
  }
  if (record.id) {
    state.outcomeObservations.set(record.id, record);
    state.outcomeStatusById.set(record.id, "observed");
  }
}

function validateOutcomeEvaluatedEvent(event, state) {
  const record = event.payload.outcomeRecord;
  if (!record) {
    addError(state, event, "OutcomeEvaluated payload missing outcomeRecord");
    return;
  }
  for (const reason of validateOutcomeEvaluation(record)) {
    addError(state, event, reason);
  }
  validateThreadObject(event, record, state, "outcome evaluation");
  validateOutcomeActor(event, state, record, "evaluation");
  if (record.evaluatedByParticipantId && event.actor_id !== record.evaluatedByParticipantId) {
    addError(state, event, "outcome evaluation actor_id must match evaluatedByParticipantId");
  }
  validateOutcomeExecutionReference(event, state, record, "evaluation");
  const expectation = validateOutcomeReferencesExpectation(event, state, record, "evaluation");
  if (expectation) {
    validateOutcomeRecordMatchesExpectation(event, state, record, expectation, "evaluation");
  }
  if (!state.outcomeObservations.has(record.id)) {
    addError(state, event, `outcome evaluation requires observed outcome ${record.id}`);
  }
  const executionStatus = state.executionStatusById.get(record.executionId);
  if (executionStatus !== "completed") {
    addError(state, event, `outcome evaluation requires completed execution ${record.executionId}`);
  }
  const status = state.outcomeStatusById.get(record.id);
  if (status && status !== "observed") {
    addError(state, event, `outcome evaluation references ${status} outcome ${record.id}`);
  }
  if (record.id) {
    state.outcomeEvaluations.set(record.id, record);
    state.outcomeStatusById.set(record.id, "evaluated");
  }
}

function validateOutcomeDisputedEvent(event, state) {
  const dispute = event.payload.outcomeDispute;
  if (!dispute) {
    addError(state, event, "OutcomeDisputed payload missing outcomeDispute");
    return;
  }
  for (const reason of validateOutcomeDispute(dispute)) {
    addError(state, event, reason);
  }
  validateOutcomeThread(event, state, dispute, "dispute");
  const expectation = state.outcomeExpectations.get(dispute.outcomeId);
  if (!expectation) {
    addError(state, event, `outcome dispute references unknown outcome ${dispute.outcomeId}`);
  } else {
    validateOutcomeSideRecordMatchesExpectation(event, state, dispute, expectation, "dispute");
  }
  validateOutcomeParticipant(event, state, dispute.disputedByParticipantId, "dispute");
  if (event.actor_id !== dispute.disputedByParticipantId) {
    addError(state, event, "outcome dispute actor_id must match disputedByParticipantId");
  }
  if (dispute.id && state.outcomeDisputes.has(dispute.id)) {
    addError(state, event, `duplicate outcome dispute ${dispute.id}`);
  }
  if (dispute.id) {
    state.outcomeDisputes.set(dispute.id, dispute);
  }
  if (dispute.outcomeId) {
    state.outcomeStatusById.set(dispute.outcomeId, "disputed");
  }
}

function validateOutcomeViolationRecordedEvent(event, state) {
  const violation = event.payload.outcomeViolation;
  if (!violation) {
    addError(state, event, "OutcomeViolationRecorded payload missing outcomeViolation");
    return;
  }
  for (const reason of validateOutcomeViolation(violation)) {
    addError(state, event, reason);
  }
  validateOutcomeThread(event, state, violation, "violation");
  const expectation = state.outcomeExpectations.get(violation.outcomeId);
  if (!expectation) {
    addError(state, event, `outcome violation references unknown outcome ${violation.outcomeId}`);
  } else {
    validateOutcomeSideRecordMatchesExpectation(event, state, violation, expectation, "violation");
  }
  validateOutcomeParticipant(event, state, violation.detectedByParticipantId, "violation");
  if (event.actor_id !== violation.detectedByParticipantId) {
    addError(state, event, "outcome violation actor_id must match detectedByParticipantId");
  }
  if (violation.id && state.outcomeViolations.has(violation.id)) {
    addError(state, event, `duplicate outcome violation ${violation.id}`);
  }
  if (violation.id) {
    state.outcomeViolations.set(violation.id, violation);
  }
  if (violation.outcomeId) {
    state.outcomeStatusById.set(violation.outcomeId, "violated");
  }
}

function validateLearningSignalDerivedEvent(event, state) {
  const signal = event.payload.outcomeLearningSignal;
  if (!signal) {
    addError(state, event, "LearningSignalDerived payload missing outcomeLearningSignal");
    return;
  }
  for (const reason of validateOutcomeLearningSignal(signal)) {
    addError(state, event, reason);
  }
  validateOutcomeLearningReferences(event, state, signal, "signal", signal.derivedByParticipantId);
  validateIdsExist(event, state, signal.confirmedAssumptionIds, state.assumptions, "confirmed assumption");
  validateIdsExist(event, state, signal.failedAssumptionIds, state.assumptions, "failed assumption");
  if (signal.id && state.outcomeLearningSignals.has(signal.id)) {
    addError(state, event, `duplicate outcome learning signal ${signal.id}`);
  }
  if (signal.id) {
    state.outcomeLearningSignals.set(signal.id, signal);
  }
}

function validateLessonRecordedEvent(event, state) {
  const lesson = event.payload.outcomeLesson;
  if (!lesson) {
    addError(state, event, "LessonRecorded payload missing outcomeLesson");
    return;
  }
  for (const reason of validateOutcomeLesson(lesson)) {
    addError(state, event, reason);
  }
  validateOutcomeLearningReferences(event, state, lesson, "lesson", lesson.recordedByParticipantId);
  const signal = lesson.learningSignalId ? state.outcomeLearningSignals.get(lesson.learningSignalId) : null;
  if (!signal) {
    addError(state, event, `outcome lesson references unknown learning signal ${lesson.learningSignalId}`);
  } else {
    validateOutcomeLearningMatchesTarget(state, event, lesson, signal, "lesson", "learning signal");
  }
  if (lesson.id && state.outcomeLessons.has(lesson.id)) {
    addError(state, event, `duplicate outcome lesson ${lesson.id}`);
  }
  if (lesson.id) {
    state.outcomeLessons.set(lesson.id, lesson);
  }
}

function validateLearningDisputedEvent(event, state) {
  const dispute = event.payload.outcomeLearningDispute;
  if (!dispute) {
    addError(state, event, "LearningDisputed payload missing outcomeLearningDispute");
    return;
  }
  for (const reason of validateOutcomeLearningDispute(dispute)) {
    addError(state, event, reason);
  }
  validateOutcomeLearningReferences(event, state, dispute, "dispute", dispute.disputedByParticipantId);
  validateOutcomeLearningTarget(event, state, dispute, "dispute");
  if (dispute.id && state.outcomeLearningDisputes.has(dispute.id)) {
    addError(state, event, `duplicate outcome learning dispute ${dispute.id}`);
  }
  if (dispute.id) {
    state.outcomeLearningDisputes.set(dispute.id, dispute);
  }
}

function validateLearningViolationRecordedEvent(event, state) {
  const violation = event.payload.outcomeLearningViolation;
  if (!violation) {
    addError(state, event, "LearningViolationRecorded payload missing outcomeLearningViolation");
    return;
  }
  for (const reason of validateOutcomeLearningViolation(violation)) {
    addError(state, event, reason);
  }
  validateOutcomeLearningReferences(event, state, violation, "violation", violation.detectedByParticipantId);
  validateOutcomeLearningTarget(event, state, violation, "violation");
  if (violation.id && state.outcomeLearningViolations.has(violation.id)) {
    addError(state, event, `duplicate outcome learning violation ${violation.id}`);
  }
  if (violation.id) {
    state.outcomeLearningViolations.set(violation.id, violation);
  }
}

function validateReviewRequiredEvent(event, state) {
  const review = event.payload.protocolReview;
  if (!review) {
    addError(state, event, "ReviewRequired payload missing protocolReview");
    return;
  }
  for (const reason of validateProtocolReview(review)) {
    addError(state, event, reason);
  }
  if (review.required !== true) {
    addError(state, event, "ReviewRequired requires protocolReview.required true");
  }
  if (review.status !== "required") {
    addError(state, event, "ReviewRequired protocolReview status must be required");
  }
  validateReviewThread(event, state, review, "required review");
  validateReviewParticipant(event, state, review.requiredByParticipantId, "required review");
  if (event.actor_id !== review.requiredByParticipantId) {
    addError(state, event, "required review actor_id must match requiredByParticipantId");
  }
  validateReviewSubject(event, state, review);
  validateReviewTriggerEvent(event, state, review);
  if (review.id && state.protocolReviews.has(review.id)) {
    addError(state, event, `duplicate protocol review ${review.id}`);
  }
  if (review.id) {
    state.protocolReviews.set(review.id, {
      ...review,
      status: "required"
    });
  }
}

function validateReviewOpenedEvent(event, state) {
  const review = event.payload.protocolReview;
  if (!review) {
    addError(state, event, "ReviewOpened payload missing protocolReview");
    return;
  }
  for (const reason of validateProtocolReview(review)) {
    addError(state, event, reason);
  }
  if (review.status !== "open") {
    addError(state, event, "ReviewOpened protocolReview status must be open");
  }
  validateReviewThread(event, state, review, "opened review");
  validateReviewParticipant(event, state, review.openedByParticipantId, "opened review");
  if (event.actor_id !== review.openedByParticipantId) {
    addError(state, event, "opened review actor_id must match openedByParticipantId");
  }
  validateReviewSubject(event, state, review);
  validateReviewTriggerEvent(event, state, review);
  if (review.requiredReviewId) {
    const required = state.protocolReviews.get(review.requiredReviewId);
    if (!required) {
      addError(state, event, `opened review references unknown required review ${review.requiredReviewId}`);
    } else {
      validateReviewMatchesRequired(event, state, review, required);
    }
  }
  if (review.id && state.protocolReviews.has(review.id) && review.id !== review.requiredReviewId) {
    addError(state, event, `duplicate protocol review ${review.id}`);
  }
  if (review.id) {
    const existing = state.protocolReviews.get(review.id);
    state.protocolReviews.set(review.id, {
      ...existing,
      ...review,
      required: existing?.required || review.required,
      requiredByParticipantId: existing?.requiredByParticipantId || review.requiredByParticipantId,
      requiredAt: existing?.requiredAt || review.requiredAt,
      status: "open"
    });
  }
}

function validateReviewCompletedEvent(event, state) {
  const completion = event.payload.protocolReviewCompletion;
  if (!completion) {
    addError(state, event, "ReviewCompleted payload missing protocolReviewCompletion");
    return;
  }
  for (const reason of validateReviewCompletion(completion)) {
    addError(state, event, reason);
  }
  validateReviewThread(event, state, completion, "review completion");
  validateReviewParticipant(event, state, completion.completedByParticipantId, "review completion");
  if (event.actor_id !== completion.completedByParticipantId) {
    addError(state, event, "review completion actor_id must match completedByParticipantId");
  }
  const review = completion.reviewId ? state.protocolReviews.get(completion.reviewId) : null;
  if (!review) {
    addError(state, event, `review completion references unknown review ${completion.reviewId}`);
  } else if (completion.threadId !== review.threadId) {
    addError(state, event, "review completion threadId must match review");
  }
  if (completion.id && state.protocolReviewCompletions.has(completion.id)) {
    addError(state, event, `duplicate protocol review completion ${completion.id}`);
  }
  if (completion.id) {
    state.protocolReviewCompletions.set(completion.id, completion);
  }
  if (review) {
    state.protocolReviews.set(review.id, {
      ...review,
      status: "reviewed",
      completedAt: completion.completedAt,
      completedByParticipantId: completion.completedByParticipantId
    });
  }
}

function validateReviewDisputedEvent(event, state) {
  const dispute = event.payload.protocolReviewDispute;
  if (!dispute) {
    addError(state, event, "ReviewDisputed payload missing protocolReviewDispute");
    return;
  }
  for (const reason of validateReviewDispute(dispute)) {
    addError(state, event, reason);
  }
  validateReviewThread(event, state, dispute, "review dispute");
  validateReviewParticipant(event, state, dispute.disputedByParticipantId, "review dispute");
  if (event.actor_id !== dispute.disputedByParticipantId) {
    addError(state, event, "review dispute actor_id must match disputedByParticipantId");
  }
  const review = dispute.reviewId ? state.protocolReviews.get(dispute.reviewId) : null;
  if (!review) {
    addError(state, event, `review dispute references unknown review ${dispute.reviewId}`);
  } else if (dispute.threadId !== review.threadId) {
    addError(state, event, "review dispute threadId must match review");
  }
  if (dispute.id && state.protocolReviewDisputes.has(dispute.id)) {
    addError(state, event, `duplicate protocol review dispute ${dispute.id}`);
  }
  if (dispute.id) {
    state.protocolReviewDisputes.set(dispute.id, dispute);
  }
}

function validateReviewViolationRecordedEvent(event, state) {
  const violation = event.payload.protocolReviewViolation;
  if (!violation) {
    addError(state, event, "ReviewViolationRecorded payload missing protocolReviewViolation");
    return;
  }
  for (const reason of validateReviewViolation(violation)) {
    addError(state, event, reason);
  }
  validateReviewThread(event, state, violation, "review violation");
  validateReviewParticipant(event, state, violation.detectedByParticipantId, "review violation");
  if (event.actor_id !== violation.detectedByParticipantId) {
    addError(state, event, "review violation actor_id must match detectedByParticipantId");
  }
  const review = violation.reviewId ? state.protocolReviews.get(violation.reviewId) : null;
  if (!review) {
    addError(state, event, `review violation references unknown review ${violation.reviewId}`);
  } else if (violation.threadId !== review.threadId) {
    addError(state, event, "review violation threadId must match review");
  }
  if (violation.id && state.protocolReviewViolations.has(violation.id)) {
    addError(state, event, `duplicate protocol review violation ${violation.id}`);
  }
  if (violation.id) {
    state.protocolReviewViolations.set(violation.id, violation);
  }
}

function validateRecoveryRequestedEvent(event, state) {
  const request = event.payload.recoveryRequest;
  if (!request) {
    addError(state, event, "RecoveryRequested payload missing recoveryRequest");
    return;
  }
  for (const reason of validateRecoveryRequest(request)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, request, "request");
  validateRecoveryParticipant(event, state, request.requestedByParticipantId, "request");
  if (event.actor_id !== request.requestedByParticipantId) {
    addError(state, event, "recovery request actor_id must match requestedByParticipantId");
  }
  validateRecoverySubject(event, state, request, "request");
  if (request.id && state.recoveryRequests.has(request.id)) {
    addError(state, event, `duplicate recovery request ${request.id}`);
  }
  if (request.checkpointRef && request.checkpointHash && request.checkpointHash !== checkpointHash(request.checkpointRef)) {
    addError(state, event, "recovery request checkpointHash does not match checkpointRef");
  }
  if (request.id) {
    state.recoveryRequests.set(request.id, {
      ...request,
      status: "requested",
      checkpointHash: request.checkpointHash || checkpointHash(request.checkpointRef)
    });
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryPlanCreatedEvent(event, state) {
  const plan = event.payload.recoveryPlan;
  if (!plan) {
    addError(state, event, "RecoveryPlanCreated payload missing recoveryPlan");
    return;
  }
  for (const reason of validateRecoveryPlan(plan)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, plan, "plan");
  validateRecoveryParticipant(event, state, plan.plannedByParticipantId, "plan");
  if (event.actor_id !== plan.plannedByParticipantId) {
    addError(state, event, "recovery plan actor_id must match plannedByParticipantId");
  }
  const request = plan.recoveryId ? state.recoveryRequests.get(plan.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery plan references unknown recovery request ${plan.recoveryId}`);
  } else if (plan.threadId !== request.threadId) {
    addError(state, event, "recovery plan threadId must match recovery request");
  }
  const review = validateRecoveryReviewReference(event, state, plan.reviewId, "recovery plan", {
    requireCompleted: false,
    requirePendingOrCompleted: true
  });
  if (review && request) {
    validateRecoveryReviewMatchesRequest(event, state, review, request);
  }
  if (plan.id && state.recoveryPlans.has(plan.id)) {
    addError(state, event, `duplicate recovery plan ${plan.id}`);
  }
  if (plan.id) {
    state.recoveryPlans.set(plan.id, plan);
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryQuarantinedEvent(event, state) {
  const quarantine = event.payload.recoveryQuarantine;
  if (!quarantine) {
    addError(state, event, "RecoveryQuarantined payload missing recoveryQuarantine");
    return;
  }
  for (const reason of validateRecoveryQuarantine(quarantine)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, quarantine, "quarantine");
  validateRecoveryParticipant(event, state, quarantine.quarantinedByParticipantId, "quarantine");
  if (event.actor_id !== quarantine.quarantinedByParticipantId) {
    addError(state, event, "recovery quarantine actor_id must match quarantinedByParticipantId");
  }
  const request = quarantine.recoveryId ? state.recoveryRequests.get(quarantine.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery quarantine references unknown recovery request ${quarantine.recoveryId}`);
  } else {
    if (quarantine.threadId !== request.threadId) {
      addError(state, event, "recovery quarantine threadId must match recovery request");
    }
    validateRecoverySubjectMatchesRequest(event, state, quarantine, request, "quarantine");
  }
  const plan = quarantine.planId ? state.recoveryPlans.get(quarantine.planId) : null;
  if (!plan) {
    addError(state, event, `recovery quarantine references unknown recovery plan ${quarantine.planId}`);
  } else if (plan.recoveryId !== quarantine.recoveryId) {
    addError(state, event, "recovery quarantine planId must belong to recovery request");
  }
  validateRecoverySubject(event, state, quarantine, "quarantine");
  const review = validateRecoveryReviewReference(event, state, quarantine.reviewId, "recovery quarantine", {
    requireCompleted: quarantine.emergency !== true,
    requirePending: quarantine.emergency === true
  });
  if (review && request) {
    validateRecoveryReviewMatchesRequest(event, state, review, request);
  }
  if (quarantine.id && state.recoveryQuarantines.has(quarantine.id)) {
    addError(state, event, `duplicate recovery quarantine ${quarantine.id}`);
  }
  if (quarantine.id) {
    state.recoveryQuarantines.set(quarantine.id, {
      ...quarantine,
      status: quarantine.emergency === true ? "emergency_quarantined" : "quarantined",
      visible: true,
      trusted: false
    });
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryAppliedEvent(event, state) {
  const application = event.payload.recoveryApplication;
  if (!application) {
    addError(state, event, "RecoveryApplied payload missing recoveryApplication");
    return;
  }
  for (const reason of validateRecoveryApplication(application)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, application, "application");
  validateRecoveryParticipant(event, state, application.appliedByParticipantId, "application");
  if (event.actor_id !== application.appliedByParticipantId) {
    addError(state, event, "recovery application actor_id must match appliedByParticipantId");
  }
  const request = application.recoveryId ? state.recoveryRequests.get(application.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery application references unknown recovery request ${application.recoveryId}`);
  } else if (application.threadId !== request.threadId) {
    addError(state, event, "recovery application threadId must match recovery request");
  }
  const plan = application.planId ? state.recoveryPlans.get(application.planId) : null;
  if (!plan) {
    addError(state, event, `recovery application references unknown recovery plan ${application.planId}`);
  } else if (plan.recoveryId !== application.recoveryId) {
    addError(state, event, "recovery application planId must belong to recovery request");
  }
  const review = validateRecoveryReviewReference(event, state, application.reviewId, "recovery application", {
    requireCompleted: true
  });
  if (review && request) {
    validateRecoveryReviewMatchesRequest(event, state, review, request);
  }
  if (application.id && state.recoveryApplications.has(application.id)) {
    addError(state, event, `duplicate recovery application ${application.id}`);
  }
  if (application.id) {
    state.recoveryApplications.set(application.id, application);
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryVerifiedEvent(event, state) {
  const verification = event.payload.recoveryVerification;
  if (!verification) {
    addError(state, event, "RecoveryVerified payload missing recoveryVerification");
    return;
  }
  for (const reason of validateRecoveryVerification(verification)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, verification, "verification");
  validateRecoveryParticipant(event, state, verification.verifiedByParticipantId, "verification");
  if (event.actor_id !== verification.verifiedByParticipantId) {
    addError(state, event, "recovery verification actor_id must match verifiedByParticipantId");
  }
  const request = verification.recoveryId ? state.recoveryRequests.get(verification.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery verification references unknown recovery request ${verification.recoveryId}`);
  } else {
    if (verification.threadId !== request.threadId) {
      addError(state, event, "recovery verification threadId must match recovery request");
    }
    const expectedCheckpointHash = request.checkpointHash || checkpointHash(request.checkpointRef);
    if (verification.checkpointHash !== expectedCheckpointHash) {
      addError(state, event, "recovery verification checkpointHash does not match recovery checkpoint");
    }
  }
  const application = verification.applicationId ? state.recoveryApplications.get(verification.applicationId) : null;
  if (!application) {
    addError(state, event, `recovery verification references unknown application ${verification.applicationId}`);
  } else if (application.recoveryId !== verification.recoveryId) {
    addError(state, event, "recovery verification applicationId must belong to recovery request");
  }
  validateRecoveryReviewReference(event, state, verification.reviewId, "recovery verification", {
    requireCompleted: true
  });
  const expectedRecoveryLogHash = recoveryLogHash(state.recoveryEvents);
  if (verification.recoveryLogHash !== expectedRecoveryLogHash) {
    addError(state, event, "recovery verification recoveryLogHash does not match recovery log");
  }
  if (event.previous_hash && verification.originalHeadHash !== event.previous_hash) {
    addError(state, event, "recovery verification originalHeadHash must match event previous_hash");
  }
  if (event.previous_hash && verification.recoveryEventPreviousHash && verification.recoveryEventPreviousHash !== event.previous_hash) {
    addError(state, event, "recovery verification recoveryEventPreviousHash must match event previous_hash");
  }
  if (verification.restoredStateHash !== restoredStateHash(verification.recoveryId, state)) {
    addError(state, event, "recovery verification restoredStateHash does not match recomputed restored state");
  }
  if (verification.restoredProjectionHash !== restoredProjectionHash(verification.recoveryId, state)) {
    addError(state, event, "recovery verification restoredProjectionHash does not match recomputed restored projection");
  }
  if (verification.id && state.recoveryVerifications.has(verification.id)) {
    addError(state, event, `duplicate recovery verification ${verification.id}`);
  }
  if (verification.id) {
    state.recoveryVerifications.set(verification.id, verification);
  }
  state.recoveryEvents.push(event);
}

function validateRecoveryViolationRecordedEvent(event, state) {
  const violation = event.payload.recoveryViolation;
  if (!violation) {
    addError(state, event, "RecoveryViolationRecorded payload missing recoveryViolation");
    return;
  }
  for (const reason of validateRecoveryViolation(violation)) {
    addError(state, event, reason);
  }
  validateRecoveryThread(event, state, violation, "violation");
  validateRecoveryParticipant(event, state, violation.detectedByParticipantId, "violation");
  if (event.actor_id !== violation.detectedByParticipantId) {
    addError(state, event, "recovery violation actor_id must match detectedByParticipantId");
  }
  const request = violation.recoveryId ? state.recoveryRequests.get(violation.recoveryId) : null;
  if (!request) {
    addError(state, event, `recovery violation references unknown recovery request ${violation.recoveryId}`);
  } else if (violation.threadId !== request.threadId) {
    addError(state, event, "recovery violation threadId must match recovery request");
  }
  if (violation.id && state.recoveryViolations.has(violation.id)) {
    addError(state, event, `duplicate recovery violation ${violation.id}`);
  }
  if (violation.id) {
    state.recoveryViolations.set(violation.id, violation);
  }
  state.recoveryEvents.push(event);
}

function validateThreadCreated(event, state) {
  const thread = event.payload.thread;
  if (!thread?.id) {
    addError(state, event, "ThreadCreated payload missing thread.id");
    return;
  }
  if (thread.id !== event.thread_id) {
    addError(state, event, "thread.id must match event thread_id");
  }
  for (const participantId of thread.participantIds || []) {
    if (!state.participants.has(participantId)) {
      addError(state, event, `thread references unknown participant ${participantId}`);
    }
  }
  state.threads.set(thread.id, thread);
}

function validateThreadForked(event, index, state) {
  const fork = event.payload.threadFork;
  if (!fork?.forkThreadId) {
    addError(state, event, "ThreadForked payload missing threadFork.forkThreadId");
    return;
  }
  if (fork.forkThreadId !== event.thread_id) {
    addError(state, event, "forkThreadId must match event thread_id");
  }
  if (state.threads.has(fork.forkThreadId) || state.forks.has(fork.forkThreadId)) {
    addError(state, event, `forkThreadId is not unique: ${fork.forkThreadId}`);
  }
  const parent = state.threads.get(fork.parentThreadId);
  if (!parent) {
    addError(state, event, `fork references unknown parent thread ${fork.parentThreadId}`);
  }
  if (!state.participants.has(fork.forkedBy)) {
    addError(state, event, `fork references unknown participant ${fork.forkedBy}`);
  }

  const boundaryIndex = state.allEventIndexById.get(fork.inheritedThroughEventId);
  const inheritedEvent = state.processedEventsById.get(fork.inheritedThroughEventId);
  if (boundaryIndex === undefined) {
    addError(state, event, `fork inheritedThroughEventId does not exist: ${fork.inheritedThroughEventId}`);
  } else if (boundaryIndex >= index) {
    addError(state, event, `fork cannot inherit from future event ${fork.inheritedThroughEventId}`);
  } else if (!inheritedEvent) {
    addError(state, event, `fork inheritedThroughEventId was not processed: ${fork.inheritedThroughEventId}`);
  } else if (!eventBelongsToThread(inheritedEvent, fork.parentThreadId)) {
    addError(state, event, `fork inheritedThroughEventId is not in parent thread ${fork.parentThreadId}`);
  }

  validateIdsBelongToThread(event, state, fork.changedAssumptionIds, state.assumptions, "assumption", fork.parentThreadId);
  validateIdsBelongToThread(event, state, fork.changedClaimIds, state.claims, "claim", fork.parentThreadId);
  const inheritedObjectIds = collectInheritedObjectIdsThroughBoundary(
    state.events,
    fork.parentThreadId,
    fork.inheritedThroughEventId
  );
  validateIdsInheritedThroughBoundary(
    event,
    state,
    fork.changedAssumptionIds,
    state.assumptions,
    inheritedObjectIds,
    "assumption",
    fork.inheritedThroughEventId
  );
  validateIdsInheritedThroughBoundary(
    event,
    state,
    fork.changedClaimIds,
    state.claims,
    inheritedObjectIds,
    "claim",
    fork.inheritedThroughEventId
  );

  const thread = {
    id: fork.forkThreadId,
    object: "thread",
    title: fork.forkTitle,
    question: parent?.question || fork.forkTitle,
    status: "active",
    participantIds: unique([
      ...(parent?.participantIds || []),
      fork.forkedBy
    ]),
    parentThreadId: fork.parentThreadId,
    fork,
    createdAt: fork.forkedAt || event.timestamp,
    updatedAt: fork.forkedAt || event.timestamp
  };
  state.forks.set(fork.forkThreadId, fork);
  state.threads.set(fork.forkThreadId, thread);
  state.forkInheritedObjectIds.set(fork.forkThreadId, inheritedObjectIds);
}

function validateEvidenceCommitted(event, state) {
  const evidence = event.payload.evidence;
  if (!evidence?.id) {
    addError(state, event, "EvidenceCommitted payload missing evidence.id");
    return;
  }
  validateThreadObject(event, evidence, state, "evidence");
  if (!state.participants.has(evidence.committedByParticipantId)) {
    addError(state, event, `evidence committed by unknown participant ${evidence.committedByParticipantId}`);
  }
  state.evidence.set(evidence.id, evidence);
}

function validateAssumptionDeclared(event, state) {
  const assumption = event.payload.assumption;
  if (!assumption?.id) {
    addError(state, event, "AssumptionDeclared payload missing assumption.id");
    return;
  }
  validateThreadObject(event, assumption, state, "assumption");
  validateIdsExist(event, state, assumption.evidenceIds, state.evidence, "evidence");
  if (!state.participants.has(assumption.declaredByParticipantId)) {
    addError(state, event, `assumption declared by unknown participant ${assumption.declaredByParticipantId}`);
  }
  state.assumptions.set(assumption.id, assumption);
}

function validateClaimCreated(event, state) {
  const claim = event.payload.claim;
  if (!claim?.id) {
    addError(state, event, "ClaimCreated payload missing claim.id");
    return;
  }
  validateThreadObject(event, claim, state, "claim");
  validateIdsExist(event, state, claim.evidenceIds, state.evidence, "evidence");
  validateIdsExist(event, state, claim.contradictingEvidenceIds, state.evidence, "evidence");
  validateIdsExist(event, state, claim.assumptionIds, state.assumptions, "assumption");
  if (!state.participants.has(claim.createdByParticipantId)) {
    addError(state, event, `claim created by unknown participant ${claim.createdByParticipantId}`);
  }
  state.claims.set(claim.id, claim);
}

function validatePositionTaken(event, state) {
  const position = event.payload.position;
  if (!position?.id) {
    addError(state, event, "PositionTaken payload missing position.id");
    return;
  }
  validateThreadObject(event, position, state, "position");
  if (!state.participants.has(position.participantId)) {
    addError(state, event, `position references unknown participant ${position.participantId}`);
  }
  validateTargetExists(event, position.targetObjectType, position.targetObjectId, state);
  state.positions.set(position.id, position);
}

function validateObjectionRaised(event, state) {
  const objection = event.payload.objection;
  if (!objection?.id) {
    addError(state, event, "ObjectionRaised payload missing objection.id");
    return;
  }
  validateThreadObject(event, objection, state, "objection");
  if (!state.participants.has(objection.participantId)) {
    addError(state, event, `objection references unknown participant ${objection.participantId}`);
  }
  validateTargetExists(event, objection.targetObjectType, objection.targetObjectId, state);
  if (objection.status === "resolved") {
    validateResolution(event, objection, state);
  }
  state.objections.set(objection.id, objection);
}

function validateObjectionResolved(event, state) {
  const objectionId = event.payload.objectionId || event.payload.objection?.id;
  const resolution = event.payload.resolution || event.payload.objection?.resolution;
  const objection = state.objections.get(objectionId);

  if (!objection) {
    addError(state, event, `objection resolved before objection exists: ${objectionId}`);
    return;
  }
  if (!resolution || !String(resolution).trim()) {
    addError(state, event, `objection ${objectionId} marked resolved without resolution text`);
  }
  if (!isAuthorizedToResolve(event.actor_id, objection, state)) {
    addError(state, event, `objection ${objectionId} resolved by unauthorized actor ${event.actor_id}`);
  }
  state.objections.set(objectionId, {
    ...objection,
    status: "resolved",
    resolution
  });
}

function validateDecisionRequestOpened(event, state) {
  const request = event.payload.decisionRequest;
  if (!request?.id) {
    addError(state, event, "DecisionRequestOpened payload missing decisionRequest.id");
    return;
  }
  validateThreadObject(event, request, state, "decision request");
  validateIdsExist(event, state, request.supportingEvidenceIds, state.evidence, "evidence");
  validateIdsExist(event, state, request.supportingClaimIds, state.claims, "claim");
  validateIdsExist(event, state, request.supportingAssumptionIds, state.assumptions, "assumption");
  validateIdsExist(event, state, request.objectionIds, state.objections, "objection");
  if (!state.participants.has(request.openedByParticipantId)) {
    addError(state, event, `decision request opened by unknown participant ${request.openedByParticipantId}`);
  }
  state.decisionRequests.set(request.id, request);
}

function validateReviewSubmitted(event, state) {
  const review = event.payload.review;
  if (!review?.id) {
    addError(state, event, "ReviewSubmitted payload missing review.id");
    return;
  }
  validateThreadObject(event, review, state, "review");
  if (!state.decisionRequests.has(review.decisionRequestId)) {
    addError(state, event, `review references unknown decision request ${review.decisionRequestId}`);
  }
  if (state.decisionsByRequest.has(review.decisionRequestId)) {
    addError(state, event, `review submitted after decision already merged for ${review.decisionRequestId}`);
  }
  if (!state.participants.has(review.reviewerParticipantId)) {
    addError(state, event, `review references unknown participant ${review.reviewerParticipantId}`);
  }
  state.reviews.set(review.id, review);
  addToMapList(state.reviewsByRequest, review.decisionRequestId, review);
}

function validateDecisionMerged(event, state) {
  const decision = event.payload.decisionRecord;
  if (!decision?.id) {
    addError(state, event, "DecisionMerged payload missing decisionRecord.id");
    return;
  }
  validateThreadObject(event, decision, state, "decision record");

  const request = state.decisionRequests.get(decision.decisionRequestId);
  if (!request) {
    addError(state, event, `decision merge before decision request opened: ${decision.decisionRequestId}`);
  }
  if (state.decisionsByRequest.has(decision.decisionRequestId)) {
    addError(state, event, `duplicate final decision for request ${decision.decisionRequestId}`);
  }

  const evidenceIds = unique([
    ...(request?.supportingEvidenceIds || []),
    ...(decision.supportingEvidenceIds || [])
  ]);
  if (!evidenceIds.length) {
    addError(state, event, "decision merged without evidence");
  }
  validateIdsExist(event, state, decision.supportingEvidenceIds, state.evidence, "evidence");
  validateIdsExist(event, state, decision.supportingClaimIds, state.claims, "claim");
  validateIdsExist(event, state, decision.supportingAssumptionIds, state.assumptions, "assumption");
  validateIdsExist(event, state, decision.preservedObjectionIds, state.objections, "objection");
  validateIdsExist(event, state, decision.objectionIds, state.objections, "objection");
  validateIdsExist(event, state, decision.reviewIds, state.reviews, "review");

  const eligibility = evaluateDecisionEligibility(state.events, decision.decisionRequestId, {
    actorId: event.actor_id,
    decisionRecord: decision,
    eventId: event.event_id
  });
  for (const reason of eligibility.reasons) {
    addError(state, {
      event_id: reason.event_id || event.event_id,
      event_type: event.event_type
    }, reason.reason);
  }

  if (!state.reviewsByRequest.has(decision.decisionRequestId)) {
    addError(state, event, "decision merged without review");
  }
  if (!isDecisionOwner(decision.decidedByParticipantId, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `decision merged without authorized decision owner ${decision.decidedByParticipantId}`);
  }
  for (const objectionId of request?.objectionIds || []) {
    const objection = state.objections.get(objectionId);
    if (isBlockingObjection(objection) && !(decision.preservedObjectionIds || []).includes(objectionId)) {
      addError(state, event, `decision merged while unresolved blocking objection exists: ${objectionId}`);
    }
  }

  state.decisionRecords.set(decision.id, decision);
  state.decisionsByRequest.set(decision.decisionRequestId, decision);
  state.decisionEventsByRecord.set(decision.id, event);
}

// A re-review trigger flags an in-force decision for re-validation when a new
// objection arrives after the decision was recorded (the finance model-risk
// "monitoring breach → re-validate" loop). It changes no decision substance —
// it only references the in-force record + the post-decision objection that
// fired it, so the original decision snapshot stays frozen. Fail-closed.
function validateReviewTriggered(event, state) {
  const trigger = event.payload.reviewTrigger;
  if (!trigger?.id) {
    addError(state, event, "ReviewTriggered payload missing reviewTrigger.id");
    return;
  }
  validateThreadObject(event, trigger, state, "review trigger");
  const decision = state.decisionRecords.get(trigger.decisionRecordId);
  if (!decision) {
    addError(state, event, `review trigger references unknown decision ${trigger.decisionRecordId}`);
  } else if (decision.threadId !== trigger.threadId) {
    addError(state, event, "review trigger decision belongs to a different thread");
  }
  const objection = state.objections.get(trigger.triggeringObjectionId);
  if (!objection) {
    addError(state, event, `review trigger references unknown objection ${trigger.triggeringObjectionId}`);
  }
  // The "post-decision" property is enforced by append ORDER, not by comparing
  // client-supplied timestamps: a ReviewTriggered can only resolve a decision +
  // objection that already appear earlier in the log, and the server emits it
  // only while the thread is decided. Trusting the nested decidedAt/raisedAt
  // here would let a backdated objection dodge (or wrongly trip) the trigger,
  // so we deliberately do not gate on them.
  if (!state.participants.has(trigger.triggeredByParticipantId)) {
    addError(state, event, `review trigger references unknown participant ${trigger.triggeredByParticipantId}`);
  }
}

function validateMinorityReportFiled(event, state) {
  const report = event.payload.minorityReport;
  if (!report?.id) {
    addError(state, event, "MinorityReportFiled payload missing minorityReport.id");
    return;
  }
  validateThreadObject(event, report, state, "minority report");
  if (!state.decisionRecords.has(report.decisionRecordId)) {
    addError(state, event, `minority report references unknown decision ${report.decisionRecordId}`);
  }
  if (!state.participants.has(report.participantId)) {
    addError(state, event, `minority report references unknown participant ${report.participantId}`);
  }
  validateIdsExist(event, state, report.objectionIds, state.objections, "objection");
  state.minorityReports.push(report);
}

function validateExpectedOutcomeDeclared(event, state) {
  const expected = event.payload.expectedOutcome;
  if (!expected?.id) {
    addError(state, event, "ExpectedOutcomeDeclared payload missing expectedOutcome.id");
    return;
  }
  validateThreadObject(event, expected, state, "expected outcome");
  if (!state.decisionRecords.has(expected.decisionRecordId)) {
    addError(state, event, `expected outcome references unknown decision ${expected.decisionRecordId}`);
  }
  if (!isValidDateString(expected.reviewDate)) {
    addError(state, event, `expected outcome reviewDate is not a valid date: ${expected.reviewDate}`);
  }
  validateIdsExist(event, state, expected.assumptionIds, state.assumptions, "assumption");
  validateIdsExist(event, state, expected.evidenceIds, state.evidence, "evidence");
  state.expectedOutcomes.set(expected.id, expected);
}

function validateOutcomeAudited(event, state) {
  const audit = event.payload.outcomeAudit;
  if (!audit?.id) {
    addError(state, event, "OutcomeAudited payload missing outcomeAudit.id");
    return;
  }
  validateThreadObject(event, audit, state, "outcome audit");
  if (!state.decisionRecords.has(audit.decisionRecordId)) {
    addError(state, event, `outcome audit references unknown decision ${audit.decisionRecordId}`);
  }
  const expected = state.expectedOutcomes.get(audit.expectedOutcomeId);
  if (!expected) {
    addError(state, event, `outcome audit references unknown expected outcome ${audit.expectedOutcomeId}`);
  } else if (expected.decisionRecordId !== audit.decisionRecordId) {
    addError(state, event, `outcome audit decisionRecordId must match expected outcome ${audit.expectedOutcomeId}`);
  }
  if (!OUTCOME_STATUSES.has(String(audit.result || ""))) {
    addError(state, event, `unsupported outcome result ${audit.result}`);
  }
  const auditedBy = audit.auditedBy || audit.auditedByParticipantId;
  if (!state.participants.has(auditedBy)) {
    addError(state, event, `outcome audit references unknown auditor ${auditedBy}`);
  }
  validateIdsExist(event, state, audit.failedAssumptionIds, state.assumptions, "assumption");
  validateIdsExist(event, state, audit.failedEvidenceIds, state.evidence, "evidence");
  validateIdsExist(event, state, audit.evidenceIds, state.evidence, "evidence");
  state.outcomeAudits.set(audit.id, audit);
}

function validateDecisionScored(event, state) {
  const score = event.payload.decisionScore;
  if (!score?.id) {
    addError(state, event, "DecisionScored payload missing decisionScore.id");
    return;
  }
  validateThreadObject(event, score, state, "decision score");
  if (!state.decisionRecords.has(score.decisionRecordId)) {
    addError(state, event, `decision score references unknown decision ${score.decisionRecordId}`);
  }
  if (!OUTCOME_STATUSES.has(String(score.status || ""))) {
    addError(state, event, `unsupported decision score status ${score.status}`);
  }
  if (typeof score.score !== "number" || !Number.isFinite(score.score)) {
    addError(state, event, "decision score must be numeric");
  }
  if (!(score.basedOnOutcomeAuditIds || []).length) {
    addError(state, event, "decision score cannot exist before outcome audits");
  }
  validateIdsExist(event, state, score.basedOnOutcomeAuditIds, state.outcomeAudits, "outcome audit");
  for (const auditId of score.basedOnOutcomeAuditIds || []) {
    const audit = state.outcomeAudits.get(auditId);
    if (audit && audit.decisionRecordId !== score.decisionRecordId) {
      addError(state, event, `decision score audit ${auditId} belongs to a different decision`);
    }
  }
  state.decisionScores.set(score.id, score);
}

function validateMergeRequestOpened(event, state) {
  const request = event.payload.mergeRequest;
  if (!request?.id) {
    addError(state, event, "MergeRequestOpened payload missing mergeRequest.id");
    return;
  }
  if (request.id !== request.mergeRequestId) {
    addError(state, event, "mergeRequest.id must match mergeRequestId");
  }
  if (request.threadId !== event.thread_id || request.targetThreadId !== event.thread_id) {
    addError(state, event, "merge request targetThreadId must match event thread_id");
  }
  if (!state.threads.has(request.targetThreadId)) {
    addError(state, event, `merge request target thread does not exist: ${request.targetThreadId}`);
  }
  const sourceThread = state.threads.get(request.sourceForkThreadId);
  if (!sourceThread?.fork) {
    addError(state, event, `merge request source is not a known fork: ${request.sourceForkThreadId}`);
  } else {
    const mergeState = buildMergeState(state.events);
    if (!threadDescendsFrom(mergeState, request.sourceForkThreadId, request.targetThreadId)) {
      addError(
        state,
        event,
        `merge request source ${request.sourceForkThreadId} is not descended from target ${request.targetThreadId}`
      );
    }
    validateMergeProposalIds(event, state, request, mergeState);
  }
  if (!state.participants.has(request.openedBy)) {
    addError(state, event, `merge request opened by unknown participant ${request.openedBy}`);
  }
  if (state.mergeRequests.has(request.id)) {
    addError(state, event, `duplicate merge request ${request.id}`);
  }
  state.mergeRequests.set(request.id, request);
}

function validateMergeReviewSubmitted(event, state) {
  const review = event.payload.mergeReview;
  if (!review?.id) {
    addError(state, event, "MergeReviewSubmitted payload missing mergeReview.id");
    return;
  }
  const request = state.mergeRequests.get(review.mergeRequestId);
  if (!request) {
    addError(state, event, `merge review references unknown merge request ${review.mergeRequestId}`);
  } else if (review.threadId !== event.thread_id || review.threadId !== request.targetThreadId) {
    addError(state, event, "merge review threadId must match merge request target thread");
  }
  if (!MERGE_REVIEW_STATUSES.has(String(review.status || ""))) {
    addError(state, event, `unsupported merge review status ${review.status}`);
  }
  const reviewerId = review.reviewerId || review.reviewerParticipantId;
  if (!state.participants.has(reviewerId)) {
    addError(state, event, `merge review references unknown reviewer ${reviewerId}`);
  }
  state.mergeReviews.set(review.id, review);
  addToMapList(state.mergeReviewsByRequest, review.mergeRequestId, review);
}

function validateMergeConflictDeclared(event, state) {
  const conflict = event.payload.mergeConflict;
  if (!conflict?.id) {
    addError(state, event, "MergeConflictDeclared payload missing mergeConflict.id");
    return;
  }
  if (conflict.id !== conflict.conflictId) {
    addError(state, event, "mergeConflict.id must match conflictId");
  }
  const request = state.mergeRequests.get(conflict.mergeRequestId);
  if (!request) {
    addError(state, event, `merge conflict references unknown merge request ${conflict.mergeRequestId}`);
  } else {
    if (conflict.threadId !== event.thread_id || conflict.threadId !== request.targetThreadId) {
      addError(state, event, "merge conflict threadId must match merge request target thread");
    }
    const mergeState = buildMergeState(state.events);
    const parentObjectIds = objectIdsForThreadScope(mergeState, request.targetThreadId);
    const forkObjectIds = objectIdsForThreadScope(mergeState, request.sourceForkThreadId);
    if (!parentObjectIds.has(conflict.parentObjectId)) {
      addError(state, event, `merge conflict parent object does not exist in target state: ${conflict.parentObjectId}`);
    }
    if (!forkObjectIds.has(conflict.forkObjectId)) {
      addError(state, event, `merge conflict fork object does not exist in source fork state: ${conflict.forkObjectId}`);
    }
  }
  if (!MERGE_CONFLICT_TYPES.has(String(conflict.conflictType || ""))) {
    addError(state, event, `unsupported merge conflict type ${conflict.conflictType}`);
  }
  if (state.mergeConflicts.has(conflict.id)) {
    addError(state, event, `duplicate merge conflict ${conflict.id}`);
  }
  state.mergeConflicts.set(conflict.id, {
    status: "open",
    ...conflict
  });
  addToMapList(state.mergeConflictsByRequest, conflict.mergeRequestId, conflict);
}

function validateMergeConflictResolved(event, state) {
  const resolution = event.payload.mergeConflictResolution;
  if (!resolution?.id) {
    addError(state, event, "MergeConflictResolved payload missing mergeConflictResolution.id");
    return;
  }
  const request = state.mergeRequests.get(resolution.mergeRequestId);
  const conflict = state.mergeConflicts.get(resolution.conflictId);
  if (!request) {
    addError(state, event, `merge conflict resolution references unknown merge request ${resolution.mergeRequestId}`);
  }
  if (!conflict) {
    addError(state, event, `merge conflict resolution references unknown conflict ${resolution.conflictId}`);
  } else if (conflict.mergeRequestId !== resolution.mergeRequestId) {
    addError(state, event, `merge conflict ${resolution.conflictId} does not belong to merge request ${resolution.mergeRequestId}`);
  }
  if (request && (resolution.threadId !== event.thread_id || resolution.threadId !== request.targetThreadId)) {
    addError(state, event, "merge conflict resolution threadId must match merge request target thread");
  }
  if (!MERGE_CONFLICT_RESOLUTIONS.has(String(resolution.resolution || ""))) {
    addError(state, event, `unsupported merge conflict resolution ${resolution.resolution}`);
  }
  if (!String(resolution.rationale || "").trim()) {
    addError(state, event, "merge conflict resolution requires rationale");
  }
  if (!state.participants.has(resolution.resolvedBy)) {
    addError(state, event, `merge conflict resolution references unknown resolver ${resolution.resolvedBy}`);
  }
  state.mergeConflictResolutions.set(resolution.id, resolution);
  state.mergeConflictResolutionsByConflict.set(resolution.conflictId, resolution);
  if (conflict) {
    state.mergeConflicts.set(conflict.id, {
      ...conflict,
      status: "resolved",
      resolution
    });
  }
}

function validateMergeCompleted(event, state) {
  const completion = event.payload.mergeCompletion;
  if (!completion?.id) {
    addError(state, event, "MergeCompleted payload missing mergeCompletion.id");
    return;
  }
  const request = state.mergeRequests.get(completion.mergeRequestId);
  if (!request) {
    addError(state, event, `merge completion before merge request exists: ${completion.mergeRequestId}`);
  } else if (completion.threadId !== event.thread_id || completion.threadId !== request.targetThreadId) {
    addError(state, event, "merge completion threadId must match merge request target thread");
  }
  if (state.mergeCompletionsByRequest.has(completion.mergeRequestId)) {
    addError(state, event, `duplicate merge completion for request ${completion.mergeRequestId}`);
  }
  if (!state.participants.has(completion.mergedBy)) {
    addError(state, event, `merge completion references unknown merger ${completion.mergedBy}`);
  }
  if (!isDecisionOwner(completion.mergedBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `merge completed without authorized decision owner ${completion.mergedBy}`);
  }

  const eligibility = evaluateMergeEligibility(state.events, completion.mergeRequestId, {
    actorId: event.actor_id,
    completion,
    eventId: event.event_id
  });
  for (const reason of eligibility.reasons) {
    addError(state, {
      event_id: reason.event_id || event.event_id,
      event_type: event.event_type
    }, reason.reason);
  }

  state.mergeCompletions.set(completion.id, completion);
  state.mergeCompletionsByRequest.set(completion.mergeRequestId, completion);
}

function validateFinalDecisionIntegrity(state) {
  for (const decision of state.decisionRecords.values()) {
    const request = state.decisionRequests.get(decision.decisionRequestId);
    const event = state.decisionEventsByRecord.get(decision.id) || { event_id: decision.id, event_type: "DecisionMerged" };
    if (!request) {
      continue;
    }
    for (const objectionId of request.objectionIds || []) {
      const objection = state.objections.get(objectionId);
      if (isBlockingObjection(objection) && !(decision.preservedObjectionIds || []).includes(objectionId)) {
        addError(state, event, `decision record omits unresolved objection ${objectionId}`);
      }
    }
    for (const objectionId of decision.preservedObjectionIds || []) {
      const objection = state.objections.get(objectionId);
      if (!isBlockingObjection(objection)) {
        continue;
      }
      const hasMinorityReport = state.minorityReports.some((report) => {
        return report.decisionRecordId === decision.id && (report.objectionIds || []).includes(objectionId);
      });
      if (!hasMinorityReport) {
        addError(state, event, `decision record preserves ${objectionId} without minority report`);
      }
    }
  }
}

function validateResolution(event, objection, state) {
  if (!objection.resolution || !String(objection.resolution).trim()) {
    addError(state, event, `objection ${objection.id} marked resolved without resolution text`);
  }
  if (!isAuthorizedToResolve(event.actor_id, objection, state)) {
    addError(state, event, `objection ${objection.id} resolved by unauthorized actor ${event.actor_id}`);
  }
}

function validateThreadObject(event, object, state, label) {
  if (object.threadId !== event.thread_id) {
    addError(state, event, `${label} threadId must match event thread_id`);
  }
  if (!state.threads.has(object.threadId)) {
    addError(state, event, `${label} references unknown thread ${object.threadId}`);
  }
}

function validateDelegatedActionAgainstGrant(event, state, action, grant) {
  const status = state.delegationStatusByGrant.get(grant.id) || "active";
  if (status !== "active") {
    addError(state, event, `delegated action references ${status} delegation ${grant.id}`);
  }
  validateDelegationDelegateActor(event, state, action.delegateId, action.delegateType || grant.delegateType, "action");
  if (event.actor_id !== action.delegateId) {
    addError(state, event, "delegated action actor_id must match accountable delegate");
  }
  if (grant.expiresAt && Date.parse(event.timestamp) > Date.parse(grant.expiresAt)) {
    addError(state, event, `delegated action references expired delegation ${grant.id}`);
  }
  if (action.threadId !== grant.threadId) {
    addError(state, event, "delegated action threadId must match delegation grant");
  }
  if (action.delegateId !== grant.delegateId) {
    addError(state, event, "delegated action delegateId must match delegation grant");
  }
  if (normalizeDelegationText(action.action) !== normalizeDelegationText(grant.action)) {
    addError(state, event, "delegated action must match granted action");
  }
  if (normalizeDelegationText(action.scope) !== normalizeDelegationText(grant.scope)) {
    addError(state, event, "delegated action must stay within granted scope");
  }
  if (action.attribution?.delegateId !== action.delegateId) {
    addError(state, event, "delegated action attribution must identify delegate");
  }
  if (action.attribution?.delegationId !== action.delegationId) {
    addError(state, event, "delegated action attribution must identify delegation");
  }
}

function validateDelegationDelegateActor(event, state, delegateId, delegateType, label) {
  if (!delegateId) {
    return;
  }
  const participant = state.participants.get(delegateId);
  if (!participant) {
    addError(state, event, `delegation ${label} references unknown accountable delegate ${delegateId}`);
    return;
  }
  const normalizedType = normalizeDelegationText(delegateType || "participant");
  const normalizedKind = normalizeDelegationText(participant.kind || "human");
  const permittedKinds = {
    participant: null,
    agent: new Set(["agent"]),
    tool: new Set(["tool", "system"]),
    context: new Set(["system"])
  };
  const expectedKinds = permittedKinds[normalizedType];
  if (expectedKinds && !expectedKinds.has(normalizedKind)) {
    addError(
      state,
      event,
      `delegation ${label} delegateType ${normalizedType} requires participant kind ${Array.from(expectedKinds).join(" or ")}`
    );
  }
}

function validateDelegationControlActor(event, state, participantId, grant, label) {
  if (!participantId) {
    addError(state, event, `delegation ${label} requires controlling participant`);
    return;
  }
  if (!state.participants.has(participantId)) {
    addError(state, event, `delegation ${label} references unknown participant ${participantId}`);
    return;
  }
  const permitted = participantId === grant.delegatorParticipantId
    || participantHasAuthority(state.identity, participantId, grant.authorityRequired || "decision_owner", grant.threadId);
  if (!permitted) {
    addError(state, event, `delegation ${label} requires delegator or decision_owner authority ${participantId}`);
  }
}

function validateExecutionActor(event, state, record) {
  if (!record?.actorId) {
    return;
  }
  if (!state.participants.has(record.actorId)) {
    addError(state, event, `execution references unknown accountable actor ${record.actorId}`);
  }
  if (event.actor_id !== record.actorId) {
    addError(state, event, "execution actor_id must match execution actorId");
  }
}

function validateExecutionTransition(event, state, record, label, options = {}) {
  validateThreadObject(event, record, state, `execution ${label}`);
  validateExecutionActor(event, state, record);
  const prior = record.id ? state.executionRecords.get(record.id) : null;
  if (!prior) {
    addError(state, event, `execution ${label} references unknown execution ${record.id}`);
    return;
  }
  const currentStatus = state.executionStatusById.get(record.id) || prior.status || "active";
  const allowedStatuses = options.allowedStatuses || new Set(["active"]);
  if (!allowedStatuses.has(currentStatus)) {
    addError(state, event, `execution ${label} references ${currentStatus} execution ${record.id}`);
  }
  validateExecutionRecordMatchesPrior(event, state, record, prior, label);
  validateExecutionAuthorization(event, state, record);
}

function validateExecutionRecordMatchesPrior(event, state, record, prior, label) {
  if (record.threadId !== prior.threadId) {
    addError(state, event, `execution ${label} threadId must match execution start`);
  }
  if (record.actorId !== prior.actorId) {
    addError(state, event, `execution ${label} actorId must match execution start`);
  }
  if (
    normalizeDelegationText(record.authorizationRef?.type) !== normalizeDelegationText(prior.authorizationRef?.type)
    || record.authorizationRef?.id !== prior.authorizationRef?.id
  ) {
    addError(state, event, `execution ${label} authorizationRef must match execution start`);
  }
  if (record.delegationId !== prior.delegationId) {
    addError(state, event, `execution ${label} delegationId must match execution start`);
  }
  if (record.decisionId !== prior.decisionId) {
    addError(state, event, `execution ${label} decisionId must match execution start`);
  }
  if (normalizeDelegationText(record.actionType) !== normalizeDelegationText(prior.actionType)) {
    addError(state, event, `execution ${label} actionType must match execution start`);
  }
  if (normalizeDelegationText(record.scope) !== normalizeDelegationText(prior.scope)) {
    addError(state, event, `execution ${label} scope must match execution start`);
  }
}

function validateExecutionAuthorization(event, state, record) {
  const ref = record?.authorizationRef || {};
  const type = normalizeDelegationText(ref.type);
  if (type === "delegation") {
    const grant = ref.id ? state.delegationGrants.get(ref.id) : null;
    if (!grant) {
      addError(state, event, `execution references unknown delegation ${ref.id}`);
      return;
    }
    validateExecutionAgainstDelegation(event, state, record, grant);
    return;
  }
  if (type === "decision") {
    const decision = ref.id ? state.decisionRecords.get(ref.id) : null;
    if (!decision) {
      addError(state, event, `execution references unknown decision ${ref.id}`);
      return;
    }
    validateExecutionAgainstDecision(event, state, record, decision);
  }
}

function validateExecutionAgainstDelegation(event, state, record, grant) {
  const status = state.delegationStatusByGrant.get(grant.id) || "active";
  if (status !== "active") {
    addError(state, event, `execution references ${status} delegation ${grant.id}`);
  }
  if (grant.expiresAt && Date.parse(event.timestamp) > Date.parse(grant.expiresAt)) {
    addError(state, event, `execution references expired delegation ${grant.id}`);
  }
  validateDelegationDelegateActor(event, state, grant.delegateId, grant.delegateType, "execution");
  if (record.threadId !== grant.threadId) {
    addError(state, event, "execution threadId must match delegation grant");
  }
  if (record.actorId !== grant.delegateId) {
    addError(state, event, "delegated execution actorId must match accountable delegate");
  }
  if (record.delegationId !== grant.id) {
    addError(state, event, "delegated execution must identify delegationId");
  }
  if (normalizeDelegationText(record.actionType) !== normalizeDelegationText(grant.action)) {
    addError(state, event, "delegated execution must match granted action");
  }
  if (normalizeDelegationText(record.scope) !== normalizeDelegationText(grant.scope)) {
    addError(state, event, "delegated execution must stay within granted scope");
  }
  requireExecutionConstraints(event, state, record, grant.limits || [], "delegation limits");
  if (record.attribution?.delegationId !== grant.id) {
    addError(state, event, "delegated execution attribution must identify delegation");
  }
}

function validateExecutionAgainstDecision(event, state, record, decision) {
  if (decision.status !== "approved") {
    addError(state, event, `execution references non-approved decision ${decision.id}`);
  }
  if (record.threadId !== decision.threadId) {
    addError(state, event, "execution threadId must match decision");
  }
  if (record.decisionId !== decision.id) {
    addError(state, event, "decision execution must identify decisionId");
  }
  const actorPermitted = record.actorId === decision.decidedByParticipantId
    || participantHasAuthority(state.identity, record.actorId, "decision_owner", decision.threadId);
  if (!actorPermitted) {
    addError(state, event, `execution requires decision actor or decision_owner authority ${record.actorId}`);
  }
  const allowedScopes = new Set([
    decision.threadId,
    `thread:${decision.threadId}`,
    decision.id,
    `decision:${decision.id}`
  ].map(normalizeDelegationText));
  if (!allowedScopes.has(normalizeDelegationText(record.scope))) {
    addError(state, event, "decision execution must stay within decision scope");
  }
  requireExecutionConstraints(event, state, record, decision.conditions || [], "decision conditions");
  if (record.attribution?.decisionId !== decision.id) {
    addError(state, event, "decision execution attribution must identify decision");
  }
}

function requireExecutionConstraints(event, state, record, requiredConstraints, label) {
  const required = arrayValues(requiredConstraints).map(normalizeDelegationText).filter(Boolean);
  if (!required.length) {
    return;
  }
  const actual = new Set(arrayValues(record.constraints).map(normalizeDelegationText));
  for (const constraint of required) {
    if (!actual.has(constraint)) {
      addError(state, event, `execution constraints must include ${label} ${constraint}`);
    }
  }
}

function validateOutcomeActor(event, state, record, label) {
  if (!record?.actorId) {
    return;
  }
  validateOutcomeParticipant(event, state, record.actorId, label);
  if (event.actor_id !== record.actorId) {
    addError(state, event, `outcome ${label} actor_id must match actorId`);
  }
}

function validateOutcomeParticipant(event, state, participantId, label) {
  if (!participantId) {
    addError(state, event, `outcome ${label} requires accountable participant`);
    return;
  }
  if (!state.participants.has(participantId)) {
    addError(state, event, `outcome ${label} references unknown participant ${participantId}`);
  }
}

function validateOutcomeExecutionReference(event, state, record, label) {
  const execution = record?.executionId ? state.executionRecords.get(record.executionId) : null;
  if (!execution) {
    addError(state, event, `outcome ${label} references unknown execution ${record?.executionId}`);
    return null;
  }
  if (execution.threadId !== record.threadId) {
    addError(state, event, `outcome ${label} threadId must match execution record`);
  }
  return execution;
}

function validateOutcomeReferencesExpectation(event, state, record, label) {
  const expectation = record?.id ? state.outcomeExpectations.get(record.id) : null;
  if (!expectation) {
    addError(state, event, `outcome ${label} references unknown expected outcome ${record?.id}`);
    return null;
  }
  return expectation;
}

function validateOutcomeRecordMatchesExpectation(event, state, record, expectation, label) {
  if (record.executionId !== expectation.executionId) {
    addError(state, event, `outcome ${label} executionId must match expected outcome`);
  }
  if (record.threadId !== expectation.threadId) {
    addError(state, event, `outcome ${label} threadId must match expected outcome`);
  }
  if (normalizeOutcomeEffect(record.expectedEffect) !== normalizeOutcomeEffect(expectation.expectedEffect)) {
    addError(state, event, `outcome ${label} must not rewrite expected effect`);
  }
}

function validateOutcomeSideRecordMatchesExpectation(event, state, record, expectation, label) {
  if (record.executionId !== expectation.executionId) {
    addError(state, event, `outcome ${label} executionId must match expected outcome`);
  }
  if (record.threadId !== expectation.threadId) {
    addError(state, event, `outcome ${label} threadId must match expected outcome`);
  }
}

function validateOutcomeThread(event, state, object, label) {
  if (object.threadId !== event.thread_id) {
    addError(state, event, `outcome ${label} threadId must match event thread_id`);
  }
  if (!state.threads.has(object.threadId)) {
    addError(state, event, `outcome ${label} references unknown thread ${object.threadId}`);
  }
}

function validateOutcomeLearningReferences(event, state, object, label, participantId) {
  validateThreadObject(event, object, state, `outcome learning ${label}`);
  if (!participantId) {
    addError(state, event, `outcome learning ${label} requires accountable participant`);
  } else if (!state.participants.has(participantId)) {
    addError(state, event, `outcome learning ${label} references unknown participant ${participantId}`);
  }
  if (participantId && event.actor_id !== participantId) {
    addError(state, event, `outcome learning ${label} actor_id must match accountable participant`);
  }

  const expectation = object.outcomeId ? state.outcomeExpectations.get(object.outcomeId) : null;
  if (!expectation) {
    addError(state, event, `outcome learning ${label} references unknown outcome ${object.outcomeId}`);
  } else {
    if (object.executionId !== expectation.executionId) {
      addError(state, event, `outcome learning ${label} executionId must match evaluated outcome`);
    }
    if (object.threadId !== expectation.threadId) {
      addError(state, event, `outcome learning ${label} threadId must match evaluated outcome`);
    }
    if (object.expectedEffect && normalizeOutcomeEffect(object.expectedEffect) !== normalizeOutcomeEffect(expectation.expectedEffect)) {
      addError(state, event, `outcome learning ${label} must not rewrite intended effect`);
    }
  }

  const execution = object.executionId ? state.executionRecords.get(object.executionId) : null;
  if (!execution) {
    addError(state, event, `outcome learning ${label} references unknown execution ${object.executionId}`);
  } else if (execution.threadId !== object.threadId) {
    addError(state, event, `outcome learning ${label} threadId must match execution record`);
  }

  const evaluation = object.outcomeId ? state.outcomeEvaluations.get(object.outcomeId) : null;
  if (!evaluation) {
    addError(state, event, `outcome learning ${label} requires evaluated outcome ${object.outcomeId}`);
    return;
  }
  if (
    object.evaluationResult
    && normalizeDelegationText(object.evaluationResult) !== normalizeDelegationText(evaluation.evaluationResult)
  ) {
    addError(state, event, `outcome learning ${label} evaluationResult must match evaluated outcome`);
  }
  if (object.sourceOutcomeHash && evaluation.outcomeHash && object.sourceOutcomeHash !== evaluation.outcomeHash) {
    addError(state, event, `outcome learning ${label} sourceOutcomeHash must match evaluated outcome`);
  }
}

function validateOutcomeLearningTarget(event, state, record, label) {
  const target = state.outcomeLearningSignals.get(record.learningId)
    || state.outcomeLessons.get(record.learningId);
  if (!target) {
    addError(state, event, `outcome learning ${label} references unknown learning ${record.learningId}`);
    return;
  }
  validateOutcomeLearningMatchesTarget(state, event, record, target, label, "learning record");
}

function validateOutcomeLearningMatchesTarget(state, event, record, target, label, targetLabel) {
  if (record.outcomeId !== target.outcomeId) {
    addError(state, event, `outcome learning ${label} outcomeId must match ${targetLabel}`);
  }
  if (record.executionId !== target.executionId) {
    addError(state, event, `outcome learning ${label} executionId must match ${targetLabel}`);
  }
  if (record.threadId !== target.threadId) {
    addError(state, event, `outcome learning ${label} threadId must match ${targetLabel}`);
  }
}

function validateReviewThread(event, state, object, label) {
  validateThreadObject(event, object, state, `protocol ${label}`);
}

function validateReviewParticipant(event, state, participantId, label) {
  if (!participantId) {
    addError(state, event, `protocol ${label} requires accountable participant`);
  } else if (!state.participants.has(participantId)) {
    addError(state, event, `protocol ${label} references unknown participant ${participantId}`);
  }
}

function validateReviewSubject(event, state, review) {
  const subjectType = normalizeReviewText(review.subjectType || review.subjectRef?.type);
  const subjectId = review.subjectId || review.subjectRef?.id;
  if (!subjectType || !subjectId) {
    return;
  }
  const subject = reviewSubjectForType(state, subjectType, subjectId);
  if (!subject.supported) {
    addError(state, event, `unsupported review subjectType ${review.subjectType}`);
    return;
  }
  if (!subject.record) {
    addError(state, event, `review subject does not exist: ${subjectType}:${subjectId}`);
    return;
  }
  if (subject.record.threadId && review.threadId && subject.record.threadId !== review.threadId) {
    addError(state, event, "protocol review threadId must match review subject");
  }
  if (subject.record.id && review.subjectRef?.id && subject.record.id !== review.subjectRef.id) {
    addError(state, event, "protocol review subjectRef.id must match subjectId");
  }
}

function validateReviewTriggerEvent(event, state, review) {
  if (!review.triggerEventId) {
    return;
  }
  if (!state.processedEventsById.has(review.triggerEventId)) {
    addError(state, event, `review trigger event does not exist: ${review.triggerEventId}`);
  }
}

function validateReviewMatchesRequired(event, state, review, required) {
  if (review.subjectType !== required.subjectType || review.subjectId !== required.subjectId) {
    addError(state, event, "opened review subject must match required review");
  }
  if (review.threadId !== required.threadId) {
    addError(state, event, "opened review threadId must match required review");
  }
}

function validateRecoveryThread(event, state, object, label) {
  validateThreadObject(event, object, state, `recovery ${label}`);
}

function validateRecoveryParticipant(event, state, participantId, label) {
  if (!participantId) {
    addError(state, event, `recovery ${label} requires accountable participant`);
  } else if (!state.participants.has(participantId)) {
    addError(state, event, `recovery ${label} references unknown participant ${participantId}`);
  }
}

function validateRecoverySubject(event, state, record, label) {
  const subjectType = normalizeRecoveryText(record.subjectType || record.subjectRef?.type);
  const subjectId = record.subjectId || record.subjectRef?.id;
  if (!subjectType || !subjectId || !RECOVERY_SUBJECT_TYPES.has(subjectType)) {
    return;
  }
  if (subjectRequiresArtifactEvidence(subjectType)) {
    const artifactHash = record.artifactHash
      || record.artifact_hash
      || record.artifactRef?.hash
      || record.artifact_ref?.hash
      || state.recoveryRequests.get(record.recoveryId)?.artifactHash
      || state.recoveryRequests.get(record.recoveryId)?.artifactRef?.hash;
    const evidence = [
      ...arrayValues(record.evidence),
      ...arrayValues(record.artifactRef?.evidence || record.artifact_ref?.evidence),
      ...arrayValues(state.recoveryRequests.get(record.recoveryId)?.evidence),
      ...arrayValues(state.recoveryRequests.get(record.recoveryId)?.artifactRef?.evidence)
    ];
    if (!artifactHash) {
      addError(state, event, `recovery ${label} external subject requires artifact hash`);
    }
    if (!evidence.length) {
      addError(state, event, `recovery ${label} external subject requires evidence`);
    }
    return;
  }

  const subject = recoverySubjectForType(state, subjectType, subjectId);
  if (!subject.supported) {
    addError(state, event, `unsupported recovery subjectType ${record.subjectType}`);
    return;
  }
  if (!subject.record) {
    addError(state, event, `recovery subject does not exist: ${subjectType}:${subjectId}`);
    return;
  }
  if (subject.record.threadId && record.threadId && subject.record.threadId !== record.threadId) {
    addError(state, event, `recovery ${label} threadId must match recovery subject`);
  }
}

function validateRecoverySubjectMatchesRequest(event, state, record, request, label) {
  const recordType = normalizeRecoveryText(record.subjectType || record.subjectRef?.type);
  const requestType = normalizeRecoveryText(request.subjectType || request.subjectRef?.type);
  const recordId = record.subjectId || record.subjectRef?.id;
  const requestId = request.subjectId || request.subjectRef?.id;
  if (recordType !== requestType || recordId !== requestId) {
    addError(state, event, `recovery ${label} subject must match recovery request`);
  }
}

function validateRecoveryReviewReference(event, state, reviewId, label, options = {}) {
  const review = reviewId ? state.protocolReviews.get(reviewId) : null;
  if (!review) {
    addError(state, event, `${label} references unknown review ${reviewId}`);
    return null;
  }
  if (options.requireCompleted && review.status !== "reviewed") {
    addError(state, event, `${label} requires completed M23 review ${reviewId}`);
  }
  if (options.requirePending && !["required", "open"].includes(review.status)) {
    addError(state, event, `${label} emergency quarantine requires pending M23 review ${reviewId}`);
  }
  if (options.requirePendingOrCompleted && !["required", "open", "reviewed"].includes(review.status)) {
    addError(state, event, `${label} requires required, open, or completed M23 review ${reviewId}`);
  }
  return review;
}

function validateRecoveryReviewMatchesRequest(event, state, review, request) {
  const subjectType = normalizeReviewText(review.subjectType || review.subjectRef?.type);
  const subjectId = review.subjectId || review.subjectRef?.id;
  if (!["recovery", "recovery_request"].includes(subjectType) || subjectId !== request.id) {
    addError(state, event, "recovery review must reference the recovery request");
  }
  if (review.threadId !== request.threadId) {
    addError(state, event, "recovery review threadId must match recovery request");
  }
}

function recoverySubjectForType(state, subjectType, subjectId) {
  const normalized = normalizeRecoveryText(subjectType);
  const collections = {
    invalid_event: state.processedEventsById,
    event_hash_mismatch: state.processedEventsById,
    hash_chain_mismatch: state.processedEventsById,
    bad_execution_rollback: state.executionRollbacks,
    bad_outcome_chain: state.outcomeExpectations,
    bad_outcome_learning_chain: state.outcomeLearningSignals
  };
  const collection = collections[normalized];
  if (!collection) {
    return { supported: false, record: null };
  }
  return {
    supported: true,
    record: collection.get(subjectId) || null
  };
}

function reviewSubjectForType(state, subjectType, subjectId) {
  const normalized = normalizeReviewText(subjectType);
  const collections = {
    thread: state.threads,
    evidence: state.evidence,
    assumption: state.assumptions,
    claim: state.claims,
    position: state.positions,
    objection: state.objections,
    decision_request: state.decisionRequests,
    decisionrequest: state.decisionRequests,
    decision_record: state.decisionRecords,
    decisionrecord: state.decisionRecords,
    decision_review: state.reviews,
    decisionreview: state.reviews,
    minority_report: mapArrayById(state.minorityReports),
    minorityreport: mapArrayById(state.minorityReports),
    merge_request: state.mergeRequests,
    mergerequest: state.mergeRequests,
    merge_review: state.mergeReviews,
    mergereview: state.mergeReviews,
    merge_conflict: state.mergeConflicts,
    mergeconflict: state.mergeConflicts,
    merge_conflict_resolution: state.mergeConflictResolutions,
    mergeconflictresolution: state.mergeConflictResolutions,
    merge_completion: state.mergeCompletions,
    mergecompletion: state.mergeCompletions,
    expected_outcome: state.expectedOutcomes,
    expectedoutcome: state.expectedOutcomes,
    outcome_audit: state.outcomeAudits,
    outcomeaudit: state.outcomeAudits,
    decision_score: state.decisionScores,
    decisionscore: state.decisionScores,
    delegation: state.delegationGrants,
    delegation_grant: state.delegationGrants,
    delegated_action: state.delegationActions,
    delegatedaction: state.delegationActions,
    delegation_violation: state.delegationViolations,
    delegationviolation: state.delegationViolations,
    execution: state.executionRecords,
    execution_record: state.executionRecords,
    execution_violation: state.executionViolations,
    executionviolation: state.executionViolations,
    outcome: state.outcomeExpectations,
    protocol_outcome: state.outcomeExpectations,
    outcome_dispute: state.outcomeDisputes,
    outcomedispute: state.outcomeDisputes,
    outcome_violation: state.outcomeViolations,
    outcomeviolation: state.outcomeViolations,
    outcome_learning_signal: state.outcomeLearningSignals,
    outcomelearningsignal: state.outcomeLearningSignals,
    outcome_lesson: state.outcomeLessons,
    outcomelesson: state.outcomeLessons,
    outcome_learning_dispute: state.outcomeLearningDisputes,
    outcomelearningdispute: state.outcomeLearningDisputes,
    outcome_learning_violation: state.outcomeLearningViolations,
    outcomelearningviolation: state.outcomeLearningViolations,
    protocol_review: state.protocolReviews,
    protocolreview: state.protocolReviews,
    review: state.protocolReviews,
    recovery: state.recoveryRequests,
    recovery_request: state.recoveryRequests,
    recoveryrequest: state.recoveryRequests,
    recovery_plan: state.recoveryPlans,
    recoveryplan: state.recoveryPlans,
    recovery_quarantine: state.recoveryQuarantines,
    recoveryquarantine: state.recoveryQuarantines,
    recovery_application: state.recoveryApplications,
    recoveryapplication: state.recoveryApplications,
    recovery_verification: state.recoveryVerifications,
    recoveryverification: state.recoveryVerifications,
    recovery_violation: state.recoveryViolations,
    recoveryviolation: state.recoveryViolations
  };
  const collection = collections[normalized];
  if (!collection) {
    return { supported: false, record: null };
  }
  return {
    supported: true,
    record: collection.get(subjectId) || null
  };
}

function mapArrayById(values) {
  return new Map((values || []).map((value) => [value.id, value]).filter(([id]) => id));
}

function validateTargetExists(event, targetType, targetId, state) {
  if (!targetId) {
    return;
  }
  const targetCollections = {
    thread: state.threads,
    evidence: state.evidence,
    assumption: state.assumptions,
    claim: state.claims,
    position: state.positions,
    decisionRequest: state.decisionRequests
  };
  const collection = targetCollections[targetType];
  if (!collection) {
    addError(state, event, `unsupported targetObjectType ${targetType}`);
    return;
  }
  if (!collection.has(targetId)) {
    addError(state, event, `${targetType} target does not exist: ${targetId}`);
  }
}

function validateIdsExist(event, state, ids, collection, label) {
  for (const id of ids || []) {
    if (!collection.has(id)) {
      addError(state, event, `${label} reference does not exist: ${id}`);
    }
  }
}

function normalizeDelegationText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeReviewText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeRecoveryText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeOutcomeEffect(value) {
  return String(value || "").trim();
}

function arrayValues(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
}

function validateAuthorityName(event, state, authority) {
  const normalized = String(authority || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!VALID_AUTHORITIES.has(normalized)) {
    addError(state, event, `unsupported authority ${authority}`);
  }
}

function validateAuthorityScope(event, state, scope = "global", threadId) {
  if (!VALID_AUTHORITY_SCOPES.has(scope)) {
    addError(state, event, `unsupported authority scope ${scope}`);
    return;
  }
  if (scope === "thread") {
    if (!threadId) {
      addError(state, event, "thread authority scope requires threadId");
    } else if (!state.threads.has(threadId)) {
      addError(state, event, `authority scope references unknown thread ${threadId}`);
    }
  }
}

function validateAttributionSourceBoundary(event, state, sourceEventId, index) {
  if (!sourceEventId) {
    return;
  }
  const sourceIndex = state.allEventIndexById.get(sourceEventId);
  if (sourceIndex === undefined) {
    addError(state, event, `attribution source event does not exist: ${sourceEventId}`);
  } else if (sourceIndex >= index) {
    addError(state, event, `attribution cannot reference future event ${sourceEventId}`);
  }
}

function validateIdsBelongToThread(event, state, ids, collection, label, threadId) {
  for (const id of ids || []) {
    const object = collection.get(id);
    if (!object) {
      addError(state, event, `${label} reference does not exist: ${id}`);
    } else if (object.threadId !== threadId) {
      addError(state, event, `${label} ${id} does not belong to parent thread ${threadId}`);
    }
  }
}

function validateMergeProposalIds(event, state, request, mergeState) {
  const sourceObjectIds = objectIdsForThreadScope(mergeState, request.sourceForkThreadId);
  const proposalGroups = [
    ["assumption", request.proposedAssumptionIds],
    ["evidence", request.proposedEvidenceIds],
    ["claim", request.proposedClaimIds],
    ["objection", request.proposedObjectionIds],
    ["decision record", request.proposedDecisionRecordIds]
  ];
  for (const [label, ids] of proposalGroups) {
    for (const id of ids || []) {
      if (!sourceObjectIds.has(id)) {
        addError(state, event, `merge request proposed ${label} does not exist in source fork state: ${id}`);
      }
    }
  }
}

function validateForkEvent(event, state) {
  const fork = state.forks.get(event.thread_id);
  if (!fork || event.event_type === "ThreadForked") {
    return;
  }
  const object = primaryObject(event);
  const inheritedObjectIds = state.forkInheritedObjectIds.get(fork.forkThreadId) || new Set();
  if (object?.id && inheritedObjectIds.has(object.id)) {
    addError(state, event, `fork cannot mutate parent object directly: ${object.id}`);
  }
  for (const targetId of forkMutationTargetIds(event)) {
    if (targetId && inheritedObjectIds.has(targetId)) {
      addError(state, event, `fork cannot mutate parent object directly: ${targetId}`);
    }
  }
}

function collectInheritedObjectIdsThroughBoundary(events, parentThreadId, inheritedThroughEventId) {
  const ids = new Set();
  for (const event of events) {
    const object = primaryObject(event);
    if (object?.id && object.threadId === parentThreadId) {
      ids.add(object.id);
    }
    if (event.event_id === inheritedThroughEventId) {
      break;
    }
  }
  return ids;
}

function validateIdsInheritedThroughBoundary(event, state, ids, collection, inheritedObjectIds, label, inheritedThroughEventId) {
  for (const id of ids || []) {
    if (collection.has(id) && !inheritedObjectIds.has(id)) {
      addError(state, event, `${label} ${id} is not inherited through ${inheritedThroughEventId}`);
    }
  }
}

function forkMutationTargetIds(event) {
  const payload = event.payload || {};
  switch (event.event_type) {
    case "ObjectionResolved":
      return [payload.objectionId || payload.objection?.id];
    case "ReviewSubmitted":
      return [payload.review?.decisionRequestId];
    case "DecisionMerged":
      return [
        payload.decisionRecord?.decisionRequestId,
        ...(payload.decisionRecord?.preservedObjectionIds || [])
      ];
    case "MinorityReportFiled":
      return [payload.minorityReport?.decisionRecordId];
    default:
      return [];
  }
}

function eventBelongsToThread(event, threadId) {
  return event?.thread_id === threadId
    || event?.threadId === threadId
    || event?.payload?.thread?.id === threadId
    || event?.payload?.threadFork?.forkThreadId === threadId;
}

function primaryObject(event) {
  const payload = event?.payload || {};
  return payload.thread
    || payload.threadFork
    || payload.participant
    || payload.participantRole
    || payload.participantAuthority
    || payload.participantAuthorityRevocation
    || payload.contributionAttribution
    || payload.attributionCorrection
    || payload.attributionDispute
    || payload.attributionRevocation
    || payload.learningSignal
    || payload.patternObservation
    || payload.outcomeReview
    || payload.learningRecommendation
    || payload.adaptationReview
    || payload.governanceReviewRecommendation
    || payload.evidenceRequirementReviewRecommendation
    || payload.revisitTriggerReviewRecommendation
    || payload.decisionGateReviewRecommendation
    || payload.protocolAmendment
    || payload.amendment
    || payload.protocolAmendmentReview
    || payload.amendmentReview
    || payload.protocolAmendmentApproval
    || payload.amendmentApproval
    || payload.protocolAmendmentRejection
    || payload.amendmentRejection
    || payload.protocolAmendmentSupersession
    || payload.amendmentSupersession
    || payload.evidence
    || payload.assumption
    || payload.claim
    || payload.position
    || payload.objection
    || payload.alignmentSnapshot
    || payload.decisionRequest
    || payload.review
    || payload.decisionRecord
    || payload.minorityReport
    || payload.mergeRequest
    || payload.mergeReview
    || payload.mergeConflict
    || payload.mergeConflictResolution
    || payload.mergeCompletion
    || payload.expectedOutcome
    || payload.outcomeAudit
    || payload.decisionScore
    || payload.executionRecord
    || payload.executionViolation
    || payload.outcomeRecord
    || payload.outcomeDispute
    || payload.outcomeViolation
    || payload.outcomeLearningSignal
    || payload.outcomeLesson
    || payload.outcomeLearningDispute
    || payload.outcomeLearningViolation
    || payload.protocolReview
    || payload.protocolReviewCompletion
    || payload.protocolReviewDispute
    || payload.protocolReviewViolation
    || payload.recoveryRequest
    || payload.recoveryPlan
    || payload.recoveryQuarantine
    || payload.recoveryApplication
    || payload.recoveryVerification
    || payload.recoveryViolation
    || null;
}

function isValidDateString(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const date = new Date(`${value}T00:00:00.000Z`);
    return date.getUTCFullYear() === Number(year)
      && date.getUTCMonth() + 1 === Number(month)
      && date.getUTCDate() === Number(day);
  }
  return !Number.isNaN(Date.parse(value));
}

function addError(state, event, reason) {
  state.errors.push({
    event_id: event?.event_id ?? null,
    event_type: event?.event_type ?? null,
    reason
  });
}

function addToMapList(map, key, value) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
}

function isAuthorizedToResolve(actorId, objection, state) {
  return actorId === objection.participantId || isDecisionOwner(actorId, state, objection.threadId);
}

function isDecisionOwner(participantId, state, threadId) {
  return participantHasAuthority(state.identity, participantId, "decision_owner", threadId);
}


function formatValidationErrors(errors) {
  if (!errors.length) {
    return "Validation passed";
  }
  return errors
    .map((error) => `${error.event_id || "(missing event_id)"}: ${error.reason}`)
    .join("\n");
}

module.exports = {
  ValidationError,
  assertValidEvents,
  formatValidationErrors,
  validateEvents
};
