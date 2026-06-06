const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEvents, readEventsAt } = require("../src/events");
const {
  buildInteroperabilityProfile,
  verifyProtocolInteroperability
} = require("../src/interoperability");
const { exportProtocol, projectEvents, selectThreadState } = require("../src/projector");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const canonicalLog = path.join(root, ".clista", "events.ndjson");

test("interoperability verify accepts current continuity packets as explicitly degraded", () => {
  const result = runCli(root, ["interoperability", "verify", "--events", canonicalLog]);
  const summary = runCli(root, ["interoperability", "show", "--events", canonicalLog]);

  assert.equal(result.schema, "clista.interoperability.verify.v0");
  assert.equal(result.valid, true);
  assert.equal(result.status, "degraded");
  assert.equal(result.theorem, "protocol_interoperability = preserve(meaning, across_compatible_contexts)");
  assert.equal(result.hardLaw, "translation != reinterpretation");
  assert.ok(result.packetContext.requiredSemantics.includes("authority_context"));
  assert.equal(result.localProfile.interoperabilityProtocolVersion, "0.23.0");
  assert.ok(result.packetContext.requiredSemantics.includes("federation_status"));
  assert.ok(result.packetContext.requiredSemantics.includes("negotiation_status"));
  assert.ok(result.packetContext.requiredSemantics.includes("delegation_status"));
  assert.ok(result.packetContext.requiredSemantics.includes("execution_status"));
  assert.ok(result.packetContext.requiredSemantics.includes("protocol_outcome_status"));
  assert.ok(result.packetContext.requiredSemantics.includes("protocol_outcome_learning_status"));
  assert.ok(result.packetContext.requiredSemantics.includes("protocol_review_status"));
  assert.equal(result.localProfile.objectSemantics.authority, "event_time_governance_permission");
  assert.equal(result.localProfile.objectSemantics.protocol_outcome, "observed_effect_evaluation_not_completion_success");
  assert.equal(result.localProfile.objectSemantics.protocol_outcome_learning, "evaluated_outcome_learning_not_retroactive_justification");
  assert.equal(result.localProfile.objectSemantics.protocol_review, "required_review_routing_not_approval");
  assert.equal(summary.valid, true);
  assert.equal(summary.status, "degraded");
});

test("interoperability rejects unknown required semantics", () => {
  const packet = runCli(root, ["continuity", "export", "--events", canonicalLog]);
  const tampered = clone(packet);
  tampered.interoperability_profile = buildInteroperabilityProfile({
    requiredSemantics: [
      ...packet.interoperability_profile.requiredSemantics,
      "source_reputation"
    ]
  });

  const result = verifyProtocolInteroperability(tampered, {
    compatibilityResult: compatibleResult()
  });

  assert.equal(result.valid, false);
  assert.equal(result.status, "incompatible");
  assert.match(JSON.stringify(result.reasons), /unknown required semantic source_reputation/);
});

test("interoperability rejects semantic reinterpretation", () => {
  const packet = runCli(root, ["continuity", "export", "--events", canonicalLog]);
  const tampered = clone(packet);
  tampered.interoperability_profile = buildInteroperabilityProfile({
    objectSemantics: {
      ...packet.interoperability_profile.objectSemantics,
      authority: "plain_metadata"
    }
  });

  const result = verifyProtocolInteroperability(tampered, {
    compatibilityResult: compatibleResult()
  });

  assert.equal(result.valid, false);
  assert.equal(result.status, "incompatible");
  assert.match(JSON.stringify(result.reasons), /semantic meaning mismatch for authority/);
});

test("interoperability validation rejects reinterpretation records", () => {
  const cwd = createInteroperabilityStore();
  const events = [
    ...readEvents(cwd),
    {
      event_id: "evt_semantic_mapping_bad",
      event_type: "SemanticMappingRecorded",
      thread_id: "thd_interop",
      actor_id: "par_troy",
      timestamp: "2026-06-06T00:00:00.000Z",
      payload: {
        semanticMapping: {
          id: "sem_bad",
          object: "semanticMapping",
          sourceSemantic: "authority_context",
          targetSemantic: "plain_metadata",
          exchangeFormat: "clista.continuity.packet.v0",
          semanticReinterpretation: true
        }
      }
    }
  ];
  const validation = validateEvents(events);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /semantic mapping cannot reinterpret sourceSemantic/);
  assert.match(message, /interoperability field semanticReinterpretation must be false/);
});

test("interoperability state projects deterministically into state and export", () => {
  const events = readEventsAt(canonicalLog);
  const first = projectEvents(events).interoperability;
  const second = projectEvents(events).interoperability;
  const exported = exportProtocol(projectEvents(events));
  const threadState = selectThreadState(projectEvents(events), "thd_thread_0001");

  assert.deepEqual(first, second);
  assert.equal(exported.interoperability.hardLaw, "translation != reinterpretation");
  assert.equal(exported.interoperability.interoperabilityValidationStatus.valid, true);
  assert.equal(threadState.reasoningState.interoperability.theorem, first.theorem);
});

function createInteroperabilityStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-interoperability-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_interop",
    "--title",
    "Interoperability Thread",
    "--question",
    "Can this exchange preserve protocol meaning?",
    "--participant",
    "Troy:decision owner"
  ]);
  return cwd;
}

function compatibleResult() {
  return {
    schema: "clista.compatibility.verify.v0",
    valid: true,
    status: "compatible",
    reasons: []
  };
}

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
