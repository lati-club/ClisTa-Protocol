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
const RUNTIME_AUDIT_SCHEMA = "clista.runtime.audit.v0";
const RUNTIME_THEOREM = "protocol_runtime = verify(execution_environment, against_release_manifest)";
const RUNTIME_HARD_LAW = "running != verified";
const RUNTIME_USAGE_THEOREM = "runtime_usability = verify(user_can_execute_runtime_verification, without_protocol_insider_context)";
const RUNTIME_USAGE_HARD_LAW = "verified_runtime != usable_runtime";
const RUNTIME_AUDIT_COMMAND = "clista runtime audit";
const RUNTIME_VERIFY_COMMAND = "clista runtime verify --manifest .clista/release-manifest.json";

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

const USAGE_DOC_PATHS = [
  "README.md",
  "docs/quickstart.md",
  "docs/protocol/v0/milestone-26.md",
  "docs/protocol/v0/milestone-26.1.md"
];

const STATE_SNAPSHOT_PATHS = [
  ".clista/events.ndjson",
  ".clista/projected-state.json",
  "projected-state.json",
  ".clista/protocol-export.json",
  "protocol-export.json",
  "clista-export.json",
  "continuity.json",
  ".clista/continuity.json"
];

const REQUIRED_BOUNDARY_TERMS = [
  "runtime trust",
  "protocol authority",
  "governance approval",
  "amendment approval",
  "compatibility proof"
];

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

function auditRuntimeUsage(options = {}) {
  const cwd = options.cwd || process.cwd();
  const manifestPath = options.manifestPath || options.manifest || DEFAULT_MANIFEST_PATH;
  const cliPath = options.cliPath || path.join(cwd, "src", "cli.js");
  const result = baseAuditResult(manifestPath, options);
  const snapshots = captureSnapshots(cwd, options.snapshotPaths || STATE_SNAPSHOT_PATHS);

  verifyUsageDocumentation(cwd, options, result);
  verifyRuntimeDiscoverability(cwd, options, result);
  verifyMissingManifestPath(cwd, cliPath, options, result);
  verifyDocumentedRuntimePath(cwd, manifestPath, cliPath, result);
  verifyStateSnapshots(cwd, snapshots, result);
  verifyAuditBoundary(result);

  return finalizeAudit(result);
}

function baseAuditResult(manifestPath, options) {
  return {
    schema: RUNTIME_AUDIT_SCHEMA,
    valid: false,
    runtimeUsable: false,
    theorem: RUNTIME_USAGE_THEOREM,
    hardLaw: RUNTIME_USAGE_HARD_LAW,
    command: RUNTIME_AUDIT_COMMAND,
    runtimeVerifyCommand: RUNTIME_VERIFY_COMMAND,
    manifestPath,
    docsPath: options.docPaths || USAGE_DOC_PATHS,
    runtimeVerifyDiscoverable: false,
    runtimeAuditDiscoverable: false,
    runtimeVerificationBounded: false,
    missingManifestFailureClear: false,
    missingManifestFailureActionable: false,
    validManifestSuccessClear: false,
    validManifestSuccessBounded: false,
    docsExplainRuntimeVerification: false,
    docsExplainRuntimeBoundary: false,
    mutation: {
      eventLogUnchanged: true,
      projectedStateUnchanged: true,
      exportStateUnchanged: true,
      snapshotPaths: []
    },
    trusted: false,
    protocolAuthority: false,
    governanceApproval: false,
    amendmentApproval: false,
    compatibilityProof: false,
    proves: [
      "runtime verification has a documented, discoverable, executable path for a fresh user"
    ],
    doesNotProve: [
      ...DOES_NOT_PROVE,
      "release trust",
      "fresh-user expertise",
      "general product usability"
    ],
    documents: [],
    checks: [],
    warnings: [],
    violations: []
  };
}

