const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const canonicalLog = path.join(__dirname, "..", ".clista", "events.ndjson");

// A fresh deep clone of the canonical (valid) scenario per test. It already
// registers thread thd_thread_0001 via ThreadCreated, so an AlignmentCalculated
// appended for that thread satisfies validateThreadObject.
function canonicalEvents() {
  return JSON.parse(JSON.stringify(readEventsAt(canonicalLog)));
}

function validSnapshot(overrides = {}) {
  return {
    id: "aln_test",
    object: "alignmentSnapshot",
    threadId: "thd_thread_0001",
    createdAt: "2026-06-07T00:00:00.000Z",
    evidenceAlignment: 1,
    positionAlignment: 0.5,
    riskAlignment: 0.75,
    overallAlignment: 0.75,
    ...overrides
  };
}

function alignmentEvent(payload, eventId = "evt_alignment_calculated_test") {
  return {
    event_id: eventId,
    event_type: "AlignmentCalculated",
    thread_id: "thd_thread_0001",
    actor_id: "par_troy",
    timestamp: "2026-06-07T00:00:00.000Z",
    payload
  };
}

function assertInvalid(events, pattern) {
  const result = validateEvents(events);
  assert.equal(result.valid, false, "expected validation to fail");
  assert.match(formatValidationErrors(result.errors), pattern);
}

test("AlignmentCalculated with a well-formed snapshot validates clean", () => {
  const events = [...canonicalEvents(), alignmentEvent({ alignmentSnapshot: validSnapshot() })];
  assert.deepEqual(validateEvents(events), { valid: true, errors: [] });
});

test("AlignmentCalculated with a missing payload is rejected (regression: was a validator no-op)", () => {
  // The projector upserts payload.alignmentSnapshot into state, but the validator
  // had a bare `break` for this type — so a malformed/forged snapshot validated
  // clean and was projected. Guard that gap.
  const events = [...canonicalEvents(), alignmentEvent({}, "evt_alignment_calculated_empty")];
  assertInvalid(events, /AlignmentCalculated payload missing alignmentSnapshot/);
});

test("AlignmentCalculated rejects out-of-range alignment values", () => {
  const events = [...canonicalEvents(), alignmentEvent({ alignmentSnapshot: validSnapshot({ overallAlignment: 1.5 }) })];
  assertInvalid(events, /alignmentSnapshot overallAlignment must be between 0 and 1/);
});

test("AlignmentCalculated rejects a non-numeric alignment value", () => {
  const events = [...canonicalEvents(), alignmentEvent({ alignmentSnapshot: validSnapshot({ evidenceAlignment: "high" }) })];
  assertInvalid(events, /alignmentSnapshot evidenceAlignment must be a number/);
});

test("AlignmentCalculated rejects a snapshot whose threadId does not match the event", () => {
  const events = [...canonicalEvents(), alignmentEvent({ alignmentSnapshot: validSnapshot({ threadId: "thd_unknown" }) })];
  assertInvalid(events, /alignment snapshot threadId must match event thread_id/);
});
