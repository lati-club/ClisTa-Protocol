const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { ValidationError, assertValidEvents, formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const canonicalLog = path.join(root, ".clista", "events.ndjson");
const fixtureLog = path.join(root, "examples", "first-test-thread", "events.ndjson");
const cliPath = path.join(root, "src", "cli.js");

test("validates the canonical ClisTa event logs", () => {
  assert.deepEqual(validateEvents(readEventsAt(canonicalLog)), { valid: true, errors: [] });
  assert.deepEqual(validateEvents(readEventsAt(fixtureLog)), { valid: true, errors: [] });
});

test("assertValidEvents throws a readable validation error", () => {
  const events = cloneCanonicalEvents();
  eventOf(events, "ClaimCreated").payload.claim.evidenceIds = ["evd_missing"];

  assert.throws(() => assertValidEvents(events), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /evidence reference does not exist: evd_missing/);
    assert.match(error.errors[0].event_id, /^evt_/);
    return true;
  });
});

test("rejects events missing required envelope fields", () => {
  for (const field of ["event_id", "event_type", "thread_id", "actor_id", "timestamp", "payload"]) {
    const events = cloneCanonicalEvents();
    delete events[4][field];

    assertInvalid(events, new RegExp(`missing ${field}`));
  }
});

test("rejects claim references to unknown evidence", () => {
  const events = cloneCanonicalEvents();
  eventOf(events, "ClaimCreated").payload.claim.evidenceIds = ["evd_missing"];

  assertInvalid(events, /evidence reference does not exist: evd_missing/);
});

test("rejects position references to unknown participants", () => {
  const events = cloneCanonicalEvents();
  eventOf(events, "PositionTaken").payload.position.participantId = "par_missing";

  assertInvalid(events, /position references unknown participant par_missing/);
});

test("rejects objection references to unknown claims, positions, and decision requests", () => {
  for (const [targetObjectType, targetObjectId, expected] of [
    ["claim", "clm_missing", /claim target does not exist: clm_missing/],
    ["position", "pos_missing", /position target does not exist: pos_missing/],
    ["decisionRequest", "drq_missing", /decisionRequest target does not exist: drq_missing/]
  ]) {
    const events = cloneCanonicalEvents();
    const objection = eventOf(events, "ObjectionRaised").payload.objection;
    objection.targetObjectType = targetObjectType;
    objection.targetObjectId = targetObjectId;

    assertInvalid(events, expected);
  }
});

test("rejects minority reports that reference unknown decisions", () => {
  const events = cloneCanonicalEvents();
  eventOf(events, "MinorityReportFiled").payload.minorityReport.decisionRecordId = "dcr_missing";

  assertInvalid(events, /minority report references unknown decision dcr_missing/);
});

test("rejects reviews that reference unknown decision requests", () => {
  const events = cloneCanonicalEvents();
  eventOf(events, "ReviewSubmitted").payload.review.decisionRequestId = "drq_missing";

  assertInvalid(events, /review references unknown decision request drq_missing/);
});

test("rejects decision merge before a decision request is opened", () => {
  const events = cloneCanonicalEvents();
  moveEventBefore(events, "DecisionMerged", "DecisionRequestOpened");

  assertInvalid(events, /decision merge before decision request opened: drq_protocol_first_architecture/);
});

test("rejects reviews submitted after a decision already merged", () => {
  const events = cloneCanonicalEvents();
  const review = clone(eventOf(events, "ReviewSubmitted"));
  review.event_id = "evt_invalid_review_after_merge";
  review.timestamp = "2026-06-06T00:00:00.000Z";
  review.payload.review.id = "rev_invalid_after_merge";
  events.push(review);

  assertInvalid(events, /review submitted after decision already merged for drq_protocol_first_architecture/);
});

test("rejects objection resolution before the objection exists", () => {
  const events = cloneCanonicalEvents();
  events.push(makeEvent({
    event_id: "evt_invalid_objection_resolved_missing",
    event_type: "ObjectionResolved",
    actor_id: "par_troy",
    payload: {
      objectionId: "obj_missing",
      resolution: "Resolved by assertion."
    }
  }));

  assertInvalid(events, /objection resolved before objection exists: obj_missing/);
});

