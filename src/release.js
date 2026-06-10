const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { contentHash, PROTOCOL_VERSION } = require("./integrity");
const {
  LOCAL_CAPABILITY_SET,
  SUPPORTED_VERIFICATION_LAYERS
} = require("./compatibility");
const { stripUndefined, unique } = require("./utils");

const RELEASE_SCHEMA = "clista.release.manifest.v0";
const RELEASE_VERIFY_SCHEMA = "clista.release.verify.v0";
const RELEASE_PROTOCOL_VERSION = "0.25.0";
const RELEASE_THEOREM = "protocol_release = package(verified_runtime, with_reproducible_manifest)";
const RELEASE_HARD_LAW = "release != trust";
const DEFAULT_MANIFEST_PATH = ".clista/release-manifest.json";

const REQUIRED_VERIFIERS = [
  verifier("validate", ["validate"]),
  verifier("integrity_verify", ["integrity", "verify"]),
  verifier("continuity_verify", ["continuity", "verify"]),
  verifier("compatibility_verify", ["compatibility", "verify"]),
  verifier("interoperability_verify", ["interoperability", "verify"]),
  verifier("federation_verify", ["federation", "verify"]),
  verifier("negotiation_verify", ["negotiation", "verify"]),
  verifier("delegation_verify", ["delegation", "verify"]),
  verifier("execution_verify", ["execution", "verify"]),
  verifier("outcome_verify", ["outcome", "verify"]),
  verifier("outcome_learning_verify", ["outcome-learning", "verify"]),
  verifier("review_verify", ["review", "verify"]),
  verifier("recovery_verify", ["recovery", "verify"]),
  verifier("state_show", ["state", "show"]),
  verifier("export", ["export"])
];

const REQUIRED_SOURCE_PATHS = [
  "package.json",
  "src/cli.js",
  "src/release.js"
];

const RELEASE_GUARD_FIELDS = new Set([
  "releaseAsTrust",
  "trustByExistence",
  "trustedBecauseReleased",
  "protocolAuthority",
  "authorityCreated",
  "governanceApproval",
  "amendmentApproval",
  "compatibilityProof",
  "publishingVerified",
  "silentReleaseMutation"
]);

function buildReleaseManifest(cwd = process.cwd(), options = {}) {
  const packageJson = readJson(path.join(cwd, "package.json"));
  const packageVersion = packageJson.version;
  const packageName = packageJson.name;
  const cliEntrypoint = normalizePath(options.cliEntrypoint || packageJson.bin?.clista || "src/cli.js");
  const gitCommit = options.gitCommit || gitOutput(cwd, ["rev-parse", "HEAD"]);
  const gitTag = options.gitTag || options.tag || tagForHead(cwd, gitCommit) || expectedReleaseTag(packageVersion);
  const schemaFiles = buildSchemaFileSet(cwd);
  const sourceFiles = buildSourceFileSet(cwd, options);
  const verifierResults = options.verifierResults
    || (options.runVerifiers === false ? [] : runRequiredVerifiers(cwd, options));
  const manifest = {
    schema: RELEASE_SCHEMA,
    theorem: RELEASE_THEOREM,
    hard_law: RELEASE_HARD_LAW,
    release_id: options.releaseId || releaseId(packageVersion, gitTag),
    release_protocol_version: RELEASE_PROTOCOL_VERSION,
    protocol_version: PROTOCOL_VERSION,
    package_name: packageName,
    package_version: packageVersion,
    git_commit: gitCommit,
    git_tag: gitTag,
    created_at: options.createdAt || new Date().toISOString(),
    cli_entrypoint: cliEntrypoint,
    package_manifest: {
      path: "package.json",
      hash: fileHash(path.join(cwd, "package.json")),
      bin: packageJson.bin || {}
    },
    schema_files: schemaFiles,
    schema_set_hash: contentHash(schemaFiles.map(fileHashMaterial)),
    source_files: sourceFiles,
    file_set_hash: contentHash(sourceFiles.map(fileHashMaterial)),
    required_verifiers: REQUIRED_VERIFIERS,
    verifier_results: verifierResults,
    capability_set: unique([...LOCAL_CAPABILITY_SET, "release"]),
    required_verification_layers: SUPPORTED_VERIFICATION_LAYERS,
    export_shape_version: PROTOCOL_VERSION,
    package_artifact_hash: options.packageArtifact ? fileHash(path.resolve(cwd, options.packageArtifact)) : null,
    previous_release_ref: options.previousReleaseRef || null,
    release_exists: true,
    release_verified: false,
    trusted: false,
    protocolAuthority: false,
    governanceApproval: false,
    amendmentApproval: false,
    compatibilityProof: false,
    publishingVerified: false,
    silentReleaseMutation: false
  };
  manifest.manifest_hash = releaseManifestHash(manifest);
  return manifest;
}

