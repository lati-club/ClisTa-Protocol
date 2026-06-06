const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const protocolSchema = require("../schemas/clista-protocol.schema.json");
const {
  buildReviewCompletion,
  buildReviewRequirement
} = require("../src/review");
const { exportProtocol, projectEvents } = require("../src/projector");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");

test("protocol review require, open, complete, dispute, violation, list, show, verify, state, and export route review without approval", () => {
  const cwd = createReviewStore();
  const required = runCli(cwd, [
    "review",
    "require",
    "--thread",
    "thd_review",
    "--subject",
    "evd_review_subject",
    "--subject-type",
    "evidence",
    "--trigger",
    "state_change",
    "--reason",
    "Evidence change requires review before reuse",
    "--required-reviewer-role",
    "reviewer",
    "--actor",
    "Reviewer"
  ]);
  const opened = runCli(cwd, ["review", "open", "--review", required.protocolReview.id, "--actor", "Reviewer"]);
  const completed = runCli(cwd, [
    "review",
    "complete",
    "--review",
    required.protocolReview.id,
    "--summary",
    "Reviewed the evidence routing need without approving a state change",
    "--reviewer",
    "Reviewer"
  ]);
  const disputed = runCli(cwd, [
    "review",
    "dispute",
    "--review",
    required.protocolReview.id,
    "--reason",
    "Review scope may be too broad",
    "--actor",
    "Reviewer"
  ]);
  const violation = runCli(cwd, [
    "review",
    "violation",
    "--review",
    required.protocolReview.id,
    "--type",
    "approval_conflation",
    "--reason",
    "A reviewed status was described as approval",
    "--actor",
    "Reviewer"
  ]);
  const listed = runCli(cwd, ["review", "list", "--thread", "thd_review"]);
  const shown = runCli(cwd, ["review", "show", required.protocolReview.id]);
  const verified = runCli(cwd, ["review", "verify"]);
  const state = runCli(cwd, ["state", "show", "--thread", "thd_review"]);
  const exported = runCli(cwd, ["export"]);

  assert.equal(required.required, true);
  assert.equal(required.protocolReview.required, true);
  assert.equal(required.protocolReview.status, "required");
  assert.equal(opened.opened, true);
  assert.equal(opened.protocolReview.status, "open");
  assert.equal(completed.completed, true);
  assert.equal(completed.protocolReviewCompletion.completionStatus, "reviewed");
  assert.equal(disputed.disputed, true);
  assert.equal(violation.violated, true);
  assert.equal(listed.count, 1);
  assert.equal(shown.review.id, required.protocolReview.id);
  assert.equal(shown.review.status, "violated");
  assert.equal(shown.completions[0].id, completed.protocolReviewCompletion.id);
  assert.equal(verified.valid, true);
  assert.equal(verified.reviewValidationStatus.recordCount, 1);
  assert.equal(verified.reviewValidationStatus.pendingRequiredCount, 0);
  assert.equal(verified.reviewValidationStatus.reviewAsApproval, false);
  assert.equal(state.reasoningState.review.records[0].id, required.protocolReview.id);
  assert.equal(exported.review.records[0].id, required.protocolReview.id);
  assert.equal(exported.review.hardLaw, "review != approval");
});

test("protocol review validation rejects unknown reviewed subjects", () => {
  const events = [
    ...baseReviewEvents(),
    event("evt_review_required_unknown_subject", "ReviewRequired", "par_troy", {
      protocolReview: buildReviewRequirement({
        id: "prv_unknown_subject",
        threadId: "thd_review",
        subjectType: "evidence",
        subjectId: "evd_missing",
        triggerType: "state_change",
        reason: "Missing subject cannot be reviewed",
        requiredReviewerRole: "reviewer",
        requiredByParticipantId: "par_troy",
        requiredAt: "2026-06-06T00:03:00.000Z"
      })
    }, "2026-06-06T00:03:00.000Z")
  ];
  const validation = validateEvents(events);

  assert.equal(validation.valid, false);
  assert.match(formatValidationErrors(validation.errors), /review subject does not exist: evidence:evd_missing/);
});

