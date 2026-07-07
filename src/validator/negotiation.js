const {
  validateNegotiationConstraint,
  validateNegotiationDegradationAccepted,
  validateNegotiationDifference,
  validateNegotiationFailure,
  validateNegotiationRequest,
  validateNegotiationTermsAccepted,
  validateNegotiationTermsProposed,
  validateNegotiationTermsRejected
} = require("../negotiation");
const { addError } = require("./shared");

function validateNegotiationRequestedEvent(event, state) {
  const request = event.payload.negotiationRequest;
  if (!request) {
    addError(state, event, "NegotiationRequested payload missing negotiationRequest");
    return;
  }
  for (const reason of validateNegotiationRequest(request, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationConstraintDeclaredEvent(event, state) {
  const constraint = event.payload.negotiationConstraint;
  if (!constraint) {
    addError(state, event, "NegotiationConstraintDeclared payload missing negotiationConstraint");
    return;
  }
  for (const reason of validateNegotiationConstraint(constraint, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationDifferenceRecordedEvent(event, state) {
  const difference = event.payload.negotiationDifference;
  if (!difference) {
    addError(state, event, "NegotiationDifferenceRecorded payload missing negotiationDifference");
    return;
  }
  for (const reason of validateNegotiationDifference(difference, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationTermsProposedEvent(event, state) {
  const terms = event.payload.negotiationTerms;
  if (!terms) {
    addError(state, event, "NegotiationTermsProposed payload missing negotiationTerms");
    return;
  }
  for (const reason of validateNegotiationTermsProposed(terms, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationTermsAcceptedEvent(event, state) {
  const terms = event.payload.negotiationTerms;
  if (!terms) {
    addError(state, event, "NegotiationTermsAccepted payload missing negotiationTerms");
    return;
  }
  for (const reason of validateNegotiationTermsAccepted(terms, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationTermsRejectedEvent(event, state) {
  const terms = event.payload.negotiationTerms;
  if (!terms) {
    addError(state, event, "NegotiationTermsRejected payload missing negotiationTerms");
    return;
  }
  for (const reason of validateNegotiationTermsRejected(terms, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationDegradationAcceptedEvent(event, state) {
  const terms = event.payload.negotiationTerms;
  if (!terms) {
    addError(state, event, "NegotiationDegradationAccepted payload missing negotiationTerms");
    return;
  }
  for (const reason of validateNegotiationDegradationAccepted(terms, state.events)) {
    addError(state, event, reason);
  }
}

function validateNegotiationFailureRecordedEvent(event, state) {
  const failure = event.payload.negotiationFailure;
  if (!failure) {
    addError(state, event, "NegotiationFailureRecorded payload missing negotiationFailure");
    return;
  }
  for (const reason of validateNegotiationFailure(failure, state.events)) {
    addError(state, event, reason);
  }
}

module.exports = {
  validateNegotiationConstraintDeclaredEvent,
  validateNegotiationDegradationAcceptedEvent,
  validateNegotiationDifferenceRecordedEvent,
  validateNegotiationFailureRecordedEvent,
  validateNegotiationRequestedEvent,
  validateNegotiationTermsAcceptedEvent,
  validateNegotiationTermsProposedEvent,
  validateNegotiationTermsRejectedEvent
};
