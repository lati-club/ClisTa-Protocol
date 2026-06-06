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

test("CLI attribution projection traces contributions to event-time identity and authority", () => {
  const cwd = createAttributionDecisionStore();

  const list = runCli(cwd, ["attribution", "list", "--thread", "thd_attr"]);
  assert.equal(list.schema, "clista.attribution.list.v0");
  assert.ok(list.attributions.some((record) => record.contributionId === "evd_attr"));
  assert.ok(list.attributions.some((record) => record.contributionId === "asm_attr"));
  assert.ok(list.attributions.some((record) => record.contributionId === "clm_attr"));

  const decisionAttribution = list.attributions.find((record) => record.contributionId === "dcr_attr");
  assert.equal(decisionAttribution.contributionType, "decision");
  assert.equal(decisionAttribution.participantId, "par_troy");
  assert.equal(decisionAttribution.authorityContext.requiredAuthority, "decision_owner");
  assert.equal(decisionAttribution.authorityContext.decision_owner, true);
  assert.equal(decisionAttribution.authorityContext.permitted, true);

  const claimAttribution = runCli(cwd, ["attribution", "show", "clm_attr"]);
  assert.equal(claimAttribution.contributionId, "clm_attr");
  assert.equal(claimAttribution.attributions[0].role, "contributor");
  assert.equal(claimAttribution.attributions[0].roleContext.activeAtEventTime, true);

  const byParticipant = runCli(cwd, ["attribution", "by-participant", "par_troy"]);
  assert.equal(byParticipant.participantId, "par_troy");
  assert.ok(byParticipant.attributions.some((record) => record.contributionId === "clm_attr"));
  assert.ok(byParticipant.attributions.some((record) => record.contributionId === "dcr_attr"));

  const verification = runCli(cwd, ["attribution", "verify"]);
  assert.equal(verification.valid, true);
  assert.equal(verification.attributionValidationStatus.valid, true);

  const state = selectThreadState(projectEvents(readEventsAt(path.join(cwd, ".clista", "events.ndjson"))), "thd_attr");
  assert.ok(state.reasoningState.attribution.byContribution.clm_attr.length > 0);
});

test("attribution validation rejects unknown and inactive participants", () => {
  const cwd = createAttributionDecisionStore();
  const events = readStoreEvents(cwd);
  const claimEvent = eventForContribution(events, "claim", "clm_attr");

  const unknownParticipant = clone(events);
  unknownParticipant.push(makeAttributionEvent({
    id: "atr_missing_participant",
    eventId: "evt_attr_missing_participant",
    sourceEventId: claimEvent.event_id,
    participantId: "par_missing"
  }));
  assertInvalid(unknownParticipant, /attribution references unknown participant par_missing/);

  const inactiveParticipant = clone(events);
  inactiveParticipant.push(makeParticipantDeclared("evt_par_alex_declared_late", "par_alex", "Alex"));
  inactiveParticipant.push(makeAttributionEvent({
    id: "atr_inactive_participant",
    eventId: "evt_attr_inactive_participant",
    sourceEventId: claimEvent.event_id,
    participantId: "par_alex"
  }));
  assertInvalid(inactiveParticipant, /participant par_alex was not active at contribution event time/);
});

test("attribution validation rejects invalid event-time role and future source events", () => {
  const cwd = createAttributionDecisionStore();
  const events = readStoreEvents(cwd);
  const claimEvent = eventForContribution(events, "claim", "clm_attr");

  const invalidRole = clone(events);
  invalidRole.push(makeAttributionEvent({
    id: "atr_invalid_role",
    eventId: "evt_attr_invalid_role",
    sourceEventId: claimEvent.event_id,
    participantId: "par_troy",
    role: "reviewer"
  }));
  assertInvalid(invalidRole, /attribution role reviewer was not valid at contribution event time/);

  const futureSource = clone(events);
  const claimIndex = futureSource.findIndex((event) => event.event_id === claimEvent.event_id);
  futureSource.splice(claimIndex, 0, makeAttributionEvent({
    id: "atr_future_source",
    eventId: "evt_attr_future_source",
    sourceEventId: claimEvent.event_id,
    participantId: "par_troy"
  }));
  assertInvalid(futureSource, /attribution cannot reference future event/);
});

test("attribution corrections, disputes, and revocations are preserved", () => {
  const cwd = createAttributionDecisionStore();
  const events = readStoreEvents(cwd);
  const claimEvent = eventForContribution(events, "claim", "clm_attr");
  const attributionId = `atr_${claimEvent.event_id}`;

  events.push(makeAttributionCorrection(attributionId));
  events.push(makeAttributionDispute(attributionId));
  events.push(makeAttributionRevocation(attributionId));

  const result = validateEvents(events);
  assert.equal(result.valid, true, formatValidationErrors(result.errors));

  const projection = projectEvents(events);
  const claimAttribution = projection.attribution.byContribution.clm_attr[0];
  assert.equal(claimAttribution.status, "revoked");
  assert.equal(projection.attribution.corrections.length, 1);
  assert.equal(projection.attribution.disputes.length, 1);
  assert.equal(projection.attribution.revocations.length, 1);
});

test("legacy event logs remain attributable without explicit ContributionAttributed events", () => {
  const events = readEventsAt(canonicalLog);
  const validation = validateEvents(events);
  assert.equal(validation.valid, true, formatValidationErrors(validation.errors));

  const projection = projectEvents(events);
  assert.ok(projection.attribution.attributions.length > 0);
  assert.ok(projection.attribution.byParticipant.par_troy.length > 0);
  assert.equal(projection.attribution.attributionValidationStatus.valid, true);
});

function createAttributionDecisionStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-attribution-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "participant",
    "declare",
    "--id",
    "par_troy",
    "--name",
    "Troy"
  ]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_attr",
    "--title",
    "Attribution Thread",
    "--question",
    "Can ClisTa trace accountable reasoning?",
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
    "thd_attr"
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
    "thd_attr"
  ]);
  runCli(cwd, [
    "evidence",
    "commit",
    "--id",
    "evd_attr",
    "--thread",
    "thd_attr",
    "--source",
    "Attribution theorem",
    "--finding",
    "Accountable reasoning needs contribution traces.",
    "--actor",
    "par_troy"
  ]);
  runCli(cwd, [
    "assumption",
    "declare",
    "--id",
    "asm_attr",
    "--thread",
    "thd_attr",
    "--text",
    "Event-time identity is enough to attribute a contribution.",
    "--evidence",
    "evd_attr",
    "--actor",
    "par_troy"
  ]);
  runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_attr",
    "--thread",
    "thd_attr",
    "--text",
    "Attribution should be derived from the event log.",
    "--evidence",
    "evd_attr",
    "--assumptions",
    "asm_attr",
    "--actor",
    "par_troy"
  ]);
  runCli(cwd, [
    "decision",
    "open",
    "--id",
    "drq_attr",
    "--thread",
    "thd_attr",
    "--proposal",
    "Adopt protocol attribution.",
    "--evidence",
    "evd_attr",
    "--claims",
    "clm_attr",
    "--assumptions",
    "asm_attr",
    "--actor",
    "par_troy"
  ]);
  runCli(cwd, [
    "review",
    "submit",
    "--id",
    "rev_attr",
    "--thread",
    "thd_attr",
    "--request",
    "drq_attr",
    "--reviewer",
    "par_troy",
    "--status",
    "approve"
  ]);
  runCli(cwd, [
    "decision",
    "merge",
    "--id",
    "dcr_attr",
    "--thread",
    "thd_attr",
    "--request",
    "drq_attr",
    "--decider",
    "par_troy"
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

function makeAttributionEvent({ id, eventId, sourceEventId, participantId, role }) {
  const contributionAttribution = {
    id,
    object: "contributionAttribution",
    contributionId: "clm_attr",
    contributionType: "claim",
    sourceEventId,
    participantId,
    role,
    authorityContext: {
      activeAtEventTime: true
    },
    provenance: {
      sourceType: "event_log",
      sourceRef: sourceEventId
    },
    attributedBy: "par_troy",
    attributedAt: "2026-01-01T00:00:00.000Z"
  };
  stripUndefined(contributionAttribution);
  return {
    event_id: eventId,
    event_type: "ContributionAttributed",
    thread_id: "thd_attr",
    actor_id: "par_troy",
    timestamp: "2026-01-01T00:00:00.000Z",
    payload: { contributionAttribution }
  };
}

function makeAttributionCorrection(attributionId) {
  return {
    event_id: "evt_attr_correction",
    event_type: "ContributionAttributionCorrected",
    thread_id: "thd_attr",
    actor_id: "par_troy",
    timestamp: "2026-01-01T00:01:00.000Z",
    payload: {
      attributionCorrection: {
        id: "atc_claim",
        object: "attributionCorrection",
        attributionId,
        correctedRole: "contributor",
        reason: "Clarify the event-time contributor role.",
        correctedBy: "par_troy",
        correctedAt: "2026-01-01T00:01:00.000Z"
      }
    }
  };
}

function makeAttributionDispute(attributionId) {
  return {
    event_id: "evt_attr_dispute",
    event_type: "ContributionAttributionDisputed",
    thread_id: "thd_attr",
    actor_id: "par_troy",
    timestamp: "2026-01-01T00:02:00.000Z",
    payload: {
      attributionDispute: {
        id: "atd_claim",
        object: "attributionDispute",
        attributionId,
        reason: "Preserve a dispute without overwriting the attribution.",
        disputedBy: "par_troy",
        disputedAt: "2026-01-01T00:02:00.000Z"
      }
    }
  };
}

function makeAttributionRevocation(attributionId) {
  return {
    event_id: "evt_attr_revocation",
    event_type: "ContributionAttributionRevoked",
    thread_id: "thd_attr",
    actor_id: "par_troy",
    timestamp: "2026-01-01T00:03:00.000Z",
    payload: {
      attributionRevocation: {
        id: "atv_claim",
        object: "attributionRevocation",
        attributionId,
        reason: "Retract this explicit attribution trail while preserving the audit.",
        revokedBy: "par_troy",
        revokedAt: "2026-01-01T00:03:00.000Z"
      }
    }
  };
}

function makeParticipantDeclared(eventId, participantId, name) {
  return {
    event_id: eventId,
    event_type: "ParticipantDeclared",
    thread_id: "thd_attr",
    actor_id: participantId,
    timestamp: "2026-01-01T00:00:30.000Z",
    payload: {
      participant: {
        id: participantId,
        object: "participant",
        kind: "human",
        name,
        declaredBy: participantId,
        declaredAt: "2026-01-01T00:00:30.000Z"
      }
    }
  };
}

function assertInvalid(events, pattern) {
  const result = validateEvents(events);
  assert.equal(result.valid, false, "expected validation to fail");
  assert.match(formatValidationErrors(result.errors), pattern);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripUndefined(object) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) {
      delete object[key];
    }
  }
  return object;
}
