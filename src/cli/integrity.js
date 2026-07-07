const path = require("node:path");
const { readEventsAt } = require("../events");
const { verifyCrossThreadProvenance } = require("../provenance");
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

// Offline verification of cross-thread provenance: confirm that every
// CrossThreadEvidence item in a parent log anchors on the actual DecisionMerged
// event in the arm log it cites. The check itself lives in the (vendored) engine
// — verifyCrossThreadProvenance — so the CLI, the Worker, and tests run the same
// logic; this wrapper only does file IO, option parsing, and exit-code mapping.
function verifyCrossThreadCommand(options, cwd) {
  if (!options.parent) {
    throw new Error("verify-cross-thread requires --parent <path>");
  }
  if (!options.arm) {
    throw new Error("verify-cross-thread requires --arm <path> (repeatable)");
  }
  const armSpecs = Array.isArray(options.arm) ? options.arm : [options.arm];
  const parentEvents = readEventsAt(path.resolve(cwd, options.parent));
  const armEventLogs = armSpecs.map((spec) => readEventsAt(path.resolve(cwd, spec)));

  const { valid, summary, results } = verifyCrossThreadProvenance(parentEvents, armEventLogs);
  const report = { valid, parent: options.parent, arms: armSpecs, summary, results };
  if (summary.verified === 0) {
    report.note = "no cross-thread evidence in the parent referenced the provided arm log(s); check that --arm matches a thread the parent imports from";
  }
  print(report);
  if (!valid) {
    process.exitCode = 1;
  }
}

module.exports = {
  integrityVerify,
  integrityVerifySuffix,
  validateCommand,
  verifyCrossThreadCommand
};
