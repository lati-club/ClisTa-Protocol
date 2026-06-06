#!/usr/bin/env node
const path = require("node:path");
const {
  appendEvent,
  contentHash,
  createEvent,
  createParticipant,
  eventLogPath,
  initStore,
  newId,
  nowIso,
  parseList,
  participantIdFor,
  readEvents,
  readEventsAt
} = require("./events");
const { exportProtocol, projectEvents, selectAudit, selectThreadState } = require("./projector");
const { evaluateDecisionEligibility } = require("./governance");
const { assertValidEvents, validateEvents } = require("./validator");

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const { command, options } = parseCommand(argv);

  try {
    switch (command) {
      case "init":
        return print(initStore(cwd));
      case "thread create":
        return threadCreate(options, cwd);
      case "evidence commit":
        return evidenceCommit(options, cwd);
      case "assumption declare":
        return assumptionDeclare(options, cwd);
      case "assumptions list":
        return assumptionsList(options, cwd);
      case "claim create":
        return claimCreate(options, cwd);
      case "position take":
        return positionTake(options, cwd);
      case "objection raise":
        return objectionRaise(options, cwd);
      case "decision open":
        return decisionOpen(options, cwd);
      case "decision eligibility":
        return decisionEligibility(options, cwd);
      case "review submit":
        return reviewSubmit(options, cwd);
      case "decision merge":
        return decisionMerge(options, cwd);
      case "outcome expect":
        return outcomeExpect(options, cwd);
      case "outcome audit":
        return outcomeAudit(options, cwd);
      case "decision score":
        return decisionScore(options, cwd);
      case "validate":
        return validateCommand(options, cwd);
      case "state show":
        return stateShow(options, cwd);
      case "audit show":
        return auditShow(options, cwd);
      case "export":
        return exportShow(options, cwd);
      case "help":
      case "":
        return help();
      default:
        fail(`Unknown command: ${command}\n\n${usage()}`);
    }
  } catch (error) {
    fail(error.message);
  }
}

function threadCreate(options, cwd) {
  requireOption(options, "title");
  requireOption(options, "question");
  const actorKind = options.actorKind || (options.actor ? "human" : "system");
  const actor = participantFrom(options.actor || "System", options.actorRole || "system", actorKind);
  const participantSpecs = parseList(options.participant || options.participants);
  const participants = participantSpecs.length
    ? participantSpecs.map(parseParticipantSpec)
    : [actor];
  const at = nowIso();
  const thread = {
    id: options.id || newId("thd", options.title),
    object: "thread",
    title: options.title,
    question: options.question,
    status: "active",
    participantIds: unique(participants.map((participant) => participant.id)),
    createdAt: at,
    updatedAt: at
  };
  appendParticipant(actor, cwd, thread.id);
  for (const participant of participants) {
    appendParticipant(participant, cwd, thread.id);
  }
  const event = createEvent({
    type: "ThreadCreated",
    threadId: thread.id,
    actorId: actor.id,
    at,
    payload: { thread }
  });
  appendEvent(event, cwd);
  return print({ thread, event });
}

function evidenceCommit(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "source");
  requireOption(options, "finding");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const evidence = {
    id: options.id || newId("evd", options.finding),
    object: "evidence",
    threadId: options.thread,
    source: options.source,
    finding: options.finding,
    confidence: numberOption(options.confidence),
    committedByParticipantId: actor.id,
    committedAt: at,
    artifactIds: parseList(options.artifacts),
    contentHash: contentHash({
      source: options.source,
      finding: options.finding,
      confidence: numberOption(options.confidence),
      artifactIds: parseList(options.artifacts)
    })
  };
  stripUndefined(evidence);
  const event = createEvent({
    type: "EvidenceCommitted",
    threadId: evidence.threadId,
    actorId: actor.id,
    at,
    payload: { evidence }
  });
  appendEvent(event, cwd);
  return print({ evidence, event });
}