test("rejects duplicate final decisions for the same request", () => {
  const events = cloneCanonicalEvents();
  const duplicate = clone(eventOf(events, "DecisionMerged"));
  duplicate.event_id = "evt_invalid_duplicate_decision";
  duplicate.timestamp = "2026-06-06T00:01:00.000Z";
  duplicate.payload.decisionRecord.id = "dcr_duplicate_protocol_first_architecture";
  events.push(duplicate);

  assertInvalid(events, /duplicate final decision for request drq_protocol_first_architecture/);
});

test("rejects decisions merged without evidence", () => {
  const events = cloneCanonicalEvents();
  eventOf(events, "DecisionRequestOpened").payload.decisionRequest.supportingEvidenceIds = [];
  eventOf(events, "DecisionMerged").payload.decisionRecord.supportingEvidenceIds = [];

  assertInvalid(events, /decision merged without evidence/);
});

test("rejects decisions merged without review", () => {
  const events = cloneCanonicalEvents().filter((event) => event.event_type !== "ReviewSubmitted");

  assertInvalid(events, /decision merged without review/);
});

test("rejects decisions merged with unresolved request changes", () => {
  const events = cloneCanonicalEvents();
  insertEventBefore(events, makeReviewEvent({
    id: "rev_protocol_changes_requested",
    reviewerParticipantId: "par_chatgpt",
    status: "request_changes",
    reviewedAt: "2026-06-05T23:52:16.370Z"
  }), "DecisionMerged");

  assertInvalid(events, /review rev_protocol_changes_requested has unresolved request_changes/);
});

test("allows request changes resolved by a later approving review from the same reviewer", () => {
  const events = cloneCanonicalEvents();
  insertEventBefore(events, makeReviewEvent({
    id: "rev_protocol_changes_requested",
    reviewerParticipantId: "par_chatgpt",
    status: "request_changes",
    reviewedAt: "2026-06-05T23:52:16.370Z"
  }), "DecisionMerged");
  insertEventBefore(events, makeReviewEvent({
    id: "rev_protocol_changes_resolved",
    reviewerParticipantId: "par_chatgpt",
    status: "approve",
    reviewedAt: "2026-06-05T23:52:16.380Z"
  }), "DecisionMerged");

  assert.deepEqual(validateEvents(events), { valid: true, errors: [] });
});

test("rejects decisions merged with unresolved blocking objections omitted", () => {
  const events = cloneCanonicalEvents();
  eventOf(events, "DecisionMerged").payload.decisionRecord.preservedObjectionIds = [];

  assertInvalid(events, /decision record omits unresolved objection obj_object_model_too_broad/);
});

test("rejects decisions merged without supporting claims", () => {
  const events = cloneCanonicalEvents();
  eventOf(events, "DecisionRequestOpened").payload.decisionRequest.supportingClaimIds = [];
  eventOf(events, "DecisionMerged").payload.decisionRecord.supportingClaimIds = [];

  assertInvalid(events, /decision merged without supporting claims/);
});

test("rejects decisions merged without supporting assumptions", () => {
  const events = cloneCanonicalEvents();
  eventOf(events, "DecisionRequestOpened").payload.decisionRequest.supportingAssumptionIds = [];
  eventOf(events, "DecisionMerged").payload.decisionRecord.supportingAssumptionIds = [];

  assertInvalid(events, /decision merged without supporting assumptions/);
});

test("rejects decisions merged without an authorized decision owner", () => {
  const events = cloneCanonicalEvents();
  const merge = eventOf(events, "DecisionMerged");
  merge.actor_id = "par_codex";
  merge.payload.decisionRecord.decidedByParticipantId = "par_codex";

  assertInvalid(events, /decision merged without authorized decision owner par_codex/);
});

test("rejects resolved objections without resolution text", () => {
  const events = cloneCanonicalEvents();
  eventWithObject(events, "ObjectionRaised", "obj_future_models").payload.objection.resolution = "";

  assertInvalid(events, /objection obj_future_models marked resolved without resolution text/);
});

test("rejects objections resolved by unauthorized actors", () => {
  const events = cloneCanonicalEvents();
  events.push(makeEvent({
    event_id: "evt_invalid_objection_unauthorized_resolution",
    event_type: "ObjectionResolved",
    actor_id: "par_chatgpt",
    payload: {
      objectionId: "obj_object_model_too_broad",
      resolution: "Resolved over the objector."
    }
  }));

  assertInvalid(events, /objection obj_object_model_too_broad resolved by unauthorized actor par_chatgpt/);
});

