#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const {
  appendEvent,
  contentHash,
  createEvent,
  createParticipant,
  eventLogPath,
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
  buildFederatedStateReference,
  federationForId,
  verifyProtocolFederation
} = require("./federation");
const {
  buildDelegatedAction,
  buildDelegationGrant,
  buildDelegationRevocation,
  delegationForId
} = require("./delegation");
const {
  buildExecutionCompletion,
  buildExecutionFailure,
  buildExecutionRollback,
  buildExecutionStart,
  executionForId
} = require("./execution");
const {
  buildOutcomeDispute,
  buildOutcomeEvaluation,
  buildOutcomeExpectation,
  buildOutcomeObservation,
  outcomeForId
} = require("./outcome");
const {
  buildOutcomeLearningDispute,
  buildOutcomeLearningSignal,
  buildOutcomeLearningViolation,
  buildOutcomeLesson,
  outcomeLearningForId
} = require("./outcome-learning");
const {
  buildReviewCompletion,
  buildReviewDispute,
  buildReviewOpening,
  buildReviewRequirement,
  buildReviewViolation,
  reviewForId
} = require("./review");
const {
  buildRecoveryApplication,
  buildRecoveryPlan,
  buildRecoveryQuarantine,
  buildRecoveryRequest,
  buildRecoveryVerification,
  buildRecoveryViolation,
  RECOVERY_EVENT_TYPES,
  checkpointHash,
  recoveryForId,
  recoveryLogHash,
  restoredProjectionHash,
  restoredStateHash
} = require("./recovery");
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
const {
  buildNegotiationDifferenceRecords,
  buildNegotiationRequest,
  buildNegotiationTerms,
  negotiationForId,
  verifyProtocolNegotiation
} = require("./negotiation");
const {
  isKnownContribution,
  provenanceForContribution,
  traceProvenance
} = require("./provenance");
const {
  buildIdentityState,
  identityForParticipant
} = require("./identity");
const {
  PROTOCOL_VERSION,
  formatIntegrityReasons,
  verifyEventIntegrity
} = require("./integrity");
const {
  summarizeProtocolInteroperability,
  verifyProtocolInteroperability
} = require("./interoperability");
const {
  continuityPacketPath,
  exportContinuityPacket,
  formatContinuityReasons,
  readContinuityPacketAt,
  resumeContinuityPacket,
  summarizeContinuityPacket,
  verifyContinuityPacket,
  writeContinuityPacket
} = require("./continuity");
const {
  exportProtocol,
  projectEvents,
  selectAudit,
  selectDecisionSummary,
  selectForkLineage,
  selectMergeRequestState,
  selectThreadState
} = require("./projector");
const { evaluateDecisionEligibility } = require("./governance");
const { evaluateMergeEligibility } = require("./merges");
const { assertValidEvents, validateEvents } = require("./validator");
const { stripUndefined, unique } = require("./utils");

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
      case "thread fork":
        return threadFork(options, cwd);
      case "evidence commit":
        return evidenceCommit(options, cwd);
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
      case "decision summary":
        return decisionSummary(options, cwd);
      case "decision eligibility":
        return decisionEligibility(options, cwd);
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
      case "integrity verify":
        return integrityVerify(options, cwd);
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

function participantDeclare(options, cwd) {
  requireOption(options, "name");
  const id = options.id || participantIdFor(options.name);
  const at = nowIso();
  const participant = {
    id,
    object: "participant",
    kind: options.kind || "human",
    name: options.name,
    declaredBy: options.declaredBy || options.actor || id,
    declaredAt: at
  };
  if (options.role) {
    participant.role = options.role;
  }
  const event = createEvent({
    type: "ParticipantDeclared",
    threadId: options.thread || "thd_identity",
    actorId: participant.declaredBy,
    at,
    payload: { participant }
  });
  appendEvent(event, cwd);
  return print({ participant, event });
}

function participantRoleAssign(options, cwd) {
  requireOption(options, "participant");
  requireOption(options, "role");
  const at = nowIso();
  const participantId = participantIdFor(options.participant);
  const scope = options.scope || (options.thread ? "thread" : "global");
  const participantRole = {
    id: options.id || newId("rol", `${participantId}_${options.role}`),
    object: "participantRole",
    participantId,
    role: options.role,
    scope,
    threadId: options.thread,
    assignedBy: participantIdFor(options.actor || options.assignedBy || options.participant),
    assignedAt: at
  };
  stripUndefined(participantRole);
  const event = createEvent({
    type: "ParticipantRoleAssigned",
    threadId: options.thread || "thd_identity",
    actorId: participantRole.assignedBy,
    at,
    payload: { participantRole }
  });
  appendEvent(event, cwd);
  return print({ participantRole, event });
}

function participantAuthorityGrant(options, cwd) {
  requireOption(options, "participant");
  requireOption(options, "authority");
  const at = nowIso();
  const participantId = participantIdFor(options.participant);
  const scope = options.scope || (options.thread ? "thread" : "global");
  const participantAuthority = {
    id: options.id || newId("auth", `${participantId}_${options.authority}`),
    object: "participantAuthority",
    participantId,
    authority: options.authority,
    scope,
    threadId: options.thread,
    grantedBy: participantIdFor(options.actor || options.grantedBy || options.participant),
    grantedAt: at,
    reason: options.reason
  };
  stripUndefined(participantAuthority);
  const event = createEvent({
    type: "ParticipantAuthorityGranted",
    threadId: options.thread || "thd_identity",
    actorId: participantAuthority.grantedBy,
    at,
    payload: { participantAuthority }
  });
  appendEvent(event, cwd);
  return print({ participantAuthority, event });
}

function participantAuthorityRevoke(options, cwd) {
  requireOption(options, "participant");
  requireOption(options, "authority");
  const at = nowIso();
  const participantId = participantIdFor(options.participant);
  const scope = options.scope || (options.thread ? "thread" : "global");
  const participantAuthorityRevocation = {
    id: options.id || newId("rev", `${participantId}_${options.authority}`),
    object: "participantAuthorityRevocation",
    authorityId: options.authorityId,
    participantId,
    authority: options.authority,
    scope,
    threadId: options.thread,
    revokedBy: participantIdFor(options.actor || options.revokedBy || options.participant),
    revokedAt: at,
    reason: options.reason
  };
  stripUndefined(participantAuthorityRevocation);
  const event = createEvent({
    type: "ParticipantAuthorityRevoked",
    threadId: options.thread || "thd_identity",
    actorId: participantAuthorityRevocation.revokedBy,
    at,
    payload: { participantAuthorityRevocation }
  });
  appendEvent(event, cwd);
  return print({ participantAuthorityRevocation, event });
}

function identityShow(options, cwd) {
  requireOption(options, "participant");
  const events = readValidEventsForOptions(options, cwd);
  const participantId = participantIdFor(options.participant);
  return print(identityForParticipant(buildIdentityState(events), participantId));
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

function provenanceList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const provenance = options.thread
    ? projection.provenance.provenance.filter((record) => record.threadId === options.thread)
    : projection.provenance.provenance;
  return print({
    schema: "clista.provenance.list.v0",
    threadId: options.thread || null,
    count: provenance.length,
    provenance
  });
}

