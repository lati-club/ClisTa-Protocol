const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { readEventsAt } = require("../src/events");
const { exportProtocol, projectEvents, selectThreadState } = require("../src/projector");
const { formatValidationErrors, validateEvents } = require("../src/validator");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const canonicalLog = path.join(root, ".clista", "events.ndjson");

test("adaptation review derives deterministic governance recommendations from learning signals", () => {
  const cwd = createAdaptationOutcomeStore();

  const first = runCli(cwd, ["adaptation", "review", "--thread", "thd_adaptation"]);
  const second = runCli(cwd, ["adaptation", "review", "--thread", "thd_adaptation"]);
  assert.deepEqual(first.adaptation.recommendations, second.adaptation.recommendations);

  assert.equal(first.schema, "clista.adaptation.review.v0");
  assert.equal(first.hardLaw, "adaptation != governance mutation");
  assert.ok(first.adaptation.recommendations.length >= 5);
  assert.ok(first.adaptation.recommendations.some((recommendation) => {
    return recommendation.recommendationType === "revisit_trigger_review";
  }));
  assert.ok(first.adaptation.recommendations.some((recommendation) => {
    return recommendation.recommendationType === "evidence_requirement_review";
  }));
  assert.ok(first.adaptation.recommendations.some((recommendation) => {
    return recommendation.recommendationType === "decision_gate_review";
  }));
  assert.ok(first.adaptation.provenanceRequirementReviewRecommendations.length > 0);
  assert.ok(first.adaptation.objectionResolutionReviewRecommendations.length > 0);

  for (const recommendation of first.adaptation.recommendations) {
    assert.equal(recommendation.authorityMutation, false);
    assert.equal(recommendation.governanceMutation, false);
    assert.equal(recommendation.ruleMutation, false);
    assert.equal(recommendation.thresholdMutation, false);
    assert.equal(recommendation.participantScoring, false);
    assert.equal(recommendation.sourceScoring, false);
    assert.equal(recommendation.modelRanking, false);
    assert.ok(["low", "medium", "high"].includes(recommendation.confidence));
    assert.equal(Object.prototype.hasOwnProperty.call(recommendation, "participantScore"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(recommendation, "sourceScore"), false);
  }
});

test("adaptation CLI lists, shows, verifies, exports, and projects into thread state", () => {
  const cwd = createAdaptationOutcomeStore();

  const list = runCli(cwd, ["adaptation", "list", "--thread", "thd_adaptation"]);
  assert.equal(list.schema, "clista.adaptation.list.v0");
  assert.ok(list.count > 0);

  const shown = runCli(cwd, ["adaptation", "show", list.recommendations[0].id]);
  assert.equal(shown.schema, "clista.adaptation.item.v0");
  assert.equal(shown.item.id, list.recommendations[0].id);

  const verify = runCli(cwd, ["adaptation", "verify"]);
  assert.equal(verify.valid, true);
  assert.equal(verify.adaptationValidationStatus.governanceMutation, false);
  assert.equal(verify.adaptationValidationStatus.ruleMutation, false);
  assert.equal(verify.adaptationValidationStatus.thresholdMutation, false);
  assert.equal(verify.adaptationValidationStatus.participantScoring, false);
  assert.equal(verify.adaptationValidationStatus.sourceScoring, false);
  assert.equal(verify.adaptationValidationStatus.modelRanking, false);

  const state = runCli(cwd, ["state", "show", "--thread", "thd_adaptation"]);
  assert.equal(state.reasoningState.adaptation.hardLaw, "adaptation != governance mutation");
  assert.equal(state.reasoningState.adaptation.recommendations.length, list.count);

  const projection = projectEvents(readStoreEvents(cwd));
  const threadState = selectThreadState(projection, "thd_adaptation");
  assert.equal(threadState.reasoningState.adaptation.recommendations.length, list.count);

  const exported = exportProtocol(projection);
  assert.equal(exported.adaptation.hardLaw, "adaptation != governance mutation");
  assert.equal(exported.adaptationRecommendations.length, projection.adaptation.recommendations.length);
});

test("explicit adaptation events project without mutating governance", () => {
  const cwd = createAdaptationOutcomeStore();
  const events = readStoreEvents(cwd);
  events.push(makeLearningSignalEvent({ id: "lrn_explicit_adaptation_pattern" }));
  events.push(makeAdaptationReviewEvent());
  events.push(makeAdaptationRecommendationEvent({
    eventType: "GovernanceReviewRecommended",
    payloadKey: "governanceReviewRecommendation",
    id: "adp_explicit_governance_review",
    recommendationType: "governance_review"
  }));
  events.push(makeAdaptationRecommendationEvent({
    eventType: "EvidenceRequirementReviewRecommended",
    payloadKey: "evidenceRequirementReviewRecommendation",
    id: "adp_explicit_evidence_review",
    recommendationType: "evidence_requirement_review"
  }));
  events.push(makeAdaptationRecommendationEvent({
    eventType: "RevisitTriggerReviewRecommended",
    payloadKey: "revisitTriggerReviewRecommendation",
    id: "adp_explicit_revisit_review",
    recommendationType: "revisit_trigger_review"
  }));
  events.push(makeAdaptationRecommendationEvent({
    eventType: "DecisionGateReviewRecommended",
    payloadKey: "decisionGateReviewRecommendation",
    id: "adp_explicit_decision_gate_review",
    recommendationType: "decision_gate_review"
  }));

  const validation = validateEvents(events);
  assert.equal(validation.valid, true, formatValidationErrors(validation.errors));

  const projected = projectEvents(events).adaptation;
  assert.equal(projected.byRecommendation.adp_explicit_governance_review.explicit, true);
  assert.equal(projected.byRecommendation.adp_explicit_governance_review.governanceMutation, false);
  assert.equal(projected.byRecommendation.adp_explicit_governance_review.authorityMutation, false);
  assert.equal(projected.reviews.some((review) => review.id === "adr_explicit_review"), true);
});

test("AdaptationReviewRecorded with a missing payload is rejected (regression: was fail-open)", () => {
  // Before the dispatch fix, AdaptationReviewRecorded shared a no-op `case` with
  // ObjectDeprecated and its validator call sat after an unconditional `break`, so
  // the event type validated clean no matter the payload. Guard that hole.
  const cwd = createAdaptationOutcomeStore();
  const events = readStoreEvents(cwd);
  events.push(makeLearningSignalEvent({ id: "lrn_explicit_adaptation_pattern" }));
  events.push({
    event_id: "evt_malformed_adaptation_review",
    event_type: "AdaptationReviewRecorded",
    thread_id: "thd_adaptation",
    actor_id: "par_troy",
    timestamp: "2027-03-03T00:00:00.000Z",
    payload: {}
  });
  assertInvalid(events, /AdaptationReviewRecorded payload missing adaptationReview/);
});

test("adaptation validation rejects governance mutation and scoring", () => {
  const cwd = createAdaptationOutcomeStore();
  const events = readStoreEvents(cwd);
  const explicitLearning = makeLearningSignalEvent({ id: "lrn_explicit_adaptation_pattern" });

  assertInvalid([
    ...events,
    explicitLearning,
    makeAdaptationRecommendationEvent({
      id: "adp_bad_participant_score",
      participantScore: 0.2
    })
  ], /adaptation cannot automatically mutate governance or score actors via participantScore/);

  assertInvalid([
    ...events,
    explicitLearning,
    makeAdaptationRecommendationEvent({
      id: "adp_bad_source_score",
      sourceScores: {
        launch_plan: 0.1
      }
    })
  ], /adaptation cannot automatically mutate governance or score actors via sourceScores/);

  assertInvalid([
    ...events,
    explicitLearning,
    makeAdaptationRecommendationEvent({
      id: "adp_bad_model_ranking",
      modelRanking: true
    })
  ], /adaptation field modelRanking must be false/);

  assertInvalid([
    ...events,
    explicitLearning,
    makeAdaptationRecommendationEvent({
      id: "adp_bad_governance_mutation",
      governanceMutation: true
    })
  ], /adaptation field governanceMutation must be false/);

  assertInvalid([
    ...events,
    explicitLearning,
    makeAdaptationRecommendationEvent({
      id: "adp_bad_rule_mutation",
      ruleMutation: true
    })
  ], /adaptation field ruleMutation must be false/);

  assertInvalid([
    ...events,
    explicitLearning,
    makeAdaptationRecommendationEvent({
      id: "adp_bad_threshold_mutation",
      thresholdMutation: true
    })
  ], /adaptation field thresholdMutation must be false/);
});

test("adaptation validation rejects future learning references and missing uncertainty", () => {
  const cwd = createAdaptationOutcomeStore();
  const events = readStoreEvents(cwd);

  assertInvalid([
    ...events,
    makeAdaptationRecommendationEvent({ id: "adp_future_learning_signal" }),
    makeLearningSignalEvent({ id: "lrn_explicit_adaptation_pattern" })
  ], /adaptation references unknown or future learning signal lrn_explicit_adaptation_pattern/);

  assertInvalid([
    ...events,
    makeLearningSignalEvent({ id: "lrn_explicit_adaptation_pattern" }),
    makeAdaptationRecommendationEvent({
      id: "adp_missing_confidence",
      confidence: "certain"
    })
  ], /governance review recommendation requires confidence low, medium, or high/);
});

test("legacy event logs remain adaptation-compatible without outcomes", () => {
  const events = readEventsAt(canonicalLog);
  const validation = validateEvents(events);
  assert.equal(validation.valid, true, formatValidationErrors(validation.errors));

  const projection = projectEvents(events);
  assert.equal(projection.adaptation.adaptationValidationStatus.valid, true);
  assert.equal(projection.adaptation.recommendations.length, 0);
});

function createAdaptationOutcomeStore() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-adaptation-"));
  runCli(cwd, ["init"]);
  runCli(cwd, [
    "thread",
    "create",
    "--id",
    "thd_adaptation",
    "--title",
    "Adaptation Thread",
    "--question",
    "Can ClisTa recommend governance review without mutation?",
    "--participant",
    "Troy:decision owner"
  ]);
  runCli(cwd, [
    "evidence",
    "commit",
    "--id",
    "evd_capacity",
    "--thread",
    "thd_adaptation",
    "--source",
    "Launch plan",
    "--finding",
    "Capacity was expected to support launch growth."
  ]);
  runCli(cwd, [
    "assumption",
    "declare",
    "--id",
    "asm_capacity",
    "--thread",
    "thd_adaptation",
    "--text",
    "Capacity will support launch growth.",
    "--evidence",
    "evd_capacity"
  ]);
  runCli(cwd, [
    "claim",
    "create",
    "--id",
    "clm_growth",
    "--thread",
    "thd_adaptation",
    "--text",
    "The launch should grow revenue.",
    "--evidence",
    "evd_capacity",
    "--assumptions",
    "asm_capacity"
  ]);
  runCli(cwd, [
    "decision",
    "open",
    "--id",
    "drq_launch",
    "--thread",
    "thd_adaptation",
    "--proposal",
    "Launch in Q4.",
    "--evidence",
    "evd_capacity",
    "--claims",
    "clm_growth",
    "--assumptions",
    "asm_capacity"
  ]);
  runCli(cwd, [
    "review",
    "submit",
    "--id",
    "rev_launch",
    "--thread",
    "thd_adaptation",
    "--request",
    "drq_launch",
    "--reviewer",
    "Troy",
    "--status",
    "approve",
    "--comment",
    "Proceed, but audit capacity after launch."
  ]);
  runCli(cwd, [
    "decision",
    "merge",
    "--id",
    "dcr_launch",
    "--thread",
    "thd_adaptation",
    "--request",
    "drq_launch",
    "--decider",
    "Troy"
  ]);
  runCli(cwd, [
    "outcome",
    "expect",
    "--id",
    "exo_growth",
    "--thread",
    "thd_adaptation",
    "--decision",
    "dcr_launch",
    "--metric",
    "growth",
    "--operator",
    ">",
    "--target",
    "0.15",
    "--review-date",
    "2027-03-01",
    "--assumptions",
    "asm_capacity",
    "--evidence",
    "evd_capacity",
    "--description",
    "Growth should exceed 15%."
  ]);
  runCli(cwd, [
    "outcome",
    "audit",
    "--id",
    "out_growth",
    "--thread",
    "thd_adaptation",
    "--expected",
    "exo_growth",
    "--actual",
    "0.08",
    "--result",
    "failed",
    "--summary",
    "Growth was 8%, below target.",
    "--failed-assumptions",
    "asm_capacity",
    "--failed-evidence",
    "evd_capacity",
    "--auditor",
    "Troy"
  ]);
  runCli(cwd, [
    "decision",
    "score",
    "--id",
    "dsc_launch",
    "--thread",
    "thd_adaptation",
    "--decision",
    "dcr_launch",
    "--score",
    "0.4",
    "--status",
    "failed",
    "--rationale",
    "Growth missed because capacity assumptions failed.",
    "--audits",
    "out_growth",
    "--scorer",
    "Troy"
  ]);
  return cwd;
}

