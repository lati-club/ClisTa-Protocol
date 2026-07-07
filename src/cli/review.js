const {
  appendEvent,
  createEvent,
  newId,
  nowIso,
  parseList
} = require("../events");
const { projectEvents } = require("../projector");
const {
  buildReviewCompletion,
  buildReviewDispute,
  buildReviewOpening,
  buildReviewRequirement,
  buildReviewViolation,
  reviewForId
} = require("../review");
const { stripUndefined } = require("../utils");
const { validateEvents } = require("../validator");
const {
  appendParticipant,
  booleanOption,
  inferTargetType,
  participantFrom,
  print,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function reviewSubmit(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "request");
  requireOption(options, "reviewer");
  requireOption(options, "status");
  const reviewer = participantFrom(options.reviewer, options.role || "reviewer", options.kind || "human");
  appendParticipant(reviewer, cwd, options.thread);
  const at = nowIso();
  const review = {
    id: options.id || newId("rev", `${reviewer.name}_${options.status}`),
    object: "review",
    threadId: options.thread,
    decisionRequestId: options.request,
    reviewerParticipantId: reviewer.id,
    status: options.status,
    conditions: parseList(options.conditions),
    comment: options.comment,
    reviewedAt: at
  };
  stripUndefined(review);
  const event = createEvent({
    type: "ReviewSubmitted",
    threadId: review.threadId,
    actorId: reviewer.id,
    at,
    payload: { review }
  });
  appendEvent(event, cwd);
  return print({ review, event });
}

