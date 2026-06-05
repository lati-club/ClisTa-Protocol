const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { exportProtocol, projectEvents, selectAudit, selectThreadState } = require("../src/projector");

const root = path.resolve(__dirname, "..");
const fixture = path.join(root, "examples", "first-test-thread", "events.ndjson");

test("projects the first ClisTa decision thread into reloadable state", () => {
  const projection = projectEvents(readEventsAt(fixture));
  const state = selectThreadState(projection, "thd_clista_protocol_first");

  assert.equal(state.thread.question, "Should ClisTa MVP begin as a local-first JSON protocol before UI?");
  assert.equal(state.currentProposal.id, "drq_protocol_first");
  assert.equal(state.decisionStatus.recordStatus, "approved");
  assert.match(state.decisionStatus.decisionRecord.summary, /local-first JSON protocol engine/);
  assert.equal(state.supportingEvidence.length, 3);
  assert.equal(state.assumptions.length, 1);
  assert.match(state.assumptions[0].text, /projected reasoning state/);
  assert.equal(state.claims.length, 2);
  assert.equal(state.unresolvedObjections.length, 1);
  assert.equal(state.unresolvedObjections[0].participant.name, "Dissent Agent");
  assert.equal(state.decisionStatus.minorityReports.length, 1);
  assert.match(state.decisionStatus.decisionRecord.nextAction, /Implement schema/);
  assert.ok(state.auditTrail.some((entry) => entry.event_type === "DecisionMerged"));
});

test("events use the stable append-only log envelope", () => {
  const [event] = readEventsAt(fixture);

  assert.deepEqual(Object.keys(event), [
    "event_id",
    "event_type",
    "thread_id",
    "actor_id",
    "timestamp",
    "payload",
    "content_hash"
  ]);
});

test("exports all protocol object collections from the event log", () => {
  const projection = projectEvents(readEventsAt(fixture));
  const exported = exportProtocol(projection);

  assert.equal(exported.schema, "clista.protocol.v0");
  assert.equal(exported.evidence.length, 3);
  assert.equal(exported.assumptions.length, 1);
  assert.equal(exported.claims.length, 2);
  assert.equal(exported.positions.length, 3);
  assert.equal(exported.objections.length, 1);
  assert.equal(exported.decisionRequests.length, 1);
  assert.equal(exported.reviews.length, 1);
  assert.equal(exported.decisionRecords.length, 1);
  assert.equal(exported.minorityReports.length, 1);
  assert.equal(exported.events.length, 19);
});

test("audit projection answers why the decision happened", () => {
  const projection = projectEvents(readEventsAt(fixture));
  const audit = selectAudit(projection, "thd_clista_protocol_first");

  assert.equal(audit.decisionStatus.recordStatus, "approved");
  assert.ok(audit.evidence.some((item) => item.finding.includes("reload")));
  assert.ok(audit.assumptions.some((item) => item.text.includes("projected reasoning state")));
  assert.ok(audit.claims.some((claim) => claim.text.includes("protocol before UI")));
  assert.ok(audit.objections.some((objection) => objection.text.includes("too broad")));
});

test("CLI can initialize a store and show projected state", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-test-"));

  execFileSync("node", [path.join(root, "src", "cli.js"), "init"], { cwd });
  execFileSync("node", [
    path.join(root, "src", "cli.js"),
    "thread",
    "create",
    "--id",
    "thd_cli",
    "--title",
    "CLI Thread",
    "--question",
    "Can the CLI create a reasoning thread?",
    "--participant",
    "Troy:decision owner"
  ], { cwd });

  const output = execFileSync("node", [
    path.join(root, "src", "cli.js"),
    "state",
    "show",
    "--thread",
    "thd_cli"
  ], { cwd, encoding: "utf8" });
  const state = JSON.parse(output);

  assert.equal(state.thread.id, "thd_cli");
  assert.equal(state.thread.question, "Can the CLI create a reasoning thread?");
  assert.equal(state.auditTrail.some((entry) => entry.event_type === "ThreadCreated"), true);
});

test("CLI can list projected assumptions from the append-only log", () => {
  const output = execFileSync("node", [
    path.join(root, "src", "cli.js"),
    "assumptions",
    "list",
    "--thread",
    "thd_clista_protocol_first",
    "--events",
    fixture
  ], { cwd: root, encoding: "utf8" });
  const assumptions = JSON.parse(output);

  assert.equal(assumptions.length, 1);
  assert.equal(assumptions[0].id, "asm_projection_sufficient");
});
