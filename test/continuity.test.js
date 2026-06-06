const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { existsSync, mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const canonicalLog = path.join(root, ".clista", "events.ndjson");

test("continuity export produces deterministic projected-state packets", () => {
  const first = runCli(root, ["continuity", "export", "--events", canonicalLog]);
  const second = runCli(root, ["continuity", "export", "--events", canonicalLog]);
  assert.deepEqual(first, second);

  assert.equal(first.protocol, "clista");
  assert.equal(first.packet_type, "continuity");
  assert.equal(first.protocol_version, "0.19.0");
  assert.equal(first.schema_version, "clista.continuity.packet.v0");
  assert.equal(first.theorem, "reasoning_continuity = resume(project(event_log), verification_state)");
  assert.equal(first.hard_law, "context transfer != memory trust");
  assert.equal(first.interoperability_profile.hardLaw, "translation != reinterpretation");
  assert.ok(first.interoperability_profile.requiredSemantics.includes("authority_context"));
  assert.equal(first.integrity_verified, true);
  assert.equal(first.strict_integrity_verified, false);
  assert.equal(first.verification_mode, "compatibility");
  assert.equal(first.resume_status, "degraded");
  assert.equal(first.verification_state.status, "degraded");
  assert.equal(first.verification_state.memoryTrust, false);
  assert.equal(first.verification_state.amendmentValidationStatus.valid, true);
  assert.equal(first.verification_state.compatibilityValidationStatus.valid, true);
  assert.equal(first.verification_state.interoperabilityValidationStatus.valid, true);
  assert.equal(first.verification_state.federationValidationStatus.valid, true);
  assert.equal(first.verification_state.negotiationValidationStatus.valid, true);
  assert.ok(first.capability_set.includes("amendments"));
  assert.ok(first.capability_set.includes("compatibility"));
  assert.ok(first.capability_set.includes("interoperability"));
  assert.ok(first.capability_set.includes("federation"));
  assert.ok(first.capability_set.includes("negotiation"));
  assert.equal(first.source_thread_id, "thd_thread_0001");
  assert.equal(first.continuity_state.current_question, "How should ClisTa be architected?");
  assert.equal(first.continuity_state.current_decision.id, "dcr_protocol_first_architecture");
  assert.equal(first.continuity_state.next_action, "Implement and prove Milestone 0: Protocol Spine Proven.");
  assert.equal(first.continuity_state.integrity_state.strict_integrity_verified, false);
  assert.equal(first.continuity_state.verification_status.status, "degraded");
  assert.equal(first.continuity_state.verification_status.memory_trust, false);
});

test("continuity verify and summary accept a valid packet", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-continuity-"));
  const packetPath = writePacket(cwd, runCli(root, ["continuity", "export", "--events", canonicalLog]));

  const directVerification = runCli(root, ["continuity", "verify", "--events", canonicalLog]);
  const verification = runCli(cwd, ["continuity", "verify", "--packet", packetPath]);
  const summary = runCli(cwd, ["continuity", "summary", "--packet", packetPath]);

  assert.equal(directVerification.valid, true);
  assert.equal(directVerification.resumeStatus, "degraded");
  assert.equal(verification.valid, true);
  assert.equal(verification.sourceThreadId, "thd_thread_0001");
  assert.equal(verification.resumeStatus, "degraded");
  assert.equal(summary.valid, true);
  assert.equal(summary.resume_status, "degraded");
  assert.equal(summary.hard_law, "context transfer != memory trust");
  assert.equal(summary.current_question, "How should ClisTa be architected?");
  assert.equal(summary.status, "decided");
  assert.ok(summary.active_assumption_ids.includes("asm_projected_state_is_minimum_memory"));
  assert.ok(summary.accepted_claim_ids.includes("clm_reasoning_state_asset"));
  assert.ok(summary.open_objection_ids.includes("obj_object_model_too_broad"));
  assert.equal(summary.verification_state.learningValidationStatus.valid, true);
  assert.equal(summary.verification_state.adaptationValidationStatus.valid, true);
  assert.equal(summary.verification_state.amendmentValidationStatus.valid, true);
  assert.equal(summary.verification_state.compatibilityValidationStatus.valid, true);
  assert.equal(summary.verification_state.interoperabilityValidationStatus.valid, true);
  assert.equal(summary.verification_state.federationValidationStatus.valid, true);
  assert.equal(summary.verification_state.negotiationValidationStatus.valid, true);
});

