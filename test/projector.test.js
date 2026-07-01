const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createEvent, readEventsAt } = require("../src/events");
const { exportProtocol, projectEvents, selectAudit, selectThreadState } = require("../src/projector");

const root = path.resolve(__dirname, "..");
const fixture = path.join(root, "examples", "first-test-thread", "events.ndjson");
const canonicalLog = path.join(root, ".clista", "events.ndjson");

test("projects the first ClisTa decision thread into reloadable state", () => {
  const projection = projectEvents(readEventsAt(fixture));
  const state = selectThreadState(projection, "thd_clista_protocol_first");

  assert.equal(state.thread.question, "Should ClisTa MVP begin as a local-first JSON protocol before UI?");
  assert.equal(state.currentProposal.id, "drq_protocol_first");
  assert.equal(state.decisionStatus.recordStatus, "approved");
  assert.match(state.decisionStatus.decisionRecord.summary, /local-first JSON protocol engine/);
  assert.equal(state.supportingEvidence.length, 3);
  assert.equal(state.assumptions.length, 1);
  assert.match(state.assumptions[0].text, /projected reasoning state/);
  assert.equal(state.claims.length, 2);
  assert.equal(state.unresolvedObjections.length, 1);
  assert.equal(state.unresolvedObjections[0].participant.name, "Dissent Agent");
  assert.equal(state.decisionStatus.minorityReports.length, 1);
  assert.match(state.decisionStatus.decisionRecord.nextAction, /Implement schema/);
  assert.ok(state.auditTrail.some((entry) => entry.event_type === "DecisionMerged"));
});

test("events use the stable append-only log envelope", () => {
  const [event] = readEventsAt(fixture);

  assert.deepEqual(Object.keys(event), [
    "event_id",
    "event_type",
    "thread_id",
    "actor_id",
    "timestamp",
    "payload",
    "content_hash"
  ]);
});

test("exports all protocol object collections from the event log", () => {
  const projection = projectEvents(readEventsAt(fixture));
  const exported = exportProtocol(projection);

  assert.equal(exported.schema, "clista.protocol.v0");
  assert.equal(exported.evidence.length, 3);
  assert.equal(exported.assumptions.length, 1);
  assert.equal(exported.claims.length, 2);
  assert.equal(exported.positions.length, 3);
  assert.equal(exported.objections.length, 1);
  assert.equal(exported.decisionRequests.length, 1);
  assert.equal(exported.reviews.length, 1);
  assert.equal(exported.decisionRecords.length, 1);
  assert.equal(exported.minorityReports.length, 1);
  assert.equal(exported.mergeRequests.length, 0);
  assert.equal(exported.mergeReviews.length, 0);
  assert.equal(exported.mergeConflicts.length, 0);
  assert.equal(exported.mergeConflictResolutions.length, 0);
  assert.equal(exported.mergeCompletions.length, 0);
  assert.equal(exported.negotiation.hardLaw, "agreement != governance merger");
  assert.equal(exported.events.length, 19);
});

test("audit projection answers why the decision happened", () => {
  const projection = projectEvents(readEventsAt(fixture));
  const audit = selectAudit(projection, "thd_clista_protocol_first");

  assert.equal(audit.decisionStatus.recordStatus, "approved");
  assert.ok(audit.evidence.some((item) => item.finding.includes("reload")));
  assert.ok(audit.assumptions.some((item) => item.text.includes("projected reasoning state")));
  assert.ok(audit.claims.some((claim) => claim.text.includes("protocol before UI")));
  assert.ok(audit.objections.some((objection) => objection.text.includes("too broad")));
});

test("CLI can initialize a store and show projected state", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-test-"));

  execFileSync("node", [path.join(root, "src", "cli.js"), "init"], { cwd });
  execFileSync("node", [
    path.join(root, "src", "cli.js"),
    "thread",
    "create",
    "--id",
    "thd_cli",
    "--title",
    "CLI Thread",
    "--question",
    "Can the CLI create a reasoning thread?",
    "--participant",
    "Troy:decision owner"
  ], { cwd });

  const output = execFileSync("node", [
    path.join(root, "src", "cli.js"),
    "state",
    "show",
    "--thread",
    "thd_cli"
  ], { cwd, encoding: "utf8" });
  const state = JSON.parse(output);

  assert.equal(state.thread.id, "thd_cli");
  assert.equal(state.thread.question, "Can the CLI create a reasoning thread?");
  assert.equal(state.auditTrail.some((entry) => entry.event_type === "ThreadCreated"), true);
});

