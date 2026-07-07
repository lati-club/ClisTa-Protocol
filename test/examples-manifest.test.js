// examples-manifest.test.js — guards examples/manifest.json, the registry of
// example decision logs the cockpit (app.clista.ai) mirrors. The cockpit's
// sync-examples track trusts this manifest and re-verifies each entry, so a
// broken or mis-declared entry must fail HERE, upstream, before it can ship.
//
// For every published example this asserts: declared files exist, each thread
// validates clean independently, the entryThreadId is one of the threads, and —
// for cross-thread examples — the parent's CrossThreadEvidence items all resolve
// to the arms' DecisionMerged events (the same check the cockpit will run).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { validateEvents } = require("../src/validator");
const { verifyCrossThreadProvenance } = require("../src/provenance");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "examples", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const published = manifest.examples.filter((e) => e.published);

test("manifest is well-formed and ids are unique", () => {
  assert.equal(manifest.version, "clista.examples.manifest.v0");
  assert.ok(Array.isArray(manifest.examples) && manifest.examples.length >= 1);
  const ids = manifest.examples.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "example ids must be unique");
  assert.ok(published.length >= 1, "at least one published example");
});

for (const ex of published) {
  test(`example ${ex.id}: required fields, files exist, entry thread is declared`, () => {
    for (const field of ["id", "title", "summary", "kind", "entryThreadId", "threads"]) {
      assert.ok(ex[field], `${ex.id} missing ${field}`);
    }
    assert.ok(Array.isArray(ex.threads) && ex.threads.length >= 1);
    const threadIds = ex.threads.map((t) => t.threadId);
    assert.ok(threadIds.includes(ex.entryThreadId), `entryThreadId ${ex.entryThreadId} not among declared threads`);
    if (ex.kind === "single-thread") {
      assert.equal(ex.threads.length, 1, "single-thread example declares exactly one thread");
    }
    for (const t of ex.threads) {
      assert.ok(t.file && t.threadId, `${ex.id} thread entry needs file + threadId`);
      assert.ok(fs.existsSync(path.join(root, t.file)), `missing file ${t.file}`);
    }
  });

  test(`example ${ex.id}: every thread validates clean and matches its declared id`, () => {
    for (const t of ex.threads) {
      const events = readEventsAt(path.join(root, t.file));
      assert.ok(events.length >= 1, `${t.file} is empty`);
      const result = validateEvents(events);
      assert.equal(result.valid, true, `${t.file} failed validate: ${JSON.stringify(result.errors)}`);
      assert.ok(events.every((e) => e.thread_id === t.threadId), `${t.file} events must all be thread ${t.threadId}`);
    }
  });

  if (ex.verifyCrossThread) {
    test(`example ${ex.id}: cross-thread provenance resolves to arm decisions`, () => {
      const parents = ex.threads.filter((t) => t.role === "parent");
      const arms = ex.threads.filter((t) => t.role === "arm");
      assert.equal(parents.length, 1, "a cross-thread example has exactly one parent thread");
      assert.ok(arms.length >= 1, "a cross-thread example has at least one arm thread");
      const parentEvents = readEventsAt(path.join(root, parents[0].file));
      const armEventLogs = arms.map((a) => readEventsAt(path.join(root, a.file)));
      const report = verifyCrossThreadProvenance(parentEvents, armEventLogs);
      assert.equal(report.valid, true, `cross-thread verify failed: ${JSON.stringify(report.summary)}`);
      assert.ok(report.summary.verified >= 1, "expected at least one verified cross-thread item");
      assert.equal(report.summary.mismatch, 0);
      assert.equal(report.summary.decisionNotFound, 0);
      // A published bundle declares all its own arms, so nothing should degrade to
      // "skipped" — a typo'd/dangling sourceThreadId would otherwise pass silently.
      assert.equal(report.summary.skipped, 0);
    });
  }
}
