const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const scenarioDir = "examples/scenario-demo";
const scenarioEvents = "examples/scenario-demo/events.ndjson";
const expectedState = "examples/scenario-demo/expected-state.json";
const threadId = "thd_scenario_demo";
const decisionId = "dcr_limited_beta";

const documentedReplayCommands = [
  `node src/cli.js validate --events ${scenarioEvents}`,
  `node src/cli.js state show --thread ${threadId} --events ${scenarioEvents}`,
  `node src/cli.js export --events ${scenarioEvents}`,
  `node src/cli.js attribution list --thread ${threadId} --events ${scenarioEvents}`,
  `node src/cli.js provenance trace ${decisionId} --events ${scenarioEvents}`
];

const publicArtifactPaths = [
  "package.json",
  "README.md",
  "docs",
  scenarioDir,
  "schemas",
  "src"
];

test("external replay docs identify repo-visible scenario files and relative commands", () => {
  const scenarioReadme = readText(path.join(root, scenarioDir, "README.md"));
  const scenarioCommands = readText(path.join(root, scenarioDir, "commands.md"));
  const milestone = readText(path.join(root, "docs/protocol/v0/milestone-28.md"));
  const docs = [scenarioReadme, scenarioCommands, milestone].join("\n");

  assert.match(docs, /external_replay = verify\(non_builder_can_reproduce_scenario, from_public_artifact_and_docs\)/);
  assert.match(docs, /scenario_exists != externally_reproducible_scenario/);
  assert.match(docs, new RegExp(scenarioEvents.replaceAll("/", "\\/")));
  assert.match(docs, new RegExp(expectedState.replaceAll("/", "\\/")));
  assert.deepEqual(extractNodeCommands(scenarioCommands), documentedReplayCommands);
  assert.doesNotMatch(docs, /\/Users\/|\/private\/|~\/|[A-Za-z]:\\|file:\/\//);

  for (const referencedPath of scenarioPathRefs(docs)) {
    assert.equal(existsSync(path.join(root, referencedPath)), true, `${referencedPath} should be repo-visible`);
  }
});

test("external replay does not add a product scenario command", () => {
  const cli = readText(path.join(root, "src/cli.js"));

  assert.doesNotMatch(cli, /case "scenario audit"/);
  assert.doesNotMatch(cli, /case "replay audit"/);
  assert.doesNotMatch(cli, /case "external-replay audit"/);
  assert.doesNotMatch(cli, /clista scenario audit/);
  assert.doesNotMatch(cli, /clista replay audit/);
  assert.doesNotMatch(cli, /clista external-replay audit/);
});

test("documented scenario commands replay from a clean public-artifact copy", () => {
  const { cwd } = createPublicReplayWorkspace();
  const commands = extractNodeCommands(readText(path.join(cwd, scenarioDir, "commands.md")));
  assert.deepEqual(commands, documentedReplayCommands);

  const validation = runDocumentedCommand(cwd, commands[0]);
  const state = runDocumentedCommand(cwd, commands[1]);
  const exported = runDocumentedCommand(cwd, commands[2]);
  const attribution = runDocumentedCommand(cwd, commands[3]);
  const provenance = runDocumentedCommand(cwd, commands[4]);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(state.schema, "clista.threadState.v0");
  assert.equal(state.reasoningState.decision.id, decisionId);
  assert.equal(state.reasoningState.decision.status, "approved");
  assert.equal(exported.schema, "clista.protocol.v0");
  assert.equal(exported.events.length, 23);
  assert.equal(attribution.schema, "clista.attribution.list.v0");
  assert.equal(attribution.count, 18);
  assert.equal(provenance.schema, "clista.provenance.trace.v0");
  assert.equal(provenance.contributionId, decisionId);
});

test("external replay expected state and durable export are reproducible", () => {
  const { cwd } = createPublicReplayWorkspace();
  const expected = readJson(path.join(cwd, expectedState));
  const first = durableReplaySummary(cwd);
  const second = durableReplaySummary(cwd);

  assert.deepEqual(second, first);
  assert.equal(first.threadId, expected.threadId);
  assert.equal(first.question, expected.question);
  assert.equal(first.eventCount, expected.durableState.eventCount);
  assert.equal(first.decision.id, expected.decision.id);
  assert.equal(first.decision.status, expected.decision.status);
  assert.equal(first.decision.summary, expected.decision.summary);
  assert.deepEqual(first.evidenceIds, expected.durableState.evidenceIds);
  assert.deepEqual(first.assumptionIds, expected.durableState.assumptionIds);
  assert.deepEqual(first.claimIds, expected.durableState.claimIds);
  assert.deepEqual(first.positionIds, expected.durableState.positionIds);
  assert.deepEqual(first.objectionIds, expected.durableState.objectionIds);
  assert.deepEqual(first.reviewIds, expected.durableState.reviewIds);
  assert.deepEqual(first.minorityReportIds, expected.durableState.minorityReportIds);
});

test("external replay attribution and provenance are inspectable from scenario state", () => {
  const { cwd } = createPublicReplayWorkspace();
  const attribution = runCli(cwd, ["attribution", "list", "--thread", threadId, "--events", scenarioEvents]);
  const provenance = runCli(cwd, ["provenance", "trace", decisionId, "--events", scenarioEvents]);
  const decisionAttribution = attribution.attributions.find((record) => record.contributionId === decisionId);
  const trace = provenance.trace[0];
  const sourceRefs = trace.sourceRefs;

  assert.equal(decisionAttribution.participantId, "par_maya");
  assert.equal(decisionAttribution.authorityContext.requiredAuthority, "decision_owner");
  assert.equal(decisionAttribution.authorityContext.permitted, true);
  assert.equal(trace.participantId, "par_maya");
  assert.equal(trace.authorityContext.requiredAuthority, "decision_owner");
  assert.ok(sourceRefs.some((sourceRef) => sourceRef.sourceId === "evd_privacy_risk"));
  assert.ok(sourceRefs.some((sourceRef) => sourceRef.objectId === "clm_beta_with_guardrails"));
  assert.ok(sourceRefs.some((sourceRef) => sourceRef.objectId === "obj_unredacted_data_risk"));
  assert.ok(sourceRefs.some((sourceRef) => sourceRef.objectId === "rev_privacy_conditions"));
  assert.ok(sourceRefs.every((sourceRef) => sourceRef.availableAtContributionTime === true));
});

test("external replay does not require hidden builder state", () => {
  const { cwd } = createPublicReplayWorkspace();

  assert.equal(existsSync(path.join(cwd, ".git")), false);
  assert.equal(existsSync(path.join(cwd, ".clista")), false);

  for (const command of documentedReplayCommands) {
    runDocumentedCommand(cwd, command);
  }

  assert.equal(existsSync(path.join(cwd, ".git")), false);
  assert.equal(existsSync(path.join(cwd, ".clista")), false);
});

test("external replay does not mutate fixture input or unrelated .clista state", () => {
  const { cwd } = createPublicReplayWorkspace();
  const clistaDir = path.join(cwd, ".clista");
  mkdirSync(clistaDir);
  writeFileSync(path.join(clistaDir, "events.ndjson"), "sentinel-builder-state\n", "utf8");
  writeFileSync(path.join(clistaDir, "projected-state.json"), "{\"sentinel\":true}\n", "utf8");
  const watchedPaths = [
    scenarioEvents,
    ".clista/events.ndjson",
    ".clista/projected-state.json"
  ];
  const before = snapshotFiles(cwd, watchedPaths);

  for (const command of documentedReplayCommands) {
    runDocumentedCommand(cwd, command);
  }

  assert.deepEqual(snapshotFiles(cwd, watchedPaths), before);
});

test("external replay audit creates no forbidden boundary claims", () => {
  const { cwd } = createPublicReplayWorkspace();
  const expected = readJson(path.join(cwd, expectedState));
  const state = runCli(cwd, ["state", "show", "--thread", threadId, "--events", scenarioEvents]);
  const exported = runCli(cwd, ["export", "--events", scenarioEvents]);
  const attribution = runCli(cwd, ["attribution", "list", "--thread", threadId, "--events", scenarioEvents]);
  const provenance = runCli(cwd, ["provenance", "trace", decisionId, "--events", scenarioEvents]);
  const milestone = readText(path.join(cwd, "docs/protocol/v0/milestone-28.md")).toLowerCase();

  for (const value of [expected, state, exported, attribution, provenance]) {
    assertNoForbiddenTrueFields(value);
  }
  for (const term of [
    "installation",
    "distribution",
    "network behavior",
    "ui",
    "agents",
    "pitch cleanup",
    "external testing",
    "m29",
    "product readiness",
    "trust",
    "protocol authority",
    "governance approval",
    "amendment approval",
    "compatibility proof"
  ]) {
    assert.ok(milestone.includes(term), `milestone-28.md should bound ${term}`);
  }
});

function createPublicReplayWorkspace() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-external-replay-"));
  for (const relativePath of publicArtifactPaths) {
    copyPublicPath(relativePath, cwd);
  }
  return { cwd };
}

