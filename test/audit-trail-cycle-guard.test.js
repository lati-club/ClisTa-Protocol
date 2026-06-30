const assert = require("node:assert/strict");
const test = require("node:test");

const { projectEvents, selectThreadState } = require("../src/projector");

// selectThreadState reaches auditTrailForThread, which walks a thread's fork
// ancestry. A malformed fork chain (parentThreadId pointing back into the chain)
// used to recurse forever — projectEvents rebuilds the same self-referential fork
// at every level — and overflow the stack. The visited-set guard bounds it.

function threadForkEvent({ eventId, threadId, forkThreadId, parentThreadId, inheritedThroughEventId, at }) {
  return {
    event_id: eventId,
    event_type: "ThreadForked",
    thread_id: threadId,
    actor_id: "par_x",
    timestamp: at,
    payload: {
      threadFork: {
        id: `frk_${forkThreadId}`,
        forkThreadId,
        parentThreadId,
        inheritedThroughEventId,
        forkedBy: "par_x"
      }
    }
  };
}

test("auditTrailForThread terminates on a self-referential fork (no stack overflow)", () => {
  const events = [threadForkEvent({
    eventId: "evt_self_fork",
    threadId: "thd_loop",
    forkThreadId: "thd_loop",
    parentThreadId: "thd_loop", // points at itself
    inheritedThroughEventId: "evt_self_fork",
    at: "2026-01-01T00:00:00.000Z"
  })];
  const projection = projectEvents(events);
  assert.equal(projection.threads.thd_loop.fork.parentThreadId, "thd_loop");

  let threadState;
  assert.doesNotThrow(() => {
    threadState = selectThreadState(projection, "thd_loop");
  });
  assert.ok(Array.isArray(threadState.auditTrail));
});

test("auditTrailForThread terminates on a mutually-referential fork cycle (A <-> B)", () => {
  const events = [
    threadForkEvent({
      eventId: "evt_fa",
      threadId: "thd_a",
      forkThreadId: "thd_a",
      parentThreadId: "thd_b",
      inheritedThroughEventId: "evt_fb",
      at: "2026-01-01T00:00:01.000Z"
    }),
    threadForkEvent({
      eventId: "evt_fb",
      threadId: "thd_b",
      forkThreadId: "thd_b",
      parentThreadId: "thd_a",
      inheritedThroughEventId: "evt_fa",
      at: "2026-01-01T00:00:00.000Z"
    })
  ];
  const projection = projectEvents(events);

  assert.doesNotThrow(() => selectThreadState(projection, "thd_a"));
  assert.doesNotThrow(() => selectThreadState(projection, "thd_b"));
});
