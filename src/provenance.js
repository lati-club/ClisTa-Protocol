const {
  buildAttributionState
} = require("./attribution");
const {
  HASH_PATTERN,
  computeEventHash,
  contentHash
} = require("./integrity");

const PROVENANCE_SCHEMA = "clista.provenance.v0";
const PROVENANCE_VERIFY_SCHEMA = "clista.provenance.verify.v0";

const VALID_PROVENANCE_SOURCE_TYPES = new Set([
  "event",
  "evidence",
  "import",
  "continuity_packet",
  "fork",
  "merge",
  "projection",
  "external_reference"
]);

const VALID_PROVENANCE_TRANSFORMATIONS = new Set([
  "asserted",
  "observed",
  "imported",
  "summarized",
  "inferred",
  "corrected",
  "disputed",
  "revoked",
  "merged"
]);

const LEGACY_SOURCE_TYPES = new Map([
  ["event_log", "event"],
  ["source_event", "event"]
]);

function emptyProvenanceState() {
  return {
    records: new Map(),
    corrections: [],
    disputes: [],
    revocations: []
  };
}

function buildProvenanceState(events = [], attributionState = buildAttributionState(events)) {
  const state = emptyProvenanceState();
  const indexes = buildIndexes(events);

  for (const attribution of attributionState.records.values()) {
    const record = provenanceRecordForAttribution(attribution, indexes);
    if (record?.id) {
      state.records.set(record.id, record);
    }
  }

  state.corrections = attributionState.corrections;
  state.disputes = attributionState.disputes;
  state.revocations = attributionState.revocations;

  return state;
}

function provenanceRecordForAttribution(attribution, indexes) {
  const contributionEvent = indexes.eventsById.get(attribution.sourceEventId) || null;
  const explicitRefs = attribution.explicit ? explicitSourceRefs(attribution.provenance) : [];
  const sourceRefs = explicitRefs.length
    ? explicitRefs.map((sourceRef) => enrichSourceRef(sourceRef, contributionEvent, indexes))
    : derivedSourceRefs(attribution, contributionEvent, indexes);
  const primarySource = sourceRefs[0] || null;
  const auditTrail = provenanceAuditTrail(attribution);
  const transformations = unique([
    primarySource?.transformation || transformationForContribution(attribution, contributionEvent),
    ...sourceRefs.map((sourceRef) => sourceRef.transformation),
    ...auditTrail.map((entry) => entry.transformation)
  ]);
  const originalSourceHashes = unique(sourceRefs.map((sourceRef) => sourceRef.expectedSourceHash || sourceRef.sourceHash));

  const record = {
    id: `prv_${attribution.id}`,
    object: "contributionProvenance",
    contributionId: attribution.contributionId,
    contributionType: attribution.contributionType,
    attributionId: attribution.id,
    attributionStatus: attribution.status,
    threadId: attribution.threadId,
    participantId: attribution.participantId,
    role: attribution.role,
    authorityContext: attribution.authorityContext,
    sourceType: primarySource?.sourceType || "event",
    sourceId: primarySource?.sourceId || attribution.sourceEventId,
    sourceEventId: primarySource?.sourceEventId || attribution.sourceEventId,
    introducedByEventId: attribution.sourceEventId,
    introducedByEventType: attribution.sourceEventType,
    transformation: transformations[0] || "asserted",
    transformations,
    sourceHash: primarySource?.sourceHash || null,
    sourceIntegrityVerified: sourceRefs.every((sourceRef) => sourceRef.sourceIntegrityVerified !== false),
    sourceAvailableAtContributionTime: sourceRefs.every((sourceRef) => sourceRef.availableAtContributionTime !== false),
    sourceRefs,
    originalSourceHashes,
    corrections: attribution.corrections || [],
    disputes: attribution.disputes || [],
    revocations: attribution.revocations || [],
    auditTrail,
    derived: attribution.derived,
    explicitAttribution: attribution.explicit,
    createdAt: attribution.contributedAt || attribution.attributedAt
  };
  record.provenanceHash = contentHash({
    contributionId: record.contributionId,
    attributionId: record.attributionId,
    sourceRefs: record.sourceRefs,
    transformations: record.transformations,
    participantId: record.participantId,
    authorityContext: record.authorityContext
  });
  return record;
}

