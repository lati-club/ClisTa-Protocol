const {
  EVENT_HASH_VERSION,
  HASH_PATTERN,
  PROTOCOL_VERSION,
  computeEventHash
} = require("./integrity");
const { emptyIdentityState } = require("./identity");
const { primaryObject } = require("./event-types");
const { addError } = require("./validator/shared");
const {
  validateParticipantAdded,
  validateParticipantAuthorityGranted,
  validateParticipantAuthorityRevoked,
  validateParticipantDeclared,
  validateParticipantRoleAssigned
} = require("./validator/participant");
const {
  validateContributionAttributed,
  validateContributionAttributionCorrected,
  validateContributionAttributionDisputed,
  validateContributionAttributionRevoked
} = require("./validator/attribution");
const {
  validateAdaptationReviewRecorded,
  validateDecisionGateReviewRecommendedEvent,
  validateEvidenceRequirementReviewRecommendedEvent,
  validateGovernanceReviewRecommendedEvent,
  validateLearningRecommendationRecorded,
  validateLearningSignalRecorded,
  validateOutcomeReviewRecorded,
  validatePatternObservationRecorded,
  validateRevisitTriggerReviewRecommendedEvent
} = require("./validator/learning");
const {
  validateProtocolAmendmentApprovedEvent,
  validateProtocolAmendmentProposed,
  validateProtocolAmendmentRejectedEvent,
  validateProtocolAmendmentReviewed,
  validateProtocolAmendmentSupersededEvent
} = require("./validator/amendment");
const {
  validateCapabilitySetDeclaredEvent,
  validateCompatibilityAcceptanceRecordedEvent,
  validateCompatibilityCheckRecordedEvent,
  validateCompatibilityDegradationRecordedEvent,
  validateCompatibilityFailureRecordedEvent,
  validateInteroperabilityAcceptanceRecordedEvent,
  validateInteroperabilityCheckRecordedEvent,
  validateInteroperabilityFailureRecordedEvent,
  validateInteroperabilityProfileDeclaredEvent,
  validateSemanticDegradationRecordedEvent,
  validateSemanticMappingRecordedEvent
} = require("./validator/compatibility");
const {
  validateFederatedPacketRejectedEvent,
  validateFederatedPacketVerifiedEvent,
  validateFederatedStateReferenceRecordedEvent,
  validateFederationBoundaryRecordedEvent,
  validateFederationContextDeclaredEvent,
  validateFederationPeerRecordedEvent
} = require("./validator/federation");
const {
  validateNegotiationConstraintDeclaredEvent,
  validateNegotiationDegradationAcceptedEvent,
  validateNegotiationDifferenceRecordedEvent,
  validateNegotiationFailureRecordedEvent,
  validateNegotiationRequestedEvent,
  validateNegotiationTermsAcceptedEvent,
  validateNegotiationTermsProposedEvent,
  validateNegotiationTermsRejectedEvent
} = require("./validator/negotiation");
const {
  validateDelegatedActionRecordedEvent,
  validateDelegationExpiredEvent,
  validateDelegationGrantedEvent,
  validateDelegationRevokedEvent,
  validateDelegationViolationRecordedEvent
} = require("./validator/delegation");
const {
  validateExecutionCompletedEvent,
  validateExecutionFailedEvent,
  validateExecutionRolledBackEvent,
  validateExecutionStartedEvent,
  validateExecutionViolationRecordedEvent
} = require("./validator/execution");
const {
  validateLearningDisputedEvent,
  validateLearningSignalDerivedEvent,
  validateLearningViolationRecordedEvent,
  validateLessonRecordedEvent,
  validateOutcomeDisputedEvent,
  validateOutcomeEvaluatedEvent,
  validateOutcomeExpectedEvent,
  validateOutcomeObservedEvent,
  validateOutcomeViolationRecordedEvent
} = require("./validator/outcome");
const {
  validateReviewCompletedEvent,
  validateReviewDisputedEvent,
  validateReviewOpenedEvent,
  validateReviewRequiredEvent,
  validateReviewViolationRecordedEvent
} = require("./validator/review");
const {
  validateRecoveryAppliedEvent,
  validateRecoveryPlanCreatedEvent,
  validateRecoveryQuarantinedEvent,
  validateRecoveryRequestedEvent,
  validateRecoveryVerifiedEvent,
  validateRecoveryViolationRecordedEvent
} = require("./validator/recovery");
const {
  validateMergeCompleted,
  validateMergeConflictDeclared,
  validateMergeConflictResolved,
  validateMergeRequestOpened,
  validateMergeReviewSubmitted
} = require("./validator/merge");
const {
  validateDecisionMerged,
  validateDecisionRequestOpened,
  validateDecisionScored,
  validateExpectedOutcomeDeclared,
  validateFinalDecisionIntegrity,
  validateMinorityReportFiled,
  validateOutcomeAudited,
  validateReviewSubmitted,
  validateReviewTriggered
} = require("./validator/decision");
const {
  validateAlignmentCalculated,
  validateAssumptionDeclared,
  validateClaimCreated,
  validateCrossThreadEvidence,
  validateEvidenceCommitted,
  validateObjectionRaised,
  validateObjectionResolved,
  validatePositionTaken,
  validateThreadCreated,
  validateThreadForked
} = require("./validator/thread");

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
        validateAdaptationReviewRecorded(event, state);
        break;
      case "ObjectDeprecated":
        // Deprecation event - basic acceptance for Milestone 0 pruning discipline
        break;
      case "PruningReviewInitiated":
        break;
      case "ModelPruned":
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
      case "CrossThreadEvidence":
        validateCrossThreadEvidence(event, state);
        break;
      case "AlignmentCalculated":
        validateAlignmentCalculated(event, state);
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

  // Advance (or reset) the chain anchor for every event, matching
  // verifyEventIntegrity in integrity.js. Previously the anchor only moved when
  // content_hash was present, so a hash-less event mid-log left a stale anchor and
  // the next event's previous_hash was validated against the wrong predecessor.
  state.lastContentHash = event.content_hash || undefined;
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

// A re-review trigger flags an in-force decision for re-validation when a new
// objection arrives after the decision was recorded (the finance model-risk
// "monitoring breach → re-validate" loop). It changes no decision substance —
// it only references the in-force record + the post-decision objection that
// fired it, so the original decision snapshot stays frozen. Fail-closed.
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