test("CLI can list projected assumptions from the append-only log", () => {
  const output = execFileSync("node", [
    path.join(root, "src", "cli.js"),
    "assumptions",
    "list",
    "--thread",
    "thd_clista_protocol_first",
    "--events",
    fixture
  ], { cwd: root, encoding: "utf8" });
  const assumptions = JSON.parse(output);

  assert.equal(assumptions.length, 1);
  assert.equal(assumptions[0].id, "asm_projection_sufficient");
});

test("thread-0001 reasoning state is reconstructed from .clista/events.ndjson only", () => {
  // NOTE: This test uses the *stable test fixture* only.
  // .clista/events.ndjson = original clean scenario (June 5 events: AI support-assistant beta decision).
  // All live attestation / pruning / Milestone 0 self-attestation work has been re-routed to:
  //   examples/clista-protocol-attestation.ndjson (full chain, validates independently).
  // Do NOT append live work to .clista/events.ndjson or these exact counts will drift.
  const events = readEventsAt(canonicalLog);
  const projection = projectEvents(events);
  // The curated snake_case reasoning view lives under .reasoningState; the
  // top-level selectThreadState object is the camelCase threadState envelope.
  const reasoning = selectThreadState(projection, "thd_thread_0001").reasoningState;

  assert.deepEqual(Object.keys(reasoning), [
    "question",
    "decision",
    "rationale",
    "assumptions",
    "evidence",
    "claims",
    "positions",
    "objections",
    "minority_reports",
    "expected_outcomes",
    "outcome_audits",
    "decision_score",
    "outcome_status",
    "failed_assumptions",
    "failed_evidence",
    "fork_lineage",
    "changed_assumptions",
    "divergent_claims",
    "merge_requests",
    "merge_completions",
    "attribution",
    "provenance",
    "learning",
    "adaptation",
    "amendments",
    "compatibility",
    "interoperability",
    "federation",
    "negotiation",
    "delegation",
    "execution",
    "outcome",
    "outcome_learning",
    "review",
    "recovery",
    "next_action",
    "audit_summary"
  ]);
  assert.equal(reasoning.question, "How should ClisTa be architected?");
  assert.equal(reasoning.decision.summary, "Build ClisTa as a protocol-first append-only reasoning engine.");
  assert.match(reasoning.rationale, /reasoning can be stored as protocol state/);
  assert.equal(reasoning.assumptions.length, 4);
  assert.equal(reasoning.evidence.length, 4);
  assert.equal(reasoning.claims.length, 5);
  assert.equal(reasoning.positions.length, 3);
  assert.equal(reasoning.objections.length, 2);
  assert.equal(reasoning.minority_reports.length, 1);
  assert.equal(reasoning.expected_outcomes.length, 0);
  assert.equal(reasoning.outcome_audits.length, 0);
  assert.equal(reasoning.decision_score, null);
  assert.equal(reasoning.outcome_status, "unknown");
  assert.equal(reasoning.failed_assumptions.length, 0);
  assert.equal(reasoning.failed_evidence.length, 0);
  assert.equal(reasoning.fork_lineage, null);
  assert.equal(reasoning.changed_assumptions.length, 0);
  assert.equal(reasoning.divergent_claims.length, 0);
  assert.equal(reasoning.merge_requests.length, 0);
  assert.equal(reasoning.merge_completions.length, 0);
  assert.ok(reasoning.attribution.attributions.length > 0);
  assert.ok(reasoning.provenance.provenance.length > 0);
  assert.equal(reasoning.learning.hardLaw, "learning != reputation");
  assert.equal(reasoning.adaptation.hardLaw, "adaptation != governance mutation");
  assert.equal(reasoning.amendments.hardLaw, "recommendation != amendment");
  assert.equal(reasoning.compatibility.hardLaw, "unsupported_state != valid_state");
  assert.equal(reasoning.interoperability.hardLaw, "translation != reinterpretation");
  assert.equal(reasoning.federation.hardLaw, "shared_state != shared_authority");
  assert.equal(reasoning.negotiation.hardLaw, "agreement != governance merger");
  assert.equal(reasoning.delegation.hardLaw, "delegation != authority surrender");
  assert.equal(reasoning.execution.hardLaw, "execution != intent");
  assert.equal(reasoning.outcome.hardLaw, "completion != success");
  assert.equal(reasoning.outcome_learning.hardLaw, "learning != retroactive justification");
  assert.equal(reasoning.review.hardLaw, "review != approval");
  assert.equal(reasoning.next_action, "Implement and prove Milestone 0: Protocol Spine Proven.");
  assert.equal(reasoning.audit_summary.source, "append_only_event_log");
  assert.equal(reasoning.audit_summary.external_state_used, false);
});