function explicitSourceRefs(provenance = {}) {
  if (!provenance || typeof provenance !== "object") {
    return [];
  }
  const refs = Array.isArray(provenance.sourceRefs)
    ? provenance.sourceRefs
    : Array.isArray(provenance.sources)
      ? provenance.sources
      : [];
  if (refs.length) {
    return refs.map((sourceRef) => ({
      ...sourceRef,
      transformation: sourceRef.transformation || provenance.transformation
    }));
  }

  const sourceType = provenance.sourceType || provenance.source_type;
  const sourceId = provenance.sourceId || provenance.source_id || provenance.sourceRef || provenance.source_ref;
  const sourceEventId = provenance.sourceEventId || provenance.source_event_id;
  if (!sourceType && !sourceId && !sourceEventId) {
    return [];
  }
  return [{
    sourceType,
    sourceId,
    sourceEventId,
    sourceHash: provenance.sourceHash || provenance.source_hash,
    packetHash: provenance.packetHash || provenance.packet_hash,
    transformation: provenance.transformation,
    sourceIntegrityVerified: provenance.sourceIntegrityVerified ?? provenance.source_integrity_verified,
    integrity: provenance.integrity || provenance.importIntegrity || provenance.import_integrity
  }];
}

function derivedSourceRefs(attribution, contributionEvent, indexes) {
  if (!contributionEvent) {
    return [];
  }
  const payload = contributionEvent.payload || {};
  const provenance = attribution.provenance || {};
  const refs = [];

  switch (contributionEvent.event_type) {
    case "EvidenceCommitted": {
      const evidence = payload.evidence;
      if (evidence?.source) {
        refs.push(enrichSourceRef({
          sourceType: "external_reference",
          sourceId: evidence.source,
          objectType: "evidence",
          objectId: evidence.id,
          sourceEventId: contributionEvent.event_id,
          sourceHash: evidence.contentHash,
          transformation: "observed"
        }, contributionEvent, indexes));
      }
      break;
    }
    case "ThreadForked": {
      const fork = payload.threadFork;
      refs.push(enrichSourceRef({
        sourceType: "fork",
        sourceId: fork?.forkThreadId || fork?.id || contributionEvent.thread_id,
        sourceEventId: contributionEvent.event_id,
        objectType: "threadFork",
        objectId: fork?.id || fork?.forkThreadId,
        transformation: "imported"
      }, contributionEvent, indexes));
      if (fork?.inheritedThroughEventId) {
        refs.push(enrichSourceRef({
          sourceType: "event",
          sourceId: fork.inheritedThroughEventId,
          sourceEventId: fork.inheritedThroughEventId,
          transformation: "imported"
        }, contributionEvent, indexes));
      }
      break;
    }
    case "MergeRequestOpened":
    case "MergeCompleted": {
      const object = payload.mergeRequest || payload.mergeCompletion;
      refs.push(enrichSourceRef({
        sourceType: "merge",
        sourceId: object?.mergeRequestId || object?.id,
        sourceEventId: contributionEvent.event_id,
        objectType: object?.object,
        objectId: object?.id,
        transformation: "merged"
      }, contributionEvent, indexes));
      addObjectRefs(refs, object?.acceptedObjectIds, "merged", contributionEvent, indexes);
      addObjectRefs(refs, object?.proposedEvidenceIds, "merged", contributionEvent, indexes);
      addObjectRefs(refs, object?.proposedClaimIds, "merged", contributionEvent, indexes);
      addObjectRefs(refs, object?.proposedAssumptionIds, "merged", contributionEvent, indexes);
      addObjectRefs(refs, object?.proposedObjectionIds, "merged", contributionEvent, indexes);
      addObjectRefs(refs, object?.proposedDecisionRecordIds, "merged", contributionEvent, indexes);
      break;
    }
    default:
      break;
  }

  addObjectRefs(refs, provenance.supportingEvidenceIds, "observed", contributionEvent, indexes);
  addObjectRefs(refs, provenance.supportingClaimIds, "summarized", contributionEvent, indexes);
  addObjectRefs(refs, provenance.supportingAssumptionIds, "inferred", contributionEvent, indexes);
  addObjectRefs(refs, provenance.objectionIds, "summarized", contributionEvent, indexes);
  addObjectRefs(refs, provenance.reviewIds, "summarized", contributionEvent, indexes);

  if (!refs.length) {
    refs.push(enrichSourceRef({
      sourceType: "event",
      sourceId: contributionEvent.event_id,
      sourceEventId: contributionEvent.event_id,
      transformation: transformationForContribution(attribution, contributionEvent)
    }, contributionEvent, indexes));
  }

  return dedupeSourceRefs(refs);
}

