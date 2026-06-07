const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { contentHash } = require("./integrity");
const {
  DEFAULT_MANIFEST_PATH,
  readReleaseManifest,
  verifyReleaseManifest
} = require("./release");

const RUNTIME_VERIFY_SCHEMA = "clista.runtime.verify.v0";
const RUNTIME_THEOREM = "protocol_runtime = verify(execution_environment, against_release_manifest)";
const RUNTIME_HARD_LAW = "running != verified";

const DOES_NOT_PROVE = [
  "runtime trust",
  "protocol authority",
  "governance approval",
  "amendment approval",
  "compatibility proof",
  "package publishing trust",
  "OS security attestation",
  "CI trust",
  "remote runtime trust"
];

const PROVES = [
  "local runtime matches the supplied release manifest"
];

const VOLATILE_VERIFIER_STDOUT = new Set([
  "state_show",
  "export"
]);

const RUNTIME_GUARD_FIELDS = new Set([
  "trusted",
  "protocolAuthority",
  "governanceApproval",
  "amendmentApproval",
  "compatibilityProof"
]);

function verifyRuntime(options = {}) {
  const cwd = options.cwd || process.cwd();
  const manifestPath = options.manifestPath || options.manifest || DEFAULT_MANIFEST_PATH;
  const resolvedManifestPath = path.resolve(cwd, manifestPath);
  const result = baseResult(cwd, manifestPath, options);

  if (!fs.existsSync(resolvedManifestPath)) {
    addFinding(result, "violations", "release_manifest_missing", `release manifest missing: ${resolvedManifestPath}`);
    addFinding(result, "drift", "release_manifest_missing", `release manifest missing: ${resolvedManifestPath}`);
    return finalize(result);
  }

  let manifest;
  try {
    manifest = readReleaseManifest(manifestPath, cwd);
    result.manifestHash = manifest.manifest_hash || null;
  } catch (error) {
    addFinding(result, "violations", "release_manifest_invalid", error.message);
    addFinding(result, "drift", "release_manifest_invalid", error.message);
    return finalize(result);
  }

  result.manifestPackageVersion = manifest.package_version || null;
  result.manifestGitCommit = manifest.git_commit || null;
  result.manifestGitTag = manifest.git_tag || null;
  result.cliEntrypoint = manifest.cli_entrypoint || result.cliEntrypoint;

  const releaseVerification = verifyReleaseManifest(manifest, { cwd });
  result.releaseManifestVerified = releaseVerification.valid;
  if (!releaseVerification.valid) {
    addFinding(result, "violations", "release_manifest_not_verified", "release manifest failed release verification", {
      reasons: releaseVerification.reasons
    });
    addFinding(result, "drift", "release_manifest_not_verified", "release manifest failed release verification");
  }

  const packageJson = readPackageJson(cwd, result);
  if (packageJson) {
    verifyNodeVersion(packageJson, result);
    verifyPackageBinding(packageJson, manifest, cwd, result);
    verifyCliEntrypoint(packageJson, manifest, cwd, options, result);
  }

  verifySchemaHashes(manifest, cwd, result);
  verifySourceHashes(manifest, cwd, result);
  verifyGitBinding(manifest, cwd, result);
  verifyWorkingTree(cwd, result);
  verifyRequiredVerifiers(manifest, cwd, options, result);
  verifyRuntimeBoundary(result);

  return finalize(result);
}

function baseResult(cwd, manifestPath, options) {
  const packageJson = safeReadJson(path.join(cwd, "package.json"));
  const cliEntrypoint = packageJson?.bin?.clista || "src/cli.js";
  const currentCliPath = options.cliPath
    ? normalizePath(path.relative(cwd, path.resolve(options.cliPath)))
    : cliEntrypoint;
  return {
    schema: RUNTIME_VERIFY_SCHEMA,
    valid: false,
    runtimeVerified: false,
    releaseManifestVerified: false,
    theorem: RUNTIME_THEOREM,
    hardLaw: RUNTIME_HARD_LAW,
    nodeVersion: process.versions.node,
    requiredNodeVersion: packageJson?.engines?.node || null,
    cliEntrypoint,
    currentCliEntrypoint: currentCliPath,
    packageName: packageJson?.name || null,
    packageVersion: packageJson?.version || null,
    manifestPackageVersion: null,
    gitCommit: gitOutput(cwd, ["rev-parse", "HEAD"]),
    manifestGitCommit: null,
    gitTag: tagForHead(cwd),
    manifestGitTag: null,
    manifestPath,
    manifestHash: null,
    sourceHashesMatch: false,
    schemaHashesMatch: false,
    verifierCommandsAvailable: false,
    verifierResultsReproduced: false,
    workingTreeClean: false,
    trusted: false,
    protocolAuthority: false,
    governanceApproval: false,
    amendmentApproval: false,
    compatibilityProof: false,
    drift: [],
    warnings: [],
    violations: [],
    proves: PROVES,
    doesNotProve: DOES_NOT_PROVE
  };
}