test("allEvidence surfaces the full committed set while supportingEvidence narrows to what a decision request cites", () => {
  const threadId = "thd_allevidence_test";
  const events = [
    createEvent({
      type: "ThreadCreated",
      threadId,
      payload: { thread: { id: threadId, object: "thread", title: "t", question: "q", status: "active", participantIds: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } }
    }),
    createEvent({
      type: "EvidenceCommitted",
      threadId,
      payload: { evidence: { id: "evd_cited", object: "evidence", threadId, source: "s1", finding: "cited by the decision", tags: ["smoke"], committedByParticipantId: "par_x", committedAt: "2026-01-01T00:00:01.000Z" } }
    }),
    createEvent({
      type: "EvidenceCommitted",
      threadId,
      payload: { evidence: { id: "evd_uncited", object: "evidence", threadId, source: "s2", finding: "never cited by any decision", tags: ["smoke"], committedByParticipantId: "par_x", committedAt: "2026-01-01T00:00:02.000Z" } }
    }),
    createEvent({
      type: "DecisionRequestOpened",
      threadId,
      payload: { decisionRequest: { id: "drq_x", object: "decisionRequest", threadId, proposal: "Ship it", status: "review", supportingEvidenceIds: ["evd_cited"], supportingClaimIds: [], supportingAssumptionIds: [], objectionIds: [], openedByParticipantId: "par_x", openedAt: "2026-01-01T00:00:03.000Z" } }
    })
  ];

  const projection = projectEvents(events);
  const state = selectThreadState(projection, threadId);

  assert.equal(state.allEvidence.length, 2, "allEvidence must include the uncited item");
  assert.equal(state.supportingEvidence.length, 1, "supportingEvidence narrows to what the open decision request cites");
  assert.equal(state.supportingEvidence[0].id, "evd_cited");
  assert.ok(state.allEvidence.some((e) => e.id === "evd_uncited"), "the uncited item must not be silently dropped from allEvidence");
});

test("tags round-trip through EvidenceCommitted and AssumptionDeclared payloads unchanged", () => {
  const threadId = "thd_tags_roundtrip";
  const events = [
    createEvent({
      type: "ThreadCreated",
      threadId,
      payload: { thread: { id: threadId, object: "thread", title: "t", question: "q", status: "active", participantIds: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } }
    }),
    createEvent({
      type: "EvidenceCommitted",
      threadId,
      payload: { evidence: { id: "evd_tagged", object: "evidence", threadId, source: "s", finding: "f", tags: ["mrm-beta", "phase2"], committedByParticipantId: "par_x", committedAt: "2026-01-01T00:00:01.000Z" } }
    }),
    createEvent({
      type: "AssumptionDeclared",
      threadId,
      payload: { assumption: { id: "asm_tagged", object: "assumption", threadId, text: "a", status: "active", evidenceIds: ["evd_tagged"], declaredByParticipantId: "par_x", declaredAt: "2026-01-01T00:00:02.000Z", tags: ["enrollment"] } }
    })
  ];

  const projection = projectEvents(events);
  const state = selectThreadState(projection, threadId);

  assert.deepEqual(state.allEvidence[0].tags, ["mrm-beta", "phase2"]);
  assert.deepEqual(state.assumptions[0].tags, ["enrollment"]);
});
