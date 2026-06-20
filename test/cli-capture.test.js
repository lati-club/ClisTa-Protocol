const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runCaptured } = require("../src/cli.js");

function freshStore() {
  // A throwaway scoped store per test. runCaptured uses this as cwd, so the
  // CLI's .clista/ directory lands here and nothing leaks into the repo root.
  return fs.mkdtempSync(path.join(os.tmpdir(), "clista-cli-capture-"));
}

test("runCaptured returns the JSON the CLI would print", () => {
  const cwd = freshStore();
  const initResult = runCaptured(["init"], cwd);
  assert.equal(initResult.exitCode, 0);
  const init = JSON.parse(initResult.stdout);
  assert.equal(init.eventsPath, path.join(cwd, ".clista", "events.ndjson"));

  const validate = runCaptured(["validate"], cwd);
  assert.equal(validate.exitCode, 0);
  const parsed = JSON.parse(validate.stdout);
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.errors, []);
});

test("runCaptured forwards exitCode and stderr message for failures, never touching captured stdout", () => {
  const cwd = freshStore();
  // thread create with no options fails inside main()'s try/catch. fail() sets
  // exitCode=1 and writes to stderr; nothing is printed via OUT.
  const result = runCaptured(["thread", "create"], cwd);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
});

test("runCaptured does not write to real stdout while it is buffering", () => {
  const cwd = freshStore();
  const realWrite = process.stdout.write.bind(process.stdout);
  let escaped = "";
  // Monkey-patch process.stdout.write so any byte that bypasses OUT is observed.
  // A bare process.stdout.write inside a CLI handler is a JSON-RPC corruption
  // bug under MCP; this test is the trip-wire that catches it before it ships.
  process.stdout.write = (chunk, ...rest) => {
    escaped += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  };
  try {
    const result = runCaptured(["init"], cwd);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, "captured stdout should not be empty");
  } finally {
    process.stdout.write = realWrite;
  }
  assert.equal(escaped, "", `runCaptured leaked to real stdout: ${escaped}`);
});

test("runCaptured restores OUT and exitCode for the next default-mode call", () => {
  // Two back-to-back captures must each see their own buffer (no carry-over)
  // and must not leave process.exitCode set for an unrelated caller.
  const cwd = freshStore();
  process.exitCode = 0;
  runCaptured(["init"], cwd);
  const second = runCaptured(["validate"], cwd);
  assert.equal(second.exitCode, 0);
  assert.equal(JSON.parse(second.stdout).valid, true);
  assert.ok(!process.exitCode, "process.exitCode should not have leaked");
});

test("runCaptured renders decision summary text via OUT (no stdout collision)", () => {
  const cwd = freshStore();
  runCaptured(["init"], cwd);
  // Use the committed hermes-ingest example log so we exercise the text-format
  // branch of decisionSummary, which previously called process.stdout.write
  // directly and would have escaped the capture sink before the OUT seam.
  const events = path.resolve(__dirname, "..", "examples", "hermes-ingest", "events.ndjson");
  const result = runCaptured(["decision", "summary", "--events", events, "--format", "text"], cwd);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /## What was decided/);
  assert.ok(result.stdout.endsWith("\n"));
});