function readPackageJson(cwd, result) {
  const packagePath = path.join(cwd, "package.json");
  if (!fs.existsSync(packagePath)) {
    addFinding(result, "violations", "package_manifest_missing", "package.json is missing");
    addFinding(result, "drift", "package_manifest_missing", "package.json is missing");
    return null;
  }
  try {
    return readJson(packagePath);
  } catch (error) {
    addFinding(result, "violations", "package_manifest_invalid", error.message);
    addFinding(result, "drift", "package_manifest_invalid", error.message);
    return null;
  }
}

function verifyNodeVersion(packageJson, result) {
  result.requiredNodeVersion = packageJson.engines?.node || null;
  if (!result.requiredNodeVersion) {
    addFinding(result, "warnings", "node_requirement_missing", "package.json engines.node is not declared");
    return;
  }
  const status = satisfiesNodeRange(result.nodeVersion, result.requiredNodeVersion);
  if (status === "unsupported") {
    addFinding(result, "warnings", "node_requirement_unsupported", `unsupported Node range ${result.requiredNodeVersion}`);
    return;
  }
  if (!status) {
    addFinding(result, "violations", "node_version_mismatch", `Node ${result.nodeVersion} does not satisfy ${result.requiredNodeVersion}`);
    addFinding(result, "drift", "node_version_mismatch", `Node ${result.nodeVersion} does not satisfy ${result.requiredNodeVersion}`);
  }
}

function verifyPackageBinding(packageJson, manifest, cwd, result) {
  result.packageName = packageJson.name || null;
  result.packageVersion = packageJson.version || null;
  if (manifest.package_name && packageJson.name !== manifest.package_name) {
    addFinding(result, "violations", "package_name_mismatch", `package name ${packageJson.name} does not match manifest ${manifest.package_name}`);
    addFinding(result, "drift", "package_name_mismatch", `package name ${packageJson.name} does not match manifest ${manifest.package_name}`);
  }
  if (manifest.package_version && packageJson.version !== manifest.package_version) {
    addFinding(result, "violations", "package_version_mismatch", `package version ${packageJson.version} does not match manifest ${manifest.package_version}`);
    addFinding(result, "drift", "package_version_mismatch", `package version ${packageJson.version} does not match manifest ${manifest.package_version}`);
  }
  const packageHash = safeFileHash(path.join(cwd, "package.json"));
  if (manifest.package_manifest?.hash && packageHash !== manifest.package_manifest.hash) {
    addFinding(result, "violations", "package_manifest_hash_mismatch", "package.json hash does not match release manifest");
    addFinding(result, "drift", "package_manifest_hash_mismatch", "package.json hash does not match release manifest");
  }
  if (manifest.package_manifest?.bin?.clista && packageJson.bin?.clista !== manifest.package_manifest.bin.clista) {
    addFinding(result, "violations", "package_bin_mismatch", `package bin.clista ${packageJson.bin?.clista} does not match manifest ${manifest.package_manifest.bin.clista}`);
    addFinding(result, "drift", "package_bin_mismatch", "package bin.clista does not match release manifest");
  }
}

function verifyCliEntrypoint(packageJson, manifest, cwd, options, result) {
  const manifestCli = manifest.cli_entrypoint;
  const packageCli = packageJson.bin?.clista;
  const currentCli = options.cliPath
    ? normalizePath(path.relative(cwd, path.resolve(options.cliPath)))
    : manifestCli || packageCli;
  result.cliEntrypoint = manifestCli || packageCli || null;
  result.currentCliEntrypoint = currentCli || null;

  if (!manifestCli) {
    addFinding(result, "violations", "cli_entrypoint_missing", "release manifest is missing cli_entrypoint");
    addFinding(result, "drift", "cli_entrypoint_missing", "release manifest is missing cli_entrypoint");
    return;
  }
  if (!fs.existsSync(path.join(cwd, manifestCli))) {
    addFinding(result, "violations", "cli_entrypoint_missing", `CLI entrypoint missing: ${manifestCli}`);
    addFinding(result, "drift", "cli_entrypoint_missing", `CLI entrypoint missing: ${manifestCli}`);
  }
  if (packageCli !== manifestCli) {
    addFinding(result, "violations", "cli_entrypoint_mismatch", `package bin.clista ${packageCli} does not match manifest ${manifestCli}`);
    addFinding(result, "drift", "cli_entrypoint_mismatch", "package CLI entrypoint does not match manifest");
  }
  if (currentCli && currentCli !== manifestCli) {
    addFinding(result, "violations", "cli_entrypoint_mismatch", `current CLI ${currentCli} does not match manifest ${manifestCli}`);
    addFinding(result, "drift", "cli_entrypoint_mismatch", "current CLI entrypoint does not match manifest");
  }
}

