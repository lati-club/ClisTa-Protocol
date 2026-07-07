const {
  appendEvent,
  contentHash,
  createEvent,
  newId,
  nowIso,
  parseList,
  readEvents
} = require("../events");
const {
  PROTOCOL_VERSION,
  verifyEventIntegrity
} = require("../integrity");
const {
  projectEvents,
  selectThreadState
} = require("../projector");
const {
  RECOVERY_EVENT_TYPES,
  buildRecoveryApplication,
  buildRecoveryPlan,
  buildRecoveryQuarantine,
  buildRecoveryRequest,
  buildRecoveryVerification,
  buildRecoveryViolation,
  checkpointHash,
  recoveryForId,
  recoveryLogHash,
  restoredProjectionHash,
  restoredStateHash
} = require("../recovery");
const { buildReviewRequirement } = require("../review");
const { validateEvents } = require("../validator");
const {
  appendParticipant,
  booleanOption,
  participantFrom,
  print,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function recoveryRequest(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "subject");
  requireOption(options, "reason");
  const subjectType = options.subjectType || inferRecoverySubjectType(options.subject);
  const actor = participantFrom(options.requestedBy || options.actor || "Recovery Reviewer", options.role || "recovery_requester", options.kind || "human");
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const recoveryRequestRecord = buildRecoveryRequest({
    id: options.recovery || options.recoveryId || options.id,
    threadId: options.thread,
    subjectType,
    subjectId: options.subject,
    reason: options.reason,
    checkpointRef: recoveryCheckpointForCli(options, cwd, options.thread),
    evidence: parseList(options.evidence || options.evidences),
    artifactRef: artifactRefForCli(options),
    requestedByParticipantId: actor.id,
    requestedAt: at
  });
  const event = createEvent({
    type: "RecoveryRequested",
    threadId: recoveryRequestRecord.threadId,
    actorId: recoveryRequestRecord.requestedByParticipantId,
    at,
    payload: { recoveryRequest: recoveryRequestRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.request.v0",
    requested: true,
    recoveryRequest: recoveryRequestRecord,
    event
  });
}

function recoveryPlan(options, cwd) {
  requireOption(options, "recovery");
  requireOption(options, "plan");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const record = projection.recovery.byRecovery[options.recovery];
  if (!record) {
    throw new Error(`Unknown recovery ${options.recovery}`);
  }
  const actor = participantFrom(options.plannedBy || options.actor || "Recovery Reviewer", options.role || "recovery_planner", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  let protocolReview = null;
  let reviewId = options.review || options.reviewId;
  if (!reviewId) {
    protocolReview = appendRecoveryReviewRequirement(cwd, record, actor, {
      triggerType: "recovery_plan",
      reason: options.reviewReason || `Recovery ${record.id} requires review before repair action`,
      at
    });
    reviewId = protocolReview.id;
  }
  const recoveryPlanRecord = buildRecoveryPlan({
    id: options.id || options.planId,
    recoveryId: record.id,
    threadId: record.threadId,
    plan: options.plan,
    reviewId,
    plannedByParticipantId: actor.id,
    plannedAt: at,
    evidence: parseList(options.evidence || options.evidences)
  });
  const event = createEvent({
    type: "RecoveryPlanCreated",
    threadId: recoveryPlanRecord.threadId,
    actorId: recoveryPlanRecord.plannedByParticipantId,
    at,
    payload: { recoveryPlan: recoveryPlanRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.plan.v0",
    planned: true,
    protocolReview,
    recoveryPlan: recoveryPlanRecord,
    event
  });
}

function recoveryQuarantine(options, cwd) {
  requireOption(options, "recovery");
  requireOption(options, "reason");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const { record, plan } = recoveryRecordForCli(projection, options.recovery, options.plan || options.planId);
  const actor = participantFrom(options.quarantinedBy || options.actor || "Recovery Reviewer", options.role || "recovery_quarantiner", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const emergency = booleanOption(options.emergency, false);
  let reviewId = options.review || options.reviewId || plan.reviewId;
  let protocolReview = null;
  if (emergency && (!reviewId || projection.review.byReview[reviewId]?.status === "reviewed")) {
    protocolReview = appendRecoveryReviewRequirement(cwd, record, actor, {
      triggerType: "recovery_quarantine",
      reason: options.reviewReason || `Emergency quarantine for recovery ${record.id} requires pending review`,
      at
    });
    reviewId = protocolReview.id;
  }
  const quarantine = buildRecoveryQuarantine({
    id: options.id || options.quarantine,
    recoveryId: record.id,
    planId: plan.id,
    threadId: record.threadId,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    reason: options.reason,
    reviewId,
    emergency,
    supersedesQuarantineId: options.supersedes,
    quarantinedByParticipantId: actor.id,
    quarantinedAt: at,
    evidence: parseList(options.evidence || options.evidences)
  });
  const event = createEvent({
    type: "RecoveryQuarantined",
    threadId: quarantine.threadId,
    actorId: quarantine.quarantinedByParticipantId,
    at,
    payload: { recoveryQuarantine: quarantine }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.quarantine.v0",
    quarantined: true,
    protocolReview,
    recoveryQuarantine: quarantine,
    event
  });
}

function recoveryApply(options, cwd) {
  requireOption(options, "recovery");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const { record, plan } = recoveryRecordForCli(projection, options.recovery, options.plan || options.planId);
  const reviewId = options.review || options.reviewId || plan.reviewId;
  const review = projection.review.byReview[reviewId];
  if (!review || review.status !== "reviewed") {
    throw new Error(`Recovery apply requires completed M23 review ${reviewId}`);
  }
  const actor = participantFrom(options.appliedBy || options.actor || "Recovery Reviewer", options.role || "recovery_applier", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const application = buildRecoveryApplication({
    id: options.id || options.application,
    recoveryId: record.id,
    planId: plan.id,
    threadId: record.threadId,
    repairSummary: options.summary,
    repairEvidence: parseList(options.evidence || options.evidences),
    reviewId,
    appliedByParticipantId: actor.id,
    appliedAt: at
  });
  const event = createEvent({
    type: "RecoveryApplied",
    threadId: application.threadId,
    actorId: application.appliedByParticipantId,
    at,
    payload: { recoveryApplication: application }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.apply.v0",
    applied: true,
    recoveryApplication: application,
    event
  });
}

function recoveryVerify(options, cwd) {
  if (options.recovery && !options.events) {
    return recoveryVerifyRecord(options, cwd);
  }
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.recovery.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.recovery.verify.v0",
    valid: true,
    errors: [],
    recoveryValidationStatus: projection.recovery.recoveryValidationStatus,
    trusted_state_refs: projection.recovery.trusted_state_refs,
    quarantined_subjects: projection.recovery.quarantined_subjects
  });
}

function recoveryVerifyRecord(options, cwd) {
  requireOption(options, "recovery");
  const events = readValidEventsForOptions(options, cwd);
  const projection = projectEvents(events);
  const { record } = recoveryRecordForCli(projection, options.recovery, options.plan || options.planId);
  const application = options.application
    ? projection.recovery.applicationsByRecovery[record.id]?.find((item) => item.id === options.application)
    : projection.recovery.applicationsByRecovery[record.id]?.at(-1);
  if (!application) {
    throw new Error(`Recovery ${record.id} has no applied repair to verify`);
  }
  const reviewId = options.review || options.reviewId || application.reviewId;
  const review = projection.review.byReview[reviewId];
  if (!review || review.status !== "reviewed") {
    throw new Error(`Recovery verify requires completed M23 review ${reviewId}`);
  }
  const actor = participantFrom(options.verifiedBy || options.actor || "Recovery Reviewer", options.role || "recovery_verifier", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const eventsAfterActor = readValidEventsForOptions(options, cwd);
  const projectionAfterActor = projectEvents(eventsAfterActor);
  const recoveryEvents = eventsAfterActor.filter((event) => RECOVERY_EVENT_TYPES.has(event.event_type));
  const originalHeadHash = eventsAfterActor.at(-1)?.content_hash || null;
  const at = nowIso();
  const verification = buildRecoveryVerification({
    id: options.id || options.verification,
    recoveryId: record.id,
    applicationId: application.id,
    threadId: record.threadId,
    reviewId,
    originalHeadHash,
    recoveryEventPreviousHash: originalHeadHash,
    checkpointHash: record.checkpointHash,
    recoveryLogHash: recoveryLogHash(recoveryEvents),
    restoredProjectionHash: restoredProjectionHash(record.id, projectionAfterActor.recovery),
    restoredStateHash: restoredStateHash(record.id, projectionAfterActor.recovery),
    verificationEvidence: parseList(options.evidence || options.evidences || "recomputed restored recovery state"),
    verifiedByParticipantId: actor.id,
    verifiedAt: at
  });
  const event = createEvent({
    type: "RecoveryVerified",
    threadId: verification.threadId,
    actorId: verification.verifiedByParticipantId,
    at,
    payload: { recoveryVerification: verification }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.verify.record.v0",
    recorded: true,
    recoveryVerification: verification,
    event
  });
}

function recoveryViolation(options, cwd) {
  requireOption(options, "recovery");
  requireOption(options, "type");
  requireOption(options, "reason");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const record = projection.recovery.byRecovery[options.recovery];
  if (!record) {
    throw new Error(`Unknown recovery ${options.recovery}`);
  }
  const actor = participantFrom(options.detectedBy || options.actor || "Recovery Reviewer", options.role || "recovery_detector", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const violation = buildRecoveryViolation({
    id: options.id || options.violation,
    recoveryId: record.id,
    threadId: record.threadId,
    violationType: options.type || options.violationType,
    reason: options.reason,
    detectedByParticipantId: actor.id,
    detectedAt: at
  });
  const event = createEvent({
    type: "RecoveryViolationRecorded",
    threadId: violation.threadId,
    actorId: violation.detectedByParticipantId,
    at,
    payload: { recoveryViolation: violation }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.violation.v0",
    violated: true,
    recoveryViolation: violation,
    event
  });
}

function recoveryList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let records = projection.recovery.records;
  if (options.thread) {
    records = records.filter((record) => record.threadId === options.thread);
  }
  if (options.status) {
    records = records.filter((record) => record.status === options.status);
  }
  return print({
    schema: "clista.recovery.list.v0",
    theorem: projection.recovery.theorem,
    hardLaw: projection.recovery.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: records.length,
    records
  });
}

function recoveryShow(options, cwd) {
  const recoveryId = options.recovery || options.recoveryId || options.id;
  if (!recoveryId) {
    throw new Error("Missing required option --recovery");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(recoveryForId(projection.recovery, recoveryId));
}

function recoveryRecordForCli(projection, recoveryId, planId) {
  const record = projection.recovery.byRecovery[recoveryId];
  if (!record) {
    throw new Error(`Unknown recovery ${recoveryId}`);
  }
  const plan = planId
    ? projection.recovery.plansByRecovery[record.id]?.find((item) => item.id === planId)
    : projection.recovery.plansByRecovery[record.id]?.at(-1);
  if (!plan) {
    throw new Error(`Recovery ${record.id} has no recovery plan`);
  }
  return { record, plan };
}

function appendRecoveryReviewRequirement(cwd, recoveryRecord, actor, options = {}) {
  const at = options.at || nowIso();
  const protocolReview = buildReviewRequirement({
    id: options.reviewId,
    threadId: recoveryRecord.threadId,
    subjectType: "recovery_request",
    subjectId: recoveryRecord.id,
    triggerType: options.triggerType || "recovery_plan",
    reason: options.reason || `Recovery ${recoveryRecord.id} requires review`,
    requiredReviewerRole: options.requiredReviewerRole || "reviewer",
    requiredByParticipantId: actor.id,
    requiredAt: at
  });
  const event = createEvent({
    type: "ReviewRequired",
    threadId: protocolReview.threadId,
    actorId: protocolReview.requiredByParticipantId,
    at,
    payload: { protocolReview }
  });
  appendEvent(event, cwd);
  return protocolReview;
}

function recoveryCheckpointForCli(options, cwd, threadId) {
  const explicit = options.checkpoint
    || options.checkpointId
    || options.checkpointType
    || options.eventLogHash
    || options.headHash
    || options.projectionHash
    || options.stateHash;
  if (explicit) {
    return {
      checkpointId: options.checkpoint || options.checkpointId,
      checkpointType: options.checkpointType || "projection_boundary",
      sourceThreadId: options.sourceThread || options.sourceThreadId || threadId,
      protocolVersion: options.protocolVersion || PROTOCOL_VERSION,
      boundaryEventId: options.boundaryEvent || options.boundaryEventId,
      exportedAt: options.exportedAt,
      eventLogHash: options.eventLogHash,
      headHash: options.headHash,
      projectionHash: options.projectionHash,
      stateHash: options.stateHash,
      verificationLayerResults: checkpointLayerResultsForCli(options),
      evidence: parseList(options.checkpointEvidence || options.evidence),
      artifactRef: artifactRefForCli(options),
      verified: booleanOption(options.verified, true)
    };
  }

  const events = readEvents(cwd);
  const validation = validateEvents(events);
  if (!validation.valid) {
    throw new Error("Cannot create default recovery checkpoint from invalid current log; pass explicit verified checkpoint hashes");
  }
  const integrity = verifyEventIntegrity(events);
  if (!integrity.valid) {
    throw new Error("Cannot create default recovery checkpoint from failed integrity state; pass explicit verified checkpoint hashes");
  }
  const projection = projectEvents(events);
  const state = selectThreadState(projection, threadId);
  if (state.error) {
    throw new Error(state.error);
  }
  const latest = events.at(-1);
  return {
    checkpointId: options.checkpoint || options.checkpointId || newId("chk", "projection_boundary"),
    checkpointType: "projection_boundary",
    sourceThreadId: threadId,
    protocolVersion: PROTOCOL_VERSION,
    boundaryEventId: latest?.event_id || null,
    exportedAt: latest?.timestamp || nowIso(),
    eventLogHash: contentHash({ events }),
    headHash: integrity.headHash,
    projectionHash: contentHash(projectionMaterialForCli(projection)),
    stateHash: contentHash(threadStateMaterialForCli(state)),
    verificationLayerResults: checkpointLayerResultsFromProjection(validation, integrity, projection),
    evidence: parseList(options.checkpointEvidence || "default verified projection boundary"),
    artifactRef: artifactRefForCli(options),
    verified: true
  };
}

function checkpointLayerResultsForCli(options) {
  return {
    validity: { valid: booleanOption(options.validityVerified, true) },
    integrity: { valid: booleanOption(options.integrityVerified, true) },
    recovery: { valid: booleanOption(options.recoveryVerified, true) }
  };
}

function checkpointLayerResultsFromProjection(validation, integrity, projection) {
  return {
    validity: {
      valid: validation.valid,
      errorCount: validation.errors.length
    },
    integrity: {
      valid: integrity.valid,
      eventCount: integrity.eventCount,
      headHash: integrity.headHash
    },
    review: projection.review?.reviewValidationStatus || { valid: true },
    recovery: projection.recovery?.recoveryValidationStatus || { valid: true }
  };
}

function artifactRefForCli(options) {
  const uri = options.artifact || options.artifactUri || options.artifactRef;
  const hash = options.artifactHash || options.hash;
  if (!uri && !hash) {
    return null;
  }
  return {
    uri: uri || null,
    hash: hash || null,
    evidence: parseList(options.artifactEvidence || options.evidence)
  };
}

function projectionMaterialForCli(projection) {
  const material = {};
  for (const [key, value] of Object.entries(projection)) {
    if (key !== "projectedAt" && key !== "events" && key !== "schema") {
      material[key] = value;
    }
  }
  return material;
}

function threadStateMaterialForCli(state) {
  const material = { ...state };
  delete material.projectedAt;
  delete material.auditTrail;
  return material;
}

function inferRecoverySubjectType(id) {
  if (!id) {
    return "external_artifact";
  }
  if (id.startsWith("evt_")) {
    return "invalid_event";
  }
  if (id.startsWith("exe_")) {
    return "bad_execution_rollback";
  }
  if (id.startsWith("oco_")) {
    return "bad_outcome_chain";
  }
  if (id.startsWith("ols_") || id.startsWith("les_")) {
    return "bad_outcome_learning_chain";
  }
  if (id.startsWith("pkt_")) {
    return "invalid_continuity_packet";
  }
  return "external_artifact";
}

module.exports = {
  recoveryApply,
  recoveryList,
  recoveryPlan,
  recoveryQuarantine,
  recoveryRequest,
  recoveryShow,
  recoveryVerify,
  recoveryViolation
};
