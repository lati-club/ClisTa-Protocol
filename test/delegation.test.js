const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const protocolSchema = require("../schemas/clista-protocol.schema.json");
const {
  buildDelegatedAction,
  buildDelegationExpiration,
  buildDelegationGrant,
  buildDelegationRevocation,
  buildDelegationViolation
} = require("../src/delegation");
const { readEvents } = require("../src/events");
const { exportProtocol, projectEvents, selectThreadState } = require("../src/projector");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");

test("delegation grant, record, list, show, revoke, verify, state, and export preserve scoped action", () => {
  const cwd = createDelegationStore();

  const granted = runCli(cwd, [
    "delegation",
    "grant",
    "--thread",
    "thd_delegation",
    "--delegator",
    "Troy",
    "--delegate",
    "Reviewer",
    "--action",
    "verify",
    "--scope",
    "thread:thd_delegation",
    "--limit",
    "Verify continuity export only",
    "--summary",
    "Delegate scoped verification"
  ]);
  const recorded = runCli(cwd, [
    "delegation",
    "record",
    "--delegation",
    granted.delegationGrant.id,
    "--summary",
    "Reviewer verified the exported continuity packet"
  ]);
  const listed = runCli(cwd, ["delegation", "list", "--thread", "thd_delegation"]);
  const shown = runCli(cwd, ["delegation", "show", granted.delegationGrant.id]);
  const revoked = runCli(cwd, [
    "delegation",
    "revoke",
    "--delegation",
    granted.delegationGrant.id,
    "--reason",
    "Verification completed"
  ]);
  const verified = runCli(cwd, ["delegation", "verify"]);
  const state = runCli(cwd, ["state", "show", "--thread", "thd_delegation"]);
  const exported = runCli(cwd, ["export"]);

  assert.equal(granted.granted, true);
  assert.equal(granted.delegationGrant.status, "active");
  assert.equal(granted.delegationGrant.attributionRequired, true);
  assert.equal(granted.delegationGrant.authorityTransfer, false);
  assert.equal(recorded.delegatedAction.delegationId, granted.delegationGrant.id);
  assert.equal(recorded.delegatedAction.attribution.delegateId, "par_reviewer");
  assert.equal(listed.count, 1);
  assert.equal(shown.actions[0].id, recorded.delegatedAction.id);
  assert.equal(revoked.revoked, true);
  assert.equal(verified.valid, true);
  assert.equal(verified.delegationValidationStatus.grantCount, 1);
  assert.equal(verified.delegationValidationStatus.actionCount, 1);
  assert.equal(verified.delegationValidationStatus.revocationCount, 1);
  assert.equal(state.reasoningState.delegation.revokedGrants.length, 1);
  assert.equal(exported.delegation.revokedGrants[0].id, granted.delegationGrant.id);
});

test("delegation validation rejects unauthorized grants and guard-field authority transfer", () => {
  const cwd = createDelegationStore();
  const events = [
    ...readEvents(cwd),
    event("evt_unauthorized_delegation", "DelegationGranted", "par_reviewer", {
      delegationGrant: {
        ...grant({
          id: "dlg_unauthorized",
          delegatorParticipantId: "par_reviewer",
          delegateId: "par_worker"
        }),
        authorityTransfer: true
      }
    })
  ];
  const validation = validateEvents(events);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /delegation grant requires decision_owner authority par_reviewer/);
  assert.match(message, /delegation field authorityTransfer must be false/);
});

test("delegation validation normalizes participant delegate type before checking participant existence", () => {
  const cwd = createDelegationStore();
  const events = [
    ...readEvents(cwd),
    event("evt_unknown_delegate_type_case", "DelegationGranted", "par_troy", {
      delegationGrant: {
        ...grant({
          id: "dlg_unknown_delegate_type_case",
          delegateId: "par_missing"
        }),
        delegateType: "Participant"
      }
    })
  ];
  const validation = validateEvents(events);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /delegation grant references unknown delegate par_missing/);
});

test("delegation validation rejects action after revocation and action outside scope", () => {
  const cwd = createDelegationStore();
  const grantRecord = grant({ id: "dlg_revoked_scope" });
  const revoked = buildDelegationRevocation({
    id: "dlr_revoked_scope",
    delegationId: grantRecord.id,
    threadId: "thd_delegation",
    revokedByParticipantId: "par_troy",
    reason: "Stop delegated verification",
    revokedAt: "2026-06-06T00:10:00.000Z"
  });
  const action = buildDelegatedAction({
    id: "dla_after_revocation",
    delegationId: grantRecord.id,
    threadId: "thd_delegation",
    delegateId: "par_reviewer",
    action: "approve",
    scope: "thread:thd_other",
    summary: "Attempted an ungranted action",
    recordedAt: "2026-06-06T00:11:00.000Z"
  });
  const events = [
    ...readEvents(cwd),
    event("evt_grant_revoked_scope", "DelegationGranted", "par_troy", { delegationGrant: grantRecord }),
    event("evt_revoke_scope", "DelegationRevoked", "par_troy", { delegationRevocation: revoked }),
    event("evt_action_after_revocation", "DelegatedActionRecorded", "par_reviewer", { delegatedAction: action })
  ];
  const validation = validateEvents(events);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /delegated action references revoked delegation dlg_revoked_scope/);
  assert.match(message, /delegated action must match granted action/);
  assert.match(message, /delegated action must stay within granted scope/);
});