function copyPublicPath(relativePath, cwd) {
  const source = path.join(root, relativePath);
  const target = path.join(cwd, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function runDocumentedCommand(cwd, command) {
  const parts = command.split(/\s+/);
  assert.equal(parts[0], "node");
  assert.equal(parts[1], "src/cli.js");
  return runCli(cwd, parts.slice(2));
}

function runCli(cwd, args) {
  const result = spawnSync(process.execPath, [path.join(cwd, "src/cli.js"), ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function durableReplaySummary(cwd) {
  const state = runCli(cwd, ["state", "show", "--thread", threadId, "--events", scenarioEvents]);
  const exported = runCli(cwd, ["export", "--events", scenarioEvents]);
  const attribution = runCli(cwd, ["attribution", "list", "--thread", threadId, "--events", scenarioEvents]);
  const provenance = runCli(cwd, ["provenance", "trace", decisionId, "--events", scenarioEvents]);
  return {
    threadId: state.thread.id,
    question: state.reasoningState.question,
    eventCount: exported.events.length,
    decision: {
      id: state.reasoningState.decision.id,
      status: state.reasoningState.decision.status,
      summary: state.reasoningState.decision.summary
    },
    evidenceIds: state.reasoningState.evidence.map((item) => item.id),
    assumptionIds: state.reasoningState.assumptions.map((item) => item.id),
    claimIds: state.reasoningState.claims.map((item) => item.id),
    positionIds: state.reasoningState.positions.map((item) => item.id),
    objectionIds: state.reasoningState.objections.map((item) => item.id),
    reviewIds: state.decisionStatus.reviews.map((item) => item.id),
    minorityReportIds: state.reasoningState.minority_reports.map((item) => item.id),
    attributionCount: attribution.count,
    provenanceSourceIds: provenance.trace[0].sourceRefs.map((sourceRef) => sourceRef.sourceId || sourceRef.objectId)
  };
}

function extractNodeCommands(text) {
  const commands = [];
  for (const block of text.matchAll(/```sh\n([\s\S]*?)```/g)) {
    for (const line of block[1].split("\n")) {
      const command = line.trim();
      if (command.startsWith("node src/cli.js")) {
        commands.push(command);
      }
    }
  }
  return commands;
}

function scenarioPathRefs(text) {
  const matches = text.match(/examples\/scenario-demo\/[A-Za-z0-9._/-]*/g) || [];
  return [...new Set(matches.map((item) => item.replace(/[),.;:]+$/, "")))];
}

function snapshotFiles(cwd, relativePaths) {
  return Object.fromEntries(relativePaths.map((relativePath) => {
    const absolutePath = path.join(cwd, relativePath);
    return [relativePath, existsSync(absolutePath) ? readText(absolutePath) : null];
  }));
}

function assertNoForbiddenTrueFields(value) {
  const forbidden = new Set([
    "trusted",
    "protocolAuthority",
    "governanceApproval",
    "amendmentApproval",
    "compatibilityProof",
    "distributionProof",
    "installationProof",
    "productReady",
    "productReadiness",
    "releaseAsTrust",
    "trustByExistence",
    "externalTestingStarted",
    "m29Started"
  ]);
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") {
      continue;
    }
    for (const [key, nested] of Object.entries(current)) {
      assert.notEqual(forbidden.has(key) && nested === true, true, `${key} was created`);
      if (nested && typeof nested === "object") {
        stack.push(nested);
      }
    }
  }
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}
