const {
  buildReleaseManifest,
  readReleaseManifest,
  verifyReleaseManifest,
  writeReleaseManifest
} = require("../release");
const { print } = require("./shared");

function releaseManifest(options, cwd) {
  const manifest = buildReleaseManifest(cwd, {
    tag: options.tag || options.gitTag,
    gitCommit: options.commit || options.gitCommit,
    releaseId: options.release || options.releaseId || options.id,
    previousReleaseRef: options.previous || options.previousReleaseRef,
    packageArtifact: options.packageArtifact,
    createdAt: options.createdAt,
    cliEntrypoint: options.cli || options.cliEntrypoint
  });
  if (options.out) {
    const manifestPath = writeReleaseManifest(manifest, options.out, cwd);
    return print({
      schema: "clista.release.manifest.write.v0",
      written: true,
      manifestPath,
      manifestHash: manifest.manifest_hash,
      manifest
    });
  }
  return print(manifest);
}

function releaseVerify(options, cwd) {
  const manifest = options.manifest || options.file
    ? readReleaseManifest(options.manifest || options.file, cwd)
    : buildReleaseManifest(cwd, {
        tag: options.tag || options.gitTag,
        gitCommit: options.commit || options.gitCommit,
        releaseId: options.release || options.releaseId || options.id,
        previousReleaseRef: options.previous || options.previousReleaseRef,
        packageArtifact: options.packageArtifact,
        createdAt: options.createdAt,
        cliEntrypoint: options.cli || options.cliEntrypoint
      });
  const result = verifyReleaseManifest(manifest, { cwd });
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function releaseShow(options, cwd) {
  const manifest = options.manifest || options.file
    ? readReleaseManifest(options.manifest || options.file, cwd)
    : buildReleaseManifest(cwd, {
        tag: options.tag || options.gitTag,
        gitCommit: options.commit || options.gitCommit,
        releaseId: options.release || options.releaseId || options.id,
        previousReleaseRef: options.previous || options.previousReleaseRef,
        packageArtifact: options.packageArtifact,
        createdAt: options.createdAt,
        cliEntrypoint: options.cli || options.cliEntrypoint,
        runVerifiers: false
      });
  return print({
    schema: "clista.release.show.v0",
    theorem: manifest.theorem,
    hardLaw: manifest.hard_law,
    releaseId: manifest.release_id,
    packageName: manifest.package_name,
    packageVersion: manifest.package_version,
    gitCommit: manifest.git_commit,
    gitTag: manifest.git_tag,
    cliEntrypoint: manifest.cli_entrypoint,
    manifestHash: manifest.manifest_hash,
    releaseExists: manifest.release_exists,
    releaseVerified: manifest.release_verified,
    trusted: false,
    manifest
  });
}

module.exports = {
  releaseManifest,
  releaseShow,
  releaseVerify
};
