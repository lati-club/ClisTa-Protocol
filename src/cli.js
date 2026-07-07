#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const {
  initStore,
  readEventsAt
} = require("./events");
const { verifyCrossThreadProvenance } = require("./provenance");
const {
  appendParticipant,
  fail,
  print,
  setOut,
  usage,
  writeOut
} = require("./cli/shared");
const {
  outcomeAudit,
  outcomeDispute,
  outcomeEvaluate,
  outcomeExpect,
  outcomeLearningDerive,
  outcomeLearningDispute,
  outcomeLearningLesson,
  outcomeLearningList,
  outcomeLearningShow,
  outcomeLearningVerify,
  outcomeLearningViolation,
  outcomeList,
  outcomeObserve,
  outcomeShow,
  outcomeVerify
} = require("./cli/outcome");
const {
  reviewComplete,
  reviewDispute,
  reviewList,
  reviewOpen,
  reviewRequire,
  reviewShow,
  reviewSubmit,
  reviewVerify,
  reviewViolation
} = require("./cli/review");
const {
  recoveryApply,
  recoveryList,
  recoveryPlan,
  recoveryQuarantine,
  recoveryRequest,
  recoveryShow,
  recoveryVerify,
  recoveryViolation
} = require("./cli/recovery");
const {
  executionComplete,
  executionFail,
  executionList,
  executionRollback,
  executionShow,
  executionStart,
  executionVerify
} = require("./cli/execution");
const {
  delegationGrant,
  delegationList,
  delegationRecord,
  delegationRevoke,
  delegationShow,
  delegationVerify
} = require("./cli/delegation");
const {
  mergeComplete,
  mergeConflictDeclare,
  mergeConflictResolve,
  mergeEligibility,
  mergeOpen,
  mergeReview
} = require("./cli/merge");
const {
  continuityExport,
  continuityImport,
  continuityResume,
  continuityShow,
  continuitySummary,
  continuityVerify
} = require("./cli/continuity");
const {
  decisionEligibility,
  decisionMerge,
  decisionOpen,
  decisionPropose,
  decisionScore,
  decisionSummary
} = require("./cli/decision");
const {
  negotiationCheck,
  negotiationList,
  negotiationPropose,
  negotiationShow,
  negotiationVerify
} = require("./cli/negotiation");
const {
  federationCheck,
  federationList,
  federationRecord,
  federationShow,
  federationVerify
} = require("./cli/federation");
const {
  provenanceList,
  provenanceShow,
  provenanceTrace,
  provenanceVerify
} = require("./cli/provenance");
const {
  identityShow,
  participantAuthorityGrant,
  participantAuthorityRevoke,
  participantDeclare,
  participantRoleAssign
} = require("./cli/participant");
const {
  learningList,
  learningReview,
  learningShow,
  learningVerify
} = require("./cli/learning");
const {
  attributionByParticipant,
  attributionList,
  attributionShow,
  attributionVerify
} = require("./cli/attribution");
const {
  amendmentList,
  amendmentPropose,
  amendmentShow,
  amendmentVerify,
  pruneList,
  prunePropose
} = require("./cli/amendment");
const {
  adaptationList,
  adaptationReview,
  adaptationShow,
  adaptationVerify
} = require("./cli/adaptation");
const {
  releaseManifest,
  releaseShow,
  releaseVerify
} = require("./cli/release");
const {
  compatibilityCheck,
  compatibilityShow,
  compatibilityVerify,
  interoperabilityCheck,
  interoperabilityShow,
  interoperabilityVerify
} = require("./cli/compatibility");
const {
  forkLineage,
  threadCreate,
  threadFork
} = require("./cli/thread");
const {
  assumptionDeclare,
  assumptionsList,
  attestationRecord,
  claimCreate,
  evidenceCommit,
  evidenceList,
  objectionRaise,
  positionTake
} = require("./cli/contribution");
const {
  integrityVerify,
  integrityVerifySuffix,
  validateCommand
} = require("./cli/integrity");
const {
  auditShow,
  stateShow
} = require("./cli/state");
const {
  runtimeAudit,
  runtimeVerify
} = require("./cli/runtime");
const {
  exportShow,
  importCommand,
  runReport
} = require("./cli/transfer");

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  let { command, options } = parseCommand(argv);
  ({ command, options } = normalizeCommand(command, options));

  try {
    switch (command) {
      case "init":
        return print(initStore(cwd));
      case "thread create":
        return threadCreate(options, cwd);
      case "participant declare":
        return participantDeclare(options, cwd);
      case "participant role assign":
        return participantRoleAssign(options, cwd);
      case "participant authority grant":
        return participantAuthorityGrant(options, cwd);
      case "participant authority revoke":
        return participantAuthorityRevoke(options, cwd);
      case "identity show":
        return identityShow(options, cwd);
      case "attribution list":
        return attributionList(options, cwd);
      case "attribution show":
        return attributionShow(options, cwd);
      case "attribution by-participant":
        return attributionByParticipant(options, cwd);
      case "attribution verify":
        return attributionVerify(options, cwd);
      case "provenance list":
        return provenanceList(options, cwd);
      case "provenance show":
        return provenanceShow(options, cwd);
      case "provenance trace":
        return provenanceTrace(options, cwd);
      case "provenance verify":
        return provenanceVerify(options, cwd);
      case "learning review":
        return learningReview(options, cwd);
      case "learning list":
        return learningList(options, cwd);
      case "learning show":
        return learningShow(options, cwd);
      case "learning verify":
        return learningVerify(options, cwd);
      case "adaptation review":
        return adaptationReview(options, cwd);
      case "adaptation list":
        return adaptationList(options, cwd);
      case "adaptation show":
        return adaptationShow(options, cwd);
      case "adaptation verify":
        return adaptationVerify(options, cwd);
      case "amendment propose":
        return amendmentPropose(options, cwd);
      case "amendment list":
        return amendmentList(options, cwd);
      case "amendment show":
        return amendmentShow(options, cwd);
      case "amendment verify":
        return amendmentVerify(options, cwd);
      case "prune propose":
        return prunePropose(options, cwd);
      case "prune list":
        return pruneList(options, cwd);
      case "thread fork":
        return threadFork(options, cwd);
      case "evidence commit":
        return evidenceCommit(options, cwd);
      case "evidence list":
        return evidenceList(options, cwd);
      case "assumption declare":
        return assumptionDeclare(options, cwd);
      case "assumptions list":
        return assumptionsList(options, cwd);
      case "claim create":
        return claimCreate(options, cwd);
      case "position take":
        return positionTake(options, cwd);
      case "objection raise":
        return objectionRaise(options, cwd);
      case "decision open":
        return decisionOpen(options, cwd);
      case "decision propose":
        return decisionPropose(options, cwd);
      case "decision summary":
        return decisionSummary(options, cwd);
      case "decision eligibility":
        return decisionEligibility(options, cwd);
      case "attestation record":
        return attestationRecord(options, cwd);
      case "review submit":
        return reviewSubmit(options, cwd);
      case "review require":
        return reviewRequire(options, cwd);
      case "review open":
        return reviewOpen(options, cwd);
      case "review complete":
        return reviewComplete(options, cwd);
      case "review dispute":
        return reviewDispute(options, cwd);
      case "review violation":
        return reviewViolation(options, cwd);
      case "review list":
        return reviewList(options, cwd);
      case "review show":
        return reviewShow(options, cwd);
      case "review verify":
        return reviewVerify(options, cwd);
      case "recovery request":
        return recoveryRequest(options, cwd);
      case "recovery plan":
        return recoveryPlan(options, cwd);
      case "recovery quarantine":
        return recoveryQuarantine(options, cwd);
      case "recovery apply":
        return recoveryApply(options, cwd);
      case "recovery verify":
        return recoveryVerify(options, cwd);
      case "recovery violation":
        return recoveryViolation(options, cwd);
      case "recovery list":
        return recoveryList(options, cwd);
      case "recovery show":
        return recoveryShow(options, cwd);
      case "release manifest":
        return releaseManifest(options, cwd);
      case "release verify":
        return releaseVerify(options, cwd);
      case "release show":
        return releaseShow(options, cwd);
      case "runtime verify":
        return runtimeVerify(options, cwd);
      case "runtime audit":
        return runtimeAudit(options, cwd);
      case "decision merge":
        return decisionMerge(options, cwd);
      case "outcome expect":
        return outcomeExpect(options, cwd);
      case "outcome observe":
        return outcomeObserve(options, cwd);
      case "outcome evaluate":
        return outcomeEvaluate(options, cwd);
      case "outcome dispute":
        return outcomeDispute(options, cwd);
      case "outcome list":
        return outcomeList(options, cwd);
      case "outcome show":
        return outcomeShow(options, cwd);
      case "outcome verify":
        return outcomeVerify(options, cwd);
      case "outcome-learning derive":
        return outcomeLearningDerive(options, cwd);
      case "outcome-learning lesson":
        return outcomeLearningLesson(options, cwd);
      case "outcome-learning dispute":
        return outcomeLearningDispute(options, cwd);
      case "outcome-learning violation":
        return outcomeLearningViolation(options, cwd);
      case "outcome-learning list":
        return outcomeLearningList(options, cwd);
      case "outcome-learning show":
        return outcomeLearningShow(options, cwd);
      case "outcome-learning verify":
        return outcomeLearningVerify(options, cwd);
      case "outcome audit":
        return outcomeAudit(options, cwd);
      case "decision score":
        return decisionScore(options, cwd);
      case "validate":
        return validateCommand(options, cwd);
      case "verify-cross-thread":
        return verifyCrossThreadCommand(options, cwd);
      case "integrity verify":
        return integrityVerify(options, cwd);
      case "integrity verify-suffix":
        return integrityVerifySuffix(options, cwd);
      case "continuity export":
        return continuityExport(options, cwd);
      case "continuity verify":
        return continuityVerify(options, cwd);
      case "continuity import":
        return continuityImport(options, cwd);
      case "continuity resume":
        return continuityResume(options, cwd);
      case "continuity show":
        return continuityShow(options, cwd);
      case "continuity summary":
        return continuitySummary(options, cwd);
      case "compatibility check":
        return compatibilityCheck(options, cwd);
      case "compatibility show":
        return compatibilityShow(options, cwd);
      case "compatibility verify":
        return compatibilityVerify(options, cwd);
      case "interoperability check":
        return interoperabilityCheck(options, cwd);
      case "interoperability show":
        return interoperabilityShow(options, cwd);
      case "interoperability verify":
        return interoperabilityVerify(options, cwd);
      case "federation record":
        return federationRecord(options, cwd);
      case "federation check":
        return federationCheck(options, cwd);
      case "federation list":
        return federationList(options, cwd);
      case "federation show":
        return federationShow(options, cwd);
      case "federation verify":
        return federationVerify(options, cwd);
      case "negotiation propose":
        return negotiationPropose(options, cwd);
      case "negotiation check":
        return negotiationCheck(options, cwd);
      case "negotiation list":
        return negotiationList(options, cwd);
      case "negotiation show":
        return negotiationShow(options, cwd);
      case "negotiation verify":
        return negotiationVerify(options, cwd);
      case "delegation grant":
        return delegationGrant(options, cwd);
      case "delegation record":
        return delegationRecord(options, cwd);
      case "delegation list":
        return delegationList(options, cwd);
      case "delegation show":
        return delegationShow(options, cwd);
      case "delegation revoke":
        return delegationRevoke(options, cwd);
      case "delegation verify":
        return delegationVerify(options, cwd);
      case "execution start":
        return executionStart(options, cwd);
      case "execution complete":
        return executionComplete(options, cwd);
      case "execution fail":
        return executionFail(options, cwd);
      case "execution rollback":
        return executionRollback(options, cwd);
      case "execution list":
        return executionList(options, cwd);
      case "execution show":
        return executionShow(options, cwd);
      case "execution verify":
        return executionVerify(options, cwd);
      case "state show":
        return stateShow(options, cwd);
      case "audit show":
        return auditShow(options, cwd);
      case "fork lineage":
        return forkLineage(options, cwd);
      case "merge open":
        return mergeOpen(options, cwd);
      case "merge review":
        return mergeReview(options, cwd);
      case "merge conflict declare":
        return mergeConflictDeclare(options, cwd);
      case "merge conflict resolve":
        return mergeConflictResolve(options, cwd);
      case "merge eligibility":
        return mergeEligibility(options, cwd);
      case "merge complete":
        return mergeComplete(options, cwd);
      case "export":
        return exportShow(options, cwd);
      case "import":
        return importCommand(options, cwd);
      case "run report":
        return runReport(options, cwd);
      case "help":
      case "":
        return help();
      default:
        fail(`Unknown command: ${command}\n\n${usage()}`);
    }
  } catch (error) {
    fail(error.message);
  }
}