function makeLearningSignalEvent(overrides = {}) {
  return {
    event_id: overrides.eventId || `evt_${overrides.id || "learning_signal"}`,
    event_type: "LearningSignalRecorded",
    thread_id: "thd_adaptation",
    actor_id: "par_troy",
    timestamp: "2027-03-02T00:00:00.000Z",
    payload: {
      learningSignal: {
        id: overrides.id || "lrn_explicit_adaptation_pattern",
        object: "learningSignal",
        signalType: "outcome_review",
        pattern: overrides.pattern || "manual_pattern_review",
        relatedContributions: overrides.relatedContributions || ["dcr_launch", "asm_capacity"],
        outcomeRefs: overrides.outcomeRefs || ["out_growth"],
        finding: overrides.finding || "Manual learning signal records a governance-review pattern.",
        confidence: overrides.confidence || "medium",
        actorScoring: false,
        sourceScoring: false,
        modelRanking: false,
        authorityMutation: false,
        ...overrides
      }
    }
  };
}

function makeAdaptationReviewEvent(overrides = {}) {
  return {
    event_id: overrides.eventId || `evt_${overrides.id || "adaptation_review"}`,
    event_type: "AdaptationReviewRecorded",
    thread_id: "thd_adaptation",
    actor_id: "par_troy",
    timestamp: "2027-03-03T00:00:00.000Z",
    payload: {
      adaptationReview: {
        id: overrides.id || "adr_explicit_review",
        object: "adaptationReview",
        pattern: overrides.pattern || "manual_pattern_review",
        learningSignalIds: overrides.learningSignalIds || ["lrn_explicit_adaptation_pattern"],
        finding: overrides.finding || "Governance reviewed the adaptation recommendation without applying a change.",
        confidence: overrides.confidence || "medium",
        authorityMutation: false,
        governanceMutation: false,
        ruleMutation: false,
        thresholdMutation: false,
        participantScoring: false,
        sourceScoring: false,
        modelRanking: false,
        ...overrides
      }
    }
  };
}

