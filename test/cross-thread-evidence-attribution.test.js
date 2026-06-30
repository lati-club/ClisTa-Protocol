// Regression for #39: CrossThreadEvidence must carry an attributed committer.
// It is registered into the same state.evidence map that claims/assumptions/
// positions reference, so an unattributed import would let evidence back the
// decision graph with no "who put this in the record" — the property ClisTa
// exists to guarantee. validateEvidenceCommitted already requires the committer;
// validateCrossThreadEvidence now matches it.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const parentLog = path.join(
  __dirname, "..", "examples", "pharma-phase-gate-multithreaded", "parent-go-nogo.ndjson"
);

function parentEvents() {
  return JSON.parse(JSON.stringify(readEventsAt(parentLog)));
}

function firstCrossThreadEvidence(events) {
  return events.find((event) => event.event_type === "CrossThreadEvidence");
}

test("the committed multi-thread example still validates (committer requirement is satisfied)", () => {
  assert.deepEqual(validateEvents(parentEvents()), { valid: true, errors: [] });
});

test("CrossThreadEvidence with no committedByParticipantId is rejected", () => {
  const events = parentEvents();
  const cte = firstCrossThreadEvidence(events);
  delete cte.payload.crossThreadEvidence.committedByParticipantId;
  delete cte.content_hash; // avoid coincidental hash-mismatch noise; isolate the attribution error

  const result = validateEvents(events);
  assert.equal(result.valid, false);
  assert.match(formatValidationErrors(result.errors), /CrossThreadEvidence missing committedByParticipantId/);
});

test("CrossThreadEvidence committed by an unknown participant is rejected", () => {
  const events = parentEvents();
  const cte = firstCrossThreadEvidence(events);
  cte.payload.crossThreadEvidence.committedByParticipantId = "par_ghost";
  delete cte.content_hash;

  const result = validateEvents(events);
  assert.equal(result.valid, false);
  assert.match(formatValidationErrors(result.errors), /crossThreadEvidence committed by unknown participant par_ghost/);
});