test("rejects preserved objections without minority reports", () => {
  const events = cloneCanonicalEvents().filter((event) => event.event_type !== "MinorityReportFiled");

  assertInvalid(events, /decision record preserves obj_object_model_too_broad without minority report/);
});

test("rejects expected outcomes that reference unknown decisions", () => {
  const events = cloneCanonicalEvents();
  events.push(makeExpectedOutcomeEvent({ decisionRecordId: "dcr_missing" }));

  assertInvalid(events, /expected outcome references unknown decision dcr_missing/);
});

test("rejects expected outcomes with invalid review dates", () => {
  for (const reviewDate of ["eventually", "2027-02-31"]) {
    const events = cloneCanonicalEvents();
    events.push(makeExpectedOutcomeEvent({ reviewDate }));

    assertInvalid(events, new RegExp(`expected outcome reviewDate is not a valid date: ${reviewDate}`));
  }
});

test("rejects outcome audits that reference unknown expected outcomes", () => {
  const events = cloneCanonicalEvents();
  events.push(makeOutcomeAuditEvent({ expectedOutcomeId: "exo_missing" }));

  assertInvalid(events, /outcome audit references unknown expected outcome exo_missing/);
});

test("rejects outcome audits with unknown failed assumptions and evidence", () => {
  const events = cloneCanonicalEvents();
  events.push(makeExpectedOutcomeEvent({}));
  events.push(makeOutcomeAuditEvent({
    failedAssumptionIds: ["asm_missing"],
    failedEvidenceIds: ["evd_missing"]
  }));

  assertInvalid(events, /assumption reference does not exist: asm_missing/);
  assertInvalid(events, /evidence reference does not exist: evd_missing/);
});

test("rejects decision scores before outcome audits exist", () => {
  const events = cloneCanonicalEvents();
  events.push(makeDecisionScoreEvent({ basedOnOutcomeAuditIds: [] }));

  assertInvalid(events, /decision score cannot exist before outcome audits/);
});

test("rejects decision scores that reference unknown outcome audits", () => {
  const events = cloneCanonicalEvents();
  events.push(makeDecisionScoreEvent({ basedOnOutcomeAuditIds: ["out_missing"] }));

  assertInvalid(events, /outcome audit reference does not exist: out_missing/);
});

test("rejects duplicate event ids", () => {
  const events = cloneCanonicalEvents();
  events[1].event_id = events[0].event_id;

  assertInvalid(events, /duplicate event_id/);
});

test("rejects invalid previous_hash chains when hashes exist", () => {
  const events = cloneCanonicalEvents();
  events[1].previous_hash = `sha256:${"0".repeat(64)}`;

  assertInvalid(events, /invalid previous_hash chain/);
});

test("rejects malformed timestamps", () => {
  const events = cloneCanonicalEvents();
  events[0].timestamp = "tomorrow-ish";

  assertInvalid(events, /malformed timestamp tomorrow-ish/);
});

test("rejects out-of-order sequence numbers when sequence numbers exist", () => {
  const events = cloneCanonicalEvents();
  events[0].sequence_number = 2;
  events[1].sequence_number = 1;

  assertInvalid(events, /events applied out of order by sequence number/);
});

test("CLI validate reports valid logs and exits zero", () => {
  const result = spawnSync("node", [cliPath, "validate", "--events", fixtureLog], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { valid: true, errors: [] });
  assert.equal(result.stderr, "");
});

