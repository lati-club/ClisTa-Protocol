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

function usage() {
  return `Usage:
  # First commands from a local checkout
  npm run clista -- validate
  npm run clista -- state show
  npm run clista -- export
  npm run clista -- continuity verify --packet continuity.json
  npm run clista -- release verify
  npm run clista -- runtime verify --manifest .clista/release-manifest.json
  npm run clista -- runtime audit --manifest .clista/release-manifest.json

  # Installed binary command list
  clista init
  clista thread create --title <title> --question <question>
  clista participant declare --name <name> [--id <participantId>] [--thread <threadId>]
  clista participant role assign --participant <name|id> --role <role> [--scope global|thread] [--thread <threadId>]
  clista participant authority grant --participant <name|id> --authority <authority> [--scope global|thread] [--thread <threadId>]
  clista participant authority revoke --participant <name|id> --authority <authority> [--scope global|thread] [--thread <threadId>]
  clista identity show --participant <name|id> [--events <path>]
  clista attribution list [--thread <threadId>] [--events <path>]
  clista attribution show <contributionId> [--events <path>]
  clista attribution by-participant <participantId> [--events <path>]
  clista attribution verify [--events <path>]
  clista provenance list [--thread <threadId>] [--events <path>]
  clista provenance show <contributionId> [--events <path>]
  clista provenance trace <contributionId> [--events <path>]
  clista provenance verify [--events <path>]
  clista learning review [--thread <threadId>] [--events <path>]
  clista learning list [--thread <threadId>] [--events <path>]
  clista learning show <learningId> [--events <path>]
  clista learning verify [--events <path>]
  clista adaptation review [--thread <threadId>] [--events <path>]
  clista adaptation list [--thread <threadId>] [--events <path>]
  clista adaptation show <adaptationId> [--events <path>]
  clista adaptation verify [--events <path>]
  clista amendment propose --thread <threadId> --title <title> --type <type> --target <target> --rationale <text> --change <text>
  clista amendment list [--thread <threadId>] [--status <status>] [--events <path>]
  clista amendment show <amendmentId> [--events <path>]
  clista amendment verify [--events <path>]
  clista thread fork --parent <threadId> --fork <forkThreadId> --title <title> --reason <reason> --through <eventId>
  clista evidence commit --thread <threadId> --source <source> --finding <finding>
  clista assumption declare --thread <threadId> --text <assumption>
  clista assumptions list [--thread <threadId>] [--events <path>]
  clista claim create --thread <threadId> --text <claim> --evidence <evidenceIds>
  clista position take --thread <threadId> --participant <name|id> --stance <support|oppose|conditional|neutral|abstain>
  clista objection raise --thread <threadId> --participant <name|id> --target <objectId> --text <objection>
  clista decision open --thread <threadId> --proposal <proposal>
  clista decision eligibility --request <decisionRequestId> [--events <path>]
  clista attestation record --thread <threadId> --attester <name|id> --text <text> [--source <url>] [--request <decisionRequestId>] [--status <status>] [--conditions <list>] [--role <role>] [--kind human|agent|tool|system]
  clista review submit --thread <threadId> --request <requestId> --reviewer <name|id> --status <status>
  # M23 protocol review commands (review routes state changes; review is not approval)
  clista review require --thread <threadId> --subject <objectId> [--subject-type <type>] --trigger <triggerType> --reason <reason> [--required-reviewer-role <role>]
  clista review open (--review <reviewId> | --thread <threadId> --subject <objectId> [--subject-type <type>]) [--reason <reason>]
  clista review complete --review <reviewId> --summary <summary> [--reviewer <name|id>]
  clista review dispute --review <reviewId> --reason <reason>
  clista review violation --review <reviewId> --type <violationType> --reason <reason>
  clista review list [--thread <threadId>] [--status <required|open|reviewed|disputed|violated>] [--events <path>]
  clista review show <reviewId> [--events <path>]
  clista review verify [--events <path>]
  # M24 protocol recovery commands (recovery restores trusted projection; recovery is not history rewrite)
  clista recovery request --thread <threadId> --subject <subjectId> [--subject-type <type>] --reason <reason> [--checkpoint <checkpointId>] [--checkpoint-type <type>] [--event-log-hash <hash>] [--projection-hash <hash>] [--state-hash <hash>]
  clista recovery plan --recovery <recoveryId> --plan <plan> [--review <reviewId>]
  clista recovery quarantine --recovery <recoveryId> --reason <reason> [--emergency true] [--review <reviewId>]
  clista recovery apply --recovery <recoveryId> --summary <summary> [--review <reviewId>] [--evidence <evidence>]
  clista recovery verify [--recovery <recoveryId>] [--events <path>]
  clista recovery violation --recovery <recoveryId> --type <violationType> --reason <reason>
  clista recovery list [--thread <threadId>] [--status <status>] [--events <path>]
  clista recovery show <recoveryId> [--events <path>]
  # M25 protocol release commands (release packages verified runtime; release is not trust)
  clista release manifest [--tag <tag>] [--out <path>]
  clista release verify [--manifest <path>] [--tag <tag>]
  clista release show [--manifest <path>]
  # M26 protocol runtime commands (runtime verifies local execution; running is not verified)
  clista runtime verify [--manifest <path>]
  # M26.1 runtime usage command (runtime audit verifies usability; verified runtime is not usable runtime)
  clista runtime audit [--manifest <path>]
  clista decision merge --thread <threadId> --request <requestId> --decider <name|id>
  # M3 decision outcome commands
  clista outcome expect --thread <threadId> --decision <decisionRecordId> --metric <metric> --operator <operator> --target <target> --review-date <YYYY-MM-DD>
  clista outcome audit --thread <threadId> --expected <expectedOutcomeId> --actual <actual> --result <result> --summary <summary> --auditor <name|id>
  clista decision score --thread <threadId> --decision <decisionRecordId> --score <score> --status <status> --rationale <text> --audits <outcomeAuditIds>
  # M21 protocol outcome commands
  clista outcome expect --execution <executionId> --expected-effect <effect>
  clista outcome observe --outcome <outcomeId> --observed-effect <effect> --evidence <evidence>
  clista outcome evaluate --outcome <outcomeId> --result <success|partial_success|failure|inconclusive> --comparison <comparison> --evidence <evidence>
  clista outcome dispute --outcome <outcomeId> --reason <reason>
  clista outcome list [--thread <threadId>] [--status <status>] [--events <path>]
  clista outcome show <outcomeId> [--events <path>]
  clista outcome verify [--events <path>]
  clista outcome-learning derive --outcome <outcomeId> --lesson <lesson> [--evidence <evidence>] [--confidence <low|medium|high>]
  clista outcome-learning lesson --signal <learningSignalId> --lesson <lesson> [--evidence <evidence>]
  clista outcome-learning dispute --learning <learningId> --reason <reason>
  clista outcome-learning violation --learning <learningId> --type <violationType> --reason <reason>
  clista outcome-learning list [--thread <threadId>] [--events <path>]
  clista outcome-learning show <learningId> [--events <path>]
  clista outcome-learning verify [--events <path>]
  clista merge open --source <forkThreadId> --target <threadId> --summary <summary>
  clista merge review --request <mergeRequestId> --status <approve|request_changes|reject> --summary <summary>
  clista merge conflict declare --request <mergeRequestId> --type <assumption|claim|evidence|objection|decision|outcome> --parent <objectId> --fork <objectId> --summary <summary>
  clista merge conflict resolve --request <mergeRequestId> --conflict <conflictId> --resolution <accept_parent|accept_fork|preserve_both|supersede|reject_fork> --rationale <rationale>
  clista merge eligibility --request <mergeRequestId> [--events <path>]
  clista merge complete --request <mergeRequestId>
  clista validate [--events <path>] [--strict]
  clista verify-cross-thread --parent <path> --arm <path> [--arm <path>...]
  clista integrity verify [--events <path>] [--strict]
  clista integrity verify-suffix --anchor <headHash> [--events <suffix path>]
  clista continuity export [--events <path>] [--thread <threadId>] [--out <path>]
  clista continuity verify [--packet <path>]
  clista continuity import <path> [--replace true]
  clista continuity resume [--packet <path>]
  clista continuity show [--packet <path>]
  clista continuity summary [--packet <path>]
  clista compatibility check [--packet <path>] [--support-amendment <amendmentId>]
  clista compatibility show [--packet <path>]
  clista compatibility verify [--packet <path>]
  clista interoperability check [--packet <path>]
  clista interoperability show [--packet <path>]
  clista interoperability verify [--packet <path>]
  clista federation record --thread <threadId> --packet <path> [--peer <peerId>] [--context <contextId>]
  clista federation check [--packet <path>]
  clista federation list [--thread <threadId>] [--status <status>]
  clista federation show <federationId>
  clista federation verify [--events <path>]
  clista negotiation propose --thread <threadId> --packet <path>
  clista negotiation check [--packet <path>]
  clista negotiation list [--thread <threadId>] [--status <status>]
  clista negotiation show <negotiationId>
  clista negotiation verify [--events <path>]
  clista delegation grant --thread <threadId> --delegate <name|id> --action <action> --scope <scope> --limit <limit> [--delegate-type <participant|agent|tool|context>] [--delegate-kind <human|agent|tool|system>]
  clista delegation record --delegation <delegationId> --summary <summary>
  clista delegation list [--thread <threadId>] [--status <status>]
  clista delegation show <delegationId>
  clista delegation revoke --delegation <delegationId> --reason <reason>
  clista delegation verify [--events <path>]
  clista execution start (--delegation <delegationId> | --decision <decisionRecordId>) [--action <action>] [--scope <scope>] [--constraint <constraint>]
  clista execution complete --execution <executionId> --evidence <evidence>
  clista execution fail --execution <executionId> --reason <reason>
  clista execution rollback --execution <executionId> --reason <reason> --evidence <evidence>
  clista execution list [--thread <threadId>] [--status <status>]
  clista execution show <executionId>
  clista execution verify [--events <path>]
  clista state show [--thread <threadId>] [--events <path>]
  clista audit show [--thread <threadId>] [--events <path>]
  clista fork lineage --thread <forkThreadId> [--events <path>]
  clista export [--events <path>]
  clista import --events <path> [--replace true]
  # Report a completed log (optional). Primary verification is via the agent (validate, replay, decision summary).
  clista run report [--events <path>] [--thread <threadId>] [--title <decision title>] [--out <bundlePath>]`;
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
  usage,
  writeOut
};
