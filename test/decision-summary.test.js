const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function decisionSummary(eventsPath, extraArgs = []) {
  const result = spawnSync(
    "node",
    ["src/cli.js", "decision", "summary", "--events", eventsPath, ...extraArgs],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("decision summary answers the four questions for a full decision", () => {
  const summary = decisionSummary("examples/scenario-demo/events.ndjson");

  assert.equal(summary.schema, "clista.decisionSummary.v0");
  assert.equal(summary.threadId, "thd_scenario_demo");
  assert.equal(summary.status, "decided");

  // What was decided?
  assert.equal(summary.whatWasDecided.status, "approved");
  assert.match(summary.whatWasDecided.summary, /redacted/);
  assert.equal(summary.whatWasDecided.decidedBy, "Maya");

  // Why? — rationale plus resolved, readable support of all three kinds.
  assert.ok(summary.why.rationale);
  assert.ok(summary.why.supportingEvidence.length > 0);
  assert.ok(summary.why.supportingClaims.length > 0);
  assert.ok(summary.why.supportingAssumptions.length > 0);
  assert.ok(summary.why.supportingEvidence[0].finding, "evidence is resolved to text");

  // Who dissented? — the preserved blocking objection and its minority report.
  const objection = summary.whoDissented.objections[0];
  assert.equal(objection.status, "preserved");
  assert.equal(objection.blocking, true);
  assert.equal(objection.raisedBy, "Privacy Reviewer");
  const report = summary.whoDissented.minorityReports[0];
  assert.equal(report.filedBy, "Privacy Reviewer");
  assert.ok(report.text);

  // What should happen next?
  assert.ok(summary.whatNext);
});

test("decision summary surfaces a non-blocking objection with no minority report", () => {
  const summary = decisionSummary("examples/hermes-ingest/events.ndjson");

  assert.equal(summary.status, "decided");
  assert.equal(summary.whatWasDecided.status, "approved");
  assert.equal(summary.whoDissented.objections.length, 1);
  assert.equal(summary.whoDissented.objections[0].blocking, false);
  assert.equal(summary.whoDissented.minorityReports.length, 0);
});

test("decision summary --format text renders the four answer sections", () => {
  const result = spawnSync(
    "node",
    ["src/cli.js", "decision", "summary",
     "--events", "examples/scenario-demo/events.ndjson", "--format", "text"],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const text = result.stdout;
  for (const heading of ["## What was decided", "## Why", "## Who dissented", "## What next"]) {
    assert.ok(text.includes(heading), `missing section: ${heading}`);
  }
  assert.ok(!text.trimStart().startsWith("{"), "text mode must not emit JSON");
});

test("decision summary reports an error for an unknown thread", () => {
  const summary = decisionSummary(
    "examples/scenario-demo/events.ndjson",
    ["--thread", "thd_does_not_exist"]
  );
  assert.equal(summary.schema, "clista.decisionSummary.v0");
  assert.ok(summary.error);
});
