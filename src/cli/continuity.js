const fs = require("node:fs");
const path = require("node:path");
const {
  exportContinuityPacket,
  formatContinuityReasons,
  readContinuityPacketAt,
  resumeContinuityPacket,
  summarizeContinuityPacket,
  verifyContinuityPacket,
  writeContinuityPacket
} = require("../continuity");
const {
  booleanOption,
  print,
  readContinuityPacketForOptions,
  readEventsForOptions,
  requireOption
} = require("./shared");

function continuityExport(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const packet = exportContinuityPacket(events, { threadId: options.thread });
  if (options.out) {
    const outPath = path.resolve(cwd, options.out);
    fs.writeFileSync(outPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
    return print({
      schema: "clista.continuity.export.v0",
      packet: outPath,
      source_thread_id: packet.source_thread_id,
      event_log_hash: packet.event_log_hash,
      projection_hash: packet.projection_hash,
      state_hash: packet.state_hash,
      verification_mode: packet.verification_mode,
      resume_status: packet.resume_status
    });
  }
  return print(packet);
}

function continuityVerify(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = verifyContinuityPacket(packet);
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function continuityImport(options, cwd) {
  requireOption(options, "packet");
  const sourcePath = path.resolve(cwd, options.packet);
  const packet = readContinuityPacketAt(sourcePath);
  const verification = verifyContinuityPacket(packet);
  if (!verification.valid) {
    throw new Error(formatContinuityReasons(verification.reasons));
  }
  const importedPath = writeContinuityPacket(packet, cwd, {
    replace: booleanOption(options.replace, false)
  });
  return print({
    schema: "clista.continuity.import.v0",
    imported: true,
    source: sourcePath,
    packet: importedPath,
    source_thread_id: packet.source_thread_id,
    event_log_hash: packet.event_log_hash,
    projection_hash: packet.projection_hash,
    state_hash: packet.state_hash,
    verification_mode: packet.verification_mode,
    resume_status: packet.resume_status,
    verification_state: packet.verification_state
  });
}

function continuityResume(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = resumeContinuityPacket(packet);
  print(result);
  if (!result.resumed) {
    process.exitCode = 1;
  }
}

function continuityShow(options, cwd) {
  return continuitySummary(options, cwd);
}

function continuitySummary(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const summary = summarizeContinuityPacket(packet);
  print(summary);
  if (!summary.valid) {
    process.exitCode = 1;
  }
}

module.exports = {
  continuityExport,
  continuityImport,
  continuityResume,
  continuityShow,
  continuitySummary,
  continuityVerify
};
