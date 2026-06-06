const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");

test("CLI reconstructs reasoning to decision to outcomes to score from the event log", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-outcomes-"));

  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_outcomes",
    "--title",
    "Outcome Thread",
    "--question",
    "Did the decision survive contact with reality?",
    "--participant",
    "Troy:decision owner"
  ]);
  runCli(cwd, [
    "evidence",
    "commit",
    "--id",
    "evd_logistics",
    "--thread",
    "thd_outcomes",
    "--source",
    "Launch plan",
    "--finding",
    "Logistics capacity was expected to support the launch."
  ]);
  runCli(cwd, [
    "assumption",
    "declare",
    "--id",
    "asm_logistics_capacity",
    "--thread",
    "thd_outcomes",
    "--text",
    "Logistics capacity will support Q4 Europe growth.",
    "--evidence",
    "evd_logistics"
  ]);
  runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_enter_europe",
    "--thread",
    "thd_outcomes",
    "--text",
    "Entering Europe in Q4 should grow revenue.",
    "--evidence",
    "evd_logistics",
    "--assumptions",
    "asm_logistics_capacity"
  ]);
  runCli(cwd, [
    "decision",
    "open",
    "--id",
    "drq_enter_europe_q4",
    "--thread",
    "thd_outcomes",
    "--proposal",
    "Enter Europe in Q4.",
    "--evidence",
    "evd_logistics",
    "--claims",
    "clm_enter_europe",
    "--assumptions",
    "asm_logistics_capacity"
  ]);
  runCli(cwd, [
    "review",
    "submit",
    "--id",
    "rev_enter_europe",
    "--thread",
    "thd_outcomes",
    "--request",
    "drq_enter_europe_q4",
    "--reviewer",
    "Troy",
    "--status",
    "approve"
  ]);
  runCli(cwd, [
    "decision",
    "merge",
    "--id",
    "dcr_enter_europe_q4",
    "--thread",
    "thd_outcomes",
    "--request",
    "drq_enter_europe_q4",
    "--decider",
    "Troy"
  ]);
  runCli(cwd, [
    "outcome",
    "expect",
    "--id",
    "exo_revenue_growth",
    "--thread",
    "thd_outcomes",
    "--decision",
    "dcr_enter_europe_q4",
    "--metric",
    "revenue_growth",
    "--operator",
    ">",
    "--target",
    "0.15",
    "--review-date",
    "2027-03-01",
    "--assumptions",
    "asm_logistics_capacity",
    "--evidence",
    "evd_logistics",
    "--description",
    "Revenue growth should exceed 15%."
  ]);
  runCli(cwd, [
    "outcome",
    "audit",
    "--id",
    "out_revenue_growth",
    "--thread",
    "thd_outcomes",
    "--expected",
    "exo_revenue_growth",
    "--actual",
    "0.08",
    "--result",
    "failed",
    "--summary",
    "Revenue growth was 8%, below the 15% target.",
    "--failed-assumptions",
    "asm_logistics_capacity",
    "--failed-evidence",
    "evd_logistics",
    "--auditor",
    "Troy"
  ]);
  runCli(cwd, [
    "decision",
    "score",
    "--id",
    "dsc_enter_europe_q4",
    "--thread",
    "thd_outcomes",
    "--decision",
    "dcr_enter_europe_q4",
    "--score",
    "0.4",
    "--status",
    "failed",
    "--rationale",
    "Expected growth was not met because logistics assumptions failed.",
    "--audits",
    "out_revenue_growth",
    "--scorer",
    "Troy"
  ]);

  const validation = runCli(cwd, ["validate"]);
  const state = runCli(cwd, ["state", "show", "--thread", "thd_outcomes"]);

  assert.deepEqual(validation, { valid: true, errors: [] });
  assert.equal(state.reasoningState.decision.id, "dcr_enter_europe_q4");
  assert.equal(state.reasoningState.expected_outcomes[0].metric, "revenue_growth");
  assert.equal(state.reasoningState.expected_outcomes[0].reviewDate, "2027-03-01");
  assert.equal(state.reasoningState.outcome_audits[0].actual, 0.08);
  assert.equal(state.reasoningState.outcome_audits[0].result, "failed");
  assert.equal(state.reasoningState.failed_assumptions[0].id, "asm_logistics_capacity");
  assert.equal(state.reasoningState.failed_evidence[0].id, "evd_logistics");
  assert.equal(state.reasoningState.outcome_status, "failed");
  assert.equal(state.reasoningState.decision_score.score, 0.4);
  assert.equal(state.outcomeState.score, 0.4);
});

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