function verifySchemaHashes(manifest, cwd, result) {
  const files = Array.isArray(manifest.schema_files) ? manifest.schema_files : [];
  let matches = files.length > 0;
  if (!files.length) {
    addFinding(result, "violations", "schema_files_missing", "release manifest has no schema_files");
  }
  for (const file of files) {
    const filePath = path.join(cwd, file.path || "");
    if (!file.path || !fs.existsSync(filePath)) {
      matches = false;
      addFinding(result, "violations", "schema_file_missing", `schema file missing: ${file.path || "unknown"}`);
      addFinding(result, "drift", "schema_file_missing", `schema file missing: ${file.path || "unknown"}`);
      continue;
    }
    const hash = safeFileHash(filePath);
    if (hash !== file.hash) {
      matches = false;
      addFinding(result, "violations", "schema_hash_mismatch", `schema hash mismatch: ${file.path}`);
      addFinding(result, "drift", "schema_hash_mismatch", `schema hash mismatch: ${file.path}`);
    }
  }
  const expectedSetHash = contentHash(files.map(fileHashMaterial));
  if (manifest.schema_set_hash && manifest.schema_set_hash !== expectedSetHash) {
    matches = false;
    addFinding(result, "violations", "schema_set_hash_mismatch", "schema_set_hash does not match schema_files");
    addFinding(result, "drift", "schema_set_hash_mismatch", "schema_set_hash does not match schema_files");
  }
  result.schemaHashesMatch = matches;
}

function verifySourceHashes(manifest, cwd, result) {
  const files = Array.isArray(manifest.source_files) ? manifest.source_files : [];
  let matches = files.length > 0;
  if (!files.length) {
    addFinding(result, "violations", "source_files_missing", "release manifest has no source_files");
  }
  for (const file of files) {
    const filePath = path.join(cwd, file.path || "");
    if (!file.path || !fs.existsSync(filePath)) {
      matches = false;
      addFinding(result, "violations", "source_file_missing", `source file missing: ${file.path || "unknown"}`);
      addFinding(result, "drift", "source_file_missing", `source file missing: ${file.path || "unknown"}`);
      continue;
    }
    const hash = safeFileHash(filePath);
    if (hash !== file.hash) {
      matches = false;
      addFinding(result, "violations", "source_hash_mismatch", `source hash mismatch: ${file.path}`);
      addFinding(result, "drift", "source_hash_mismatch", `source hash mismatch: ${file.path}`);
    }
  }
  const expectedSetHash = contentHash(files.map(fileHashMaterial));
  if (manifest.file_set_hash && manifest.file_set_hash !== expectedSetHash) {
    matches = false;
    addFinding(result, "violations", "file_set_hash_mismatch", "file_set_hash does not match source_files");
    addFinding(result, "drift", "file_set_hash_mismatch", "file_set_hash does not match source_files");
  }
  result.sourceHashesMatch = matches;
}

function verifyGitBinding(manifest, cwd, result) {
  if (!insideGitWorkTree(cwd)) {
    addFinding(result, "warnings", "git_metadata_missing", "not running inside a Git work tree");
    return;
  }
  const head = gitOutput(cwd, ["rev-parse", "HEAD"]);
  result.gitCommit = head;
  if (manifest.git_commit && head !== manifest.git_commit) {
    addFinding(result, "violations", "git_commit_mismatch", `git commit ${head} does not match manifest ${manifest.git_commit}`);
    addFinding(result, "drift", "git_commit_mismatch", `git commit ${head} does not match manifest ${manifest.git_commit}`);
  }
  const tagCommit = manifest.git_tag ? gitOutput(cwd, ["rev-list", "-n", "1", manifest.git_tag]) : null;
  if (!manifest.git_tag || !tagCommit) {
    addFinding(result, "violations", "git_tag_missing", `git tag does not resolve: ${manifest.git_tag || "unknown"}`);
    addFinding(result, "drift", "git_tag_missing", `git tag does not resolve: ${manifest.git_tag || "unknown"}`);
  } else if (manifest.git_commit && tagCommit !== manifest.git_commit) {
    addFinding(result, "violations", "git_tag_mismatch", `git tag ${manifest.git_tag} points to ${tagCommit}, not ${manifest.git_commit}`);
    addFinding(result, "drift", "git_tag_mismatch", `git tag ${manifest.git_tag} points to ${tagCommit}, not ${manifest.git_commit}`);
  }
  const headTags = tagsForHead(cwd);
  result.gitTag = headTags.includes(manifest.git_tag) ? manifest.git_tag : headTags[0] || null;
  if (manifest.git_tag && !headTags.includes(manifest.git_tag)) {
    addFinding(result, "violations", "git_tag_mismatch", `current HEAD is not tagged ${manifest.git_tag}`);
    addFinding(result, "drift", "git_tag_mismatch", `current HEAD is not tagged ${manifest.git_tag}`);
  }
}

