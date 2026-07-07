#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const {
  appendEvent,
  contentHash,
  createEvent,
  createParticipant,
  initStore,
  newId,
  nowIso,
  parseList,
  participantIdFor,
  readEvents,
  readEventsAt,
  writeEvents
} = require("./events");
const {
  adaptationForId
} = require("./adaptation");
const {
  amendmentForId
} = require("./amendments");
const {
  buildReleaseManifest,
  readReleaseManifest,
  verifyReleaseManifest,
  writeReleaseManifest
} = require("./release");
const { auditRuntimeUsage, verifyRuntime } = require("./runtime");
const {
  summarizeProtocolCompatibility,
  verifyProtocolCompatibility
} = require("./compatibility");
const {
  attributionForContribution,
  attributionsForParticipant
} = require("./attribution");
const {
  learningForId
} = require("./learning");
const { verifyCrossThreadProvenance } = require("./provenance");
const {
  PROTOCOL_VERSION,
  formatIntegrityReasons,
  verifyEventIntegrity,
  verifyEventSuffix
} = require("./integrity");
const {
  summarizeProtocolInteroperability,
  verifyProtocolInteroperability
} = require("./interoperability");
const { verifyContinuityPacket } = require("./continuity");
const {
  exportProtocol,
  projectEvents,
  selectAudit,
  selectDecisionSummary,
  selectForkLineage,
  selectThreadState
} = require("./projector");
const { assertValidEvents, validateEvents } = require("./validator");
const { stripUndefined, unique } = require("./utils");
const {
  appendParticipant,
  booleanOption,
  compatibilityOptionsFromCli,
  fail,
  inferTargetType,
  interoperabilityOptionsFromCli,
  numberOption,
  participantFrom,
  print,
  readContinuityPacketForOptions,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption,
  setOut,
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

function threadCreate(options, cwd) {
  requireOption(options, "title");
  requireOption(options, "question");
  const actorKind = options.actorKind || (options.actor ? "human" : "system");
  const actor = participantFrom(options.actor || "System", options.actorRole || "system", actorKind);
  const participantSpecs = parseList(options.participant || options.participants);
  const participants = participantSpecs.length
    ? participantSpecs.map(parseParticipantSpec)
    : [actor];
  const at = nowIso();
  const thread = {
    id: options.id || newId("thd", options.title),
    object: "thread",
    title: options.title,
    question: options.question,
    status: "active",
    participantIds: unique(participants.map((participant) => participant.id)),
    createdAt: at,
    updatedAt: at
  };
  appendParticipant(actor, cwd, thread.id);
  for (const participant of participants) {
    appendParticipant(participant, cwd, thread.id);
  }
  const event = createEvent({
    type: "ThreadCreated",
    threadId: thread.id,
    actorId: actor.id,
    at,
    payload: { thread }
  });
  appendEvent(event, cwd);
  return print({ thread, event });
}

function attributionList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const attributions = options.thread
    ? projection.attribution.attributions.filter((record) => record.threadId === options.thread)
    : projection.attribution.attributions;
  return print({
    schema: "clista.attribution.list.v0",
    threadId: options.thread || null,
    count: attributions.length,
    attributions
  });
}

function attributionShow(options, cwd) {
  const contributionId = options.contribution || options.contributionId || options.id;
  if (!contributionId) {
    throw new Error("Missing required option --contribution");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(attributionForContribution(projection.attribution, contributionId));
}

function attributionByParticipant(options, cwd) {
  const participant = options.participant || options.participantId || options.id;
  if (!participant) {
    throw new Error("Missing required option --participant");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(attributionsForParticipant(projection.attribution, participantIdFor(participant)));
}

function attributionVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.attribution.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.attribution.verify.v0",
    valid: true,
    errors: [],
    attributionValidationStatus: projection.attribution.attributionValidationStatus
  });
}

function learningReview(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const learning = options.thread
    ? projection.learning.signals.filter((signal) => signal.threadId === options.thread)
    : projection.learning.signals;
  return print({
    schema: "clista.learning.review.v0",
    theorem: projection.learning.theorem,
    hardLaw: projection.learning.hardLaw,
    threadId: options.thread || null,
    learning: options.thread
      ? {
          ...projection.learning,
          signals: learning,
          patterns: projection.learning.patterns.filter((pattern) => {
            return pattern.signalIds.some((id) => learning.some((signal) => signal.id === id));
          }),
          revisitRecommendations: projection.learning.revisitRecommendations
            .filter((recommendation) => recommendation.threadId === options.thread)
        }
      : projection.learning
  });
}

