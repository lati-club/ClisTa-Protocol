const { PROTOCOL_VERSION, contentHash } = require("./integrity");
const { groupBy, indexBy, normalizeType, stripUndefined } = require("./utils");

const RECOVERY_SCHEMA = "clista.recovery.v0";
const RECOVERY_VERIFY_SCHEMA = "clista.recovery.verify.v0";
const RECOVERY_PROTOCOL_VERSION = "0.24.0";
const RECOVERY_THEOREM = "protocol_recovery = restore(valid_state, from_verified_checkpoint_and_repair_log)";
const RECOVERY_HARD_LAW = "recovery != history rewrite";

const RECOVERY_EVENT_TYPES = new Set([
  "RecoveryRequested",
  "RecoveryPlanCreated",
  "RecoveryQuarantined",
  "RecoveryApplied",
  "RecoveryVerified",
  "RecoveryViolationRecorded"
]);

const RECOVERY_STATUSES = [
  "requested",
  "planned",
  "quarantined",
  "emergency_quarantined",
  "applied",
  "verified",
  "violated"
];

const CHECKPOINT_TYPES = new Set([
  "continuity_packet",
  "protocol_export",
  "federated_state_reference",
  "projection_boundary",
  "pre_recovery_projection_boundary"
]);

const RECOVERY_SUBJECT_TYPES = new Set([
  "invalid_event",
  "event_hash_mismatch",
  "invalid_import",
  "invalid_export",
  "invalid_continuity_packet",
  "degraded_continuity_packet",
  "failed_projection",
  "failed_validation_layer",
  "bad_compatibility_packet",
  "bad_interoperability_packet",
  "bad_federation_packet",
  "bad_negotiation_packet",
  "bad_execution_rollback",
  "bad_outcome_chain",
  "bad_outcome_learning_chain",
  "tamper_evidence",
  "hash_chain_mismatch",
  "external_artifact"
]);

const EXTERNAL_RECOVERY_SUBJECT_TYPES = new Set([
  "invalid_import",
  "invalid_export",
  "invalid_continuity_packet",
  "degraded_continuity_packet",
  "failed_projection",
  "failed_validation_layer",
  "bad_compatibility_packet",
  "bad_interoperability_packet",
  "bad_federation_packet",
  "bad_negotiation_packet",
  "tamper_evidence",
  "external_artifact"
]);

const GUARD_FIELDS = new Set([
  "eventDeleted",
  "eventDeletion",
  "deleteEvent",
  "deletedEventId",
  "eventReplaced",
  "eventReplacement",
  "replaceEvent",
  "replacementEvent",
  "historyRewrite",
  "historyRewritten",
  "rewriteHistory",
  "silentRepair",
  "repairWithoutReview",
  "recoveryAsApproval",
  "approved",
  "approval",
  "approvalStatus",
  "recoveryAsAmendment",
  "amendmentApproval",
  "amendmentApproved",
  "recoveryAsConsensus",
  "consensusCreated",
  "authorityCreated",
  "authorityMutation",
  "governanceMutation",
  "accountabilityScoreAssigned",
  "blameAssigned",
  "stateMutation"
]);

function emptyRecoveryState(reviewProjection = null) {
  return {
    requests: [],
    plans: [],
    quarantines: [],
    applications: [],
    verifications: [],
    violations: [],
    recoveryEvents: [],
    reviewProjection
  };
}

function buildRecoveryState(projection = {}) {
  const state = emptyRecoveryState(projection.review || null);
  applyExplicitRecoveryEvents(projection.events || [], state);
  return state;
}

function applyExplicitRecoveryEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "RecoveryRequested":
        addRecord(state.requests, normalizeRecoveryRequest(payload.recoveryRequest, event));
        addRecoveryEvent(state, event);
        break;
      case "RecoveryPlanCreated":
        addRecord(state.plans, normalizeRecoveryPlan(payload.recoveryPlan, event));
        addRecoveryEvent(state, event);
        break;
      case "RecoveryQuarantined":
        addRecord(state.quarantines, normalizeRecoveryQuarantine(payload.recoveryQuarantine, event));
        addRecoveryEvent(state, event);
        break;
      case "RecoveryApplied":
        addRecord(state.applications, normalizeRecoveryApplication(payload.recoveryApplication, event));
        addRecoveryEvent(state, event);
        break;
      case "RecoveryVerified":
        addRecord(state.verifications, normalizeRecoveryVerification(payload.recoveryVerification, event));
        addRecoveryEvent(state, event);
        break;
      case "RecoveryViolationRecorded":
        addRecord(state.violations, normalizeRecoveryViolation(payload.recoveryViolation, event));
        addRecoveryEvent(state, event);
        break;
      default:
        break;
    }
  }
}