test("continuity import, show, and resume restore verified projected state in a new context", () => {
  const packet = runCli(root, ["continuity", "export", "--events", canonicalLog]);
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-continuity-import-"));
  const packetPath = writePacket(cwd, packet);

  const imported = runCli(cwd, ["continuity", "import", packetPath]);
  const verification = runCli(cwd, ["continuity", "verify"]);
  const summary = runCli(cwd, ["continuity", "show"]);
  const resumed = runCli(cwd, ["continuity", "resume"]);

  assert.equal(imported.imported, true);
  assert.equal(imported.resume_status, "degraded");
  assert.equal(existsSync(path.join(cwd, ".clista", "continuity.json")), true);
  assert.equal(verification.valid, true);
  assert.equal(verification.resumeStatus, "degraded");
  assert.equal(summary.valid, true);
  assert.equal(summary.source_thread_id, "thd_thread_0001");
  assert.equal(summary.current_decision.summary, packet.continuity_state.current_decision.summary);
  assert.equal(summary.next_action, packet.continuity_state.next_action);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.resumeStatus, "degraded");
  assert.equal(resumed.hardLaw, "context transfer != memory trust");
  assert.equal(resumed.interoperability_profile.hardLaw, "translation != reinterpretation");
  assert.equal(resumed.continuity_state.current_question, packet.continuity_state.current_question);
});

test("fresh event logs export as strict verified continuity packets", () => {
  const cwd = createStrictStore();
  const packet = runCli(cwd, ["continuity", "export", "--thread", "thd_continuity"]);
  const verification = verifyPacket(cwd, packet);

  assert.equal(packet.integrity_verified, true);
  assert.equal(packet.strict_integrity_verified, true);
  assert.equal(packet.verification_mode, "strict");
  assert.equal(packet.resume_status, "verified");
  assert.equal(packet.verification_state.status, "verified");
  assert.equal(packet.continuity_state.integrity_state.strict_integrity_verified, true);
  assert.equal(verification.valid, true);
  assert.equal(verification.resumeStatus, "verified");
});

test("continuity export rejects tampered source logs", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-continuity-tampered-log-"));
  const events = readEventsAt(canonicalLog);
  events[0].payload.participant.name = "Changed after hashing";
  const tamperedLog = path.join(cwd, "tampered.ndjson");
  writeEventLog(tamperedLog, events);

  const result = spawnSync("node", [cliPath, "continuity", "export", "--events", tamperedLog], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /content_hash does not match canonical event serialization/);
});

test("continuity verify rejects tampered continuity state and source events", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-continuity-tamper-"));
  const packet = runCli(root, ["continuity", "export", "--events", canonicalLog]);

  const tamperedState = clone(packet);
  tamperedState.continuity_state.current_question = "What changed?";
  const tamperedStatePath = writePacket(cwd, tamperedState, "tampered-state.json");
  const stateResult = spawnSync("node", [cliPath, "continuity", "verify", "--packet", tamperedStatePath], {
    cwd,
    encoding: "utf8"
  });
  const stateOutput = JSON.parse(stateResult.stdout);

  assert.equal(stateResult.status, 1);
  assert.equal(stateOutput.valid, false);
  assert.match(JSON.stringify(stateOutput.reasons), /continuity_state does not match projected thread state/);

  const tamperedEvents = clone(packet);
  tamperedEvents.source_events[0].payload.participant.name = "Changed after export";
  const tamperedEventsPath = writePacket(cwd, tamperedEvents, "tampered-events.json");
  const eventsResult = spawnSync("node", [cliPath, "continuity", "verify", "--packet", tamperedEventsPath], {
    cwd,
    encoding: "utf8"
  });
  const eventsOutput = JSON.parse(eventsResult.stdout);

  assert.equal(eventsResult.status, 1);
  assert.equal(eventsOutput.valid, false);
  assert.match(JSON.stringify(eventsOutput.reasons), /event_log_hash does not match source events/);

  const tamperedVerification = clone(packet);
  tamperedVerification.verification_state.memoryTrust = true;
  const tamperedVerificationPath = writePacket(cwd, tamperedVerification, "tampered-verification.json");
  const verificationResult = spawnSync("node", [cliPath, "continuity", "verify", tamperedVerificationPath], {
    cwd,
    encoding: "utf8"
  });
  const verificationOutput = JSON.parse(verificationResult.stdout);

  assert.equal(verificationResult.status, 1);
  assert.equal(verificationOutput.valid, false);
  assert.match(JSON.stringify(verificationOutput.reasons), /continuity cannot trust model memory/);
});