function verifyUsageDocumentation(cwd, options, result) {
  const docPaths = options.docPaths || USAGE_DOC_PATHS;
  const documents = docPaths.map((docPath) => {
    const text = safeReadText(path.join(cwd, docPath));
    return {
      path: docPath,
      present: text !== null,
      text: text || ""
    };
  });
  result.documents = documents.map((document) => ({
    path: document.path,
    present: document.present,
    mentionsRuntimeVerify: contains(document.text, "runtime verify"),
    mentionsRuntimeAudit: contains(document.text, "runtime audit"),
    mentionsRuntimeBoundary: REQUIRED_BOUNDARY_TERMS.every((term) => contains(document.text, term))
  }));

  for (const document of documents) {
    addAuditCheck(result, `doc_present_${checkId(document.path)}`, document.present, `${document.path} exists`);
  }

  const readme = documentText(documents, "README.md");
  const quickstart = documentText(documents, "docs/quickstart.md");
  const protocolDocs = [
    documentText(documents, "docs/protocol/v0/milestone-26.md"),
    documentText(documents, "docs/protocol/v0/milestone-26.1.md")
  ].join("\n");
  const aggregate = documents.map((document) => document.text).join("\n");

  addAuditCheck(
    result,
    "readme_documents_runtime_path",
    contains(readme, "release manifest --out .clista/release-manifest.json")
      && contains(readme, "runtime verify --manifest .clista/release-manifest.json"),
    "README documents the release-manifest-to-runtime-verify path"
  );
  addAuditCheck(
    result,
    "quickstart_documents_runtime_path",
    orderedTerms(quickstart, [
      "release verify",
      "release manifest --out .clista/release-manifest.json",
      "runtime verify --manifest .clista/release-manifest.json"
    ]),
    "quickstart orders release verification before runtime verification"
  );
  addAuditCheck(
    result,
    "protocol_docs_define_usage_audit",
    contains(protocolDocs, RUNTIME_USAGE_THEOREM)
      && contains(protocolDocs, RUNTIME_USAGE_HARD_LAW)
      && contains(protocolDocs, RUNTIME_AUDIT_COMMAND),
    "protocol docs define M26.1 runtime usage audit"
  );

  result.docsExplainRuntimeVerification = contains(aggregate, "existing release manifest")
    && contains(aggregate, "compares")
    && contains(aggregate, "runtimeverified");
  result.docsExplainRuntimeBoundary = REQUIRED_BOUNDARY_TERMS.every((term) => contains(aggregate, term))
    && contains(aggregate, "does not");

  addAuditCheck(
    result,
    "docs_explain_runtime_verification",
    result.docsExplainRuntimeVerification,
    "docs explain what runtime verification checks"
  );
  addAuditCheck(
    result,
    "docs_explain_runtime_boundary",
    result.docsExplainRuntimeBoundary,
    "docs explain what runtime verification does not prove"
  );
}

function verifyRuntimeDiscoverability(cwd, options, result) {
  const usageText = options.usageText || safeReadText(path.join(cwd, "src", "cli.js")) || "";
  result.runtimeVerifyDiscoverable = contains(usageText, "clista runtime verify [--manifest <path>]")
    || contains(usageText, "clista runtime verify --manifest .clista/release-manifest.json");
  result.runtimeAuditDiscoverable = contains(usageText, "clista runtime audit [--manifest <path>]")
    || contains(usageText, "clista runtime audit --manifest .clista/release-manifest.json");
  result.runtimeVerificationBounded = contains(usageText, "running is not verified")
    && contains(usageText, "verified runtime is not usable runtime")
    && !contains(usageText, "clista runtime show");

  addAuditCheck(
    result,
    "runtime_verify_discoverable",
    result.runtimeVerifyDiscoverable,
    "CLI help exposes runtime verify"
  );
  addAuditCheck(
    result,
    "runtime_audit_discoverable",
    result.runtimeAuditDiscoverable,
    "CLI help exposes runtime audit"
  );
  addAuditCheck(
    result,
    "runtime_verification_bounded_in_help",
    result.runtimeVerificationBounded,
    "CLI help bounds runtime verification and runtime usage audit"
  );
}

