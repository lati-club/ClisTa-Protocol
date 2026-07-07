// Canonical registry of every protocol event type.
//
// This is the SINGLE SOURCE OF TRUTH for which event types exist. The
// validator's `switch (event.event_type)` and the projector's
// `switch (eventType(event))` must each enumerate exactly this set — no more,
// no less. `test/event-type-registry.test.js` enforces that agreement by
// extracting both switches' case labels and asserting they equal this list.
//
// Why this exists: validator and projector historically drifted (a type added
// to one switch but not the other silently fell through — validator to a
// loud `unsupported event_type` error, projector to a silent `default: break`).
// That is the #40 / #45 fail-open class. Adding a new event type now forces
// three coordinated edits — this registry, the validator switch, and the
// projector switch — or the conformance test fails loudly. See issue #51.
//
// Maintenance: keep this array sorted and unique. When you add an event type,
// add it here AND to both switches.
const PROTOCOL_EVENT_TYPES = Object.freeze([
  "AdaptationReviewRecorded",
  "AlignmentCalculated",
  "AssumptionDeclared",
  "CapabilitySetDeclared",
  "ClaimCreated",
  "CompatibilityAcceptanceRecorded",
  "CompatibilityCheckRecorded",
  "CompatibilityDegradationRecorded",
  "CompatibilityFailureRecorded",
  "ContributionAttributed",
  "ContributionAttributionCorrected",
  "ContributionAttributionDisputed",
  "ContributionAttributionRevoked",
  "CrossThreadEvidence",
  "DecisionGateReviewRecommended",
  "DecisionMerged",
  "DecisionRequestOpened",
  "DecisionScored",
  "DelegatedActionRecorded",
  "DelegationExpired",
  "DelegationGranted",
  "DelegationRevoked",
  "DelegationViolationRecorded",
  "EvidenceCommitted",
  "EvidenceRequirementReviewRecommended",
  "ExecutionCompleted",
  "ExecutionFailed",
  "ExecutionRolledBack",
  "ExecutionStarted",
  "ExecutionViolationRecorded",
  "ExpectedOutcomeDeclared",
  "FederatedPacketRejected",
  "FederatedPacketVerified",
  "FederatedStateReferenceRecorded",
  "FederationBoundaryRecorded",
  "FederationContextDeclared",
  "FederationPeerRecorded",
  "GovernanceReviewRecommended",
  "InteroperabilityAcceptanceRecorded",
  "InteroperabilityCheckRecorded",
  "InteroperabilityFailureRecorded",
  "InteroperabilityProfileDeclared",
  "LearningDisputed",
  "LearningRecommendationRecorded",
  "LearningSignalDerived",
  "LearningSignalRecorded",
  "LearningViolationRecorded",
  "LessonRecorded",
  "MergeCompleted",
  "MergeConflictDeclared",
  "MergeConflictResolved",
  "MergeRequestOpened",
  "MergeReviewSubmitted",
  "MinorityReportFiled",
  "ModelPruned",
  "NegotiationConstraintDeclared",
  "NegotiationDegradationAccepted",
  "NegotiationDifferenceRecorded",
  "NegotiationFailureRecorded",
  "NegotiationRequested",
  "NegotiationTermsAccepted",
  "NegotiationTermsProposed",
  "NegotiationTermsRejected",
  "ObjectDeprecated",
  "ObjectionRaised",
  "ObjectionResolved",
  "OutcomeAudited",
  "OutcomeDisputed",
  "OutcomeEvaluated",
  "OutcomeExpected",
  "OutcomeObserved",
  "OutcomeReviewRecorded",
  "OutcomeViolationRecorded",
  "ParticipantAdded",
  "ParticipantAuthorityGranted",
  "ParticipantAuthorityRevoked",
  "ParticipantDeclared",
  "ParticipantRoleAssigned",
  "PatternObservationRecorded",
  "PositionTaken",
  "ProtocolAmendmentApproved",
  "ProtocolAmendmentProposed",
  "ProtocolAmendmentRejected",
  "ProtocolAmendmentReviewed",
  "ProtocolAmendmentSuperseded",
  "PruningReviewInitiated",
  "RecoveryApplied",
  "RecoveryPlanCreated",
  "RecoveryQuarantined",
  "RecoveryRequested",
  "RecoveryVerified",
  "RecoveryViolationRecorded",
  "ReviewCompleted",
  "ReviewDisputed",
  "ReviewOpened",
  "ReviewRequired",
  "ReviewSubmitted",
  "ReviewTriggered",
  "ReviewViolationRecorded",
  "RevisitTriggerReviewRecommended",
  "SemanticDegradationRecorded",
  "SemanticMappingRecorded",
  "ThreadCreated",
  "ThreadForked"
]);

const PROTOCOL_EVENT_TYPE_SET = new Set(PROTOCOL_EVENT_TYPES);

function isKnownEventType(eventType) {
  return PROTOCOL_EVENT_TYPE_SET.has(eventType);
}

module.exports = {
  PROTOCOL_EVENT_TYPES,
  PROTOCOL_EVENT_TYPE_SET,
  isKnownEventType
};