function addObjectRefs(refs, ids = [], transformation, contributionEvent, indexes) {
  for (const id of ids || []) {
    const entry = indexes.objectsById.get(id);
    if (!entry) {
      refs.push(enrichSourceRef({
        sourceType: "event",
        sourceId: id,
        objectId: id,
        transformation
      }, contributionEvent, indexes));
      continue;
    }
    const sourceType = entry.object?.object === "evidence" ? "evidence" : "event";
    refs.push(enrichSourceRef({
      sourceType,
      sourceId: sourceType === "evidence" ? id : entry.event.event_id,
      sourceEventId: entry.event.event_id,
      sourceEventType: entry.event.event_type,
      objectType: entry.object?.object || null,
      objectId: id,
      transformation
    }, contributionEvent, indexes));
  }
}

function enrichSourceRef(sourceRef, contributionEvent, indexes) {
  const normalized = normalizeSourceRef(sourceRef);
  const resolved = resolveSourceRef(normalized, indexes);
  const sourceEvent = resolved.event || null;
  const sourceObject = resolved.object || null;
  const expectedSourceHash = expectedHashForSource(sourceEvent, sourceObject);
  const providedSourceHash = normalized.sourceHash || expectedSourceHash || null;
  const contributionIndex = contributionEvent ? indexes.indexByEventId.get(contributionEvent.event_id) : undefined;
  const sourceIndex = sourceEvent ? indexes.indexByEventId.get(sourceEvent.event_id) : undefined;
  const hasProvidedHash = Boolean(normalized.sourceHash);
  const hashVerified = hasProvidedHash && expectedSourceHash
    ? normalized.sourceHash === expectedSourceHash
    : Boolean(expectedSourceHash || normalized.sourceIntegrityVerified);

  return {
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId || normalized.sourceEventId || sourceEvent?.event_id || null,
    sourceEventId: normalized.sourceEventId || sourceEvent?.event_id || null,
    sourceEventType: normalized.sourceEventType || sourceEvent?.event_type || null,
    objectType: normalized.objectType || sourceObject?.object || null,
    objectId: normalized.objectId || sourceObject?.id || null,
    transformation: normalizeTransformation(normalized.transformation) || "asserted",
    sourceHash: providedSourceHash,
    expectedSourceHash,
    sourceIntegrityVerified: hashVerified,
    availableAtContributionTime: sourceIndex === undefined || contributionIndex === undefined
      ? normalized.sourceType === "external_reference"
      : sourceIndex <= contributionIndex,
    packetHash: normalized.packetHash || null,
    integrity: normalized.integrity || null
  };
}

function normalizeSourceRef(sourceRef = {}) {
  const rawType = String(sourceRef.sourceType || sourceRef.source_type || "event")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return {
    sourceType: LEGACY_SOURCE_TYPES.get(rawType) || rawType,
    sourceId: sourceRef.sourceId || sourceRef.source_id || sourceRef.sourceRef || sourceRef.source_ref || null,
    sourceEventId: sourceRef.sourceEventId || sourceRef.source_event_id || null,
    sourceEventType: sourceRef.sourceEventType || sourceRef.source_event_type || null,
    objectType: sourceRef.objectType || sourceRef.object_type || null,
    objectId: sourceRef.objectId || sourceRef.object_id || null,
    transformation: sourceRef.transformation,
    sourceHash: sourceRef.sourceHash || sourceRef.source_hash || null,
    packetHash: sourceRef.packetHash || sourceRef.packet_hash || null,
    sourceIntegrityVerified: sourceRef.sourceIntegrityVerified ?? sourceRef.source_integrity_verified,
    integrity: sourceRef.integrity || sourceRef.importIntegrity || sourceRef.import_integrity || null
  };
}