function verifyMissingManifestPath(cwd, cliPath, options, result) {
  const missingManifestPath = options.missingManifestPath || ".clista/runtime-audit-missing-manifest.json";
  const missing = verifyRuntime({ cwd, manifestPath: missingManifestPath, cliPath });
  const hasMissingViolation = hasFinding(missing.violations, "release_manifest_missing");
  const missingReason = firstFindingReason(missing.violations, "release_manifest_missing");

  result.missingManifest = {
    manifestPath: missingManifestPath,
    clear: missing.valid === false && hasMissingViolation && contains(missingReason, "release manifest missing"),
    actionable: false,
    actionableCommand: "clista release manifest --out .clista/release-manifest.json",
    runtimeResult: summarizeRuntimeResult(missing)
  };
  result.missingManifest.actionable = result.missingManifest.clear
    && contains(result.missingManifest.actionableCommand, "release manifest --out");
  result.missingManifestFailureClear = result.missingManifest.clear;
  result.missingManifestFailureActionable = result.missingManifest.actionable;

  addAuditCheck(
    result,
    "missing_manifest_failure_clear",
    result.missingManifestFailureClear,
    "runtime verify reports release_manifest_missing with the missing path"
  );
  addAuditCheck(
    result,
    "missing_manifest_failure_actionable",
    result.missingManifestFailureActionable,
    "runtime audit names the next command for creating a local manifest"
  );
}

function verifyDocumentedRuntimePath(cwd, manifestPath, cliPath, result) {
  const runtime = verifyRuntime({ cwd, manifestPath, cliPath });
  const boundaryFieldsFalse = runtimeBoundaryFieldsFalse(runtime);
  result.runtimeVerification = {
    manifestPath,
    clear: runtime.valid === true
      && runtime.runtimeVerified === true
      && runtime.schema === RUNTIME_VERIFY_SCHEMA,
    bounded: runtime.valid === true
      && boundaryFieldsFalse
      && REQUIRED_BOUNDARY_TERMS.every((term) => runtime.doesNotProve.includes(term)),
    runtimeResult: summarizeRuntimeResult(runtime)
  };
  result.validManifestSuccessClear = result.runtimeVerification.clear;
  result.validManifestSuccessBounded = result.runtimeVerification.bounded;

  addAuditCheck(
    result,
    "valid_manifest_success_clear",
    result.validManifestSuccessClear,
    "runtime verify returns valid true and runtimeVerified true for the documented manifest path",
    { violationTypes: runtime.violations.map((violation) => violation.violationType) }
  );
  addAuditCheck(
    result,
    "valid_manifest_success_bounded",
    result.validManifestSuccessBounded,
    "runtime verify success keeps trust and authority boundary fields false"
  );
}

function verifyStateSnapshots(cwd, snapshots, result) {
  const current = captureSnapshots(cwd, snapshots.map((snapshot) => snapshot.path));
  const byPath = new Map(current.map((snapshot) => [snapshot.path, snapshot]));
  const mutationRecords = snapshots.map((snapshot) => {
    const after = byPath.get(snapshot.path);
    return {
      path: snapshot.path,
      existedBefore: snapshot.exists,
      existsAfter: after?.exists || false,
      unchanged: snapshot.exists === Boolean(after?.exists) && snapshot.hash === (after?.hash || null)
    };
  });
  result.mutation.snapshotPaths = mutationRecords;
  result.mutation.eventLogUnchanged = mutationRecords
    .filter((record) => record.path === ".clista/events.ndjson")
    .every((record) => record.unchanged);
  result.mutation.projectedStateUnchanged = mutationRecords
    .filter((record) => record.path.includes("projected-state"))
    .every((record) => record.unchanged);
  result.mutation.exportStateUnchanged = mutationRecords
    .filter((record) => record.path.includes("export") || record.path.includes("continuity"))
    .every((record) => record.unchanged);

  addAuditCheck(
    result,
    "event_log_not_mutated",
    result.mutation.eventLogUnchanged,
    "runtime usage audit does not mutate .clista/events.ndjson"
  );
  addAuditCheck(
    result,
    "projected_state_not_mutated",
    result.mutation.projectedStateUnchanged,
    "runtime usage audit does not mutate projected state artifacts"
  );
  addAuditCheck(
    result,
    "export_state_not_mutated",
    result.mutation.exportStateUnchanged,
    "runtime usage audit does not mutate export state artifacts"
  );
}

