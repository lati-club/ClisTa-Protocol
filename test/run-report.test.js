const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const scenario = "examples/scenario-demo/events.ndjson";

function runReport(args = []) {
  return spawnSync("node", ["src/cli.js", "run", "report", ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

test("run report validates a completed log and prints where to send it", () => {
  const result = runReport(["--events", scenario]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);

  assert.equal(report.schema, "clista.run.report.v0");
  assert.equal(report.valid, true);
  // trusted:false stays the default: structure is validated, content is not endorsed.
  assert.equal(report.trusted, false);
  assert.equal(report.reportable, true);

  // The report carries the projected decision shape (what / why / who dissented).
  assert.ok(report.decisionSummary, "decision summary is included");
  assert.equal(report.decisionSummary.schema, "clista.decisionSummary.v0");

  // It tells the runner EXACTLY where and how to report.
  assert.match(report.submit.issueTitle, /^External run report: /);
  // A one-click prefilled issue URL serves the markdown-default runner who never
  // touches the engine — the title and an artifact checklist are baked into the link.
  assert.match(report.submit.issueUrl, /^https:\/\/github\.com\/lati-club\/ClisTa-Protocol\/issues\/new\?title=/);
  assert.match(report.submit.issueUrl, /failures\.md/);
  assert.equal(report.submit.deadline, "2026-09-07");
  assert.match(report.submit.url, /github\.com\/lati-club\/ClisTa-Protocol/);
  assert.equal(report.submit.emailFallback, "lati@clista.ai");
  assert.ok(
    report.submit.include.some((item) => /failures\.md/.test(item)),
    "reminds the runner to include failures.md"
  );
  assert.ok(
    report.submit.include.some((item) => /cost\.md/.test(item)),
    "reminds the runner to include cost.md"
  );
});

test("run report fails closed on an invalid log and exits nonzero", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clista-run-report-"));
  const bad = path.join(dir, "bad.ndjson");
  // Missing the shared envelope (event_id, thread_id, actor_id, timestamp).
  fs.writeFileSync(bad, '{"event_type":"Bogus"}\n');

  const result = runReport(["--events", bad]);
  assert.equal(result.status, 1, result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schema, "clista.run.report.v0");
  assert.equal(report.valid, false);
  assert.equal(report.trusted, false);
  assert.equal(report.reportable, false);
  assert.ok(Array.isArray(report.errors) && report.errors.length > 0);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("run report output is deterministic for the same events", () => {
  const a = runReport(["--events", scenario]);
  const b = runReport(["--events", scenario]);
  assert.equal(a.status, 0);
  assert.equal(b.status, 0);
  // No wall-clock timestamps leak into the printed report.
  assert.equal(a.stdout, b.stdout, "same events produce byte-identical report output");
});

test("run report --out writes a portable submission bundle", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clista-run-report-"));
  const out = path.join(dir, "bundle.json");

  const result = runReport(["--events", scenario, "--out", out]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.bundle.written, true);

  assert.ok(fs.existsSync(out), "bundle file is written");
  const bundle = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(bundle.schema, "clista.protocol.v0");
  assert.ok(Array.isArray(bundle.events) && bundle.events.length > 0);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("run report --title overrides the issue title", () => {
  const result = runReport(["--events", scenario, "--title", "Should we adopt Postgres"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.submit.issueTitle, "External run report: Should we adopt Postgres");
});
