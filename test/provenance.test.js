const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { projectEvents, selectThreadState } = require("../src/projector");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const canonicalLog = path.join(root, ".clista", "events.ndjson");

test("CLI provenance projection traces contribution source lineage", () => {
  const cwd = createProvenanceDecisionStore();

  const list = runCli(cwd, ["provenance", "list", "--thread", "thd_prov"]);
  assert.equal(list.schema, "clista.provenance.list.v0");
  assert.ok(list.provenance.some((record) => record.contributionId === "clm_prov"));

  const claim = runCli(cwd, ["provenance", "show", "clm_prov"]);
  const record = claim.provenance[0];
  assert.equal(record.contributionId, "clm_prov");
  assert.equal(record.participantId, "par_troy");
  assert.equal(record.sourceIntegrityVerified, true);
  assert.equal(record.sourceAvailableAtContributionTime, true);
  assert.ok(record.sourceRefs.some((sourceRef) => sourceRef.sourceType === "evidence" && sourceRef.sourceId === "evd_prov"));
  assert.ok(record.transformations.includes("observed"));
  assert.ok(record.transformations.includes("inferred"));

  const trace = runCli(cwd, ["provenance", "trace", "clm_prov"]);
  assert.equal(trace.schema, "clista.provenance.trace.v0");
  assert.equal(trace.trace[0].introducedByEventId, record.introducedByEventId);

  const verification = runCli(cwd, ["provenance", "verify"]);
  assert.equal(verification.valid, true);
  assert.equal(verification.provenanceValidationStatus.valid, true);
});

test("provenance validation rejects missing source references", () => {
  const cwd = createProvenanceDecisionStore();
  const events = readStoreEvents(cwd);
  const claimEvent = eventForContribution(events, "claim", "clm_prov");

  events.push(makeAttributionEvent({
    id: "atr_missing_prov_source",
    eventId: "evt_missing_prov_source",
    sourceEventId: claimEvent.event_id,
    provenance: {
      sourceType: "event",
      sourceId: "evt_missing_source",
      transformation: "asserted"
    }
  }));

  assertInvalid(events, /provenance source does not exist: evt_missing_source/);
});

test("provenance validation rejects future source references", () => {
  const cwd = createProvenanceDecisionStore();
  const events = readStoreEvents(cwd);
  const claimEvent = eventForContribution(events, "claim", "clm_prov");
  const decisionEvent = eventForContribution(events, "decisionRecord", "dcr_prov");

  events.push(makeAttributionEvent({
    id: "atr_future_prov_source",
    eventId: "evt_future_prov_source",
    sourceEventId: claimEvent.event_id,
    provenance: {
      sourceType: "event",
      sourceId: decisionEvent.event_id,
      transformation: "summarized"
    }
  }));

  assertInvalid(events, new RegExp(`provenance cannot reference future source ${decisionEvent.event_id}`));
});

test("provenance validation rejects source hash mismatches", () => {
  const cwd = createProvenanceDecisionStore();
  const events = readStoreEvents(cwd);
  const claimEvent = eventForContribution(events, "claim", "clm_prov");

  events.push(makeAttributionEvent({
    id: "atr_bad_prov_hash",
    eventId: "evt_bad_prov_hash",
    sourceEventId: claimEvent.event_id,
    provenance: {
      sourceType: "event",
      sourceId: claimEvent.event_id,
      sourceHash: `sha256:${"0".repeat(64)}`,
      transformation: "asserted"
    }
  }));

  assertInvalid(events, /provenance source_hash does not match canonical source serialization/);
});

test("corrections, disputes, and revocations preserve original provenance", () => {
  const cwd = createProvenanceDecisionStore();
  const events = readStoreEvents(cwd);
  const claimEvent = eventForContribution(events, "claim", "clm_prov");
  const attributionId = `atr_${claimEvent.event_id}`;
  const original = projectEvents(events).provenance.byContribution.clm_prov[0];

  events.push(makeAttributionCorrection(attributionId));
  events.push(makeAttributionDispute(attributionId));
  events.push(makeAttributionRevocation(attributionId));

  const result = validateEvents(events);
  assert.equal(result.valid, true, formatValidationErrors(result.errors));

  const projected = projectEvents(events).provenance.byContribution.clm_prov[0];
  assert.equal(projected.attributionStatus, "revoked");
  assert.deepEqual(projected.originalSourceHashes, original.originalSourceHashes);
  assert.deepEqual(projected.auditTrail.map((entry) => entry.transformation), [
    "corrected",
    "disputed",
    "revoked"
  ]);
});