function learningList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const signals = options.thread
    ? projection.learning.signals.filter((signal) => signal.threadId === options.thread)
    : projection.learning.signals;
  return print({
    schema: "clista.learning.list.v0",
    threadId: options.thread || null,
    count: signals.length,
    signals
  });
}

function learningShow(options, cwd) {
  const learningId = options.learning || options.learningId || options.id;
  if (!learningId) {
    throw new Error("Missing required option --learning");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(learningForId(projection.learning, learningId));
}

function learningVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.learning.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.learning.verify.v0",
    valid: true,
    errors: [],
    learningValidationStatus: projection.learning.learningValidationStatus
  });
}

function adaptationReview(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print({
    schema: "clista.adaptation.review.v0",
    theorem: projection.adaptation.theorem,
    hardLaw: projection.adaptation.hardLaw,
    threadId: options.thread || null,
    adaptation: options.thread
      ? adaptationProjectionForThread(projection.adaptation, options.thread)
      : projection.adaptation
  });
}

function adaptationList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const recommendations = options.thread
    ? projection.adaptation.recommendations.filter((recommendation) => recommendation.threadId === options.thread)
    : projection.adaptation.recommendations;
  return print({
    schema: "clista.adaptation.list.v0",
    threadId: options.thread || null,
    count: recommendations.length,
    recommendations
  });
}

function adaptationShow(options, cwd) {
  const adaptationId = options.adaptation || options.adaptationId || options.id;
  if (!adaptationId) {
    throw new Error("Missing required option --adaptation");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(adaptationForId(projection.adaptation, adaptationId));
}

function adaptationVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.adaptation.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.adaptation.verify.v0",
    valid: true,
    errors: [],
    adaptationValidationStatus: projection.adaptation.adaptationValidationStatus
  });
}

function amendmentPropose(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "title");
  requireOption(options, "type");
  requireOption(options, "target");
  requireOption(options, "rationale");
  requireOption(options, "change");
  const actor = participantFrom(options.proposedBy || options.actor || "Author", options.role || "contributor", options.kind || "human");
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const protocolAmendment = {
    id: options.id || newId("amd", options.title),
    object: "protocolAmendment",
    title: options.title,
    amendmentType: options.type,
    target: options.target,
    rationale: options.rationale,
    proposedChange: options.change,
    effectScope: options.effectScope || "future_only",
    threadId: options.thread,
    adaptationRecommendationIds: parseList(options.adaptation || options.adaptationRecommendation || options.adaptationRecommendations),
    learningSignalIds: parseList(options.learning || options.learningSignal || options.learningSignals),
    sourceEventIds: parseList(options.sourceEvent || options.sourceEvents),
    proposedBy: actor.id,
    proposedAt: at,
    automaticAmendment: false,
    implicitMutation: false,
    hiddenPolicyMutation: false,
    retroactiveMutation: false,
    rewritesPastEvents: false,
    recommendationBecomesAmendment: false
  };
  stripUndefined(protocolAmendment);
  const event = createEvent({
    type: "ProtocolAmendmentProposed",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { protocolAmendment }
  });
  appendEvent(event, cwd);
  return print({ protocolAmendment, event });
}

function amendmentList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let amendments = options.thread
    ? projection.amendments.amendments.filter((amendment) => amendment.threadId === options.thread)
    : projection.amendments.amendments;
  if (options.status) {
    amendments = amendments.filter((amendment) => amendment.status === options.status);
  }
  return print({
    schema: "clista.amendment.list.v0",
    theorem: projection.amendments.theorem,
    hardLaw: projection.amendments.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: amendments.length,
    amendments
  });
}

function amendmentShow(options, cwd) {
  const amendmentId = options.amendment || options.amendmentId || options.id;
  if (!amendmentId) {
    throw new Error("Missing required option --amendment");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(amendmentForId(projection.amendments, amendmentId));
}

function amendmentVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.amendment.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.amendment.verify.v0",
    valid: true,
    errors: [],
    amendmentValidationStatus: projection.amendments.amendmentValidationStatus
  });
}

function prunePropose(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "objectId");
  requireOption(options, "reason");
  const actor = participantFrom(options.proposedBy || options.actor || "Author", options.role || "contributor", options.kind || "human");
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const pruning = {
    id: options.id || newId("prn", options.objectId),
    object: "pruning",
    threadId: options.thread,
    objectId: options.objectId,
    objectType: options.objectType || "unknown",
    reason: options.reason,
    proposedBy: actor.id,
    proposedAt: at,
    deprecationEvent: "ObjectDeprecated",
    status: "proposed"
  };
  const event = createEvent({
    type: "ObjectDeprecated",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { pruning }
  });
  appendEvent(event, cwd);
  return print({ pruning, event });
}

