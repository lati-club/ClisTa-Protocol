// Cross-domain helpers shared by the src/validator/ domain modules.
// Moved verbatim from src/validator.js during the #49 split.


function addError(state, event, reason) {
  state.errors.push({
    event_id: event?.event_id ?? null,
    event_type: event?.event_type ?? null,
    reason
  });
}

module.exports = {
  addError
};
