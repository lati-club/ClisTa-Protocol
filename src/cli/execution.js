const {
  appendEvent,
  createEvent,
  nowIso,
  parseList,
  participantIdFor
} = require("../events");
const {
  buildExecutionCompletion,
  buildExecutionFailure,
  buildExecutionRollback,
  buildExecutionStart,
  executionForId
} = require("../execution");
const { projectEvents } = require("../projector");
const { validateEvents } = require("../validator");
const {
  fail,
  print,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function executionStart(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const at = nowIso();
  const record = options.delegation
    ? executionStartFromDelegation(options, projection, at)
    : executionStartFromDecision(options, projection, at);
  const event = createEvent({
    type: "ExecutionStarted",
    threadId: record.threadId,
    actorId: record.actorId,
    at,
    payload: { executionRecord: record }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.execution.start.v0",
    started: true,
    executionRecord: record,
    event
  });
}

function executionStartFromDelegation(options, projection, at) {
  const grant = projection.delegation.byGrant[options.delegation];
  if (!grant) {
    throw new Error(`Unknown delegation ${options.delegation}`);
  }
  const actorId = options.actor ? participantIdFor(options.actor) : grant.delegateId;
  const constraints = parseList(options.constraint || options.constraints);
  return buildExecutionStart({
    id: options.id || options.execution,
    threadId: grant.threadId,
    actorId,
    delegationId: grant.id,
    actionType: options.action || grant.action,
    scope: options.scope || grant.scope,
    constraints: constraints.length ? constraints : grant.limits,
    summary: options.summary,
    startedAt: at
  });
}

function executionStartFromDecision(options, projection, at) {
  const decisionId = options.decision || options.decisionId;
  if (!decisionId) {
    throw new Error("Missing required option --delegation or --decision");
  }
  const decision = projection.decisionRecords[decisionId];
  if (!decision) {
    throw new Error(`Unknown decision ${decisionId}`);
  }
  const actorId = options.actor ? participantIdFor(options.actor) : decision.decidedByParticipantId;
  const constraints = parseList(options.constraint || options.constraints);
  return buildExecutionStart({
    id: options.id || options.execution,
    threadId: decision.threadId,
    actorId,
    decisionId: decision.id,
    actionType: options.action || decision.nextAction || decision.summary,
    scope: options.scope || `thread:${decision.threadId}`,
    constraints: constraints.length ? constraints : (decision.conditions.length ? decision.conditions : ["decision_authorization"]),
    summary: options.summary,
    startedAt: at
  });
}

function executionComplete(options, cwd) {
  requireOption(options, "execution");
  requireOption(options, "evidence");
  const { record } = executionRecordForCli(options, cwd);
  const at = nowIso();
  const completion = buildExecutionCompletion({
    id: record.id,
    threadId: record.threadId,
    actorId: record.actorId,
    delegationId: record.delegationId,
    decisionId: record.decisionId,
    actionType: record.actionType,
    scope: record.scope,
    constraints: record.constraints,
    evidence: parseList(options.evidence || options.evidences),
    summary: options.summary,
    completedAt: at
  });
  const event = createEvent({
    type: "ExecutionCompleted",
    threadId: completion.threadId,
    actorId: completion.actorId,
    at,
    payload: { executionRecord: completion }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.execution.complete.v0",
    completed: true,
    executionRecord: completion,
    event
  });
}

function executionFail(options, cwd) {
  requireOption(options, "execution");
  requireOption(options, "reason");
  const { record } = executionRecordForCli(options, cwd);
  const at = nowIso();
  const failure = buildExecutionFailure({
    id: record.id,
    threadId: record.threadId,
    actorId: record.actorId,
    delegationId: record.delegationId,
    decisionId: record.decisionId,
    actionType: record.actionType,
    scope: record.scope,
    constraints: record.constraints,
    reason: options.reason,
    summary: options.summary,
    failedAt: at
  });
  const event = createEvent({
    type: "ExecutionFailed",
    threadId: failure.threadId,
    actorId: failure.actorId,
    at,
    payload: { executionRecord: failure }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.execution.fail.v0",
    failed: true,
    executionRecord: failure,
    event
  });
}

function executionRollback(options, cwd) {
  requireOption(options, "execution");
  requireOption(options, "reason");
  requireOption(options, "evidence");
  const { record } = executionRecordForCli(options, cwd);
  const at = nowIso();
  const rollback = buildExecutionRollback({
    id: record.id,
    threadId: record.threadId,
    actorId: record.actorId,
    delegationId: record.delegationId,
    decisionId: record.decisionId,
    actionType: record.actionType,
    scope: record.scope,
    constraints: record.constraints,
    reason: options.reason,
    evidence: parseList(options.evidence || options.evidences),
    summary: options.summary,
    rolledBackAt: at
  });
  const event = createEvent({
    type: "ExecutionRolledBack",
    threadId: rollback.threadId,
    actorId: rollback.actorId,
    at,
    payload: { executionRecord: rollback }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.execution.rollback.v0",
    rolledBack: true,
    executionRecord: rollback,
    event
  });
}

function executionList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let records = projection.execution.records;
  if (options.thread) {
    records = records.filter((record) => record.threadId === options.thread);
  }
  if (options.status) {
    records = records.filter((record) => record.status === options.status);
  }
  return print({
    schema: "clista.execution.list.v0",
    theorem: projection.execution.theorem,
    hardLaw: projection.execution.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: records.length,
    records
  });
}

function executionShow(options, cwd) {
  const executionId = options.execution || options.executionId || options.id;
  if (!executionId) {
    throw new Error("Missing required option --execution");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(executionForId(projection.execution, executionId));
}

function executionVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.execution.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.execution.verify.v0",
    valid: true,
    errors: [],
    executionValidationStatus: projection.execution.executionValidationStatus
  });
}

function executionRecordForCli(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const record = projection.execution.byExecution[options.execution];
  if (!record) {
    throw new Error(`Unknown execution ${options.execution}`);
  }
  return { projection, record };
}

module.exports = {
  executionComplete,
  executionFail,
  executionList,
  executionRollback,
  executionShow,
  executionStart,
  executionVerify
};