function provenanceShow(options, cwd) {
  const contributionId = options.contribution || options.contributionId || options.id;
  if (!contributionId) {
    throw new Error("Missing required option --contribution");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  if (!isKnownContribution(projection, contributionId)) {
    throw new Error(`Unknown contribution id: ${contributionId}`);
  }
  return print(provenanceForContribution(projection.provenance, contributionId));
}

function provenanceTrace(options, cwd) {
  const contributionId = options.contribution || options.contributionId || options.id;
  if (!contributionId) {
    throw new Error("Missing required option --contribution");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  if (!isKnownContribution(projection, contributionId)) {
    throw new Error(`Unknown contribution id: ${contributionId}`);
  }
  return print(traceProvenance(projection.provenance, contributionId));
}

function provenanceVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.provenance.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.provenance.verify.v0",
    valid: true,
    errors: [],
    provenanceValidationStatus: projection.provenance.provenanceValidationStatus
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
    contentHash: contentHash({
      source: options.source,
      finding: options.finding,
      confidence: numberOption(options.confidence),
      artifactIds: parseList(options.artifacts)
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
    contentHash: contentHash({
      text: options.text,
      status: options.status || "active",
      evidenceIds: parseList(options.evidence),
      confidence: numberOption(options.confidence)
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

function decisionOpen(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "proposal");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const decisionRequest = {
    id: options.id || newId("drq", options.proposal),
    object: "decisionRequest",
    threadId: options.thread,
    proposal: options.proposal,
    status: "review",
    supportingEvidenceIds: parseList(options.evidence || options.supportingEvidence),
    supportingClaimIds: parseList(options.claims || options.supportingClaims),
    supportingAssumptionIds: parseList(options.assumptions || options.supportingAssumptions),
    objectionIds: parseList(options.objections),
    openedByParticipantId: actor.id,
    openedAt: at
  };
  const event = createEvent({
    type: "DecisionRequestOpened",
    threadId: decisionRequest.threadId,
    actorId: actor.id,
    at,
    payload: { decisionRequest }
  });
  appendEvent(event, cwd);
  return print({ decisionRequest, event });
}

function decisionEligibility(options, cwd) {
  requireOption(options, "request");
  const events = readValidEventsForOptions(options, cwd);
  return print(evaluateDecisionEligibility(events, options.request));
}

function reviewSubmit(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "request");
  requireOption(options, "reviewer");
  requireOption(options, "status");
  const reviewer = participantFrom(options.reviewer, options.role || "reviewer", options.kind || "human");
  appendParticipant(reviewer, cwd, options.thread);
  const at = nowIso();
  const review = {
    id: options.id || newId("rev", `${reviewer.name}_${options.status}`),
    object: "review",
    threadId: options.thread,
    decisionRequestId: options.request,
    reviewerParticipantId: reviewer.id,
    status: options.status,
    conditions: parseList(options.conditions),
    comment: options.comment,
    reviewedAt: at
  };
  stripUndefined(review);
  const event = createEvent({
    type: "ReviewSubmitted",
    threadId: review.threadId,
    actorId: reviewer.id,
    at,
    payload: { review }
  });
  appendEvent(event, cwd);
  return print({ review, event });
}

function reviewRequire(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "reason");
  const subjectId = options.subject || options.subjectId || options.id;
  if (!subjectId) {
    throw new Error("Missing required option --subject");
  }
  const subjectType = options.subjectType || options.objectType || inferReviewSubjectType(subjectId);
  const actor = participantFrom(options.requiredBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const protocolReview = buildReviewRequirement({
    id: options.review || options.reviewId || options.id,
    threadId: options.thread,
    subjectType,
    subjectId,
    triggerType: options.trigger || options.triggerType || "state_change",
    triggerEventId: options.triggerEvent || options.triggerEventId,
    reason: options.reason,
    requiredReviewerRole: options.requiredReviewerRole || options.reviewerRole || "reviewer",
    requiredByParticipantId: actor.id,
    requiredAt: at
  });
  const event = createEvent({
    type: "ReviewRequired",
    threadId: protocolReview.threadId,
    actorId: protocolReview.requiredByParticipantId,
    at,
    payload: { protocolReview }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.review.require.v0",
    required: true,
    protocolReview,
    event
  });
}

function reviewOpen(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const requiredReviewId = options.review || options.reviewId;
  const existing = requiredReviewId ? projection.review.byReview[requiredReviewId] : null;
  if (requiredReviewId && !existing) {
    throw new Error(`Unknown protocol review ${requiredReviewId}`);
  }
  const subjectId = existing?.subjectId || options.subject || options.subjectId || options.id;
  if (!subjectId) {
    throw new Error("Missing required option --subject");
  }
  const subjectType = existing?.subjectType || options.subjectType || options.objectType || inferReviewSubjectType(subjectId);
  const threadId = existing?.threadId || options.thread;
  if (!threadId) {
    throw new Error("Missing required option --thread");
  }
  const actor = participantFrom(options.openedBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, threadId);
  const at = nowIso();
  const protocolReview = buildReviewOpening({
    id: existing?.id || options.review || options.reviewId || options.id,
    threadId,
    subjectType,
    subjectId,
    triggerType: existing?.triggerType || options.trigger || options.triggerType || "manual_review",
    triggerEventId: existing?.triggerEventId || options.triggerEvent || options.triggerEventId,
    reason: options.reason || existing?.reason,
    required: existing?.required || booleanOption(options.required, false),
    requiredReviewId: existing?.id || null,
    requiredReviewerRole: existing?.requiredReviewerRole || options.requiredReviewerRole || options.reviewerRole,
    requiredByParticipantId: existing?.requiredByParticipantId || null,
    requiredAt: existing?.requiredAt || null,
    openedByParticipantId: actor.id,
    openedAt: at
  });
  const event = createEvent({
    type: "ReviewOpened",
    threadId: protocolReview.threadId,
    actorId: protocolReview.openedByParticipantId,
    at,
    payload: { protocolReview }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.review.open.v0",
    opened: true,
    protocolReview,
    event
  });
}

function reviewComplete(options, cwd) {
  requireOption(options, "review");
  requireOption(options, "summary");
  const { record } = reviewRecordForCli(options, cwd);
  const actor = participantFrom(options.completedBy || options.reviewer || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const protocolReviewCompletion = buildReviewCompletion({
    id: options.id || options.completion,
    reviewId: record.id,
    threadId: record.threadId,
    summary: options.summary,
    completedByParticipantId: actor.id,
    completedAt: at
  });
  const event = createEvent({
    type: "ReviewCompleted",
    threadId: protocolReviewCompletion.threadId,
    actorId: protocolReviewCompletion.completedByParticipantId,
    at,
    payload: { protocolReviewCompletion }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.review.complete.v0",
    completed: true,
    protocolReviewCompletion,
    event
  });
}

function reviewDispute(options, cwd) {
  requireOption(options, "review");
  requireOption(options, "reason");
  const { record } = reviewRecordForCli(options, cwd);
  const actor = participantFrom(options.disputedBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const protocolReviewDispute = buildReviewDispute({
    id: options.id || options.dispute,
    reviewId: record.id,
    threadId: record.threadId,
    reason: options.reason,
    disputedByParticipantId: actor.id,
    disputedAt: at
  });
  const event = createEvent({
    type: "ReviewDisputed",
    threadId: protocolReviewDispute.threadId,
    actorId: protocolReviewDispute.disputedByParticipantId,
    at,
    payload: { protocolReviewDispute }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.review.dispute.v0",
    disputed: true,
    protocolReviewDispute,
    event
  });
}

function reviewViolation(options, cwd) {
  requireOption(options, "review");
  requireOption(options, "type");
  requireOption(options, "reason");
  const { record } = reviewRecordForCli(options, cwd);
  const actor = participantFrom(options.detectedBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const protocolReviewViolation = buildReviewViolation({
    id: options.id || options.violation,
    reviewId: record.id,
    threadId: record.threadId,
    violationType: options.type || options.violationType,
    reason: options.reason,
    detectedByParticipantId: actor.id,
    detectedAt: at
  });
  const event = createEvent({
    type: "ReviewViolationRecorded",
    threadId: protocolReviewViolation.threadId,
    actorId: protocolReviewViolation.detectedByParticipantId,
    at,
    payload: { protocolReviewViolation }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.review.violation.v0",
    violated: true,
    protocolReviewViolation,
    event
  });
}

function reviewList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let records = projection.review.records;
  if (options.thread) {
    records = records.filter((record) => record.threadId === options.thread);
  }
  if (options.status) {
    records = records.filter((record) => record.status === options.status);
  }
  return print({
    schema: "clista.review.list.v0",
    theorem: projection.review.theorem,
    hardLaw: projection.review.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: records.length,
    records
  });
}

function reviewShow(options, cwd) {
  const reviewId = options.review || options.reviewId || options.id;
  if (!reviewId) {
    throw new Error("Missing required option --review");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(reviewForId(projection.review, reviewId));
}

function reviewVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.review.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.review.verify.v0",
    valid: true,
    errors: [],
    reviewValidationStatus: projection.review.reviewValidationStatus
  });
}

function recoveryRequest(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "subject");
  requireOption(options, "reason");
  const subjectType = options.subjectType || inferRecoverySubjectType(options.subject);
  const actor = participantFrom(options.requestedBy || options.actor || "Recovery Reviewer", options.role || "recovery_requester", options.kind || "human");
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const recoveryRequestRecord = buildRecoveryRequest({
    id: options.recovery || options.recoveryId || options.id,
    threadId: options.thread,
    subjectType,
    subjectId: options.subject,
    reason: options.reason,
    checkpointRef: recoveryCheckpointForCli(options, cwd, options.thread),
    evidence: parseList(options.evidence || options.evidences),
    artifactRef: artifactRefForCli(options),
    requestedByParticipantId: actor.id,
    requestedAt: at
  });
  const event = createEvent({
    type: "RecoveryRequested",
    threadId: recoveryRequestRecord.threadId,
    actorId: recoveryRequestRecord.requestedByParticipantId,
    at,
    payload: { recoveryRequest: recoveryRequestRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.request.v0",
    requested: true,
    recoveryRequest: recoveryRequestRecord,
    event
  });
}

function recoveryPlan(options, cwd) {
  requireOption(options, "recovery");
  requireOption(options, "plan");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const record = projection.recovery.byRecovery[options.recovery];
  if (!record) {
    throw new Error(`Unknown recovery ${options.recovery}`);
  }
  const actor = participantFrom(options.plannedBy || options.actor || "Recovery Reviewer", options.role || "recovery_planner", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  let protocolReview = null;
  let reviewId = options.review || options.reviewId;
  if (!reviewId) {
    protocolReview = appendRecoveryReviewRequirement(cwd, record, actor, {
      triggerType: "recovery_plan",
      reason: options.reviewReason || `Recovery ${record.id} requires review before repair action`,
      at
    });
    reviewId = protocolReview.id;
  }
  const recoveryPlanRecord = buildRecoveryPlan({
    id: options.id || options.planId,
    recoveryId: record.id,
    threadId: record.threadId,
    plan: options.plan,
    reviewId,
    plannedByParticipantId: actor.id,
    plannedAt: at,
    evidence: parseList(options.evidence || options.evidences)
  });
  const event = createEvent({
    type: "RecoveryPlanCreated",
    threadId: recoveryPlanRecord.threadId,
    actorId: recoveryPlanRecord.plannedByParticipantId,
    at,
    payload: { recoveryPlan: recoveryPlanRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.plan.v0",
    planned: true,
    protocolReview,
    recoveryPlan: recoveryPlanRecord,
    event
  });
}

function recoveryQuarantine(options, cwd) {
  requireOption(options, "recovery");
  requireOption(options, "reason");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const { record, plan } = recoveryRecordForCli(projection, options.recovery, options.plan || options.planId);
  const actor = participantFrom(options.quarantinedBy || options.actor || "Recovery Reviewer", options.role || "recovery_quarantiner", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const emergency = booleanOption(options.emergency, false);
  let reviewId = options.review || options.reviewId || plan.reviewId;
  let protocolReview = null;
  if (emergency && (!reviewId || projection.review.byReview[reviewId]?.status === "reviewed")) {
    protocolReview = appendRecoveryReviewRequirement(cwd, record, actor, {
      triggerType: "recovery_quarantine",
      reason: options.reviewReason || `Emergency quarantine for recovery ${record.id} requires pending review`,
      at
    });
    reviewId = protocolReview.id;
  }
  const quarantine = buildRecoveryQuarantine({
    id: options.id || options.quarantine,
    recoveryId: record.id,
    planId: plan.id,
    threadId: record.threadId,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    reason: options.reason,
    reviewId,
    emergency,
    supersedesQuarantineId: options.supersedes,
    quarantinedByParticipantId: actor.id,
    quarantinedAt: at,
    evidence: parseList(options.evidence || options.evidences)
  });
  const event = createEvent({
    type: "RecoveryQuarantined",
    threadId: quarantine.threadId,
    actorId: quarantine.quarantinedByParticipantId,
    at,
    payload: { recoveryQuarantine: quarantine }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.quarantine.v0",
    quarantined: true,
    protocolReview,
    recoveryQuarantine: quarantine,
    event
  });
}

function recoveryApply(options, cwd) {
  requireOption(options, "recovery");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const { record, plan } = recoveryRecordForCli(projection, options.recovery, options.plan || options.planId);
  const reviewId = options.review || options.reviewId || plan.reviewId;
  const review = projection.review.byReview[reviewId];
  if (!review || review.status !== "reviewed") {
    throw new Error(`Recovery apply requires completed M23 review ${reviewId}`);
  }
  const actor = participantFrom(options.appliedBy || options.actor || "Recovery Reviewer", options.role || "recovery_applier", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const application = buildRecoveryApplication({
    id: options.id || options.application,
    recoveryId: record.id,
    planId: plan.id,
    threadId: record.threadId,
    repairSummary: options.summary,
    repairEvidence: parseList(options.evidence || options.evidences),
    reviewId,
    appliedByParticipantId: actor.id,
    appliedAt: at
  });
  const event = createEvent({
    type: "RecoveryApplied",
    threadId: application.threadId,
    actorId: application.appliedByParticipantId,
    at,
    payload: { recoveryApplication: application }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.apply.v0",
    applied: true,
    recoveryApplication: application,
    event
  });
}

function recoveryVerify(options, cwd) {
  if (options.recovery && !options.events) {
    return recoveryVerifyRecord(options, cwd);
  }
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.recovery.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.recovery.verify.v0",
    valid: true,
    errors: [],
    recoveryValidationStatus: projection.recovery.recoveryValidationStatus,
    trusted_state_refs: projection.recovery.trusted_state_refs,
    quarantined_subjects: projection.recovery.quarantined_subjects
  });
}

function recoveryVerifyRecord(options, cwd) {
  requireOption(options, "recovery");
  const events = readValidEventsForOptions(options, cwd);
  const projection = projectEvents(events);
  const { record } = recoveryRecordForCli(projection, options.recovery, options.plan || options.planId);
  const application = options.application
    ? projection.recovery.applicationsByRecovery[record.id]?.find((item) => item.id === options.application)
    : projection.recovery.applicationsByRecovery[record.id]?.at(-1);
  if (!application) {
    throw new Error(`Recovery ${record.id} has no applied repair to verify`);
  }
  const reviewId = options.review || options.reviewId || application.reviewId;
  const review = projection.review.byReview[reviewId];
  if (!review || review.status !== "reviewed") {
    throw new Error(`Recovery verify requires completed M23 review ${reviewId}`);
  }
  const actor = participantFrom(options.verifiedBy || options.actor || "Recovery Reviewer", options.role || "recovery_verifier", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const eventsAfterActor = readValidEventsForOptions(options, cwd);
  const projectionAfterActor = projectEvents(eventsAfterActor);
  const recoveryEvents = eventsAfterActor.filter((event) => RECOVERY_EVENT_TYPES.has(event.event_type));
  const originalHeadHash = eventsAfterActor.at(-1)?.content_hash || null;
  const at = nowIso();
  const verification = buildRecoveryVerification({
    id: options.id || options.verification,
    recoveryId: record.id,
    applicationId: application.id,
    threadId: record.threadId,
    reviewId,
    originalHeadHash,
    recoveryEventPreviousHash: originalHeadHash,
    checkpointHash: record.checkpointHash,
    recoveryLogHash: recoveryLogHash(recoveryEvents),
    restoredProjectionHash: restoredProjectionHash(record.id, projectionAfterActor.recovery),
    restoredStateHash: restoredStateHash(record.id, projectionAfterActor.recovery),
    verificationEvidence: parseList(options.evidence || options.evidences || "recomputed restored recovery state"),
    verifiedByParticipantId: actor.id,
    verifiedAt: at
  });
  const event = createEvent({
    type: "RecoveryVerified",
    threadId: verification.threadId,
    actorId: verification.verifiedByParticipantId,
    at,
    payload: { recoveryVerification: verification }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.verify.record.v0",
    recorded: true,
    recoveryVerification: verification,
    event
  });
}

function recoveryViolation(options, cwd) {
  requireOption(options, "recovery");
  requireOption(options, "type");
  requireOption(options, "reason");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const record = projection.recovery.byRecovery[options.recovery];
  if (!record) {
    throw new Error(`Unknown recovery ${options.recovery}`);
  }
  const actor = participantFrom(options.detectedBy || options.actor || "Recovery Reviewer", options.role || "recovery_detector", options.kind || "human");
  appendParticipant(actor, cwd, record.threadId);
  const at = nowIso();
  const violation = buildRecoveryViolation({
    id: options.id || options.violation,
    recoveryId: record.id,
    threadId: record.threadId,
    violationType: options.type || options.violationType,
    reason: options.reason,
    detectedByParticipantId: actor.id,
    detectedAt: at
  });
  const event = createEvent({
    type: "RecoveryViolationRecorded",
    threadId: violation.threadId,
    actorId: violation.detectedByParticipantId,
    at,
    payload: { recoveryViolation: violation }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.recovery.violation.v0",
    violated: true,
    recoveryViolation: violation,
    event
  });
}

function recoveryList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let records = projection.recovery.records;
  if (options.thread) {
    records = records.filter((record) => record.threadId === options.thread);
  }
  if (options.status) {
    records = records.filter((record) => record.status === options.status);
  }
  return print({
    schema: "clista.recovery.list.v0",
    theorem: projection.recovery.theorem,
    hardLaw: projection.recovery.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: records.length,
    records
  });
}

function recoveryShow(options, cwd) {
  const recoveryId = options.recovery || options.recoveryId || options.id;
  if (!recoveryId) {
    throw new Error("Missing required option --recovery");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(recoveryForId(projection.recovery, recoveryId));
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

function decisionMerge(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "request");
  requireOption(options, "decider");
  const projection = projectEvents(readEvents(cwd));
  const request = projection.decisionRequests[options.request];
  if (!request) {
    throw new Error(`Decision request not found: ${options.request}`);
  }
  const decider = participantFrom(options.decider, options.role || "decision owner", options.kind || "human");
  appendParticipant(decider, cwd, options.thread);
  const at = nowIso();
  const preservedObjectionIds = parseList(options.preserve || options.preservedObjections);
  const reviewIds = Object.values(projection.reviews)
    .filter((review) => review.decisionRequestId === request.id)
    .map((review) => review.id);
  const supportingEvidenceIds = unique([
    ...parseList(options.evidence),
    ...(request.supportingEvidenceIds || [])
  ]);
  const supportingClaimIds = unique([
    ...parseList(options.claims),
    ...(request.supportingClaimIds || [])
  ]);
  const supportingAssumptionIds = unique([
    ...parseList(options.assumptions),
    ...(request.supportingAssumptionIds || [])
  ]);
  const objectionIds = unique([
    ...(request.objectionIds || []),
    ...preservedObjectionIds
  ]);
  const authorityTrail = [{
    participantId: decider.id,
    role: decider.role,
    source: "ParticipantAdded.role"
  }];
  const decisionRecord = {
    id: options.id || newId("dcr", request.proposal),
    object: "decisionRecord",
    threadId: options.thread,
    decisionRequestId: request.id,
    status: options.status || "approved",
    summary: options.summary || request.proposal,
    rationale: options.rationale,
    conditions: parseList(options.conditions),
    supportingEvidenceIds,
    supportingClaimIds,
    supportingAssumptionIds,
    objectionIds,
    reviewIds,
    authorityTrail,
    preservedObjectionIds,
    minorityReportIds: [],
    nextAction: options.next,
    nextReviewAt: options.nextReviewAt,
    decidedByParticipantId: decider.id,
    decidedAt: at,
    contentHash: contentHash({
      requestId: request.id,
      status: options.status || "approved",
      summary: options.summary || request.proposal,
      rationale: options.rationale,
      conditions: parseList(options.conditions),
      supportingEvidenceIds,
      supportingClaimIds,
      supportingAssumptionIds,
      objectionIds,
      reviewIds,
      authorityTrail,
      preservedObjectionIds,
      nextAction: options.next,
      nextReviewAt: options.nextReviewAt
    })
  };
  stripUndefined(decisionRecord);
  const event = createEvent({
    type: "DecisionMerged",
    threadId: decisionRecord.threadId,
    actorId: decider.id,
    at,
    payload: { decisionRecord }
  });
  appendEvent(event, cwd);

  let minorityReport;
  if (options.minorityReport) {
    const participant = participantFrom(options.minorityParticipant || options.participant || "Dissent Agent", "dissent", "agent");
    appendParticipant(participant, cwd, options.thread);
    minorityReport = {
      id: newId("mnr", options.minorityReport),
      object: "minorityReport",
      threadId: options.thread,
      decisionRecordId: decisionRecord.id,
      participantId: participant.id,
      text: options.minorityReport,
      objectionIds: preservedObjectionIds,
      filedAt: nowIso(),
      contentHash: contentHash({
        decisionRecordId: decisionRecord.id,
        participantId: participant.id,
        text: options.minorityReport,
        objectionIds: preservedObjectionIds
      })
    };
    appendEvent(createEvent({
      type: "MinorityReportFiled",
      threadId: options.thread,
      actorId: participant.id,
      at: minorityReport.filedAt,
      payload: { minorityReport }
    }), cwd);
  }

  return print({ decisionRecord, minorityReport, event });
}

function outcomeExpect(options, cwd) {
  if (options.execution) {
    return protocolOutcomeExpect(options, cwd);
  }
  requireOption(options, "thread");
  requireOption(options, "decision");
  requireOption(options, "metric");
  requireOption(options, "operator");
  requireOption(options, "target");
  requireOption(options, "reviewDate");
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const id = options.id || options.expectedOutcomeId || newId("exo", options.metric);
  const expectedOutcome = {
    id,
    expectedOutcomeId: id,
    object: "expectedOutcome",
    threadId: options.thread,
    decisionRecordId: options.decision,
    metric: options.metric,
    operator: options.operator,
    target: scalarOption(options.target),
    reviewDate: options.reviewDate,
    assumptionIds: parseList(options.assumptions),
    evidenceIds: parseList(options.evidence),
    description: options.description,
    declaredByParticipantId: actor.id,
    declaredAt: at,
    contentHash: contentHash({
      decisionRecordId: options.decision,
      metric: options.metric,
      operator: options.operator,
      target: scalarOption(options.target),
      reviewDate: options.reviewDate,
      assumptionIds: parseList(options.assumptions),
      evidenceIds: parseList(options.evidence),
      description: options.description
    })
  };
  stripUndefined(expectedOutcome);
  const event = createEvent({
    type: "ExpectedOutcomeDeclared",
    threadId: expectedOutcome.threadId,
    actorId: actor.id,
    at,
    payload: { expectedOutcome }
  });
  appendEvent(event, cwd);
  return print({ expectedOutcome, event });
}

function protocolOutcomeExpect(options, cwd) {
  requireOption(options, "execution");
  const expectedEffect = options.expectedEffect || options.effect;
  if (!expectedEffect) {
    throw new Error("Missing required option --expected-effect");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const execution = projection.execution.byExecution[options.execution];
  if (!execution) {
    throw new Error(`Unknown execution ${options.execution}`);
  }
  const actor = options.actor ? participantFrom(options.actor, options.role || "outcome_author") : null;
  if (actor) {
    appendParticipant(actor, cwd, execution.threadId);
  }
  const actorId = actor?.id || execution.actorId;
  const at = nowIso();
  const outcomeRecord = buildOutcomeExpectation({
    id: options.id || options.outcome,
    executionId: execution.id,
    threadId: execution.threadId,
    actorId,
    expectedEffect,
    evidence: parseList(options.evidence),
    createdAt: at
  });
  const event = createEvent({
    type: "OutcomeExpected",
    threadId: outcomeRecord.threadId,
    actorId: outcomeRecord.actorId,
    at,
    payload: { outcomeRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome.expect.v0",
    expected: true,
    outcomeRecord,
    event
  });
}

function outcomeObserve(options, cwd) {
  requireOption(options, "outcome");
  requireOption(options, "evidence");
  const observedEffect = options.observedEffect || options.effect;
  if (!observedEffect) {
    throw new Error("Missing required option --observed-effect");
  }
  const { record } = outcomeRecordForCli(options, cwd);
  const observer = options.observer || options.actor
    ? participantFrom(options.observer || options.actor, options.role || "outcome_observer")
    : null;
  if (observer) {
    appendParticipant(observer, cwd, record.threadId);
  }
  const actorId = observer?.id || record.actorId;
  const at = nowIso();
  const outcomeRecord = buildOutcomeObservation({
    id: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    actorId,
    expectedEffect: record.expectedEffect,
    observedEffect,
    evidence: parseList(options.evidence),
    observedAt: at
  });
  const event = createEvent({
    type: "OutcomeObserved",
    threadId: outcomeRecord.threadId,
    actorId: outcomeRecord.actorId,
    at,
    payload: { outcomeRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome.observe.v0",
    observed: true,
    outcomeRecord,
    event
  });
}

function outcomeEvaluate(options, cwd) {
  requireOption(options, "outcome");
  requireOption(options, "result");
  requireOption(options, "comparison");
  requireOption(options, "evidence");
  const { projection, record } = outcomeRecordForCli(options, cwd);
  const observation = projection.outcome.observationsByOutcome[record.id]?.at(-1);
  if (!observation) {
    throw new Error(`Outcome ${record.id} has not been observed`);
  }
  const evaluator = options.evaluator || options.actor
    ? participantFrom(options.evaluator || options.actor, options.role || "outcome_evaluator")
    : null;
  if (evaluator) {
    appendParticipant(evaluator, cwd, record.threadId);
  }
  const evaluatorId = evaluator?.id || record.actorId;
  const at = nowIso();
  const outcomeRecord = buildOutcomeEvaluation({
    id: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    actorId: evaluatorId,
    expectedEffect: record.expectedEffect,
    observedEffect: observation.observedEffect,
    evidence: parseList(options.evidence),
    evaluationResult: options.result,
    comparison: options.comparison,
    confidence: options.confidence,
    evaluatedByParticipantId: evaluatorId,
    evaluatedAt: at
  });
  const event = createEvent({
    type: "OutcomeEvaluated",
    threadId: outcomeRecord.threadId,
    actorId: outcomeRecord.actorId,
    at,
    payload: { outcomeRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome.evaluate.v0",
    evaluated: true,
    outcomeRecord,
    event
  });
}

function outcomeDispute(options, cwd) {
  requireOption(options, "outcome");
  requireOption(options, "reason");
  const { record } = outcomeRecordForCli(options, cwd);
  const disputer = options.disputer || options.actor
    ? participantFrom(options.disputer || options.actor, options.role || "outcome_disputer")
    : null;
  if (disputer) {
    appendParticipant(disputer, cwd, record.threadId);
  }
  const disputerId = disputer?.id || record.actorId;
  const at = nowIso();
  const outcomeDisputeRecord = buildOutcomeDispute({
    id: options.id || options.dispute,
    outcomeId: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    reason: options.reason,
    disputedByParticipantId: disputerId,
    disputedAt: at
  });
  const event = createEvent({
    type: "OutcomeDisputed",
    threadId: outcomeDisputeRecord.threadId,
    actorId: outcomeDisputeRecord.disputedByParticipantId,
    at,
    payload: { outcomeDispute: outcomeDisputeRecord }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome.dispute.v0",
    disputed: true,
    outcomeDispute: outcomeDisputeRecord,
    event
  });
}

function outcomeList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let records = projection.outcome.records;
  if (options.thread) {
    records = records.filter((record) => record.threadId === options.thread);
  }
  if (options.status) {
    records = records.filter((record) => record.status === options.status);
  }
  return print({
    schema: "clista.outcome.list.v0",
    theorem: projection.outcome.theorem,
    hardLaw: projection.outcome.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: records.length,
    records
  });
}

function outcomeShow(options, cwd) {
  const outcomeId = options.outcome || options.outcomeId || options.id;
  if (!outcomeId) {
    throw new Error("Missing required option --outcome");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(outcomeForId(projection.outcome, outcomeId));
}

function outcomeVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.outcome.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.outcome.verify.v0",
    valid: true,
    errors: [],
    outcomeValidationStatus: projection.outcome.outcomeValidationStatus
  });
}

function outcomeLearningDerive(options, cwd) {
  requireOption(options, "outcome");
  requireOption(options, "lesson");
  const { projection, record } = outcomeRecordForCli(options, cwd);
  const evaluation = projection.outcome.evaluationsByOutcome[record.id]?.at(-1);
  if (!evaluation) {
    throw new Error(`Outcome ${record.id} has not been evaluated`);
  }
  const actorId = outcomeLearningActorId(
    options,
    cwd,
    record.threadId,
    evaluation.evaluatedByParticipantId || record.actorId,
    "outcome_learning_deriver"
  );
  const at = nowIso();
  const evidence = parseList(options.evidence || options.evidences);
  const signal = buildOutcomeLearningSignal({
    id: options.id || options.learning || options.signal,
    outcomeId: record.id,
    executionId: record.executionId,
    threadId: record.threadId,
    evaluationResult: evaluation.evaluationResult,
    lesson: options.lesson,
    confirmedAssumptionIds: parseList(options.confirmedAssumption || options.confirmedAssumptions),
    failedAssumptionIds: parseList(options.failedAssumption || options.failedAssumptions),
    recommendedConstraints: parseList(options.constraint || options.constraints),
    recommendedAmendments: parseList(
      options.amendmentRecommendation || options.amendmentRecommendations || options.amendment
    ),
    evidence: evidence.length ? evidence : evaluation.evidence,
    confidence: options.confidence || "medium",
    sourceOutcomeHash: evaluation.outcomeHash,
    derivedByParticipantId: actorId,
    derivedAt: at
  });
  const event = createEvent({
    type: "LearningSignalDerived",
    threadId: signal.threadId,
    actorId: signal.derivedByParticipantId,
    at,
    payload: { outcomeLearningSignal: signal }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome_learning.derive.v0",
    derived: true,
    outcomeLearningSignal: signal,
    event
  });
}

function outcomeLearningLesson(options, cwd) {
  requireOption(options, "signal");
  requireOption(options, "lesson");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const signal = projection.outcomeLearning.bySignal[options.signal];
  if (!signal) {
    throw new Error(`Unknown outcome learning signal ${options.signal}`);
  }
  const actorId = outcomeLearningActorId(
    options,
    cwd,
    signal.threadId,
    signal.derivedByParticipantId,
    "outcome_lesson_recorder"
  );
  const at = nowIso();
  const evidence = parseList(options.evidence || options.evidences);
  const lesson = buildOutcomeLesson({
    id: options.id || options.lessonId,
    learningSignalId: signal.id,
    outcomeId: signal.outcomeId,
    executionId: signal.executionId,
    threadId: signal.threadId,
    lesson: options.lesson,
    evidence: evidence.length ? evidence : signal.evidence,
    recordedByParticipantId: actorId,
    recordedAt: at
  });
  const event = createEvent({
    type: "LessonRecorded",
    threadId: lesson.threadId,
    actorId: lesson.recordedByParticipantId,
    at,
    payload: { outcomeLesson: lesson }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome_learning.lesson.v0",
    recorded: true,
    outcomeLesson: lesson,
    event
  });
}

function outcomeLearningDispute(options, cwd) {
  requireOption(options, "learning");
  requireOption(options, "reason");
  const { target } = outcomeLearningRecordForCli(options, cwd);
  const actorId = outcomeLearningActorId(
    options,
    cwd,
    target.threadId,
    target.derivedByParticipantId || target.recordedByParticipantId,
    "outcome_learning_disputer"
  );
  const at = nowIso();
  const dispute = buildOutcomeLearningDispute({
    id: options.id || options.dispute,
    learningId: target.id,
    outcomeId: target.outcomeId,
    executionId: target.executionId,
    threadId: target.threadId,
    reason: options.reason,
    disputedByParticipantId: actorId,
    disputedAt: at
  });
  const event = createEvent({
    type: "LearningDisputed",
    threadId: dispute.threadId,
    actorId: dispute.disputedByParticipantId,
    at,
    payload: { outcomeLearningDispute: dispute }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome_learning.dispute.v0",
    disputed: true,
    outcomeLearningDispute: dispute,
    event
  });
}

function outcomeLearningViolation(options, cwd) {
  requireOption(options, "learning");
  requireOption(options, "type");
  requireOption(options, "reason");
  const { target } = outcomeLearningRecordForCli(options, cwd);
  const actorId = outcomeLearningActorId(
    options,
    cwd,
    target.threadId,
    target.derivedByParticipantId || target.recordedByParticipantId,
    "outcome_learning_detector"
  );
  const at = nowIso();
  const violation = buildOutcomeLearningViolation({
    id: options.id || options.violation,
    learningId: target.id,
    outcomeId: target.outcomeId,
    executionId: target.executionId,
    threadId: target.threadId,
    violationType: options.type || options.violationType,
    reason: options.reason,
    detectedByParticipantId: actorId,
    detectedAt: at
  });
  const event = createEvent({
    type: "LearningViolationRecorded",
    threadId: violation.threadId,
    actorId: violation.detectedByParticipantId,
    at,
    payload: { outcomeLearningViolation: violation }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.outcome_learning.violation.v0",
    violated: true,
    outcomeLearningViolation: violation,
    event
  });
}

function outcomeLearningList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let signals = projection.outcomeLearning.signals;
  if (options.thread) {
    signals = signals.filter((signal) => signal.threadId === options.thread);
  }
  return print({
    schema: "clista.outcome_learning.list.v0",
    theorem: projection.outcomeLearning.theorem,
    hardLaw: projection.outcomeLearning.hardLaw,
    threadId: options.thread || null,
    count: signals.length,
    signals
  });
}

function outcomeLearningShow(options, cwd) {
  const learningId = options.learning || options.learningId || options.id;
  if (!learningId) {
    throw new Error("Missing required option --learning");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(outcomeLearningForId(projection.outcomeLearning, learningId));
}

function outcomeLearningVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.outcome_learning.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.outcome_learning.verify.v0",
    valid: true,
    errors: [],
    outcomeLearningValidationStatus: projection.outcomeLearning.outcomeLearningValidationStatus
  });
}

function outcomeAudit(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "expected");
  requireOption(options, "actual");
  requireOption(options, "result");
  requireOption(options, "summary");
  requireOption(options, "auditor");
  const projection = projectEvents(readEvents(cwd));
  const expectedOutcome = projection.expectedOutcomes[options.expected];
  const decisionRecordId = options.decision || expectedOutcome?.decisionRecordId;
  if (!decisionRecordId) {
    throw new Error(`Decision record not found for expected outcome: ${options.expected}`);
  }
  const auditor = participantFrom(options.auditor, options.role || "auditor", options.kind || "human");
  appendParticipant(auditor, cwd, options.thread);
  const at = nowIso();
  const id = options.id || options.outcomeAuditId || newId("out", options.expected);
  const outcomeAudit = {
    id,
    outcomeAuditId: id,
    object: "outcomeAudit",
    threadId: options.thread,
    decisionRecordId,
    expectedOutcomeId: options.expected,
    actual: scalarOption(options.actual),
    result: options.result,
    summary: options.summary,
    failedAssumptionIds: parseList(options.failedAssumptions || options.failedAssumptionIds),
    failedEvidenceIds: parseList(options.failedEvidence || options.failedEvidenceIds),
    auditedBy: auditor.id,
    auditedByParticipantId: auditor.id,
    auditedAt: at,
    contentHash: contentHash({
      decisionRecordId,
      expectedOutcomeId: options.expected,
      actual: scalarOption(options.actual),
      result: options.result,
      summary: options.summary,
      failedAssumptionIds: parseList(options.failedAssumptions || options.failedAssumptionIds),
      failedEvidenceIds: parseList(options.failedEvidence || options.failedEvidenceIds),
      auditedBy: auditor.id
    })
  };
  stripUndefined(outcomeAudit);
  const event = createEvent({
    type: "OutcomeAudited",
    threadId: outcomeAudit.threadId,
    actorId: auditor.id,
    at,
    payload: { outcomeAudit }
  });
  appendEvent(event, cwd);
  return print({ outcomeAudit, event });
}

function decisionScore(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "decision");
  requireOption(options, "score");
  requireOption(options, "status");
  requireOption(options, "rationale");
  requireOption(options, "audits");
  const scorer = participantFrom(options.scorer || options.actor || "Evaluator", options.role || "auditor", options.kind || "human");
  appendParticipant(scorer, cwd, options.thread);
  const at = nowIso();
  const decisionScore = {
    id: options.id || newId("dsc", options.decision),
    object: "decisionScore",
    threadId: options.thread,
    decisionRecordId: options.decision,
    score: numberOption(options.score),
    status: options.status,
    rationale: options.rationale,
    basedOnOutcomeAuditIds: parseList(options.audits || options.basedOnOutcomeAuditIds),
    scoredByParticipantId: scorer.id,
    scoredAt: at,
    contentHash: contentHash({
      decisionRecordId: options.decision,
      score: numberOption(options.score),
      status: options.status,
      rationale: options.rationale,
      basedOnOutcomeAuditIds: parseList(options.audits || options.basedOnOutcomeAuditIds)
    })
  };
  stripUndefined(decisionScore);
  const event = createEvent({
    type: "DecisionScored",
    threadId: decisionScore.threadId,
    actorId: scorer.id,
    at,
    payload: { decisionScore }
  });
  appendEvent(event, cwd);
  return print({ decisionScore, event });
}

function stateShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(selectThreadState(projection, options.thread));
}

function auditShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(selectAudit(projection, options.thread));
}

function decisionSummary(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const summary = selectDecisionSummary(projection, options.thread);
  const fmt = (options.format || "").toLowerCase();
  if (fmt === "text" || fmt === "md" || fmt === "markdown") {
    const text = formatDecisionSummaryAsText(summary);
    process.stdout.write(text + (text.endsWith("\n") ? "" : "\n"));
    return;
  }
  return print(summary);
}

function formatDecisionSummaryAsText(s) {
  if (s.error) {
    return `Decision Summary Error: ${s.error} (thread ${s.threadId || "unknown"})`;
  }
  // Always render all four questions, with an explicit fallback when a section
  // is empty, so the answer view is consistent and never shows a bare heading.
  const lines = [];
  lines.push(`# ${s.title || "Decision Summary"}`);
  lines.push(`Thread: ${s.threadId}`);
  lines.push(`Question: ${s.question}`);
  lines.push(`Status: ${s.status}`);

  lines.push("", "## What was decided");
  if (s.whatWasDecided) {
    if (s.whatWasDecided.status) lines.push(`Status: ${s.whatWasDecided.status}`);
    if (s.whatWasDecided.summary) lines.push(`Summary: ${s.whatWasDecided.summary}`);
    if (s.whatWasDecided.decidedBy) lines.push(`Decided by: ${s.whatWasDecided.decidedBy}`);
    if (s.whatWasDecided.proposal) lines.push(`Proposal: ${s.whatWasDecided.proposal}`);
  } else {
    lines.push("Not yet decided.");
  }

  lines.push("", "## Why");
  const why = s.why || {};
  let wroteWhy = false;
  if (why.rationale) { lines.push(`Rationale: ${why.rationale}`); wroteWhy = true; }
  if (why.supportingEvidence?.length) {
    lines.push("Supporting evidence:");
    for (const e of why.supportingEvidence) lines.push(`- [${e.id}] ${e.finding || e.source}`);
    wroteWhy = true;
  }
  if (why.supportingClaims?.length) {
    lines.push("Supporting claims:");
    for (const c of why.supportingClaims) lines.push(`- [${c.id}] ${c.text}`);
    wroteWhy = true;
  }
  if (why.supportingAssumptions?.length) {
    lines.push("Supporting assumptions:");
    for (const a of why.supportingAssumptions) lines.push(`- [${a.id}] ${a.text}`);
    wroteWhy = true;
  }
  if (!wroteWhy) lines.push("No rationale or support recorded.");

  lines.push("", "## Who dissented");
  const dissent = s.whoDissented || {};
  let wroteDissent = false;
  if (dissent.objections?.length) {
    lines.push("Objections:");
    for (const o of dissent.objections) {
      const block = o.blocking ? " (blocking)" : "";
      lines.push(`- [${o.id}] ${o.raisedBy || "?"}: ${o.text}${block}`);
    }
    wroteDissent = true;
  }
  if (dissent.minorityReports?.length) {
    lines.push("Minority reports:");
    for (const m of dissent.minorityReports) {
      lines.push(`- [${m.id}] ${m.filedBy}: ${m.text}`);
    }
    wroteDissent = true;
  }
  if (!wroteDissent) lines.push("None recorded.");

  lines.push("", "## What next");
  lines.push(s.whatNext || "No next action recorded.");

  return lines.join("\n");
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

function mergeOpen(options, cwd) {
  requireOption(options, "source");
  requireOption(options, "target");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const proposed = directProposalIds(projection, options.source);
  const actor = participantFrom(options.openedBy || options.actor || "Author", options.role);
  appendParticipant(actor, cwd, options.target);
  const at = nowIso();
  const id = options.id || options.mergeRequestId || newId("mrg", options.summary);
  const mergeRequest = {
    id,
    mergeRequestId: id,
    object: "mergeRequest",
    threadId: options.target,
    sourceForkThreadId: options.source,
    targetThreadId: options.target,
    openedBy: actor.id,
    openedAt: at,
    summary: options.summary,
    status: "review",
    proposedAssumptionIds: parseList(options.assumptions || options.proposedAssumptions),
    proposedEvidenceIds: parseList(options.evidence || options.proposedEvidence),
    proposedClaimIds: parseList(options.claims || options.proposedClaims),
    proposedObjectionIds: parseList(options.objections || options.proposedObjections),
    proposedDecisionRecordIds: parseList(options.decisions || options.proposedDecisions)
  };
  applyDefaultProposedIds(mergeRequest, proposed);
  mergeRequest.contentHash = contentHash({
    sourceForkThreadId: mergeRequest.sourceForkThreadId,
    targetThreadId: mergeRequest.targetThreadId,
    openedBy: mergeRequest.openedBy,
    openedAt: mergeRequest.openedAt,
    summary: mergeRequest.summary,
    proposedAssumptionIds: mergeRequest.proposedAssumptionIds,
    proposedEvidenceIds: mergeRequest.proposedEvidenceIds,
    proposedClaimIds: mergeRequest.proposedClaimIds,
    proposedObjectionIds: mergeRequest.proposedObjectionIds,
    proposedDecisionRecordIds: mergeRequest.proposedDecisionRecordIds
  });
  const event = createEvent({
    type: "MergeRequestOpened",
    threadId: mergeRequest.targetThreadId,
    actorId: actor.id,
    at,
    payload: { mergeRequest }
  });
  appendEvent(event, cwd);
  return print({ mergeRequest, event });
}

function mergeReview(options, cwd) {
  requireOption(options, "request");
  requireOption(options, "status");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const request = projection.mergeRequests[options.request];
  if (!request) {
    throw new Error(`Merge request not found: ${options.request}`);
  }
  const reviewer = participantFrom(options.reviewer || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(reviewer, cwd, request.targetThreadId);
  const at = nowIso();
  const mergeReview = {
    id: options.id || newId("mrv", `${reviewer.name}_${options.status}`),
    object: "mergeReview",
    threadId: request.targetThreadId,
    mergeRequestId: request.id,
    reviewerId: reviewer.id,
    reviewerParticipantId: reviewer.id,
    status: options.status,
    summary: options.summary,
    requiredChanges: parseList(options.requiredChanges || options.changes),
    reviewedAt: at,
    contentHash: contentHash({
      mergeRequestId: request.id,
      reviewerId: reviewer.id,
      status: options.status,
      summary: options.summary,
      requiredChanges: parseList(options.requiredChanges || options.changes)
    })
  };
  stripUndefined(mergeReview);
  const event = createEvent({
    type: "MergeReviewSubmitted",
    threadId: mergeReview.threadId,
    actorId: reviewer.id,
    at,
    payload: { mergeReview }
  });
  appendEvent(event, cwd);
  return print({ mergeReview, event });
}

function mergeConflictDeclare(options, cwd) {
  requireOption(options, "request");
  requireOption(options, "type");
  requireOption(options, "parent");
  requireOption(options, "fork");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const request = projection.mergeRequests[options.request];
  if (!request) {
    throw new Error(`Merge request not found: ${options.request}`);
  }
  const actor = participantFrom(options.declaredBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, request.targetThreadId);
  const at = nowIso();
  const id = options.id || options.conflictId || newId("cnf", options.summary);
  const mergeConflict = {
    id,
    conflictId: id,
    object: "mergeConflict",
    threadId: request.targetThreadId,
    mergeRequestId: request.id,
    conflictType: options.type,
    parentObjectId: options.parent,
    forkObjectId: options.fork,
    summary: options.summary,
    status: "open",
    declaredBy: actor.id,
    declaredAt: at,
    contentHash: contentHash({
      mergeRequestId: request.id,
      conflictType: options.type,
      parentObjectId: options.parent,
      forkObjectId: options.fork,
      summary: options.summary,
      declaredBy: actor.id
    })
  };
  const event = createEvent({
    type: "MergeConflictDeclared",
    threadId: mergeConflict.threadId,
    actorId: actor.id,
    at,
    payload: { mergeConflict }
  });
  appendEvent(event, cwd);
  return print({ mergeConflict, event });
}

function mergeConflictResolve(options, cwd) {
  requireOption(options, "request");
  requireOption(options, "conflict");
  requireOption(options, "resolution");
  requireOption(options, "rationale");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const request = projection.mergeRequests[options.request];
  if (!request) {
    throw new Error(`Merge request not found: ${options.request}`);
  }
  const actor = participantFrom(options.resolvedBy || options.actor || "Reviewer", options.role || "reviewer", options.kind || "human");
  appendParticipant(actor, cwd, request.targetThreadId);
  const at = nowIso();
  const mergeConflictResolution = {
    id: options.id || newId("mcr", options.conflict),
    object: "mergeConflictResolution",
    threadId: request.targetThreadId,
    mergeRequestId: request.id,
    conflictId: options.conflict,
    resolution: options.resolution,
    rationale: options.rationale,
    resolvedBy: actor.id,
    resolvedAt: at,
    contentHash: contentHash({
      mergeRequestId: request.id,
      conflictId: options.conflict,
      resolution: options.resolution,
      rationale: options.rationale,
      resolvedBy: actor.id
    })
  };
  const event = createEvent({
    type: "MergeConflictResolved",
    threadId: mergeConflictResolution.threadId,
    actorId: actor.id,
    at,
    payload: { mergeConflictResolution }
  });
  appendEvent(event, cwd);
  return print({ mergeConflictResolution, event });
}

function mergeEligibility(options, cwd) {
  requireOption(options, "request");
  const events = readValidEventsForOptions(options, cwd);
  const projection = projectEvents(events);
  return print({
    ...evaluateMergeEligibility(events, options.request),
    mergeRequestState: selectMergeRequestState(projection, options.request)
  });
}

function mergeComplete(options, cwd) {
  requireOption(options, "request");
  const events = readValidEventsForOptions(options, cwd);
  const projection = projectEvents(events);
  const request = projection.mergeRequests[options.request];
  if (!request) {
    throw new Error(`Merge request not found: ${options.request}`);
  }
  const merger = participantFrom(options.mergedBy || options.actor || "Decision Owner", options.role || "decision owner", options.kind || "human");
  appendParticipant(merger, cwd, request.targetThreadId);
  const eligibilityEvents = readEvents(cwd);
  const at = nowIso();
  const acceptedObjectIds = parseList(options.accept || options.acceptedObjects);
  const rejectedObjectIds = parseList(options.reject || options.rejectedObjects);
  const preservedObjectionIds = parseList(options.preserve || options.preservedObjections);
  const defaultAcceptedObjectIds = unique([
    ...(request.proposedAssumptionIds || []),
    ...(request.proposedEvidenceIds || []),
    ...(request.proposedClaimIds || []),
    ...(request.proposedDecisionRecordIds || [])
  ]);
  const authorityTrail = [{
    participantId: merger.id,
    role: merger.role,
    source: "ParticipantAdded.role"
  }];
  const mergeCompletion = {
    id: options.id || newId("mcm", request.id),
    object: "mergeCompletion",
    threadId: request.targetThreadId,
    mergeRequestId: request.id,
    mergedBy: merger.id,
    mergedAt: at,
    acceptedObjectIds: acceptedObjectIds.length ? acceptedObjectIds : defaultAcceptedObjectIds,
    preservedObjectionIds: preservedObjectionIds.length ? preservedObjectionIds : (request.proposedObjectionIds || []),
    rejectedObjectIds,
    authorityTrail,
    contentHash: contentHash({
      mergeRequestId: request.id,
      mergedBy: merger.id,
      mergedAt: at,
      acceptedObjectIds: acceptedObjectIds.length ? acceptedObjectIds : defaultAcceptedObjectIds,
      preservedObjectionIds: preservedObjectionIds.length ? preservedObjectionIds : (request.proposedObjectionIds || []),
      rejectedObjectIds,
      authorityTrail
    })
  };
  const event = createEvent({
    type: "MergeCompleted",
    threadId: mergeCompletion.threadId,
    actorId: merger.id,
    at,
    payload: { mergeCompletion }
  });
  const eligibility = evaluateMergeEligibility(eligibilityEvents, request.id, {
    actorId: merger.id,
    completion: mergeCompletion,
    eventId: event.event_id
  });
  appendEvent(event, cwd);
  return print({
    mergeCompletion,
    eligibility,
    event
  });
}

function directProposalIds(projection, threadId) {
  return {
    proposedAssumptionIds: directIds(projection.assumptions, threadId),
    proposedEvidenceIds: directIds(projection.evidence, threadId),
    proposedClaimIds: directIds(projection.claims, threadId),
    proposedObjectionIds: directIds(projection.objections, threadId),
    proposedDecisionRecordIds: directIds(projection.decisionRecords, threadId)
  };
}

function directIds(collection, threadId) {
  return Object.values(collection)
    .filter((object) => object.threadId === threadId)
    .map((object) => object.id);
}

function applyDefaultProposedIds(mergeRequest, proposed) {
  for (const key of [
    "proposedAssumptionIds",
    "proposedEvidenceIds",
    "proposedClaimIds",
    "proposedObjectionIds",
    "proposedDecisionRecordIds"
  ]) {
    if (!mergeRequest[key].length) {
      mergeRequest[key] = proposed[key];
    }
  }
}

function assumptionsList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const state = selectThreadState(projection, options.thread);
  return print(state.error ? state : state.assumptions);
}

function exportShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(exportProtocol(projection));
}

// `run report` is the last mile of an external debate-pack run: validate the
// completed event log, package it for submission, and print exactly where and
// how to report it so the run can count toward the EXTERNAL-RUNS gate
// (pack/GATES.md). It fails closed on an invalid log and keeps trusted:false —
// a clean report means the log is well-formed and reportable, never that the
// decision was good or that the run "counts". Only blind external judging
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

function federationRecord(options, cwd) {
  requireOption(options, "thread");
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = federationResultFromCli(packet, options);
  if (!result.valid) {
    print(result);
    process.exitCode = 1;
    return;
  }
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const reference = buildFederatedStateReference(packet, result, {
    id: options.id,
    threadId: options.thread,
    peerId: options.peer || options.peerId,
    remoteContextId: options.context || options.contextId || options.remoteContext,
    summary: options.summary,
    recordedBy: actor.id,
    recordedAt: at,
    verifiedAt: at
  });
  const event = createEvent({
    type: "FederatedStateReferenceRecorded",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { federatedStateReference: reference }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.federation.record.v0",
    recorded: true,
    federatedStateReference: reference,
    federation: result,
    event
  });
}

function federationCheck(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = federationResultFromCli(packet, options);
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function federationList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let references = projection.federation.references;
  if (options.thread) {
    references = references.filter((reference) => reference.threadId === options.thread);
  }
  if (options.status) {
    references = references.filter((reference) => reference.status === options.status);
  }
  return print({
    schema: "clista.federation.list.v0",
    theorem: projection.federation.theorem,
    hardLaw: projection.federation.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: references.length,
    references
  });
}

function federationShow(options, cwd) {
  const federationId = options.federation || options.federationId || options.id;
  if (!federationId) {
    throw new Error("Missing required option --federation");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(federationForId(projection.federation, federationId));
}

function federationVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.federation.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.federation.verify.v0",
    valid: true,
    errors: [],
    federationValidationStatus: projection.federation.federationValidationStatus
  });
}