test("CLI validate reports invalid logs and exits nonzero", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "clista-invalid-"));
  const invalidLog = path.join(dir, "events.ndjson");
  const events = cloneCanonicalEvents();
  eventOf(events, "ClaimCreated").payload.claim.evidenceIds = ["evd_missing"];
  writeFileSync(invalidLog, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

  const result = spawnSync("node", [cliPath, "validate", "--events", invalidLog], {
    cwd: root,
    encoding: "utf8"
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(output.valid, false);
  assert.match(formatValidationErrors(output.errors), /evd_missing/);
  assert.equal(result.stderr, "");
});

function cloneCanonicalEvents() {
  return clone(readEventsAt(canonicalLog));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function eventOf(events, eventType) {
  const event = events.find((candidate) => candidate.event_type === eventType);
  assert.ok(event, `expected ${eventType} event`);
  return event;
}

function eventWithObject(events, eventType, objectId) {
  const event = events.find((candidate) => {
    if (candidate.event_type !== eventType) {
      return false;
    }
    return Object.values(candidate.payload || {}).some((object) => object?.id === objectId);
  });
  assert.ok(event, `expected ${eventType} event for ${objectId}`);
  return event;
}

function moveEventBefore(events, movingType, targetType) {
  const movingIndex = events.findIndex((event) => event.event_type === movingType);
  assert.notEqual(movingIndex, -1, `expected ${movingType} event`);
  const [moving] = events.splice(movingIndex, 1);
  const targetIndex = events.findIndex((event) => event.event_type === targetType);
  assert.notEqual(targetIndex, -1, `expected ${targetType} event`);
  events.splice(targetIndex, 0, moving);
}

function insertEventBefore(events, event, targetType) {
  const targetIndex = events.findIndex((candidate) => candidate.event_type === targetType);
  assert.notEqual(targetIndex, -1, `expected ${targetType} event`);
  events.splice(targetIndex, 0, event);
}

function makeReviewEvent({ id, reviewerParticipantId, status, reviewedAt }) {
  return makeEvent({
    event_id: `evt_${id}`,
    event_type: "ReviewSubmitted",
    actor_id: reviewerParticipantId,
    payload: {
      review: {
        id,
        object: "review",
        threadId: "thd_thread_0001",
        decisionRequestId: "drq_protocol_first_architecture",
        reviewerParticipantId,
        status,
        reviewedAt
      }
    }
  });
}

function makeExpectedOutcomeEvent({
  decisionRecordId = "dcr_protocol_first_architecture",
  reviewDate = "2027-03-01"
}) {
  return makeEvent({
    event_id: "evt_expected_outcome_declared_test",
    event_type: "ExpectedOutcomeDeclared",
    actor_id: "par_troy",
    payload: {
      expectedOutcome: {
        id: "exo_protocol_success",
        expectedOutcomeId: "exo_protocol_success",
        object: "expectedOutcome",
        threadId: "thd_thread_0001",
        decisionRecordId,
        metric: "protocol_success",
        operator: ">",
        target: 0.8,
        reviewDate,
        assumptionIds: ["asm_projected_state_is_minimum_memory"],
        evidenceIds: ["evd_structured_state_survives"],
        description: "Protocol success should be empirically visible."
      }
    }
  });
}

function makeOutcomeAuditEvent({
  expectedOutcomeId = "exo_protocol_success",
  failedAssumptionIds = [],
  failedEvidenceIds = []
}) {
  return makeEvent({
    event_id: "evt_outcome_audited_test",
    event_type: "OutcomeAudited",
    actor_id: "par_troy",
    payload: {
      outcomeAudit: {
        id: "out_protocol_success",
        outcomeAuditId: "out_protocol_success",
        object: "outcomeAudit",
        threadId: "thd_thread_0001",
        decisionRecordId: "dcr_protocol_first_architecture",
        expectedOutcomeId,
        actual: 0.6,
        result: "failed",
        summary: "Outcome missed target.",
        failedAssumptionIds,
        failedEvidenceIds,
        auditedBy: "par_troy",
        auditedAt: "2027-03-02T00:00:00.000Z"
      }
    }
  });
}

function makeDecisionScoreEvent({
  basedOnOutcomeAuditIds = ["out_protocol_success"]
}) {
  return makeEvent({
    event_id: "evt_decision_scored_test",
    event_type: "DecisionScored",
    actor_id: "par_troy",
    payload: {
      decisionScore: {
        id: "dsc_protocol_success",
        object: "decisionScore",
        threadId: "thd_thread_0001",
        decisionRecordId: "dcr_protocol_first_architecture",
        score: 0.4,
        status: "failed",
        rationale: "Outcome audit missed target.",
        basedOnOutcomeAuditIds,
        scoredByParticipantId: "par_troy",
        scoredAt: "2027-03-03T00:00:00.000Z"
      }
    }
  });
}

function makeEvent({ event_id, event_type, actor_id, payload }) {
  return {
    event_id,
    event_type,
    thread_id: "thd_thread_0001",
    actor_id,
    timestamp: "2026-06-06T00:02:00.000Z",
    payload
  };
}

function assertInvalid(events, expectedReason) {
  const result = validateEvents(events);
  assert.equal(result.valid, false);
  assert.match(formatValidationErrors(result.errors), expectedReason);
  for (const error of result.errors) {
    assert.ok(Object.hasOwn(error, "event_id"));
    assert.ok(Object.hasOwn(error, "reason"));
  }
}