test("protocol review validation rejects approval and mutation fields", () => {
  const requirement = buildReviewRequirement({
    id: "prv_guarded",
    threadId: "thd_review",
    subjectType: "evidence",
    subjectId: "evd_review_subject",
    triggerType: "state_change",
    reason: "Review cannot become approval",
    requiredReviewerRole: "reviewer",
    requiredByParticipantId: "par_troy",
    requiredAt: "2026-06-06T00:03:00.000Z"
  });
  const completion = {
    ...buildReviewCompletion({
      id: "prc_guarded",
      reviewId: requirement.id,
      threadId: "thd_review",
      summary: "This review was examined.",
      completedByParticipantId: "par_troy",
      completedAt: "2026-06-06T00:04:00.000Z"
    }),
    completionStatus: "approved",
    approved: true,
    governanceMutation: true,
    authorityCreated: true,
    amendmentApproval: true,
    stateMutation: true
  };
  const validation = validateEvents([
    ...baseReviewEvents(),
    event("evt_review_required_guarded", "ReviewRequired", "par_troy", { protocolReview: requirement }, "2026-06-06T00:03:00.000Z"),
    event("evt_review_completed_guarded", "ReviewCompleted", "par_troy", { protocolReviewCompletion: completion }, "2026-06-06T00:04:00.000Z")
  ]);
  const message = formatValidationErrors(validation.errors);

  assert.equal(validation.valid, false);
  assert.match(message, /protocol review completion status must be reviewed/);
  assert.match(message, /protocol review field approved must be false or absent/);
  assert.match(message, /protocol review field governanceMutation must be false or absent/);
  assert.match(message, /protocol review field authorityCreated must be false or absent/);
});

test("protocol review projects deterministically into state and export", () => {
  const requirement = buildReviewRequirement({
    id: "prv_projected",
    threadId: "thd_review",
    subjectType: "evidence",
    subjectId: "evd_review_subject",
    triggerType: "state_change",
    reason: "Project required review",
    requiredReviewerRole: "reviewer",
    requiredByParticipantId: "par_troy",
    requiredAt: "2026-06-06T00:03:00.000Z"
  });
  const events = [
    ...baseReviewEvents(),
    event("evt_review_required_projected", "ReviewRequired", "par_troy", { protocolReview: requirement }, "2026-06-06T00:03:00.000Z")
  ];
  const first = projectEvents(events).review;
  const second = projectEvents(events).review;
  const exported = exportProtocol(projectEvents(events));

  assert.deepEqual(first, second);
  assert.equal(first.required[0].id, requirement.id);
  assert.equal(first.reviewValidationStatus.pendingRequiredCount, 1);
  assert.equal(exported.review.records[0].status, "required");
});

test("protocol review export schema declares review projection and events", () => {
  assert.ok(protocolSchema.required.includes("review"));
  assert.equal(protocolSchema.properties.review.$ref, "#/$defs/reviewProjection");
  assert.equal(protocolSchema.$defs.reviewProjection.properties.records.items.$ref, "#/$defs/protocolReview");
  assert.equal(protocolSchema.$defs.reviewProjection.properties.completions.items.$ref, "#/$defs/protocolReviewCompletion");
  assert.ok(protocolSchema.$defs.event.properties.event_type.enum.includes("ReviewRequired"));
  assert.ok(protocolSchema.$defs.event.properties.event_type.enum.includes("ReviewCompleted"));
});

function createReviewStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-review-"));
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_review",
    "--title",
    "Protocol Review",
    "--question",
    "Can required review route state changes?",
    "--actor",
    "Troy"
  ]);
  runCli(cwd, [
    "evidence",
    "commit",
    "--thread",
    "thd_review",
    "--id",
    "evd_review_subject",
    "--source",
    "Fixture",
    "--finding",
    "Review subject exists",
    "--actor",
    "Troy"
  ]);
  return cwd;
}

function baseReviewEvents() {
  return [
    event("evt_review_participant_troy", "ParticipantAdded", "par_troy", {
      participant: {
        id: "par_troy",
        object: "participant",
        kind: "human",
        name: "Troy"
      }
    }, "2026-06-06T00:00:00.000Z"),
    event("evt_review_thread", "ThreadCreated", "par_troy", {
      thread: {
        id: "thd_review",
        object: "thread",
        title: "Protocol Review",
        question: "Can required review route state changes?",
        status: "active",
        participantIds: ["par_troy"],
        createdAt: "2026-06-06T00:01:00.000Z",
        updatedAt: "2026-06-06T00:01:00.000Z"
      }
    }, "2026-06-06T00:01:00.000Z"),
    event("evt_review_evidence", "EvidenceCommitted", "par_troy", {
      evidence: {
        id: "evd_review_subject",
        object: "evidence",
        threadId: "thd_review",
        source: "Fixture",
        finding: "Review subject exists",
        committedByParticipantId: "par_troy",
        committedAt: "2026-06-06T00:02:00.000Z"
      }
    }, "2026-06-06T00:02:00.000Z")
  ];
}

function event(id, type, actorId, payload, timestamp = "2026-06-06T00:00:00.000Z") {
  return {
    event_id: id,
    event_type: type,
    thread_id: "thd_review",
    actor_id: actorId,
    timestamp,
    payload
  };
}

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], {
    cwd,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
