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
  buildOutcomeDispute,
  buildOutcomeEvaluation,
  buildOutcomeExpectation,
  buildOutcomeObservation,
  outcomeForId
} = require("../outcome");
const {
  buildOutcomeLearningDispute,
  buildOutcomeLearningSignal,
  buildOutcomeLearningViolation,
  buildOutcomeLesson,
  outcomeLearningForId
} = require("../outcome-learning");
const { projectEvents } = require("../projector");
const { validateEvents } = require("../validator");
const { stripUndefined } = require("../utils");
const {
  appendParticipant,
  participantFrom,
  print,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption,
  scalarOption
} = require("./shared");

function outcomeExpect(options, cwd) {
  if (options.execution) {
    return protocolOutcomeExpect(options, cwd);
  }
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

function protocolOutcomeExpect(options, cwd) {
  requireOption(options, "execution");
  const expectedEffect = options.expectedEffect || options.effect;
  if (!expectedEffect) {
    throw new Error("Missing required option --expected-effect");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const execution = projection.execution.byExecution[options.execution];
  if (!execution) {
    throw new Error(`Unknown execution ${options.execution}`);
  }
  const actor = options.actor ? participantFrom(options.actor, options.role || "outcome_author") : null;
  if (actor) {
    appendParticipant(actor, cwd, execution.threadId);
  }
  const actorId = actor?.id || execution.actorId;
  const at = nowIso();
  const outcomeRecord = buildOutcomeExpectation({
    id: options.id || options.outcome,
    executionId: execution.id,
    threadId: execution.threadId,
    actorId,
    expectedEffect,
    evidence: parseList(options.evidence),
    createdAt: at
  });
  const event = createEvent({
    type: "OutcomeExpected",
    threadId: outcomeRecord.threadId,
    actorId: outcomeRecord.actorId,
    at,
    payload: { outcomeRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome.expect.v0",
    expected: true,
    outcomeRecord,
    event
  });
}

function outcomeObserve(options, cwd) {
  requireOption(options, "outcome");
  requireOption(options, "evidence");
  const observedEffect = options.observedEffect || options.effect;
  if (!observedEffect) {
    throw new Error("Missing required option --observed-effect");
  }
  const { record } = outcomeRecordForCli(options, cwd);
  const observer = options.observer || options.actor
    ? participantFrom(options.observer || options.actor, options.role || "outcome_observer")
    : null;
  if (observer) {
    appendParticipant(observer, cwd, record.threadId);
  }
  const actorId = observer?.id || record.actorId;
  const at = nowIso();
  const outcomeRecord = buildOutcomeObservation({
    id: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    actorId,
    expectedEffect: record.expectedEffect,
    observedEffect,
    evidence: parseList(options.evidence),
    observedAt: at
  });
  const event = createEvent({
    type: "OutcomeObserved",
    threadId: outcomeRecord.threadId,
    actorId: outcomeRecord.actorId,
    at,
    payload: { outcomeRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome.observe.v0",
    observed: true,
    outcomeRecord,
    event
  });
}

function outcomeEvaluate(options, cwd) {
  requireOption(options, "outcome");
  requireOption(options, "result");
  requireOption(options, "comparison");
  requireOption(options, "evidence");
  const { projection, record } = outcomeRecordForCli(options, cwd);
  const observation = projection.outcome.observationsByOutcome[record.id]?.at(-1);
  if (!observation) {
    throw new Error(`Outcome ${record.id} has not been observed`);
  }
  const evaluator = options.evaluator || options.actor
    ? participantFrom(options.evaluator || options.actor, options.role || "outcome_evaluator")
    : null;
  if (evaluator) {
    appendParticipant(evaluator, cwd, record.threadId);
  }
  const evaluatorId = evaluator?.id || record.actorId;
  const at = nowIso();
  const outcomeRecord = buildOutcomeEvaluation({
    id: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    actorId: evaluatorId,
    expectedEffect: record.expectedEffect,
    observedEffect: observation.observedEffect,
    evidence: parseList(options.evidence),
    evaluationResult: options.result,
    comparison: options.comparison,
    confidence: options.confidence,
    evaluatedByParticipantId: evaluatorId,
    evaluatedAt: at
  });
  const event = createEvent({
    type: "OutcomeEvaluated",
    threadId: outcomeRecord.threadId,
    actorId: outcomeRecord.actorId,
    at,
    payload: { outcomeRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome.evaluate.v0",
    evaluated: true,
    outcomeRecord,
    event
  });
}

function outcomeDispute(options, cwd) {
  requireOption(options, "outcome");
  requireOption(options, "reason");
  const { record } = outcomeRecordForCli(options, cwd);
  const disputer = options.disputer || options.actor
    ? participantFrom(options.disputer || options.actor, options.role || "outcome_disputer")
    : null;
  if (disputer) {
    appendParticipant(disputer, cwd, record.threadId);
  }
  const disputerId = disputer?.id || record.actorId;
  const at = nowIso();
  const outcomeDisputeRecord = buildOutcomeDispute({
    id: options.id || options.dispute,
    outcomeId: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    reason: options.reason,
    disputedByParticipantId: disputerId,
    disputedAt: at
  });
  const event = createEvent({
    type: "OutcomeDisputed",
    threadId: outcomeDisputeRecord.threadId,
    actorId: outcomeDisputeRecord.disputedByParticipantId,
    at,
    payload: { outcomeDispute: outcomeDisputeRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome.dispute.v0",
    disputed: true,
    outcomeDispute: outcomeDisputeRecord,
    event
  });
}

function outcomeList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let records = projection.outcome.records;
  if (options.thread) {
    records = records.filter((record) => record.threadId === options.thread);
  }
  if (options.status) {
    records = records.filter((record) => record.status === options.status);
  }
  return print({
    schema: "clista.outcome.list.v0",
    theorem: projection.outcome.theorem,
    hardLaw: projection.outcome.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: records.length,
    records
  });
}

function outcomeShow(options, cwd) {
  const outcomeId = options.outcome || options.outcomeId || options.id;
  if (!outcomeId) {
    throw new Error("Missing required option --outcome");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(outcomeForId(projection.outcome, outcomeId));
}

function outcomeVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.outcome.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.outcome.verify.v0",
    valid: true,
    errors: [],
    outcomeValidationStatus: projection.outcome.outcomeValidationStatus
  });
}

function outcomeLearningDerive(options, cwd) {
  requireOption(options, "outcome");
  requireOption(options, "lesson");
  const { projection, record } = outcomeRecordForCli(options, cwd);
  const evaluation = projection.outcome.evaluationsByOutcome[record.id]?.at(-1);
  if (!evaluation) {
    throw new Error(`Outcome ${record.id} has not been evaluated`);
  }
  const actorId = outcomeLearningActorId(
    options,
    cwd,
    record.threadId,
    evaluation.evaluatedByParticipantId || record.actorId,
    "outcome_learning_deriver"
  );
  const at = nowIso();
  const evidence = parseList(options.evidence || options.evidences);
  const signal = buildOutcomeLearningSignal({
    id: options.id || options.learning || options.signal,
    outcomeId: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    evaluationResult: evaluation.evaluationResult,
    lesson: options.lesson,
    confirmedAssumptionIds: parseList(options.confirmedAssumption || options.confirmedAssumptions),
    failedAssumptionIds: parseList(options.failedAssumption || options.failedAssumptions),
    recommendedConstraints: parseList(options.constraint || options.constraints),
    recommendedAmendments: parseList(
      options.amendmentRecommendation || options.amendmentRecommendations || options.amendment
    ),
    evidence: evidence.length ? evidence : evaluation.evidence,
    confidence: options.confidence || "medium",
    sourceOutcomeHash: evaluation.outcomeHash,
    derivedByParticipantId: actorId,
    derivedAt: at
  });
  const event = createEvent({
    type: "LearningSignalDerived",
    threadId: signal.threadId,
    actorId: signal.derivedByParticipantId,
    at,
    payload: { outcomeLearningSignal: signal }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome_learning.derive.v0",
    derived: true,
    outcomeLearningSignal: signal,
    event
  });
}

function outcomeLearningLesson(options, cwd) {
  requireOption(options, "signal");
  requireOption(options, "lesson");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const signal = projection.outcomeLearning.bySignal[options.signal];
  if (!signal) {
    throw new Error(`Unknown outcome learning signal ${options.signal}`);
  }
  const actorId = outcomeLearningActorId(
    options,
    cwd,
    signal.threadId,
    signal.derivedByParticipantId,
    "outcome_lesson_recorder"
  );
  const at = nowIso();
  const evidence = parseList(options.evidence || options.evidences);
  const lesson = buildOutcomeLesson({
    id: options.id || options.lessonId,
    learningSignalId: signal.id,
    outcomeId: signal.outcomeId,
    executionId: signal.executionId,
    threadId: signal.threadId,
    lesson: options.lesson,
    evidence: evidence.length ? evidence : signal.evidence,
    recordedByParticipantId: actorId,
    recordedAt: at
  });
  const event = createEvent({
    type: "LessonRecorded",
    threadId: lesson.threadId,
    actorId: lesson.recordedByParticipantId,
    at,
    payload: { outcomeLesson: lesson }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome_learning.lesson.v0",
    recorded: true,
    outcomeLesson: lesson,
    event
  });
}

function outcomeLearningDispute(options, cwd) {
  requireOption(options, "learning");
  requireOption(options, "reason");
  const { target } = outcomeLearningRecordForCli(options, cwd);
  const actorId = outcomeLearningActorId(
    options,
    cwd,
    target.threadId,
    target.derivedByParticipantId || target.recordedByParticipantId,
    "outcome_learning_disputer"
  );
  const at = nowIso();
  const dispute = buildOutcomeLearningDispute({
    id: options.id || options.dispute,
    learningId: target.id,
    outcomeId: target.outcomeId,
    executionId: target.executionId,
    threadId: target.threadId,
    reason: options.reason,
    disputedByParticipantId: actorId,
    disputedAt: at
  });
  const event = createEvent({
    type: "LearningDisputed",
    threadId: dispute.threadId,
    actorId: dispute.disputedByParticipantId,
    at,
    payload: { outcomeLearningDispute: dispute }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome_learning.dispute.v0",
    disputed: true,
    outcomeLearningDispute: dispute,
    event
  });
}

function outcomeLearningViolation(options, cwd) {
  requireOption(options, "learning");
  requireOption(options, "type");
  requireOption(options, "reason");
  const { target } = outcomeLearningRecordForCli(options, cwd);
  const actorId = outcomeLearningActorId(
    options,
    cwd,
    target.threadId,
    target.derivedByParticipantId || target.recordedByParticipantId,
    "outcome_learning_detector"
  );
  const at = nowIso();
  const violation = buildOutcomeLearningViolation({
    id: options.id || options.violation,
    learningId: target.id,
    outcomeId: target.outcomeId,
    executionId: target.executionId,
    threadId: target.threadId,
    violationType: options.type || options.violationType,
    reason: options.reason,
    detectedByParticipantId: actorId,
    detectedAt: at
  });
  const event = createEvent({
    type: "LearningViolationRecorded",
    threadId: violation.threadId,
    actorId: violation.detectedByParticipantId,
    at,
    payload: { outcomeLearningViolation: violation }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome_learning.violation.v0",
    violated: true,
    outcomeLearningViolation: violation,
    event
  });
}

function outcomeLearningList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let signals = projection.outcomeLearning.signals;
  if (options.thread) {
    signals = signals.filter((signal) => signal.threadId === options.thread);
  }
  return print({
    schema: "clista.outcome_learning.list.v0",
    theorem: projection.outcomeLearning.theorem,
    hardLaw: projection.outcomeLearning.hardLaw,
    threadId: options.thread || null,
    count: signals.length,
    signals
  });
}

function outcomeLearningShow(options, cwd) {
  const learningId = options.learning || options.learningId || options.id;
  if (!learningId) {
    throw new Error("Missing required option --learning");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(outcomeLearningForId(projection.outcomeLearning, learningId));
}

function outcomeLearningVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.outcome_learning.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.outcome_learning.verify.v0",
    valid: true,
    errors: [],
    outcomeLearningValidationStatus: projection.outcomeLearning.outcomeLearningValidationStatus
  });
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

function outcomeRecordForCli(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const outcomeId = options.outcome || options.outcomeId || options.id;
  const record = projection.outcome.byOutcome[outcomeId];
  if (!record) {
    throw new Error(`Unknown outcome ${outcomeId}`);
  }
  return { projection, record };
}

function outcomeLearningRecordForCli(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const learningId = options.learning || options.learningId || options.id;
  const target = projection.outcomeLearning.bySignal[learningId] || projection.outcomeLearning.byLesson[learningId];
  if (!target) {
    throw new Error(`Unknown outcome learning record ${learningId}`);
  }
  return { projection, target };
}

function outcomeLearningActorId(options, cwd, threadId, fallbackId, role) {
  if (options.actor || options.participant) {
    const actor = participantFrom(options.actor || options.participant, options.role || role);
    appendParticipant(actor, cwd, threadId);
    return actor.id;
  }
  return fallbackId;
}

module.exports = {
  outcomeAudit,
  outcomeDispute,
  outcomeEvaluate,
  outcomeExpect,
  outcomeLearningDerive,
  outcomeLearningDispute,
  outcomeLearningLesson,
  outcomeLearningList,
  outcomeLearningShow,
  outcomeLearningVerify,
  outcomeLearningViolation,
  outcomeList,
  outcomeObserve,
  outcomeShow,
  outcomeVerify
};