test("fork provenance records imported parent boundary lineage", () => {
  const { cwd, boundaryEventId } = createForkStore();

  const fork = runCli(cwd, ["provenance", "show", "thd_fork"]);
  const record = fork.provenance[0];
  assert.equal(record.sourceType, "fork");
  assert.ok(record.transformations.includes("imported"));
  assert.ok(record.sourceRefs.some((sourceRef) => {
    return sourceRef.sourceType === "event" && sourceRef.sourceId === boundaryEventId;
  }));
});

test("merge provenance records merged source fork lineage", () => {
  const cwd = createMergeStore();

  const merge = runCli(cwd, ["provenance", "show", "mcm_mrg_fork_parent"]);
  const record = merge.provenance[0];
  assert.equal(record.sourceType, "merge");
  assert.ok(record.transformations.includes("merged"));
  assert.ok(record.sourceRefs.some((sourceRef) => {
    return sourceRef.objectId === "clm_fork" && sourceRef.transformation === "merged";
  }));
});

test("legacy event logs remain provenance-compatible without explicit provenance events", () => {
  const events = readEventsAt(canonicalLog);
  const validation = validateEvents(events);
  assert.equal(validation.valid, true, formatValidationErrors(validation.errors));

  const projection = projectEvents(events);
  assert.equal(projection.provenance.provenanceValidationStatus.valid, true);
  assert.equal(projection.provenance.provenance.length, projection.attribution.attributions.length);

  const state = selectThreadState(projection, "thd_thread_0001");
  assert.ok(state.reasoningState.provenance.byContribution.clm_protocol_first.length > 0);
});

function createProvenanceDecisionStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-provenance-"));
  runCli(cwd, ["init"]);
  runCli(cwd, ["participant", "declare", "--id", "par_troy", "--name", "Troy"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_prov",
    "--title",
    "Provenance Thread",
    "--question",
    "Can ClisTa trace source lineage?",
    "--actor",
    "par_troy",
    "--actor-role",
    "contributor",
    "--participant",
    "par_troy:Troy:contributor"
  ]);
  runCli(cwd, [
    "participant",
    "role",
    "assign",
    "--participant",
    "par_troy",
    "--role",
    "contributor",
    "--scope",
    "thread",
    "--thread",
    "thd_prov"
  ]);
  runCli(cwd, [
    "participant",
    "authority",
    "grant",
    "--participant",
    "par_troy",
    "--authority",
    "decision_owner",
    "--scope",
    "thread",
    "--thread",
    "thd_prov"
  ]);
  runCli(cwd, [
    "evidence",
    "commit",
    "--id",
    "evd_prov",
    "--thread",
    "thd_prov",
    "--source",
    "Provenance theorem",
    "--finding",
    "Accountable reasoning needs source lineage.",
    "--actor",
    "par_troy"
  ]);
  runCli(cwd, [
    "assumption",
    "declare",
    "--id",
    "asm_prov",
    "--thread",
    "thd_prov",
    "--text",
    "Attribution is incomplete without source lineage.",
    "--evidence",
    "evd_prov",
    "--actor",
    "par_troy"
  ]);
  runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_prov",
    "--thread",
    "thd_prov",
    "--text",
    "Provenance should be derived from event relationships.",
    "--evidence",
    "evd_prov",
    "--assumptions",
    "asm_prov",
    "--actor",
    "par_troy"
  ]);
  runCli(cwd, [
    "decision",
    "open",
    "--id",
    "drq_prov",
    "--thread",
    "thd_prov",
    "--proposal",
    "Adopt protocol provenance.",
    "--evidence",
    "evd_prov",
    "--claims",
    "clm_prov",
    "--assumptions",
    "asm_prov",
    "--actor",
    "par_troy"
  ]);
  runCli(cwd, [
    "review",
    "submit",
    "--id",
    "rev_prov",
    "--thread",
    "thd_prov",
    "--request",
    "drq_prov",
    "--reviewer",
    "par_troy",
    "--status",
    "approve"
  ]);
  runCli(cwd, [
    "decision",
    "merge",
    "--id",
    "dcr_prov",
    "--thread",
    "thd_prov",
    "--request",
    "drq_prov",
    "--decider",
    "par_troy"
  ]);
  return cwd;
}

function createForkStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-provenance-fork-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_parent",
    "--title",
    "Parent Reasoning",
    "--question",
    "Should fork reasoning preserve source lineage?",
    "--participant",
    "Troy:decision owner"
  ]);
  runCli(cwd, [
    "evidence",
    "commit",
    "--id",
    "evd_parent",
    "--thread",
    "thd_parent",
    "--source",
    "Parent source",
    "--finding",
    "Parent evidence exists before the fork."
  ]);
  const parentClaim = runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_parent",
    "--thread",
    "thd_parent",
    "--text",
    "Parent claim defines the fork boundary.",
    "--evidence",
    "evd_parent"
  ]);
  const boundaryEventId = parentClaim.event.event_id;
  runCli(cwd, [
    "thread",
    "fork",
    "--parent",
    "thd_parent",
    "--fork",
    "thd_fork",
    "--title",
    "Fork Reasoning",
    "--reason",
    "Trace inherited state.",
    "--through",
    boundaryEventId,
    "--changed-claims",
    "clm_parent",
    "--forked-by",
    "Troy"
  ]);
  return { cwd, boundaryEventId };
}

