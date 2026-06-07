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
  releaseManifestHash,
  writeReleaseManifest
} = require("../src/release");
const { verifyRuntime } = require("../src/runtime");
const { contentHash } = require("../src/integrity");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "src", "cli.js");
const runtimeTag = "v0.26.0-protocol-runtime-verification";

test("valid runtime verification compares local runtime against an existing manifest", () => {
  const cwd = createRuntimeRepo();
  const manifestPath = writeRuntimeManifest(cwd);
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.schema, "clista.runtime.verify.v0");
  assert.equal(result.valid, true, reasons(result));
  assert.equal(result.runtimeVerified, true);
  assert.equal(result.releaseManifestVerified, true);
  assert.equal(result.hardLaw, "running != verified");
  assert.equal(result.packageVersion, "0.26.0");
  assert.equal(result.manifestPackageVersion, "0.26.0");
  assert.equal(result.sourceHashesMatch, true);
  assert.equal(result.schemaHashesMatch, true);
  assert.equal(result.verifierCommandsAvailable, true);
  assert.equal(result.verifierResultsReproduced, true);
  assert.equal(result.workingTreeClean, true);
  assert.deepEqual(result.violations, []);
});

test("runtime verification fails when the release manifest is missing", () => {
  const cwd = createRuntimeRepo();
  const result = verifyRuntime({ cwd, manifestPath: ".clista/missing.json", cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.valid, false);
  assertViolation(result, "release_manifest_missing");
});

test("runtime verification fails when the release manifest is not verified", () => {
  const cwd = createRuntimeRepo();
  const manifest = validManifest(cwd);
  manifest.trusted = true;
  const manifestPath = writeReleaseManifest(withManifestHash(manifest), ".clista/release-manifest.json", cwd);
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.releaseManifestVerified, false);
  assertViolation(result, "release_manifest_not_verified");
});

test("runtime verification reports package version mismatch", () => {
  const cwd = createRuntimeRepo();
  const manifestPath = writeRuntimeManifest(cwd);
  const packagePath = path.join(cwd, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  packageJson.version = "0.26.1";
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.valid, false);
  assertViolation(result, "package_version_mismatch");
});

test("runtime verification reports CLI entrypoint missing and mismatch", () => {
  const cwd = createRuntimeRepo();
  const manifest = validManifest(cwd);
  manifest.cli_entrypoint = "src/missing.js";
  const manifestPath = writeReleaseManifest(withManifestHash(manifest), ".clista/release-manifest.json", cwd);
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.valid, false);
  assertViolation(result, "cli_entrypoint_missing");
  assertViolation(result, "cli_entrypoint_mismatch");
});

test("runtime verification reports source hash mismatch", () => {
  const cwd = createRuntimeRepo();
  const manifestPath = writeRuntimeManifest(cwd);
  writeFileSync(path.join(cwd, "README.md"), "changed runtime source\n", "utf8");
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.valid, false);
  assert.equal(result.sourceHashesMatch, false);
  assertViolation(result, "source_hash_mismatch");
});

test("runtime verification reports schema hash mismatch", () => {
  const cwd = createRuntimeRepo();
  const manifestPath = writeRuntimeManifest(cwd);
  writeFileSync(path.join(cwd, "schemas", "runtime-fixture.schema.json"), "{ invalid json", "utf8");
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.valid, false);
  assert.equal(result.schemaHashesMatch, false);
  assertViolation(result, "schema_hash_mismatch");
});

test("runtime verification reports Git commit and tag mismatch", () => {
  const cwd = createRuntimeRepo();
  const manifestPath = writeRuntimeManifest(cwd);
  git(cwd, ["commit", "--allow-empty", "-m", "runtime drift"]);
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.valid, false);
  assertViolation(result, "git_commit_mismatch");
  assertViolation(result, "git_tag_mismatch");
});

test("runtime verification fails for dirty tracked files", () => {
  const cwd = createRuntimeRepo();
  const manifestPath = writeRuntimeManifest(cwd);
  writeFileSync(path.join(cwd, "docs", "runtime.md"), "dirty tracked runtime file\n", "utf8");
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.valid, false);
  assert.equal(result.workingTreeClean, false);
  assertViolation(result, "dirty_tracked_files");
});

test("runtime verification warns for untracked files without invalidating runtime", () => {
  const cwd = createRuntimeRepo();
  const manifestPath = writeRuntimeManifest(cwd);
  writeFileSync(path.join(cwd, "untracked.txt"), "not part of release\n", "utf8");
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.valid, true, reasons(result));
  assert.equal(result.workingTreeClean, false);
  assertWarning(result, "untracked_files");
});

test("runtime verification fails when a required verifier cannot reproduce", () => {
  const cwd = createRuntimeRepo();
  const manifest = validManifest(cwd);
  manifest.required_verifiers = [
    ...manifest.required_verifiers,
    { id: "runtime_fail", command: ["clista", "fail"], args: ["fail"] }
  ];
  const manifestPath = writeReleaseManifest(withManifestHash(manifest), ".clista/release-manifest.json", cwd);
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.valid, false);
  assertViolation(result, "required_verifier_failed");
});

