const {
  buildAdaptationState,
  projectAdaptation,
  selectAdaptationForThread
} = require("./adaptation");
const {
  buildAmendmentState,
  projectAmendments,
  selectAmendmentsForThread
} = require("./amendments");
const {
  buildAttributionState,
  projectAttribution,
  selectAttributionForThread
} = require("./attribution");
const {
  buildCompatibilityState,
  projectCompatibility
} = require("./compatibility");
const {
  buildDelegationState,
  projectDelegation,
  selectDelegationForThread
} = require("./delegation");
const {
  buildExecutionState,
  projectExecution,
  selectExecutionForThread
} = require("./execution");
const {
  buildOutcomeState: buildProtocolOutcomeState,
  projectOutcome,
  selectOutcomeForThread
} = require("./outcome");
const {
  buildOutcomeLearningState,
  projectOutcomeLearning,
  selectOutcomeLearningForThread
} = require("./outcome-learning");
const {
  buildReviewState,
  projectReview,
  selectReviewForThread
} = require("./review");
const {
  buildRecoveryState,
  projectRecovery,
  selectRecoveryForThread
} = require("./recovery");
const {
  buildFederationState,
  projectFederation,
  selectFederationForThread
} = require("./federation");
const { buildIdentityState, projectIdentity } = require("./identity");
const { PROTOCOL_VERSION, verifyEventIntegrity } = require("./integrity");
const {
  buildInteroperabilityState,
  projectInteroperability
} = require("./interoperability");
const {
  buildLearningState,
  projectLearning,
  selectLearningForThread
} = require("./learning");
const { evaluateMergeEligibility } = require("./merges");
const {
  buildNegotiationState,
  projectNegotiation,
  selectNegotiationForThread
} = require("./negotiation");
const {
  buildProvenanceState,
  projectProvenance,
  selectProvenanceForThread
} = require("./provenance");
const { unique } = require("./utils");
const { primaryObject } = require("./event-types");