function createMergeStore() {
  const { cwd } = createForkStore();
  runCli(cwd, [
    "evidence",
    "commit",
    "--id",
    "evd_fork",
    "--thread",
    "thd_fork",
    "--source",
    "Fork source",
    "--finding",
    "Fork evidence adds source lineage."
  ]);
  runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_fork",
    "--thread",
    "thd_fork",
    "--text",
    "Fork claim should merge with provenance.",
    "--evidence",
    "evd_fork"
  ]);
  runCli(cwd, [
    "merge",
    "open",
    "--id",
    "mrg_fork_parent",
    "--source",
    "thd_fork",
    "--target",
    "thd_parent",
    "--summary",
    "Merge fork provenance.",
    "--opened-by",
    "Troy"
  ]);
  runCli(cwd, [
    "merge",
    "complete",
    "--id",
    "mcm_mrg_fork_parent",
    "--request",
    "mrg_fork_parent",
    "--merged-by",
    "Troy"
  ]);
  return cwd;
}

function runCli(cwd, args, options = {}) {
  const result = spawnSync("node", [cliPath, ...args], {
    cwd,
    encoding: "utf8"
  });
  if (!options.allowFailure) {
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  return {
    status: result.status,
    output: result.stdout ? JSON.parse(result.stdout) : null,
    stderr: result.stderr
  };
}

function readStoreEvents(cwd) {
  return readEventsAt(path.join(cwd, ".clista", "events.ndjson"));
}

function eventForContribution(events, objectName, objectId) {
  return events.find((event) => event.payload?.[objectName]?.id === objectId);
}

function makeAttributionEvent({ id, eventId, sourceEventId, provenance }) {
  return {
    event_id: eventId,
    event_type: "ContributionAttributed",
    thread_id: "thd_prov",
    actor_id: "par_troy",
    timestamp: "2026-01-01T00:00:00.000Z",
    payload: {
      contributionAttribution: {
        id,
        object: "contributionAttribution",
        contributionId: "clm_prov",
        contributionType: "claim",
        sourceEventId,
        participantId: "par_troy",
        authorityContext: {
          activeAtEventTime: true
        },
        provenance,
        attributedBy: "par_troy",
        attributedAt: "2026-01-01T00:00:00.000Z"
      }
    }
  };
}

function makeAttributionCorrection(attributionId) {
  return {
    event_id: "evt_prov_correction",
    event_type: "ContributionAttributionCorrected",
    thread_id: "thd_prov",
    actor_id: "par_troy",
    timestamp: "2026-01-01T00:01:00.000Z",
    payload: {
      attributionCorrection: {
        id: "atc_prov_claim",
        object: "attributionCorrection",
        attributionId,
        correctedRole: "contributor",
        reason: "Clarify provenance-preserving correction.",
        correctedBy: "par_troy",
        correctedAt: "2026-01-01T00:01:00.000Z"
      }
    }
  };
}

function makeAttributionDispute(attributionId) {
  return {
    event_id: "evt_prov_dispute",
    event_type: "ContributionAttributionDisputed",
    thread_id: "thd_prov",
    actor_id: "par_troy",
    timestamp: "2026-01-01T00:02:00.000Z",
    payload: {
      attributionDispute: {
        id: "atd_prov_claim",
        object: "attributionDispute",
        attributionId,
        reason: "Preserve dispute without overwriting provenance.",
        disputedBy: "par_troy",
        disputedAt: "2026-01-01T00:02:00.000Z"
      }
    }
  };
}

function makeAttributionRevocation(attributionId) {
  return {
    event_id: "evt_prov_revocation",
    event_type: "ContributionAttributionRevoked",
    thread_id: "thd_prov",
    actor_id: "par_troy",
    timestamp: "2026-01-01T00:03:00.000Z",
    payload: {
      attributionRevocation: {
        id: "atv_prov_claim",
        object: "attributionRevocation",
        attributionId,
        reason: "Revoke attribution while preserving original provenance.",
        revokedBy: "par_troy",
        revokedAt: "2026-01-01T00:03:00.000Z"
      }
    }
  };
}

function assertInvalid(events, pattern) {
  const result = validateEvents(events);
  assert.equal(result.valid, false, "expected validation to fail");
  assert.match(formatValidationErrors(result.errors), pattern);
}
