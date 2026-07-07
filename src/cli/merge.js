const {
  appendEvent,
  contentHash,
  createEvent,
  newId,
  nowIso,
  parseList,
  readEvents
} = require("../events");
const { evaluateMergeEligibility } = require("../merges");
const {
  projectEvents,
  selectMergeRequestState
} = require("../projector");
const {
  stripUndefined,
  unique
} = require("../utils");
const {
  appendParticipant,
  participantFrom,
  print,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function mergeOpen(options, cwd) {
  requireOption(options, "source");
  requireOption(options, "target");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const proposed = directProposalIds(projection, options.source);
  const actor = participantFrom(options.openedBy || options.actor || "Author", options.role);
  appendParticipant(actor, cwd, options.target);
  const at = nowIso();
  const id = options.id || options.mergeRequestId || newId("mrg", options.summary);
  const mergeRequest = {
    id,
    mergeRequestId: id,
    object: "mergeRequest",
    threadId: options.target,
    sourceForkThreadId: options.source,
    targetThreadId: options.target,
    openedBy: actor.id,
    openedAt: at,
    summary: options.summary,
    status: "review",
    proposedAssumptionIds: parseList(options.assumptions || options.proposedAssumptions),
    proposedEvidenceIds: parseList(options.evidence || options.proposedEvidence),
    proposedClaimIds: parseList(options.claims || options.proposedClaims),
    proposedObjectionIds: parseList(options.objections || options.proposedObjections),
    proposedDecisionRecordIds: parseList(options.decisions || options.proposedDecisions)
  };
  applyDefaultProposedIds(mergeRequest, proposed);
  mergeRequest.contentHash = contentHash({
    sourceForkThreadId: mergeRequest.sourceForkThreadId,
    targetThreadId: mergeRequest.targetThreadId,
    openedBy: mergeRequest.openedBy,
    openedAt: mergeRequest.openedAt,
    summary: mergeRequest.summary,
    proposedAssumptionIds: mergeRequest.proposedAssumptionIds,
    proposedEvidenceIds: mergeRequest.proposedEvidenceIds,
    proposedClaimIds: mergeRequest.proposedClaimIds,
    proposedObjectionIds: mergeRequest.proposedObjectionIds,
    proposedDecisionRecordIds: mergeRequest.proposedDecisionRecordIds
  });
  const event = createEvent({
    type: "MergeRequestOpened",
    threadId: mergeRequest.targetThreadId,
    actorId: actor.id,
    at,
    payload: { mergeRequest }
  });
  appendEvent(event, cwd);
  return print({ mergeRequest, event });
}

function mergeReview(options, cwd) {
  requireOption(options, "request");
  requireOption(options, "status");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const request = projection.mergeRequests[options.request];
  if (!request) {
    throw new Error(`Merge request not found: ${options.request}`);
  }
  const reviewer = participantFrom(options.reviewer || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(reviewer, cwd, request.targetThreadId);
  const at = nowIso();
  const mergeReview = {
    id: options.id || newId("mrv", `${reviewer.name}_${options.status}`),
    object: "mergeReview",
    threadId: request.targetThreadId,
    mergeRequestId: request.id,
    reviewerId: reviewer.id,
    reviewerParticipantId: reviewer.id,
    status: options.status,
    summary: options.summary,
    requiredChanges: parseList(options.requiredChanges || options.changes),
    reviewedAt: at,
    contentHash: contentHash({
      mergeRequestId: request.id,
      reviewerId: reviewer.id,
      status: options.status,
      summary: options.summary,
      requiredChanges: parseList(options.requiredChanges || options.changes)
    })
  };
  stripUndefined(mergeReview);
  const event = createEvent({
    type: "MergeReviewSubmitted",
    threadId: mergeReview.threadId,
    actorId: reviewer.id,
    at,
    payload: { mergeReview }
  });
  appendEvent(event, cwd);
  return print({ mergeReview, event });
}

function mergeConflictDeclare(options, cwd) {
  requireOption(options, "request");
  requireOption(options, "type");
  requireOption(options, "parent");
  requireOption(options, "fork");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const request = projection.mergeRequests[options.request];
  if (!request) {
    throw new Error(`Merge request not found: ${options.request}`);
  }
  const actor = participantFrom(options.declaredBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, request.targetThreadId);
  const at = nowIso();
  const id = options.id || options.conflictId || newId("cnf", options.summary);
  const mergeConflict = {
    id,
    conflictId: id,
    object: "mergeConflict",
    threadId: request.targetThreadId,
    mergeRequestId: request.id,
    conflictType: options.type,
    parentObjectId: options.parent,
    forkObjectId: options.fork,
    summary: options.summary,
    status: "open",
    declaredBy: actor.id,
    declaredAt: at,
    contentHash: contentHash({
      mergeRequestId: request.id,
      conflictType: options.type,
      parentObjectId: options.parent,
      forkObjectId: options.fork,
      summary: options.summary,
      declaredBy: actor.id
    })
  };
  const event = createEvent({
    type: "MergeConflictDeclared",
    threadId: mergeConflict.threadId,
    actorId: actor.id,
    at,
    payload: { mergeConflict }
  });
  appendEvent(event, cwd);
  return print({ mergeConflict, event });
}

function mergeConflictResolve(options, cwd) {
  requireOption(options, "request");
  requireOption(options, "conflict");
  requireOption(options, "resolution");
  requireOption(options, "rationale");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const request = projection.mergeRequests[options.request];
  if (!request) {
    throw new Error(`Merge request not found: ${options.request}`);
  }
  const actor = participantFrom(options.resolvedBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, request.targetThreadId);
  const at = nowIso();
  const mergeConflictResolution = {
    id: options.id || newId("mcr", options.conflict),
    object: "mergeConflictResolution",
    threadId: request.targetThreadId,
    mergeRequestId: request.id,
    conflictId: options.conflict,
    resolution: options.resolution,
    rationale: options.rationale,
    resolvedBy: actor.id,
    resolvedAt: at,
    contentHash: contentHash({
      mergeRequestId: request.id,
      conflictId: options.conflict,
      resolution: options.resolution,
      rationale: options.rationale,
      resolvedBy: actor.id
    })
  };
  const event = createEvent({
    type: "MergeConflictResolved",
    threadId: mergeConflictResolution.threadId,
    actorId: actor.id,
    at,
    payload: { mergeConflictResolution }
  });
  appendEvent(event, cwd);
  return print({ mergeConflictResolution, event });
}

function mergeEligibility(options, cwd) {
  requireOption(options, "request");
  const events = readValidEventsForOptions(options, cwd);
  const projection = projectEvents(events);
  return print({
    ...evaluateMergeEligibility(events, options.request),
    mergeRequestState: selectMergeRequestState(projection, options.request)
  });
}

function mergeComplete(options, cwd) {
  requireOption(options, "request");
  const events = readValidEventsForOptions(options, cwd);
  const projection = projectEvents(events);
  const request = projection.mergeRequests[options.request];
  if (!request) {
    throw new Error(`Merge request not found: ${options.request}`);
  }
  const merger = participantFrom(options.mergedBy || options.actor || "Decision Owner", options.role || "decision owner", options.kind || "human");
  appendParticipant(merger, cwd, request.targetThreadId);
  const eligibilityEvents = readEvents(cwd);
  const at = nowIso();
  const acceptedObjectIds = parseList(options.accept || options.acceptedObjects);
  const rejectedObjectIds = parseList(options.reject || options.rejectedObjects);
  const preservedObjectionIds = parseList(options.preserve || options.preservedObjections);
  const defaultAcceptedObjectIds = unique([
    ...(request.proposedAssumptionIds || []),
    ...(request.proposedEvidenceIds || []),
    ...(request.proposedClaimIds || []),
    ...(request.proposedDecisionRecordIds || [])
  ]);
  const authorityTrail = [{
    participantId: merger.id,
    role: merger.role,
    source: "ParticipantAdded.role"
  }];
  const mergeCompletion = {
    id: options.id || newId("mcm", request.id),
    object: "mergeCompletion",
    threadId: request.targetThreadId,
    mergeRequestId: request.id,
    mergedBy: merger.id,
    mergedAt: at,
    acceptedObjectIds: acceptedObjectIds.length ? acceptedObjectIds : defaultAcceptedObjectIds,
    preservedObjectionIds: preservedObjectionIds.length ? preservedObjectionIds : (request.proposedObjectionIds || []),
    rejectedObjectIds,
    authorityTrail,
    contentHash: contentHash({
      mergeRequestId: request.id,
      mergedBy: merger.id,
      mergedAt: at,
      acceptedObjectIds: acceptedObjectIds.length ? acceptedObjectIds : defaultAcceptedObjectIds,
      preservedObjectionIds: preservedObjectionIds.length ? preservedObjectionIds : (request.proposedObjectionIds || []),
      rejectedObjectIds,
      authorityTrail
    })
  };
  const event = createEvent({
    type: "MergeCompleted",
    threadId: mergeCompletion.threadId,
    actorId: merger.id,
    at,
    payload: { mergeCompletion }
  });
  const eligibility = evaluateMergeEligibility(eligibilityEvents, request.id, {
    actorId: merger.id,
    completion: mergeCompletion,
    eventId: event.event_id
  });
  appendEvent(event, cwd);
  return print({
    mergeCompletion,
    eligibility,
    event
  });
}

function directProposalIds(projection, threadId) {
  return {
    proposedAssumptionIds: directIds(projection.assumptions, threadId),
    proposedEvidenceIds: directIds(projection.evidence, threadId),
    proposedClaimIds: directIds(projection.claims, threadId),
    proposedObjectionIds: directIds(projection.objections, threadId),
    proposedDecisionRecordIds: directIds(projection.decisionRecords, threadId)
  };
}

function directIds(collection, threadId) {
  return Object.values(collection)
    .filter((object) => object.threadId === threadId)
    .map((object) => object.id);
}

function applyDefaultProposedIds(mergeRequest, proposed) {
  for (const key of [
    "proposedAssumptionIds",
    "proposedEvidenceIds",
    "proposedClaimIds",
    "proposedObjectionIds",
    "proposedDecisionRecordIds"
  ]) {
    if (!mergeRequest[key].length) {
      mergeRequest[key] = proposed[key];
    }
  }
}

module.exports = {
  mergeComplete,
  mergeConflictDeclare,
  mergeConflictResolve,
  mergeEligibility,
  mergeOpen,
  mergeReview
};
