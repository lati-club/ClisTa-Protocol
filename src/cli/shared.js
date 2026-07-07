const path = require("node:path");
const {
  appendEvent,
  createEvent,
  createParticipant,
  nowIso,
  readEvents,
  readEventsAt,
  parseList
} = require("../events");
const { projectEvents } = require("../projector");
const { assertValidEvents } = require("../validator");
const {
  continuityPacketPath,
  exportContinuityPacket,
  readContinuityPacketAt
} = require("../continuity");
const fs = require("node:fs");

// OUT is the single sink for stdout-bound output produced by command handlers.
// Default: write straight through to the real process stdout, so the CLI's
// behavior is byte-identical to before the seam was introduced. runCaptured()
// swaps it for a buffering sink so an in-process caller (e.g. the MCP server)
// can dispatch CLI verbs through main() without colliding with JSON-RPC frames
// that share the same stdout. Tests assert real stdout is never touched while a
// capture sink is installed.
const REAL_STDOUT = { write: (chunk) => process.stdout.write(chunk) };
let OUT = REAL_STDOUT;

function setOut(sink) {
  const previous = OUT;
  OUT = sink || REAL_STDOUT;
  return previous;
}

function print(value) {
  OUT.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

// Required options that are legitimately repeatable (consumed via parseList).
// requireOption is the only scalar gate they pass through, so they must be
// exempt from the "given once" arity check. Every other required option is a
// scalar — a repeated flag is a user error, not a list.
const REPEATABLE_REQUIRED_OPTIONS = new Set([
  "evidence", "evidences",
  "participant", "participants",
  "audits", "learning", "learnings", "limit", "limits"
]);

function optionFlag(key) {
  return `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function requireOption(options, key) {
  const value = options[key];
  // Presence by identity, not truthiness: a legitimately falsy value
  // (e.g. "0", "false") is present, not missing.
  if (value === undefined) {
    throw new Error(`Missing required option ${optionFlag(key)}`);
  }
  // A repeated flag arrives as an array (see parseOptions). For a scalar option
  // that silently broke downstream string comparisons; fail loudly instead.
  if (Array.isArray(value) && !REPEATABLE_REQUIRED_OPTIONS.has(key)) {
    throw new Error(`Option ${optionFlag(key)} may only be given once`);
  }
}

function numberOption(value) {
  if (Array.isArray(value)) {
    throw new Error("Option may only be given once (got multiple values)");
  }
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const number = Number(value);
  if (Number.isNaN(number)) {
    throw new Error(`Expected number, got ${value}`);
  }
  return number;
}

function scalarOption(value) {
  if (Array.isArray(value)) {
    throw new Error("Option may only be given once (got multiple values)");
  }
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const text = String(value).trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }
  return value;
}

function booleanOption(value, defaultValue) {
  if (Array.isArray(value)) {
    throw new Error("Option may only be given once (got multiple values)");
  }
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  if (value === true || value === false) {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  throw new Error(`Expected boolean, got ${value}`);
}

function participantFrom(value, role, kind = "human") {
  const participant = createParticipant(value, role, kind);
  participant.name = String(value || participant.name).startsWith("par_") ? participant.name : String(value || participant.name);
  participant.kind = kind;
  return participant;
}

function appendParticipant(participant, cwd, threadId) {
  const existing = projectEvents(readEvents(cwd)).participants[participant.id];
  if (existing) {
    return;
  }
  appendEvent(createEvent({
    type: "ParticipantAdded",
    threadId,
    actorId: participant.id,
    at: nowIso(),
    payload: { participant }
  }), cwd);
}

function readEventsForOptions(options, cwd) {
  if (options.events) {
    return readEventsAt(path.resolve(cwd, options.events));
  }
  return readEvents(cwd);
}

function readValidEventsForOptions(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  assertValidEvents(events);
  return events;
}

function inferTargetType(id) {
  if (!id) {
    return undefined;
  }
  if (id.startsWith("clm_")) {
    return "claim";
  }
  if (id.startsWith("asm_")) {
    return "assumption";
  }
  if (id.startsWith("drq_")) {
    return "decisionRequest";
  }
  if (id.startsWith("pos_")) {
    return "position";
  }
  if (id.startsWith("evd_")) {
    return "evidence";
  }
  return "thread";
}

function readContinuityPacketForOptions(options, cwd) {
  if (options.packet) {
    return readContinuityPacketAt(path.resolve(cwd, options.packet));
  }
  const packetPath = continuityPacketPath(cwd);
  if (fs.existsSync(packetPath)) {
    return readContinuityPacketAt(packetPath);
  }
  return exportContinuityPacket(readEventsForOptions(options, cwd), { threadId: options.thread });
}

function compatibilityOptionsFromCli(options, continuityVerification) {
  const result = { continuityVerification };
  const supportedAmendmentIds = parseList(options.supportAmendment || options.supportedAmendment || options.supportedAmendments);
  const supportedCapabilities = parseList(options.supportCapability || options.supportedCapability || options.supportedCapabilities);
  const supportedVerificationLayers = parseList(options.supportLayer || options.supportedLayer || options.supportedVerificationLayers);
  if (supportedAmendmentIds.length) {
    result.supportedAmendmentIds = supportedAmendmentIds;
  }
  if (supportedCapabilities.length) {
    result.supportedCapabilities = supportedCapabilities;
  }
  if (supportedVerificationLayers.length) {
    result.supportedVerificationLayers = supportedVerificationLayers;
  }
  return result;
}

function interoperabilityOptionsFromCli(options, compatibilityResult) {
  const result = { compatibilityResult };
  const supportedSemantics = parseList(options.supportSemantic || options.supportedSemantic || options.supportedSemantics);
  const supportedEventTypes = parseList(options.supportEventType || options.supportedEventType || options.supportedEventTypes);
  const supportedExchangeFormats = parseList(options.supportExchangeFormat || options.supportedExchangeFormat || options.supportedExchangeFormats);
  if (supportedSemantics.length) {
    result.supportedSemantics = supportedSemantics;
  }
  if (supportedEventTypes.length) {
    result.supportedEventTypes = supportedEventTypes;
  }
  if (supportedExchangeFormats.length) {
    result.supportedExchangeFormats = supportedExchangeFormats;
  }
  return result;
}

function federationOptionsFromCli(options, results) {
  return {
    ...results,
    sharedAuthority: booleanOption(options.sharedAuthority, false),
    remoteAuthorityImported: booleanOption(options.remoteAuthorityImported, false),
    automaticAuthorityImport: booleanOption(options.automaticAuthorityImport, false),
    localGovernanceMutation: booleanOption(options.localGovernanceMutation, false),
    remoteGovernanceMerged: booleanOption(options.remoteGovernanceMerged, false),
    automaticAmendmentImport: booleanOption(options.automaticAmendmentImport, false),
    remoteAmendmentsImported: booleanOption(options.remoteAmendmentsImported, false),
    automaticConsensus: booleanOption(options.automaticConsensus, false),
    remoteStateMutation: booleanOption(options.remoteStateMutation, false),
    networkConsensus: booleanOption(options.networkConsensus, false)
  };
}

// writeOut is the raw-text sibling of print() for callers that need to emit
// non-JSON output (usage text, formatted summaries) through the same OUT seam.
function writeOut(chunk) {
  OUT.write(chunk);
}

module.exports = {
  appendParticipant,
  booleanOption,
  compatibilityOptionsFromCli,
  fail,
  federationOptionsFromCli,
  inferTargetType,
  interoperabilityOptionsFromCli,
  numberOption,
  optionFlag,
  participantFrom,
  print,
  readContinuityPacketForOptions,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption,
  scalarOption,
  setOut,
  writeOut
};
