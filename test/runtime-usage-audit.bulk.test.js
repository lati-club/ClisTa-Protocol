const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  REQUIRED_VERIFIERS,
  buildReleaseManifest,
  writeReleaseManifest
} = require("../src/release");
const { auditRuntimeUsage } = require("../src/runtime");
const { contentHash } = require("../src/integrity");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const fixtureRoot = path.join(root, "test", "fixtures", "runtime-usage");
const runtimeUsageTag = "v0.26.1-runtime-usage-audit";

test("runtime usage audit verifies the documented runtime path for a valid manifest", () => {
  const { cwd } = createRuntimeUsageRepo();
  const result = runAudit(cwd);

  assert.equal(result.schema, "clista.runtime.audit.v0");
  assert.equal(result.valid, true, reasons(result));
  assert.equal(result.runtimeUsable, true);
  assert.equal(result.theorem, "runtime_usability = verify(user_can_execute_runtime_verification, without_protocol_insider_context)");
  assert.equal(result.hardLaw, "verified_runtime != usable_runtime");
  assert.equal(result.command, "clista runtime audit");
});

test("runtime usage audit confirms README, quickstart, and protocol docs explain the path", () => {
  const { cwd } = createRuntimeUsageRepo();
  const result = runAudit(cwd);

  assert.equal(result.docsExplainRuntimeVerification, true, reasons(result));
  assert.equal(result.docsExplainRuntimeBoundary, true, reasons(result));
  assertCheck(result, "readme_documents_runtime_path");
  assertCheck(result, "quickstart_documents_runtime_path");
  assertCheck(result, "protocol_docs_define_usage_audit");
});

test("runtime usage audit confirms runtime verification is discoverable and bounded", () => {
  const { cwd } = createRuntimeUsageRepo();
  const result = runAudit(cwd);

  assert.equal(result.runtimeVerifyDiscoverable, true);
  assert.equal(result.runtimeAuditDiscoverable, true);
  assert.equal(result.runtimeVerificationBounded, true);
  assertCheck(result, "runtime_verify_discoverable");
  assertCheck(result, "runtime_audit_discoverable");
  assertCheck(result, "runtime_verification_bounded_in_help");
});

test("runtime usage audit confirms missing manifest failure is clear and actionable", () => {
  const { cwd } = createRuntimeUsageRepo();
  const result = runAudit(cwd);

  assert.equal(result.missingManifestFailureClear, true, reasons(result));
  assert.equal(result.missingManifestFailureActionable, true, reasons(result));
  assert.equal(result.missingManifest.actionableCommand, "clista release manifest --out .clista/release-manifest.json");
  assertRuntimeViolation(result.missingManifest.runtimeResult, "release_manifest_missing");
});

test("runtime usage audit confirms valid manifest success is clear but does not overclaim", () => {
  const { cwd } = createRuntimeUsageRepo();
  const result = runAudit(cwd);
  const runtime = result.runtimeVerification.runtimeResult;

  assert.equal(result.validManifestSuccessClear, true, reasons(result));
  assert.equal(result.validManifestSuccessBounded, true, reasons(result));
  assert.equal(runtime.valid, true, reasons(result));
  assert.equal(runtime.runtimeVerified, true);
  assert.equal(runtime.trusted, false);
  assert.equal(runtime.protocolAuthority, false);
  assert.equal(runtime.governanceApproval, false);
  assert.equal(runtime.amendmentApproval, false);
  assert.equal(runtime.compatibilityProof, false);
  assert.ok(runtime.doesNotProve.includes("runtime trust"));
});