function pruneList(options, cwd) {
  const events = readEventsForOptions(options, cwd);  // use raw to support new event types during bootstrap
  const pruningEvents = events.filter(e => e.event_type === "ObjectDeprecated");
  return print({
    schema: "clista.pruning.list.v0",
    threadId: options.thread || null,
    count: pruningEvents.length,
    prunings: pruningEvents.map(e => e.payload.pruning || e.payload)
  });
}


function threadFork(options, cwd) {
  requireOption(options, "parent");
  requireOption(options, "fork");
  requireOption(options, "title");
  requireOption(options, "reason");
  requireOption(options, "through");
  const actor = participantFrom(options.forkedBy || options.actor || "Author", options.role);
  appendParticipant(actor, cwd, options.parent);
  const at = nowIso();
  const threadFork = {
    id: options.fork,
    object: "threadFork",
    parentThreadId: options.parent,
    forkThreadId: options.fork,
    forkTitle: options.title,
    forkedBy: actor.id,
    forkedAt: at,
    inheritedThroughEventId: options.through,
    forkReason: options.reason,
    changedAssumptionIds: parseList(options.changedAssumptions || options.changedAssumptionIds),
    changedClaimIds: parseList(options.changedClaims || options.changedClaimIds),
    contentHash: contentHash({
      parentThreadId: options.parent,
      forkThreadId: options.fork,
      forkTitle: options.title,
      forkedBy: actor.id,
      forkedAt: at,
      inheritedThroughEventId: options.through,
      forkReason: options.reason,
      changedAssumptionIds: parseList(options.changedAssumptions || options.changedAssumptionIds),
      changedClaimIds: parseList(options.changedClaims || options.changedClaimIds)
    })
  };
  const event = createEvent({
    type: "ThreadForked",
    threadId: threadFork.forkThreadId,
    actorId: actor.id,
    at,
    payload: { threadFork }
  });
  appendEvent(event, cwd);
  return print({ threadFork, event });
}

function evidenceCommit(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "source");
  requireOption(options, "finding");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const evidence = {
    id: options.id || newId("evd", options.finding),
    object: "evidence",
    threadId: options.thread,
    source: options.source,
    finding: options.finding,
    confidence: numberOption(options.confidence),
    committedByParticipantId: actor.id,
    committedAt: at,
    artifactIds: parseList(options.artifacts),
    tags: parseList(options.tags),
    contentHash: contentHash({
      source: options.source,
      finding: options.finding,
      confidence: numberOption(options.confidence),
      artifactIds: parseList(options.artifacts),
      tags: parseList(options.tags)
    })
  };
  stripUndefined(evidence);
  const event = createEvent({
    type: "EvidenceCommitted",
    threadId: evidence.threadId,
    actorId: actor.id,
    at,
    payload: { evidence }
  });
  appendEvent(event, cwd);
  return print({ evidence, event });
}

function assumptionDeclare(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "text");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const assumption = {
    id: options.id || newId("asm", options.text),
    object: "assumption",
    threadId: options.thread,
    text: options.text,
    status: options.status || "active",
    evidenceIds: parseList(options.evidence),
    confidence: numberOption(options.confidence),
    declaredByParticipantId: actor.id,
    declaredAt: at,
    tags: parseList(options.tags),
    contentHash: contentHash({
      text: options.text,
      status: options.status || "active",
      evidenceIds: parseList(options.evidence),
      confidence: numberOption(options.confidence),
      tags: parseList(options.tags)
    })
  };
  stripUndefined(assumption);
  const event = createEvent({
    type: "AssumptionDeclared",
    threadId: assumption.threadId,
    actorId: actor.id,
    at,
    payload: { assumption }
  });
  appendEvent(event, cwd);
  return print({ assumption, event });
}

function claimCreate(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "text");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const claim = {
    id: options.id || newId("clm", options.text),
    object: "claim",
    threadId: options.thread,
    text: options.text,
    status: options.status || "draft",
    evidenceIds: parseList(options.evidence || options.supports),
    assumptionIds: parseList(options.assumptions),
    contradictingEvidenceIds: parseList(options.contradicts),
    createdByParticipantId: actor.id,
    createdAt: at
  };
  const event = createEvent({
    type: "ClaimCreated",
    threadId: claim.threadId,
    actorId: actor.id,
    at,
    payload: { claim }
  });
  appendEvent(event, cwd);
  return print({ claim, event });
}

