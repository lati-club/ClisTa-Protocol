const {
  summarizeProtocolCompatibility,
  verifyProtocolCompatibility
} = require("../compatibility");
const { verifyContinuityPacket } = require("../continuity");
const {
  summarizeProtocolInteroperability,
  verifyProtocolInteroperability
} = require("../interoperability");
const {
  compatibilityOptionsFromCli,
  interoperabilityOptionsFromCli,
  print,
  readContinuityPacketForOptions
} = require("./shared");

function compatibilityCheck(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const continuityVerification = verifyContinuityPacket(packet);
  const result = verifyProtocolCompatibility(packet, compatibilityOptionsFromCli(options, continuityVerification));
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function compatibilityShow(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const continuityVerification = verifyContinuityPacket(packet);
  const result = verifyProtocolCompatibility(packet, compatibilityOptionsFromCli(options, continuityVerification));
  const summary = summarizeProtocolCompatibility(result);
  print(summary);
  if (!summary.valid) {
    process.exitCode = 1;
  }
}

function compatibilityVerify(options, cwd) {
  return compatibilityCheck(options, cwd);
}

function interoperabilityCheck(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const compatibilityResult = compatibilityResultFromCli(packet, options);
  const result = verifyProtocolInteroperability(packet, interoperabilityOptionsFromCli(options, compatibilityResult));
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function interoperabilityShow(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const compatibilityResult = compatibilityResultFromCli(packet, options);
  const result = verifyProtocolInteroperability(packet, interoperabilityOptionsFromCli(options, compatibilityResult));
  const summary = summarizeProtocolInteroperability(result);
  print(summary);
  if (!summary.valid) {
    process.exitCode = 1;
  }
}

function interoperabilityVerify(options, cwd) {
  return interoperabilityCheck(options, cwd);
}

function compatibilityResultFromCli(packet, options) {
  const continuityVerification = verifyContinuityPacket(packet);
  return verifyProtocolCompatibility(packet, compatibilityOptionsFromCli(options, continuityVerification));
}

module.exports = {
  compatibilityCheck,
  compatibilityShow,
  compatibilityVerify,
  interoperabilityCheck,
  interoperabilityShow,
  interoperabilityVerify
};