function negotiationPropose(options, cwd) {
  requireOption(options, "thread");
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = negotiationResultFromCli(packet, options);
  if (!result.valid) {
    print(result);
    process.exitCode = 1;
    return;
  }
  const actor = participantFrom(options.actor || options.participant || "Author", options.role);
  appendParticipant(actor, cwd, options.thread);
  const at = nowIso();
  const request = buildNegotiationRequest(packet, result, {
    id: options.id || options.negotiation,
    threadId: options.thread,
    requestedBy: actor.id,
    requestedAt: at,
    summary: options.summary
  });
  const requestEvent = createEvent({
    type: "NegotiationRequested",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { negotiationRequest: request }
  });
  appendEvent(requestEvent, cwd);

  const differenceRecords = buildNegotiationDifferenceRecords(packet, result, {
    negotiationId: request.id,
    threadId: options.thread,
    recordedBy: actor.id,
    recordedAt: at
  });
  const differenceEvents = differenceRecords.map((negotiationDifference) => createEvent({
    type: "NegotiationDifferenceRecorded",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { negotiationDifference }
  }));
  for (const event of differenceEvents) {
    appendEvent(event, cwd);
  }

  const terms = buildNegotiationTerms(packet, result, {
    id: options.termsId,
    negotiationId: request.id,
    threadId: options.thread,
    status: "proposed",
    summary: options.terms || options.summary,
    proposedBy: actor.id,
    proposedAt: at
  });
  const termsEvent = createEvent({
    type: "NegotiationTermsProposed",
    threadId: options.thread,
    actorId: actor.id,
    at,
    payload: { negotiationTerms: terms }
  });
  appendEvent(termsEvent, cwd);

  return print({
    schema: "clista.negotiation.propose.v0",
    proposed: true,
    negotiationRequest: request,
    negotiationDifferences: differenceRecords,
    negotiationTerms: terms,
    negotiation: result,
    events: [requestEvent, ...differenceEvents, termsEvent]
  });
}

