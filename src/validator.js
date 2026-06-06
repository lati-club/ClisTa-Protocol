const { evaluateDecisionEligibility, isBlockingObjection, isDecisionOwnerRole } = require("./governance");

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
  state.participants.set(participant.id, participant);
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
  if (!isDecisionOwner(decision.decidedByParticipantId, state) && !isDecisionOwner(event.actor_id, state)) {
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

function primaryObject(event) {
  const payload = event?.payload || {};
  return payload.thread
    || payload.threadFork
    || payload.participant
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
  return actorId === objection.participantId || isDecisionOwner(actorId, state);
}

function isDecisionOwner(participantId, state) {
  const participant = state.participants.get(participantId);
  return isDecisionOwnerRole(participant?.role);
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