function assumptionDeclare(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "text");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const assumption = {
    id: options.id || newId("asm", options.text),
    object: "assumption",
    threadId: options.thread,
    text: options.text,
    status: options.status || "active",
    evidenceIds: parseList(options.evidence),
    confidence: numberOption(options.confidence),
    declaredByParticipantId: actor.id,
    declaredAt: at,
    contentHash: contentHash({
      text: options.text,
      status: options.status || "active",
      evidenceIds: parseList(options.evidence),
      confidence: numberOption(options.confidence)
    })
  };
  stripUndefined(assumption);
  const event = createEvent({
    type: "AssumptionDeclared",
    threadId: assumption.threadId,
    actorId: actor.id,
    at,
    payload: { assumption }
  });
  appendEvent(event, cwd);
  return print({ assumption, event });
}

function claimCreate(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "text");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const claim = {
    id: options.id || newId("clm", options.text),
    object: "claim",
    threadId: options.thread,
    text: options.text,
    status: options.status || "draft",
    evidenceIds: parseList(options.evidence || options.supports),
    assumptionIds: parseList(options.assumptions),
    contradictingEvidenceIds: parseList(options.contradicts),
    createdByParticipantId: actor.id,
    createdAt: at
  };
  const event = createEvent({
    type: "ClaimCreated",
    threadId: claim.threadId,
    actorId: actor.id,
    at,
    payload: { claim }
  });
  appendEvent(event, cwd);
  return print({ claim, event });
}

function positionTake(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "participant");
  requireOption(options, "stance");
  const participant = participantFrom(options.participant, options.role, options.kind || "human");
  appendParticipant(participant, cwd, options.thread);
  const at = nowIso();
  const targetObjectId = options.target || options.claim || options.request || options.thread;
  const position = {
    id: options.id || newId("pos", `${participant.name}_${options.stance}`),
    object: "position",
    threadId: options.thread,
    participantId: participant.id,
    targetObjectId,
    targetObjectType: options.targetType || inferTargetType(targetObjectId),
    stance: options.stance,
    reason: options.reason,
    takenAt: at
  };
  stripUndefined(position);
  const event = createEvent({
    type: "PositionTaken",
    threadId: position.threadId,
    actorId: participant.id,
    at,
    payload: { position }
  });
  appendEvent(event, cwd);
  return print({ position, event });
}

function objectionRaise(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "participant");
  requireOption(options, "target");
  requireOption(options, "text");
  const participant = participantFrom(options.participant, options.role, options.kind || "agent");
  appendParticipant(participant, cwd, options.thread);
  const at = nowIso();
  const objection = {
    id: options.id || newId("obj", options.text),
    object: "objection",
    threadId: options.thread,
    participantId: participant.id,
    targetObjectId: options.target,
    targetObjectType: options.targetType || inferTargetType(options.target),
    assumption: options.assumption,
    text: options.text,
    blocking: booleanOption(options.blocking, true),
    status: options.status || "open",
    resolution: options.resolution,
    raisedAt: at
  };
  stripUndefined(objection);
  const event = createEvent({
    type: "ObjectionRaised",
    threadId: objection.threadId,
    actorId: participant.id,
    at,
    payload: { objection }
  });
  appendEvent(event, cwd);
  return print({ objection, event });
}

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

function decisionEligibility(options, cwd) {
  requireOption(options, "request");
  const events = readValidEventsForOptions(options, cwd);
  return print(evaluateDecisionEligibility(events, options.request));
}

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