// Record an attestation as first-class events in a thread (M36).
//
// Composes existing types — ParticipantDeclared (idempotent, via
// appendParticipant), EvidenceCommitted (the attestation text), and, when
// --request targets a decisionRequest, ReviewSubmitted. The verb adds NO new
// event types: an attestation is a *composition* of objects the protocol
// already knows about. This is the M36 hard law in code:
//   attestation_recording != manual_copy_paste
// — the molty no longer has to retype their verify_protocol output into a
// Moltbook reply for it to count; the events are committed directly.
//
// Omitting --request emits Participant + Evidence only, which is the right
// shape for attesting *about* a thread without targeting a specific
// decision request (or after a decision has merged — the validator refuses
// a late ReviewSubmitted on a merged request, src/validator.js:2363).
// `run report` packages a completed event log for optional reporting. The agent performs primary verification via validate/replay/decision summary.
// It validates the log and prepares a submission bundle if desired.
// External runs (pack/) are optional for credibility; agent verification unblocks development.
// It fails closed on an invalid log and keeps trusted:false —
// A clean report means the log is well-formed.
// Agent-executed checks (replays, validate, decision summary) are now sufficient.
// decides that. Read-only: it appends no events and is deterministic for a
// given log (no wall-clock timestamps leak into the printed report).
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

