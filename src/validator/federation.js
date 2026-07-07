const {
  validateFederatedPacketRejection,
  validateFederatedPacketVerification,
  validateFederatedStateReference,
  validateFederationBoundary,
  validateFederationContext,
  validateFederationPeer
} = require("../federation");
const { addError } = require("./shared");

function validateFederationContextDeclaredEvent(event, state) {
  const context = event.payload.federationContext;
  if (!context) {
    addError(state, event, "FederationContextDeclared payload missing federationContext");
    return;
  }
  for (const reason of validateFederationContext(context, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederationPeerRecordedEvent(event, state) {
  const peer = event.payload.federationPeer;
  if (!peer) {
    addError(state, event, "FederationPeerRecorded payload missing federationPeer");
    return;
  }
  for (const reason of validateFederationPeer(peer, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederatedStateReferenceRecordedEvent(event, state) {
  const reference = event.payload.federatedStateReference;
  if (!reference) {
    addError(state, event, "FederatedStateReferenceRecorded payload missing federatedStateReference");
    return;
  }
  for (const reason of validateFederatedStateReference(reference, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederatedPacketVerifiedEvent(event, state) {
  const verification = event.payload.federatedPacketVerification;
  if (!verification) {
    addError(state, event, "FederatedPacketVerified payload missing federatedPacketVerification");
    return;
  }
  for (const reason of validateFederatedPacketVerification(verification, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederatedPacketRejectedEvent(event, state) {
  const rejection = event.payload.federatedPacketRejection;
  if (!rejection) {
    addError(state, event, "FederatedPacketRejected payload missing federatedPacketRejection");
    return;
  }
  for (const reason of validateFederatedPacketRejection(rejection, state.events)) {
    addError(state, event, reason);
  }
}

function validateFederationBoundaryRecordedEvent(event, state) {
  const boundary = event.payload.federationBoundary;
  if (!boundary) {
    addError(state, event, "FederationBoundaryRecorded payload missing federationBoundary");
    return;
  }
  for (const reason of validateFederationBoundary(boundary, state.events)) {
    addError(state, event, reason);
  }
}

module.exports = {
  validateFederatedPacketRejectedEvent,
  validateFederatedPacketVerifiedEvent,
  validateFederatedStateReferenceRecordedEvent,
  validateFederationBoundaryRecordedEvent,
  validateFederationContextDeclaredEvent,
  validateFederationPeerRecordedEvent
};
