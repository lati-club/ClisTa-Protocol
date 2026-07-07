const {
  auditRuntimeUsage,
  verifyRuntime
} = require("../runtime");
const {
  print,
  usage
} = require("./shared");

function runtimeVerify(options, cwd) {
  const result = verifyRuntime({
    cwd,
    manifestPath: options.manifest || options.file,
    cliPath: __filename
  });
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function runtimeAudit(options, cwd) {
  const result = auditRuntimeUsage({
    cwd,
    manifestPath: options.manifest || options.file,
    cliPath: __filename,
    usageText: usage()
  });
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

module.exports = {
  runtimeAudit,
  runtimeVerify
};
