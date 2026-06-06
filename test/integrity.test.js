const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { verifyEventIntegrity } = require("../src/integrity");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const fixtureLog = path.join(root, "examples", "first-test-thread", "events.ndjson");
const canonicalLog = path.join(root, ".clista", "events.ndjson");

test("newly appended events form a strict hash chain", () => {
  const cwd = createIntegrityStore();
  const events = readEventsAt(path.join(cwd, ".clista", "events.ndjson"));
  const report = verifyEventIntegrity(events, { strict: true });

  assert.equal(report.valid, true);
  assert.equal(report.reasons.length, 0);
  assert.ok(events.length >= 4);
  assert.equal(events[0].previous_hash, undefined);
  for (let index = 1; index < events.length; index += 1) {
    assert.equal(events[index].previous_hash, events[index - 1].content_hash);
  }
});

test("integrity verifier detects tampered canonical event serialization", () => {
  const cwd = createIntegrityStore();
  const tamperedLog = path.join(cwd, "tampered.ndjson");
  const events = readEventsAt(path.join(cwd, ".clista", "events.ndjson"));
  const evidence = events.find((event) => event.event_type === "EvidenceCommitted");
  evidence.payload.evidence.finding = "Tampered after append.";
  writeEventLog(tamperedLog, events);

  const result = spawnSync("node", [cliPath, "integrity", "verify", "--events", tamperedLog, "--strict"], {
    cwd: root,
    encoding: "utf8"
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(output.valid, false);
  assert.match(JSON.stringify(output.reasons), /content_hash does not match canonical event serialization/);
});

test("validate rejects tampered v1 events after the fact", () => {
  const cwd = createIntegrityStore();
  const tamperedLog = path.join(cwd, "tampered-for-validate.ndjson");
  const events = readEventsAt(path.join(cwd, ".clista", "events.ndjson"));
  const thread = events.find((event) => event.event_type === "ThreadCreated");
  thread.payload.thread.question = "Was this changed after append?";
  writeEventLog(tamperedLog, events);

  const result = spawnSync("node", [cliPath, "validate", "--events", tamperedLog], {
    cwd: root,
    encoding: "utf8"
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(output.valid, false);
  assert.match(JSON.stringify(output.errors), /content_hash does not match canonical event serialization/);
});

test("strict integrity verifier rejects missing previous_hash links", () => {
  const cwd = createIntegrityStore();
  const brokenLog = path.join(cwd, "broken-chain.ndjson");
  const events = readEventsAt(path.join(cwd, ".clista", "events.ndjson"));
  delete events[1].previous_hash;
  writeEventLog(brokenLog, events);

  const result = spawnSync("node", [cliPath, "integrity", "verify", "--events", brokenLog, "--strict"], {
    cwd: root,
    encoding: "utf8"
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(output.valid, false);
  assert.match(JSON.stringify(output.reasons), /missing previous_hash/);
});

test("legacy v0 fixture logs remain verifiable in compatibility mode", () => {
  const result = spawnSync("node", [cliPath, "integrity", "verify", "--events", fixtureLog], {
    cwd: root,
    encoding: "utf8"
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(output.valid, true);
  assert.equal(output.strict, false);
  assert.equal(output.eventCount, 19);
});

test("export/import round trip preserves projected reasoning from only events", () => {
  const exportResult = spawnSync("node", [cliPath, "export", "--events", canonicalLog], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(exportResult.status, 0, exportResult.stderr);
  const exported = JSON.parse(exportResult.stdout);
  assert.equal(exported.schema, "clista.protocol.v0");
  assert.equal(exported.integrity.valid, true);

  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-import-"));
  const exportPath = path.join(cwd, "clista-export.json");
  writeFileSync(exportPath, `${JSON.stringify(exported, null, 2)}\n`, "utf8");

  const importResult = spawnSync("node", [cliPath, "import", "--events", exportPath], {
    cwd,
    encoding: "utf8"
  });
  assert.equal(importResult.status, 0, importResult.stderr);
  const imported = JSON.parse(importResult.stdout);
  assert.equal(imported.valid, true);
  assert.equal(imported.importedEvents, exported.events.length);
  assert.equal(imported.integrity.valid, true);
  assert.equal(imported.integrity.strict, true);

  const originalState = stateShow(root, canonicalLog, "thd_thread_0001");
  const importedState = stateShow(cwd, null, "thd_thread_0001");

  assert.equal(importedState.thread.question, originalState.thread.question);
  assert.equal(importedState.reasoningState.audit_summary.source, "append_only_event_log");
  assert.equal(importedState.reasoningState.audit_summary.events_replayed, exported.events.length);
  assert.equal(importedState.decisionStatus.recordStatus, originalState.decisionStatus.recordStatus);
  assert.equal(importedState.supportingEvidence.length, originalState.supportingEvidence.length);
  assert.equal(importedState.claims.length, originalState.claims.length);
});

test("import rejects unsupported protocol export schemas", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-import-schema-"));
  const exportPath = path.join(cwd, "future-export.json");
  writeFileSync(exportPath, `${JSON.stringify({ schema: "clista.protocol.v999", events: [] })}\n`, "utf8");

  const result = spawnSync("node", [cliPath, "import", "--events", exportPath], {
    cwd,
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported import schema clista.protocol.v999/);
});

function createIntegrityStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-integrity-"));
  execFileSync("node", [cliPath, "init"], { cwd });
  execFileSync("node", [
    cliPath,
    "thread",
    "create",
    "--id",
    "thd_integrity",
    "--title",
    "Integrity Thread",
    "--question",
    "Can ClisTa verify event history?",
    "--participant",
    "Troy:decision owner"
  ], { cwd });
  execFileSync("node", [
    cliPath,
    "evidence",
    "commit",
    "--thread",
    "thd_integrity",
    "--source",
    "Local log",
    "--finding",
    "Hash-linked events detect tampering."
  ], { cwd });
  return cwd;
}

function stateShow(cwd, eventsPath, threadId) {
  const args = [cliPath, "state", "show", "--thread", threadId];
  if (eventsPath) {
    args.push("--events", eventsPath);
  }
  return JSON.parse(execFileSync("node", args, { cwd, encoding: "utf8" }));
}

function writeEventLog(logPath, events) {
  writeFileSync(logPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
}
