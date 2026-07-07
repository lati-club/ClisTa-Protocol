const {
  validateProtocolAmendment,
  validateProtocolAmendmentApproval,
  validateProtocolAmendmentRejection,
  validateProtocolAmendmentReview,
  validateProtocolAmendmentSupersession
} = require("../amendments");
const {
  addError,
  isDecisionOwner
} = require("./shared");

function validateProtocolAmendmentProposed(event, state) {
  const amendment = event.payload.protocolAmendment || event.payload.amendment;
  if (!amendment) {
    addError(state, event, "ProtocolAmendmentProposed payload missing protocolAmendment");
    return;
  }
  for (const reason of validateProtocolAmendment(amendment, state.events)) {
    addError(state, event, reason);
  }
}

function validateProtocolAmendmentReviewed(event, state) {
  const review = event.payload.protocolAmendmentReview || event.payload.amendmentReview;
  if (!review) {
    addError(state, event, "ProtocolAmendmentReviewed payload missing protocolAmendmentReview");
    return;
  }
  for (const reason of validateProtocolAmendmentReview(review, state.events)) {
    addError(state, event, reason);
  }
}

function validateProtocolAmendmentApprovedEvent(event, state) {
  const approval = event.payload.protocolAmendmentApproval || event.payload.amendmentApproval;
  if (!approval) {
    addError(state, event, "ProtocolAmendmentApproved payload missing protocolAmendmentApproval");
    return;
  }
  for (const reason of validateProtocolAmendmentApproval(approval, state.events)) {
    addError(state, event, reason);
  }
  const approvedBy = approval.approvedBy || event.actor_id;
  if (!isDecisionOwner(approvedBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `protocol amendment approval requires decision_owner authority ${approvedBy}`);
  }
}

function validateProtocolAmendmentRejectedEvent(event, state) {
  const rejection = event.payload.protocolAmendmentRejection || event.payload.amendmentRejection;
  if (!rejection) {
    addError(state, event, "ProtocolAmendmentRejected payload missing protocolAmendmentRejection");
    return;
  }
  for (const reason of validateProtocolAmendmentRejection(rejection, state.events)) {
    addError(state, event, reason);
  }
  const rejectedBy = rejection.rejectedBy || event.actor_id;
  if (!isDecisionOwner(rejectedBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `protocol amendment rejection requires decision_owner authority ${rejectedBy}`);
  }
}

function validateProtocolAmendmentSupersededEvent(event, state) {
  const supersession = event.payload.protocolAmendmentSupersession || event.payload.amendmentSupersession;
  if (!supersession) {
    addError(state, event, "ProtocolAmendmentSuperseded payload missing protocolAmendmentSupersession");
    return;
  }
  for (const reason of validateProtocolAmendmentSupersession(supersession, state.events)) {
    addError(state, event, reason);
  }
  const supersededBy = supersession.supersededBy || event.actor_id;
  if (!isDecisionOwner(supersededBy, state, event.thread_id) && !isDecisionOwner(event.actor_id, state, event.thread_id)) {
    addError(state, event, `protocol amendment supersession requires decision_owner authority ${supersededBy}`);
  }
}

module.exports = {
  validateProtocolAmendmentApprovedEvent,
  validateProtocolAmendmentProposed,
  validateProtocolAmendmentRejectedEvent,
  validateProtocolAmendmentReviewed,
  validateProtocolAmendmentSupersededEvent
};