test("runtime verification cannot claim trust, authority, governance, amendment, or compatibility proof", () => {
  const cwd = createRuntimeRepo();
  const manifestPath = writeRuntimeManifest(cwd);
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });

  assert.equal(result.trusted, false);
  assert.equal(result.protocolAuthority, false);
  assert.equal(result.governanceApproval, false);
  assert.equal(result.amendmentApproval, false);
  assert.equal(result.compatibilityProof, false);
  assert.ok(result.doesNotProve.includes("runtime trust"));
  assert.ok(result.doesNotProve.includes("protocol authority"));
  assert.ok(result.doesNotProve.includes("governance approval"));
  assert.ok(result.doesNotProve.includes("amendment approval"));
  assert.ok(result.doesNotProve.includes("compatibility proof"));
});

test("runtime verification does not mutate event log or projected export output", () => {
  const cwd = createRuntimeRepo();
  const manifestPath = writeRuntimeManifest(cwd);
  const eventPath = path.join(cwd, ".clista", "events.ndjson");
  const beforeEvents = readFileSync(eventPath, "utf8");
  const beforeExport = runFixtureCli(cwd, ["export"]);
  const result = verifyRuntime({ cwd, manifestPath, cliPath: path.join(cwd, "src", "cli.js") });
  const afterEvents = readFileSync(eventPath, "utf8");
  const afterExport = runFixtureCli(cwd, ["export"]);

  assert.equal(result.valid, true, reasons(result));
  assert.equal(afterEvents, beforeEvents);
  assert.deepEqual(afterExport, beforeExport);
});

test("runtime verify CLI reports missing manifest as machine-readable failure", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-runtime-cli-"));
  const result = spawnSync("node", [cliPath, "runtime", "verify", "--manifest", "missing.json"], {
    cwd,
    encoding: "utf8"
  });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(output.schema, "clista.runtime.verify.v0");
  assert.equal(output.valid, false);
  assertViolation(output, "release_manifest_missing");
});

function createRuntimeRepo() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "clista-runtime-"));
  mkdirSync(path.join(cwd, "src"), { recursive: true });
  mkdirSync(path.join(cwd, "schemas"), { recursive: true });
  mkdirSync(path.join(cwd, "docs"), { recursive: true });
  mkdirSync(path.join(cwd, ".clista"), { recursive: true });
  writeFileSync(path.join(cwd, ".gitignore"), ".clista/*\n!.clista/events.ndjson\n", "utf8");
  writeFileSync(path.join(cwd, ".clista", "events.ndjson"), `${JSON.stringify({
    event_id: "evt_runtime_001",
    event_type: "RuntimeFixture",
    thread_id: "thd_runtime",
    actor_id: "par_runtime",
    timestamp: "2026-06-07T00:00:00.000Z",
    payload: { fixture: true }
  })}\n`, "utf8");
  writeFileSync(path.join(cwd, "package.json"), `${JSON.stringify({
    name: "clista-protocol",
    version: "0.26.0",
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
  writeFileSync(path.join(cwd, "schemas", "runtime-fixture.schema.json"), `${JSON.stringify({
    schema: "fixture.runtime.schema"
  }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(cwd, "README.md"), "Runtime fixture release\n", "utf8");
  writeFileSync(path.join(cwd, "docs", "runtime.md"), "running != verified\n", "utf8");
  git(cwd, ["init"]);
  git(cwd, ["config", "user.email", "test@example.com"]);
  git(cwd, ["config", "user.name", "Runtime Test"]);
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", "fixture runtime"]);
  git(cwd, ["tag", runtimeTag]);
  return cwd;
}

function validManifest(cwd) {
  return buildReleaseManifest(cwd, {
    tag: runtimeTag,
    createdAt: "2026-06-07T00:26:00.000Z",
    verifierResults: fixtureVerifierResults(),
    runVerifiers: false
  });
}

function writeRuntimeManifest(cwd) {
  return writeReleaseManifest(validManifest(cwd), ".clista/release-manifest.json", cwd);
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

function runFixtureCli(cwd, args) {
  const result = spawnSync("node", [path.join(cwd, "src", "cli.js"), ...args], {
    cwd,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function withManifestHash(manifest) {
  return {
    ...manifest,
    manifest_hash: releaseManifestHash(manifest)
  };
}

function assertViolation(result, violationType) {
  assert.ok(result.violations.some((violation) => violation.violationType === violationType), reasons(result));
}

function assertWarning(result, violationType) {
  assert.ok(result.warnings.some((warning) => warning.violationType === violationType), reasons(result));
}

function reasons(result) {
  return JSON.stringify({
    drift: result.drift,
    warnings: result.warnings,
    violations: result.violations
  }, null, 2);
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
