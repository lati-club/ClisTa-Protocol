const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");

const canonicalLog = path.join(__dirname, "..", ".clista", "events.ndjson");

function withEnv(value, fn) {
  const previous = process.env.CLISTA_MAX_EVENT_LOG_BYTES;
  if (value === undefined) {
    delete process.env.CLISTA_MAX_EVENT_LOG_BYTES;
  } else {
    process.env.CLISTA_MAX_EVENT_LOG_BYTES = value;
  }
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.CLISTA_MAX_EVENT_LOG_BYTES;
    } else {
      process.env.CLISTA_MAX_EVENT_LOG_BYTES = previous;
    }
  }
}

test("reads a normal log under the default cap", () => {
  const events = readEventsAt(canonicalLog);
  assert.ok(events.length > 0);
});

test("rejects a log over the configured byte cap before loading it", () => {
  withEnv("16", () => {
    assert.throws(
      () => readEventsAt(canonicalLog),
      /over the 16-byte limit.*CLISTA_MAX_EVENT_LOG_BYTES/s
    );
  });
});

test("an invalid cap value falls back to the default (still reads)", () => {
  withEnv("not-a-number", () => {
    assert.ok(readEventsAt(canonicalLog).length > 0);
  });
  withEnv("-5", () => {
    assert.ok(readEventsAt(canonicalLog).length > 0);
  });
});

test("a missing file still returns [] (no stat error)", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "clista-size-"));
  assert.deepEqual(readEventsAt(path.join(dir, "nope.ndjson")), []);
});

test("a small foreign log under a small cap reads fine", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "clista-size-"));
  const file = path.join(dir, "tiny.ndjson");
  writeFileSync(file, '{"event_id":"evt_1","event_type":"ThreadCreated"}\n', "utf8");
  withEnv("1024", () => {
    assert.equal(readEventsAt(file).length, 1);
  });
});
