const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  EVENT_HASH_VERSION,
  EVENT_HASH_VERSION_V2,
  chainEvents,
  computeEventHash,
  prepareEventForAppend,
  verifyEventIntegrity,
  verifyEventSuffix
} = require("../src/integrity");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");

function baseEvents(hashVersion) {
  return [
    { event_id: "evt_1", event_type: "ThreadCreated", thread_id: "thd_v2", actor_id: "troy", timestamp: "2026-07-07T00:00:01.000Z", payload: { thread: { id: "thd_v2" } }, hash_version: hashVersion },
    { event_id: "evt_2", event_type: "EvidenceCommitted", thread_id: "thd_v2", actor_id: "troy", timestamp: "2026-07-07T00:00:02.000Z", payload: { evidence: { finding: "a" } }, hash_version: hashVersion },
    { event_id: "evt_3", event_type: "AssumptionDeclared", thread_id: "thd_v2", actor_id: "troy", timestamp: "2026-07-07T00:00:03.000Z", payload: { assumption: { text: "b" } }, hash_version: hashVersion },
    { event_id: "evt_4", event_type: "ClaimMade", thread_id: "thd_v2", actor_id: "troy", timestamp: "2026-07-07T00:00:04.000Z", payload: { claim: { text: "c" } }, hash_version: hashVersion }
  ];
}

test("v2 chain passes strict integrity verification", () => {
  const events = chainEvents(baseEvents(EVENT_HASH_VERSION_V2));
  const report = verifyEventIntegrity(events, { strict: true });

  assert.equal(report.valid, true, JSON.stringify(report.reasons));
  assert.equal(events[0].hash_version, EVENT_HASH_VERSION_V2);
  assert.equal(events[0].previous_hash, undefined);
  for (let i = 1; i < events.length; i += 1) {
    assert.equal(events[i].previous_hash, events[i - 1].content_hash);
  }
});

test("v2 content_hash commits to previous_hash; v1 does not", () => {
  const base = { event_id: "evt_x", event_type: "ClaimMade", thread_id: "thd_v2", actor_id: "troy", timestamp: "2026-07-07T00:00:09.000Z", payload: { claim: { text: "same" } } };
  const prevA = `sha256:${"a".repeat(64)}`;
  const prevB = `sha256:${"b".repeat(64)}`;

  // v2: differing predecessors produce differing content_hash (transitive commitment).
  const v2a = prepareEventForAppend({ ...base, hash_version: EVENT_HASH_VERSION_V2 }, prevA);
  const v2b = prepareEventForAppend({ ...base, hash_version: EVENT_HASH_VERSION_V2 }, prevB);
  assert.notEqual(v2a.content_hash, v2b.content_hash);

  // v1: previous_hash is excluded from material, so the head is not a chain commitment.
  const v1a = prepareEventForAppend({ ...base, hash_version: EVENT_HASH_VERSION }, prevA);
  const v1b = prepareEventForAppend({ ...base, hash_version: EVENT_HASH_VERSION }, prevB);
  assert.equal(v1a.content_hash, v1b.content_hash);
});

test("head-anchored suffix verifies against the head alone under v2", () => {
  const full = chainEvents(baseEvents(EVENT_HASH_VERSION_V2));
  const split = 2;
  const prefix = full.slice(0, split);
  const suffix = full.slice(split);
  const headHash = prefix.at(-1).content_hash;

  const result = verifyEventSuffix(headHash, suffix);
  assert.equal(result.valid, true, JSON.stringify(result.reasons));
  assert.equal(result.anchorHash, headHash);
  assert.equal(result.suffixCount, suffix.length);
  assert.equal(result.headHash, full.at(-1).content_hash);
});

test("suffix verification rejects a suffix anchored to the wrong head", () => {
  const full = chainEvents(baseEvents(EVENT_HASH_VERSION_V2));
  const suffix = full.slice(2);
  const wrongHead = `sha256:${"c".repeat(64)}`;

  const result = verifyEventSuffix(wrongHead, suffix);
  assert.equal(result.valid, false);
  assert.match(JSON.stringify(result.reasons), /suffix does not chain to anchor head/);
});

test("suffix verification rejects v1 events as unsound", () => {
  const full = chainEvents(baseEvents(EVENT_HASH_VERSION));
  const headHash = full[1].content_hash;
  const suffix = full.slice(2);

  const result = verifyEventSuffix(headHash, suffix);
  assert.equal(result.valid, false);
  assert.match(JSON.stringify(result.reasons), /requires hash_version clista\.event_hash\.v2/);
});

test("prefix tampering changes the head, so the old head no longer anchors the suffix", () => {
  const full = chainEvents(baseEvents(EVENT_HASH_VERSION_V2));
  const originalHead = full[1].content_hash;
  const suffix = full.slice(2);

  // Suffix is honest against the true head.
  assert.equal(verifyEventSuffix(originalHead, suffix).valid, true);

  // Tamper an event in the prefix and re-chain. Under v2 the head moves.
  const tampered = baseEvents(EVENT_HASH_VERSION_V2);
  tampered[0].payload.thread.id = "thd_tampered";
  const rechained = chainEvents(tampered);
  const tamperedHead = rechained[1].content_hash;
  assert.notEqual(tamperedHead, originalHead);

  // The suffix (sealed against the original head) fails against the tampered head.
  const result = verifyEventSuffix(tamperedHead, suffix);
  assert.equal(result.valid, false);
  assert.match(JSON.stringify(result.reasons), /suffix does not chain to anchor head/);
});

test("computeEventHash routes v2 through v2 material", () => {
  const event = prepareEventForAppend({ ...baseEvents(EVENT_HASH_VERSION_V2)[0] }, `sha256:${"d".repeat(64)}`);
  assert.equal(event.content_hash, computeEventHash(event));
});

test("integrity verify-suffix CLI round trips against the head", () => {
  const full = chainEvents(baseEvents(EVENT_HASH_VERSION_V2));
  const headHash = full[1].content_hash;
  const suffix = full.slice(2);

  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-suffix-"));
  const suffixLog = path.join(cwd, "suffix.ndjson");
  writeFileSync(suffixLog, `${suffix.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

  const ok = spawnSync("node", [cliPath, "integrity", "verify-suffix", "--anchor", headHash, "--events", suffixLog], {
    cwd: root,
    encoding: "utf8"
  });
  const okOut = JSON.parse(ok.stdout);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(okOut.valid, true);
  assert.equal(okOut.headHash, full.at(-1).content_hash);

  const wrongHead = `sha256:${"e".repeat(64)}`;
  const bad = spawnSync("node", [cliPath, "integrity", "verify-suffix", "--anchor", wrongHead, "--events", suffixLog], {
    cwd: root,
    encoding: "utf8"
  });
  const badOut = JSON.parse(bad.stdout);
  assert.equal(bad.status, 1);
  assert.equal(badOut.valid, false);
});
