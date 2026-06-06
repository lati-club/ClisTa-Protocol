const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { evaluateDecisionEligibility } = require("../src/governance");
const { projectEvents, selectThreadState } = require("../src/projector");
const { validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const canonicalLog = path.join(root, ".clista", "events.ndjson");
const cliPath = path.join(root, "src", "cli.js");

test("governance eligibility explains why an open request is not mergeable yet", () => {
  const events = cloneCanonicalEvents();
  const prefix = eventsBefore(events, "DecisionMerged");
  const eligibility = evaluateDecisionEligibility(prefix, "drq_protocol_first_architecture");

  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.requestId, "drq_protocol_first_architecture");
  assert.deepEqual(eligibility.authorizedDecisionOwners, ["par_troy"]);
  assert.deepEqual(eligibility.blockingObjections, ["obj_object_model_too_broad"]);
  assert.deepEqual(eligibility.missingReviews, []);
  assert.deepEqual(eligibility.requiredMinorityReports, ["obj_object_model_too_broad"]);
  assert.ok(eligibility.recorded.reviewIds.some((id) => id.startsWith("rev_")));
  assert.ok(eligibility.reasons.some((reason) => {
    return reason.event_id.startsWith("evt_objectionraised_")
      && reason.reason === "blocking objection remains unresolved and unpreserved";
  }));
});

test("governance eligibility recognizes a legitimate decision owner preserving dissent", () => {
  const events = cloneCanonicalEvents();
  const merge = eventOf(events, "DecisionMerged");
  const prefix = eventsBefore(events, "DecisionMerged");
  const eligibility = evaluateDecisionEligibility(prefix, "drq_protocol_first_architecture", {
    actorId: merge.actor_id,
    decisionRecord: merge.payload.decisionRecord,
    eventId: merge.event_id
  });

  assert.equal(eligibility.eligible, true);
  assert.deepEqual(eligibility.blockingObjections, []);
  assert.deepEqual(eligibility.requiredMinorityReports, ["obj_object_model_too_broad"]);
  assert.equal(eligibility.recorded.supportingEvidenceIds.length, 4);
  assert.equal(eligibility.recorded.supportingClaimIds.length, 5);
  assert.equal(eligibility.recorded.supportingAssumptionIds.length, 3);
  assert.equal(eligibility.recorded.authorityTrail[0].participantId, "par_troy");
});

test("CLI decision eligibility emits explainable JSON before merge", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "clista-governance-"));
  const eventsPath = path.join(dir, "events.ndjson");
  const prefix = eventsBefore(cloneCanonicalEvents(), "DecisionMerged");
  writeFileSync(eventsPath, `${prefix.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

  const result = spawnSync("node", [
    cliPath,
    "decision",
    "eligibility",
    "--request",
    "drq_protocol_first_architecture",
    "--events",
    eventsPath
  ], { cwd: root, encoding: "utf8" });
  const eligibility = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(eligibility.schema, "clista.governance.eligibility.v0");
  assert.equal(eligibility.eligible, false);
  assert.deepEqual(eligibility.authorizedDecisionOwners, ["par_troy"]);
  assert.deepEqual(eligibility.blockingObjections, ["obj_object_model_too_broad"]);
  assert.equal(result.stderr, "");
});

test("CLI decision merge records review ids and authority trail", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-governed-merge-"));

  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_gov",
    "--title",
    "Governance Thread",
    "--question",
    "Can a decision merge legitimately?",
    "--participant",
    "Troy:decision owner"
  ]);
  runCli(cwd, [
    "evidence",
    "commit",
    "--id",
    "evd_gov",
    "--thread",
    "thd_gov",
    "--source",
    "Test",
    "--finding",
    "Evidence exists."
  ]);
  runCli(cwd, [
    "assumption",
    "declare",
    "--id",
    "asm_gov",
    "--thread",
    "thd_gov",
    "--text",
    "Assumption exists.",
    "--evidence",
    "evd_gov"
  ]);
  runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_gov",
    "--thread",
    "thd_gov",
    "--text",
    "Claim is supported.",
    "--evidence",
    "evd_gov",
    "--assumptions",
    "asm_gov"
  ]);
  runCli(cwd, [
    "decision",
    "open",
    "--id",
    "drq_gov",
    "--thread",
    "thd_gov",
    "--proposal",
    "Merge legitimate decision.",
    "--evidence",
    "evd_gov",
    "--claims",
    "clm_gov",
    "--assumptions",
    "asm_gov"
  ]);
  runCli(cwd, [
    "review",
    "submit",
    "--id",
    "rev_gov",
    "--thread",
    "thd_gov",
    "--request",
    "drq_gov",
    "--reviewer",
    "Troy",
    "--status",
    "approve"
  ]);
  const merge = runCli(cwd, [
    "decision",
    "merge",
    "--id",
    "dcr_gov",
    "--thread",
    "thd_gov",
    "--request",
    "drq_gov",
    "--decider",
    "Troy"
  ]);
  const validation = runCli(cwd, ["validate"]);

  assert.deepEqual(merge.decisionRecord.reviewIds, ["rev_gov"]);
  assert.deepEqual(merge.decisionRecord.objectionIds, []);
  assert.equal(merge.decisionRecord.authorityTrail[0].participantId, "par_troy");
  assert.equal(merge.decisionRecord.authorityTrail[0].source, "ParticipantAdded.role");
  assert.deepEqual(validation, { valid: true, errors: [] });
});

test("non-blocking objections do not block merge and remain visible in projected state", () => {
  const events = cloneCanonicalEvents()
    .filter((event) => event.event_type !== "MinorityReportFiled");
  eventWithObject(events, "ObjectionRaised", "obj_object_model_too_broad").payload.objection.blocking = false;
  eventOf(events, "DecisionMerged").payload.decisionRecord.preservedObjectionIds = [];

  assert.equal(validateEvents(events).valid, true);

  const state = selectThreadState(projectEvents(events), "thd_thread_0001");
  const objection = state.unresolvedObjections.find((item) => item.id === "obj_object_model_too_broad");
  assert.equal(objection.blocking, false);
  assert.match(objection.text, /object model may be broader/);
});

function cloneCanonicalEvents() {
  return clone(readEventsAt(canonicalLog));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function eventsBefore(events, eventType) {
  const index = events.findIndex((event) => event.event_type === eventType);
  assert.notEqual(index, -1, `expected ${eventType} event`);
  return events.slice(0, index);
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

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
