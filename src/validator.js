const { evaluateDecisionEligibility, isBlockingObjection } = require("./governance");
const {
  EVENT_HASH_VERSION,
  HASH_PATTERN,
  PROTOCOL_VERSION,
  computeEventHash
} = require("./integrity");
const { emptyIdentityState } = require("./identity");
const { unique } = require("./utils");
const { primaryObject } = require("./event-types");
const {
  addError,
  addToMapList,
  isDecisionOwner,
  validateIdsExist,
  validateThreadObject
} = require("./validator/shared");
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

function validateCrossThreadEvidence(event, state) {
  const cte = event.payload.crossThreadEvidence;
  if (!cte?.id) {
    addError(state, event, "CrossThreadEvidence payload missing crossThreadEvidence.id");
    return;
  }
  if (!cte.sourceThreadId) {
    addError(state, event, "CrossThreadEvidence missing sourceThreadId");
  }
  if (!cte.sourceDecisionRecordId) {
    addError(state, event, "CrossThreadEvidence missing sourceDecisionRecordId");
  }
  if (!cte.sourceEventHash) {
    addError(state, event, "CrossThreadEvidence missing sourceEventHash");
  }
  if (!cte.derivation) {
    addError(state, event, "CrossThreadEvidence missing derivation");
  }
  const validDerivations = ["decision_output", "preserved_objection", "minority_report", "assumption_propagation", "evidence_propagation"];
  if (cte.derivation && !validDerivations.includes(cte.derivation)) {
    addError(state, event, `CrossThreadEvidence unsupported derivation ${cte.derivation}`);
  }
  if (!cte.finding) {
    addError(state, event, "CrossThreadEvidence missing finding");
  }
  validateThreadObject(event, cte, state, "crossThreadEvidence");
  // Require an attributed committer, matching validateEvidenceCommitted. Cross-
  // thread evidence is registered into the same state.evidence map that claims,
  // assumptions, and positions reference, so it must not enter the decision graph
  // unattributed — that would weaken the "who put this in the record" guarantee.
  if (!cte.committedByParticipantId) {
    addError(state, event, "CrossThreadEvidence missing committedByParticipantId");
  } else if (!state.participants.has(cte.committedByParticipantId)) {
    addError(state, event, `crossThreadEvidence committed by unknown participant ${cte.committedByParticipantId}`);
  }
  // Register as evidence so downstream claims, assumptions, positions can reference it
  state.evidence.set(cte.id, {
    id: cte.id,
    object: "evidence",
    threadId: cte.threadId,
    source: `CrossThread:${cte.sourceThreadId}:${cte.sourceDecisionRecordId}`,
    finding: cte.finding,
    confidence: cte.confidence,
    committedByParticipantId: cte.committedByParticipantId,
    committedAt: cte.committedAt,
    artifactIds: [],
    contentHash: cte.contentHash,
    crossThreadRef: {
      sourceThreadId: cte.sourceThreadId,
      sourceDecisionRecordId: cte.sourceDecisionRecordId,
      sourceEventHash: cte.sourceEventHash,
      derivation: cte.derivation,
    },
  });
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

function validateAlignmentCalculated(event, state) {
  const snapshot = event.payload.alignmentSnapshot;
  if (!snapshot) {
    addError(state, event, "AlignmentCalculated payload missing alignmentSnapshot");
    return;
  }
  if (!snapshot.id) {
    addError(state, event, "alignmentSnapshot missing id");
  }
  if (snapshot.object !== "alignmentSnapshot") {
    addError(state, event, 'alignmentSnapshot object must be "alignmentSnapshot"');
  }
  validateThreadObject(event, snapshot, state, "alignment snapshot");
  if (typeof snapshot.createdAt !== "string" || !snapshot.createdAt) {
    addError(state, event, "alignmentSnapshot missing createdAt");
  }
  for (const field of ["evidenceAlignment", "positionAlignment", "riskAlignment", "overallAlignment"]) {
    const value = snapshot[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      addError(state, event, `alignmentSnapshot ${field} must be a number`);
    } else if (value < 0 || value > 1) {
      addError(state, event, `alignmentSnapshot ${field} must be between 0 and 1`);
    }
  }
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

function isAuthorizedToResolve(actorId, objection, state) {
  return actorId === objection.participantId || isDecisionOwner(actorId, state, objection.threadId);
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
