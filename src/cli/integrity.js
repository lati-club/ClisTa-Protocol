const {
  verifyEventIntegrity,
  verifyEventSuffix
} = require("../integrity");
const { validateEvents } = require("../validator");
const {
  booleanOption,
  fail,
  print,
  readEventsForOptions,
  requireOption
} = require("./shared");

function integrityVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = verifyEventIntegrity(events, { strict: booleanOption(options.strict, false) });
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function integrityVerifySuffix(options, cwd) {
  requireOption(options, "anchor");
  const events = readEventsForOptions(options, cwd);
  const result = verifyEventSuffix(options.anchor, events);
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function validateCommand(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  // Plain `validate` checks protocol structure and (lax) any hashes present, but
  // does not assert tamper-evidence: an unsigned log passes. `--strict` adds a
  // fail-closed integrity pass that requires a complete, intact hash chain
  // (content_hash + previous_hash on every event), so it can be used as the
  // gate for logs that claim to be chained.
  if (booleanOption(options.strict, false)) {
    const integrity = verifyEventIntegrity(events, { strict: true });
    result.integrity = integrity;
    if (!integrity.valid) {
      result.valid = false;
      result.errors = [
        ...result.errors,
        ...integrity.reasons.map((reason) => ({
          event_id: reason.event_id,
          reason: reason.reason
        }))
      ];
    }
  }
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

module.exports = {
  integrityVerify,
  integrityVerifySuffix,
  validateCommand
};