function validateContributionProvenance(attribution, priorEvents = []) {
  const reasons = [];
  const provenance = attribution?.provenance;
  if (!provenance) {
    return reasons;
  }

  const indexes = buildIndexes(priorEvents);
  const sourceEventId = attribution.sourceEventId || attribution.eventId;
  const contributionEvent = indexes.eventsById.get(sourceEventId);
  if (!contributionEvent) {
    return reasons;
  }
  const contributionIndex = indexes.indexByEventId.get(contributionEvent.event_id);
  const refs = explicitSourceRefs(provenance);

  if (!refs.length) {
    return reasons;
  }

  for (const ref of refs) {
    const normalized = normalizeSourceRef(ref);
    if (!VALID_PROVENANCE_SOURCE_TYPES.has(normalized.sourceType)) {
      reasons.push(`unsupported provenance source_type ${normalized.sourceType}`);
      continue;
    }
    const transformation = normalizeTransformation(normalized.transformation);
    if (normalized.transformation && !VALID_PROVENANCE_TRANSFORMATIONS.has(transformation)) {
      reasons.push(`unsupported provenance transformation ${normalized.transformation}`);
    }

    if (normalized.sourceHash && !HASH_PATTERN.test(normalized.sourceHash)) {
      reasons.push(`malformed provenance source_hash ${normalized.sourceHash}`);
    }

    if (normalized.sourceType === "import" && !hasImportIntegrity(normalized)) {
      reasons.push("imported provenance requires integrity metadata");
    }
    if (normalized.sourceType === "continuity_packet" && !hasContinuityPacketHash(normalized)) {
      reasons.push("continuity packet provenance requires packet hash");
    }

    const resolved = resolveSourceRef(normalized, indexes);
    if (requiresResolvableSource(normalized) && !resolved.event && !resolved.object) {
      reasons.push(`provenance source does not exist: ${normalized.sourceId || normalized.sourceEventId || normalized.objectId}`);
      continue;
    }

    if (resolved.event) {
      const sourceIndex = indexes.indexByEventId.get(resolved.event.event_id);
      if (sourceIndex > contributionIndex) {
        reasons.push(`provenance cannot reference future source ${resolved.event.event_id}`);
      }
    }

    const expectedSourceHash = expectedHashForSource(resolved.event, resolved.object);
    if (normalized.sourceHash && expectedSourceHash && normalized.sourceHash !== expectedSourceHash) {
      reasons.push(`provenance source_hash does not match canonical source serialization for ${normalized.sourceId || normalized.sourceEventId}`);
    }
  }

  return reasons;
}

function projectProvenance(state) {
  const provenance = Array.from(state.records.values());
  return {
    schema: PROVENANCE_SCHEMA,
    theorem: "trusted_contribution = verify(attribution + source_provenance)",
    provenance,
    byContribution: groupBy(provenance, "contributionId"),
    bySource: groupBy(provenance, "sourceId"),
    byEvent: groupBy(provenance, "introducedByEventId"),
    corrections: state.corrections,
    disputes: state.disputes,
    revocations: state.revocations,
    provenanceValidationStatus: {
      valid: true,
      provenanceCount: provenance.length,
      sourceTypes: unique(provenance.map((record) => record.sourceType)),
      transformations: unique(provenance.flatMap((record) => record.transformations || [])),
      correctedCount: state.corrections.length,
      disputedCount: state.disputes.length,
      revokedCount: state.revocations.length
    }
  };
}

function provenanceForContribution(provenanceProjection, contributionId) {
  return {
    schema: "clista.provenance.contribution.v0",
    contributionId,
    provenance: provenanceProjection.byContribution[contributionId] || []
  };
}

function traceProvenance(provenanceProjection, contributionId) {
  const records = provenanceProjection.byContribution[contributionId] || [];
  return {
    schema: "clista.provenance.trace.v0",
    contributionId,
    records,
    trace: records.map((record) => ({
      contributionId: record.contributionId,
      attributionId: record.attributionId,
      participantId: record.participantId,
      authorityContext: record.authorityContext,
      introducedByEventId: record.introducedByEventId,
      transformations: record.transformations,
      sourceRefs: record.sourceRefs,
      auditTrail: record.auditTrail
    }))
  };
}

function selectProvenanceForThread(provenanceProjection, threadId) {
  const provenance = provenanceProjection.provenance
    .filter((record) => record.threadId === threadId)
    .map(compactThreadProvenanceRecord);
  return {
    schema: "clista.provenance.thread.v0",
    threadId,
    provenance,
    byContribution: groupBy(provenance, "contributionId"),
    bySource: groupBy(provenance, "sourceId"),
    byEvent: groupBy(provenance, "introducedByEventId")
  };
}