function reviewRequire(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "reason");
  const subjectId = options.subject || options.subjectId || options.id;
  if (!subjectId) {
    throw new Error("Missing required option --subject");
  }
  const subjectType = options.subjectType || options.objectType || inferReviewSubjectType(subjectId);
  const actor = participantFrom(options.requiredBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const protocolReview = buildReviewRequirement({
    id: options.review || options.reviewId || options.id,
    threadId: options.thread,
    subjectType,
    subjectId,
    triggerType: options.trigger || options.triggerType || "state_change",
    triggerEventId: options.triggerEvent || options.triggerEventId,
    reason: options.reason,
    requiredReviewerRole: options.requiredReviewerRole || options.reviewerRole || "reviewer",
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
  return print({
    schema: "clista.review.require.v0",
    required: true,
    protocolReview,
    event
  });
}

function reviewOpen(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const requiredReviewId = options.review || options.reviewId;
  const existing = requiredReviewId ? projection.review.byReview[requiredReviewId] : null;
  if (requiredReviewId && !existing) {
    throw new Error(`Unknown protocol review ${requiredReviewId}`);
  }
  const subjectId = existing?.subjectId || options.subject || options.subjectId || options.id;
  if (!subjectId) {
    throw new Error("Missing required option --subject");
  }
  const subjectType = existing?.subjectType || options.subjectType || options.objectType || inferReviewSubjectType(subjectId);
  const threadId = existing?.threadId || options.thread;
  if (!threadId) {
    throw new Error("Missing required option --thread");
  }
  const actor = participantFrom(options.openedBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, threadId);
  const at = nowIso();
  const protocolReview = buildReviewOpening({
    id: existing?.id || options.review || options.reviewId || options.id,
    threadId,
    subjectType,
    subjectId,
    triggerType: existing?.triggerType || options.trigger || options.triggerType || "manual_review",
    triggerEventId: existing?.triggerEventId || options.triggerEvent || options.triggerEventId,
    reason: options.reason || existing?.reason,
    required: existing?.required || booleanOption(options.required, false),
    requiredReviewId: existing?.id || null,
    requiredReviewerRole: existing?.requiredReviewerRole || options.requiredReviewerRole || options.reviewerRole,
    requiredByParticipantId: existing?.requiredByParticipantId || null,
    requiredAt: existing?.requiredAt || null,
    openedByParticipantId: actor.id,
    openedAt: at
  });
  const event = createEvent({
    type: "ReviewOpened",
    threadId: protocolReview.threadId,
    actorId: protocolReview.openedByParticipantId,
    at,
    payload: { protocolReview }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.review.open.v0",
    opened: true,
    protocolReview,
    event
  });
}

function reviewComplete(options, cwd) {
  requireOption(options, "review");
  requireOption(options, "summary");
  const { record } = reviewRecordForCli(options, cwd);
  const actor = participantFrom(options.completedBy || options.reviewer || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const protocolReviewCompletion = buildReviewCompletion({
    id: options.id || options.completion,
    reviewId: record.id,
    threadId: record.threadId,
    summary: options.summary,
    completedByParticipantId: actor.id,
    completedAt: at
  });
  const event = createEvent({
    type: "ReviewCompleted",
    threadId: protocolReviewCompletion.threadId,
    actorId: protocolReviewCompletion.completedByParticipantId,
    at,
    payload: { protocolReviewCompletion }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.review.complete.v0",
    completed: true,
    protocolReviewCompletion,
    event
  });
}

function reviewDispute(options, cwd) {
  requireOption(options, "review");
  requireOption(options, "reason");
  const { record } = reviewRecordForCli(options, cwd);
  const actor = participantFrom(options.disputedBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const protocolReviewDispute = buildReviewDispute({
    id: options.id || options.dispute,
    reviewId: record.id,
    threadId: record.threadId,
    reason: options.reason,
    disputedByParticipantId: actor.id,
    disputedAt: at
  });
  const event = createEvent({
    type: "ReviewDisputed",
    threadId: protocolReviewDispute.threadId,
    actorId: protocolReviewDispute.disputedByParticipantId,
    at,
    payload: { protocolReviewDispute }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.review.dispute.v0",
    disputed: true,
    protocolReviewDispute,
    event
  });
}

function reviewViolation(options, cwd) {
  requireOption(options, "review");
  requireOption(options, "type");
  requireOption(options, "reason");
  const { record } = reviewRecordForCli(options, cwd);
  const actor = participantFrom(options.detectedBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const protocolReviewViolation = buildReviewViolation({
    id: options.id || options.violation,
    reviewId: record.id,
    threadId: record.threadId,
    violationType: options.type || options.violationType,
    reason: options.reason,
    detectedByParticipantId: actor.id,
    detectedAt: at
  });
  const event = createEvent({
    type: "ReviewViolationRecorded",
    threadId: protocolReviewViolation.threadId,
    actorId: protocolReviewViolation.detectedByParticipantId,
    at,
    payload: { protocolReviewViolation }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.review.violation.v0",
    violated: true,
    protocolReviewViolation,
    event
  });
}

function reviewList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let records = projection.review.records;
  if (options.thread) {
    records = records.filter((record) => record.threadId === options.thread);
  }
  if (options.status) {
    records = records.filter((record) => record.status === options.status);
  }
  return print({
    schema: "clista.review.list.v0",
    theorem: projection.review.theorem,
    hardLaw: projection.review.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: records.length,
    records
  });
}

function reviewShow(options, cwd) {
  const reviewId = options.review || options.reviewId || options.id;
  if (!reviewId) {
    throw new Error("Missing required option --review");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(reviewForId(projection.review, reviewId));
}

function reviewVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.review.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.review.verify.v0",
    valid: true,
    errors: [],
    reviewValidationStatus: projection.review.reviewValidationStatus
  });
}

function reviewRecordForCli(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const reviewId = options.review || options.reviewId || options.id;
  const record = projection.review.byReview[reviewId];
  if (!record) {
    throw new Error(`Unknown protocol review ${reviewId}`);
  }
  return { projection, record };
}

function inferReviewSubjectType(id) {
  if (!id) {
    return "thread";
  }
  if (id.startsWith("dlg_")) {
    return "delegation";
  }
  if (id.startsWith("dga_")) {
    return "delegated_action";
  }
  if (id.startsWith("dgv_")) {
    return "delegation_violation";
  }
  if (id.startsWith("exe_")) {
    return "execution";
  }
  if (id.startsWith("exv_")) {
    return "execution_violation";
  }
  if (id.startsWith("oco_")) {
    return "outcome";
  }
  if (id.startsWith("ocd_")) {
    return "outcome_dispute";
  }
  if (id.startsWith("ocv_")) {
    return "outcome_violation";
  }
  if (id.startsWith("ols_")) {
    return "outcome_learning_signal";
  }
  if (id.startsWith("les_")) {
    return "outcome_lesson";
  }
  if (id.startsWith("old_")) {
    return "outcome_learning_dispute";
  }
  if (id.startsWith("olv_")) {
    return "outcome_learning_violation";
  }
  if (id.startsWith("prv_")) {
    return "protocol_review";
  }
  return inferTargetType(id);
}

module.exports = {
  reviewComplete,
  reviewDispute,
  reviewList,
  reviewOpen,
  reviewRequire,
  reviewShow,
  reviewSubmit,
  reviewVerify,
  reviewViolation
};
