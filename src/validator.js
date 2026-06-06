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
  validateLearningRecommendation,
  validateLearningSignal,
  validateOutcomeReview,
  validatePatternObservation
} = require("./learning");
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

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
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
