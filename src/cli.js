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
  selectForkLineage,
  selectMergeRequestState,
  selectThreadState
} = require("./projector");
const { evaluateDecisionEligibility } = require("./governance");
const { evaluateMergeEligibility } = require("./merges");
const { assertValidEvents, validateEvents } = require("./validator");

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
      case "decision eligibility":
        return decisionEligibility(options, cwd);
      case "review submit":
        return reviewSubmit(options, cwd);
      case "decision merge":
        return decisionMerge(options, cwd);
      case "outcome expect":
        return outcomeExpect(options, cwd);
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
  return print(provenanceForContribution(projection.provenance, contributionId));
}

function provenanceTrace(options, cwd) {
  const contributionId = options.contribution || options.contributionId || options.id;
  if (!contributionId) {
    throw new Error("Missing required option --contribution");
  }
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
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
  if (command.startsWith("federation show ")) {
    return {
      command: "federation show",
      options: {
        ...options,
        federation: options.federation || command.slice("federation show ".length).trim()
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

function stripUndefined(object) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) {
      delete object[key];
    }
  }
  return object;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
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
  clista decision merge --thread <threadId> --request <requestId> --decider <name|id>
  clista outcome expect --thread <threadId> --decision <decisionRecordId> --metric <metric> --operator <operator> --target <target> --review-date <YYYY-MM-DD>
  clista outcome audit --thread <threadId> --expected <expectedOutcomeId> --actual <actual> --result <result> --summary <summary> --auditor <name|id>
  clista decision score --thread <threadId> --decision <decisionRecordId> --score <score> --status <status> --rationale <text> --audits <outcomeAuditIds>
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
  clista state show [--thread <threadId>] [--events <path>]
  clista audit show [--thread <threadId>] [--events <path>]
  clista fork lineage --thread <forkThreadId> [--events <path>]
  clista export [--events <path>]
  clista import --events <path> [--replace true]`;
}

if (require.main === module) {
  main();
}

module.exports = { main, parseOptions };