function negotiationCheck(options, cwd) {
  const packet = readContinuityPacketForOptions(options, cwd);
  const result = negotiationResultFromCli(packet, options);
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function negotiationList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let terms = projection.negotiation.terms;
  if (options.thread) {
    terms = terms.filter((term) => term.threadId === options.thread);
  }
  if (options.status) {
    terms = terms.filter((term) => term.status === options.status);
  }
  return print({
    schema: "clista.negotiation.list.v0",
    theorem: projection.negotiation.theorem,
    hardLaw: projection.negotiation.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    requestCount: projection.negotiation.requests.length,
    differenceCount: projection.negotiation.differences.length,
    count: terms.length,
    terms
  });
}

function negotiationShow(options, cwd) {
  const negotiationId = options.negotiation || options.negotiationId || options.id;
  if (!negotiationId) {
    throw new Error("Missing required option --negotiation");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(negotiationForId(projection.negotiation, negotiationId));
}

function negotiationVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.negotiation.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.negotiation.verify.v0",
    valid: true,
    errors: [],
    negotiationValidationStatus: projection.negotiation.negotiationValidationStatus
  });
}

function delegationGrant(options, cwd) {
  requireOption(options, "thread");
  requireOption(options, "delegate");
  requireOption(options, "action");
  requireOption(options, "scope");
  requireOption(options, "limit");
  const delegator = participantFrom(options.delegator || options.actor || "Author", "decision_owner");
  const delegateType = normalizeDelegateTypeForCli(options.delegateType || "participant");
  const delegate = participantFrom(
    options.delegate,
    options.delegateRole || defaultDelegateRoleForType(delegateType),
    options.delegateKind || defaultDelegateKindForType(delegateType)
  );
  appendParticipant(delegator, cwd, options.thread);
  appendParticipant(delegate, cwd, options.thread);
  const at = nowIso();
  const grant = buildDelegationGrant({
    id: options.id || options.delegation,
    threadId: options.thread,
    delegatorParticipantId: delegator.id,
    delegateId: delegate.id,
    delegateType,
    action: options.action,
    scope: options.scope,
    limits: parseList(options.limit || options.limits),
    expiresAt: options.expiresAt || options.expires,
    summary: options.summary,
    grantedAt: at
  });
  const event = createEvent({
    type: "DelegationGranted",
    threadId: options.thread,
    actorId: delegator.id,
    at,
    payload: { delegationGrant: grant }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.delegation.grant.v0",
    granted: true,
    delegationGrant: grant,
    event
  });
}