function verifyWorkingTree(cwd, result) {
  if (!insideGitWorkTree(cwd)) {
    result.workingTreeClean = false;
    return;
  }
  const status = gitOutput(cwd, ["status", "--porcelain"]) || "";
  const lines = status.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
  if (!lines.length) {
    result.workingTreeClean = true;
    return;
  }
  result.workingTreeClean = false;
  const tracked = lines.filter((line) => !line.startsWith("??"));
  const untracked = lines.filter((line) => line.startsWith("??"));
  if (tracked.length) {
    addFinding(result, "violations", "dirty_tracked_files", "tracked working tree files are dirty", {
      files: tracked.map((line) => line.slice(3).trim())
    });
    addFinding(result, "drift", "dirty_working_tree", "tracked working tree files are dirty");
  }
  if (untracked.length) {
    addFinding(result, "warnings", "untracked_files", "working tree has untracked files", {
      files: untracked.map((line) => line.slice(3).trim())
    });
    addFinding(result, "drift", "dirty_working_tree", "working tree has untracked files");
  }
}

function verifyRequiredVerifiers(manifest, cwd, options, result) {
  const verifiers = Array.isArray(manifest.required_verifiers) ? manifest.required_verifiers : [];
  const expectedResults = new Map((Array.isArray(manifest.verifier_results) ? manifest.verifier_results : [])
    .map((item) => [item.id, item]));
  const cliPath = path.resolve(cwd, manifest.cli_entrypoint || options.cliPath || "src/cli.js");
  let commandsAvailable = verifiers.length > 0;
  let reproduced = verifiers.length > 0;

  if (!verifiers.length) {
    addFinding(result, "violations", "required_verifiers_missing", "release manifest has no required_verifiers");
  }

  for (const verifier of verifiers) {
    const id = verifier.id || "unknown";
    const args = Array.isArray(verifier.args) ? verifier.args : [];
    if (!verifier.id || !args.length) {
      commandsAvailable = false;
      reproduced = false;
      addFinding(result, "violations", "required_verifier_invalid", `required verifier ${id} is missing id or args`);
      continue;
    }
    const current = runVerifier(cwd, cliPath, verifier);
    const expected = expectedResults.get(id);
    if (current.error) {
      commandsAvailable = false;
      reproduced = false;
      addFinding(result, "violations", "required_verifier_unavailable", `required verifier ${id} could not run: ${current.error}`);
      addFinding(result, "drift", "required_verifier_unavailable", `required verifier ${id} could not run`);
      continue;
    }
    if (current.exit_code !== 0) {
      reproduced = false;
      addFinding(result, "violations", "required_verifier_failed", `required verifier ${id} exited ${current.exit_code}`);
      addFinding(result, "drift", "required_verifier_failed", `required verifier ${id} exited ${current.exit_code}`);
    }
    if (!expected) {
      reproduced = false;
      addFinding(result, "violations", "verifier_result_missing", `manifest missing verifier result ${id}`);
      continue;
    }
    if (expected.exit_code !== current.exit_code) {
      reproduced = false;
      addFinding(result, "violations", "verifier_result_not_reproduced", `verifier ${id} exit code ${current.exit_code} does not match manifest ${expected.exit_code}`);
      addFinding(result, "drift", "verifier_result_not_reproduced", `verifier ${id} exit code differs`);
    }
    if (expected.output_schema !== current.output_schema) {
      reproduced = false;
      addFinding(result, "violations", "verifier_result_not_reproduced", `verifier ${id} output schema ${current.output_schema} does not match manifest ${expected.output_schema}`);
      addFinding(result, "drift", "verifier_result_not_reproduced", `verifier ${id} output schema differs`);
    }
    if (expected.stderr_hash && expected.stderr_hash !== current.stderr_hash) {
      reproduced = false;
      addFinding(result, "violations", "verifier_result_not_reproduced", `verifier ${id} stderr hash does not match manifest`);
      addFinding(result, "drift", "verifier_result_not_reproduced", `verifier ${id} stderr hash differs`);
    }
    if (expected.stdout_hash && expected.stdout_hash !== current.stdout_hash) {
      if (VOLATILE_VERIFIER_STDOUT.has(id) && current.exit_code === expected.exit_code && current.output_schema === expected.output_schema) {
        addFinding(result, "warnings", "verifier_stdout_hash_volatile", `verifier ${id} stdout hash differs but schema and exit code reproduced`);
      } else {
        reproduced = false;
        addFinding(result, "violations", "verifier_result_not_reproduced", `verifier ${id} stdout hash does not match manifest`);
        addFinding(result, "drift", "verifier_result_not_reproduced", `verifier ${id} stdout hash differs`);
      }
    }
  }

  result.verifierCommandsAvailable = commandsAvailable;
  result.verifierResultsReproduced = reproduced;
}