function projectRecovery(state = emptyRecoveryState()) {
  const requests = state.requests.filter(Boolean);
  const plans = state.plans.filter(Boolean);
  const quarantines = state.quarantines.filter(Boolean);
  const applications = state.applications.filter(Boolean);
  const verifications = state.verifications.filter(Boolean);
  const violations = state.violations.filter(Boolean);
  const reviewProjection = state.reviewProjection || {};
  const plansByRecovery = groupBy(plans, "recoveryId");
  const quarantinesByRecovery = groupBy(quarantines, "recoveryId");
  const applicationsByRecovery = groupBy(applications, "recoveryId");
  const verificationsByRecovery = groupBy(verifications, "recoveryId");
  const violationsByRecovery = groupBy(violations, "recoveryId");
  const records = requests.map((request) => {
    const recoveryPlans = plansByRecovery[request.id] || [];
    const recoveryQuarantines = quarantinesByRecovery[request.id] || [];
    const recoveryApplications = applicationsByRecovery[request.id] || [];
    const recoveryVerifications = verificationsByRecovery[request.id] || [];
    const recoveryViolations = violationsByRecovery[request.id] || [];
    const latestPlan = recoveryPlans.at(-1);
    const latestQuarantine = recoveryQuarantines.at(-1);
    const latestApplication = recoveryApplications.at(-1);
    const latestVerification = recoveryVerifications.at(-1);
    const status = recoveryViolations.length
      ? "violated"
      : latestVerification
        ? "verified"
        : latestApplication
          ? "applied"
          : latestQuarantine
            ? latestQuarantine.status
            : latestPlan
              ? "planned"
              : "requested";

    return stripUndefined({
      ...request,
      status,
      planId: latestPlan?.id || request.planId,
      reviewId: latestPlan?.reviewId || latestQuarantine?.reviewId || latestApplication?.reviewId || latestVerification?.reviewId || request.reviewId,
      quarantinedAt: latestQuarantine?.quarantinedAt,
      appliedAt: latestApplication?.appliedAt,
      verifiedAt: latestVerification?.verifiedAt,
      plans: recoveryPlans,
      quarantines: recoveryQuarantines,
      applications: recoveryApplications,
      verifications: recoveryVerifications,
      violations: recoveryViolations
    });
  });

  const pendingReview = records.filter((record) => recoveryHasPendingReview(record, reviewProjection));
  const emergencyQuarantined = quarantines.filter((record) => record.emergency === true);
  const quarantinedSubjects = uniqueBy(
    quarantines.map((record) => stripUndefined({
      recoveryId: record.recoveryId,
      quarantineId: record.id,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      subjectKey: record.subjectKey,
      status: record.status,
      visible: true,
      trusted: false,
      supersedesQuarantineId: record.supersedesQuarantineId || null
    })),
    (record) => record.subjectKey
  );
  const trustedStateRefs = verifications.map((verification) => stripUndefined({
    recoveryId: verification.recoveryId,
    applicationId: verification.applicationId,
    checkpointHash: verification.checkpointHash,
    originalHeadHash: verification.originalHeadHash,
    recoveryLogHash: verification.recoveryLogHash,
    restoredProjectionHash: verification.restoredProjectionHash,
    restoredStateHash: verification.restoredStateHash,
    historyRewritten: false,
    verifiedAt: verification.verifiedAt
  }));

  return {
    schema: RECOVERY_SCHEMA,
    theorem: RECOVERY_THEOREM,
    hardLaw: RECOVERY_HARD_LAW,
    recoveryProtocolVersion: RECOVERY_PROTOCOL_VERSION,
    localProtocolVersion: PROTOCOL_VERSION,
    statuses: RECOVERY_STATUSES,
    checkpointTypes: Array.from(CHECKPOINT_TYPES),
    subjectTypes: Array.from(RECOVERY_SUBJECT_TYPES),
    records,
    requested: records.filter((record) => record.status === "requested"),
    planned: records.filter((record) => record.status === "planned"),
    quarantined: records.filter((record) => record.status === "quarantined"),
    applied: records.filter((record) => record.status === "applied"),
    verified: records.filter((record) => record.status === "verified"),
    violated: records.filter((record) => record.status === "violated"),
    pendingReview,
    emergencyQuarantined,
    trusted_state_refs: trustedStateRefs,
    quarantined_subjects: quarantinedSubjects,
    requests,
    plans,
    quarantines,
    applications,
    verifications,
    violations,
    byRecovery: indexBy(records, "id"),
    bySubject: groupBy(records, "subjectKey"),
    plansByRecovery,
    quarantinesByRecovery,
    applicationsByRecovery,
    verificationsByRecovery,
    violationsByRecovery,
    recoveryValidationStatus: {
      valid: true,
      recordCount: records.length,
      requestedCount: records.filter((record) => record.status === "requested").length,
      plannedCount: records.filter((record) => record.status === "planned").length,
      quarantinedCount: quarantines.filter((record) => record.emergency !== true).length,
      emergencyQuarantinedCount: emergencyQuarantined.length,
      appliedCount: applications.length,
      verifiedCount: verifications.length,
      violationCount: violations.length,
      pendingReviewCount: pendingReview.length,
      quarantinedSubjectCount: quarantinedSubjects.length,
      trustedStateRefCount: trustedStateRefs.length,
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
  };
}

function buildRecoveryRequest(options = {}) {
  const subjectType = normalizeType(options.subjectType || "external_artifact");
  const subjectId = options.subjectId || options.subject || null;
  const request = stripUndefined({
    id: options.id || deterministicId("rcv", "recovery_request", {
      subjectType,
      subjectId,
      reason: options.reason,
      checkpointRef: options.checkpointRef || options.checkpoint
    }),
    object: "recoveryRequest",
    threadId: options.threadId || null,
    subjectType,
    subjectId,
    subjectRef: {
      type: subjectType,
      id: subjectId
    },
    subjectKey: subjectKey(subjectType, subjectId),
    reason: normalizeString(options.reason),
    checkpointRef: normalizeCheckpointRef(options.checkpointRef || options.checkpoint),
    evidence: normalizeEvidence(options.evidence),
    artifactRef: normalizeArtifactRef(options.artifactRef || options.artifact),
    requestedByParticipantId: options.requestedByParticipantId || options.actorId || null,
    requestedAt: options.requestedAt || null,
    status: "requested",
    visible: true,
    trusted: false,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  request.checkpointHash = checkpointHash(request.checkpointRef);
  request.recoveryHash = recoveryHash(request);
  return request;
}

function buildRecoveryPlan(options = {}) {
  const plan = stripUndefined({
    id: options.id || deterministicId("rcp", "recovery_plan", {
      recoveryId: options.recoveryId || options.recovery,
      plan: options.plan
    }),
    object: "recoveryPlan",
    recoveryId: options.recoveryId || options.recovery || null,
    threadId: options.threadId || null,
    plan: normalizeString(options.plan),
    reviewId: options.reviewId || options.review || null,
    reviewRequired: true,
    plannedByParticipantId: options.plannedByParticipantId || options.actorId || null,
    plannedAt: options.plannedAt || null,
    evidence: normalizeEvidence(options.evidence),
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  plan.recoveryHash = recoveryHash(plan);
  return plan;
}

function buildRecoveryQuarantine(options = {}) {
  const subjectType = normalizeType(options.subjectType || "external_artifact");
  const subjectId = options.subjectId || options.subject || null;
  const emergency = Boolean(options.emergency);
  const quarantine = stripUndefined({
    id: options.id || deterministicId("rcq", "recovery_quarantine", {
      recoveryId: options.recoveryId || options.recovery,
      subjectType,
      subjectId,
      emergency
    }),
    object: "recoveryQuarantine",
    recoveryId: options.recoveryId || options.recovery || null,
    planId: options.planId || options.plan || null,
    threadId: options.threadId || null,
    subjectType,
    subjectId,
    subjectRef: {
      type: subjectType,
      id: subjectId
    },
    subjectKey: subjectKey(subjectType, subjectId),
    reason: normalizeString(options.reason),
    reviewId: options.reviewId || options.review || null,
    emergency,
    status: emergency ? "emergency_quarantined" : "quarantined",
    visible: true,
    trusted: false,
    excludedFromTrustedProjection: true,
    supersedesQuarantineId: options.supersedesQuarantineId || options.supersedes || null,
    quarantinedByParticipantId: options.quarantinedByParticipantId || options.actorId || null,
    quarantinedAt: options.quarantinedAt || null,
    evidence: normalizeEvidence(options.evidence),
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  quarantine.recoveryHash = recoveryHash(quarantine);
  return quarantine;
}

function buildRecoveryApplication(options = {}) {
  const application = stripUndefined({
    id: options.id || deterministicId("rca", "recovery_application", {
      recoveryId: options.recoveryId || options.recovery,
      planId: options.planId || options.plan,
      repairSummary: options.repairSummary || options.summary
    }),
    object: "recoveryApplication",
    recoveryId: options.recoveryId || options.recovery || null,
    planId: options.planId || options.plan || null,
    threadId: options.threadId || null,
    repairSummary: normalizeString(options.repairSummary || options.summary),
    repairEvidence: normalizeEvidence(options.repairEvidence || options.evidence),
    reviewId: options.reviewId || options.review || null,
    appliedByParticipantId: options.appliedByParticipantId || options.actorId || null,
    appliedAt: options.appliedAt || null,
    repairApplied: true,
    historyRewritten: false,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  application.recoveryHash = recoveryHash(application);
  return application;
}

function buildRecoveryVerification(options = {}) {
  const verification = stripUndefined({
    id: options.id || deterministicId("rcv", "recovery_verification", {
      recoveryId: options.recoveryId || options.recovery,
      applicationId: options.applicationId || options.application
    }),
    object: "recoveryVerification",
    recoveryId: options.recoveryId || options.recovery || null,
    applicationId: options.applicationId || options.application || null,
    threadId: options.threadId || null,
    reviewId: options.reviewId || options.review || null,
    originalHeadHash: options.originalHeadHash || null,
    recoveryEventPreviousHash: options.recoveryEventPreviousHash || options.previousHash || null,
    checkpointHash: options.checkpointHash || null,
    recoveryLogHash: options.recoveryLogHash || null,
    restoredProjectionHash: options.restoredProjectionHash || null,
    restoredStateHash: options.restoredStateHash || null,
    verificationEvidence: normalizeEvidence(options.verificationEvidence || options.evidence),
    verifiedByParticipantId: options.verifiedByParticipantId || options.actorId || null,
    verifiedAt: options.verifiedAt || null,
    verificationStatus: "verified",
    valid: true,
    historyRewritten: false,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  verification.recoveryHash = recoveryHash(verification);
  return verification;
}

function buildRecoveryViolation(options = {}) {
  const violation = stripUndefined({
    id: options.id || deterministicId("rcv", "recovery_violation", {
      recoveryId: options.recoveryId || options.recovery,
      violationType: options.violationType || options.type
    }),
    object: "recoveryViolation",
    recoveryId: options.recoveryId || options.recovery || null,
    threadId: options.threadId || null,
    violationType: normalizeType(options.violationType || options.type),
    reason: normalizeString(options.reason),
    detectedByParticipantId: options.detectedByParticipantId || options.actorId || null,
    detectedAt: options.detectedAt || null,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  violation.recoveryHash = recoveryHash(violation);
  return violation;
}

function recoveryForId(recoveryProjection, recoveryId) {
  return {
    schema: "clista.recovery.item.v0",
    recoveryId,
    recovery: recoveryProjection.byRecovery[recoveryId] || null,
    plans: recoveryProjection.plansByRecovery[recoveryId] || [],
    quarantines: recoveryProjection.quarantinesByRecovery[recoveryId] || [],
    applications: recoveryProjection.applicationsByRecovery[recoveryId] || [],
    verifications: recoveryProjection.verificationsByRecovery[recoveryId] || [],
    violations: recoveryProjection.violationsByRecovery[recoveryId] || []
  };
}

function selectRecoveryForThread(recoveryProjection, threadId) {
  const records = recoveryProjection.records.filter((record) => record.threadId === threadId);
  const recordIds = new Set(records.map((record) => record.id));
  const byThreadOrRecovery = (record) => record.threadId === threadId || recordIds.has(record.recoveryId);
  return {
    schema: "clista.recovery.thread.v0",
    threadId,
    theorem: recoveryProjection.theorem,
    hardLaw: recoveryProjection.hardLaw,
    records,
    requested: records.filter((record) => record.status === "requested"),
    planned: records.filter((record) => record.status === "planned"),
    quarantined: records.filter((record) => record.status === "quarantined"),
    emergencyQuarantined: recoveryProjection.emergencyQuarantined.filter(byThreadOrRecovery),
    applied: records.filter((record) => record.status === "applied"),
    verified: records.filter((record) => record.status === "verified"),
    violated: records.filter((record) => record.status === "violated"),
    pendingReview: recoveryProjection.pendingReview.filter((record) => record.threadId === threadId),
    trusted_state_refs: recoveryProjection.trusted_state_refs.filter((record) => recordIds.has(record.recoveryId)),
    quarantined_subjects: recoveryProjection.quarantined_subjects.filter((record) => recordIds.has(record.recoveryId)),
    plans: recoveryProjection.plans.filter(byThreadOrRecovery),
    quarantines: recoveryProjection.quarantines.filter(byThreadOrRecovery),
    applications: recoveryProjection.applications.filter(byThreadOrRecovery),
    verifications: recoveryProjection.verifications.filter(byThreadOrRecovery),
    violations: recoveryProjection.violations.filter(byThreadOrRecovery)
  };
}

function validateRecoveryRequest(request) {
  const reasons = [];
  if (!request?.id) {
    reasons.push("recovery request requires id");
  }
  if (request?.object && request.object !== "recoveryRequest") {
    reasons.push("recovery request object must be recoveryRequest");
  }
  if (!request?.threadId) {
    reasons.push("recovery request requires threadId");
  }
  validateSubjectShape(request, "recovery request", reasons);
  if (!normalizeString(request?.reason)) {
    reasons.push("recovery request requires reason");
  }
  reasons.push(...validateCheckpointRef(request?.checkpointRef));
  reasons.push(...rejectRecoveryGuardFields(request));
  return reasons;
}

function validateRecoveryPlan(plan) {
  const reasons = [];
  if (!plan?.id) {
    reasons.push("recovery plan requires id");
  }
  if (plan?.object && plan.object !== "recoveryPlan") {
    reasons.push("recovery plan object must be recoveryPlan");
  }
  if (!plan?.recoveryId) {
    reasons.push("recovery plan requires recoveryId");
  }
  if (!plan?.threadId) {
    reasons.push("recovery plan requires threadId");
  }
  if (!normalizeString(plan?.plan)) {
    reasons.push("recovery plan requires plan");
  }
  if (!plan?.reviewId) {
    reasons.push("recovery plan requires reviewId");
  }
  if (!plan?.plannedByParticipantId) {
    reasons.push("recovery plan requires plannedByParticipantId");
  }
  reasons.push(...rejectRecoveryGuardFields(plan));
  return reasons;
}

function validateRecoveryQuarantine(quarantine) {
  const reasons = [];
  if (!quarantine?.id) {
    reasons.push("recovery quarantine requires id");
  }
  if (quarantine?.object && quarantine.object !== "recoveryQuarantine") {
    reasons.push("recovery quarantine object must be recoveryQuarantine");
  }
  if (!quarantine?.recoveryId) {
    reasons.push("recovery quarantine requires recoveryId");
  }
  if (!quarantine?.planId) {
    reasons.push("recovery quarantine requires planId");
  }
  if (!quarantine?.threadId) {
    reasons.push("recovery quarantine requires threadId");
  }
  validateSubjectShape(quarantine, "recovery quarantine", reasons);
  if (!normalizeString(quarantine?.reason)) {
    reasons.push("recovery quarantine requires reason");
  }
  if (!quarantine?.reviewId) {
    reasons.push("recovery quarantine requires reviewId");
  }
  if (!quarantine?.quarantinedByParticipantId) {
    reasons.push("recovery quarantine requires quarantinedByParticipantId");
  }
  if (quarantine?.visible !== true) {
    reasons.push("recovery quarantine subject must remain visible");
  }
  if (quarantine?.trusted !== false) {
    reasons.push("recovery quarantine subject must be untrusted");
  }
  if (quarantine?.excludedFromTrustedProjection !== true) {
    reasons.push("recovery quarantine requires excludedFromTrustedProjection true");
  }
  reasons.push(...rejectRecoveryGuardFields(quarantine));
  return reasons;
}

function validateRecoveryApplication(application) {
  const reasons = [];
  if (!application?.id) {
    reasons.push("recovery application requires id");
  }
  if (application?.object && application.object !== "recoveryApplication") {
    reasons.push("recovery application object must be recoveryApplication");
  }
  if (!application?.recoveryId) {
    reasons.push("recovery application requires recoveryId");
  }
  if (!application?.planId) {
    reasons.push("recovery application requires planId");
  }
  if (!application?.threadId) {
    reasons.push("recovery application requires threadId");
  }
  if (!normalizeString(application?.repairSummary)) {
    reasons.push("recovery application requires repairSummary");
  }
  if (!application?.reviewId) {
    reasons.push("recovery application requires reviewId");
  }
  if (!application?.appliedByParticipantId) {
    reasons.push("recovery application requires appliedByParticipantId");
  }
  if (application?.repairApplied !== true) {
    reasons.push("recovery application requires repairApplied true");
  }
  reasons.push(...rejectRecoveryGuardFields(application));
  return reasons;
}

function validateRecoveryVerification(verification) {
  const reasons = [];
  if (!verification?.id) {
    reasons.push("recovery verification requires id");
  }
  if (verification?.object && verification.object !== "recoveryVerification") {
    reasons.push("recovery verification object must be recoveryVerification");
  }
  if (!verification?.recoveryId) {
    reasons.push("recovery verification requires recoveryId");
  }
  if (!verification?.applicationId) {
    reasons.push("recovery verification requires applicationId");
  }
  if (!verification?.threadId) {
    reasons.push("recovery verification requires threadId");
  }
  if (!verification?.reviewId) {
    reasons.push("recovery verification requires reviewId");
  }
  if (!verification?.checkpointHash) {
    reasons.push("recovery verification requires checkpointHash");
  }
  if (!verification?.recoveryLogHash) {
    reasons.push("recovery verification requires recoveryLogHash");
  }
  if (!verification?.restoredProjectionHash) {
    reasons.push("recovery verification requires restoredProjectionHash");
  }
  if (!verification?.restoredStateHash) {
    reasons.push("recovery verification requires restoredStateHash");
  }
  if (!verification?.verifiedByParticipantId) {
    reasons.push("recovery verification requires verifiedByParticipantId");
  }
  if (verification?.valid !== true || verification?.verificationStatus !== "verified") {
    reasons.push("recovery verification status must be verified");
  }
  reasons.push(...rejectRecoveryGuardFields(verification));
  return reasons;
}

function validateRecoveryViolation(violation) {
  const reasons = [];
  if (!violation?.id) {
    reasons.push("recovery violation requires id");
  }
  if (violation?.object && violation.object !== "recoveryViolation") {
    reasons.push("recovery violation object must be recoveryViolation");
  }
  if (!violation?.recoveryId) {
    reasons.push("recovery violation requires recoveryId");
  }
  if (!violation?.threadId) {
    reasons.push("recovery violation requires threadId");
  }
  if (!normalizeType(violation?.violationType)) {
    reasons.push("recovery violation requires violationType");
  }
  if (!normalizeString(violation?.reason)) {
    reasons.push("recovery violation requires reason");
  }
  if (!violation?.detectedByParticipantId) {
    reasons.push("recovery violation requires detectedByParticipantId");
  }
  reasons.push(...rejectRecoveryGuardFields(violation));
  return reasons;
}

function validateCheckpointRef(checkpointRef) {
  const reasons = [];
  if (!checkpointRef || typeof checkpointRef !== "object" || Array.isArray(checkpointRef)) {
    reasons.push("recovery checkpoint requires checkpointRef");
    return reasons;
  }
  const checkpointType = normalizeType(checkpointRef.checkpointType || checkpointRef.checkpoint_type);
  if (!checkpointRef.checkpointId && !checkpointRef.checkpoint_id) {
    reasons.push("recovery checkpoint requires checkpointId");
  }
  if (!checkpointType) {
    reasons.push("recovery checkpoint requires checkpointType");
  } else if (!CHECKPOINT_TYPES.has(checkpointType)) {
    reasons.push(`unsupported recovery checkpointType ${checkpointRef.checkpointType || checkpointRef.checkpoint_type}`);
  }
  if (!checkpointRef.sourceThreadId && !checkpointRef.source_thread_id) {
    reasons.push("recovery checkpoint requires sourceThreadId");
  }
  if (!checkpointRef.protocolVersion && !checkpointRef.protocol_version) {
    reasons.push("recovery checkpoint requires protocolVersion");
  }
  if (!checkpointRef.boundaryEventId && !checkpointRef.boundary_event_id && !checkpointRef.exportedAt && !checkpointRef.exported_at) {
    reasons.push("recovery checkpoint requires boundaryEventId or exportedAt");
  }
  if (!checkpointRef.eventLogHash && !checkpointRef.event_log_hash && !checkpointRef.headHash && !checkpointRef.head_hash) {
    reasons.push("recovery checkpoint requires eventLogHash or headHash");
  }
  if (!checkpointRef.projectionHash && !checkpointRef.projection_hash) {
    reasons.push("recovery checkpoint requires projectionHash");
  }
  if (!checkpointRef.stateHash && !checkpointRef.state_hash) {
    reasons.push("recovery checkpoint requires stateHash");
  }
  const layerResults = checkpointRef.verificationLayerResults || checkpointRef.verification_layer_results;
  if (!layerResults || typeof layerResults !== "object" || Array.isArray(layerResults)) {
    reasons.push("recovery checkpoint requires verificationLayerResults");
  } else {
    for (const requiredLayer of ["validity", "integrity"]) {
      if (!layerResults[requiredLayer] || layerResults[requiredLayer].valid !== true) {
        reasons.push(`recovery checkpoint requires verified ${requiredLayer} layer`);
      }
    }
  }
  if (checkpointRef.verified !== true) {
    reasons.push("recovery checkpoint must be verified");
  }
  return reasons;
}

function normalizeRecoveryRequest(request, event) {
  if (!request) {
    return null;
  }
  const subjectType = normalizeType(request.subjectType || request.subjectRef?.type);
  const subjectId = request.subjectId || request.subjectRef?.id;
  const normalized = stripUndefined({
    ...request,
    object: "recoveryRequest",
    threadId: request.threadId || event.thread_id,
    subjectType,
    subjectId,
    subjectRef: {
      type: subjectType,
      id: subjectId
    },
    subjectKey: subjectKey(subjectType, subjectId),
    checkpointRef: normalizeCheckpointRef(request.checkpointRef),
    evidence: normalizeEvidence(request.evidence),
    artifactRef: normalizeArtifactRef(request.artifactRef),
    requestedByParticipantId: request.requestedByParticipantId || event.actor_id,
    requestedAt: request.requestedAt || event.timestamp,
    status: "requested",
    visible: true,
    trusted: false,
    sourceEventId: event.event_id,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  normalized.checkpointHash = checkpointHash(normalized.checkpointRef);
  normalized.recoveryHash = recoveryHash(normalized);
  return normalized;
}

function normalizeRecoveryPlan(plan, event) {
  if (!plan) {
    return null;
  }
  const normalized = stripUndefined({
    ...plan,
    object: "recoveryPlan",
    threadId: plan.threadId || event.thread_id,
    plan: normalizeString(plan.plan),
    reviewRequired: true,
    plannedByParticipantId: plan.plannedByParticipantId || event.actor_id,
    plannedAt: plan.plannedAt || event.timestamp,
    evidence: normalizeEvidence(plan.evidence),
    sourceEventId: event.event_id,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  normalized.recoveryHash = recoveryHash(normalized);
  return normalized;
}

function normalizeRecoveryQuarantine(quarantine, event) {
  if (!quarantine) {
    return null;
  }
  const subjectType = normalizeType(quarantine.subjectType || quarantine.subjectRef?.type);
  const subjectId = quarantine.subjectId || quarantine.subjectRef?.id;
  const emergency = Boolean(quarantine.emergency);
  const normalized = stripUndefined({
    ...quarantine,
    object: "recoveryQuarantine",
    threadId: quarantine.threadId || event.thread_id,
    subjectType,
    subjectId,
    subjectRef: {
      type: subjectType,
      id: subjectId
    },
    subjectKey: subjectKey(subjectType, subjectId),
    emergency,
    status: emergency ? "emergency_quarantined" : "quarantined",
    visible: true,
    trusted: false,
    excludedFromTrustedProjection: true,
    quarantinedByParticipantId: quarantine.quarantinedByParticipantId || event.actor_id,
    quarantinedAt: quarantine.quarantinedAt || event.timestamp,
    evidence: normalizeEvidence(quarantine.evidence),
    sourceEventId: event.event_id,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  normalized.recoveryHash = recoveryHash(normalized);
  return normalized;
}

function normalizeRecoveryApplication(application, event) {
  if (!application) {
    return null;
  }
  const normalized = stripUndefined({
    ...application,
    object: "recoveryApplication",
    threadId: application.threadId || event.thread_id,
    repairSummary: normalizeString(application.repairSummary || application.summary),
    repairEvidence: normalizeEvidence(application.repairEvidence || application.evidence),
    appliedByParticipantId: application.appliedByParticipantId || event.actor_id,
    appliedAt: application.appliedAt || event.timestamp,
    repairApplied: true,
    historyRewritten: false,
    sourceEventId: event.event_id,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  normalized.recoveryHash = recoveryHash(normalized);
  return normalized;
}

function normalizeRecoveryVerification(verification, event) {
  if (!verification) {
    return null;
  }
  const normalized = stripUndefined({
    ...verification,
    object: "recoveryVerification",
    threadId: verification.threadId || event.thread_id,
    verificationEvidence: normalizeEvidence(verification.verificationEvidence || verification.evidence),
    verifiedByParticipantId: verification.verifiedByParticipantId || event.actor_id,
    verifiedAt: verification.verifiedAt || event.timestamp,
    verificationStatus: "verified",
    valid: true,
    historyRewritten: false,
    sourceEventId: event.event_id,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  normalized.recoveryHash = recoveryHash(normalized);
  return normalized;
}

function normalizeRecoveryViolation(violation, event) {
  if (!violation) {
    return null;
  }
  const normalized = stripUndefined({
    ...violation,
    object: "recoveryViolation",
    threadId: violation.threadId || event.thread_id,
    violationType: normalizeType(violation.violationType || violation.type),
    detectedByParticipantId: violation.detectedByParticipantId || event.actor_id,
    detectedAt: violation.detectedAt || event.timestamp,
    sourceEventId: event.event_id,
    eventDeleted: false,
    eventReplaced: false,
    historyRewrite: false,
    silentRepair: false,
    recoveryAsApproval: false,
    recoveryAsAmendment: false,
    recoveryAsConsensus: false,
    authorityCreated: false,
    governanceMutation: false,
    stateMutation: false
  });
  normalized.recoveryHash = recoveryHash(normalized);
  return normalized;
}

function normalizeCheckpointRef(checkpoint = {}) {
  if (!checkpoint || typeof checkpoint !== "object") {
    return checkpoint;
  }
  const normalized = stripUndefined({
    checkpointId: checkpoint.checkpointId || checkpoint.checkpoint_id,
    checkpointType: normalizeType(checkpoint.checkpointType || checkpoint.checkpoint_type),
    sourceThreadId: checkpoint.sourceThreadId || checkpoint.source_thread_id,
    protocolVersion: checkpoint.protocolVersion || checkpoint.protocol_version,
    boundaryEventId: checkpoint.boundaryEventId || checkpoint.boundary_event_id,
    exportedAt: checkpoint.exportedAt || checkpoint.exported_at,
    eventLogHash: checkpoint.eventLogHash || checkpoint.event_log_hash,
    headHash: checkpoint.headHash || checkpoint.head_hash,
    projectionHash: checkpoint.projectionHash || checkpoint.projection_hash,
    stateHash: checkpoint.stateHash || checkpoint.state_hash,
    verificationLayerResults: checkpoint.verificationLayerResults || checkpoint.verification_layer_results,
    evidence: normalizeEvidence(checkpoint.evidence),
    artifactRef: normalizeArtifactRef(checkpoint.artifactRef || checkpoint.artifact_ref),
    verified: checkpoint.verified === true
  });
  normalized.checkpointHash = checkpointHash(normalized);
  return normalized;
}

function normalizeArtifactRef(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return stripUndefined({
      uri: value.uri || value.path || value.id || null,
      hash: value.hash || value.artifactHash || value.artifact_hash || null,
      evidence: normalizeEvidence(value.evidence)
    });
  }
  return {
    uri: String(value),
    hash: null,
    evidence: []
  };
}

function normalizeEvidence(value) {
  if (Array.isArray(value)) {
    return value.flatMap(normalizeEvidence).filter(Boolean);
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  if (typeof value === "object") {
    return [value];
  }
  return [{ value: String(value) }];
}

function validateSubjectShape(record, label, reasons) {
  const subjectType = normalizeType(record?.subjectType || record?.subjectRef?.type);
  if (!subjectType) {
    reasons.push(`${label} requires subjectType`);
  } else if (!RECOVERY_SUBJECT_TYPES.has(subjectType)) {
    reasons.push(`${label} unsupported subjectType ${record.subjectType || record.subjectRef?.type}`);
  }
  if (!record?.subjectId && !record?.subjectRef?.id) {
    reasons.push(`${label} requires subjectId`);
  }
}

function subjectRequiresArtifactEvidence(subjectType) {
  return EXTERNAL_RECOVERY_SUBJECT_TYPES.has(normalizeType(subjectType));
}

function checkpointHash(checkpointRef) {
  if (!checkpointRef || typeof checkpointRef !== "object") {
    return null;
  }
  const material = { ...checkpointRef };
  delete material.checkpointHash;
  return contentHash(material);
}

function recoveryLogHash(recoveryEvents) {
  return contentHash({
    recoveryEvents: (recoveryEvents || []).map(recoveryEventMaterial)
  });
}

function recoveryEventMaterial(event) {
  return {
    event_id: event.event_id,
    event_type: event.event_type,
    thread_id: event.thread_id,
    actor_id: event.actor_id,
    timestamp: event.timestamp,
    payload: event.payload
  };
}

function restoredStateMaterial(recoveryId, state) {
  const request = state.recoveryRequests?.get(recoveryId) || state.requests?.find?.((item) => item.id === recoveryId) || null;
  const quarantines = mapValuesForRecovery(state.recoveryQuarantines, state.quarantines, recoveryId);
  const applications = mapValuesForRecovery(state.recoveryApplications, state.applications, recoveryId);
  return {
    theorem: RECOVERY_THEOREM,
    hardLaw: RECOVERY_HARD_LAW,
    recoveryId,
    checkpointHash: request?.checkpointHash || checkpointHash(request?.checkpointRef),
    quarantinedSubjects: quarantines.map((record) => ({
      subjectKey: record.subjectKey,
      visible: true,
      trusted: false
    })),
    applicationHashes: applications.map((record) => record.recoveryHash),
    historyRewritten: false
  };
}

function restoredStateHash(recoveryId, state) {
  return contentHash(restoredStateMaterial(recoveryId, state));
}

function restoredProjectionHash(recoveryId, state) {
  return contentHash({
    recoveryAwareTrustedProjection: restoredStateMaterial(recoveryId, state)
  });
}

function recoveryHash(record) {
  return contentHash({
    id: record.id,
    object: record.object,
    recoveryId: record.recoveryId,
    threadId: record.threadId,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    checkpointHash: record.checkpointHash,
    planId: record.planId,
    reviewId: record.reviewId,
    applicationId: record.applicationId,
    status: record.status || record.verificationStatus,
    reason: record.reason,
    repairSummary: record.repairSummary,
    violationType: record.violationType,
    historyRewritten: false,
    eventDeleted: false,
    eventReplaced: false,
    silentRepair: false,
    authorityCreated: false,
    governanceMutation: false
  });
}

function rejectRecoveryGuardFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      const allowedTrue = key === "repairApplied";
      if (!allowedTrue && child !== false && child !== undefined && child !== null) {
        reasons.push(`recovery field ${fullPath.join(".")} must be false or absent`);
      }
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectRecoveryGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function recoveryHasPendingReview(record, reviewProjection) {
  const reviewId = record.reviewId || record.plans?.at(-1)?.reviewId || record.quarantines?.at(-1)?.reviewId;
  if (!reviewId) {
    return Boolean(record.plans?.length || record.quarantines?.length || record.applications?.length || record.verifications?.length);
  }
  const review = reviewProjection?.byReview?.[reviewId];
  return review ? review.status !== "reviewed" : true;
}

function addRecoveryEvent(state, event) {
  state.recoveryEvents.push(recoveryEventMaterial(event));
}

function addRecord(records, record) {
  if (record) {
    records.push(record);
  }
}

function mapValuesForRecovery(map, array, recoveryId) {
  if (map && typeof map.values === "function") {
    return Array.from(map.values()).filter((record) => record.recoveryId === recoveryId);
  }
  return (array || []).filter((record) => record.recoveryId === recoveryId);
}



function uniqueBy(records, keyFn) {
  const seen = new Set();
  const unique = [];
  for (const record of records) {
    const key = keyFn(record);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizeType(type).slice(0, 24) || "recovery"}_${hash}`;
}


function normalizeString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function subjectKey(subjectType, subjectId) {
  return `${normalizeType(subjectType)}:${subjectId || ""}`;
}


module.exports = {
  CHECKPOINT_TYPES,
  EXTERNAL_RECOVERY_SUBJECT_TYPES,
  RECOVERY_EVENT_TYPES,
  RECOVERY_HARD_LAW,
  RECOVERY_PROTOCOL_VERSION,
  RECOVERY_SCHEMA,
  RECOVERY_STATUSES,
  RECOVERY_SUBJECT_TYPES,
  RECOVERY_THEOREM,
  RECOVERY_VERIFY_SCHEMA,
  buildRecoveryApplication,
  buildRecoveryPlan,
  buildRecoveryQuarantine,
  buildRecoveryRequest,
  buildRecoveryVerification,
  buildRecoveryViolation,
  buildRecoveryState,
  checkpointHash,
  emptyRecoveryState,
  projectRecovery,
  recoveryForId,
  recoveryLogHash,
  restoredProjectionHash,
  restoredStateHash,
  selectRecoveryForThread,
  subjectRequiresArtifactEvidence,
  validateRecoveryApplication,
  validateRecoveryPlan,
  validateRecoveryQuarantine,
  validateRecoveryRequest,
  validateRecoveryVerification,
  validateRecoveryViolation
};
