const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { projectEvents, selectThreadState, exportProtocol } = require("../src/projector");

const canonicalLog = path.join(__dirname, "..", ".clista", "events.ndjson");
const thread = "thd_thread_0001";

function events() {
  return readEventsAt(canonicalLog);
}

test("projecting the same events twice yields byte-identical state", () => {
  // Umbrella determinism guard. This was false before the fix because the
  // projection embedded nowIso() (projectedAt + the computed alignment snapshot).
  const e = events();
  assert.equal(JSON.stringify(projectEvents(e)), JSON.stringify(projectEvents(e)));
});

test("thread state and protocol export are reproducible across runs", () => {
  const e = events();
  const a = projectEvents(e);
  const b = projectEvents(e);
  assert.equal(
    JSON.stringify(selectThreadState(a, thread)),
    JSON.stringify(selectThreadState(b, thread))
  );
  assert.equal(JSON.stringify(exportProtocol(a)), JSON.stringify(exportProtocol(b)));
});

test("projectedAt is derived from the latest event, not the wall clock", () => {
  const e = events();
  const projection = projectEvents(e);
  assert.equal(projection.projectedAt, e.at(-1).timestamp);
});

test("computed alignment fallback timestamps from the log, not the wall clock", () => {
  // The canonical log has no AlignmentCalculated event, so selectThreadState
  // computes the fallback snapshot. Its createdAt must be the derived "as of"
  // time (projectedAt), not nowIso().
  const e = events();
  const projection = projectEvents(e);
  const threadState = selectThreadState(projection, thread);
  assert.equal(threadState.alignmentSnapshot.metadata.method, "calculated_from_projected_state");
  assert.equal(threadState.alignmentSnapshot.createdAt, projection.projectedAt);
});

test("projectedAt is null for an empty log (no wall clock)", () => {
  assert.equal(projectEvents([]).projectedAt, null);
});