function delegationRecord(options, cwd) {
  requireOption(options, "delegation");
  requireOption(options, "summary");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const grant = projection.delegation.byGrant[options.delegation];
  if (!grant) {
    throw new Error(`Unknown delegation ${options.delegation}`);
  }
  const at = nowIso();
  const action = buildDelegatedAction({
    id: options.id || options.actionId,
    delegationId: grant.id,
    threadId: grant.threadId,
    delegateId: grant.delegateId,
    delegateType: grant.delegateType,
    action: options.action || grant.action,
    scope: options.scope || grant.scope,
    targetObjectType: options.targetType || options.targetObjectType,
    targetObjectId: options.target || options.targetObjectId,
    summary: options.summary,
    recordedAt: at
  });
  const event = createEvent({
    type: "DelegatedActionRecorded",
    threadId: grant.threadId,
    actorId: grant.delegateId,
    at,
    payload: { delegatedAction: action }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.delegation.record.v0",
    recorded: true,
    delegatedAction: action,
    event
  });
}

function delegationList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let grants = projection.delegation.grants;
  if (options.thread) {
    grants = grants.filter((grant) => grant.threadId === options.thread);
  }
  if (options.status) {
    grants = grants.filter((grant) => grant.status === options.status);
  }
  return print({
    schema: "clista.delegation.list.v0",
    theorem: projection.delegation.theorem,
    hardLaw: projection.delegation.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: grants.length,
    grants
  });
}

