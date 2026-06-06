const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const protocolSchema = require("../schemas/clista-protocol.schema.json");
const { buildDelegationGrant } = require("../src/delegation");
const {
  buildExecutionCompletion,
  buildExecutionStart
} = require("../src/execution");
const {
  buildOutcomeDispute,
  buildOutcomeEvaluation,
  buildOutcomeExpectation,
  buildOutcomeObservation,
  buildOutcomeViolation
} = require("../src/outcome");
const { readEvents } = require("../src/events");
const { exportProtocol, projectEvents } = require("../src/projector");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");

test("outcome expect, observe, evaluate, list, show, verify, state, and export preserve evidence-backed judgment", () => {
  const cwd = createOutcomeStore();
  const granted = grantViaCli(cwd);
  const started = runCli(cwd, ["execution", "start", "--delegation", granted.delegationGrant.id]);
  const expected = runCli(cwd, [
    "outcome",
    "expect",
    "--execution",
    started.executionRecord.id,
    "--expected-effect",
    "Remote packet accepted under strict verification"
  ]);

  runCli(cwd, [
    "execution",
    "complete",
    "--execution",
    started.executionRecord.id,
    "--evidence",
    "strict execution evidence"
  ]);
  const observed = runCli(cwd, [
    "outcome",
    "observe",
    "--outcome",
    expected.outcomeRecord.id,
    "--observed-effect",
    "Remote packet accepted under strict verification",
    "--evidence",
    "observed acceptance evidence"
  ]);
  const evaluated = runCli(cwd, [
    "outcome",
    "evaluate",
    "--outcome",
    expected.outcomeRecord.id,
    "--result",
    "success",
    "--comparison",
    "Observed effect satisfied expected effect",
    "--evidence",
    "evaluation evidence",
    "--confidence",
    "0.9"
  ]);
  const listed = runCli(cwd, ["outcome", "list", "--thread", "thd_outcome", "--status", "evaluated"]);
  const shown = runCli(cwd, ["outcome", "show", expected.outcomeRecord.id]);
  const verified = runCli(cwd, ["outcome", "verify"]);
  const state = runCli(cwd, ["state", "show", "--thread", "thd_outcome"]);
  const exported = runCli(cwd, ["export"]);

  assert.equal(expected.expected, true);
  assert.equal(expected.outcomeRecord.status, "pending");
  assert.equal(observed.observed, true);
  assert.equal(observed.outcomeRecord.evidence[0].value, "observed acceptance evidence");
  assert.equal(evaluated.evaluated, true);
  assert.equal(evaluated.outcomeRecord.evaluationResult, "success");
  assert.equal(listed.count, 1);
  assert.equal(listed.records[0].status, "evaluated");
  assert.equal(shown.record.id, expected.outcomeRecord.id);
  assert.equal(shown.evaluations[0].evaluationResult, "success");
  assert.equal(verified.valid, true);
  assert.equal(verified.outcomeValidationStatus.evaluatedCount, 1);
  assert.equal(state.reasoningState.outcome.evaluated[0].evaluationResult, "success");
  assert.equal(exported.outcome.evaluated[0].id, expected.outcomeRecord.id);
});

test("completed execution does not automatically create outcome success", () => {
  const cwd = createOutcomeStore();
  const granted = grantViaCli(cwd);
  const started = runCli(cwd, ["execution", "start", "--delegation", granted.delegationGrant.id]);
  runCli(cwd, [
    "execution",
    "complete",
    "--execution",
    started.executionRecord.id,
    "--evidence",
    "execution completed evidence"
  ]);
  const state = runCli(cwd, ["state", "show", "--thread", "thd_outcome"]);

  assert.equal(state.reasoningState.execution.completed.length, 1);
  assert.equal(state.reasoningState.outcome.records.length, 0);
  assert.equal(state.reasoningState.outcome.evaluated.length, 0);
});