function makeAdaptationRecommendationEvent(overrides = {}) {
  const eventType = overrides.eventType || "GovernanceReviewRecommended";
  const payloadKey = overrides.payloadKey || "governanceReviewRecommendation";
  const id = overrides.id || "adp_manual_governance_review";
  return {
    event_id: overrides.eventId || `evt_${id}`,
    event_type: eventType,
    thread_id: "thd_adaptation",
    actor_id: "par_troy",
    timestamp: "2027-03-03T00:00:00.000Z",
    payload: {
      [payloadKey]: {
        id,
        object: "adaptationRecommendation",
        recommendationType: overrides.recommendationType || "governance_review",
        pattern: overrides.pattern || "manual_pattern_review",
        learningSignalIds: overrides.learningSignalIds || ["lrn_explicit_adaptation_pattern"],
        relatedContributions: overrides.relatedContributions || ["dcr_launch", "asm_capacity"],
        outcomeRefs: overrides.outcomeRefs || ["out_growth"],
        finding: overrides.finding || "Learning signal recommends governance review without mutation.",
        recommendation: overrides.recommendation || "Review the relevant governance rule through explicit authority.",
        confidence: overrides.confidence || "medium",
        authorityMutation: false,
        governanceMutation: false,
        ruleMutation: false,
        thresholdMutation: false,
        participantScoring: false,
        sourceScoring: false,
        modelRanking: false,
        ...overrides
      }
    }
  };
}

function runCli(cwd, args) {
  const result = spawnSync("node", [cliPath, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function readStoreEvents(cwd) {
  return readEventsAt(path.join(cwd, ".clista", "events.ndjson"));
}

function assertInvalid(events, pattern) {
  const result = validateEvents(events);
  assert.equal(result.valid, false, "expected validation to fail");
  assert.match(formatValidationErrors(result.errors), pattern);
}
