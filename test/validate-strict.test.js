const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const chainedLog = path.join(root, "examples", "vendor-due-diligence.ndjson"); // fully hash-chained
const unsignedLog = path.join(root, "examples", "scenario-demo", "events.ndjson"); // no content_hash at all
const canonicalLog = path.join(root, ".clista", "events.ndjson");

function runValidate(args) {
  const result = spawnSync("node", [cliPath, "validate", ...args], { cwd: root, encoding: "utf8" });
  return { status: result.status, output: JSON.parse(result.stdout) };
}

test("validate --strict passes on a fully hash-chained log", () => {
  const { status, output } = runValidate(["--events", chainedLog, "--strict"]);
  assert.equal(status, 0);
  assert.equal(output.valid, true);
  assert.equal(output.integrity.valid, true);
  assert.equal(output.integrity.strict, true);
});

test("plain validate passes on an unsigned log (lax by default)", () => {
  // Documents the deliberate policy: structural validation does not assert
  // tamper-evidence. An unsigned log is structurally valid.
  const { status, output } = runValidate(["--events", unsignedLog]);
  assert.equal(status, 0);
  assert.equal(output.valid, true);
  assert.equal(output.integrity, undefined); // no integrity block unless --strict
});

test("validate --strict fails closed on an unsigned log", () => {
  const { status, output } = runValidate(["--events", unsignedLog, "--strict"]);
  assert.equal(status, 1);
  assert.equal(output.valid, false);
  assert.equal(output.integrity.valid, false);
  assert.match(JSON.stringify(output.integrity.reasons), /missing content_hash/);
});

test("validateEvents detects a forged chain that bridges a hash-less event (stale-anchor regression)", () => {
  // A hash-less event mid-log used to leave the chain anchor stale, so the next
  // event's previous_hash could point across the gap to the pre-gap event and
  // still validate. The anchor now resets on every event, closing that hole.
  const events = JSON.parse(JSON.stringify(readEventsAt(canonicalLog)));
  assert.ok(events.length >= 4 && events.every((e) => e.content_hash), "fixture must be fully chained");

  // events[2] becomes an unsigned gap; events[3] forges a link back to events[1].
  const preGapHash = events[1].content_hash;
  delete events[2].content_hash;
  delete events[2].hash_version;
  events[3].previous_hash = preGapHash;

  const result = validateEvents(events);
  assert.equal(result.valid, false);
  assert.match(
    result.errors.map((e) => e.reason).join("\n"),
    /invalid previous_hash chain/
  );
});