function verifyAuditBoundary(result) {
  for (const field of RUNTIME_GUARD_FIELDS) {
    addAuditCheck(
      result,
      `${field}_not_created`,
      result[field] === false,
      `runtime usage audit does not create ${field}`
    );
  }
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

function finalizeAudit(result) {
  const valid = result.violations.length === 0;
  result.valid = valid;
  result.runtimeUsable = valid;
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

function addAuditCheck(result, id, valid, reason, extra = {}) {
  const check = {
    id,
    valid: Boolean(valid),
    reason,
    ...extra
  };
  result.checks.push(check);
  if (!check.valid) {
    addFinding(result, "violations", id, reason, extra);
  }
  return check;
}

function captureSnapshots(cwd, snapshotPaths) {
  return snapshotPaths.map((snapshotPath) => {
    const absolutePath = path.resolve(cwd, snapshotPath);
    if (!fs.existsSync(absolutePath)) {
      return {
        path: snapshotPath,
        exists: false,
        hash: null
      };
    }
    return {
      path: snapshotPath,
      exists: true,
      hash: safeFileHash(absolutePath)
    };
  });
}

function summarizeRuntimeResult(result) {
  return {
    schema: result.schema,
    valid: result.valid,
    runtimeVerified: result.runtimeVerified,
    releaseManifestVerified: result.releaseManifestVerified,
    manifestPath: result.manifestPath,
    packageVersion: result.packageVersion,
    manifestPackageVersion: result.manifestPackageVersion,
    gitCommit: result.gitCommit,
    manifestGitCommit: result.manifestGitCommit,
    gitTag: result.gitTag,
    manifestGitTag: result.manifestGitTag,
    sourceHashesMatch: result.sourceHashesMatch,
    schemaHashesMatch: result.schemaHashesMatch,
    verifierCommandsAvailable: result.verifierCommandsAvailable,
    verifierResultsReproduced: result.verifierResultsReproduced,
    workingTreeClean: result.workingTreeClean,
    trusted: result.trusted,
    protocolAuthority: result.protocolAuthority,
    governanceApproval: result.governanceApproval,
    amendmentApproval: result.amendmentApproval,
    compatibilityProof: result.compatibilityProof,
    proves: result.proves,
    doesNotProve: result.doesNotProve,
    drift: result.drift,
    warnings: result.warnings,
    violations: result.violations
  };
}

function runtimeBoundaryFieldsFalse(result) {
  return Array.from(RUNTIME_GUARD_FIELDS).every((field) => result[field] === false);
}

function documentText(documents, docPath) {
  return documents.find((document) => document.path === docPath)?.text || "";
}

function orderedTerms(text, terms) {
  const lowered = String(text || "").toLowerCase();
  let cursor = 0;
  for (const term of terms) {
    const index = lowered.indexOf(String(term).toLowerCase(), cursor);
    if (index === -1) {
      return false;
    }
    cursor = index + String(term).length;
  }
  return true;
}

function contains(text, term) {
  return String(text || "").toLowerCase().includes(String(term || "").toLowerCase());
}

function checkId(value) {
  return String(value || "unknown")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function hasFinding(findings, violationType) {
  return findings.some((finding) => finding.violationType === violationType);
}

function firstFindingReason(findings, violationType) {
  return findings.find((finding) => finding.violationType === violationType)?.reason || "";
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

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
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
  RUNTIME_AUDIT_SCHEMA,
  RUNTIME_AUDIT_COMMAND,
  RUNTIME_HARD_LAW,
  RUNTIME_THEOREM,
  RUNTIME_USAGE_HARD_LAW,
  RUNTIME_USAGE_THEOREM,
  RUNTIME_VERIFY_SCHEMA,
  auditRuntimeUsage,
  verifyRuntime
};