function delegationShow(options, cwd) {
  const delegationId = options.delegation || options.delegationId || options.id;
  if (!delegationId) {
    throw new Error("Missing required option --delegation");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(delegationForId(projection.delegation, delegationId));
}

function delegationRevoke(options, cwd) {
  requireOption(options, "delegation");
  requireOption(options, "reason");
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const grant = projection.delegation.byGrant[options.delegation];
  if (!grant) {
    throw new Error(`Unknown delegation ${options.delegation}`);
  }
  const revoker = participantFrom(options.revoker || options.actor || grant.delegatorParticipantId, "decision_owner");
  appendParticipant(revoker, cwd, grant.threadId);
  const at = nowIso();
  const revocation = buildDelegationRevocation({
    id: options.id || options.revocation,
    delegationId: grant.id,
    threadId: grant.threadId,
    revokedByParticipantId: revoker.id,
    reason: options.reason,
    revokedAt: at
  });
  const event = createEvent({
    type: "DelegationRevoked",
    threadId: grant.threadId,
    actorId: revoker.id,
    at,
    payload: { delegationRevocation: revocation }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.delegation.revoke.v0",
    revoked: true,
    delegationRevocation: revocation,
    event
  });
}

function delegationVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.delegation.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.delegation.verify.v0",
    valid: true,
    errors: [],
    delegationValidationStatus: projection.delegation.delegationValidationStatus
  });
}

