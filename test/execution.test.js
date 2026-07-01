const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const protocolSchema = require("../schemas/clista-protocol.schema.json");
const {
  buildDelegationExpiration,
  buildDelegationGrant,
  buildDelegationRevocation
} = require("../src/delegation");
const {
  buildExecutionCompletion,
  buildExecutionStart,
  buildExecutionViolation
} = require("../src/execution");
const { readEvents } = require("../src/events");
const { exportProtocol, projectEvents } = require("../src/projector");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");

test("execution start, complete, list, show, verify, state, and export preserve evidence-backed action", () => {
  const cwd = createExecutionStore();
  const granted = grantViaCli(cwd);
  const started = runCli(cwd, [
    "execution",
    "start",
    "--delegation",
    granted.delegationGrant.id,
    "--summary",
    "Reviewer started scoped verification"
  ]);
  const completed = runCli(cwd, [
    "execution",
    "complete",
    "--execution",
    started.executionRecord.id,
    "--evidence",
    "continuity packet verified with strict event replay",
    "--summary",
    "Reviewer completed scoped verification"
  ]);
  const listed = runCli(cwd, ["execution", "list", "--thread", "thd_execution"]);
  const shown = runCli(cwd, ["execution", "show", started.executionRecord.id]);
  const verified = runCli(cwd, ["execution", "verify"]);
  const state = runCli(cwd, ["state", "show", "--thread", "thd_execution"]);
  const exported = runCli(cwd, ["export"]);

  assert.equal(started.started, true);
  assert.equal(started.executionRecord.status, "active");
  assert.equal(started.executionRecord.actorId, granted.delegationGrant.delegateId);
  assert.equal(completed.completed, true);
  assert.equal(completed.executionRecord.status, "completed");
  assert.equal(completed.executionRecord.evidence[0].value, "continuity packet verified with strict event replay");
  assert.equal(listed.count, 1);
  assert.equal(listed.records[0].status, "completed");
  assert.equal(shown.record.id, started.executionRecord.id);
  assert.equal(shown.completions[0].id, started.executionRecord.id);
  assert.equal(verified.valid, true);
  assert.equal(verified.executionValidationStatus.recordCount, 1);
  assert.equal(verified.executionValidationStatus.completedCount, 1);
  assert.equal(state.reasoningState.execution.completed[0].id, started.executionRecord.id);
  assert.equal(exported.execution.completed[0].id, started.executionRecord.id);
});

test("execution failure and rollback project explicit lifecycle status", () => {
  const failureCwd = createExecutionStore();
  const failureGrant = grantViaCli(failureCwd, { delegate: "Reviewer", action: "verify" });
  const failedStart = runCli(failureCwd, ["execution", "start", "--delegation", failureGrant.delegationGrant.id]);
  const failed = runCli(failureCwd, [
    "execution",
    "fail",
    "--execution",
    failedStart.executionRecord.id,
    "--reason",
    "Evidence source unavailable"
  ]);
  const failureState = runCli(failureCwd, ["state", "show", "--thread", "thd_execution"]);

  assert.equal(failed.failed, true);
  assert.equal(failureState.reasoningState.execution.failed[0].failureReason, "Evidence source unavailable");

  const rollbackCwd = createExecutionStore();
  const rollbackGrant = grantViaCli(rollbackCwd, { delegate: "Worker", action: "repair" });
  const rollbackStart = runCli(rollbackCwd, ["execution", "start", "--delegation", rollbackGrant.delegationGrant.id]);
  runCli(rollbackCwd, [
    "execution",
    "complete",
    "--execution",
    rollbackStart.executionRecord.id,
    "--evidence",
    "repair applied"
  ]);
  const rolledBack = runCli(rollbackCwd, [
    "execution",
    "rollback",
    "--execution",
    rollbackStart.executionRecord.id,
    "--reason",
    "Repair created regression",
    "--evidence",
    "regression reverted"
  ]);
  const rollbackState = runCli(rollbackCwd, ["state", "show", "--thread", "thd_execution"]);

  assert.equal(rolledBack.rolledBack, true);
  assert.equal(rollbackState.reasoningState.execution.rolled_back[0].rollbackReason, "Repair created regression");
});