test("outcome validation rejects missing execution references", () => {
  const validation = validateEvents([
    ...baseEvents(),
    event("evt_outcome_missing_execution", "OutcomeExpected", "par_reviewer", {
      outcomeRecord: outcomeExpected({ executionId: "exe_missing" })
    }, "2026-06-06T00:02:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /outcome expectation references unknown execution exe_missing/);
});

test("outcome validation rejects evaluation for incomplete execution", () => {
  const { events, grantRecord, start, expected, observed } = activeOutcomeFixture();
  const evaluated = outcomeEvaluated({ expected });
  const validation = validateEvents([
    ...events,
    event("evt_outcome_grant_incomplete", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_outcome_start_incomplete", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z"),
    event("evt_outcome_expect_incomplete", "OutcomeExpected", "par_reviewer", { outcomeRecord: expected }, "2026-06-06T00:02:00.000Z"),
    event("evt_outcome_observe_incomplete", "OutcomeObserved", "par_reviewer", { outcomeRecord: observed }, "2026-06-06T00:03:00.000Z"),
    event("evt_outcome_evaluate_incomplete", "OutcomeEvaluated", "par_reviewer", { outcomeRecord: evaluated }, "2026-06-06T00:04:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /outcome evaluation requires completed execution exe_outcome/);
});

test("outcome validation rejects observation without evidence", () => {
  const { events, grantRecord, start, expected } = activeOutcomeFixture();
  const observed = outcomeObserved({ expected, evidence: [] });
  const validation = validateEvents([
    ...events,
    event("evt_outcome_grant_no_evidence", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_outcome_start_no_evidence", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z"),
    event("evt_outcome_expect_no_evidence", "OutcomeExpected", "par_reviewer", { outcomeRecord: expected }, "2026-06-06T00:02:00.000Z"),
    event("evt_outcome_observe_no_evidence", "OutcomeObserved", "par_reviewer", { outcomeRecord: observed }, "2026-06-06T00:03:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /outcome observation requires evidence/);
});

test("outcome validation rejects evaluation without observed outcome", () => {
  const { events, grantRecord, start, expected } = activeOutcomeFixture();
  const completion = executionCompletion();
  const evaluated = outcomeEvaluated({ expected });
  const validation = validateEvents([
    ...events,
    event("evt_outcome_grant_no_observation", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_outcome_start_no_observation", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z"),
    event("evt_outcome_expect_no_observation", "OutcomeExpected", "par_reviewer", { outcomeRecord: expected }, "2026-06-06T00:02:00.000Z"),
    event("evt_outcome_complete_no_observation", "ExecutionCompleted", "par_reviewer", { executionRecord: completion }, "2026-06-06T00:03:00.000Z"),
    event("evt_outcome_evaluate_no_observation", "OutcomeEvaluated", "par_reviewer", { outcomeRecord: evaluated }, "2026-06-06T00:04:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /outcome evaluation requires observed outcome oco_outcome/);
});

test("outcome validation rejects success by assertion guard fields", () => {
  const { events, grantRecord, start, expected, observed } = activeOutcomeFixture();
  const completion = executionCompletion();
  const evaluated = {
    ...outcomeEvaluated({ expected }),
    successByAssertion: true
  };
  const validation = validateEvents([
    ...events,
    event("evt_outcome_grant_assertion", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_outcome_start_assertion", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z"),
    event("evt_outcome_expect_assertion", "OutcomeExpected", "par_reviewer", { outcomeRecord: expected }, "2026-06-06T00:02:00.000Z"),
    event("evt_outcome_complete_assertion", "ExecutionCompleted", "par_reviewer", { executionRecord: completion }, "2026-06-06T00:03:00.000Z"),
    event("evt_outcome_observe_assertion", "OutcomeObserved", "par_reviewer", { outcomeRecord: observed }, "2026-06-06T00:04:00.000Z"),
    event("evt_outcome_evaluate_assertion", "OutcomeEvaluated", "par_reviewer", { outcomeRecord: evaluated }, "2026-06-06T00:05:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /outcome field successByAssertion must be false/);
});

test("outcome validation rejects retroactive expected effect after completion", () => {
  const { events, grantRecord, start, expected } = activeOutcomeFixture();
  const completion = executionCompletion();
  const validation = validateEvents([
    ...events,
    event("evt_outcome_grant_retroactive", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_outcome_start_retroactive", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z"),
    event("evt_outcome_complete_retroactive", "ExecutionCompleted", "par_reviewer", { executionRecord: completion }, "2026-06-06T00:02:00.000Z"),
    event("evt_outcome_expect_retroactive", "OutcomeExpected", "par_reviewer", { outcomeRecord: expected }, "2026-06-06T00:03:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /expected outcome must be declared before execution completion/);
});

test("outcome dispute projects without mutating execution success", () => {
  const { allEvents, expected } = validOutcomeEvents();
  const dispute = buildOutcomeDispute({
    id: "ods_outcome",
    outcomeId: expected.id,
    executionId: expected.executionId,
    threadId: expected.threadId,
    reason: "Observed effect is contested",
    disputedByParticipantId: "par_troy",
    disputedAt: "2026-06-06T00:06:00.000Z"
  });
  const events = [
    ...allEvents,
    event("evt_outcome_dispute", "OutcomeDisputed", "par_troy", { outcomeDispute: dispute }, "2026-06-06T00:06:00.000Z")
  ];
  const validation = validateEvents(events);
  const projected = projectEvents(events).outcome;

  assert.equal(validation.valid, true, formatValidationErrors(validation.errors));
  assert.equal(projected.disputed[0].id, expected.id);
  assert.equal(projected.disputesByOutcome[expected.id][0].id, dispute.id);
});

test("outcome violation projects explicit boundary failure", () => {
  const { allEvents, expected } = validOutcomeEvents();
  const violation = buildOutcomeViolation({
    id: "ovl_outcome",
    outcomeId: expected.id,
    executionId: expected.executionId,
    threadId: expected.threadId,
    violationType: "completion_treated_as_success",
    reason: "Completion was represented as success before outcome evaluation",
    detectedByParticipantId: "par_troy",
    detectedAt: "2026-06-06T00:06:00.000Z"
  });
  const events = [
    ...allEvents,
    event("evt_outcome_violation", "OutcomeViolationRecorded", "par_troy", { outcomeViolation: violation }, "2026-06-06T00:06:00.000Z")
  ];
  const validation = validateEvents(events);
  const projected = projectEvents(events).outcome;

  assert.equal(validation.valid, true, formatValidationErrors(validation.errors));
  assert.equal(projected.violated[0].id, expected.id);
  assert.equal(projected.violationsByOutcome[expected.id][0].id, violation.id);
});

test("outcome validation rejects consensus, governance, and amendment guard fields", () => {
  const { events, grantRecord, start, expected } = activeOutcomeFixture();
  const guarded = {
    ...expected,
    consensusCreated: true,
    governanceApproval: true,
    amendmentApproval: true
  };
  const validation = validateEvents([
    ...events,
    event("evt_outcome_grant_guard", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_outcome_start_guard", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z"),
    event("evt_outcome_expect_guard", "OutcomeExpected", "par_reviewer", { outcomeRecord: guarded }, "2026-06-06T00:02:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /outcome field consensusCreated must be false/);
  assert.match(message, /outcome field governanceApproval must be false/);
  assert.match(message, /outcome field amendmentApproval must be false/);
});

test("export schema defines protocol outcome records and exported records satisfy it", () => {
  const { allEvents } = validOutcomeEvents();
  const exported = exportProtocol(projectEvents(allEvents));
  const projectionSchema = protocolSchema.$defs.outcomeProjection;

  assert.deepEqual(protocolSchema.$defs.outcomeEvaluationResult.enum, [
    "success",
    "partial_success",
    "failure",
    "inconclusive"
  ]);
  assert.ok(protocolSchema.$defs.event.properties.event_type.enum.includes("OutcomeExpected"));
  assert.equal(projectionSchema.properties.records.items.$ref, "#/$defs/outcomeRecord");
  assert.equal(projectionSchema.properties.disputes.items.$ref, "#/$defs/outcomeDispute");
  assertRecordMatchesDefinition(protocolSchema.$defs.outcomeRecord, exported.outcome.records[0]);
  assertRecordMatchesDefinition(protocolSchema.$defs.outcomeRecord, exported.outcome.evaluated[0]);
});

function createOutcomeStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-outcome-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_outcome",
    "--title",
    "Outcome Thread",
    "--question",
    "Can completed execution be evaluated against intended effect?",
    "--participant",
    "Troy:decision_owner",
    "--participant",
    "Reviewer:delegated_actor"
  ]);
  return cwd;
}

function grantViaCli(cwd) {
  return runCli(cwd, [
    "delegation",
    "grant",
    "--thread",
    "thd_outcome",
    "--delegator",
    "Troy",
    "--delegate",
    "Reviewer",
    "--action",
    "verify",
    "--scope",
    "thread:thd_outcome",
    "--limit",
    "Verify only the delegated execution scope"
  ]);
}

function baseEvents() {
  return readEvents(createOutcomeStore());
}

function activeOutcomeFixture() {
  const events = baseEvents();
  const grantRecord = grant();
  const start = executionStart();
  const expected = outcomeExpected();
  const observed = outcomeObserved({ expected });
  return { events, grantRecord, start, expected, observed };
}

function validOutcomeEvents() {
  const { events, grantRecord, start, expected, observed } = activeOutcomeFixture();
  const completion = executionCompletion();
  const evaluated = outcomeEvaluated({ expected });
  const allEvents = [
    ...events,
    event("evt_outcome_grant_valid", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_outcome_start_valid", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z"),
    event("evt_outcome_expect_valid", "OutcomeExpected", "par_reviewer", { outcomeRecord: expected }, "2026-06-06T00:02:00.000Z"),
    event("evt_outcome_complete_valid", "ExecutionCompleted", "par_reviewer", { executionRecord: completion }, "2026-06-06T00:03:00.000Z"),
    event("evt_outcome_observe_valid", "OutcomeObserved", "par_reviewer", { outcomeRecord: observed }, "2026-06-06T00:04:00.000Z"),
    event("evt_outcome_evaluate_valid", "OutcomeEvaluated", "par_reviewer", { outcomeRecord: evaluated }, "2026-06-06T00:05:00.000Z")
  ];
  return { allEvents, expected };
}

function grant(options = {}) {
  return buildDelegationGrant({
    id: options.id || "dlg_outcome",
    threadId: "thd_outcome",
    delegatorParticipantId: "par_troy",
    delegateId: "par_reviewer",
    delegateType: "participant",
    action: "verify",
    scope: "thread:thd_outcome",
    limits: ["Verify only the delegated execution scope"],
    grantedAt: "2026-06-06T00:00:00.000Z"
  });
}

function executionStart(options = {}) {
  return buildExecutionStart({
    id: options.id || "exe_outcome",
    threadId: "thd_outcome",
    actorId: "par_reviewer",
    delegationId: "dlg_outcome",
    actionType: "verify",
    scope: "thread:thd_outcome",
    constraints: ["Verify only the delegated execution scope"],
    startedAt: "2026-06-06T00:01:00.000Z"
  });
}

function executionCompletion(options = {}) {
  return buildExecutionCompletion({
    id: options.id || "exe_outcome",
    threadId: "thd_outcome",
    actorId: "par_reviewer",
    delegationId: "dlg_outcome",
    actionType: "verify",
    scope: "thread:thd_outcome",
    constraints: ["Verify only the delegated execution scope"],
    evidence: ["execution completed with evidence"],
    completedAt: "2026-06-06T00:03:00.000Z"
  });
}

function outcomeExpected(options = {}) {
  return buildOutcomeExpectation({
    id: options.id || "oco_outcome",
    executionId: options.executionId || "exe_outcome",
    threadId: "thd_outcome",
    actorId: "par_reviewer",
    expectedEffect: options.expectedEffect || "Remote packet accepted under strict verification",
    createdAt: "2026-06-06T00:02:00.000Z"
  });
}

function outcomeObserved({ expected, evidence } = {}) {
  const record = expected || outcomeExpected();
  return buildOutcomeObservation({
    id: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    actorId: record.actorId,
    expectedEffect: record.expectedEffect,
    observedEffect: "Remote packet accepted under strict verification",
    evidence: evidence === undefined ? ["observed effect evidence"] : evidence,
    observedAt: "2026-06-06T00:04:00.000Z"
  });
}

function outcomeEvaluated({ expected } = {}) {
  const record = expected || outcomeExpected();
  return buildOutcomeEvaluation({
    id: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    actorId: record.actorId,
    expectedEffect: record.expectedEffect,
    observedEffect: "Remote packet accepted under strict verification",
    evidence: ["evaluation evidence"],
    evaluationResult: "success",
    comparison: "Observed effect satisfied expected effect",
    confidence: 0.9,
    evaluatedByParticipantId: record.actorId,
    evaluatedAt: "2026-06-06T00:05:00.000Z"
  });
}

function event(eventId, eventType, actorId, payload, timestamp = "2026-06-06T00:00:00.000Z") {
  return {
    event_id: eventId,
    event_type: eventType,
    thread_id: "thd_outcome",
    actor_id: actorId,
    timestamp,
    payload
  };
}

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function assertRecordMatchesDefinition(definition, record) {
  assert.ok(record);
  for (const field of definition.required || []) {
    assert.ok(Object.hasOwn(record, field), `${record.object || "record"} missing ${field}`);
  }
  for (const [field, property] of Object.entries(definition.properties || {})) {
    if (!Object.hasOwn(record, field)) {
      continue;
    }
    if (Object.hasOwn(property, "const")) {
      assert.equal(record[field], property.const);
    }
    if (property.$ref === "#/$defs/outcomeStatus") {
      assert.ok(protocolSchema.$defs.outcomeStatus.enum.includes(record[field]));
    }
    if (property.minLength) {
      assert.ok(String(record[field]).length >= property.minLength);
    }
  }
}
