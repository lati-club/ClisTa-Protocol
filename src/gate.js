const { readEvents, createEvent, appendEvent } = require("./events");
const { prepareEventForAppend } = require("./integrity");
const { validateEvents } = require("./validator");

function structuralErrors(decisionRequest) {
  const reasons = [];
  if (!decisionRequest.supportingEvidenceIds || decisionRequest.supportingEvidenceIds.length === 0) {
    reasons.push("propose_decision requires at least one supportingEvidenceIds pointer");
  }
  if (!decisionRequest.supportingAssumptionIds || decisionRequest.supportingAssumptionIds.length === 0) {
    reasons.push("propose_decision requires at least one supportingAssumptionIds pointer");
  }
  return reasons.map((reason) => ({ event_id: null, event_type: "DecisionRequestOpened", reason }));
}

function proposeDecision(decisionRequest, cwd) {
  const missingSlots = structuralErrors(decisionRequest);
  if (missingSlots.length) {
    return { valid: false, errors: missingSlots };
  }

  const existing = readEvents(cwd);
  const priorResult = validateEvents(existing);
  if (!priorResult.valid) {
    return {
      valid: false,
      errors: priorResult.errors,
      note: "the thread's existing event log is already invalid, independent of this proposal -- nothing new was appended"
    };
  }

  const draft = createEvent({
    type: "DecisionRequestOpened",
    threadId: decisionRequest.threadId,
    actorId: decisionRequest.openedByParticipantId,
    payload: { decisionRequest }
  });
  const previousHash = existing.length ? existing[existing.length - 1].content_hash : undefined;
  const prepared = prepareEventForAppend(draft, previousHash);
  const candidate = existing.concat([prepared]);
  const result = validateEvents(candidate);

  if (!result.valid) {
    const ownErrors = result.errors.filter((e) => e.event_id === prepared.event_id);
    return { valid: false, errors: ownErrors.length ? ownErrors : result.errors };
  }

  appendEvent(draft, cwd);
  return { valid: true, errors: [], decisionRequest, event: prepared };
}

module.exports = { proposeDecision };