test("delegation expiration and violation project deterministically", () => {
  const cwd = createDelegationStore();
  const expiredGrant = grant({ id: "dlg_expiring", delegateId: "par_reviewer" });
  const violatedGrant = grant({ id: "dlg_violated", delegateId: "par_worker" });
  const expiration = buildDelegationExpiration({
    id: "dle_expiring",
    delegationId: expiredGrant.id,
    threadId: "thd_delegation",
    expiredAt: "2026-06-06T01:00:00.000Z",
    reason: "Expiration reached"
  });
  const violation = buildDelegationViolation({
    id: "dlv_violated",
    delegationId: violatedGrant.id,
    threadId: "thd_delegation",
    violationType: "scope_exceeded",
    reason: "Delegate attempted action outside scope",
    detectedByParticipantId: "par_troy",
    detectedAt: "2026-06-06T01:05:00.000Z"
  });
  const events = [
    ...readEvents(cwd),
    event("evt_grant_expiring", "DelegationGranted", "par_troy", { delegationGrant: expiredGrant }),
    event("evt_expiring", "DelegationExpired", "par_troy", { delegationExpiration: expiration }),
    event("evt_grant_violated", "DelegationGranted", "par_troy", { delegationGrant: violatedGrant }),
    event("evt_violated", "DelegationViolationRecorded", "par_troy", { delegationViolation: violation })
  ];
  const validation = validateEvents(events);
  const projected = projectEvents(events).delegation;

  assert.equal(validation.valid, true, formatValidationErrors(validation.errors));
  assert.equal(projected.expiredGrants[0].id, expiredGrant.id);
  assert.equal(projected.violatedGrants[0].id, violatedGrant.id);
  assert.equal(projected.expirationsByDelegation[expiredGrant.id][0].id, expiration.id);
  assert.equal(projected.violationsByDelegation[violatedGrant.id][0].id, violation.id);
});

test("export schema defines delegation records and exported delegation records satisfy it", () => {
  const cwd = createDelegationStore();
  const granted = runCli(cwd, [
    "delegation",
    "grant",
    "--thread",
    "thd_delegation",
    "--delegator",
    "Troy",
    "--delegate",
    "Reviewer",
    "--action",
    "review",
    "--scope",
    "thread:thd_delegation",
    "--limit",
    "Review only the projected state"
  ]);
  runCli(cwd, [
    "delegation",
    "record",
    "--delegation",
    granted.delegationGrant.id,
    "--summary",
    "Reviewer completed scoped state review"
  ]);
  const exported = exportProtocol(projectEvents(readEvents(cwd)));
  const projectionSchema = protocolSchema.$defs.delegationProjection;

  assert.deepEqual(protocolSchema.$defs.delegationStatus.enum, [
    "active",
    "revoked",
    "expired",
    "violated"
  ]);
  assert.equal(projectionSchema.properties.grants.items.$ref, "#/$defs/delegationGrant");
  assert.equal(projectionSchema.properties.actions.items.$ref, "#/$defs/delegatedAction");
  assertRecordMatchesDefinition(protocolSchema.$defs.delegationGrant, exported.delegation.grants[0]);
  assertRecordMatchesDefinition(protocolSchema.$defs.delegatedAction, exported.delegation.actions[0]);
});

function createDelegationStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-delegation-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_delegation",
    "--title",
    "Delegation Thread",
    "--question",
    "Can action be delegated without surrendering authority?",
    "--participant",
    "Troy:decision_owner",
    "--participant",
    "Reviewer:delegated_actor",
    "--participant",
    "Worker:delegated_actor"
  ]);
  return cwd;
}

function grant(options = {}) {
  return buildDelegationGrant({
    id: options.id || "dlg_verify_thread",
    threadId: "thd_delegation",
    delegatorParticipantId: options.delegatorParticipantId || "par_troy",
    delegateId: options.delegateId || "par_reviewer",
    delegateType: "participant",
    action: options.action || "verify",
    scope: options.scope || "thread:thd_delegation",
    limits: ["Verify only the delegated thread state"],
    grantedAt: "2026-06-06T00:00:00.000Z",
    expiresAt: options.expiresAt
  });
}

function event(eventId, eventType, actorId, payload, timestamp = "2026-06-06T00:00:00.000Z") {
  return {
    event_id: eventId,
    event_type: eventType,
    thread_id: "thd_delegation",
    actor_id: actorId,
    timestamp,
    payload
  };
}

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function assertRecordMatchesDefinition(definition, record) {
  assert.ok(record);
  for (const field of definition.required || []) {
    assert.ok(Object.hasOwn(record, field), `${record.object || "record"} missing ${field}`);
  }
  for (const [field, property] of Object.entries(definition.properties || {})) {
    if (!Object.hasOwn(record, field)) {
      continue;
    }
    if (Object.hasOwn(property, "const")) {
      assert.equal(record[field], property.const);
    }
    if (property.$ref === "#/$defs/delegationStatus") {
      assert.ok(protocolSchema.$defs.delegationStatus.enum.includes(record[field]));
    }
    if (property.$ref === "#/$defs/delegateType") {
      assert.ok(protocolSchema.$defs.delegateType.enum.includes(record[field]));
    }
    if (property.minLength) {
      assert.ok(String(record[field]).length >= property.minLength);
    }
  }
}
