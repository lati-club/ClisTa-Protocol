const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const canonicalLog = path.join(root, ".clista", "events.ndjson");
const cliPath = path.join(root, "src", "cli.js");

test("CLI reconstructs parent and divergent fork state from the event log", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-forks-"));

  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_parent",
    "--title",
    "Parent Reasoning",
    "--question",
    "Should the parent reasoning continue?"
  ]);
  runCli(cwd, [
    "evidence",
    "commit",
    "--id",
    "evd_parent",
    "--thread",
    "thd_parent",
    "--source",
    "Parent source",
    "--finding",
    "Parent evidence remains true at fork time."
  ]);
  runCli(cwd, [
    "assumption",
    "declare",
    "--id",
    "asm_parent",
    "--thread",
    "thd_parent",
    "--text",
    "The parent assumption is sufficient.",
    "--evidence",
    "evd_parent"
  ]);
  const parentClaim = runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_parent",
    "--thread",
    "thd_parent",
    "--text",
    "The parent claim follows.",
    "--evidence",
    "evd_parent",
    "--assumptions",
    "asm_parent"
  ]);
  const boundaryEventId = parentClaim.event.event_id;

  runCli(cwd, [
    "thread",
    "fork",
    "--parent",
    "thd_parent",
    "--fork",
    "thd_fork",
    "--title",
    "Fork Reasoning",
    "--reason",
    "Test a different assumption.",
    "--through",
    boundaryEventId,
    "--changed-assumptions",
    "asm_parent",
    "--changed-claims",
    "clm_parent",
    "--forked-by",
    "Author"
  ]);
  runCli(cwd, [
    "assumption",
    "declare",
    "--id",
    "asm_fork",
    "--thread",
    "thd_fork",
    "--text",
    "The fork assumption diverges.",
    "--evidence",
    "evd_parent"
  ]);
  runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_fork",
    "--thread",
    "thd_fork",
    "--text",
    "The fork claim diverges.",
    "--evidence",
    "evd_parent",
    "--assumptions",
    "asm_fork"
  ]);
  runCli(cwd, [
    "objection",
    "raise",
    "--id",
    "obj_fork_parent_claim",
    "--thread",
    "thd_fork",
    "--participant",
    "Author",
    "--target",
    "clm_parent",
    "--target-type",
    "claim",
    "--text",
    "The fork contests the inherited parent claim."
  ]);

  const validation = runCli(cwd, ["validate"]);
  const parentState = runCli(cwd, ["state", "show", "--thread", "thd_parent"]);
  const forkState = runCli(cwd, ["state", "show", "--thread", "thd_fork"]);
  const lineage = runCli(cwd, ["fork", "lineage", "--thread", "thd_fork"]);

  assert.deepEqual(validation, { valid: true, errors: [] });
  assert.equal(parentState.assumptions.some((assumption) => assumption.id === "asm_fork"), false);
  assert.equal(parentState.claims.some((claim) => claim.id === "clm_fork"), false);
  assert.equal(parentState.claims.find((claim) => claim.id === "clm_parent").status, "draft");
  assert.equal(forkState.forkLineage.parentThreadId, "thd_parent");
  assert.equal(forkState.forkLineage.inheritedThroughEventId, boundaryEventId);
  assert.equal(forkState.assumptions.some((assumption) => assumption.id === "asm_parent" && assumption.inheritedFromThreadId === "thd_parent"), true);
  assert.equal(forkState.assumptions.some((assumption) => assumption.id === "asm_fork"), true);
  assert.equal(forkState.unresolvedObjections.some((objection) => objection.id === "obj_fork_parent_claim"), true);
  assert.deepEqual(forkState.changedAssumptions.map((assumption) => assumption.id), ["asm_parent"]);
  assert.deepEqual(forkState.divergentClaims.map((claim) => claim.id).sort(), ["clm_fork", "clm_parent"]);
  assert.equal(lineage.schema, "clista.forkLineage.v0");
  assert.equal(lineage.forkThreadId, "thd_fork");
  assert.equal(lineage.forkReason, "Test a different assumption.");
});

