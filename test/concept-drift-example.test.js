// concept-drift-example.test.js — guards the "Ongoing Monitoring Effective
// Challenge — Concept Drift" example (examples/ongoing-monitoring-concept-drift/).
//
// This log is a salable SR 11-7 Section VI challenge record, so beyond the
// generic manifest checks it must keep its specific shape: the challenge is
// raised as a blocking objection on the monitoring plan's premise, the line
// responds, the challenger records a disposition, the decision preserves the
// residual label-lag objection, and the whole log is sealed (strict-valid
// hash chain that fails closed on tampering).
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const logPath = path.join(root, "examples", "ongoing-monitoring-concept-drift", "challenge.ndjson");

const THREAD_ID = "thd_ongoing_monitoring_concept_drift_m471";

function runCli(args, { expectStatus = 0 } = {}) {
  const result = spawnSync("node", [cliPath, ...args], { encoding: "utf8" });
  assert.equal(result.status, expectStatus, `clista ${args.join(" ")} exited ${result.status}: ${result.stderr || result.stdout}`);
  return result;
}

test("concept-drift log validates clean and strict (sealed chain)", () => {
  const plain = JSON.parse(runCli(["validate", "--events", logPath]).stdout);
  assert.equal(plain.valid, true, JSON.stringify(plain.errors));

  const strict = JSON.parse(runCli(["validate", "--strict", "--events", logPath]).stdout);
  assert.equal(strict.valid, true, JSON.stringify(strict.errors));
  assert.equal(strict.integrity.strict, true);
  assert.equal(strict.integrity.valid, true);
  assert.equal(strict.integrity.eventCount, 24);
});

test("concept-drift log records challenge -> response -> disposition -> sealed decision", () => {
  const events = readEventsAt(logPath);
  assert.ok(events.every((e) => e.thread_id === THREAD_ID));

  // The challenge: a blocking objection from the challenger, targeting the
  // monitoring plan's stated premise (assumption), not a person or a vibe.
  const challenge = events.find((e) => e.event_type === "ObjectionRaised" && e.payload.objection.id === "obj_pyx_monitoring_gap");
  assert.ok(challenge, "challenge objection missing");
  assert.equal(challenge.actor_id, "par_mrm_challenger");
  assert.equal(challenge.payload.objection.targetObjectType, "assumption");
  assert.equal(challenge.payload.objection.targetObjectId, "asm_input_stability_implies_performance");
  assert.notEqual(challenge.payload.objection.blocking, false, "the challenge must be blocking");

  // The line response arrives AFTER the challenge (chronology is the record).
  const challengeIdx = events.indexOf(challenge);
  const responseIdx = events.findIndex((e) => e.event_type === "EvidenceCommitted" && e.payload.evidence.id === "evd_lob_remediation_plan");
  assert.ok(responseIdx > challengeIdx, "line response must follow the challenge");
  assert.equal(events[responseIdx].actor_id, "par_lob_model_owner");

  // The challenger's disposition resolves the blocking objection with text.
  const disposition = events.find((e) => e.event_type === "ObjectionResolved" && e.payload.objectionId === "obj_pyx_monitoring_gap");
  assert.ok(disposition, "challenger disposition missing");
  assert.equal(disposition.actor_id, "par_mrm_challenger", "disposition belongs to the challenger");
  assert.match(disposition.payload.resolution, /Remediated with conditions/);

  // The sealed decision: approved with dated conditions, and the residual
  // label-lag exposure survives as a preserved objection.
  const merged = events.find((e) => e.event_type === "DecisionMerged");
  assert.ok(merged, "decision missing");
  const record = merged.payload.decisionRecord;
  assert.equal(record.status, "approved");
  assert.ok(record.conditions.length >= 4, "conditions are the hard gates of the disposition");
  assert.deepEqual(record.preservedObjectionIds, ["obj_label_lag_residual_window"]);
  assert.equal(merged.actor_id, "par_mrm_head");

  // The preserved objection is real, non-blocking, and never resolved.
  const residual = events.find((e) => e.event_type === "ObjectionRaised" && e.payload.objection.id === "obj_label_lag_residual_window");
  assert.ok(residual, "residual objection missing");
  assert.equal(residual.payload.objection.blocking, false);
  assert.ok(
    !events.some((e) => e.event_type === "ObjectionResolved" && e.payload.objectionId === "obj_label_lag_residual_window"),
    "the residual label-lag objection must survive the decision unresolved"
  );

  // Engine-level validation agrees with the CLI.
  const result = validateEvents(events);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("tampering with any event breaks the sealed chain (strict fails closed)", () => {
  const events = readEventsAt(logPath);
  const tampered = events.map((e) => {
    if (e.event_type === "DecisionMerged") {
      // The quiet edit an examiner worries about: softening a condition
      // after the fact.
      return { ...e, payload: { ...e.payload, decisionRecord: { ...e.payload.decisionRecord, conditions: [] } } };
    }
    return e;
  });

  const os = require("node:os");
  const fs = require("node:fs");
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "clista-tamper-")), "tampered.ndjson");
  fs.writeFileSync(tmp, tampered.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");

  const result = spawnSync("node", [cliPath, "validate", "--strict", "--events", tmp], { encoding: "utf8" });
  assert.equal(result.status, 1, "strict validate must exit 1 on a tampered log");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.valid, false);
});
