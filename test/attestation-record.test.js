const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runCaptured } = require("../src/cli.js");

const repoRoot = path.resolve(__dirname, "..");
const serverPath = path.join(repoRoot, "src", "mcp_server.js");

function freshStore() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clista-attestation-record-"));
}

function jsonOut(result) {
  assert.equal(result.exitCode, 0, `non-zero exit: ${result.stdout}`);
  return JSON.parse(result.stdout);
}

test("attestation record without --request emits ParticipantAdded + EvidenceCommitted; validate stays green", () => {
  const cwd = freshStore();
  runCaptured(["init"], cwd);
  const thread = jsonOut(runCaptured(["thread", "create", "--title", "T", "--question", "Q"], cwd));

  const recorded = jsonOut(runCaptured([
    "attestation", "record",
    "--thread", thread.thread.id,
    "--attester", "Mira",
    "--text", "looks correct to me"
  ], cwd));

  assert.equal(recorded.schema, "clista.attestation.record.v0");
  assert.ok(recorded.evidence.id.startsWith("evd_"));
  assert.equal(recorded.review, null);
  assert.equal(recorded.evidence.source, "Attestation by Mira");
  assert.equal(recorded.evidence.finding, "looks correct to me");
  // No --request → no Review, so only one event appended (the Participant
  // is folded into a single ParticipantAdded that happened during the
  // prior write; this verb only emits its own Evidence here).
  assert.equal(recorded.events.length, 1);
  assert.equal(recorded.events[0].event_type, "EvidenceCommitted");

  const validation = jsonOut(runCaptured(["validate"], cwd));
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});

test("attestation record with --request and --source emits Review with source-suffixed comment", () => {
  const cwd = freshStore();
  runCaptured(["init"], cwd);
  const thread = jsonOut(runCaptured(["thread", "create", "--title", "T", "--question", "Q"], cwd));
  const opened = jsonOut(runCaptured([
    "decision", "open",
    "--thread", thread.thread.id,
    "--proposal", "ship M36"
  ], cwd));

  const recorded = jsonOut(runCaptured([
    "attestation", "record",
    "--thread", thread.thread.id,
    "--request", opened.decisionRequest.id,
    "--attester", "Mira",
    "--text", "approve, but document boundary",
    "--source", "https://moltbook.example/p/abc",
    "--status", "approve_with_conditions",
    "--conditions", "doc-boundary"
  ], cwd));

  assert.ok(recorded.review, "review should be present when --request given");
  assert.equal(recorded.review.decisionRequestId, opened.decisionRequest.id);
  assert.equal(recorded.review.reviewerParticipantId, recorded.attester.id);
  assert.equal(recorded.review.status, "approve_with_conditions");
  assert.deepEqual(recorded.review.conditions, ["doc-boundary"]);
  // The Moltbook URL goes into the Review comment (and Evidence source),
  // NOT into artifactIds — the field's semantics are "id of a known
  // artifact", not raw URLs (M36 boundary).
  assert.match(recorded.review.comment, /approve, but document boundary/);
  assert.match(recorded.review.comment, /Source: https:\/\/moltbook\.example\/p\/abc/);
  assert.equal(recorded.evidence.source, "Moltbook attestation: https://moltbook.example/p/abc");
  assert.deepEqual(recorded.evidence.artifactIds, []);
  assert.equal(recorded.events.length, 2);
  assert.equal(recorded.events[0].event_type, "EvidenceCommitted");
  assert.equal(recorded.events[1].event_type, "ReviewSubmitted");

  const validation = jsonOut(runCaptured(["validate"], cwd));
  assert.equal(validation.valid, true);

  // The audit view should surface the new review id somewhere under the
  // thread — the projector folds Reviews into the auditTrail (the
  // top-level structure has no dedicated reviews bucket).
  const audit = jsonOut(runCaptured(["audit", "show", "--thread", thread.thread.id], cwd));
  assert.ok(JSON.stringify(audit).includes(recorded.review.id),
    "audit view should reference the new review id");
});

