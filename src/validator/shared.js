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

function validateThreadObject(event, object, state, label) {
  if (object.threadId !== event.thread_id) {
    addError(state, event, `${label} threadId must match event thread_id`);
  }
  if (!state.threads.has(object.threadId)) {
    addError(state, event, `${label} references unknown thread ${object.threadId}`);
  }
}

function arrayValues(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
}

function validateIdsExist(event, state, ids, collection, label) {
  for (const id of ids || []) {
    if (!collection.has(id)) {
      addError(state, event, `${label} reference does not exist: ${id}`);
    }
  }
}

function addToMapList(map, key, value) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
}

module.exports = {
  addError,
  addToMapList,
  arrayValues,
  isDecisionOwner,
  validateIdsExist,
  validateThreadObject
};