function positionTake(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "participant");
  requireOption(options, "stance");
  const participant = participantFrom(options.participant, options.role, options.kind || "human");
  appendParticipant(participant, cwd, options.thread);
  const at = nowIso();
  const targetObjectId = options.target || options.claim || options.request || options.thread;
  const position = {
    id: options.id || newId("pos", `${participant.name}_${options.stance}`),
    object: "position",
    threadId: options.thread,
    participantId: participant.id,
    targetObjectId,
    targetObjectType: options.targetType || inferTargetType(targetObjectId),
    stance: options.stance,
    reason: options.reason,
    takenAt: at
  };
  stripUndefined(position);
  const event = createEvent({
    type: "PositionTaken",
    threadId: position.threadId,
    actorId: participant.id,
    at,
    payload: { position }
  });
  appendEvent(event, cwd);
  return print({ position, event });
}

function objectionRaise(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "participant");
  requireOption(options, "target");
  requireOption(options, "text");
  const participant = participantFrom(options.participant, options.role, options.kind || "agent");
  appendParticipant(participant, cwd, options.thread);
  const at = nowIso();
  const objection = {
    id: options.id || newId("obj", options.text),
    object: "objection",
    threadId: options.thread,
    participantId: participant.id,
    targetObjectId: options.target,
    targetObjectType: options.targetType || inferTargetType(options.target),
    assumption: options.assumption,
    text: options.text,
    blocking: booleanOption(options.blocking, true),
    status: options.status || "open",
    resolution: options.resolution,
    raisedAt: at
  };
  stripUndefined(objection);
  const event = createEvent({
    type: "ObjectionRaised",
    threadId: objection.threadId,
    actorId: participant.id,
    at,
    payload: { objection }
  });
  appendEvent(event, cwd);
  return print({ objection, event });
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
function attestationRecord(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "attester");
  requireOption(options, "text");
  const attester = participantFrom(options.attester, options.role || "attester", options.kind || "human");
  appendParticipant(attester, cwd, options.thread);
  const at = nowIso();
  const events = [];

  // Evidence first: this is the permanent record of *what was attested*.
  // The source field encodes the attestation provenance (a URL when given,
  // otherwise the attester name) so the answer view surfaces it without
  // touching artifactIds — that field's semantics are "id of a known
  // artifact" and we don't pollute it with raw URLs.
  const evidence = {
    id: newId("evd", `attestation_${attester.name}`),
    object: "evidence",
    threadId: options.thread,
    source: options.source
      ? `Moltbook attestation: ${options.source}`
      : `Attestation by ${attester.name}`,
    finding: options.text,
    committedByParticipantId: attester.id,
    committedAt: at,
    artifactIds: [],
    contentHash: contentHash({
      source: options.source
        ? `Moltbook attestation: ${options.source}`
        : `Attestation by ${attester.name}`,
      finding: options.text,
      confidence: undefined,
      artifactIds: []
    })
  };
  stripUndefined(evidence);
  const evidenceEvent = createEvent({
    type: "EvidenceCommitted",
    threadId: evidence.threadId,
    actorId: attester.id,
    at,
    payload: { evidence }
  });
  appendEvent(evidenceEvent, cwd);
  events.push(evidenceEvent);

  // Review only when an actual decisionRequest target is given. The
  // validator (src/validator.js:2360-2364) rejects a Review against an
  // unknown or already-merged request; we let that surface as the natural
  // error rather than reinventing pre-checks here.
  let review = null;
  if (options.request) {
    const status = options.status || "approve";
    const comment = options.source
      ? `${options.text}\n\nSource: ${options.source}`
      : options.text;
    review = {
      id: newId("rev", `${attester.name}_attestation_${status}`),
      object: "review",
      threadId: options.thread,
      decisionRequestId: options.request,
      reviewerParticipantId: attester.id,
      status,
      conditions: parseList(options.conditions),
      comment,
      reviewedAt: at
    };
    stripUndefined(review);
    const reviewEvent = createEvent({
      type: "ReviewSubmitted",
      threadId: review.threadId,
      actorId: attester.id,
      at,
      payload: { review }
    });
    appendEvent(reviewEvent, cwd);
    events.push(reviewEvent);
  }

  return print({
    schema: "clista.attestation.record.v0",
    attester,
    evidence,
    review,
    events
  });
}

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

function stateShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(selectThreadState(projection, options.thread));
}

function auditShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(selectAudit(projection, options.thread));
}

function forkLineage(options, cwd) {
  requireOption(options, "thread");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const lineage = selectForkLineage(projection, options.thread);
  if (!lineage) {
    return print({
      schema: "clista.forkLineage.v0",
      threadId: options.thread,
      error: "Thread is not a fork"
    });
  }
  return print({
    schema: "clista.forkLineage.v0",
    ...lineage
  });
}

function assumptionsList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const state = selectThreadState(projection, options.thread);
  if (state.error) return print(state);
  const items = options.tag
    ? state.assumptions.filter((a) => Array.isArray(a.tags) && a.tags.includes(options.tag))
    : state.assumptions;
  return print(items);
}

function evidenceList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const state = selectThreadState(projection, options.thread);
  if (state.error) return print(state);
  const items = options.tag
    ? state.allEvidence.filter((e) => Array.isArray(e.tags) && e.tags.includes(options.tag))
    : state.allEvidence;
  return print(items);
}

function exportShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(exportProtocol(projection));
}

// `run report` packages a completed event log for optional reporting. The agent performs primary verification via validate/replay/decision summary.
// It validates the log and prepares a submission bundle if desired.
// External runs (pack/) are optional for credibility; agent verification unblocks development.
// It fails closed on an invalid log and keeps trusted:false —
// A clean report means the log is well-formed.
// Agent-executed checks (replays, validate, decision summary) are now sufficient.
// decides that. Read-only: it appends no events and is deterministic for a
// given log (no wall-clock timestamps leak into the printed report).
function runReport(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.run.report.v0",
      valid: false,
      trusted: false,
      reportable: false,
      errors: result.errors,
      guidance:
        "Fix these validation errors before reporting. The gate accepts only logs that pass `clista validate` — an invalid log is not a reportable run."
    });
    process.exitCode = 1;
    return;
  }

  const projection = projectEvents(events);
  const integrity = verifyEventIntegrity(projection.events);
  const summary = selectDecisionSummary(projection, options.thread);

  let bundle = { written: false, hint: "re-run with --out <path> to write a portable submission bundle" };
  if (options.out) {
    const bundlePath = path.resolve(cwd, options.out);
    fs.writeFileSync(bundlePath, `${JSON.stringify(exportProtocol(projection), null, 2)}\n`);
    bundle = { written: true, path: options.out, format: PROTOCOL_VERSION };
  }

  const decisionTitle = options.title || summary.title || summary.threadId || "untitled run";
  const issueTitle = `External run report: ${decisionTitle}`;
  const issueBody = [
    "<!-- ClisTa external debate-pack run. -->",
    "",
    "This run was NOT prompted, hosted, refereed, or graded by the ClisTa project.",
    "epistemic_state: unaudited — a clean closure means well-shaped, not right.",
    "",
    "## Artifacts (attach or link)",
    "- [ ] LEDGER.md (or the submission bundle written with --out)",
    "- [ ] failures.md — discipline failures observed (or \"none observed\")",
    "- [ ] cost.md — wall-clock, rounds, tokens, human-minutes of format overhead",
    "- [ ] outcome.md — later, if the decision gets executed",
    "",
    "## One-line integrity verdict",
    "Was the debate real?",
    ""
  ].join("\n");
  const issueUrl =
    "https://github.com/lati-club/ClisTa-Protocol/issues/new" +
    `?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

  return print({
    schema: "clista.run.report.v0",
    valid: true,
    trusted: false,
    reportable: true,
    threadId: summary.threadId || options.thread || null,
    eventCount: projection.events.length,
    integrityValid: integrity.valid,
    decisionSummary: summary,
    bundle,
    submit: {
      gate: "EXTERNAL-RUNS",
      deadline: "2026-09-07",
      issueTitle,
      issueUrl,
      url: "https://github.com/lati-club/ClisTa-Protocol/issues/new",
      emailFallback: "lati@clista.ai",
      include: [
        "this event log (or the bundle written with --out)",
        "failures.md — every discipline failure observed",
        "cost.md — wall-clock, rounds, tokens, human-minutes of format overhead",
        "outcome.md — later, if the decision gets executed"
      ],
      runbook: "pack/RUNBOOK.md"
    },
    boundary:
      "Structure validated, content not endorsed. trusted:false stays the default: a clean report means the log is well-formed and reportable, not that the decision was good. Only blind external judging (docs/judging.md) decides whether a run counts toward the gate. Failed and abandoned runs are wanted evidence — report them too."
  });
}

function importCommand(options, cwd) {
  requireOption(options, "events");
  const sourcePath = path.resolve(cwd, options.events);
  const existingEvents = readEvents(cwd);
  if (existingEvents.length && !booleanOption(options.replace, false)) {
    throw new Error("Refusing to import into a non-empty ClisTa store; pass --replace true to overwrite .clista/events.ndjson");
  }

  const events = readImportEventsAt(sourcePath);
  const integrity = verifyEventIntegrity(events);
  if (!integrity.valid) {
    throw new Error(formatIntegrityReasons(integrity.reasons));
  }
  assertValidEvents(events);

  const importedEvents = writeEvents(events, cwd);
  const strictIntegrity = verifyEventIntegrity(importedEvents, { strict: true });
  if (!strictIntegrity.valid) {
    throw new Error(formatIntegrityReasons(strictIntegrity.reasons));
  }
  return print({
    schema: "clista.import.v0",
    source: sourcePath,
    valid: strictIntegrity.valid,
    importedEvents: importedEvents.length,
    integrity: strictIntegrity
  });
}

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

function readImportEventsAt(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Import source not found: ${sourcePath}`);
  }
  const raw = fs.readFileSync(sourcePath, "utf8").trim();
  if (!raw) {
    return [];
  }
  if (!raw.startsWith("{")) {
    return readEventsAt(sourcePath);
  }

  const exported = JSON.parse(raw);
  if (exported.schema !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported import schema ${exported.schema}`);
  }
  if (exported.protocolVersion && exported.protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported import protocolVersion ${exported.protocolVersion}`);
  }
  if (!Array.isArray(exported.events)) {
    throw new Error("Protocol export missing events array");
  }
  return exported.events;
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