test("execution validation rejects completion without evidence", () => {
  const { events, grantRecord } = executionFixture();
  const start = executionStart({ id: "exe_no_evidence", delegationId: grantRecord.id });
  const completion = buildExecutionCompletion({
    ...executionOptions({ id: start.id, delegationId: grantRecord.id }),
    completedAt: "2026-06-06T00:02:00.000Z",
    evidence: []
  });
  const validation = validateEvents([
    ...events,
    event("evt_execution_grant_no_evidence", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_execution_start_no_evidence", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z"),
    event("evt_execution_complete_no_evidence", "ExecutionCompleted", "par_reviewer", { executionRecord: completion }, "2026-06-06T00:02:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /execution completion requires evidence/);
});

test("execution validation rejects delegated execution outside granted scope", () => {
  const { events, grantRecord } = executionFixture();
  const start = executionStart({
    id: "exe_outside_scope",
    delegationId: grantRecord.id,
    actionType: "approve",
    scope: "thread:other"
  });
  const validation = validateEvents([
    ...events,
    event("evt_execution_grant_scope", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_execution_start_scope", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /delegated execution must match granted action/);
  assert.match(message, /delegated execution must stay within granted scope/);
});

test("execution validation rejects execution by wrong actor", () => {
  const { events, grantRecord } = executionFixture();
  const start = executionStart({
    id: "exe_wrong_actor",
    delegationId: grantRecord.id,
    actorId: "par_worker"
  });
  const validation = validateEvents([
    ...events,
    event("evt_execution_grant_wrong_actor", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_execution_start_wrong_actor", "ExecutionStarted", "par_worker", { executionRecord: start }, "2026-06-06T00:01:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /delegated execution actorId must match accountable delegate/);
});

test("execution validation rejects execution after revoked delegation", () => {
  const { events, grantRecord } = executionFixture();
  const revocation = buildDelegationRevocation({
    id: "dlr_execution_revoked",
    delegationId: grantRecord.id,
    threadId: "thd_execution",
    revokedByParticipantId: "par_troy",
    reason: "Stop execution",
    revokedAt: "2026-06-06T00:01:00.000Z"
  });
  const start = executionStart({ id: "exe_after_revocation", delegationId: grantRecord.id });
  const validation = validateEvents([
    ...events,
    event("evt_execution_grant_revoked", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_execution_revoke", "DelegationRevoked", "par_troy", { delegationRevocation: revocation }, "2026-06-06T00:01:00.000Z"),
    event("evt_execution_start_after_revoke", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:02:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /execution references revoked delegation dlg_execution/);
});

test("execution validation rejects execution after expired delegation", () => {
  const { events } = executionFixture();
  const expiredGrant = grant({
    id: "dlg_execution_expired",
    expiresAt: "2026-06-06T00:01:00.000Z"
  });
  const expiration = buildDelegationExpiration({
    id: "dle_execution_expired",
    delegationId: expiredGrant.id,
    threadId: "thd_execution",
    expiredAt: "2026-06-06T00:01:00.000Z",
    reason: "Expiration reached"
  });
  const start = executionStart({ id: "exe_after_expiration", delegationId: expiredGrant.id });
  const validation = validateEvents([
    ...events,
    event("evt_execution_grant_expired", "DelegationGranted", "par_troy", { delegationGrant: expiredGrant }),
    event("evt_execution_expired", "DelegationExpired", "par_troy", { delegationExpiration: expiration }, "2026-06-06T00:01:00.000Z"),
    event("evt_execution_start_after_expire", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:02:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /execution references expired delegation dlg_execution_expired/);
});

test("execution violation projects onto execution state", () => {
  const { events, grantRecord } = executionFixture();
  const start = executionStart({ id: "exe_violated", delegationId: grantRecord.id });
  const violation = buildExecutionViolation({
    id: "exv_execution_scope",
    executionId: start.id,
    threadId: "thd_execution",
    violationType: "constraint_failed",
    reason: "Execution evidence failed required constraint",
    detectedByParticipantId: "par_troy",
    detectedAt: "2026-06-06T00:03:00.000Z"
  });
  const allEvents = [
    ...events,
    event("evt_execution_grant_violation", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_execution_start_violation", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z"),
    event("evt_execution_violation", "ExecutionViolationRecorded", "par_troy", { executionViolation: violation }, "2026-06-06T00:03:00.000Z")
  ];
  const validation = validateEvents(allEvents);
  const projected = projectEvents(allEvents).execution;

  assert.equal(validation.valid, true, formatValidationErrors(validation.errors));
  assert.equal(projected.violated[0].id, start.id);
  assert.equal(projected.violationsByExecution[start.id][0].id, violation.id);
});

test("execution validation rejects authority creation guard fields", () => {
  const { events, grantRecord } = executionFixture();
  const start = {
    ...executionStart({ id: "exe_authority_created", delegationId: grantRecord.id }),
    authorityCreated: true
  };
  const validation = validateEvents([
    ...events,
    event("evt_execution_grant_authority", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_execution_start_authority", "ExecutionStarted", "par_reviewer", { executionRecord: start }, "2026-06-06T00:01:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /execution field authorityCreated must be false/);
});

test("execution start from a decision merged without --conditions defaults constraints to decision_authorization", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-execution-no-conditions-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_no_conditions",
    "--title",
    "No-conditions merge thread",
    "--question",
    "Does execution start default constraints when the decision has none?",
    "--participant",
    "Troy:decision owner"
  ]);
  runCli(cwd, [
    "evidence",
    "commit",
    "--id",
    "evd_no_conditions",
    "--thread",
    "thd_no_conditions",
    "--source",
    "Test",
    "--finding",
    "Evidence exists."
  ]);
  runCli(cwd, [
    "assumption",
    "declare",
    "--id",
    "asm_no_conditions",
    "--thread",
    "thd_no_conditions",
    "--text",
    "Assumption exists.",
    "--evidence",
    "evd_no_conditions"
  ]);
  runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_no_conditions",
    "--thread",
    "thd_no_conditions",
    "--text",
    "Claim is supported.",
    "--evidence",
    "evd_no_conditions",
    "--assumptions",
    "asm_no_conditions"
  ]);
  runCli(cwd, [
    "decision",
    "open",
    "--id",
    "drq_no_conditions",
    "--thread",
    "thd_no_conditions",
    "--proposal",
    "Ship without explicit conditions.",
    "--evidence",
    "evd_no_conditions",
    "--claims",
    "clm_no_conditions",
    "--assumptions",
    "asm_no_conditions"
  ]);
  runCli(cwd, [
    "review",
    "submit",
    "--id",
    "rev_no_conditions",
    "--thread",
    "thd_no_conditions",
    "--request",
    "drq_no_conditions",
    "--reviewer",
    "Troy",
    "--status",
    "approve"
  ]);
  const merge = runCli(cwd, [
    "decision",
    "merge",
    "--id",
    "dcr_no_conditions",
    "--thread",
    "thd_no_conditions",
    "--request",
    "drq_no_conditions",
    "--decider",
    "Troy"
  ]);
  assert.deepEqual(merge.decisionRecord.conditions, []);

  const started = runCli(cwd, ["execution", "start", "--decision", merge.decisionRecord.id]);
  const validated = runCli(cwd, ["validate"]);

  assert.equal(started.started, true);
  assert.deepEqual(started.executionRecord.constraints, ["decision_authorization"]);
  assert.equal(validated.valid, true);
});

test("export schema defines execution records and exported execution records satisfy it", () => {
  const cwd = createExecutionStore();
  const granted = grantViaCli(cwd);
  const started = runCli(cwd, ["execution", "start", "--delegation", granted.delegationGrant.id]);
  runCli(cwd, [
    "execution",
    "complete",
    "--execution",
    started.executionRecord.id,
    "--evidence",
    "verified evidence"
  ]);
  const exported = exportProtocol(projectEvents(readEvents(cwd)));
  const projectionSchema = protocolSchema.$defs.executionProjection;

  assert.deepEqual(protocolSchema.$defs.executionStatus.enum, [
    "active",
    "completed",
    "failed",
    "rolled_back",
    "violated"
  ]);
  assert.equal(projectionSchema.properties.records.items.$ref, "#/$defs/executionRecord");
  assert.equal(projectionSchema.properties.violations.items.$ref, "#/$defs/executionViolation");
  assertRecordMatchesDefinition(protocolSchema.$defs.executionRecord, exported.execution.records[0]);
  assertRecordMatchesDefinition(protocolSchema.$defs.executionRecord, exported.execution.completed[0]);
});

function createExecutionStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-execution-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_execution",
    "--title",
    "Execution Thread",
    "--question",
    "Can execution be proven as performed action?",
    "--participant",
    "Troy:decision_owner",
    "--participant",
    "Reviewer:delegated_actor",
    "--participant",
    "Worker:delegated_actor"
  ]);
  return cwd;
}

function grantViaCli(cwd, options = {}) {
  return runCli(cwd, [
    "delegation",
    "grant",
    "--thread",
    "thd_execution",
    "--delegator",
    "Troy",
    "--delegate",
    options.delegate || "Reviewer",
    "--action",
    options.action || "verify",
    "--scope",
    "thread:thd_execution",
    "--limit",
    options.limit || "Verify only the delegated execution scope"
  ]);
}

function executionFixture() {
  const cwd = createExecutionStore();
  return {
    events: readEvents(cwd),
    grantRecord: grant()
  };
}

function grant(options = {}) {
  return buildDelegationGrant({
    id: options.id || "dlg_execution",
    threadId: "thd_execution",
    delegatorParticipantId: options.delegatorParticipantId || "par_troy",
    delegateId: options.delegateId || "par_reviewer",
    delegateType: options.delegateType || "participant",
    action: options.action || "verify",
    scope: options.scope || "thread:thd_execution",
    limits: [options.limit || "Verify only the delegated execution scope"],
    grantedAt: "2026-06-06T00:00:00.000Z",
    expiresAt: options.expiresAt
  });
}

function executionStart(options = {}) {
  return buildExecutionStart(executionOptions({
    ...options,
    startedAt: options.startedAt || "2026-06-06T00:01:00.000Z"
  }));
}

function executionOptions(options = {}) {
  return {
    id: options.id || "exe_execution",
    threadId: "thd_execution",
    actorId: options.actorId || "par_reviewer",
    delegationId: options.delegationId || "dlg_execution",
    actionType: options.actionType || "verify",
    scope: options.scope || "thread:thd_execution",
    constraints: options.constraints || ["Verify only the delegated execution scope"],
    evidence: options.evidence,
    summary: options.summary,
    startedAt: options.startedAt,
    completedAt: options.completedAt,
    failedAt: options.failedAt,
    rolledBackAt: options.rolledBackAt,
    reason: options.reason
  };
}

function event(eventId, eventType, actorId, payload, timestamp = "2026-06-06T00:00:00.000Z") {
  return {
    event_id: eventId,
    event_type: eventType,
    thread_id: "thd_execution",
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
    if (property.$ref === "#/$defs/executionStatus") {
      assert.ok(protocolSchema.$defs.executionStatus.enum.includes(record[field]));
    }
    if (property.minLength) {
      assert.ok(String(record[field]).length >= property.minLength);
    }
  }
}
