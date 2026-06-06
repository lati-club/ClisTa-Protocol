const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEvents, readEventsAt, writeEvents } = require("../src/events");
const { exportProtocol, projectEvents, selectThreadState } = require("../src/projector");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const canonicalLog = path.join(root, ".clista", "events.ndjson");

test("compatibility verify accepts current continuity packets as explicitly degraded", () => {
  const result = runCli(root, ["compatibility", "verify", "--events", canonicalLog]);
  const summary = runCli(root, ["compatibility", "show", "--events", canonicalLog]);

  assert.equal(result.schema, "clista.compatibility.verify.v0");
  assert.equal(result.valid, true);
  assert.equal(result.status, "degraded");
  assert.equal(result.theorem, "protocol_compatibility = verify(capability_set, amendment_state, validation_requirements)");
  assert.equal(result.hardLaw, "unsupported_state != valid_state");
  assert.ok(result.packetContext.requiredCapabilities.includes("compatibility"));
  assert.ok(result.packetContext.requiredCapabilities.includes("interoperability"));
  assert.ok(result.packetContext.requiredCapabilities.includes("federation"));
  assert.ok(result.packetContext.requiredVerificationLayers.includes("compatibility"));
  assert.ok(result.packetContext.requiredVerificationLayers.includes("interoperability"));
  assert.ok(result.packetContext.requiredVerificationLayers.includes("federation"));
  assert.equal(result.localContext.compatibilityProtocolVersion, "0.17.0");
  assert.equal(summary.valid, true);
  assert.equal(summary.status, "degraded");
});

test("compatibility check rejects unsupported required capabilities and verification layers", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-compatibility-bad-"));
  const packet = runCli(root, ["continuity", "export", "--events", canonicalLog]);

  const unsupportedCapability = clone(packet);
  unsupportedCapability.capability_set.push("distributed_consensus");
  const capabilityPath = writePacket(cwd, unsupportedCapability, "unsupported-capability.json");
  const capabilityResult = spawnSync("node", [cliPath, "compatibility", "check", capabilityPath], {
    cwd,
    encoding: "utf8"
  });
  const capabilityOutput = JSON.parse(capabilityResult.stdout);

  assert.equal(capabilityResult.status, 1);
  assert.equal(capabilityOutput.valid, false);
  assert.equal(capabilityOutput.status, "incompatible");
  assert.match(JSON.stringify(capabilityOutput.reasons), /unsupported required capability distributed_consensus/);

  const unsupportedLayer = clone(packet);
  unsupportedLayer.verification_state.requiredLayers.push("source_reputation");
  const layerPath = writePacket(cwd, unsupportedLayer, "unsupported-layer.json");
  const layerResult = spawnSync("node", [cliPath, "compatibility", "check", layerPath], {
    cwd,
    encoding: "utf8"
  });
  const layerOutput = JSON.parse(layerResult.stdout);

  assert.equal(layerResult.status, 1);
  assert.equal(layerOutput.valid, false);
  assert.equal(layerOutput.status, "rejected");
  assert.match(JSON.stringify(layerOutput.reasons), /unsupported verification layer source_reputation/);
});

test("compatibility check rejects unsupported active amendments unless explicitly supported", () => {
  const cwd = createActiveAmendmentStore();
  const packet = runCli(cwd, ["continuity", "export", "--thread", "thd_compat"]);
  const packetPath = writePacket(cwd, packet);

  assert.equal(packet.resume_status, "verified");
  assert.equal(packet.continuity_state.amendment_state.activeAmendments.length, 1);

  const rejected = spawnSync("node", [cliPath, "compatibility", "check", "--packet", packetPath], {
    cwd,
    encoding: "utf8"
  });
  const rejectedOutput = JSON.parse(rejected.stdout);

  assert.equal(rejected.status, 1);
  assert.equal(rejectedOutput.valid, false);
  assert.equal(rejectedOutput.status, "incompatible");
  assert.match(JSON.stringify(rejectedOutput.reasons), /unsupported active amendment amd_compat_threshold/);

  const accepted = runCli(cwd, [
    "compatibility",
    "check",
    "--packet",
    packetPath,
    "--support-amendment",
    "amd_compat_threshold"
  ]);

  assert.equal(accepted.valid, true);
  assert.equal(accepted.status, "compatible");
  assert.deepEqual(accepted.packetContext.activeAmendmentIds, ["amd_compat_threshold"]);
});