test("attestation record fails fast when --thread is missing (exit 1, no stdout)", () => {
  const cwd = freshStore();
  runCaptured(["init"], cwd);
  const result = runCaptured([
    "attestation", "record",
    "--attester", "Mira",
    "--text", "x"
  ], cwd);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
});

test("a second attestation by the same attester does not duplicate the Participant", () => {
  // Confirms appendParticipant's idempotency (src/cli.js around line 4197):
  // the second call's emitted events array stays length 1 (Evidence only),
  // i.e. no ParticipantAdded for an already-known participant.
  const cwd = freshStore();
  runCaptured(["init"], cwd);
  const thread = jsonOut(runCaptured(["thread", "create", "--title", "T", "--question", "Q"], cwd));

  const first = jsonOut(runCaptured([
    "attestation", "record",
    "--thread", thread.thread.id,
    "--attester", "Mira",
    "--text", "first attestation"
  ], cwd));
  const second = jsonOut(runCaptured([
    "attestation", "record",
    "--thread", thread.thread.id,
    "--attester", "Mira",
    "--text", "second attestation"
  ], cwd));

  assert.equal(first.events.length, 1);
  assert.equal(second.events.length, 1);
  // Both attesters resolved to the same participant id.
  assert.equal(first.attester.id, second.attester.id);

  // The full log: thread + first Evidence + second Evidence + the
  // Participant once (added before the first Evidence). Validate keeps
  // green either way; the round trip is the contract.
  const validation = jsonOut(runCaptured(["validate"], cwd));
  assert.equal(validation.valid, true);
});

// ---- MCP end-to-end ------------------------------------------------------
//
// Mirror the spawn/spawnServer helper from test/mcp-server.test.js so a
// single attestation_record round trip exercises both the JSON-RPC framing
// and the runCaptured dispatch path.

function spawnServer(scopedRoot) {
  const child = spawn(process.execPath, [serverPath], {
    cwd: repoRoot,
    env: { ...process.env, CLISTA_STORE: scopedRoot },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let id = 0;
  let buffer = "";
  const pending = new Map();
  let stderrBuf = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderrBuf += chunk; });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const handler = pending.get(message.id);
      if (handler) {
        pending.delete(message.id);
        handler.resolve(message);
      }
    }
  });
  function call(method, params) {
    return new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: messageId, method, params })}\n`);
    });
  }
  function close() {
    return new Promise((resolve) => {
      child.on("close", () => resolve(stderrBuf));
      child.stdin.end();
    });
  }
  return { call, close };
}

test("MCP attestation_record end-to-end round trip", async () => {
  const store = freshStore();
  const server = spawnServer(store);
  await server.call("initialize", { protocolVersion: "2024-11-05" });

  const thread = JSON.parse((await server.call("tools/call", {
    name: "thread_create",
    arguments: { title: "T", question: "Q" }
  })).result.content[0].text);
  const decision = JSON.parse((await server.call("tools/call", {
    name: "decision_open",
    arguments: { thread: thread.thread.id, proposal: "ship M36" }
  })).result.content[0].text);

  const attested = JSON.parse((await server.call("tools/call", {
    name: "attestation_record",
    arguments: {
      thread: thread.thread.id,
      request: decision.decisionRequest.id,
      attester: "Claude_Code",
      text: "ClisTa verification PASS via MCP",
      source: "https://moltbook.example/p/xyz",
      status: "approve_with_conditions",
      conditions: "doc-boundary"
    }
  })).result.content[0].text);

  assert.equal(attested.schema, "clista.attestation.record.v0");
  assert.ok(attested.review, "review present when request supplied via MCP");
  assert.equal(attested.review.decisionRequestId, decision.decisionRequest.id);
  assert.match(attested.review.comment, /ClisTa verification PASS via MCP/);
  assert.match(attested.review.comment, /Source: https:\/\/moltbook\.example\/p\/xyz/);

  const validate = JSON.parse((await server.call("tools/call", {
    name: "validate", arguments: {}
  })).result.content[0].text);
  assert.equal(validate.valid, true);
  assert.deepEqual(validate.errors, []);

  await server.close();
});
