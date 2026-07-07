const {
  appendEvent,
  contentHash,
  createEvent,
  newId,
  nowIso,
  parseList
} = require("../events");
const {
  projectEvents,
  selectThreadState
} = require("../projector");
const { stripUndefined } = require("../utils");
const {
  appendParticipant,
  booleanOption,
  inferTargetType,
  numberOption,
  participantFrom,
  print,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

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

module.exports = {
  assumptionDeclare,
  assumptionsList,
  attestationRecord,
  claimCreate,
  evidenceCommit,
  evidenceList,
  objectionRaise,
  positionTake
};