function outcomeExpect(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "decision");
  requireOption(options, "metric");
  requireOption(options, "operator");
  requireOption(options, "target");
  requireOption(options, "reviewDate");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const id = options.id || options.expectedOutcomeId || newId("exo", options.metric);
  const expectedOutcome = {
    id,
    expectedOutcomeId: id,
    object: "expectedOutcome",
    threadId: options.thread,
    decisionRecordId: options.decision,
    metric: options.metric,
    operator: options.operator,
    target: scalarOption(options.target),
    reviewDate: options.reviewDate,
    assumptionIds: parseList(options.assumptions),
    evidenceIds: parseList(options.evidence),
    description: options.description,
    declaredByParticipantId: actor.id,
    declaredAt: at,
    contentHash: contentHash({
      decisionRecordId: options.decision,
      metric: options.metric,
      operator: options.operator,
      target: scalarOption(options.target),
      reviewDate: options.reviewDate,
      assumptionIds: parseList(options.assumptions),
      evidenceIds: parseList(options.evidence),
      description: options.description
    })
  };
  stripUndefined(expectedOutcome);
  const event = createEvent({
    type: "ExpectedOutcomeDeclared",
    threadId: expectedOutcome.threadId,
    actorId: actor.id,
    at,
    payload: { expectedOutcome }
  });
  appendEvent(event, cwd);
  return print({ expectedOutcome, event });
}

function outcomeAudit(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "expected");
  requireOption(options, "actual");
  requireOption(options, "result");
  requireOption(options, "summary");
  requireOption(options, "auditor");
  const projection = projectEvents(readEvents(cwd));
  const expectedOutcome = projection.expectedOutcomes[options.expected];
  const decisionRecordId = options.decision || expectedOutcome?.decisionRecordId;
  if (!decisionRecordId) {
    throw new Error(`Decision record not found for expected outcome: ${options.expected}`);
  }
  const auditor = participantFrom(options.auditor, options.role || "auditor", options.kind || "human");
  appendParticipant(auditor, cwd, options.thread);
  const at = nowIso();
  const id = options.id || options.outcomeAuditId || newId("out", options.expected);
  const outcomeAudit = {
    id,
    outcomeAuditId: id,
    object: "outcomeAudit",
    threadId: options.thread,
    decisionRecordId,
    expectedOutcomeId: options.expected,
    actual: scalarOption(options.actual),
    result: options.result,
    summary: options.summary,
    failedAssumptionIds: parseList(options.failedAssumptions || options.failedAssumptionIds),
    failedEvidenceIds: parseList(options.failedEvidence || options.failedEvidenceIds),
    auditedBy: auditor.id,
    auditedByParticipantId: auditor.id,
    auditedAt: at,
    contentHash: contentHash({
      decisionRecordId,
      expectedOutcomeId: options.expected,
      actual: scalarOption(options.actual),
      result: options.result,
      summary: options.summary,
      failedAssumptionIds: parseList(options.failedAssumptions || options.failedAssumptionIds),
      failedEvidenceIds: parseList(options.failedEvidence || options.failedEvidenceIds),
      auditedBy: auditor.id
    })
  };
  stripUndefined(outcomeAudit);
  const event = createEvent({
    type: "OutcomeAudited",
    threadId: outcomeAudit.threadId,
    actorId: auditor.id,
    at,
    payload: { outcomeAudit }
  });
  appendEvent(event, cwd);
  return print({ outcomeAudit, event });
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

function stateShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(selectThreadState(projection, options.thread));
}

function auditShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(selectAudit(projection, options.thread));
}

function assumptionsList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const state = selectThreadState(projection, options.thread);
  return print(state.error ? state : state.assumptions);
}

function exportShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(exportProtocol(projection));
}

function validateCommand(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function appendParticipant(participant, cwd, threadId) {
  const existing = projectEvents(readEvents(cwd)).participants[participant.id];
  if (existing) {
    return;
  }
  appendEvent(createEvent({
    type: "ParticipantAdded",
    threadId,
    actorId: participant.id,
    at: nowIso(),
    payload: { participant }
  }), cwd);
}

function readEventsForOptions(options, cwd) {
  if (options.events) {
    return readEventsAt(path.resolve(cwd, options.events));
  }
  return readEvents(cwd);
}

function readValidEventsForOptions(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  assertValidEvents(events);
  return events;
}

function parseCommand(argv) {
  const commandParts = [];
  const optionArgs = [];
  let readingOptions = false;
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      readingOptions = true;
    }
    if (readingOptions) {
      optionArgs.push(arg);
    } else {
      commandParts.push(arg);
    }
  }
  return {
    command: commandParts.join(" "),
    options: parseOptions(optionArgs)
  };
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = args[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (value !== true) {
      index += 1;
    }
    if (options[key] === undefined) {
      options[key] = value;
    } else if (Array.isArray(options[key])) {
      options[key].push(value);
    } else {
      options[key] = [options[key], value];
    }
  }
  return options;
}

