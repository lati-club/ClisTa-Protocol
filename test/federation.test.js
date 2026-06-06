const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEvents, readEventsAt } = require("../src/events");
const {
  buildFederatedStateReference,
  verifyProtocolFederation
} = require("../src/federation");
const { verifyProtocolCompatibility } = require("../src/compatibility");
const { verifyContinuityPacket } = require("../src/continuity");
const {
  buildInteroperabilityProfile,
  verifyProtocolInteroperability
} = require("../src/interoperability");
const { exportProtocol, projectEvents, selectThreadState } = require("../src/projector");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const canonicalLog = path.join(root, ".clista", "events.ndjson");

test("federation check accepts current continuity packets as explicitly degraded", () => {
  const result = runCli(root, ["federation", "check", "--events", canonicalLog]);

  assert.equal(result.schema, "clista.federation.verify.v0");
  assert.equal(result.valid, true);
  assert.equal(result.status, "degraded");
  assert.equal(result.theorem, "protocol_federation = align(independent_reasoning_states, shared_protocol_rules)");
  assert.equal(result.hardLaw, "shared_state != shared_authority");
  assert.equal(result.remoteAuthorityImported, false);
  assert.equal(result.automaticAmendmentImport, false);
  assert.equal(result.packetContext.sourceThreadId, "thd_thread_0001");
});

test("federation record, list, show, and verify preserve external references without importing authority", () => {
  const packet = runCli(root, ["continuity", "export", "--events", canonicalLog]);
  const cwd = createFederationStore();
  const packetPath = writePacket(cwd, packet);

  const recorded = runCli(cwd, [
    "federation",
    "record",
    "--thread",
    "thd_federation",
    "--packet",
    packetPath,
    "--peer",
    "peer_remote_clista",
    "--context",
    "ctx_remote_clista",
    "--summary",
    "Reference verified external reasoning state"
  ]);
  const listed = runCli(cwd, ["federation", "list", "--thread", "thd_federation"]);
  const shown = runCli(cwd, ["federation", "show", recorded.federatedStateReference.id]);
  const verified = runCli(cwd, ["federation", "verify"]);

  assert.equal(recorded.recorded, true);
  assert.equal(recorded.federatedStateReference.status, "degraded");
  assert.equal(recorded.federatedStateReference.remoteAuthorityImported, false);
  assert.equal(recorded.federatedStateReference.automaticAmendmentImport, false);
  assert.equal(listed.count, 1);
  assert.equal(shown.reference.id, recorded.federatedStateReference.id);
  assert.equal(verified.valid, true);
  assert.equal(verified.federationValidationStatus.referenceCount, 1);
});

test("federation rejects packets that fail interoperability", () => {
  const packet = runCli(root, ["continuity", "export", "--events", canonicalLog]);
  const tampered = clone(packet);
  tampered.interoperability_profile = buildInteroperabilityProfile({
    objectSemantics: {
      ...packet.interoperability_profile.objectSemantics,
      authority: "plain_metadata"
    }
  });
  const continuityVerification = verifyContinuityPacket(packet);
  const compatibilityResult = verifyProtocolCompatibility(packet, { continuityVerification });
  const interoperabilityResult = verifyProtocolInteroperability(tampered, { compatibilityResult });
  const federation = verifyProtocolFederation(tampered, {
    continuityVerification,
    compatibilityResult,
    interoperabilityResult
  });

  assert.equal(interoperabilityResult.valid, false);
  assert.equal(federation.valid, false);
  assert.equal(federation.status, "rejected");
  assert.match(JSON.stringify(federation.reasons), /interoperability check failed/);
});

test("federation validation rejects shared authority and automatic amendment import", () => {
  const cwd = createFederationStore();
  const packet = runCli(root, ["continuity", "export", "--events", canonicalLog]);
  const continuityVerification = verifyContinuityPacket(packet);
  const compatibilityResult = verifyProtocolCompatibility(packet, { continuityVerification });
  const interoperabilityResult = verifyProtocolInteroperability(packet, { compatibilityResult });
  const federation = verifyProtocolFederation(packet, {
    continuityVerification,
    compatibilityResult,
    interoperabilityResult
  });
  const reference = buildFederatedStateReference(packet, federation, {
    id: "fed_bad_authority",
    threadId: "thd_federation",
    recordedBy: "par_troy",
    recordedAt: "2026-06-06T00:00:00.000Z"
  });
  reference.remoteAuthorityImported = true;
  reference.automaticAmendmentImport = true;

  const events = [
    ...readEvents(cwd),
    {
      event_id: "evt_federated_reference_bad",
      event_type: "FederatedStateReferenceRecorded",
      thread_id: "thd_federation",
      actor_id: "par_troy",
      timestamp: "2026-06-06T00:00:00.000Z",
      payload: {
        federatedStateReference: reference
      }
    }
  ];
  const validation = validateEvents(events);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /federation field remoteAuthorityImported must be false/);
  assert.match(message, /federation field automaticAmendmentImport must be false/);
});

test("federation state projects deterministically into state and export", () => {
  const events = readEventsAt(canonicalLog);
  const first = projectEvents(events).federation;
  const second = projectEvents(events).federation;
  const exported = exportProtocol(projectEvents(events));
  const threadState = selectThreadState(projectEvents(events), "thd_thread_0001");

  assert.deepEqual(first, second);
  assert.equal(exported.federation.hardLaw, "shared_state != shared_authority");
  assert.equal(exported.federation.federationValidationStatus.valid, true);
  assert.equal(threadState.reasoningState.federation.theorem, first.theorem);
});

function createFederationStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-federation-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_federation",
    "--title",
    "Federation Thread",
    "--question",
    "Can independent ClisTa contexts align without shared authority?",
    "--participant",
    "Troy:decision owner"
  ]);
  return cwd;
}

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function writePacket(cwd, packet, name = "continuity.json") {
  const packetPath = path.join(cwd, name);
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  return packetPath;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
