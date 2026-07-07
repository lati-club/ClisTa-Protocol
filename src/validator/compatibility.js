const {
  validateCapabilitySetDeclaration,
  validateCompatibilityAcceptance,
  validateCompatibilityCheck,
  validateCompatibilityDegradation,
  validateCompatibilityFailure
} = require("../compatibility");
const {
  validateInteroperabilityAcceptance,
  validateInteroperabilityCheck,
  validateInteroperabilityFailure,
  validateInteroperabilityProfile,
  validateSemanticDegradation,
  validateSemanticMapping
} = require("../interoperability");
const { addError } = require("./shared");

function validateCapabilitySetDeclaredEvent(event, state) {
  const declaration = event.payload.capabilitySetDeclaration || event.payload.capabilitySet;
  if (!declaration) {
    addError(state, event, "CapabilitySetDeclared payload missing capabilitySetDeclaration");
    return;
  }
  for (const reason of validateCapabilitySetDeclaration(declaration, state.events)) {
    addError(state, event, reason);
  }
}

function validateCompatibilityCheckRecordedEvent(event, state) {
  const check = event.payload.compatibilityCheck;
  if (!check) {
    addError(state, event, "CompatibilityCheckRecorded payload missing compatibilityCheck");
    return;
  }
  for (const reason of validateCompatibilityCheck(check, state.events)) {
    addError(state, event, reason);
  }
}

function validateCompatibilityFailureRecordedEvent(event, state) {
  const failure = event.payload.compatibilityFailure;
  if (!failure) {
    addError(state, event, "CompatibilityFailureRecorded payload missing compatibilityFailure");
    return;
  }
  for (const reason of validateCompatibilityFailure(failure, state.events)) {
    addError(state, event, reason);
  }
}

function validateCompatibilityDegradationRecordedEvent(event, state) {
  const degradation = event.payload.compatibilityDegradation;
  if (!degradation) {
    addError(state, event, "CompatibilityDegradationRecorded payload missing compatibilityDegradation");
    return;
  }
  for (const reason of validateCompatibilityDegradation(degradation, state.events)) {
    addError(state, event, reason);
  }
}

function validateCompatibilityAcceptanceRecordedEvent(event, state) {
  const acceptance = event.payload.compatibilityAcceptance;
  if (!acceptance) {
    addError(state, event, "CompatibilityAcceptanceRecorded payload missing compatibilityAcceptance");
    return;
  }
  for (const reason of validateCompatibilityAcceptance(acceptance, state.events)) {
    addError(state, event, reason);
  }
}

function validateInteroperabilityProfileDeclaredEvent(event, state) {
  const profile = event.payload.interoperabilityProfile;
  if (!profile) {
    addError(state, event, "InteroperabilityProfileDeclared payload missing interoperabilityProfile");
    return;
  }
  for (const reason of validateInteroperabilityProfile(profile, state.events)) {
    addError(state, event, reason);
  }
}

function validateSemanticMappingRecordedEvent(event, state) {
  const mapping = event.payload.semanticMapping;
  if (!mapping) {
    addError(state, event, "SemanticMappingRecorded payload missing semanticMapping");
    return;
  }
  for (const reason of validateSemanticMapping(mapping, state.events)) {
    addError(state, event, reason);
  }
}

function validateInteroperabilityCheckRecordedEvent(event, state) {
  const check = event.payload.interoperabilityCheck;
  if (!check) {
    addError(state, event, "InteroperabilityCheckRecorded payload missing interoperabilityCheck");
    return;
  }
  for (const reason of validateInteroperabilityCheck(check, state.events)) {
    addError(state, event, reason);
  }
}

function validateSemanticDegradationRecordedEvent(event, state) {
  const degradation = event.payload.semanticDegradation;
  if (!degradation) {
    addError(state, event, "SemanticDegradationRecorded payload missing semanticDegradation");
    return;
  }
  for (const reason of validateSemanticDegradation(degradation, state.events)) {
    addError(state, event, reason);
  }
}

function validateInteroperabilityFailureRecordedEvent(event, state) {
  const failure = event.payload.interoperabilityFailure;
  if (!failure) {
    addError(state, event, "InteroperabilityFailureRecorded payload missing interoperabilityFailure");
    return;
  }
  for (const reason of validateInteroperabilityFailure(failure, state.events)) {
    addError(state, event, reason);
  }
}

function validateInteroperabilityAcceptanceRecordedEvent(event, state) {
  const acceptance = event.payload.interoperabilityAcceptance;
  if (!acceptance) {
    addError(state, event, "InteroperabilityAcceptanceRecorded payload missing interoperabilityAcceptance");
    return;
  }
  for (const reason of validateInteroperabilityAcceptance(acceptance, state.events)) {
    addError(state, event, reason);
  }
}

module.exports = {
  validateCapabilitySetDeclaredEvent,
  validateCompatibilityAcceptanceRecordedEvent,
  validateCompatibilityCheckRecordedEvent,
  validateCompatibilityDegradationRecordedEvent,
  validateCompatibilityFailureRecordedEvent,
  validateInteroperabilityAcceptanceRecordedEvent,
  validateInteroperabilityCheckRecordedEvent,
  validateInteroperabilityFailureRecordedEvent,
  validateInteroperabilityProfileDeclaredEvent,
  validateSemanticDegradationRecordedEvent,
  validateSemanticMappingRecordedEvent
};