function parseParticipantSpec(spec) {
  const [idOrName, nameOrRole, maybeRole] = String(spec).split(":").map((part) => part.trim());
  if (idOrName.startsWith("par_")) {
    return {
      id: idOrName,
      object: "participant",
      kind: "human",
      name: nameOrRole || idOrName.replace(/^par_/, "").replace(/_/g, " "),
      role: maybeRole
    };
  }
  return createParticipant(idOrName, nameOrRole);
}

function adaptationProjectionForThread(adaptation, threadId) {
  const recommendations = adaptation.recommendations
    .filter((recommendation) => recommendation.threadId === threadId);
  const reviews = adaptation.reviews
    .filter((review) => review.threadId === threadId);
  const recommendationIds = new Set(recommendations.map((recommendation) => recommendation.id));
  const filterBucket = (bucket) => bucket.filter((recommendation) => recommendationIds.has(recommendation.id));
  return {
    ...adaptation,
    recommendations,
    reviews,
    adaptationReviews: reviews,
    governanceReviewRecommendations: filterBucket(adaptation.governanceReviewRecommendations),
    evidenceRequirementReviewRecommendations: filterBucket(adaptation.evidenceRequirementReviewRecommendations),
    revisitTriggerReviewRecommendations: filterBucket(adaptation.revisitTriggerReviewRecommendations),
    decisionGateReviewRecommendations: filterBucket(adaptation.decisionGateReviewRecommendations),
    provenanceRequirementReviewRecommendations: filterBucket(adaptation.provenanceRequirementReviewRecommendations),
    objectionResolutionReviewRecommendations: filterBucket(adaptation.objectionResolutionReviewRecommendations),
    outcomeWindowReviewRecommendations: filterBucket(adaptation.outcomeWindowReviewRecommendations),
    byRecommendation: recommendations.reduce((indexed, recommendation) => {
      indexed[recommendation.id] = recommendation;
      return indexed;
    }, {}),
    byLearningSignal: recommendations.reduce((indexed, recommendation) => {
      for (const learningSignalId of recommendation.learningSignalIds || []) {
        if (!indexed[learningSignalId]) {
          indexed[learningSignalId] = [];
        }
        indexed[learningSignalId].push(recommendation);
      }
      return indexed;
    }, {}),
    byPattern: recommendations.reduce((indexed, recommendation) => {
      if (!indexed[recommendation.pattern]) {
        indexed[recommendation.pattern] = [];
      }
      indexed[recommendation.pattern].push(recommendation);
      return indexed;
    }, {})
  };
}



function help() {
  writeOut(`${usage()}\n`);
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