function compactThreadProvenanceRecord(record) {
  return {
    id: record.id,
    object: record.object,
    contributionId: record.contributionId,
    contributionType: record.contributionType,
    attributionId: record.attributionId,
    attributionStatus: record.attributionStatus,
    threadId: record.threadId,
    participantId: record.participantId,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    sourceEventId: record.sourceEventId,
    introducedByEventId: record.introducedByEventId,
    transformation: record.transformation,
    transformations: record.transformations,
    sourceIntegrityVerified: record.sourceIntegrityVerified,
    sourceAvailableAtContributionTime: record.sourceAvailableAtContributionTime,
    sourceRefs: (record.sourceRefs || []).map((sourceRef) => ({
      sourceType: sourceRef.sourceType,
      sourceId: sourceRef.sourceId,
      sourceEventId: sourceRef.sourceEventId,
      objectType: sourceRef.objectType,
      objectId: sourceRef.objectId,
      transformation: sourceRef.transformation,
      sourceIntegrityVerified: sourceRef.sourceIntegrityVerified,
      availableAtContributionTime: sourceRef.availableAtContributionTime
    })),
    auditTrail: record.auditTrail,
    provenanceHash: record.provenanceHash
  };
}

function formatProvenanceReasons(reasons) {
  return reasons.map((error) => {
    const eventId = error.event_id || `index ${error.index}`;
    return `${eventId}: ${error.reason}`;
  }).join("\n");
}

function provenanceAuditTrail(attribution) {
  return [
    ...(attribution.corrections || []).map((correction) => ({
      eventId: correction.sourceEventId,
      transformation: "corrected",
      at: correction.correctedAt,
      by: correction.correctedBy,
      reason: correction.reason
    })),
    ...(attribution.disputes || []).map((dispute) => ({
      eventId: dispute.sourceEventId,
      transformation: "disputed",
      at: dispute.disputedAt,
      by: dispute.disputedBy,
      reason: dispute.reason
    })),
    ...(attribution.revocations || []).map((revocation) => ({
      eventId: revocation.sourceEventId,
      transformation: "revoked",
      at: revocation.revokedAt,
      by: revocation.revokedBy,
      reason: revocation.reason
    }))
  ];
}

function resolveSourceRef(sourceRef, indexes) {
  const sourceId = sourceRef.sourceId || sourceRef.sourceEventId || sourceRef.objectId;
  if (sourceRef.sourceEventId && indexes.eventsById.has(sourceRef.sourceEventId)) {
    const event = indexes.eventsById.get(sourceRef.sourceEventId);
    return { event, object: primaryObject(event) };
  }
  if (sourceRef.sourceType === "event" || sourceRef.sourceType === "projection") {
    const event = indexes.eventsById.get(sourceId);
    return { event, object: event ? primaryObject(event) : null };
  }
  if (sourceRef.sourceType === "evidence") {
    const objectEntry = indexes.objectsById.get(sourceId);
    return objectEntry?.object?.object === "evidence"
      ? { event: objectEntry.event, object: objectEntry.object }
      : { event: null, object: null };
  }
  if (sourceRef.sourceType === "fork") {
    const objectEntry = indexes.objectsById.get(sourceId)
      || Array.from(indexes.objectsById.values()).find((entry) => entry.object?.forkThreadId === sourceId);
    return objectEntry ? { event: objectEntry.event, object: objectEntry.object } : { event: null, object: null };
  }
  if (sourceRef.sourceType === "merge") {
    const objectEntry = indexes.objectsById.get(sourceId);
    if (objectEntry && String(objectEntry.object?.object || "").startsWith("merge")) {
      return { event: objectEntry.event, object: objectEntry.object };
    }
    const mergeEntry = Array.from(indexes.objectsById.values()).find((entry) => {
      return String(entry.object?.object || "").startsWith("merge") && entry.object?.mergeRequestId === sourceId;
    });
    return mergeEntry ? { event: mergeEntry.event, object: mergeEntry.object } : { event: null, object: null };
  }
  if (sourceRef.sourceType === "external_reference" || sourceRef.sourceType === "import" || sourceRef.sourceType === "continuity_packet") {
    return { event: null, object: null };
  }
  return { event: null, object: null };
}

