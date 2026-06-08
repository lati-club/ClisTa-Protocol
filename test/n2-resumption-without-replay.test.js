// N2 — resumption without replay.
//
// A successor may treat a thread's reasoning state as settled, and resume from
// it, using only the verified continuity packet — not the transcript. Exercised
// on the Hermes adapter example, whose own input *is* a transcript, so this is
// exactly the prompt-vs-protocol comparison: the protocol resumes from the
// artifact; the transcript is never consulted.

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const events = "examples/hermes-ingest/events.ndjson";

function cli(args, opts = {}) {
  const result = spawnSync("node", ["src/cli.js", ...args], { cwd: root, encoding: "utf8" });
  if (!opts.allowFailure) {
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  return JSON.parse(result.stdout);
}

function exportPacket() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "clista-n2-"));
  const packet = path.join(dir, "packet.json");
  const out = cli(["continuity", "export", "--events", events, "--out", packet]);
  assert.equal(out.resume_status, "verified", "export must verify from the event log");
  return packet;
}

test("a successor resumes settled state from the packet alone — no transcript", () => {
  const packet = exportPacket();

  // From the packet only (no --events, no session transcript):
  const verification = cli(["continuity", "verify", "--packet", packet]);
  assert.equal(verification.valid, true);

  const summary = cli(["continuity", "summary", "--packet", packet]);
  assert.equal(summary.resume_status, "verified");
  assert.equal(summary.status, "decided");
  assert.ok(summary.current_decision, "the settled decision is carried by the packet");
  // Dissent survives the handoff: the privacy objection is still visible.
  assert.equal(summary.open_objection_ids.length, 1);

  const resume = cli(["continuity", "resume", "--packet", packet]);
  assert.equal(resume.resumed, true);
});

test("a tampered packet does not report verified — context transfer != memory trust", () => {
  const packet = exportPacket();
  const data = JSON.parse(readFileSync(packet, "utf8"));

  // Flip the settled state without re-deriving its hash: a successor must not
  // trust transferred state that no longer matches its verification.
  data.continuity_state.status = "open";
  writeFileSync(packet, JSON.stringify(data, null, 2));

  const verification = cli(["continuity", "verify", "--packet", packet], { allowFailure: true });
  assert.equal(verification.valid, false, "tampered packet must fail verification");
});