test("runtime audit CLI reports missing manifest as machine-readable failure", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-runtime-audit-cli-"));
  const result = spawnSync("node", [cliPath, "runtime", "audit", "--manifest", "missing.json"], {
    cwd,
    encoding: "utf8"
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(output.schema, "clista.runtime.audit.v0");
  assert.equal(output.valid, false);
  assert.equal(output.missingManifestFailureClear, true);
});

test("runtime audit CLI accepts a positional manifest path", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-runtime-audit-cli-positional-"));
  const result = spawnSync("node", [cliPath, "runtime", "audit", "missing-positional.json"], {
    cwd,
    encoding: "utf8"
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(output.schema, "clista.runtime.audit.v0");
  assert.equal(output.manifestPath, "missing-positional.json");
  assertRuntimeViolation(output.runtimeVerification.runtimeResult, "release_manifest_missing");
});

test("runtime usage audit does not mutate event log, projected state, or export state", () => {
  const { cwd } = createRuntimeUsageRepo({ projectedState: true, exportState: true });
  const before = readStateFiles(cwd);
  const result = runAudit(cwd);
  const after = readStateFiles(cwd);

  assert.equal(result.valid, true, reasons(result));
  assert.deepEqual(after, before);
  assert.equal(result.mutation.eventLogUnchanged, true);
  assert.equal(result.mutation.projectedStateUnchanged, true);
  assert.equal(result.mutation.exportStateUnchanged, true);
});

test("runtime usage audit repeated invocation is stable for the same runtime state", () => {
  const { cwd } = createRuntimeUsageRepo();
  const first = runAudit(cwd);
  const second = runAudit(cwd);

  assert.equal(first.valid, true, reasons(first));
  assert.deepEqual(second, first);
});

test("runtime usage audit records no trust, authority, governance, amendment, or compatibility creation", () => {
  const { cwd } = createRuntimeUsageRepo();
  const result = runAudit(cwd);

  assert.equal(result.trusted, false);
  assert.equal(result.protocolAuthority, false);
  assert.equal(result.governanceApproval, false);
  assert.equal(result.amendmentApproval, false);
  assert.equal(result.compatibilityProof, false);
  assertCheck(result, "trusted_not_created");
  assertCheck(result, "protocolAuthority_not_created");
  assertCheck(result, "governanceApproval_not_created");
  assertCheck(result, "amendmentApproval_not_created");
  assertCheck(result, "compatibilityProof_not_created");
});

test("bulk matrix: fresh clone with no .clista fails clearly without creating state", () => {
  const { cwd } = createRuntimeUsageRepo({ createClista: false, writeManifest: false });
  const result = runAudit(cwd);

  assert.equal(result.valid, false);
  assert.equal(result.missingManifestFailureClear, true);
  assertRuntimeViolation(result.runtimeVerification.runtimeResult, "release_manifest_missing");
  assert.equal(pathExists(cwd, ".clista"), false);
});

test("bulk matrix: .clista exists but no release manifest fails clearly", () => {
  const { cwd } = createRuntimeUsageRepo({ writeManifest: false });
  const result = runAudit(cwd);

  assert.equal(result.valid, false);
  assert.equal(result.missingManifestFailureClear, true);
  assertRuntimeViolation(result.runtimeVerification.runtimeResult, "release_manifest_missing");
});

test("bulk matrix: valid manifest passes the runtime usage audit", () => {
  const { cwd } = createRuntimeUsageRepo();
  const result = runAudit(cwd);

  assert.equal(result.valid, true, reasons(result));
  assert.equal(result.runtimeUsable, true);
  assert.equal(result.runtimeVerification.runtimeResult.valid, true);
});

test("bulk matrix: explicit missing manifest path is reported on the documented runtime path", () => {
  const { cwd } = createRuntimeUsageRepo();
  const result = runAudit(cwd, { manifestPath: "missing-explicit.json" });

  assert.equal(result.valid, false);
  assert.equal(result.manifestPath, "missing-explicit.json");
  assertRuntimeViolation(result.runtimeVerification.runtimeResult, "release_manifest_missing");
});

test("bulk matrix: malformed manifest fails as invalid release manifest", () => {
  const { cwd } = createRuntimeUsageRepo();
  writeFileSync(path.join(cwd, ".clista", "release-manifest.json"), "{ malformed", "utf8");
  const result = runAudit(cwd);

  assert.equal(result.valid, false);
  assertRuntimeViolation(result.runtimeVerification.runtimeResult, "release_manifest_invalid");
});

test("bulk matrix: mismatched runtime facts fail with drift", () => {
  const { cwd } = createRuntimeUsageRepo();
  const packagePath = path.join(cwd, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  packageJson.version = "0.26.2";
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  const result = runAudit(cwd);

  assert.equal(result.valid, false);
  assertRuntimeViolation(result.runtimeVerification.runtimeResult, "package_version_mismatch");
});

test("bulk matrix: existing projected state remains unchanged", () => {
  const { cwd } = createRuntimeUsageRepo({ projectedState: true });
  const before = readFileSync(path.join(cwd, "projected-state.json"), "utf8");
  const result = runAudit(cwd);
  const after = readFileSync(path.join(cwd, "projected-state.json"), "utf8");

  assert.equal(result.valid, true, reasons(result));
  assert.equal(after, before);
  assert.equal(result.mutation.projectedStateUnchanged, true);
});

test("bulk matrix: existing export state remains unchanged", () => {
  const { cwd } = createRuntimeUsageRepo({ exportState: true });
  const before = readFileSync(path.join(cwd, "clista-export.json"), "utf8");
  const result = runAudit(cwd);
  const after = readFileSync(path.join(cwd, "clista-export.json"), "utf8");

  assert.equal(result.valid, true, reasons(result));
  assert.equal(after, before);
  assert.equal(result.mutation.exportStateUnchanged, true);
});

test("bulk matrix: repeated invocation remains read-only", () => {
  const { cwd } = createRuntimeUsageRepo({ projectedState: true, exportState: true });
  const before = readStateFiles(cwd);
  const first = runAudit(cwd);
  const second = runAudit(cwd);
  const after = readStateFiles(cwd);

  assert.equal(first.valid, true, reasons(first));
  assert.deepEqual(second, first);
  assert.deepEqual(after, before);
});

test("bulk matrix: event log is not mutated", () => {
  const { cwd } = createRuntimeUsageRepo();
  const eventPath = path.join(cwd, ".clista", "events.ndjson");
  const before = readFileSync(eventPath, "utf8");
  const result = runAudit(cwd);
  const after = readFileSync(eventPath, "utf8");

  assert.equal(result.valid, true, reasons(result));
  assert.equal(after, before);
  assert.equal(result.mutation.eventLogUnchanged, true);
});

test("bulk matrix: projected and export artifacts are not mutated together", () => {
  const { cwd } = createRuntimeUsageRepo({ projectedState: true, exportState: true });
  const beforeProjected = readFileSync(path.join(cwd, "projected-state.json"), "utf8");
  const beforeExport = readFileSync(path.join(cwd, "clista-export.json"), "utf8");
  const result = runAudit(cwd);

  assert.equal(result.valid, true, reasons(result));
  assert.equal(readFileSync(path.join(cwd, "projected-state.json"), "utf8"), beforeProjected);
  assert.equal(readFileSync(path.join(cwd, "clista-export.json"), "utf8"), beforeExport);
  assert.equal(result.mutation.projectedStateUnchanged, true);
  assert.equal(result.mutation.exportStateUnchanged, true);
});

test("bulk matrix: audit creates no trust or protocol authority flags", () => {
  const { cwd } = createRuntimeUsageRepo();
  const result = runAudit(cwd);
  const runtime = result.runtimeVerification.runtimeResult;

  assert.equal(result.valid, true, reasons(result));
  for (const field of ["trusted", "protocolAuthority", "governanceApproval", "amendmentApproval", "compatibilityProof"]) {
    assert.equal(result[field], false, field);
    assert.equal(runtime[field], false, field);
  }
});

function createRuntimeUsageRepo(options = {}) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-runtime-usage-"));
  const createClista = options.createClista !== false;
  mkdirSync(path.join(cwd, "src"), { recursive: true });
  mkdirSync(path.join(cwd, "schemas"), { recursive: true });
  mkdirSync(path.join(cwd, "docs", "protocol", "v0"), { recursive: true });
  if (createClista) {
    mkdirSync(path.join(cwd, ".clista"), { recursive: true });
  }

  writeFileSync(path.join(cwd, ".gitignore"), ".clista/*\n!.clista/events.ndjson\n", "utf8");
  if (createClista) {
    writeFileSync(path.join(cwd, ".clista", "events.ndjson"), `${JSON.stringify({
      event_id: "evt_runtime_usage_001",
      event_type: "RuntimeUsageFixture",
      thread_id: "thd_runtime_usage",
      actor_id: "par_runtime_usage",
      timestamp: "2026-06-07T00:26:01.000Z",
      payload: { fixture: true }
    })}\n`, "utf8");
  }
  writeFileSync(path.join(cwd, "package.json"), `${JSON.stringify({
    name: "clista-protocol",
    version: "0.26.1",
    private: true,
    bin: {
      clista: "src/cli.js"
    },
    engines: {
      node: ">=18"
    }
  }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(cwd, "src", "cli.js"), fixtureCliSource(), "utf8");
  writeFileSync(path.join(cwd, "src", "release.js"), "module.exports = { fixture: true };\n", "utf8");
  writeFileSync(path.join(cwd, "schemas", "runtime-usage.schema.json"), `${JSON.stringify({
    schema: "fixture.runtime-usage.schema"
  }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(cwd, "README.md"), fixtureText("README.md"), "utf8");
  writeFileSync(path.join(cwd, "docs", "quickstart.md"), fixtureText("quickstart.md"), "utf8");
  writeFileSync(path.join(cwd, "docs", "protocol", "v0", "milestone-26.md"), fixtureText("milestone-26.md"), "utf8");
  writeFileSync(path.join(cwd, "docs", "protocol", "v0", "milestone-26.1.md"), fixtureText("milestone-26.1.md"), "utf8");
  if (options.projectedState) {
    writeFileSync(path.join(cwd, "projected-state.json"), `${JSON.stringify({
      schema: "fixture.projected-state",
      stable: true
    }, null, 2)}\n`, "utf8");
  }
  if (options.exportState) {
    writeFileSync(path.join(cwd, "clista-export.json"), `${JSON.stringify({
      schema: "clista.protocol.v0",
      events: []
    }, null, 2)}\n`, "utf8");
    writeFileSync(path.join(cwd, "continuity.json"), `${JSON.stringify({
      schema: "clista.continuity.packet.v0",
      stable: true
    }, null, 2)}\n`, "utf8");
  }

  git(cwd, ["init"]);
  git(cwd, ["config", "user.email", "test@example.com"]);
  git(cwd, ["config", "user.name", "Runtime Usage Test"]);
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", "fixture runtime usage"]);
  git(cwd, ["tag", runtimeUsageTag]);

  if (options.writeManifest !== false) {
    if (!pathExists(cwd, ".clista")) {
      mkdirSync(path.join(cwd, ".clista"), { recursive: true });
    }
    writeRuntimeManifest(cwd);
  }

  return {
    cwd,
    manifestPath: ".clista/release-manifest.json"
  };
}

function runAudit(cwd, options = {}) {
  return auditRuntimeUsage({
    cwd,
    manifestPath: options.manifestPath || ".clista/release-manifest.json",
    cliPath: path.join(cwd, "src", "cli.js"),
    usageText: fixtureText("cli-usage.txt"),
    docPaths: [
      "README.md",
      "docs/quickstart.md",
      "docs/protocol/v0/milestone-26.md",
      "docs/protocol/v0/milestone-26.1.md"
    ]
  });
}

function writeRuntimeManifest(cwd) {
  return writeReleaseManifest(buildReleaseManifest(cwd, {
    tag: runtimeUsageTag,
    createdAt: "2026-06-07T00:26:01.000Z",
    verifierResults: fixtureVerifierResults(),
    runVerifiers: false
  }), ".clista/release-manifest.json", cwd);
}

function fixtureVerifierResults() {
  return REQUIRED_VERIFIERS.map((item) => {
    const stdout = fixtureStdout(item.args);
    return {
      id: item.id,
      command: item.command,
      passed: true,
      exit_code: 0,
      stdout_hash: contentHash(stdout),
      stderr_hash: contentHash(""),
      output_schema: JSON.parse(stdout).schema,
      error: null
    };
  });
}

function fixtureCliSource() {
  return `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "fail") {
  process.stderr.write("fixture verifier failed\\n");
  process.exit(1);
}
const suffix = args.length ? args.join("_").replace(/[^a-zA-Z0-9_]+/g, "_") : "help";
process.stdout.write(JSON.stringify({ schema: "fixture." + suffix, valid: true }) + "\\n");
`;
}

function fixtureStdout(args) {
  const suffix = args.length ? args.join("_").replace(/[^a-zA-Z0-9_]+/g, "_") : "help";
  return `${JSON.stringify({ schema: `fixture.${suffix}`, valid: true })}\n`;
}

function fixtureText(name) {
  return readFileSync(path.join(fixtureRoot, name), "utf8");
}

function readStateFiles(cwd) {
  return {
    events: readOptional(cwd, ".clista/events.ndjson"),
    projected: readOptional(cwd, "projected-state.json"),
    export: readOptional(cwd, "clista-export.json"),
    continuity: readOptional(cwd, "continuity.json")
  };
}

function readOptional(cwd, relativePath) {
  const target = path.join(cwd, relativePath);
  return pathExists(cwd, relativePath) ? readFileSync(target, "utf8") : null;
}

function assertCheck(result, id) {
  assert.equal(result.checks.find((check) => check.id === id)?.valid, true, reasons(result));
}

function assertRuntimeViolation(result, violationType) {
  assert.ok(result.violations.some((violation) => violation.violationType === violationType), JSON.stringify(result.violations, null, 2));
}

function reasons(result) {
  return JSON.stringify({
    checks: result.checks,
    violations: result.violations,
    runtimeVerification: result.runtimeVerification?.runtimeResult
  }, null, 2);
}

function pathExists(cwd, relativePath) {
  return require("node:fs").existsSync(path.join(cwd, relativePath));
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