test("continuity verify rejects incompatible packet fields", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-continuity-bad-fields-"));
  const base = runCli(root, ["continuity", "export", "--events", canonicalLog]);
  const cases = [
    ["packet_type", "future_continuity", /unsupported packet_type/],
    ["protocol_version", "9.9.9", /unsupported protocol_version/],
    ["schema_version", "clista.continuity.packet.v999", /unsupported schema_version/],
    ["integrity_verified", false, /integrity_verified must be true/],
    ["resume_status", "rejected", /resume_status does not match verification state/],
    ["state_hash", "sha256:0000000000000000000000000000000000000000000000000000000000000000", /state_hash/]
  ];

  for (const [field, value, expected] of cases) {
    const packet = clone(base);
    packet[field] = value;
    const packetPath = writePacket(cwd, packet, `${field}.json`);
    const result = spawnSync("node", [cliPath, "continuity", "verify", "--packet", packetPath], {
      cwd,
      encoding: "utf8"
    });
    const output = JSON.parse(result.stdout);

    assert.equal(result.status, 1, `${field} should fail`);
    assert.equal(output.valid, false);
    assert.match(JSON.stringify(output.reasons), expected);
  }

  const missingCapability = clone(base);
  missingCapability.capability_set = missingCapability.capability_set.filter((item) => item !== "amendments");
  const missingCapabilityPath = writePacket(cwd, missingCapability, "missing-capability.json");
  const missingCapabilityResult = spawnSync("node", [cliPath, "continuity", "verify", missingCapabilityPath], {
    cwd,
    encoding: "utf8"
  });
  const missingCapabilityOutput = JSON.parse(missingCapabilityResult.stdout);

  assert.equal(missingCapabilityResult.status, 1);
  assert.equal(missingCapabilityOutput.valid, false);
  assert.match(JSON.stringify(missingCapabilityOutput.reasons), /missing capability amendments/);
});

function createStrictStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-continuity-strict-"));
  execFileSync("node", [cliPath, "init"], { cwd });
  execFileSync("node", [
    cliPath,
    "thread",
    "create",
    "--id",
    "thd_continuity",
    "--title",
    "Continuity Thread",
    "--question",
    "Can projected reasoning survive context loss?",
    "--participant",
    "Troy:decision owner"
  ], { cwd });
  execFileSync("node", [
    cliPath,
    "evidence",
    "commit",
    "--thread",
    "thd_continuity",
    "--source",
    "Continuity test",
    "--finding",
    "Projected reasoning state can be carried in a verified packet."
  ], { cwd });
  return cwd;
}

function verifyPacket(cwd, packet) {
  const packetPath = writePacket(cwd, packet);
  return runCli(cwd, ["continuity", "verify", "--packet", packetPath]);
}

function runCli(cwd, args) {
  const output = execFileSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  return JSON.parse(output);
}

function writePacket(cwd, packet, name = "continuity.json") {
  const packetPath = path.join(cwd, name);
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  return packetPath;
}

function writeEventLog(logPath, events) {
  writeFileSync(logPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