function emptyProjection() {
  return {
    schema: "clista.projection.v0",
    // Deterministic by construction: set to the latest event's timestamp after the
    // fold in projectEvents (null for an empty log). Never wall-clock, so the same
    // events always project to byte-identical state.
    projectedAt: null,
    participants: {},
    threads: {},
    forks: {},
    evidence: {},
    assumptions: {},
    claims: {},
    positions: {},
    objections: {},
    decisionRequests: {},
    reviews: {},
    decisionRecords: {},
    reviewTriggers: {},
    minorityReports: {},
    mergeRequests: {},
    mergeReviews: {},
    mergeConflicts: {},
    mergeConflictResolutions: {},
    mergeCompletions: {},
    expectedOutcomes: {},
    outcomeAudits: {},
    decisionScores: {},
    alignmentSnapshots: {},
    identity: {
      schema: "clista.identity.v0",
      participants: [],
      roles: [],
      activeAuthorities: [],
      revokedAuthorities: [],
      authorityHistory: [],
      identityValidationStatus: {
        valid: true,
        participantCount: 0,
        activeAuthorityCount: 0,
        revokedAuthorityCount: 0
      }
    },
    attribution: {
      schema: "clista.attribution.v0",
      attributions: [],
      byContribution: {},
      byParticipant: {},
      byEvent: {},
      corrections: [],
      disputes: [],
      revocations: [],
      attributionValidationStatus: {
        valid: true,
        attributionCount: 0,
        correctedCount: 0,
        disputedCount: 0,
        revokedCount: 0
      }
    },
    provenance: {
      schema: "clista.provenance.v0",
      theorem: "trusted_contribution = verify(attribution + source_provenance)",
      provenance: [],
      byContribution: {},
      bySource: {},
      byEvent: {},
      corrections: [],
      disputes: [],
      revocations: [],
      provenanceValidationStatus: {
        valid: true,
        provenanceCount: 0,
        sourceTypes: [],
        transformations: [],
        correctedCount: 0,
        disputedCount: 0,
        revokedCount: 0
      }
    },
    learning: {
      schema: "clista.learning.v0",
      theorem: "protocol_learning = update(reasoning_patterns, outcome_evidence)",
      hardLaw: "learning != reputation",
      patterns: [],
      signals: [],
      outcomeCorrelations: [],
      assumptionReviews: [],
      objectionReviews: [],
      evidenceReviews: [],
      governanceReviews: [],
      patternObservations: [],
      outcomeReviews: [],
      revisitRecommendations: [],
      bySignal: {},
      byPattern: {},
      byOutcome: {},
      learningValidationStatus: {
        valid: true,
        signalCount: 0,
        patternCount: 0,
        recommendationCount: 0,
        actorScoring: false,
        sourceScoring: false,
        modelRanking: false,
        authorityMutation: false
      }
    },
    adaptation: {
      schema: "clista.adaptation.v0",
      theorem: "governance_adaptation = recommend(governance_review, learning_signals)",
      hardLaw: "adaptation != governance mutation",
      recommendations: [],
      reviews: [],
      adaptationReviews: [],
      governanceReviewRecommendations: [],
      evidenceRequirementReviewRecommendations: [],
      revisitTriggerReviewRecommendations: [],
      decisionGateReviewRecommendations: [],
      provenanceRequirementReviewRecommendations: [],
      objectionResolutionReviewRecommendations: [],
      outcomeWindowReviewRecommendations: [],
      byRecommendation: {},
      byLearningSignal: {},
      byPattern: {},
      adaptationValidationStatus: {
        valid: true,
        recommendationCount: 0,
        reviewCount: 0,
        governanceMutation: false,
        authorityMutation: false,
        ruleMutation: false,
        thresholdMutation: false,
        participantScoring: false,
        sourceScoring: false,
        modelRanking: false,
        agentRanking: false
      }
    },
    amendments: {
      schema: "clista.amendments.v0",
      theorem: "authorized_protocol_change = approve(amendment, governance_authority)",
      hardLaw: "recommendation != amendment",
      amendments: [],
      activeAmendments: [],
      pendingAmendments: [],
      rejectedAmendments: [],
      supersededAmendments: [],
      proposals: [],
      reviews: [],
      approvals: [],
      rejections: [],
      supersessions: [],
      byAmendment: {},
      historyByAmendment: {},
      byAdaptationRecommendation: {},
      byLearningSignal: {},
      amendmentValidationStatus: {
        valid: true,
        amendmentCount: 0,
        activeCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        supersededCount: 0,
        implicitMutation: false,
        automaticAmendment: false,
        retroactiveMutation: false,
        recommendationBecomesAmendment: false
      }
    },
    compatibility: {
      schema: "clista.compatibility.v0",
      theorem: "protocol_compatibility = verify(capability_set, amendment_state, validation_requirements)",
      hardLaw: "unsupported_state != valid_state",
      compatibilityProtocolVersion: "0.24.0",
      localProtocolVersion: PROTOCOL_VERSION,
      localCapabilitySet: [],
      supportedContinuityProtocolVersions: [],
      supportedContinuitySchemaVersions: [],
      supportedVerificationLayers: [],
      supportedAmendmentTypes: [],
      declarations: [],
      checks: [],
      failures: [],
      degradations: [],
      acceptances: [],
      byCheck: {},
      compatibilityValidationStatus: {
        valid: true,
        capabilityCount: 0,
        verificationLayerCount: 0,
        checkCount: 0,
        failureCount: 0,
        degradationCount: 0,
        acceptanceCount: 0,
        unsupportedStateAccepted: false,
        bestEffortAcceptance: false,
        silentDowngrade: false,
        importedStateMutation: false,
        governanceApproval: false,
        amendmentApproval: false
      }
    },
    interoperability: {
      schema: "clista.interoperability.v0",
      theorem: "protocol_interoperability = preserve(meaning, across_compatible_contexts)",
      hardLaw: "translation != reinterpretation",
      interoperabilityProtocolVersion: "0.24.0",
      localProtocolVersion: PROTOCOL_VERSION,
      supportedExchangeFormats: [],
      supportedSemantics: [],
      supportedEventTypes: [],
      objectSemantics: {},
      profiles: [],
      mappings: [],
      checks: [],
      degradations: [],
      failures: [],
      acceptances: [],
      byProfile: {},
      byMapping: {},
      interoperabilityValidationStatus: {
        valid: true,
        semanticCount: 0,
        eventTypeCount: 0,
        profileCount: 0,
        mappingCount: 0,
        checkCount: 0,
        degradationCount: 0,
        failureCount: 0,
        acceptanceCount: 0,
        semanticLossAccepted: false,
        semanticReinterpretation: false,
        silentSemanticDegradation: false,
        authorityFlattened: false,
        provenanceFlattened: false,
        learningSignalsAsScores: false,
        adaptationRecommendationsAsAmendments: false,
        continuityAsTranscriptSummary: false
      }
    },
    federation: {
      schema: "clista.federation.v0",
      theorem: "protocol_federation = align(independent_reasoning_states, shared_protocol_rules)",
      hardLaw: "shared_state != shared_authority",
      federationProtocolVersion: "0.18.0",
      localProtocolVersion: PROTOCOL_VERSION,
      statuses: ["accepted", "degraded", "rejected", "pending"],
      contexts: [],
      peers: [],
      references: [],
      verifications: [],
      rejections: [],
      boundaries: [],
      byContext: {},
      byPeer: {},
      byReference: {},
      byVerification: {},
      byRejection: {},
      boundariesByReference: {},
      federationValidationStatus: {
        valid: true,
        contextCount: 0,
        peerCount: 0,
        referenceCount: 0,
        verificationCount: 0,
        rejectionCount: 0,
        boundaryCount: 0,
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
    },
    negotiation: {
      schema: "clista.negotiation.v0",
      theorem: "protocol_negotiation = agree(exchange_terms, across_independent_contexts)",
      hardLaw: "agreement != governance merger",
      negotiationProtocolVersion: "0.18.0",
      localProtocolVersion: PROTOCOL_VERSION,
      statuses: ["proposed", "accepted", "degraded", "rejected"],
      requests: [],
      constraints: [],
      differences: [],
      terms: [],
      proposedTerms: [],
      acceptedTerms: [],
      rejectedTerms: [],
      degradedTerms: [],
      failures: [],
      byRequest: {},
      byConstraint: {},
      byDifference: {},
      byTerm: {},
      byFailure: {},
      differencesByNegotiation: {},
      termsByNegotiation: {},
      failuresByNegotiation: {},
      negotiationValidationStatus: {
        valid: true,
        requestCount: 0,
        constraintCount: 0,
        differenceCount: 0,
        termsCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        degradedCount: 0,
        failureCount: 0,
        authorityTransfer: false,
        remoteAuthorityImported: false,
        governanceMerge: false,
        automaticAmendmentAdoption: false,
        automaticConsensus: false,
        remoteStateMutation: false,
        silentDowngrade: false,
        negotiationAcceptanceAsAmendment: false
      }
    },
    delegation: {
      schema: "clista.delegation.v0",
      theorem: "protocol_delegation = authorize(scoped_action, accountable_actor)",
      hardLaw: "delegation != authority surrender",
      delegationProtocolVersion: "0.19.0",
      localProtocolVersion: PROTOCOL_VERSION,
      statuses: ["active", "revoked", "expired", "violated"],
      grants: [],
      activeGrants: [],
      revokedGrants: [],
      expiredGrants: [],
      violatedGrants: [],
      actions: [],
      revocations: [],
      expirations: [],
      violations: [],
      byGrant: {},
      byAction: {},
      byRevocation: {},
      byExpiration: {},
      byViolation: {},
      actionsByDelegation: {},
      revocationsByDelegation: {},
      expirationsByDelegation: {},
      violationsByDelegation: {},
      delegationValidationStatus: {
        valid: true,
        grantCount: 0,
        activeGrantCount: 0,
        actionCount: 0,
        revocationCount: 0,
        expirationCount: 0,
        violationCount: 0,
        authoritySurrender: false,
        authorityTransfer: false,
        unboundedAction: false,
        delegationWithoutAttribution: false,
        governanceMutation: false,
        automaticConsensus: false,
        delegatedConsensus: false
      }
    },
    execution: {
      schema: "clista.execution.v0",
      theorem: "protocol_execution = perform(authorized_action, under_verified_constraints)",
      hardLaw: "execution != intent",
      executionProtocolVersion: "0.20.0",
      localProtocolVersion: PROTOCOL_VERSION,
      statuses: ["active", "completed", "failed", "rolled_back", "violated"],
      records: [],
      active: [],
      completed: [],
      failed: [],
      rolled_back: [],
      violated: [],
      starts: [],
      completions: [],
      failures: [],
      rollbacks: [],
      violations: [],
      byExecution: {},
      byStart: {},
      byCompletion: {},
      byFailure: {},
      byRollback: {},
      byViolation: {},
      completionsByExecution: {},
      failuresByExecution: {},
      rollbacksByExecution: {},
      violationsByExecution: {},
      executionValidationStatus: {
        valid: true,
        recordCount: 0,
        activeCount: 0,
        completedCount: 0,
        failedCount: 0,
        rolledBackCount: 0,
        violationCount: 0,
        authorityCreated: false,
        executionAsAuthorization: false,
        consensusCreated: false,
        executionAsConsensus: false,
        governanceApproval: false,
        amendmentApproval: false,
        completionByAssertionOnly: false,
        silentCompletion: false,
        silentFailure: false,
        silentRollback: false
      }
    },
    outcome: {
      schema: "clista.outcome.v0",
      theorem: "protocol_outcome = evaluate(execution_result, against_intended_effect)",
      hardLaw: "completion != success",
      outcomeProtocolVersion: "0.21.0",
      localProtocolVersion: PROTOCOL_VERSION,
      statuses: ["pending", "observed", "evaluated", "disputed", "violated"],
      evaluationResults: ["success", "partial_success", "failure", "inconclusive"],
      records: [],
      expected: [],
      pending: [],
      observed: [],
      evaluated: [],
      disputed: [],
      violated: [],
      observations: [],
      evaluations: [],
      disputes: [],
      violations: [],
      byOutcome: {},
      byExpected: {},
      byObservation: {},
      byEvaluation: {},
      byDispute: {},
      byViolation: {},
      observationsByOutcome: {},
      evaluationsByOutcome: {},
      disputesByOutcome: {},
      violationsByOutcome: {},
      outcomeValidationStatus: {
        valid: true,
        recordCount: 0,
        pendingCount: 0,
        observedCount: 0,
        evaluatedCount: 0,
        disputeCount: 0,
        violationCount: 0,
        completionAsSuccess: false,
        successByAssertion: false,
        outcomeAsConsensus: false,
        consensusCreated: false,
        governanceApproval: false,
        amendmentApproval: false,
        authorityCreated: false,
        retroactiveExpectedEffect: false,
        unmeasuredImpactAchieved: false,
        silentUnintendedConsequence: false,
        governanceMutation: false,
        stateMutation: false
      }
    },
    outcomeLearning: {
      schema: "clista.outcome_learning.v0",
      theorem: "protocol_outcome_learning = derive(adaptation_signal, from_evaluated_outcome)",
      hardLaw: "learning != retroactive justification",
      outcomeLearningProtocolVersion: "0.22.0",
      localProtocolVersion: PROTOCOL_VERSION,
      signals: [],
      lessons: [],
      disputes: [],
      violations: [],
      bySignal: {},
      byLesson: {},
      byDispute: {},
      byViolation: {},
      lessonsBySignal: {},
      disputesByLearning: {},
      violationsByLearning: {},
      signalsByOutcome: {},
      lessonsByOutcome: {},
      disputesByOutcome: {},
      violationsByOutcome: {},
      outcomeLearningValidationStatus: {
        valid: true,
        signalCount: 0,
        lessonCount: 0,
        disputeCount: 0,
        violationCount: 0,
        retroactiveJustification: false,
        priorRationaleRewritten: false,
        intendedEffectRewritten: false,
        governanceMutation: false,
        authorityMutation: false,
        learningFromUnevaluatedOutcome: false,
        universalTruthClaim: false,
        failureRecastAsSuccess: false,
        outcomeSuccessMutation: false,
        stateMutation: false
      }
    },
    review: {
      schema: "clista.review.v0",
      theorem: "protocol_review = route(state_change, through_required_review)",
      hardLaw: "review != approval",
      reviewProtocolVersion: "0.23.0",
      localProtocolVersion: PROTOCOL_VERSION,
      statuses: ["required", "open", "reviewed", "disputed", "violated"],
      triggerTypes: [],
      records: [],
      required: [],
      open: [],
      completed: [],
      disputed: [],
      violated: [],
      completions: [],
      disputes: [],
      violations: [],
      byReview: {},
      bySubject: {},
      completionsByReview: {},
      disputesByReview: {},
      violationsByReview: {},
      reviewValidationStatus: {
        valid: true,
        recordCount: 0,
        requiredCount: 0,
        openCount: 0,
        completedCount: 0,
        disputeCount: 0,
        violationCount: 0,
        pendingRequiredCount: 0,
        reviewAsApproval: false,
        governanceMutation: false,
        authorityCreated: false,
        consensusCreated: false,
        amendmentApproval: false,
        recoveryPerformed: false,
        rollbackPerformed: false,
        accountabilityScoreAssigned: false,
        blameAssigned: false,
        stateMutation: false
      }
    },
    recovery: {
      schema: "clista.recovery.v0",
      theorem: "protocol_recovery = restore(valid_state, from_verified_checkpoint_and_repair_log)",
      hardLaw: "recovery != history rewrite",
      recoveryProtocolVersion: "0.24.0",
      localProtocolVersion: PROTOCOL_VERSION,
      statuses: [
        "requested",
        "planned",
        "quarantined",
        "emergency_quarantined",
        "applied",
        "verified",
        "violated"
      ],
      checkpointTypes: [],
      subjectTypes: [],
      records: [],
      requested: [],
      planned: [],
      quarantined: [],
      applied: [],
      verified: [],
      violated: [],
      pendingReview: [],
      emergencyQuarantined: [],
      trusted_state_refs: [],
      quarantined_subjects: [],
      requests: [],
      plans: [],
      quarantines: [],
      applications: [],
      verifications: [],
      violations: [],
      byRecovery: {},
      bySubject: {},
      plansByRecovery: {},
      quarantinesByRecovery: {},
      applicationsByRecovery: {},
      verificationsByRecovery: {},
      violationsByRecovery: {},
      recoveryValidationStatus: {
        valid: true,
        recordCount: 0,
        requestedCount: 0,
        plannedCount: 0,
        quarantinedCount: 0,
        emergencyQuarantinedCount: 0,
        appliedCount: 0,
        verifiedCount: 0,
        violationCount: 0,
        pendingReviewCount: 0,
        quarantinedSubjectCount: 0,
        trustedStateRefCount: 0,
        historyRewrite: false,
        eventDeletion: false,
        eventReplacement: false,
        silentRepair: false,
        recoveryAsApproval: false,
        recoveryAsAmendment: false,
        recoveryAsConsensus: false,
        authorityCreated: false,
        governanceMutation: false,
        unverifiedCheckpoint: false,
        restoredStateHashMismatch: false
      }
    },
    events: []
  };
}

function projectEvents(events) {
  const projection = emptyProjection();

  for (const event of events) {
    projection.events.push(clone(event));
    const payload = clone(event.payload || {});

    switch (eventType(event)) {
      case "ParticipantAdded":
        upsert(projection.participants, payload.participant);
        break;
      case "ParticipantDeclared":
        upsert(projection.participants, payload.participant);
        break;
      case "ParticipantRoleAssigned":
      case "ParticipantAuthorityGranted":
      case "ParticipantAuthorityRevoked":
        break;
      case "ContributionAttributed":
      case "ContributionAttributionCorrected":
      case "ContributionAttributionDisputed":
      case "ContributionAttributionRevoked":
        break;
      case "LearningSignalRecorded":
      case "PatternObservationRecorded":
      case "OutcomeReviewRecorded":
      case "LearningRecommendationRecorded":
      case "AdaptationReviewRecorded":
      case "GovernanceReviewRecommended":
      case "EvidenceRequirementReviewRecommended":
      case "RevisitTriggerReviewRecommended":
      case "DecisionGateReviewRecommended":
      case "ProtocolAmendmentProposed":
      case "ProtocolAmendmentReviewed":
      case "ProtocolAmendmentApproved":
      case "ProtocolAmendmentRejected":
      case "ProtocolAmendmentSuperseded":
      case "CompatibilityCheckRecorded":
      case "CapabilitySetDeclared":
      case "CompatibilityFailureRecorded":
      case "CompatibilityDegradationRecorded":
      case "CompatibilityAcceptanceRecorded":
      case "InteroperabilityProfileDeclared":
      case "SemanticMappingRecorded":
      case "InteroperabilityCheckRecorded":
      case "SemanticDegradationRecorded":
      case "InteroperabilityFailureRecorded":
      case "InteroperabilityAcceptanceRecorded":
      case "FederationContextDeclared":
      case "FederationPeerRecorded":
      case "FederatedStateReferenceRecorded":
      case "FederatedPacketVerified":
      case "FederatedPacketRejected":
      case "FederationBoundaryRecorded":
      case "NegotiationRequested":
      case "NegotiationConstraintDeclared":
      case "NegotiationDifferenceRecorded":
      case "NegotiationTermsProposed":
      case "NegotiationTermsAccepted":
      case "NegotiationTermsRejected":
      case "NegotiationDegradationAccepted":
      case "NegotiationFailureRecorded":
      case "DelegationGranted":
      case "DelegatedActionRecorded":
      case "DelegationRevoked":
      case "DelegationExpired":
      case "DelegationViolationRecorded":
      case "ExecutionStarted":
      case "ExecutionCompleted":
      case "ExecutionFailed":
      case "ExecutionRolledBack":
      case "ExecutionViolationRecorded":
      case "OutcomeExpected":
      case "OutcomeObserved":
      case "OutcomeEvaluated":
      case "OutcomeDisputed":
      case "OutcomeViolationRecorded":
      case "LearningSignalDerived":
      case "LessonRecorded":
      case "LearningDisputed":
      case "LearningViolationRecorded":
      case "ReviewRequired":
      case "ReviewOpened":
      case "ReviewCompleted":
      case "ReviewDisputed":
      case "ReviewViolationRecorded":
      case "RecoveryRequested":
      case "RecoveryPlanCreated":
      case "RecoveryQuarantined":
      case "RecoveryApplied":
      case "RecoveryVerified":
      case "RecoveryViolationRecorded":
        break;
      case "ThreadCreated":
        upsert(projection.threads, payload.thread);
        break;
      case "ThreadForked":
        applyThreadFork(projection, payload.threadFork, eventTimestamp(event));
        break;
      case "EvidenceCommitted":
        upsert(projection.evidence, payload.evidence);
        touchThread(projection, payload.evidence?.threadId, eventTimestamp(event));
        break;
      case "AssumptionDeclared":
        upsert(projection.assumptions, payload.assumption);
        touchThread(projection, payload.assumption?.threadId, eventTimestamp(event));
        break;
      case "ClaimCreated":
        upsert(projection.claims, payload.claim);
        touchThread(projection, payload.claim?.threadId, eventTimestamp(event));
        break;
      case "PositionTaken":
        upsert(projection.positions, payload.position);
        touchThread(projection, payload.position?.threadId, eventTimestamp(event));
        break;
      case "ObjectionRaised":
        upsert(projection.objections, payload.objection);
        markClaimContested(projection, payload.objection);
        markAssumptionContested(projection, payload.objection);
        touchThread(projection, payload.objection?.threadId, eventTimestamp(event));
        break;
      case "ObjectionResolved":
        resolveObjection(
          projection,
          payload.objectionId || payload.objection?.id,
          payload.resolution || payload.objection?.resolution,
          eventThreadId(event)
        );
        break;
      case "AlignmentCalculated":
        upsert(projection.alignmentSnapshots, payload.alignmentSnapshot);
        break;
      case "DecisionRequestOpened":
        upsert(projection.decisionRequests, payload.decisionRequest);
        setThreadStatus(projection, payload.decisionRequest?.threadId, "review", eventTimestamp(event));
        break;
      case "ReviewSubmitted":
        upsert(projection.reviews, payload.review);
        applyReviewStatus(projection, payload.review);
        break;
      case "DecisionMerged":
        upsert(projection.decisionRecords, payload.decisionRecord);
        applyDecisionRecord(projection, payload.decisionRecord, eventTimestamp(event));
        break;
      case "ReviewTriggered":
        upsert(projection.reviewTriggers, payload.reviewTrigger);
        applyReviewTrigger(projection, payload.reviewTrigger, eventTimestamp(event));
        break;
      case "MinorityReportFiled":
        upsert(projection.minorityReports, payload.minorityReport);
        attachMinorityReport(projection, payload.minorityReport);
        break;
      case "ExpectedOutcomeDeclared":
        upsert(projection.expectedOutcomes, payload.expectedOutcome);
        touchThread(projection, payload.expectedOutcome?.threadId, eventTimestamp(event));
        break;
      case "OutcomeAudited":
        upsert(projection.outcomeAudits, payload.outcomeAudit);
        touchThread(projection, payload.outcomeAudit?.threadId, eventTimestamp(event));
        break;
      case "DecisionScored":
        upsert(projection.decisionScores, payload.decisionScore);
        touchThread(projection, payload.decisionScore?.threadId, eventTimestamp(event));
        break;
      case "MergeRequestOpened":
        upsert(projection.mergeRequests, payload.mergeRequest);
        break;
      case "MergeReviewSubmitted":
        upsert(projection.mergeReviews, payload.mergeReview);
        applyMergeReviewStatus(projection, payload.mergeReview);
        break;
      case "MergeConflictDeclared":
        upsert(projection.mergeConflicts, payload.mergeConflict);
        break;
      case "MergeConflictResolved":
        upsert(projection.mergeConflictResolutions, payload.mergeConflictResolution);
        applyMergeConflictResolution(projection, payload.mergeConflictResolution);
        break;
      case "MergeCompleted":
        upsert(projection.mergeCompletions, payload.mergeCompletion);
        applyMergeCompletion(projection, payload.mergeCompletion, eventTimestamp(event));
        break;
      default:
        break;
    }
  }

  // Stamp the projection's "as of" time from the log itself (latest event), not
  // the wall clock, so repeated projections of the same events are byte-identical.
  projection.projectedAt = projection.events.at(-1)?.timestamp ?? null;

  const identityState = buildIdentityState(projection.events);
  projection.identity = projectIdentity(identityState);
  projection.participants = projection.identity.participants.reduce((participants, participant) => {
    participants[participant.id] = participant;
    return participants;
  }, {});
  projection.attribution = projectAttribution(buildAttributionState(projection.events), identityState);
  projection.provenance = projectProvenance(buildProvenanceState(projection.events));
  projection.learning = projectLearning(buildLearningState(projection));
  projection.adaptation = projectAdaptation(buildAdaptationState(projection));
  projection.amendments = projectAmendments(buildAmendmentState(projection.events));
  projection.compatibility = projectCompatibility(buildCompatibilityState(projection));
  projection.interoperability = projectInteroperability(buildInteroperabilityState(projection));
  projection.federation = projectFederation(buildFederationState(projection));
  projection.negotiation = projectNegotiation(buildNegotiationState(projection));
  projection.delegation = projectDelegation(buildDelegationState(projection));
  projection.execution = projectExecution(buildExecutionState(projection));
  projection.outcome = projectOutcome(buildProtocolOutcomeState(projection));
  projection.outcomeLearning = projectOutcomeLearning(buildOutcomeLearningState(projection));
  projection.review = projectReview(buildReviewState(projection));
  projection.recovery = projectRecovery(buildRecoveryState(projection));

  return projection;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function selectThreadState(projection, requestedThreadId) {
  const threadId = requestedThreadId || latestThreadId(projection);
  const thread = projection.threads[threadId];
  if (!thread) {
    return {
      schema: "clista.threadState.v0",
      threadId: threadId || null,
      error: "Thread not found"
    };
  }

  const evidence = valuesForThreadScope(projection, threadId, "evidence");
  const assumptions = valuesForThreadScope(projection, threadId, "assumptions");
  const claims = valuesForThreadScope(projection, threadId, "claims");
  const positions = latestPositions(valuesForThreadScope(projection, threadId, "positions"));
  const objections = valuesForThreadScope(projection, threadId, "objections");
  const decisionRequests = valuesForThreadScope(projection, threadId, "decisionRequests");
  const reviews = valuesForThreadScope(projection, threadId, "reviews");
  const decisionRecords = valuesForThreadScope(projection, threadId, "decisionRecords");
  const minorityReports = valuesForThreadScope(projection, threadId, "minorityReports");
  const expectedOutcomes = valuesForThreadScope(projection, threadId, "expectedOutcomes");
  const outcomeAudits = valuesForThreadScope(projection, threadId, "outcomeAudits");
  const decisionScores = valuesForThreadScope(projection, threadId, "decisionScores");
  const currentProposal = latestBy(decisionRequests, "openedAt");
  const decisionRecord = latestBy(decisionRecords, "decidedAt");
  const supportingEvidence = selectSupportingEvidence(evidence, claims, currentProposal, decisionRecord);
  const alignmentSnapshot = latestBy(valuesForThread(projection.alignmentSnapshots, threadId), "createdAt")
    || calculateAlignment(threadId, claims, positions, objections, projection.projectedAt);
  const assumptionsWithParticipants = assumptions.map((assumption) => ({
    ...assumption,
    participant: projection.participants[assumption.declaredByParticipantId] || null
  }));
  const outcomeState = buildOutcomeState({
    expectedOutcomes,
    outcomeAudits,
    decisionScores,
    assumptions: assumptionsWithParticipants,
    evidence
  });
  const positionsWithParticipants = positions.map((position) => ({
    ...position,
    participant: projection.participants[position.participantId] || null
  }));
  const objectionsWithParticipants = objections.map((objection) => ({
    ...objection,
    participant: projection.participants[objection.participantId] || null
  }));
  const unresolvedObjectionsWithParticipants = objectionsWithParticipants
    .filter((objection) => objection.status === "open" || objection.status === "preserved");
  const forkLineage = selectForkLineage(projection, threadId);
  const changedAssumptions = selectChangedObjects(assumptionsWithParticipants, forkLineage?.changedAssumptionIds);
  const divergentClaims = forkLineage ? selectDivergentClaims(claims, forkLineage.changedClaimIds) : [];
  const mergeState = selectMergeState(projection, threadId);
  const attributionState = selectAttributionForThread(projection.attribution, threadId);
  const provenanceState = selectProvenanceForThread(projection.provenance, threadId);
  const learningState = selectLearningForThread(projection.learning, threadId);
  const adaptationState = selectAdaptationForThread(projection.adaptation, threadId);
  const amendmentState = selectAmendmentsForThread(projection.amendments, threadId);
  const compatibilityState = projection.compatibility;
  const interoperabilityState = projection.interoperability;
  const federationState = selectFederationForThread(projection.federation, threadId);
  const negotiationState = selectNegotiationForThread(projection.negotiation, threadId);
  const delegationState = selectDelegationForThread(projection.delegation, threadId);
  const executionState = selectExecutionForThread(projection.execution, threadId);
  const protocolOutcomeState = selectOutcomeForThread(projection.outcome, threadId);
  const outcomeLearningState = selectOutcomeLearningForThread(projection.outcomeLearning, threadId);
  const reviewState = selectReviewForThread(projection.review, threadId);
  const recoveryState = selectRecoveryForThread(projection.recovery, threadId);
  const reasoningState = buildReasoningState({
    thread,
    evidence: supportingEvidence,
    assumptions: assumptionsWithParticipants,
    claims,
    positions: positionsWithParticipants,
    objections: objectionsWithParticipants,
    decisionRecord,
    minorityReports,
    outcomeState,
    forkLineage,
    changedAssumptions,
    divergentClaims,
    mergeState,
    attributionState,
    provenanceState,
    learningState,
    adaptationState,
    amendmentState,
    compatibilityState,
    interoperabilityState,
    federationState,
    negotiationState,
    delegationState,
    executionState,
    protocolOutcomeState,
    outcomeLearningState,
    reviewState,
    recoveryState,
    events: projection.events
  });

  return {
    schema: "clista.threadState.v0",
    projectedAt: projection.projectedAt,
    reasoningState,
    thread,
    currentProposal: currentProposal || null,
    supportingEvidence,
    assumptions: assumptionsWithParticipants,
    claims,
    participantPositions: positionsWithParticipants,
    unresolvedObjections: unresolvedObjectionsWithParticipants,
    alignmentSnapshot,
    decisionStatus: {
      requestStatus: currentProposal?.status || "none",
      recordStatus: decisionRecord?.status || "none",
      decisionRecord: decisionRecord || null,
      reviews,
      minorityReports,
      expectedOutcomes,
      outcomeAudits,
      decisionScores,
      outcomeState
    },
    outcomeState,
    forkLineage,
    changedAssumptions,
    divergentClaims,
    mergeState,
    identityState: projection.identity,
    attributionState,
    provenanceState,
    learningState,
    adaptationState,
    amendmentState,
    compatibilityState,
    interoperabilityState,
    federationState,
    negotiationState,
    delegationState,
    executionState,
    protocolOutcomeState,
    outcomeLearningState,
    reviewState,
    recoveryState,
    auditTrail: auditTrailForThread(projection, threadId)
  };
}

function buildReasoningState({
  thread,
  evidence,
  assumptions,
  claims,
  positions,
  objections,
  decisionRecord,
  minorityReports,
  outcomeState,
  forkLineage,
  changedAssumptions,
  divergentClaims,
  mergeState,
  attributionState,
  provenanceState,
  learningState,
  adaptationState,
  amendmentState,
  compatibilityState,
  interoperabilityState,
  federationState,
  negotiationState,
  delegationState,
  executionState,
  protocolOutcomeState,
  outcomeLearningState,
  reviewState,
  recoveryState,
  events
}) {
  return {
    question: thread.question,
    decision: decisionRecord
      ? {
          id: decisionRecord.id,
          status: decisionRecord.status,
          summary: decisionRecord.summary
        }
      : null,
    rationale: decisionRecord?.rationale || null,
    assumptions,
    evidence,
    claims,
    positions,
    objections,
    minority_reports: minorityReports,
    expected_outcomes: outcomeState.expectedOutcomes,
    outcome_audits: outcomeState.outcomeAudits,
    decision_score: outcomeState.latestDecisionScore,
    outcome_status: outcomeState.status,
    failed_assumptions: outcomeState.failedAssumptions,
    failed_evidence: outcomeState.failedEvidence,
    fork_lineage: forkLineage,
    changed_assumptions: changedAssumptions,
    divergent_claims: divergentClaims,
    merge_requests: mergeState.requests,
    merge_completions: mergeState.completed,
    attribution: attributionState,
    provenance: provenanceState,
    learning: learningState,
    adaptation: adaptationState,
    amendments: amendmentState,
    compatibility: compatibilityState,
    interoperability: interoperabilityState,
    federation: federationState,
    negotiation: negotiationState,
    delegation: delegationState,
    execution: executionState,
    outcome: protocolOutcomeState,
    outcome_learning: outcomeLearningState,
    review: reviewState,
    recovery: recoveryState,
    next_action: decisionRecord?.nextAction || null,
    audit_summary: {
      source: "append_only_event_log",
      events_replayed: events.length,
      external_state_used: false
    }
  };
}

function selectAudit(projection, requestedThreadId) {
  const threadId = requestedThreadId || latestThreadId(projection);
  const state = selectThreadState(projection, threadId);
  if (state.error) {
    return state;
  }
  return {
    schema: "clista.audit.v0",
    projectedAt: projection.projectedAt,
    thread: state.thread,
    decisionStatus: state.decisionStatus,
    auditTrail: state.auditTrail,
    evidence: state.supportingEvidence,
    assumptions: state.assumptions,
    claims: state.claims,
    positions: state.participantPositions,
    objections: state.unresolvedObjections,
    mergeState: state.mergeState
  };
}

// A concise answer to the four questions a reader actually has about a thread:
// what was decided, why, who dissented, and what should happen next. Reuses the
// full thread-state projection but surfaces only the decision-relevant slice, so
// the answer does not require reading the entire reasoning state.
function selectDecisionSummary(projection, requestedThreadId) {
  const threadId = requestedThreadId || latestThreadId(projection);
  const state = selectThreadState(projection, threadId);
  if (state.error) {
    return { schema: "clista.decisionSummary.v0", threadId: threadId || null, error: state.error };
  }

  const name = (participantId) =>
    projection.participants[participantId]?.name || participantId || null;
  const byId = (collection) => Object.fromEntries(collection.map((object) => [object.id, object]));
  const resolve = (ids, lookup, shape) =>
    (ids || []).map((id) => lookup[id]).filter(Boolean).map(shape);

  const evidenceById = byId(valuesForThreadScope(projection, threadId, "evidence"));
  const claimsById = byId(valuesForThreadScope(projection, threadId, "claims"));
  const assumptionsById = byId(valuesForThreadScope(projection, threadId, "assumptions"));

  const decisionRecord = state.decisionStatus.decisionRecord;
  const proposal = state.currentProposal;
  const support = decisionRecord || proposal || {};
  // A re-review thread still HAS an in-force decision (whatWasDecided/why render
  // unchanged from the frozen record) but is flagged for re-validation — surface
  // that here so the summary view agrees with the real thread status.
  const status = state.thread.status === "re-review"
    ? "re-review"
    : (decisionRecord ? "decided" : (proposal ? "pending" : "open"));

  return {
    schema: "clista.decisionSummary.v0",
    threadId,
    title: state.thread.title,
    question: state.thread.question,
    status,
    whatWasDecided: decisionRecord
      ? {
          status: decisionRecord.status,
          summary: decisionRecord.summary,
          decidedBy: name(decisionRecord.decidedByParticipantId)
        }
      : (proposal ? { status: "pending", proposal: proposal.proposal } : null),
    why: {
      rationale: decisionRecord?.rationale || null,
      supportingEvidence: resolve(support.supportingEvidenceIds, evidenceById,
        (evidence) => ({ id: evidence.id, source: evidence.source, finding: evidence.finding })),
      supportingClaims: resolve(support.supportingClaimIds, claimsById,
        (claim) => ({ id: claim.id, text: claim.text })),
      supportingAssumptions: resolve(support.supportingAssumptionIds, assumptionsById,
        (assumption) => ({ id: assumption.id, text: assumption.text }))
    },
    whoDissented: {
      objections: state.unresolvedObjections.map((objection) => ({
        id: objection.id,
        text: objection.text,
        raisedBy: objection.participant?.name || name(objection.participantId),
        status: objection.status,
        blocking: objection.blocking !== false
      })),
      minorityReports: (state.reasoningState?.minority_reports || []).map((report) => ({
        id: report.id,
        text: report.text,
        filedBy: name(report.participantId)
      }))
    },
    whatNext: decisionRecord?.nextAction || null
  };
}

function exportProtocol(projection) {
  return {
    schema: PROTOCOL_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    exportedAt: projection.projectedAt,
    integrity: verifyEventIntegrity(projection.events),
    threads: Object.values(projection.threads),
    forks: Object.values(projection.forks),
    participants: Object.values(projection.participants),
    evidence: Object.values(projection.evidence),
    assumptions: Object.values(projection.assumptions),
    claims: Object.values(projection.claims),
    positions: Object.values(projection.positions),
    objections: Object.values(projection.objections),
    decisionRequests: Object.values(projection.decisionRequests),
    reviews: Object.values(projection.reviews),
    decisionRecords: Object.values(projection.decisionRecords),
    minorityReports: Object.values(projection.minorityReports),
    mergeRequests: Object.values(projection.mergeRequests),
    mergeReviews: Object.values(projection.mergeReviews),
    mergeConflicts: Object.values(projection.mergeConflicts),
    mergeConflictResolutions: Object.values(projection.mergeConflictResolutions),
    mergeCompletions: Object.values(projection.mergeCompletions),
    expectedOutcomes: Object.values(projection.expectedOutcomes),
    outcomeAudits: Object.values(projection.outcomeAudits),
    decisionScores: Object.values(projection.decisionScores),
    alignmentSnapshots: Object.values(projection.alignmentSnapshots),
    identity: projection.identity,
    participantRoles: projection.identity.roles,
    activeAuthorities: projection.identity.activeAuthorities,
    revokedAuthorities: projection.identity.revokedAuthorities,
    authorityHistory: projection.identity.authorityHistory,
    attribution: projection.attribution,
    contributionAttributions: projection.attribution.attributions,
    attributionCorrections: projection.attribution.corrections,
    attributionDisputes: projection.attribution.disputes,
    attributionRevocations: projection.attribution.revocations,
    provenance: projection.provenance,
    contributionProvenance: projection.provenance.provenance,
    learning: projection.learning,
    learningSignals: projection.learning.signals,
    learningPatterns: projection.learning.patterns,
    learningRecommendations: projection.learning.revisitRecommendations,
    adaptation: projection.adaptation,
    adaptationRecommendations: projection.adaptation.recommendations,
    amendments: projection.amendments,
    activeAmendments: projection.amendments.activeAmendments,
    amendmentHistory: projection.amendments.historyByAmendment,
    compatibility: projection.compatibility,
    interoperability: projection.interoperability,
    federation: projection.federation,
    negotiation: projection.negotiation,
    delegation: projection.delegation,
    execution: projection.execution,
    outcome: projection.outcome,
    outcomeLearning: projection.outcomeLearning,
    review: projection.review,
    recovery: projection.recovery,
    events: projection.events
  };
}

function upsert(collection, object) {
  if (object?.id) {
    collection[object.id] = object;
  }
}

function applyThreadFork(projection, threadFork, at) {
  if (!threadFork?.forkThreadId) {
    return;
  }
  const fork = {
    id: threadFork.id || threadFork.forkThreadId,
    object: "threadFork",
    ...threadFork
  };
  projection.forks[fork.forkThreadId] = fork;

  const parent = projection.threads[fork.parentThreadId];
  projection.threads[fork.forkThreadId] = {
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
    createdAt: fork.forkedAt || at,
    updatedAt: fork.forkedAt || at
  };
}

function touchThread(projection, threadId, at) {
  if (projection.threads[threadId]) {
    projection.threads[threadId] = {
      ...projection.threads[threadId],
      updatedAt: at || projection.threads[threadId].updatedAt
    };
  }
}

function setThreadStatus(projection, threadId, status, at) {
  if (projection.threads[threadId]) {
    projection.threads[threadId] = {
      ...projection.threads[threadId],
      status,
      updatedAt: at || projection.threads[threadId].updatedAt
    };
  }
}

function markClaimContested(projection, objection) {
  const claim = projection.claims[objection?.targetObjectId];
  if (objection?.targetObjectType === "claim" && claim?.threadId === objection.threadId) {
    projection.claims[objection.targetObjectId] = {
      ...claim,
      status: "contested"
    };
  }
}

function markAssumptionContested(projection, objection) {
  const assumption = projection.assumptions[objection?.targetObjectId];
  if (objection?.targetObjectType === "assumption" && assumption?.threadId === objection.threadId) {
    projection.assumptions[objection.targetObjectId] = {
      ...assumption,
      status: "contested"
    };
  }
}

function resolveObjection(projection, objectionId, resolution, threadId) {
  const objection = projection.objections[objectionId];
  if (!objection || objection.threadId !== threadId) {
    return;
  }
  projection.objections[objectionId] = {
    ...objection,
    status: "resolved",
    resolution
  };
}

function applyReviewStatus(projection, review) {
  const request = projection.decisionRequests[review?.decisionRequestId];
  if (!request || request.threadId !== review?.threadId) {
    return;
  }
  if (review.status === "request_changes") {
    request.status = "changes_requested";
  }
}

function applyDecisionRecord(projection, decisionRecord, at) {
  if (!decisionRecord) {
    return;
  }
  const request = projection.decisionRequests[decisionRecord.decisionRequestId];
  if (request?.threadId === decisionRecord.threadId) {
    request.status = decisionRecord.status === "approved" ? "merged" : "rejected";
  }
  for (const objectionId of decisionRecord.preservedObjectionIds || []) {
    if (projection.objections[objectionId]?.threadId === decisionRecord.threadId) {
      projection.objections[objectionId] = {
        ...projection.objections[objectionId],
        status: "preserved"
      };
    }
  }
  setThreadStatus(projection, decisionRecord.threadId, "decided", at);
}

// A post-decision objection flagged the in-force decision for re-validation.
// The decision record is untouched (snapshot stays frozen) — only the thread
// status flips to "re-review". Because events replay in order and the
// DecisionMerged that set "decided" is always earlier in the log, a full replay
// deterministically resolves to "re-review".
function applyReviewTrigger(projection, reviewTrigger, at) {
  if (!reviewTrigger) {
    return;
  }
  setThreadStatus(projection, reviewTrigger.threadId, "re-review", at);
}

function attachMinorityReport(projection, minorityReport) {
  if (!minorityReport) {
    return;
  }
  const record = projection.decisionRecords[minorityReport.decisionRecordId];
  if (record) {
    const ids = new Set(record.minorityReportIds || []);
    ids.add(minorityReport.id);
    record.minorityReportIds = Array.from(ids);
  }
}

function applyMergeReviewStatus(projection, review) {
  const request = projection.mergeRequests[review?.mergeRequestId];
  if (!request || request.targetThreadId !== review?.threadId) {
    return;
  }
  if (review.status === "request_changes") {
    request.status = "changes_requested";
  } else if (review.status === "reject") {
    request.status = "rejected";
  }
}

function applyMergeConflictResolution(projection, resolution) {
  if (!resolution?.conflictId) {
    return;
  }
  const conflict = projection.mergeConflicts[resolution.conflictId];
  if (conflict) {
    projection.mergeConflicts[conflict.id] = {
      ...conflict,
      status: "resolved",
      resolution
    };
  }
}

function applyMergeCompletion(projection, completion, at) {
  if (!completion) {
    return;
  }
  const request = projection.mergeRequests[completion.mergeRequestId];
  if (request) {
    request.status = "merged";
    touchThread(projection, request.targetThreadId, at);
  }
}

function valuesForThreadScope(projection, threadId, collectionName, visited = new Set()) {
  const thread = projection.threads[threadId];
  const collection = projection[collectionName] || {};
  const directValues = valuesForThread(collection, threadId);

  if (!thread?.fork || visited.has(threadId)) {
    return [
      ...directValues,
      ...mergedValuesForThread(projection, threadId, collectionName, directValues)
    ];
  }

  visited.add(threadId);
  const fork = thread.fork;
  const parentProjection = projectEvents(eventsThroughBoundary(projection.events, fork.inheritedThroughEventId));
  const inheritedValues = valuesForThreadScope(parentProjection, fork.parentThreadId, collectionName, visited)
    .map((object) => ({
      ...object,
      inheritedFromThreadId: object.inheritedFromThreadId || fork.parentThreadId
    }));
  return [
    ...inheritedValues,
    ...directValues,
    ...mergedValuesForThread(projection, threadId, collectionName, [...inheritedValues, ...directValues])
  ];
}

function mergedValuesForThread(projection, threadId, collectionName, existingValues = []) {
  const mergeableCollections = new Set([
    "evidence",
    "assumptions",
    "claims",
    "objections",
    "decisionRecords",
    "expectedOutcomes",
    "outcomeAudits",
    "decisionScores"
  ]);
  if (!mergeableCollections.has(collectionName)) {
    return [];
  }
  const existingIds = new Set(existingValues.map((object) => object.id));
  const merged = [];
  for (const completion of Object.values(projection.mergeCompletions)) {
    const request = projection.mergeRequests[completion.mergeRequestId];
    if (!request || request.targetThreadId !== threadId) {
      continue;
    }
    const sourceValues = valuesForThreadScope(projection, request.sourceForkThreadId, collectionName);
    for (const object of sourceValues) {
      if (!(completion.acceptedObjectIds || []).includes(object.id) || existingIds.has(object.id)) {
        continue;
      }
      if (object.inheritedFromThreadId && object.inheritedFromThreadId === threadId) {
        continue;
      }
      existingIds.add(object.id);
      merged.push({
        ...object,
        threadId,
        sourceObjectId: object.id,
        sourceThreadId: object.threadId,
        mergedFromThreadId: request.sourceForkThreadId,
        mergeRequestId: request.id,
        mergeCompletionId: completion.id,
        status: collectionName === "objections" && (completion.preservedObjectionIds || []).includes(object.id)
          ? "preserved"
          : object.status
      });
    }
  }
  return merged;
}

function eventsThroughBoundary(events, inheritedThroughEventId) {
  const boundaryIndex = events.findIndex((event) => eventId(event) === inheritedThroughEventId);
  if (boundaryIndex === -1) {
    return [];
  }
  return events.slice(0, boundaryIndex + 1);
}

function selectChangedObjects(objects, ids = []) {
  const wanted = new Set(ids || []);
  return objects.filter((object) => wanted.has(object.id));
}

function selectDivergentClaims(claims, changedClaimIds = []) {
  const wanted = new Set(changedClaimIds || []);
  return claims.filter((claim) => wanted.has(claim.id) || !claim.inheritedFromThreadId);
}

function selectMergeState(projection, threadId) {
  const requests = Object.values(projection.mergeRequests)
    .filter((request) => request.targetThreadId === threadId || request.sourceForkThreadId === threadId)
    .map((request) => selectMergeRequestState(projection, request.id));
  return {
    schema: "clista.mergeState.v0",
    threadId,
    requests,
    open: requests.filter((request) => !request.completion),
    completed: requests.filter((request) => request.completion),
    preservedDissent: requests.flatMap((request) => request.preservedObjections),
    rejectedObjects: requests.flatMap((request) => request.rejectedObjects)
  };
}

function selectMergeRequestState(projection, requestId) {
  const request = projection.mergeRequests[requestId];
  if (!request) {
    return {
      schema: "clista.mergeRequestState.v0",
      requestId,
      error: "Merge request not found"
    };
  }
  const reviews = Object.values(projection.mergeReviews)
    .filter((review) => review.mergeRequestId === request.id);
  const conflicts = Object.values(projection.mergeConflicts)
    .filter((conflict) => conflict.mergeRequestId === request.id);
  const resolutions = Object.values(projection.mergeConflictResolutions)
    .filter((resolution) => resolution.mergeRequestId === request.id);
  const completion = Object.values(projection.mergeCompletions)
    .find((candidate) => candidate.mergeRequestId === request.id) || null;
  const proposedObjects = selectProposedMergeObjects(projection, request);
  return {
    schema: "clista.mergeRequestState.v0",
    request,
    sourceForkThread: projection.threads[request.sourceForkThreadId] || null,
    targetThread: projection.threads[request.targetThreadId] || null,
    forkLineage: selectForkLineage(projection, request.sourceForkThreadId),
    proposedObjects,
    reviews,
    conflicts,
    resolutions,
    eligibility: evaluateMergeEligibility(projection.events, request.id),
    completion,
    acceptedObjects: completion ? selectObjectsByIds(proposedObjects.all, completion.acceptedObjectIds) : [],
    preservedObjections: completion ? selectObjectsByIds(proposedObjects.objections, completion.preservedObjectionIds) : [],
    rejectedObjects: completion ? selectObjectsByIds(proposedObjects.all, completion.rejectedObjectIds) : [],
    auditTrail: auditTrailForMergeRequest(projection, request.id)
  };
}

function selectProposedMergeObjects(projection, request) {
  const sourceObjects = objectsForThreadScope(projection, request.sourceForkThreadId);
  const assumptions = selectObjectsByIds(sourceObjects.assumptions, request.proposedAssumptionIds);
  const evidence = selectObjectsByIds(sourceObjects.evidence, request.proposedEvidenceIds);
  const claims = selectObjectsByIds(sourceObjects.claims, request.proposedClaimIds);
  const objections = selectObjectsByIds(sourceObjects.objections, request.proposedObjectionIds);
  const decisionRecords = selectObjectsByIds(sourceObjects.decisionRecords, request.proposedDecisionRecordIds);
  const all = [
    ...assumptions,
    ...evidence,
    ...claims,
    ...objections,
    ...decisionRecords
  ];
  return {
    assumptions,
    evidence,
    claims,
    objections,
    decisionRecords,
    all
  };
}

function objectsForThreadScope(projection, threadId) {
  return {
    evidence: valuesForThreadScope(projection, threadId, "evidence"),
    assumptions: valuesForThreadScope(projection, threadId, "assumptions"),
    claims: valuesForThreadScope(projection, threadId, "claims"),
    objections: valuesForThreadScope(projection, threadId, "objections"),
    decisionRecords: valuesForThreadScope(projection, threadId, "decisionRecords"),
    expectedOutcomes: valuesForThreadScope(projection, threadId, "expectedOutcomes"),
    outcomeAudits: valuesForThreadScope(projection, threadId, "outcomeAudits"),
    decisionScores: valuesForThreadScope(projection, threadId, "decisionScores")
  };
}

function selectObjectsByIds(objects, ids = []) {
  const byId = new Map((objects || []).map((object) => [object.id, object]));
  return (ids || []).map((id) => byId.get(id) || { id, missing: true });
}

function selectForkLineage(projection, threadId) {
  const thread = projection.threads[threadId];
  if (!thread?.fork) {
    return null;
  }
  const fork = thread.fork;
  const inheritedEvent = projection.events.find((event) => eventId(event) === fork.inheritedThroughEventId);
  return {
    parentThreadId: fork.parentThreadId,
    forkThreadId: fork.forkThreadId,
    forkTitle: fork.forkTitle,
    forkedBy: fork.forkedBy,
    forkedAt: fork.forkedAt,
    inheritedThroughEventId: fork.inheritedThroughEventId,
    inheritedThroughTimestamp: eventTimestamp(inheritedEvent) || null,
    forkReason: fork.forkReason,
    changedAssumptionIds: fork.changedAssumptionIds || [],
    changedClaimIds: fork.changedClaimIds || [],
    ancestors: forkAncestors(projection, fork.parentThreadId)
  };
}

function forkAncestors(projection, threadId) {
  const ancestors = [];
  const seen = new Set();
  let thread = projection.threads[threadId];
  while (thread?.fork && !seen.has(thread.id)) {
    seen.add(thread.id);
    ancestors.push({
      parentThreadId: thread.fork.parentThreadId,
      forkThreadId: thread.fork.forkThreadId,
      inheritedThroughEventId: thread.fork.inheritedThroughEventId,
      forkReason: thread.fork.forkReason
    });
    thread = projection.threads[thread.fork.parentThreadId];
  }
  return ancestors;
}

function buildOutcomeState({ expectedOutcomes, outcomeAudits, decisionScores, assumptions, evidence }) {
  const latestDecisionScore = latestBy(decisionScores, "scoredAt") || null;
  const failedAssumptionIds = unique(outcomeAudits.flatMap((audit) => audit.failedAssumptionIds || []));
  const failedEvidenceIds = unique(outcomeAudits.flatMap((audit) => audit.failedEvidenceIds || []));
  const assumptionsById = new Map(assumptions.map((assumption) => [assumption.id, assumption]));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  return {
    expectedOutcomes,
    outcomeAudits,
    decisionScores,
    latestDecisionScore,
    status: latestDecisionScore?.status || latestBy(outcomeAudits, "auditedAt")?.result || "unknown",
    score: latestDecisionScore?.score ?? null,
    failedAssumptions: failedAssumptionIds.map((id) => assumptionsById.get(id) || { id }),
    failedEvidence: failedEvidenceIds.map((id) => evidenceById.get(id) || { id })
  };
}

function valuesForThread(collection, threadId) {
  return Object.values(collection).filter((object) => object.threadId === threadId);
}

function latestThreadId(projection) {
  return latestBy(Object.values(projection.threads), "updatedAt")?.id;
}

// Locale-independent, code-point string ordering. localeCompare with no locale is
// ICU/Node-build dependent; this matches the bare .sort() used for hashing in
// integrity.js, keeping ordering deterministic across environments.
function compareStrings(a, b) {
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function latestBy(items, field) {
  return items
    .filter(Boolean)
    .slice()
    .sort((a, b) => compareStrings(a[field] || "", b[field] || ""))
    .at(-1);
}

function latestPositions(positions) {
  const byParticipantAndTarget = new Map();
  for (const position of positions) {
    const key = `${position.participantId}:${position.targetObjectId || "thread"}`;
    const existing = byParticipantAndTarget.get(key);
    if (!existing || compareStrings(existing.takenAt, position.takenAt) < 0) {
      byParticipantAndTarget.set(key, position);
    }
  }
  return Array.from(byParticipantAndTarget.values());
}

function selectSupportingEvidence(evidence, claims, currentProposal, decisionRecord) {
  const evidenceIds = new Set([
    ...(currentProposal?.supportingEvidenceIds || []),
    ...(decisionRecord?.supportingEvidenceIds || [])
  ]);
  const claimIds = new Set([
    ...(currentProposal?.supportingClaimIds || []),
    ...(decisionRecord?.supportingClaimIds || [])
  ]);
  for (const claim of claims) {
    if (claimIds.has(claim.id)) {
      for (const evidenceId of claim.evidenceIds || []) {
        evidenceIds.add(evidenceId);
      }
    }
  }
  if (!evidenceIds.size) {
    return evidence;
  }
  return evidence.filter((item) => evidenceIds.has(item.id));
}

function calculateAlignment(threadId, claims, positions, objections, asOf = null) {
  const evidencedClaims = claims.filter((claim) => (claim.evidenceIds || []).length > 0).length;
  const evidenceAlignment = claims.length ? evidencedClaims / claims.length : 1;
  const positionCounts = positions.reduce((counts, position) => {
    counts[position.stance] = (counts[position.stance] || 0) + 1;
    return counts;
  }, {});
  const largestPositionGroup = Math.max(0, ...Object.values(positionCounts));
  const positionAlignment = positions.length ? largestPositionGroup / positions.length : 1;
  const unresolved = objections.filter((objection) => objection.status === "open" || objection.status === "preserved").length;
  const riskAlignment = objections.length ? Math.max(0, 1 - unresolved / objections.length) : 1;
  const overallAlignment = (evidenceAlignment + positionAlignment + riskAlignment) / 3;

  return {
    id: "aln_calculated",
    object: "alignmentSnapshot",
    threadId,
    // Derived "as of" time (latest event), passed in from the projection — never
    // wall-clock, so this computed fallback snapshot is reproducible.
    createdAt: asOf,
    evidenceAlignment: round(evidenceAlignment),
    positionAlignment: round(positionAlignment),
    riskAlignment: round(riskAlignment),
    overallAlignment: round(overallAlignment),
    metadata: {
      method: "calculated_from_projected_state"
    }
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function auditTrail(events, threadId) {
  return events
    .filter((event) => !threadId || eventThreadId(event) === threadId || event.payload?.thread?.id === threadId)
    .map((event) => ({
      event_id: eventId(event),
      event_type: eventType(event),
      timestamp: eventTimestamp(event),
      actor_id: eventActorId(event),
      thread_id: eventThreadId(event) || event.payload?.thread?.id,
      object_id: primaryObject(event)?.id,
      summary: summarizeEvent(event)
    }));
}

function auditTrailForThread(projection, threadId, visited = new Set()) {
  const thread = projection.threads[threadId];
  // Stop at a non-fork thread, or if we've already walked this thread — a
  // malformed fork chain (e.g. a self- or mutually-referential parentThreadId)
  // would otherwise recurse forever. Mirrors the visited-set guard in
  // valuesForThreadScope; projection.events here may be unvalidated.
  if (!thread?.fork || visited.has(threadId)) {
    return auditTrail(projection.events, threadId);
  }

  visited.add(threadId);
  const parentProjection = projectEvents(eventsThroughBoundary(projection.events, thread.fork.inheritedThroughEventId));
  return [
    ...auditTrailForThread(parentProjection, thread.fork.parentThreadId, visited).map((entry) => ({
      ...entry,
      inherited: true,
      inheritedFromThreadId: entry.thread_id
    })),
    ...auditTrail(projection.events, threadId)
  ];
}

function auditTrailForMergeRequest(projection, requestId) {
  return projection.events
    .filter((event) => {
      const payload = event.payload || {};
      return payload.mergeRequest?.id === requestId
        || payload.mergeReview?.mergeRequestId === requestId
        || payload.mergeConflict?.mergeRequestId === requestId
        || payload.mergeConflictResolution?.mergeRequestId === requestId
        || payload.mergeCompletion?.mergeRequestId === requestId;
    })
    .map((event) => ({
      event_id: eventId(event),
      event_type: eventType(event),
      timestamp: eventTimestamp(event),
      actor_id: eventActorId(event),
      thread_id: eventThreadId(event),
      object_id: primaryObject(event)?.id,
      summary: summarizeEvent(event)
    }));
}

function eventId(event) {
  return event.event_id || event.id;
}

function eventType(event) {
  return event.event_type || event.type;
}

function eventTimestamp(event) {
  return event.timestamp || event.at;
}

function eventActorId(event) {
  return event.actor_id || event.actorId;
}

function eventThreadId(event) {
  return event.thread_id || event.threadId;
}

function summarizeEvent(event) {
  const object = primaryObject(event);
  if (!object) {
    return eventType(event);
  }
  return object.finding
    || object.text
    || object.proposal
    || object.summary
    || object.title
    || object.name
    || `${eventType(event)} ${object.id}`;
}


module.exports = {
  exportProtocol,
  projectEvents,
  selectAudit,
  selectDecisionSummary,
  selectForkLineage,
  selectMergeRequestState,
  selectMergeState,
  selectThreadState
};
