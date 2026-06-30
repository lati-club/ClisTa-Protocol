// cross-thread-provenance.test.js — engine-level unit coverage for
// verifyCrossThreadProvenance, the pure cross-file check that both the CLI
// (verify-cross-thread) and the app's example sync depend on. Drives the
// function directly with synthetic events (no files) so the four outcomes —
// verified / mismatch / decision_not_found / skipped — are pinned independent
// of any example fixture.
const assert = require("node:assert/strict");
const test = require("node:test");

const { verifyCrossThreadProvenance } = require("../src/provenance");

function decisionMerged(threadId, recordId, contentHash) {
  return {
    event_id: `evt_decisionmerged_${recordId}`,
    event_type: "DecisionMerged",
    thread_id: threadId,
    content_hash: contentHash,
    payload: { decisionRecord: { id: recordId, object: "decisionRecord", threadId } }
  };
}

function crossThreadEvidence(parentThreadId, { id, sourceThreadId, sourceDecisionRecordId, sourceEventHash, derivation = "decision_output" }) {
  return {
    event_id: `evt_crossthreadevidence_${id}`,
    event_type: "CrossThreadEvidence",
    thread_id: parentThreadId,
    payload: {
      crossThreadEvidence: { id, object: "crossThreadEvidence", threadId: parentThreadId, sourceThreadId, sourceDecisionRecordId, sourceEventHash, derivation }
    }
  };
}

const ARM = "thd_arm";
const PARENT = "thd_parent";
const armLog = [decisionMerged(ARM, "dcr_arm", "sha256:aaa")];

test("verified when the cited hash matches the arm DecisionMerged", () => {
  const parent = [crossThreadEvidence(PARENT, { id: "cte_ok", sourceThreadId: ARM, sourceDecisionRecordId: "dcr_arm", sourceEventHash: "sha256:aaa" })];
  const report = verifyCrossThreadProvenance(parent, [armLog]);
  assert.equal(report.valid, true);
  assert.equal(report.summary.verified, 1);
  assert.equal(report.results[0].status, "verified");
  assert.equal(report.results[0].sourceEventId, "evt_decisionmerged_dcr_arm");
});

test("mismatch (valid:false) when the cited hash does not match", () => {
  const parent = [crossThreadEvidence(PARENT, { id: "cte_bad", sourceThreadId: ARM, sourceDecisionRecordId: "dcr_arm", sourceEventHash: "sha256:zzz" })];
  const report = verifyCrossThreadProvenance(parent, [armLog]);
  assert.equal(report.valid, false);
  assert.equal(report.summary.mismatch, 1);
  assert.equal(report.results[0].status, "mismatch");
  assert.equal(report.results[0].expectedHash, "sha256:aaa");
});

test("decision_not_found (valid:false) when the arm lacks the cited record", () => {
  const parent = [crossThreadEvidence(PARENT, { id: "cte_dangling", sourceThreadId: ARM, sourceDecisionRecordId: "dcr_missing", sourceEventHash: "sha256:aaa" })];
  const report = verifyCrossThreadProvenance(parent, [armLog]);
  assert.equal(report.valid, false);
  assert.equal(report.summary.decisionNotFound, 1);
  assert.equal(report.results[0].status, "decision_not_found");
});

test("skipped (does not fail) when the source thread is not among the provided arms", () => {
  const parent = [crossThreadEvidence(PARENT, { id: "cte_other", sourceThreadId: "thd_other_arm", sourceDecisionRecordId: "dcr_arm", sourceEventHash: "sha256:aaa" })];
  const report = verifyCrossThreadProvenance(parent, [armLog]);
  assert.equal(report.valid, true, "an unverified cross-arm reference is not a failure");
  assert.equal(report.summary.skipped, 1);
  assert.equal(report.results[0].status, "skipped");
});

test("indexes DecisionMerged across multiple arm logs and ignores non-CTE events", () => {
  const arm2 = [decisionMerged("thd_arm2", "dcr_arm2", "sha256:bbb")];
  const parent = [
    { event_type: "EvidenceCommitted", thread_id: PARENT, payload: { evidence: { id: "evd_local" } } },
    crossThreadEvidence(PARENT, { id: "cte_1", sourceThreadId: ARM, sourceDecisionRecordId: "dcr_arm", sourceEventHash: "sha256:aaa" }),
    crossThreadEvidence(PARENT, { id: "cte_2", sourceThreadId: "thd_arm2", sourceDecisionRecordId: "dcr_arm2", sourceEventHash: "sha256:bbb", derivation: "minority_report" })
  ];
  const report = verifyCrossThreadProvenance(parent, [armLog, arm2]);
  assert.equal(report.valid, true);
  assert.equal(report.summary.total, 2, "only the two CrossThreadEvidence events are checked");
  assert.equal(report.summary.verified, 2);
});
