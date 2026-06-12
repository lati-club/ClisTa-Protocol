// clista-csv-cli-example.test.js — guards the Octopus + ThreadHub + ClisTa
// running example. These are the seams that drifted silently before: the
// combined log once failed `validate` while everyone believed it was clean,
// and nothing checked that the ThreadHub record hashes ClisTa cites actually
// resolve. Both are asserted here.
//
// The hub-resolvability test skips cleanly when no ThreadHub is reachable
// (set THREADHUB_URL, default http://127.0.0.1:7777), so CI without a hub
// still runs the self-contained checks.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const csvLog = path.join(root, "examples", "clista-csv-cli-build.ndjson");
const TID = "thd_csv_cli_build_consensus_mqa0yqno_95493e23";
const HUB = (process.env.THREADHUB_URL || "http://127.0.0.1:7777").replace(/\/$/, "");
const SHA = /^sha256:[0-9a-f]{64}$/;

// #1 — the regression guard for the bug we shipped this example with: a log
// that failed validation and didn't project. runCli asserts exit 0, so a
// non-validating log fails here.
test("CSV CLI example validates clean and projects the expected governance state", () => {
  assert.equal(runCli(["validate", "--events", csvLog]).valid, true);

  const state = runCli(["state", "show", "--thread", TID, "--events", csvLog]);
  assert.ok(!("error" in state), `projection carried an error: ${state.error}`);
  const rs = state.reasoningState;
  assert.equal(rs.claims.length, 4, "4 claims");
  assert.equal(rs.evidence.length, 5, "foundation + 4 live evidence (incl. error-handling)");
  assert.equal(rs.assumptions.length, 1, "1 supporting assumption");
  assert.equal(rs.positions.length, 2, "2 positions");
  assert.equal(rs.decision.status, "approved", "decision approved");
  assert.equal(rs.delegation.grants.length, 3, "one delegation per build arm");
  assert.equal(rs.execution.records.length, 3, "3 delegated executions");
});

// #2a — cross-link present (self-contained): every live octo-build evidence
// must cite at least one well-formed ThreadHub record hash.
test("each live evidence cites a well-formed ThreadHub record hash", () => {
  const live = liveEvidence();
  assert.ok(live.length >= 1, "expected at least one live octo-build evidence");
  for (const ev of live) {
    const hashes = (ev.payload.evidence.artifactIds || []).filter((h) => SHA.test(h));
    assert.ok(hashes.length >= 1, `${ev.event_id} must cite a sha256 record hash`);
  }
});

// #2b — cross-link intact (needs the hub): each cited hash resolves to a real
// ObjectionRaised record living in the octo-build thread. A dangling link
// passes validate + verify independently but breaks the integration story.
test("cited ThreadHub record hashes resolve to octo-build records", async (t) => {
  if (!(await hubUp())) {
    t.skip(`ThreadHub not reachable at ${HUB}`);
    return;
  }
  const octo = await getJson(`${HUB}/t/octo-build/verify`);
  const hashes = citedHashes();
  assert.ok(hashes.length >= 1, "expected cited record hashes");
  for (const h of hashes) {
    const res = await fetch(`${HUB}/r/${h}`);
    assert.equal(res.status, 200, `record ${h} should resolve on the hub`);
    const rec = await res.json();
    assert.equal(rec.thread, octo.thread, `${h} should live in octo-build`);
    assert.equal(rec.payload.event_type, "ObjectionRaised", `${h} should be a cascade-block`);
  }
});

// #3 — N2: the example resumes from a continuity packet alone, and because the
// log is hash-chained it resumes "verified" (strict), not degraded.
test("the example resumes cleanly without replay (N2 continuity)", () => {
  const pkt = path.join(os.tmpdir(), `csv-cont-${process.pid}-${Date.now()}.json`);
  runCli(["continuity", "export", "--events", csvLog, "--thread", TID, "--out", pkt]);
  const v = runCli(["continuity", "verify", "--packet", pkt]);
  assert.equal(v.valid, true);
  assert.equal(v.resumeStatus, "verified", "hash-chained example should resume verified, not degraded");
  fs.rmSync(pkt, { force: true });
});

// ---- helpers ----
function runCli(args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function readEvents() {
  return fs.readFileSync(csvLog, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function liveEvidence() {
  return readEvents().filter(
    (e) => e.event_type === "EvidenceCommitted" && /octo-build/.test(e.payload?.evidence?.source || "")
  );
}

function citedHashes() {
  return [...new Set(liveEvidence().flatMap((e) => e.payload.evidence.artifactIds || []))].filter((h) => SHA.test(h));
}

async function hubUp() {
  try {
    const res = await fetch(`${HUB}/`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function getJson(url) {
  const res = await fetch(url);
  assert.equal(res.status, 200, `GET ${url}`);
  return res.json();
}