test("compatibility state projects deterministically into state and export", () => {
  const events = readEventsAt(canonicalLog);
  const first = projectEvents(events).compatibility;
  const second = projectEvents(events).compatibility;
  const exported = exportProtocol(projectEvents(events));
  const threadState = selectThreadState(projectEvents(events), "thd_thread_0001");

  assert.deepEqual(first, second);
  assert.equal(exported.compatibility.hardLaw, "unsupported_state != valid_state");
  assert.equal(exported.compatibility.compatibilityValidationStatus.valid, true);
  assert.equal(threadState.reasoningState.compatibility.theorem, first.theorem);
});

test("compatibility validation rejects best-effort acceptance records", () => {
  const cwd = createCompatibilityStore();
  const events = [
    ...readEvents(cwd),
    {
      event_id: "evt_capability_set_bad",
      event_type: "CapabilitySetDeclared",
      thread_id: "thd_compat",
      actor_id: "par_troy",
      timestamp: "2026-06-06T00:00:00.000Z",
      payload: {
        capabilitySetDeclaration: {
          id: "cap_bad",
          object: "capabilitySetDeclaration",
          protocolVersion: "clista.protocol.v0",
          capabilitySet: ["spine", "continuity"],
          bestEffortAcceptance: true
        }
      }
    }
  ];
  const validation = validateEvents(events);

  assert.equal(validation.valid, false);
  assert.match(formatValidationErrors(validation.errors), /compatibility field bestEffortAcceptance must be false/);
});

function createActiveAmendmentStore() {
  const cwd = createCompatibilityStore();
  writeEvents([
    ...readEvents(cwd),
    makeAmendmentProposed(),
    makeAmendmentApproved()
  ], cwd);
  const validation = validateEvents(readEvents(cwd));
  assert.equal(validation.valid, true, formatValidationErrors(validation.errors));
  return cwd;
}

function createCompatibilityStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-compatibility-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_compat",
    "--title",
    "Compatibility Thread",
    "--question",
    "Can this environment safely resume the packet?",
    "--participant",
    "Troy:decision owner"
  ]);
  return cwd;
}

function makeAmendmentProposed() {
  return {
    event_id: "evt_compat_amendment_proposed",
    event_type: "ProtocolAmendmentProposed",
    thread_id: "thd_compat",
    actor_id: "par_troy",
    timestamp: "2026-06-06T00:01:00.000Z",
    payload: {
      protocolAmendment: {
        id: "amd_compat_threshold",
        object: "protocolAmendment",
        title: "Require compatibility checks before resume",
        amendmentType: "validation_policy",
        target: "docs/protocol/v0/spec.md#compatibility",
        rationale: "Continuity packets should only resume in supported protocol contexts.",
        proposedChange: "Future resume operations require compatibility verification.",
        effectScope: "future_only",
        threadId: "thd_compat",
        adaptationRecommendationIds: [],
        learningSignalIds: [],
        sourceEventIds: [],
        proposedBy: "par_troy",
        automaticAmendment: false,
        implicitMutation: false,
        hiddenPolicyMutation: false,
        retroactiveMutation: false,
        rewritesPastEvents: false,
        recommendationBecomesAmendment: false
      }
    }
  };
}

function makeAmendmentApproved() {
  return {
    event_id: "evt_compat_amendment_approved",
    event_type: "ProtocolAmendmentApproved",
    thread_id: "thd_compat",
    actor_id: "par_troy",
    timestamp: "2026-06-06T00:02:00.000Z",
    payload: {
      protocolAmendmentApproval: {
        id: "ama_compat_threshold",
        object: "protocolAmendmentApproval",
        amendmentId: "amd_compat_threshold",
        approvedBy: "par_troy",
        authority: "decision_owner",
        rationale: "Authorized decision owner approves future-only compatibility validation.",
        effectScope: "future_only",
        automaticAmendment: false,
        implicitMutation: false,
        hiddenPolicyMutation: false,
        retroactiveMutation: false,
        rewritesPastEvents: false,
        recommendationBecomesAmendment: false
      }
    }
  };
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
