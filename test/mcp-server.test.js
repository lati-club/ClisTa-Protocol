const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const serverPath = path.join(repoRoot, "src", "mcp_server.js");

// A tiny stdio JSON-RPC 2.0 client. The MCP server speaks newline-delimited
// JSON; this helper spawns it with a scoped store and exposes call(method, params)
// as a promise. Tests never touch stdout directly: every byte of CLI output is
// expected to be funneled through OUT and returned inside a JSON-RPC response,
// so a stray write would corrupt the framing and surface as a parse error here.
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
      let message;
      try {
        message = JSON.parse(line);
      } catch (err) {
        for (const { reject } of pending.values()) {
          reject(new Error(`server emitted non-JSON: ${line}`));
        }
        pending.clear();
        return;
      }
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

  return { call, close, child };
}

function freshStore() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clista-mcp-test-"));
}

test("initialize advertises the resolved store root and tool catalog", async () => {
  const store = freshStore();
  const server = spawnServer(store);
  const init = await server.call("initialize", { protocolVersion: "2024-11-05" });
  assert.equal(init.result.serverInfo.name, "clista-mcp");
  assert.equal(init.result.storeRoot, store);
  const list = await server.call("tools/list", {});
  const names = list.result.tools.map((t) => t.name);
  for (const expected of [
    "validate", "state_show", "decision_summary",
    "thread_create", "claim_create", "evidence_commit",
    "verify_protocol"
  ]) {
    assert.ok(names.includes(expected), `expected tool ${expected} in catalog`);
  }
  // No filesystem-path inputs leak through any tool schema. This is the wire
  // contract for the path-scoping safety law: domain args only.
  for (const tool of list.result.tools) {
    const props = (tool.inputSchema && tool.inputSchema.properties) || {};
    for (const key of Object.keys(props)) {
      assert.ok(!["events", "out", "packet", "input", "output"].includes(key),
        `tool ${tool.name} exposes filesystem path arg ${key}`);
    }
  }
  await server.close();
});

test("end-to-end: thread_create → claim_create → validate sees the new events", async () => {
  const store = freshStore();
  const server = spawnServer(store);
  await server.call("initialize", { protocolVersion: "2024-11-05" });

  const thread = await server.call("tools/call", {
    name: "thread_create",
    arguments: { title: "MCP smoke test", question: "Does the wire round trip?" }
  });
  const threadPayload = JSON.parse(thread.result.content[0].text);
  assert.ok(threadPayload.thread.id.startsWith("thd_"));

  const claim = await server.call("tools/call", {
    name: "claim_create",
    arguments: { thread: threadPayload.thread.id, text: "The wire round trips." }
  });
  const claimPayload = JSON.parse(claim.result.content[0].text);
  assert.ok(claimPayload.claim.id.startsWith("clm_"));

  const validate = await server.call("tools/call", {
    name: "validate", arguments: {}
  });
  const result = JSON.parse(validate.result.content[0].text);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);

  // The events landed in the scoped store and nowhere else.
  const eventsPath = path.join(store, ".clista", "events.ndjson");
  assert.ok(fs.existsSync(eventsPath), "scoped event log exists");
  const log = fs.readFileSync(eventsPath, "utf8").trim().split("\n");
  assert.ok(log.length >= 2, "scoped log has at least the thread + claim");

  await server.close();
});

test("verify_protocol returns the attestation shape with all five checks", async () => {
  const store = freshStore();
  const server = spawnServer(store);
  await server.call("initialize", { protocolVersion: "2024-11-05" });
  // Empty store — checks still return, with deterministic statuses.
  const verify = await server.call("tools/call", {
    name: "verify_protocol", arguments: {}
  });
  const structured = verify.result.structuredContent;
  assert.equal(structured.schema, "clista.mcp.verifyProtocol.v0");
  assert.equal(structured.checks.length, 5);
  assert.deepEqual(structured.checks.map((c) => c.id), [1, 2, 3, 4, 5]);
  // The replay check honestly degrades to SKIPPED here, because we are
  // verifying the scoped live store, not the committed replay fixture.
  assert.equal(structured.checks[4].status, "SKIPPED");
  assert.match(verify.result.content[0].text, /ClisTa verification \(via MCP/);
  await server.close();
});

test("missing required arg returns JSON-RPC -32602 (Invalid params)", async () => {
  const store = freshStore();
  const server = spawnServer(store);
  await server.call("initialize", { protocolVersion: "2024-11-05" });
  const missing = await server.call("tools/call", {
    name: "thread_create", arguments: { title: "no question" }
  });
  assert.ok(missing.error, "response should be an error");
  assert.equal(missing.error.code, -32602);
  assert.match(missing.error.message, /Missing required argument: question/);
  await server.close();
});

test("a ../ scalar arg is contained inside the scoped store", async () => {
  // The threat model: a tool input that LOOKS like a path. Because no tool
  // exposes filesystem-path args at all, even a deliberately hostile value
  // cannot escape — it just becomes part of an in-event string. This test is
  // the trip-wire that catches any future tool accidentally piping a scalar
  // arg into a path-like option.
  const store = freshStore();
  const server = spawnServer(store);
  await server.call("initialize", { protocolVersion: "2024-11-05" });
  const escape = await server.call("tools/call", {
    name: "thread_create",
    arguments: { title: "../escape", question: "../../etc/passwd" }
  });
  const payload = JSON.parse(escape.result.content[0].text);
  // The hostile title still became a thread, but the id is slugified and the
  // events live inside the scoped store's .clista/ directory only.
  assert.ok(payload.thread.id.startsWith("thd_"));
  assert.equal(fs.existsSync(path.join(store, "..", "escape")), false);
  assert.equal(fs.existsSync(path.join(store, "..", "..", "etc", "passwd-clista")), false);
  const eventsPath = path.join(store, ".clista", "events.ndjson");
  assert.ok(fs.existsSync(eventsPath));
  // No file at all was created above the scoped root by this call.
  const parentEntries = fs.readdirSync(path.dirname(store));
  for (const entry of parentEntries) {
    assert.ok(!entry.includes("escape"), `unexpected escape entry: ${entry}`);
  }
  await server.close();
});