function verifyReleaseManifest(manifest, options = {}) {
  const cwd = options.cwd || process.cwd();
  const reasons = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return verifyResult(null, ["release manifest must be an object"]);
  }

  requireEqual(reasons, "schema", manifest.schema, RELEASE_SCHEMA);
  requireEqual(reasons, "theorem", manifest.theorem, RELEASE_THEOREM);
  requireEqual(reasons, "hard_law", manifest.hard_law, RELEASE_HARD_LAW);
  requireEqual(reasons, "release_protocol_version", manifest.release_protocol_version, RELEASE_PROTOCOL_VERSION);
  requireEqual(reasons, "protocol_version", manifest.protocol_version, PROTOCOL_VERSION);

  for (const field of [
    "release_id",
    "package_name",
    "package_version",
    "git_commit",
    "git_tag",
    "created_at",
    "cli_entrypoint",
    "manifest_hash"
  ]) {
    if (!manifest[field]) {
      reasons.push(`${field} is required`);
    }
  }

  if (manifest.created_at && Number.isNaN(Date.parse(manifest.created_at))) {
    reasons.push(`created_at is malformed: ${manifest.created_at}`);
  }

  if (manifest.release_exists !== true) {
    reasons.push("release_exists must be true");
  }
  if (manifest.release_verified !== false) {
    reasons.push("manifest must not claim release_verified; verification is produced by clista release verify");
  }
  if (manifest.trusted !== false) {
    reasons.push("release manifest must not claim trust");
  }

  reasons.push(...rejectReleaseGuardFields(manifest));
  validateManifestHash(manifest, reasons);
  validatePackageBinding(manifest, cwd, reasons);
  validateGitBinding(manifest, cwd, reasons);
  validateCliEntrypoint(manifest, cwd, reasons);
  validateSchemaFiles(manifest, cwd, reasons);
  validateSourceFiles(manifest, cwd, reasons);
  validateVerifierResults(manifest, reasons);
  validateCapabilities(manifest, reasons);

  return verifyResult(manifest, reasons);
}

