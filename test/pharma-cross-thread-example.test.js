// pharma-cross-thread-example.test.js — guards the multi-arm pharma phase-gate
// example and the verify-cross-thread provenance check.
//
// The bug this example originally shipped with: the parent's
// CrossThreadEvidence.sourceEventHash pointed at each arm's LAST event, which
// for arms ending in a MinorityReportFiled was not the DecisionMerged event the
// reference named. Four of six cross-thread items were mis-anchored. These
// tests assert the hashes now resolve to the real arm decisions, and that the
// verify-cross-thread command both confirms a clean chain and catches tampering.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const exDir = path.join(root, "examples", "pharma-phase-gate-multithreaded");
const parent = path.join(exDir, "parent-go-nogo.ndjson");
const arms = [
  "arm-pkpd-modeling.ndjson",
  "arm-safety-assessment.ndjson",
  "arm-subgroup-review.ndjson",
  "arm-regulatory-strategy.ndjson"
].map((f) => path.join(exDir, f));

function runCli(args, { expectStatus = 0 } = {}) {
  const result = spawnSync("node", [cliPath, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, expectStatus, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("all five pharma threads validate clean independently", () => {
  for (const file of [parent, ...arms]) {
    assert.equal(runCli(["validate", "--events", file]).valid, true, `${path.basename(file)} should validate`);
  }
});

test("verify-cross-thread confirms every cross-thread item against its arm decision", () => {
  const armArgs = arms.flatMap((a) => ["--arm", a]);
  const report = runCli(["verify-cross-thread", "--parent", parent, ...armArgs]);
  assert.equal(report.valid, true);
  assert.equal(report.summary.total, 6, "six cross-thread evidence items");
  assert.equal(report.summary.verified, 6, "all six anchor on a real DecisionMerged");
  assert.equal(report.summary.mismatch, 0);
  assert.equal(report.summary.skipped, 0);
});

test("verify-cross-thread with a single arm verifies its items and skips the rest", () => {
  const safety = arms.find((a) => a.includes("safety"));
  const report = runCli(["verify-cross-thread", "--parent", parent, "--arm", safety]);
  assert.equal(report.valid, true);
  assert.equal(report.summary.verified, 2, "two items cite the safety arm decision");
  assert.equal(report.summary.skipped, 4, "the other arms' items are unverified, not failed");
});

test("verify-cross-thread fails and exits non-zero when a sourceEventHash is tampered", () => {
  const safety = arms.find((a) => a.includes("safety"));
  const raw = fs.readFileSync(parent, "utf8");
  const tampered = raw.replace(/("sourceEventHash":"sha256:)([0-9a-f])/g, (_m, p1, d) => `${p1}${d === "a" ? "b" : "a"}`);
  assert.notEqual(tampered, raw, "test should have mutated at least one hash");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clista-cte-"));
  const badParent = path.join(dir, "parent-tampered.ndjson");
  fs.writeFileSync(badParent, tampered);
  try {
    const report = runCli(["verify-cross-thread", "--parent", badParent, "--arm", safety], { expectStatus: 1 });
    assert.equal(report.valid, false);
    assert.ok(report.summary.mismatch >= 1, "tampered hashes must be reported as mismatches");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
