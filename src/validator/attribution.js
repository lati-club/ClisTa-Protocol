const {
  validateAttributionCorrection,
  validateAttributionDispute,
  validateAttributionRevocation,
  validateContributionAttribution
} = require("../attribution");
const { validateContributionProvenance } = require("../provenance");
const {
  addError,
  isDecisionOwner
} = require("./shared");

function validateContributionAttributed(event, index, state) {
  const attribution = event.payload.contributionAttribution;
  if (!attribution) {
    addError(state, event, "ContributionAttributed payload missing contributionAttribution");
    return;
  }
  if (attribution.participantId && !state.participants.has(attribution.participantId)) {
    addError(state, event, `attribution references unknown participant ${attribution.participantId}`);
  }
  validateAttributionSourceBoundary(event, state, attribution.sourceEventId || attribution.eventId, index);
  for (const reason of validateContributionAttribution(attribution, state.events)) {
    addError(state, event, reason);
  }
  for (const reason of validateContributionProvenance(attribution, state.events)) {
    addError(state, event, reason);
  }
}

function validateContributionAttributionCorrected(event, state) {
  const correction = event.payload.attributionCorrection;
  if (!correction) {
    addError(state, event, "ContributionAttributionCorrected payload missing attributionCorrection");
    return;
  }
  if (!state.participants.has(correction.correctedBy || event.actor_id)) {
    addError(state, event, `attribution correction references unknown participant ${correction.correctedBy || event.actor_id}`);
  }
  for (const reason of validateAttributionCorrection(correction, state.events)) {
    addError(state, event, reason);
  }
}

function validateContributionAttributionDisputed(event, state) {
  const dispute = event.payload.attributionDispute;
  if (!dispute) {
    addError(state, event, "ContributionAttributionDisputed payload missing attributionDispute");
    return;
  }
  if (!state.participants.has(dispute.disputedBy || event.actor_id)) {
    addError(state, event, `attribution dispute references unknown participant ${dispute.disputedBy || event.actor_id}`);
  }
  for (const reason of validateAttributionDispute(dispute, state.events)) {
    addError(state, event, reason);
  }
}

function validateContributionAttributionRevoked(event, state) {
  const revocation = event.payload.attributionRevocation;
  if (!revocation) {
    addError(state, event, "ContributionAttributionRevoked payload missing attributionRevocation");
    return;
  }
  const revokedBy = revocation.revokedBy || event.actor_id;
  if (!state.participants.has(revokedBy)) {
    addError(state, event, `attribution revocation references unknown participant ${revokedBy}`);
  }
  if (!isDecisionOwner(revokedBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `attribution revocation requires decision_owner authority ${revokedBy}`);
  }
  for (const reason of validateAttributionRevocation(revocation, state.events)) {
    addError(state, event, reason);
  }
}

function validateAttributionSourceBoundary(event, state, sourceEventId, index) {
  if (!sourceEventId) {
    return;
  }
  const sourceIndex = state.allEventIndexById.get(sourceEventId);
  if (sourceIndex === undefined) {
    addError(state, event, `attribution source event does not exist: ${sourceEventId}`);
  } else if (sourceIndex >= index) {
    addError(state, event, `attribution cannot reference future event ${sourceEventId}`);
  }
}

module.exports = {
  validateContributionAttributed,
  validateContributionAttributionCorrected,
  validateContributionAttributionDisputed,
  validateContributionAttributionRevoked
};