function readReleaseManifest(manifestPath, cwd = process.cwd()) {
  const resolved = path.resolve(cwd, manifestPath || DEFAULT_MANIFEST_PATH);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Release manifest not found: ${resolved}`);
  }
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function writeReleaseManifest(manifest, manifestPath, cwd = process.cwd()) {
  const target = path.resolve(cwd, manifestPath || DEFAULT_MANIFEST_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return target;
}

function runRequiredVerifiers(cwd = process.cwd(), options = {}) {
  return REQUIRED_VERIFIERS.map((item) => runVerifier(cwd, item, options));
}

function runVerifier(cwd, item, options = {}) {
  const cliPath = options.cliPath || path.join(cwd, "src", "cli.js");
  const result = spawnSync(process.execPath, [cliPath, ...item.args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  return {
    id: item.id,
    command: item.command,
    passed: result.status === 0,
    exit_code: result.status,
    stdout_hash: contentHash(result.stdout || ""),
    stderr_hash: contentHash(result.stderr || ""),
    output_schema: parseOutputSchema(result.stdout),
    error: result.error ? result.error.message : null
  };
}

function releaseManifestHash(manifest) {
  const material = { ...(manifest || {}) };
  delete material.manifest_hash;
  return contentHash(material);
}

function expectedReleaseTag(packageVersion) {
  return `v${packageVersion}-protocol-release`;
}

function releaseId(packageVersion, gitTag) {
  return `rel_${String(gitTag || packageVersion).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase()}`;
}

function verifier(id, args) {
  return {
    id,
    command: ["clista", ...args],
    args
  };
}

function buildSchemaFileSet(cwd) {
  const schemaDir = path.join(cwd, "schemas");
  if (!fs.existsSync(schemaDir)) {
    return [];
  }
  return fs.readdirSync(schemaDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const relativePath = normalizePath(path.join("schemas", file));
      const absolutePath = path.join(cwd, relativePath);
      let parsed = true;
      let parseError = null;
      try {
        JSON.parse(fs.readFileSync(absolutePath, "utf8"));
      } catch (error) {
        parsed = false;
        parseError = error.message;
      }
      return stripUndefined({
        path: relativePath,
        hash: fileHash(absolutePath),
        parsed,
        parse_error: parseError
      });
    });
}

function buildSourceFileSet(cwd, options = {}) {
  const files = options.sourceFiles || gitFiles(cwd) || fallbackSourceFiles(cwd);
  return unique(files.map(normalizePath))
    .filter((file) => file && fs.existsSync(path.join(cwd, file)) && fs.statSync(path.join(cwd, file)).isFile())
    .sort()
    .map((file) => ({
      path: file,
      hash: fileHash(path.join(cwd, file))
    }));
}

function fallbackSourceFiles(cwd) {
  const files = [];
  for (const entry of ["package.json", "README.md", "src", "schemas", "docs", "test", "examples"]) {
    collectFiles(path.join(cwd, entry), cwd, files);
  }
  return files;
}

function collectFiles(target, cwd, files) {
  if (!fs.existsSync(target)) {
    return;
  }
  const stats = fs.statSync(target);
  if (stats.isFile()) {
    files.push(normalizePath(path.relative(cwd, target)));
    return;
  }
  if (!stats.isDirectory()) {
    return;
  }
  for (const entry of fs.readdirSync(target).sort()) {
    if (entry === "node_modules" || entry === ".git") {
      continue;
    }
    collectFiles(path.join(target, entry), cwd, files);
  }
}

function validateManifestHash(manifest, reasons) {
  const expected = releaseManifestHash(manifest);
  if (manifest.manifest_hash !== expected) {
    reasons.push(`manifest_hash mismatch: expected ${expected}, got ${manifest.manifest_hash}`);
  }
}

function validatePackageBinding(manifest, cwd, reasons) {
  const packagePath = path.join(cwd, "package.json");
  if (!fs.existsSync(packagePath)) {
    reasons.push("package.json is missing");
    return;
  }
  const packageJson = readJson(packagePath);
  if (manifest.package_name !== packageJson.name) {
    reasons.push(`package_name mismatch: expected ${packageJson.name}, got ${manifest.package_name}`);
  }
  if (manifest.package_version !== packageJson.version) {
    reasons.push(`package_version mismatch: expected ${packageJson.version}, got ${manifest.package_version}`);
  }
  const tagVersion = versionFromTag(manifest.git_tag);
  if (!tagVersion) {
    reasons.push(`git_tag does not contain a release version: ${manifest.git_tag}`);
  } else if (tagVersion !== packageJson.version) {
    reasons.push(`package version ${packageJson.version} does not match release tag version ${tagVersion}`);
  }
  if (manifest.package_manifest?.hash !== fileHash(packagePath)) {
    reasons.push("package manifest hash does not match package.json");
  }
  if (manifest.package_manifest?.bin?.clista !== packageJson.bin?.clista) {
    reasons.push("package manifest bin.clista does not match package.json");
  }
}

function validateGitBinding(manifest, cwd, reasons) {
  const head = gitOutput(cwd, ["rev-parse", "HEAD"]);
  if (!head) {
    reasons.push("git commit could not be resolved");
  } else if (manifest.git_commit !== head) {
    reasons.push(`git_commit mismatch: expected ${head}, got ${manifest.git_commit}`);
  }
  const tagCommit = gitOutput(cwd, ["rev-list", "-n", "1", manifest.git_tag]);
  if (!tagCommit) {
    reasons.push(`git_tag does not resolve: ${manifest.git_tag}`);
  } else if (tagCommit !== manifest.git_commit) {
    reasons.push(`git_tag ${manifest.git_tag} points to ${tagCommit}, not ${manifest.git_commit}`);
  }
}

function validateCliEntrypoint(manifest, cwd, reasons) {
  const cliPath = path.join(cwd, manifest.cli_entrypoint || "");
  if (!manifest.cli_entrypoint) {
    reasons.push("cli_entrypoint is required");
    return;
  }
  if (!fs.existsSync(cliPath)) {
    reasons.push(`CLI entrypoint missing: ${manifest.cli_entrypoint}`);
    return;
  }
  const packageJson = readJson(path.join(cwd, "package.json"));
  if (packageJson.bin?.clista !== manifest.cli_entrypoint) {
    reasons.push(`CLI entrypoint ${manifest.cli_entrypoint} does not match package.json bin.clista ${packageJson.bin?.clista}`);
  }
}

function validateSchemaFiles(manifest, cwd, reasons) {
  const schemaFiles = Array.isArray(manifest.schema_files) ? manifest.schema_files : [];
  if (!schemaFiles.length) {
    reasons.push("schema_files must include at least one schema");
    return;
  }
  for (const schemaFile of schemaFiles) {
    const filePath = path.join(cwd, schemaFile.path || "");
    if (!schemaFile.path || !fs.existsSync(filePath)) {
      reasons.push(`schema file missing: ${schemaFile.path || "unknown"}`);
      continue;
    }
    if (schemaFile.hash !== fileHash(filePath)) {
      reasons.push(`schema file hash mismatch: ${schemaFile.path}`);
    }
    try {
      JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      reasons.push(`schema JSON parse failed for ${schemaFile.path}: ${error.message}`);
    }
    if (schemaFile.parsed !== true) {
      reasons.push(`schema file ${schemaFile.path} must be marked parsed`);
    }
  }
  const expectedHash = contentHash(schemaFiles.map(fileHashMaterial));
  if (manifest.schema_set_hash !== expectedHash) {
    reasons.push("schema_set_hash does not match schema_files");
  }
}

function validateSourceFiles(manifest, cwd, reasons) {
  const sourceFiles = Array.isArray(manifest.source_files) ? manifest.source_files : [];
  if (!sourceFiles.length) {
    reasons.push("source_files must include release file hashes");
    return;
  }
  const paths = sourceFiles.map((file) => file.path);
  for (const requiredPath of REQUIRED_SOURCE_PATHS) {
    if (!paths.includes(requiredPath)) {
      reasons.push(`source_files missing required path ${requiredPath}`);
    }
  }
  for (const sourceFile of sourceFiles) {
    const filePath = path.join(cwd, sourceFile.path || "");
    if (!sourceFile.path || !fs.existsSync(filePath)) {
      reasons.push(`source file missing: ${sourceFile.path || "unknown"}`);
      continue;
    }
    if (sourceFile.hash !== fileHash(filePath)) {
      reasons.push(`source file hash mismatch: ${sourceFile.path}`);
    }
  }
  const tracked = gitFiles(cwd);
  if (tracked) {
    const trackedSet = new Set(tracked);
    const manifestSet = new Set(paths);
    for (const trackedPath of trackedSet) {
      if (!manifestSet.has(trackedPath)) {
        reasons.push(`source_files missing tracked path ${trackedPath}`);
      }
    }
    for (const manifestPath of manifestSet) {
      if (!trackedSet.has(manifestPath)) {
        reasons.push(`source_files includes non-tracked path ${manifestPath}`);
      }
    }
  }
  const expectedHash = contentHash(sourceFiles.map(fileHashMaterial));
  if (manifest.file_set_hash !== expectedHash) {
    reasons.push("file_set_hash does not match source_files");
  }
}

function validateVerifierResults(manifest, reasons) {
  const results = Array.isArray(manifest.verifier_results) ? manifest.verifier_results : [];
  if (!results.length) {
    reasons.push("verifier_results are required");
  }
  const byId = new Map(results.map((result) => [result.id, result]));
  for (const verifierSpec of REQUIRED_VERIFIERS) {
    const result = byId.get(verifierSpec.id);
    if (!result) {
      reasons.push(`missing verifier result ${verifierSpec.id}`);
      continue;
    }
    if (result.passed !== true || result.exit_code !== 0) {
      reasons.push(`verifier ${verifierSpec.id} did not pass`);
    }
    if (!result.stdout_hash || !result.stderr_hash) {
      reasons.push(`verifier ${verifierSpec.id} missing output hashes`);
    }
  }
}

function validateCapabilities(manifest, reasons) {
  const capabilities = Array.isArray(manifest.capability_set) ? manifest.capability_set : [];
  if (!capabilities.includes("release")) {
    reasons.push("capability_set must include release");
  }
  for (const capability of LOCAL_CAPABILITY_SET) {
    if (!capabilities.includes(capability)) {
      reasons.push(`capability_set missing ${capability}`);
    }
  }
  const layers = Array.isArray(manifest.required_verification_layers) ? manifest.required_verification_layers : [];
  for (const layer of SUPPORTED_VERIFICATION_LAYERS) {
    if (!layers.includes(layer)) {
      reasons.push(`required_verification_layers missing ${layer}`);
    }
  }
}

function rejectReleaseGuardFields(value, pathParts = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...pathParts, key];
    if (RELEASE_GUARD_FIELDS.has(key) && child !== false && child !== undefined && child !== null) {
      reasons.push(`release field ${fullPath.join(".")} must be false or absent`);
      continue;
    }
    if (key === "trusted" && child !== false) {
      reasons.push(`release field ${fullPath.join(".")} must be false`);
      continue;
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectReleaseGuardFields(child, fullPath));
    }
  }
  return reasons;
}

function verifyResult(manifest, reasons) {
  const valid = reasons.length === 0;
  return {
    schema: RELEASE_VERIFY_SCHEMA,
    valid,
    theorem: RELEASE_THEOREM,
    hardLaw: RELEASE_HARD_LAW,
    releaseId: manifest?.release_id || null,
    packageVersion: manifest?.package_version || null,
    gitCommit: manifest?.git_commit || null,
    gitTag: manifest?.git_tag || null,
    manifestHash: manifest?.manifest_hash || null,
    recomputedManifestHash: manifest ? releaseManifestHash(manifest) : null,
    releaseExists: Boolean(manifest?.release_exists),
    releaseVerified: valid,
    trusted: false,
    protocolAuthority: false,
    governanceApproval: false,
    amendmentApproval: false,
    compatibilityProof: false,
    reasons,
    violations: reasons.map((reason) => ({
      violationType: "release_verification_failure",
      reason
    }))
  };
}

function versionFromTag(tag) {
  const match = /^v(\d+\.\d+\.\d+)(?:-|$)/.exec(String(tag || ""));
  return match ? match[1] : null;
}

function tagForHead(cwd, commit) {
  if (!commit) {
    return null;
  }
  const tags = gitOutput(cwd, ["tag", "--points-at", commit]);
  if (!tags) {
    return null;
  }
  return tags.split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .find((tag) => tag.includes("protocol-release"))
    || tags.split(/\r?\n/).map((tag) => tag.trim()).filter(Boolean)[0]
    || null;
}

function gitFiles(cwd) {
  const output = gitOutput(cwd, ["ls-files"]);
  if (!output) {
    return null;
  }
  return output.split(/\r?\n/)
    .map(normalizePath)
    .filter(Boolean)
    .sort();
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

function parseOutputSchema(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return parsed && typeof parsed === "object" ? parsed.schema || null : null;
  } catch (_) {
    return null;
  }
}

function fileHash(filePath) {
  return contentHash(fs.readFileSync(filePath));
}

function fileHashMaterial(file) {
  return {
    path: file.path,
    hash: file.hash
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizePath(value) {
  return String(value || "").split(path.sep).join("/");
}

function requireEqual(reasons, field, actual, expected) {
  if (actual !== expected) {
    reasons.push(`${field} mismatch: expected ${expected}, got ${actual}`);
  }
}



module.exports = {
  DEFAULT_MANIFEST_PATH,
  RELEASE_HARD_LAW,
  RELEASE_PROTOCOL_VERSION,
  RELEASE_SCHEMA,
  RELEASE_THEOREM,
  RELEASE_VERIFY_SCHEMA,
  REQUIRED_VERIFIERS,
  buildReleaseManifest,
  expectedReleaseTag,
  readReleaseManifest,
  releaseManifestHash,
  runRequiredVerifiers,
  verifyReleaseManifest,
  writeReleaseManifest
};