function parseParticipantSpec(spec) {
  const [idOrName, nameOrRole, maybeRole] = String(spec).split(":").map((part) => part.trim());
  if (idOrName.startsWith("par_")) {
    return {
      id: idOrName,
      object: "participant",
      kind: "human",
      name: nameOrRole || idOrName.replace(/^par_/, "").replace(/_/g, " "),
      role: maybeRole
    };
  }
  return createParticipant(idOrName, nameOrRole);
}

function participantFrom(value, role, kind = "human") {
  const participant = createParticipant(value, role, kind);
  participant.name = String(value || participant.name).startsWith("par_") ? participant.name : String(value || participant.name);
  participant.kind = kind;
  return participant;
}

function inferTargetType(id) {
  if (!id) {
    return undefined;
  }
  if (id.startsWith("clm_")) {
    return "claim";
  }
  if (id.startsWith("asm_")) {
    return "assumption";
  }
  if (id.startsWith("drq_")) {
    return "decisionRequest";
  }
  if (id.startsWith("pos_")) {
    return "position";
  }
  if (id.startsWith("evd_")) {
    return "evidence";
  }
  return "thread";
}

function requireOption(options, key) {
  if (!options[key]) {
    throw new Error(`Missing required option --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
}

function numberOption(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const number = Number(value);
  if (Number.isNaN(number)) {
    throw new Error(`Expected number, got ${value}`);
  }
  return number;
}

function scalarOption(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const text = String(value).trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }
  return value;
}

function booleanOption(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  if (value === true || value === false) {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  throw new Error(`Expected boolean, got ${value}`);
}

function stripUndefined(object) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) {
      delete object[key];
    }
  }
  return object;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function help() {
  process.stdout.write(`${usage()}\n`);
}

function usage() {
  return `Usage:
  clista init
  clista thread create --title <title> --question <question>
  clista evidence commit --thread <threadId> --source <source> --finding <finding>
  clista assumption declare --thread <threadId> --text <assumption>
  clista assumptions list [--thread <threadId>] [--events <path>]
  clista claim create --thread <threadId> --text <claim> --evidence <evidenceIds>
  clista position take --thread <threadId> --participant <name|id> --stance <support|oppose|conditional|neutral|abstain>
  clista objection raise --thread <threadId> --participant <name|id> --target <objectId> --text <objection>
  clista decision open --thread <threadId> --proposal <proposal>
  clista decision eligibility --request <decisionRequestId> [--events <path>]
  clista review submit --thread <threadId> --request <requestId> --reviewer <name|id> --status <status>
  clista decision merge --thread <threadId> --request <requestId> --decider <name|id>
  clista outcome expect --thread <threadId> --decision <decisionRecordId> --metric <metric> --operator <operator> --target <target> --review-date <YYYY-MM-DD>
  clista outcome audit --thread <threadId> --expected <expectedOutcomeId> --actual <actual> --result <result> --summary <summary> --auditor <name|id>
  clista decision score --thread <threadId> --decision <decisionRecordId> --score <score> --status <status> --rationale <text> --audits <outcomeAuditIds>
  clista validate [--events <path>]
  clista state show [--thread <threadId>] [--events <path>]
  clista audit show [--thread <threadId>] [--events <path>]
  clista export [--events <path>]`;
}

if (require.main === module) {
  main();
}

module.exports = { main, parseOptions };
