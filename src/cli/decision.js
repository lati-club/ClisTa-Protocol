const {
  appendEvent,
  contentHash,
  createEvent,
  newId,
  nowIso,
  parseList,
  readEvents
} = require("../events");
const { proposeDecision } = require("../gate");
const { evaluateDecisionEligibility } = require("../governance");
const {
  projectEvents,
  selectDecisionSummary
} = require("../projector");
const {
  stripUndefined,
  unique
} = require("../utils");
const {
  appendParticipant,
  numberOption,
  participantFrom,
  print,
  readValidEventsForOptions,
  requireOption,
  writeOut
} = require("./shared");

function decisionOpen(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "proposal");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const decisionRequest = {
    id: options.id || newId("drq", options.proposal),
    object: "decisionRequest",
    threadId: options.thread,
    proposal: options.proposal,
    status: "review",
    supportingEvidenceIds: parseList(options.evidence || options.supportingEvidence),
    supportingClaimIds: parseList(options.claims || options.supportingClaims),
    supportingAssumptionIds: parseList(options.assumptions || options.supportingAssumptions),
    objectionIds: parseList(options.objections),
    openedByParticipantId: actor.id,
    openedAt: at
  };
  const event = createEvent({
    type: "DecisionRequestOpened",
    threadId: decisionRequest.threadId,
    actorId: actor.id,
    at,
    payload: { decisionRequest }
  });
  appendEvent(event, cwd);
  return print({ decisionRequest, event });
}

function decisionPropose(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "proposal");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const decisionRequest = {
    id: options.id || newId("drq", options.proposal),
    object: "decisionRequest",
    threadId: options.thread,
    proposal: options.proposal,
    status: "review",
    supportingEvidenceIds: parseList(options.evidence || options.supportingEvidence),
    supportingClaimIds: parseList(options.claims || options.supportingClaims),
    supportingAssumptionIds: parseList(options.assumptions || options.supportingAssumptions),
    objectionIds: parseList(options.objections),
    openedByParticipantId: actor.id,
    openedAt: at
  };
  const result = proposeDecision(decisionRequest, cwd);
  return print(result);
}

function decisionEligibility(options, cwd) {
  requireOption(options, "request");
  const events = readValidEventsForOptions(options, cwd);
  return print(evaluateDecisionEligibility(events, options.request));
}

function decisionMerge(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "request");
  requireOption(options, "decider");
  const projection = projectEvents(readEvents(cwd));
  const request = projection.decisionRequests[options.request];
  if (!request) {
    throw new Error(`Decision request not found: ${options.request}`);
  }
  const decider = participantFrom(options.decider, options.role || "decision owner", options.kind || "human");
  appendParticipant(decider, cwd, options.thread);
  const at = nowIso();
  const preservedObjectionIds = parseList(options.preserve || options.preservedObjections);
  const reviewIds = Object.values(projection.reviews)
    .filter((review) => review.decisionRequestId === request.id)
    .map((review) => review.id);
  const supportingEvidenceIds = unique([
    ...parseList(options.evidence),
    ...(request.supportingEvidenceIds || [])
  ]);
  const supportingClaimIds = unique([
    ...parseList(options.claims),
    ...(request.supportingClaimIds || [])
  ]);
  const supportingAssumptionIds = unique([
    ...parseList(options.assumptions),
    ...(request.supportingAssumptionIds || [])
  ]);
  const objectionIds = unique([
    ...(request.objectionIds || []),
    ...preservedObjectionIds
  ]);
  const authorityTrail = [{
    participantId: decider.id,
    role: decider.role,
    source: "ParticipantAdded.role"
  }];
  const decisionRecord = {
    id: options.id || newId("dcr", request.proposal),
    object: "decisionRecord",
    threadId: options.thread,
    decisionRequestId: request.id,
    status: options.status || "approved",
    summary: options.summary || request.proposal,
    rationale: options.rationale,
    conditions: parseList(options.conditions),
    supportingEvidenceIds,
    supportingClaimIds,
    supportingAssumptionIds,
    objectionIds,
    reviewIds,
    authorityTrail,
    preservedObjectionIds,
    minorityReportIds: [],
    nextAction: options.next,
    nextReviewAt: options.nextReviewAt,
    decidedByParticipantId: decider.id,
    decidedAt: at,
    contentHash: contentHash({
      requestId: request.id,
      status: options.status || "approved",
      summary: options.summary || request.proposal,
      rationale: options.rationale,
      conditions: parseList(options.conditions),
      supportingEvidenceIds,
      supportingClaimIds,
      supportingAssumptionIds,
      objectionIds,
      reviewIds,
      authorityTrail,
      preservedObjectionIds,
      nextAction: options.next,
      nextReviewAt: options.nextReviewAt
    })
  };
  stripUndefined(decisionRecord);
  const event = createEvent({
    type: "DecisionMerged",
    threadId: decisionRecord.threadId,
    actorId: decider.id,
    at,
    payload: { decisionRecord }
  });
  appendEvent(event, cwd);

  let minorityReport;
  if (options.minorityReport) {
    const participant = participantFrom(options.minorityParticipant || options.participant || "Dissent Agent", "dissent", "agent");
    appendParticipant(participant, cwd, options.thread);
    minorityReport = {
      id: newId("mnr", options.minorityReport),
      object: "minorityReport",
      threadId: options.thread,
      decisionRecordId: decisionRecord.id,
      participantId: participant.id,
      text: options.minorityReport,
      objectionIds: preservedObjectionIds,
      filedAt: nowIso(),
      contentHash: contentHash({
        decisionRecordId: decisionRecord.id,
        participantId: participant.id,
        text: options.minorityReport,
        objectionIds: preservedObjectionIds
      })
    };
    appendEvent(createEvent({
      type: "MinorityReportFiled",
      threadId: options.thread,
      actorId: participant.id,
      at: minorityReport.filedAt,
      payload: { minorityReport }
    }), cwd);
  }

  return print({ decisionRecord, minorityReport, event });
}

