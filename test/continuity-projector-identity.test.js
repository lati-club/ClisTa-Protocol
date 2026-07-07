const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { PROJECTION_VERSION } = require("../src/projector");
const { exportContinuityPacket, verifyContinuityPacket } = require("../src/continuity");
const { readEventsAt } = require("../src/events");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const canonicalLog = path.join(root, ".clista", "events.ndjson");

function loadEvents() {
  return readEventsAt(canonicalLog);
}

test("exported continuity packet records the sealing projector identity", () => {
  const packet = exportContinuityPacket(loadEvents());
  assert.equal(packet.projection_version, PROJECTION_VERSION);
});

test("packet sealed by this projector verifies with no projector mismatch", () => {
  const packet = exportContinuityPacket(loadEvents());
  const verification = verifyContinuityPacket(packet);

  assert.equal(verification.valid, true, JSON.stringify(verification.reasons));
  assert.equal(verification.projectorMismatch, false);
  assert.equal(verification.projectionVersion, PROJECTION_VERSION);
});

test("a divergent projector reports an honest projector mismatch, not a bare projection_hash failure", () => {
  const packet = exportContinuityPacket(loadEvents());
  // Simulate a checkout whose projector output contract differs from the
  // sealer's: same byte-identical events, but a different projection_version.
  const staleSealed = { ...packet, projection_version: "clista.projection.v0-stale" };

  const verification = verifyContinuityPacket(staleSealed);

  assert.equal(verification.valid, false);
  assert.equal(verification.projectorMismatch, true);
  assert.equal(verification.projectionVersion, "clista.projection.v0-stale");

  const messages = JSON.stringify(verification.reasons);
  assert.match(messages, /projector mismatch/);
  assert.match(messages, /regenerate the packet or align the checkout/);
  // The failure must be diagnosable as a projector-version issue, NOT masquerade
  // as event/projection corruption.
  assert.doesNotMatch(messages, /projection_hash does not match recomputed value/);
  assert.doesNotMatch(messages, /continuity_state does not match projected thread state/);
});

test("projector mismatch still binds the packet's own self-consistency", () => {
  const packet = exportContinuityPacket(loadEvents());
  const tampered = {
    ...packet,
    projection_version: "clista.projection.v0-stale",
    // Corrupt continuity_state so its own state_hash no longer commits to it.
    continuity_state: { ...packet.continuity_state, current_question: "tampered?" }
  };

  const verification = verifyContinuityPacket(tampered);
  const messages = JSON.stringify(verification.reasons);

  assert.equal(verification.valid, false);
  assert.equal(verification.projectorMismatch, true);
  assert.match(messages, /projector mismatch/);
  // Even under a projector mismatch, tampering with the packet's own state is caught.
  assert.match(messages, /state_hash does not match continuity_state/);
});

test("legacy packets without projection_version keep verifying against a matching projector", () => {
  const packet = exportContinuityPacket(loadEvents());
  const legacy = { ...packet };
  delete legacy.projection_version;

  const verification = verifyContinuityPacket(legacy);
  assert.equal(verification.valid, true, JSON.stringify(verification.reasons));
  assert.equal(verification.projectorMismatch, false);
  assert.equal(verification.projectionVersion, null);
});

test("continuity verify CLI surfaces the projector mismatch and exits nonzero", () => {
  const packet = exportContinuityPacket(loadEvents());
  const staleSealed = { ...packet, projection_version: "clista.projection.v0-stale" };

  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-projector-id-"));
  const packetPath = path.join(cwd, "continuity.json");
  writeFileSync(packetPath, `${JSON.stringify(staleSealed, null, 2)}\n`, "utf8");

  const result = spawnSync("node", [cliPath, "continuity", "verify", "--packet", packetPath], {
    cwd,
    encoding: "utf8"
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(output.valid, false);
  assert.equal(output.projectorMismatch, true);
  assert.match(JSON.stringify(output.reasons), /projector mismatch/);
});
