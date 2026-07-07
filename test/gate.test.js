const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runCaptured } = require("../src/cli.js");

function freshStore() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clista-gate-"));
}

function run(cwd, argv) {
  const result = runCaptured(argv, cwd);
  return JSON.parse(result.stdout);
}

function logLength(cwd) {
  return fs
    .readFileSync(path.join(cwd, ".clista", "events.ndjson"), "utf8")
    .trim()
    .split("\n").length;
}

function bootstrapThread() {
  const cwd = freshStore();
  const thread = run(cwd, ["thread", "create", "--title", "Gate test thread", "--question", "Should this ship?"]);
  const threadId = thread.thread.id;
  const evidence = run(cwd, [
    "evidence", "commit",
    "--thread", threadId,
    "--source", "unit test",
    "--finding", "real evidence",
    "--tags", "smoke,gate"
  ]);
  const assumption = run(cwd, [
    "assumption", "declare",
    "--thread", threadId,
    "--text", "real assumption",
    "--evidence", evidence.evidence.id,
    "--tags", "smoke"
  ]);
  return { cwd, threadId, evidenceId: evidence.evidence.id, assumptionId: assumption.assumption.id };
}

test("decision propose: golden path appends a validated DecisionRequestOpened", () => {
  const { cwd, threadId, evidenceId, assumptionId } = bootstrapThread();
  const before = logLength(cwd);

  const result = run(cwd, [
    "decision", "propose",
    "--thread", threadId,
    "--proposal", "Ship it",
    "--evidence", evidenceId,
    "--assumptions", assumptionId
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.event.event_type, "DecisionRequestOpened");
  assert.deepEqual(result.decisionRequest.supportingEvidenceIds, [evidenceId]);
  assert.equal(logLength(cwd), before + 1);

  const validated = run(cwd, ["validate"]);
  assert.equal(validated.valid, true);
});

test("decision propose: structural gate rejects empty evidence and assumption slots without appending", () => {
  const { cwd, threadId } = bootstrapThread();
  const before = logLength(cwd);

  const result = run(cwd, ["decision", "propose", "--thread", threadId, "--proposal", "Ship it with nothing"]);

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.some((e) => e.reason.includes("supportingEvidenceIds")));
  assert.ok(result.errors.some((e) => e.reason.includes("supportingAssumptionIds")));
  assert.equal(logLength(cwd), before, "a structurally incomplete proposal must not be appended");
});

test("decision propose: existential check rejects a hallucinated pointer using the engine's own validateEvents", () => {
  const { cwd, threadId, assumptionId } = bootstrapThread();
  const before = logLength(cwd);

  const result = run(cwd, [
    "decision", "propose",
    "--thread", threadId,
    "--proposal", "Ship it",
    "--evidence", "evd_totally_made_up_ffffffff",
    "--assumptions", assumptionId
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].reason, /evidence reference does not exist: evd_totally_made_up_ffffffff/);
  assert.equal(logLength(cwd), before, "a hallucinated pointer must not be appended");
});

test("decision propose: pre-existing log corruption is reported distinctly from a valid new proposal", () => {
  const { cwd, threadId, evidenceId, assumptionId } = bootstrapThread();

  // Corrupt the thread via an unguarded command: objection raise does not
  // check that its target actually exists before appending.
  run(cwd, [
    "objection", "raise",
    "--thread", threadId,
    "--participant", "Reviewer",
    "--target", "clm_never_created",
    "--target-type", "claim",
    "--text", "bogus target"
  ]);

  const validateBefore = run(cwd, ["validate"]);
  assert.equal(validateBefore.valid, false, "test setup assumption: the log must already be broken");

  const before = logLength(cwd);
  const result = run(cwd, [
    "decision", "propose",
    "--thread", threadId,
    "--proposal", "Ship it",
    "--evidence", evidenceId,
    "--assumptions", assumptionId
  ]);

  assert.equal(result.valid, false);
  assert.ok(result.note, "expected a note distinguishing pre-existing corruption from the new proposal");
  assert.match(result.note, /already invalid/);
  assert.ok(result.errors.some((e) => e.event_type === "ObjectionRaised"));
  assert.ok(!result.errors.some((e) => e.event_type === "DecisionRequestOpened"));
  assert.equal(logLength(cwd), before, "nothing should be appended on top of an already-broken log");
});

test("evidence list and assumptions list filter by --tag, and omit nothing when no filter is given", () => {
  const { cwd, threadId, evidenceId, assumptionId } = bootstrapThread();
  run(cwd, [
    "evidence", "commit",
    "--thread", threadId,
    "--source", "unit test",
    "--finding", "second evidence, different tag",
    "--tags", "other-tag"
  ]);

  const allEvidence = run(cwd, ["evidence", "list", "--thread", threadId]);
  assert.equal(allEvidence.length, 2);

  const filtered = run(cwd, ["evidence", "list", "--thread", threadId, "--tag", "smoke"]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, evidenceId);

  const filteredAssumptions = run(cwd, ["assumptions", "list", "--thread", threadId, "--tag", "smoke"]);
  assert.equal(filteredAssumptions.length, 1);
  assert.equal(filteredAssumptions[0].id, assumptionId);

  const noMatch = run(cwd, ["evidence", "list", "--thread", threadId, "--tag", "nonexistent-tag"]);
  assert.deepEqual(noMatch, []);
});

test("evidence list keeps surfacing untagged-narrowing-immune evidence after a decision request exists", () => {
  const { cwd, threadId, evidenceId, assumptionId } = bootstrapThread();
  const second = run(cwd, [
    "evidence", "commit",
    "--thread", threadId,
    "--source", "s2",
    "--finding", "not cited by any decision",
    "--tags", "smoke"
  ]);

  const proposed = run(cwd, [
    "decision", "propose",
    "--thread", threadId,
    "--proposal", "Ship it",
    "--evidence", evidenceId,
    "--assumptions", assumptionId
  ]);
  assert.equal(proposed.valid, true);

  const listed = run(cwd, ["evidence", "list", "--thread", threadId, "--tag", "smoke"]);
  assert.equal(listed.length, 2, "evidence list must not narrow to only what the decision request cited");
  assert.ok(listed.some((e) => e.id === second.evidence.id));
});