function decisionScore(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "decision");
  requireOption(options, "score");
  requireOption(options, "status");
  requireOption(options, "rationale");
  requireOption(options, "audits");
  const scorer = participantFrom(options.scorer || options.actor || "Evaluator", options.role || "auditor", options.kind || "human");
  appendParticipant(scorer, cwd, options.thread);
  const at = nowIso();
  const decisionScore = {
    id: options.id || newId("dsc", options.decision),
    object: "decisionScore",
    threadId: options.thread,
    decisionRecordId: options.decision,
    score: numberOption(options.score),
    status: options.status,
    rationale: options.rationale,
    basedOnOutcomeAuditIds: parseList(options.audits || options.basedOnOutcomeAuditIds),
    scoredByParticipantId: scorer.id,
    scoredAt: at,
    contentHash: contentHash({
      decisionRecordId: options.decision,
      score: numberOption(options.score),
      status: options.status,
      rationale: options.rationale,
      basedOnOutcomeAuditIds: parseList(options.audits || options.basedOnOutcomeAuditIds)
    })
  };
  stripUndefined(decisionScore);
  const event = createEvent({
    type: "DecisionScored",
    threadId: decisionScore.threadId,
    actorId: scorer.id,
    at,
    payload: { decisionScore }
  });
  appendEvent(event, cwd);
  return print({ decisionScore, event });
}

function decisionSummary(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const summary = selectDecisionSummary(projection, options.thread);
  const fmt = (options.format || "").toLowerCase();
  if (fmt === "text" || fmt === "md" || fmt === "markdown") {
    const text = formatDecisionSummaryAsText(summary);
    writeOut(text + (text.endsWith("\n") ? "" : "\n"));
    return;
  }
  return print(summary);
}

function formatDecisionSummaryAsText(s) {
  if (s.error) {
    return `Decision Summary Error: ${s.error} (thread ${s.threadId || "unknown"})`;
  }
  // Always render all four questions, with an explicit fallback when a section
  // is empty, so the answer view is consistent and never shows a bare heading.
  const lines = [];
  lines.push(`# ${s.title || "Decision Summary"}`);
  lines.push(`Thread: ${s.threadId}`);
  lines.push(`Question: ${s.question}`);
  lines.push(`Status: ${s.status}`);

  lines.push("", "## What was decided");
  if (s.whatWasDecided) {
    if (s.whatWasDecided.status) lines.push(`Status: ${s.whatWasDecided.status}`);
    if (s.whatWasDecided.summary) lines.push(`Summary: ${s.whatWasDecided.summary}`);
    if (s.whatWasDecided.decidedBy) lines.push(`Decided by: ${s.whatWasDecided.decidedBy}`);
    if (s.whatWasDecided.proposal) lines.push(`Proposal: ${s.whatWasDecided.proposal}`);
  } else {
    lines.push("Not yet decided.");
  }

  lines.push("", "## Why");
  const why = s.why || {};
  let wroteWhy = false;
  if (why.rationale) { lines.push(`Rationale: ${why.rationale}`); wroteWhy = true; }
  if (why.supportingEvidence?.length) {
    lines.push("Supporting evidence:");
    for (const e of why.supportingEvidence) lines.push(`- [${e.id}] ${e.finding || e.source}`);
    wroteWhy = true;
  }
  if (why.supportingClaims?.length) {
    lines.push("Supporting claims:");
    for (const c of why.supportingClaims) lines.push(`- [${c.id}] ${c.text}`);
    wroteWhy = true;
  }
  if (why.supportingAssumptions?.length) {
    lines.push("Supporting assumptions:");
    for (const a of why.supportingAssumptions) lines.push(`- [${a.id}] ${a.text}`);
    wroteWhy = true;
  }
  if (!wroteWhy) lines.push("No rationale or support recorded.");

  lines.push("", "## Who dissented");
  const dissent = s.whoDissented || {};
  let wroteDissent = false;
  if (dissent.objections?.length) {
    lines.push("Objections:");
    for (const o of dissent.objections) {
      const block = o.blocking ? " (blocking)" : "";
      lines.push(`- [${o.id}] ${o.raisedBy || "?"}: ${o.text}${block}`);
    }
    wroteDissent = true;
  }
  if (dissent.minorityReports?.length) {
    lines.push("Minority reports:");
    for (const m of dissent.minorityReports) {
      lines.push(`- [${m.id}] ${m.filedBy}: ${m.text}`);
    }
    wroteDissent = true;
  }
  if (!wroteDissent) lines.push("None recorded.");

  lines.push("", "## What next");
  lines.push(s.whatNext || "No next action recorded.");

  return lines.join("\n");
}

module.exports = {
  decisionEligibility,
  decisionMerge,
  decisionOpen,
  decisionPropose,
  decisionScore,
  decisionSummary
};