function executionStart(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const at = nowIso();
  const record = options.delegation
    ? executionStartFromDelegation(options, projection, at)
    : executionStartFromDecision(options, projection, at);
  const event = createEvent({
    type: "ExecutionStarted",
    threadId: record.threadId,
    actorId: record.actorId,
    at,
    payload: { executionRecord: record }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.execution.start.v0",
    started: true,
    executionRecord: record,
    event
  });
}

function executionStartFromDelegation(options, projection, at) {
  const grant = projection.delegation.byGrant[options.delegation];
  if (!grant) {
    throw new Error(`Unknown delegation ${options.delegation}`);
  }
  const actorId = options.actor ? participantIdFor(options.actor) : grant.delegateId;
  const constraints = parseList(options.constraint || options.constraints);
  return buildExecutionStart({
    id: options.id || options.execution,
    threadId: grant.threadId,
    actorId,
    delegationId: grant.id,
    actionType: options.action || grant.action,
    scope: options.scope || grant.scope,
    constraints: constraints.length ? constraints : grant.limits,
    summary: options.summary,
    startedAt: at
  });
}

function executionStartFromDecision(options, projection, at) {
  const decisionId = options.decision || options.decisionId;
  if (!decisionId) {
    throw new Error("Missing required option --delegation or --decision");
  }
  const decision = projection.decisionRecords[decisionId];
  if (!decision) {
    throw new Error(`Unknown decision ${decisionId}`);
  }
  const actorId = options.actor ? participantIdFor(options.actor) : decision.decidedByParticipantId;
  const constraints = parseList(options.constraint || options.constraints);
  return buildExecutionStart({
    id: options.id || options.execution,
    threadId: decision.threadId,
    actorId,
    decisionId: decision.id,
    actionType: options.action || decision.nextAction || decision.summary,
    scope: options.scope || `thread:${decision.threadId}`,
    constraints: constraints.length ? constraints : (decision.conditions || ["decision_authorization"]),
    summary: options.summary,
    startedAt: at
  });
}

function executionComplete(options, cwd) {
  requireOption(options, "execution");
  requireOption(options, "evidence");
  const { record } = executionRecordForCli(options, cwd);
  const at = nowIso();
  const completion = buildExecutionCompletion({
    id: record.id,
    threadId: record.threadId,
    actorId: record.actorId,
    delegationId: record.delegationId,
    decisionId: record.decisionId,
    actionType: record.actionType,
    scope: record.scope,
    constraints: record.constraints,
    evidence: parseList(options.evidence || options.evidences),
    summary: options.summary,
    completedAt: at
  });
  const event = createEvent({
    type: "ExecutionCompleted",
    threadId: completion.threadId,
    actorId: completion.actorId,
    at,
    payload: { executionRecord: completion }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.execution.complete.v0",
    completed: true,
    executionRecord: completion,
    event
  });
}

function executionFail(options, cwd) {
  requireOption(options, "execution");
  requireOption(options, "reason");
  const { record } = executionRecordForCli(options, cwd);
  const at = nowIso();
  const failure = buildExecutionFailure({
    id: record.id,
    threadId: record.threadId,
    actorId: record.actorId,
    delegationId: record.delegationId,
    decisionId: record.decisionId,
    actionType: record.actionType,
    scope: record.scope,
    constraints: record.constraints,
    reason: options.reason,
    summary: options.summary,
    failedAt: at
  });
  const event = createEvent({
    type: "ExecutionFailed",
    threadId: failure.threadId,
    actorId: failure.actorId,
    at,
    payload: { executionRecord: failure }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.execution.fail.v0",
    failed: true,
    executionRecord: failure,
    event
  });
}

function executionRollback(options, cwd) {
  requireOption(options, "execution");
  requireOption(options, "reason");
  requireOption(options, "evidence");
  const { record } = executionRecordForCli(options, cwd);
  const at = nowIso();
  const rollback = buildExecutionRollback({
    id: record.id,
    threadId: record.threadId,
    actorId: record.actorId,
    delegationId: record.delegationId,
    decisionId: record.decisionId,
    actionType: record.actionType,
    scope: record.scope,
    constraints: record.constraints,
    reason: options.reason,
    evidence: parseList(options.evidence || options.evidences),
    summary: options.summary,
    rolledBackAt: at
  });
  const event = createEvent({
    type: "ExecutionRolledBack",
    threadId: rollback.threadId,
    actorId: rollback.actorId,
    at,
    payload: { executionRecord: rollback }
  });
  appendEvent(event, cwd);
  return print({
    schema: "clista.execution.rollback.v0",
    rolledBack: true,
    executionRecord: rollback,
    event
  });
}

function executionList(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  let records = projection.execution.records;
  if (options.thread) {
    records = records.filter((record) => record.threadId === options.thread);
  }
  if (options.status) {
    records = records.filter((record) => record.status === options.status);
  }
  return print({
    schema: "clista.execution.list.v0",
    theorem: projection.execution.theorem,
    hardLaw: projection.execution.hardLaw,
    threadId: options.thread || null,
    status: options.status || null,
    count: records.length,
    records
  });
}

function executionShow(options, cwd) {
  const executionId = options.execution || options.executionId || options.id;
  if (!executionId) {
    throw new Error("Missing required option --execution");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(executionForId(projection.execution, executionId));
}

function executionVerify(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.execution.verify.v0",
      valid: false,
      errors: result.errors
    });
    process.exitCode = 1;
    return;
  }
  const projection = projectEvents(events);
  return print({
    schema: "clista.execution.verify.v0",
    valid: true,
    errors: [],
    executionValidationStatus: projection.execution.executionValidationStatus
  });
}

function executionRecordForCli(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const record = projection.execution.byExecution[options.execution];
  if (!record) {
    throw new Error(`Unknown execution ${options.execution}`);
  }
  return { projection, record };
}

function outcomeRecordForCli(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const outcomeId = options.outcome || options.outcomeId || options.id;
  const record = projection.outcome.byOutcome[outcomeId];
  if (!record) {
    throw new Error(`Unknown outcome ${outcomeId}`);
  }
  return { projection, record };
}

function outcomeLearningRecordForCli(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const learningId = options.learning || options.learningId || options.id;
  const target = projection.outcomeLearning.bySignal[learningId] || projection.outcomeLearning.byLesson[learningId];
  if (!target) {
    throw new Error(`Unknown outcome learning record ${learningId}`);
  }
  return { projection, target };
}

function reviewRecordForCli(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  const reviewId = options.review || options.reviewId || options.id;
  const record = projection.review.byReview[reviewId];
  if (!record) {
    throw new Error(`Unknown protocol review ${reviewId}`);
  }
  return { projection, record };
}

function recoveryRecordForCli(projection, recoveryId, planId) {
  const record = projection.recovery.byRecovery[recoveryId];
  if (!record) {
    throw new Error(`Unknown recovery ${recoveryId}`);
  }
  const plan = planId
    ? projection.recovery.plansByRecovery[record.id]?.find((item) => item.id === planId)
    : projection.recovery.plansByRecovery[record.id]?.at(-1);
  if (!plan) {
    throw new Error(`Recovery ${record.id} has no recovery plan`);
  }
  return { record, plan };
}

function appendRecoveryReviewRequirement(cwd, recoveryRecord, actor, options = {}) {
  const at = options.at || nowIso();
  const protocolReview = buildReviewRequirement({
    id: options.reviewId,
    threadId: recoveryRecord.threadId,
    subjectType: "recovery_request",
    subjectId: recoveryRecord.id,
    triggerType: options.triggerType || "recovery_plan",
    reason: options.reason || `Recovery ${recoveryRecord.id} requires review`,
    requiredReviewerRole: options.requiredReviewerRole || "reviewer",
    requiredByParticipantId: actor.id,
    requiredAt: at
  });
  const event = createEvent({
    type: "ReviewRequired",
    threadId: protocolReview.threadId,
    actorId: protocolReview.requiredByParticipantId,
    at,
    payload: { protocolReview }
  });
  appendEvent(event, cwd);
  return protocolReview;
}