function verifyRuntimeBoundary(result) {
  for (const field of RUNTIME_GUARD_FIELDS) {
    if (result[field] !== false) {
      addFinding(result, "violations", "runtime_boundary_claim", `runtime field ${field} must be false`);
      addFinding(result, "drift", "runtime_boundary_claim", `runtime field ${field} must be false`);
    }
  }
}

function finalize(result) {
  const valid = result.violations.length === 0;
  result.valid = valid;
  result.runtimeVerified = valid;
  return result;
}

function runVerifier(cwd, cliPath, verifier) {
  const args = Array.isArray(verifier.args) ? verifier.args : [];
  const spawned = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  return {
    id: verifier.id,
    command: verifier.command,
    args,
    passed: spawned.status === 0,
    exit_code: spawned.status,
    stdout_hash: contentHash(spawned.stdout || ""),
    stderr_hash: contentHash(spawned.stderr || ""),
    output_schema: parseOutputSchema(spawned.stdout),
    error: spawned.error ? spawned.error.message : null
  };
}

function addFinding(result, bucket, violationType, reason, extra = {}) {
  result[bucket].push({
    violationType,
    reason,
    ...extra
  });
}

function satisfiesNodeRange(version, range) {
  const parsed = parseVersion(version);
  const normalized = String(range || "").trim();
  const minimum = /^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(normalized);
  if (minimum) {
    return compareVersions(parsed, [
      Number(minimum[1]),
      Number(minimum[2] || 0),
      Number(minimum[3] || 0)
    ]) >= 0;
  }
  const exact = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(normalized);
  if (exact) {
    return compareVersions(parsed, [
      Number(exact[1]),
      Number(exact[2] || 0),
      Number(exact[3] || 0)
    ]) === 0;
  }
  return "unsupported";
}

function parseVersion(version) {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(version || ""));
  return [
    Number(match?.[1] || 0),
    Number(match?.[2] || 0),
    Number(match?.[3] || 0)
  ];
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) {
      return 1;
    }
    if (left[index] < right[index]) {
      return -1;
    }
  }
  return 0;
}

function insideGitWorkTree(cwd) {
  return gitOutput(cwd, ["rev-parse", "--is-inside-work-tree"]) === "true";
}

function tagForHead(cwd) {
  return tagsForHead(cwd)[0] || null;
}

function tagsForHead(cwd) {
  const tags = gitOutput(cwd, ["tag", "--points-at", "HEAD"]);
  if (!tags) {
    return [];
  }
  return tags.split(/\r?\n/).map((tag) => tag.trim()).filter(Boolean);
}

function gitOutput(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

function safeReadJson(filePath) {
  try {
    return readJson(filePath);
  } catch (_) {
    return null;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeFileHash(filePath) {
  try {
    return contentHash(fs.readFileSync(filePath));
  } catch (_) {
    return null;
  }
}

function fileHashMaterial(file) {
  return {
    path: file.path,
    hash: file.hash
  };
}

function parseOutputSchema(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return parsed && typeof parsed === "object" ? parsed.schema || null : null;
  } catch (_) {
    return null;
  }
}

function normalizePath(value) {
  return String(value || "").split(path.sep).join("/");
}

module.exports = {
  RUNTIME_HARD_LAW,
  RUNTIME_THEOREM,
  RUNTIME_VERIFY_SCHEMA,
  verifyRuntime
};
