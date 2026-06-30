const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const scenarioLog = path.join(root, "examples", "scenario-demo", "events.ndjson");

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

function freshStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-arity-"));
  runCli(cwd, ["init"]);
  return cwd;
}

test("a repeated scalar option is rejected (was silently turned into an array)", () => {
  const cwd = freshStore();
  const { status, out } = runCli(cwd, [
    "thread", "create", "--title", "First", "--title", "Second", "--question", "Q"
  ]);
  assert.notEqual(status, 0);
  assert.match(out, /Option --title may only be given once/);
});

test("a legitimately repeatable option is still accepted", () => {
  const cwd = freshStore();
  const { status, out } = runCli(cwd, [
    "thread", "create", "--title", "T", "--question", "Q",
    "--participant", "par_alice:Alice:reviewer",
    "--participant", "par_bob:Bob:reviewer"
  ]);
  assert.equal(status, 0, out);
});

test("a missing required option still reports as missing (presence, not truthiness)", () => {
  const cwd = freshStore();
  const { status, out } = runCli(cwd, ["thread", "create", "--question", "Q"]);
  assert.notEqual(status, 0);
  assert.match(out, /Missing required option --title/);
});

test("a repeated coerced (boolean) option is rejected via the accessor guard", () => {
  const cwd = freshStore();
  const { status, out } = runCli(cwd, [
    "validate", "--events", scenarioLog, "--strict", "--strict"
  ]);
  assert.notEqual(status, 0);
  assert.match(out, /may only be given once/);
});