function recoveryCheckpointForCli(options, cwd, threadId) {
  const explicit = options.checkpoint
    || options.checkpointId
    || options.checkpointType
    || options.eventLogHash
    || options.headHash
    || options.projectionHash
    || options.stateHash;
  if (explicit) {
    return {
      checkpointId: options.checkpoint || options.checkpointId,
      checkpointType: options.checkpointType || "projection_boundary",
      sourceThreadId: options.sourceThread || options.sourceThreadId || threadId,
      protocolVersion: options.protocolVersion || PROTOCOL_VERSION,
      boundaryEventId: options.boundaryEvent || options.boundaryEventId,
      exportedAt: options.exportedAt,
      eventLogHash: options.eventLogHash,
      headHash: options.headHash,
      projectionHash: options.projectionHash,
      stateHash: options.stateHash,
      verificationLayerResults: checkpointLayerResultsForCli(options),
      evidence: parseList(options.checkpointEvidence || options.evidence),
      artifactRef: artifactRefForCli(options),
      verified: booleanOption(options.verified, true)
    };
  }

  const events = readEvents(cwd);
  const validation = validateEvents(events);
  if (!validation.valid) {
    throw new Error("Cannot create default recovery checkpoint from invalid current log; pass explicit verified checkpoint hashes");
  }
  const integrity = verifyEventIntegrity(events);
  if (!integrity.valid) {
    throw new Error("Cannot create default recovery checkpoint from failed integrity state; pass explicit verified checkpoint hashes");
  }
  const projection = projectEvents(events);
  const state = selectThreadState(projection, threadId);
  if (state.error) {
    throw new Error(state.error);
  }
  const latest = events.at(-1);
  return {
    checkpointId: options.checkpoint || options.checkpointId || newId("chk", "projection_boundary"),
    checkpointType: "projection_boundary",
    sourceThreadId: threadId,
    protocolVersion: PROTOCOL_VERSION,
    boundaryEventId: latest?.event_id || null,
    exportedAt: latest?.timestamp || nowIso(),
    eventLogHash: contentHash({ events }),
    headHash: integrity.headHash,
    projectionHash: contentHash(projectionMaterialForCli(projection)),
    stateHash: contentHash(threadStateMaterialForCli(state)),
    verificationLayerResults: checkpointLayerResultsFromProjection(validation, integrity, projection),
    evidence: parseList(options.checkpointEvidence || "default verified projection boundary"),
    artifactRef: artifactRefForCli(options),
    verified: true
  };
}

function checkpointLayerResultsForCli(options) {
  return {
    validity: { valid: booleanOption(options.validityVerified, true) },
    integrity: { valid: booleanOption(options.integrityVerified, true) },
    recovery: { valid: booleanOption(options.recoveryVerified, true) }
  };
}

function checkpointLayerResultsFromProjection(validation, integrity, projection) {
  return {
    validity: {
      valid: validation.valid,
      errorCount: validation.errors.length
    },
    integrity: {
      valid: integrity.valid,
      eventCount: integrity.eventCount,
      headHash: integrity.headHash
    },
    review: projection.review?.reviewValidationStatus || { valid: true },
    recovery: projection.recovery?.recoveryValidationStatus || { valid: true }
  };
}

function artifactRefForCli(options) {
  const uri = options.artifact || options.artifactUri || options.artifactRef;
  const hash = options.artifactHash || options.hash;
  if (!uri && !hash) {
    return null;
  }
  return {
    uri: uri || null,
    hash: hash || null,
    evidence: parseList(options.artifactEvidence || options.evidence)
  };
}

function projectionMaterialForCli(projection) {
  const material = {};
  for (const [key, value] of Object.entries(projection)) {
    if (key !== "projectedAt" && key !== "events" && key !== "schema") {
      material[key] = value;
    }
  }
  return material;
}

function threadStateMaterialForCli(state) {
  const material = { ...state };
  delete material.projectedAt;
  delete material.auditTrail;
  return material;
}

function outcomeLearningActorId(options, cwd, threadId, fallbackId, role) {
  if (options.actor || options.participant) {
    const actor = participantFrom(options.actor || options.participant, options.role || role);
    appendParticipant(actor, cwd, threadId);
    return actor.id;
  }
  return fallbackId;
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

function compatibilityResultFromCli(packet, options) {
  const continuityVerification = verifyContinuityPacket(packet);
  return verifyProtocolCompatibility(packet, compatibilityOptionsFromCli(options, continuityVerification));
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

function federationResultFromCli(packet, options) {
  const continuityVerification = verifyContinuityPacket(packet);
  const compatibilityResult = verifyProtocolCompatibility(packet, compatibilityOptionsFromCli(options, continuityVerification));
  const interoperabilityResult = verifyProtocolInteroperability(packet, interoperabilityOptionsFromCli(options, compatibilityResult));
  return verifyProtocolFederation(packet, federationOptionsFromCli(options, {
    continuityVerification,
    compatibilityResult,
    interoperabilityResult
  }));
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

function negotiationResultFromCli(packet, options) {
  const continuityVerification = verifyContinuityPacket(packet);
  const compatibilityResult = verifyProtocolCompatibility(packet, compatibilityOptionsFromCli(options, continuityVerification));
  const interoperabilityResult = verifyProtocolInteroperability(packet, interoperabilityOptionsFromCli(options, compatibilityResult));
  const federationResult = verifyProtocolFederation(packet, federationOptionsFromCli(options, {
    continuityVerification,
    compatibilityResult,
    interoperabilityResult
  }));
  return verifyProtocolNegotiation(packet, negotiationOptionsFromCli(options, {
    continuityVerification,
    compatibilityResult,
    interoperabilityResult,
    federationResult
  }));
}

function negotiationOptionsFromCli(options, results) {
  const supportedAmendmentIds = parseList(options.supportAmendment || options.supportedAmendment || options.supportedAmendments);
  const supportedCapabilities = parseList(options.supportCapability || options.supportedCapability || options.supportedCapabilities);
  const supportedVerificationLayers = parseList(options.supportLayer || options.supportedLayer || options.supportedVerificationLayers);
  const supportedSemantics = parseList(options.supportSemantic || options.supportedSemantic || options.supportedSemantics);
  const supportedEventTypes = parseList(options.supportEventType || options.supportedEventType || options.supportedEventTypes);
  const supportedExchangeFormats = parseList(options.supportExchangeFormat || options.supportedExchangeFormat || options.supportedExchangeFormats);
  return {
    ...results,
    supportedAmendmentIds,
    supportedCapabilities: supportedCapabilities.length ? supportedCapabilities : undefined,
    supportedVerificationLayers: supportedVerificationLayers.length ? supportedVerificationLayers : undefined,
    supportedSemantics: supportedSemantics.length ? supportedSemantics : undefined,
    supportedEventTypes: supportedEventTypes.length ? supportedEventTypes : undefined,
    supportedExchangeFormats: supportedExchangeFormats.length ? supportedExchangeFormats : undefined,
    authorityTransfer: booleanOption(options.authorityTransfer, false),
    remoteAuthorityImported: booleanOption(options.remoteAuthorityImported, false),
    automaticAuthorityImport: booleanOption(options.automaticAuthorityImport, false),
    governanceMerge: booleanOption(options.governanceMerge, false),
    localGovernanceMutation: booleanOption(options.localGovernanceMutation, false),
    remoteGovernanceMerged: booleanOption(options.remoteGovernanceMerged, false),
    automaticAmendmentAdoption: booleanOption(options.automaticAmendmentAdoption, false),
    automaticAmendmentImport: booleanOption(options.automaticAmendmentImport, false),
    automaticConsensus: booleanOption(options.automaticConsensus, false),
    remoteStateMutation: booleanOption(options.remoteStateMutation, false),
    silentDowngrade: booleanOption(options.silentDowngrade, false),
    negotiationAcceptanceAsAmendment: booleanOption(options.negotiationAcceptanceAsAmendment, false)
  };
}

function validateCommand(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  print(result);
  if (!result.valid) {
    process.exitCode = 1;
  }
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

function readValidEventsForOptions(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  assertValidEvents(events);
  return events;
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

function participantFrom(value, role, kind = "human") {
  const participant = createParticipant(value, role, kind);
  participant.name = String(value || participant.name).startsWith("par_") ? participant.name : String(value || participant.name);
  participant.kind = kind;
  return participant;
}

function normalizeDelegateTypeForCli(value) {
  return String(value || "participant")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function defaultDelegateKindForType(delegateType) {
  const kinds = {
    agent: "agent",
    tool: "tool",
    context: "system"
  };
  return kinds[delegateType] || "human";
}

function defaultDelegateRoleForType(delegateType) {
  const roles = {
    agent: "delegated_agent",
    tool: "delegated_tool",
    context: "context_controller"
  };
  return roles[delegateType] || "delegated_actor";
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

function inferRecoverySubjectType(id) {
  if (!id) {
    return "external_artifact";
  }
  if (id.startsWith("evt_")) {
    return "invalid_event";
  }
  if (id.startsWith("exe_")) {
    return "bad_execution_rollback";
  }
  if (id.startsWith("oco_")) {
    return "bad_outcome_chain";
  }
  if (id.startsWith("ols_") || id.startsWith("les_")) {
    return "bad_outcome_learning_chain";
  }
  if (id.startsWith("pkt_")) {
    return "invalid_continuity_packet";
  }
  return "external_artifact";
}

function inferReviewSubjectType(id) {
  if (!id) {
    return "thread";
  }
  if (id.startsWith("dlg_")) {
    return "delegation";
  }
  if (id.startsWith("dga_")) {
    return "delegated_action";
  }
  if (id.startsWith("dgv_")) {
    return "delegation_violation";
  }
  if (id.startsWith("exe_")) {
    return "execution";
  }
  if (id.startsWith("exv_")) {
    return "execution_violation";
  }
  if (id.startsWith("oco_")) {
    return "outcome";
  }
  if (id.startsWith("ocd_")) {
    return "outcome_dispute";
  }
  if (id.startsWith("ocv_")) {
    return "outcome_violation";
  }
  if (id.startsWith("ols_")) {
    return "outcome_learning_signal";
  }
  if (id.startsWith("les_")) {
    return "outcome_lesson";
  }
  if (id.startsWith("old_")) {
    return "outcome_learning_dispute";
  }
  if (id.startsWith("olv_")) {
    return "outcome_learning_violation";
  }
  if (id.startsWith("prv_")) {
    return "protocol_review";
  }
  return inferTargetType(id);
}

function requireOption(options, key) {
  if (!options[key]) {
    throw new Error(`Missing required option --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
}

function numberOption(value) {
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



function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function help() {
  process.stdout.write(`${usage()}\n`);
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
  clista validate [--events <path>]
  clista integrity verify [--events <path>] [--strict]
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
  # Report a completed external run toward the EXTERNAL-RUNS gate (pack/GATES.md, pack/RUNBOOK.md)
  clista run report [--events <path>] [--thread <threadId>] [--title <decision title>] [--out <bundlePath>]`;
}

if (require.main === module) {
  main();
}

module.exports = { main, parseOptions };