function expectedHashForSource(event, object) {
  if (object?.contentHash) {
    return object.contentHash;
  }
  if (event) {
    return event.content_hash || computeEventHash(event);
  }
  return null;
}

function requiresResolvableSource(sourceRef) {
  return ["event", "evidence", "fork", "merge", "projection"].includes(sourceRef.sourceType);
}

function hasImportIntegrity(sourceRef) {
  return Boolean(
    sourceRef.sourceHash
    || sourceRef.integrity?.sourceHash
    || sourceRef.integrity?.eventLogHash
    || sourceRef.integrity?.verified === true
    || sourceRef.sourceIntegrityVerified === true
  );
}

function hasContinuityPacketHash(sourceRef) {
  return Boolean(sourceRef.packetHash || sourceRef.sourceHash || sourceRef.integrity?.packetHash);
}

function transformationForContribution(attribution, event) {
  switch (event?.event_type) {
    case "EvidenceCommitted":
    case "OutcomeAudited":
      return "observed";
    case "AssumptionDeclared":
    case "DecisionScored":
      return "inferred";
    case "DecisionRequestOpened":
    case "ReviewSubmitted":
    case "DecisionMerged":
    case "MinorityReportFiled":
      return "summarized";
    case "ThreadForked":
      return "imported";
    case "MergeRequestOpened":
    case "MergeCompleted":
    case "MergeConflictDeclared":
    case "MergeConflictResolved":
      return "merged";
    default:
      return normalizeTransformation(attribution?.provenance?.transformation) || "asserted";
  }
}

function normalizeTransformation(transformation) {
  if (!transformation) {
    return null;
  }
  return String(transformation)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function buildIndexes(events = []) {
  const eventsById = new Map();
  const indexByEventId = new Map();
  const objectsById = new Map();

  events.forEach((event, index) => {
    if (event?.event_id) {
      eventsById.set(event.event_id, event);
      indexByEventId.set(event.event_id, index);
    }
    const object = primaryObject(event);
    if (object?.id) {
      objectsById.set(object.id, { object, event });
    }
    if (object?.forkThreadId) {
      objectsById.set(object.forkThreadId, { object, event });
    }
    if (object?.mergeRequestId && object.object === "mergeRequest") {
      objectsById.set(object.mergeRequestId, { object, event });
    }
  });

  return { eventsById, indexByEventId, objectsById };
}

function primaryObject(event) {
  const payload = event?.payload || {};
  return payload.thread
    || payload.threadFork
    || payload.participant
    || payload.participantRole
    || payload.participantAuthority
    || payload.participantAuthorityRevocation
    || payload.contributionAttribution
    || payload.attributionCorrection
    || payload.attributionDispute
    || payload.attributionRevocation
    || payload.evidence
    || payload.assumption
    || payload.claim
    || payload.position
    || payload.objection
    || payload.alignmentSnapshot
    || payload.decisionRequest
    || payload.review
    || payload.decisionRecord
    || payload.minorityReport
    || payload.mergeRequest
    || payload.mergeReview
    || payload.mergeConflict
    || payload.mergeConflictResolution
    || payload.mergeCompletion
    || payload.expectedOutcome
    || payload.outcomeAudit
    || payload.decisionScore
    || null;
}

function dedupeSourceRefs(sourceRefs) {
  const seen = new Set();
  const deduped = [];
  for (const sourceRef of sourceRefs) {
    const key = [
      sourceRef.sourceType,
      sourceRef.sourceId,
      sourceRef.sourceEventId,
      sourceRef.objectId,
      sourceRef.transformation
    ].join(":");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(sourceRef);
  }
  return deduped;
}

function groupBy(records, key) {
  return records.reduce((grouped, record) => {
    const value = record[key];
    if (!value) {
      return grouped;
    }
    if (!grouped[value]) {
      grouped[value] = [];
    }
    grouped[value].push(record);
    return grouped;
  }, {});
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

module.exports = {
  PROVENANCE_SCHEMA,
  PROVENANCE_VERIFY_SCHEMA,
  VALID_PROVENANCE_SOURCE_TYPES,
  VALID_PROVENANCE_TRANSFORMATIONS,
  buildProvenanceState,
  emptyProvenanceState,
  formatProvenanceReasons,
  projectProvenance,
  provenanceForContribution,
  selectProvenanceForThread,
  traceProvenance,
  validateContributionProvenance
};