test("rejects forks with missing parents, duplicate fork ids, future boundaries, and parent mutation", () => {
  const boundaryEventId = eventOf(cloneCanonicalEvents(), "ClaimCreated").event_id;

  assertInvalid([
    ...cloneCanonicalEvents(),
    makeThreadForkEvent({ parentThreadId: "thd_missing", inheritedThroughEventId: boundaryEventId })
  ], /fork references unknown parent thread thd_missing/);

  assertInvalid([
    ...cloneCanonicalEvents(),
    makeThreadForkEvent({ forkThreadId: "thd_thread_0001", inheritedThroughEventId: boundaryEventId })
  ], /forkThreadId is not unique: thd_thread_0001/);

  const futureEvents = cloneCanonicalEvents();
  const futureBoundary = eventOf(futureEvents, "DecisionMerged").event_id;
  const fork = makeThreadForkEvent({ inheritedThroughEventId: futureBoundary });
  const decisionIndex = futureEvents.findIndex((event) => event.event_type === "DecisionMerged");
  futureEvents.splice(decisionIndex, 0, fork);
  assertInvalid(futureEvents, new RegExp(`fork cannot inherit from future event ${futureBoundary}`));

  const mutationEvents = [
    ...cloneCanonicalEvents(),
    makeThreadForkEvent({ inheritedThroughEventId: boundaryEventId }),
    makeEvent({
      event_id: "evt_fork_mutates_parent_assumption",
      event_type: "AssumptionDeclared",
      thread_id: "thd_fork_test",
      actor_id: "par_troy",
      payload: {
        assumption: {
          id: "asm_memory_should_not_depend_on_models",
          object: "assumption",
          threadId: "thd_fork_test",
          text: "Overwrite inherited parent assumption.",
          status: "active",
          evidenceIds: [],
          declaredByParticipantId: "par_troy",
          declaredAt: "2026-06-06T00:04:00.000Z",
          contentHash: `sha256:${"1".repeat(64)}`
        }
      }
    })
  ];
  assertInvalid(mutationEvents, /fork cannot mutate parent object directly: asm_memory_should_not_depend_on_models/);

  const objectionBoundary = eventOf(cloneCanonicalEvents(), "ObjectionRaised");
  const inheritedResolutionEvents = [
    ...cloneCanonicalEvents(),
    makeThreadForkEvent({ inheritedThroughEventId: objectionBoundary.event_id }),
    makeEvent({
      event_id: "evt_fork_resolves_parent_objection",
      event_type: "ObjectionResolved",
      thread_id: "thd_fork_test",
      actor_id: "par_chatgpt",
      payload: {
        objectionId: objectionBoundary.payload.objection.id,
        resolution: "Resolve parent objection from the fork."
      }
    })
  ];
  assertInvalid(inheritedResolutionEvents, /fork cannot mutate parent object directly: obj_future_models/);
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

function makeThreadForkEvent({
  parentThreadId = "thd_thread_0001",
  forkThreadId = "thd_fork_test",
  inheritedThroughEventId
}) {
  return makeEvent({
    event_id: `evt_threadforked_${forkThreadId}`,
    event_type: "ThreadForked",
    thread_id: forkThreadId,
    actor_id: "par_troy",
    payload: {
      threadFork: {
        id: forkThreadId,
        object: "threadFork",
        parentThreadId,
        forkThreadId,
        forkTitle: "Fork Test",
        forkedBy: "par_troy",
        forkedAt: "2026-06-06T00:03:00.000Z",
        inheritedThroughEventId,
        forkReason: "Test divergent reasoning.",
        changedAssumptionIds: ["asm_memory_should_not_depend_on_models"],
        changedClaimIds: ["clm_protocol_first"],
        contentHash: `sha256:${"0".repeat(64)}`
      }
    }
  });
}

function makeEvent({ event_id, event_type, thread_id = "thd_thread_0001", actor_id, payload }) {
  return {
    event_id,
    event_type,
    thread_id,
    actor_id,
    timestamp: "2026-06-06T00:03:00.000Z",
    payload
  };
}

function assertInvalid(events, expectedReason) {
  const result = validateEvents(events);
  assert.equal(result.valid, false);
  assert.match(formatValidationErrors(result.errors), expectedReason);
}

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
