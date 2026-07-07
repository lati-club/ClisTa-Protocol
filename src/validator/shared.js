// Cross-domain helpers shared by the src/validator/ domain modules.
// Moved verbatim from src/validator.js during the #49 split.

const { participantHasAuthority } = require("../identity");

function addError(state, event, reason) {
  state.errors.push({
    event_id: event?.event_id ?? null,
    event_type: event?.event_type ?? null,
    reason
  });
}

function isDecisionOwner(participantId, state, threadId) {
  return participantHasAuthority(state.identity, participantId, "decision_owner", threadId);
}

module.exports = {
  addError,
  isDecisionOwner
};