function parseCommand(argv) {
  const commandParts = [];
  const optionArgs = [];
  let readingOptions = false;
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      readingOptions = true;
    }
    if (readingOptions) {
      optionArgs.push(arg);
    } else {
      commandParts.push(arg);
    }
  }
  return {
    command: commandParts.join(" "),
    options: parseOptions(optionArgs)
  };
}

function normalizeCommand(command, options) {
  if (command.startsWith("attribution show ")) {
    return {
      command: "attribution show",
      options: {
        ...options,
        contribution: options.contribution || command.slice("attribution show ".length).trim()
      }
    };
  }
  if (command.startsWith("attribution by-participant ")) {
    return {
      command: "attribution by-participant",
      options: {
        ...options,
        participant: options.participant || command.slice("attribution by-participant ".length).trim()
      }
    };
  }
  if (command.startsWith("provenance show ")) {
    return {
      command: "provenance show",
      options: {
        ...options,
        contribution: options.contribution || command.slice("provenance show ".length).trim()
      }
    };
  }
  if (command.startsWith("provenance trace ")) {
    return {
      command: "provenance trace",
      options: {
        ...options,
        contribution: options.contribution || command.slice("provenance trace ".length).trim()
      }
    };
  }
  if (command.startsWith("learning show ")) {
    return {
      command: "learning show",
      options: {
        ...options,
        learning: options.learning || command.slice("learning show ".length).trim()
      }
    };
  }
  if (command.startsWith("adaptation show ")) {
    return {
      command: "adaptation show",
      options: {
        ...options,
        adaptation: options.adaptation || command.slice("adaptation show ".length).trim()
      }
    };
  }
  if (command.startsWith("amendment show ")) {
    return {
      command: "amendment show",
      options: {
        ...options,
        amendment: options.amendment || command.slice("amendment show ".length).trim()
      }
    };
  }
  for (const continuityCommand of ["continuity import", "continuity verify", "continuity resume", "continuity show", "continuity summary"]) {
    if (command.startsWith(`${continuityCommand} `)) {
      return {
        command: continuityCommand,
        options: {
          ...options,
          packet: options.packet || command.slice(`${continuityCommand} `.length).trim()
        }
      };
    }
  }
  for (const compatibilityCommand of ["compatibility check", "compatibility show", "compatibility verify"]) {
    if (command.startsWith(`${compatibilityCommand} `)) {
      return {
        command: compatibilityCommand,
        options: {
          ...options,
          packet: options.packet || command.slice(`${compatibilityCommand} `.length).trim()
        }
      };
    }
  }
  for (const interoperabilityCommand of ["interoperability check", "interoperability show", "interoperability verify"]) {
    if (command.startsWith(`${interoperabilityCommand} `)) {
      return {
        command: interoperabilityCommand,
        options: {
          ...options,
          packet: options.packet || command.slice(`${interoperabilityCommand} `.length).trim()
        }
      };
    }
  }
  for (const federationCommand of ["federation check"]) {
    if (command.startsWith(`${federationCommand} `)) {
      return {
        command: federationCommand,
        options: {
          ...options,
          packet: options.packet || command.slice(`${federationCommand} `.length).trim()
        }
      };
    }
  }
  for (const negotiationCommand of ["negotiation check"]) {
    if (command.startsWith(`${negotiationCommand} `)) {
      return {
        command: negotiationCommand,
        options: {
          ...options,
          packet: options.packet || command.slice(`${negotiationCommand} `.length).trim()
        }
      };
    }
  }
  if (command.startsWith("federation show ")) {
    return {
      command: "federation show",
      options: {
        ...options,
        federation: options.federation || command.slice("federation show ".length).trim()
      }
    };
  }
  if (command.startsWith("negotiation show ")) {
    return {
      command: "negotiation show",
      options: {
        ...options,
        negotiation: options.negotiation || command.slice("negotiation show ".length).trim()
      }
    };
  }
  if (command.startsWith("delegation show ")) {
    return {
      command: "delegation show",
      options: {
        ...options,
        delegation: options.delegation || command.slice("delegation show ".length).trim()
      }
    };
  }
  if (command.startsWith("execution show ")) {
    return {
      command: "execution show",
      options: {
        ...options,
        execution: options.execution || command.slice("execution show ".length).trim()
      }
    };
  }
  if (command.startsWith("outcome show ")) {
    return {
      command: "outcome show",
      options: {
        ...options,
        outcome: options.outcome || command.slice("outcome show ".length).trim()
      }
    };
  }
  if (command.startsWith("outcome-learning show ")) {
    return {
      command: "outcome-learning show",
      options: {
        ...options,
        learning: options.learning || command.slice("outcome-learning show ".length).trim()
      }
    };
  }
  if (command.startsWith("review show ")) {
    return {
      command: "review show",
      options: {
        ...options,
        review: options.review || command.slice("review show ".length).trim()
      }
    };
  }
  if (command.startsWith("recovery show ")) {
    return {
      command: "recovery show",
      options: {
        ...options,
        recovery: options.recovery || command.slice("recovery show ".length).trim()
      }
    };
  }
  for (const releaseCommand of ["release verify", "release show"]) {
    if (command.startsWith(`${releaseCommand} `)) {
      return {
        command: releaseCommand,
        options: {
          ...options,
          manifest: options.manifest || command.slice(`${releaseCommand} `.length).trim()
        }
      };
    }
  }
  if (command.startsWith("runtime verify ")) {
    return {
      command: "runtime verify",
      options: {
        ...options,
        manifest: options.manifest || command.slice("runtime verify ".length).trim()
      }
    };
  }
  if (command.startsWith("runtime audit ")) {
    return {
      command: "runtime audit",
      options: {
        ...options,
        manifest: options.manifest || command.slice("runtime audit ".length).trim()
      }
    };
  }
  return { command, options };
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = args[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (value !== true) {
      index += 1;
    }
    if (options[key] === undefined) {
      options[key] = value;
    } else if (Array.isArray(options[key])) {
      options[key].push(value);
    } else {
      options[key] = [options[key], value];
    }
  }
  return options;
}



function help() {
  writeOut(`${usage()}\n`);
}

// Run main() against an in-process sink instead of the real stdout. Returns
// what the CLI would have written and the exit code it set, so an embedder
// (MCP server, tests) can drive the CLI as a function and forward the result
// back to a JSON-RPC peer without ever touching the real stdout. Restores both
// the OUT sink and process.exitCode no matter how main() returns or throws, so
// concurrent default-mode CLI use is never observably affected.
function runCaptured(argv, cwd) {
  const chunks = [];
  const sink = { write: (chunk) => { chunks.push(String(chunk)); } };
  const previousOut = setOut(sink);
  const previousExitCode = process.exitCode;
  process.exitCode = 0;
  let captured;
  try {
    main(argv, cwd);
    captured = { stdout: chunks.join(""), exitCode: process.exitCode || 0 };
  } finally {
    setOut(previousOut);
    process.exitCode = previousExitCode;
  }
  return captured;
}

if (require.main === module) {
  main();
}

module.exports = { main, parseOptions, runCaptured, setOut };
