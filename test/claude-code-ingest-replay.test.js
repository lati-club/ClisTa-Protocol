const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const exampleDir = path.join(root, "examples", "claude-code-ingest");
const events = path.join("examples", "claude-code-ingest", "events.ndjson");

function cli(...args) {
  const result = spawnSync("node", ["src/cli.js", ...args], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("claude-code-ingest profile re-ingests byte-identical to the committed log", { skip: !pythonAvailable() }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clista-cc-replay-"));
  const out = path.join(tmp, "replay.ndjson");
  const ingest = spawnSync("python3", [
    "src/ingest_session.py", "--profile", "claude-code",
    "--input", path.join("examples", "claude-code-ingest", "session.jsonl"),
    "--output", out
  ], { cwd: root, encoding: "utf8" });
  assert.equal(ingest.status, 0, ingest.stderr || ingest.stdout);
  // The byte-identical replay is the M33 determinism contract: ids derive
  // from normalized message content (not the raw provider blob), so the
  // same session always produces the same chained log.
  const replay = fs.readFileSync(out, "utf8");
  const committed = fs.readFileSync(path.join(exampleDir, "events.ndjson"), "utf8");
  assert.equal(replay, committed, "regenerated claude-code log differs from committed log");
});

test("claude-code-ingest example log is accepted by the engine", () => {
  const result = cli("validate", "--events", events);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("claude-code-ingest decision summary matches the committed expected answer view", () => {
  const summary = cli("decision", "summary", "--events", events);
  const expected = JSON.parse(
    fs.readFileSync(path.join(exampleDir, "expected-summary.json"), "utf8")
  );
  assert.deepEqual(summary, expected);
});

function pythonAvailable() {
  const r = spawnSync("python3", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}
