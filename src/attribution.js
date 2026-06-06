const {
  VALID_AUTHORITIES,
  activeAuthoritiesFor,
  buildIdentityState,
  normalizeAuthority,
  normalizeRole
} = require("./identity");

const ATTRIBUTION_EVENT_TYPES = new Set([
  "ContributionAttributed",
  "ContributionAttributionCorrected",
  "ContributionAttributionDisputed",
  "ContributionAttributionRevoked"
]);

const VALID_CONTRIBUTION_TYPES = new Set([
  "evidence",
  "assumption",
  "claim",
  "position",
  "objection",
  "objection_resolution",
  "decision_request",
  "governance",
  "decision",
  "minority_report",
  "outcome",
  "outcome_audit",
  "decision_score",
  "fork",
  "merge",
  "merge_conflict",
  "merge_conflict_resolution",
  "merge_completion"
]);

const REQUIRED_AUTHORITY_BY_CONTRIBUTION_TYPE = new Map([
  ["decision", "decision_owner"],
  ["merge_completion", "decision_owner"]
]);

function emptyAttributionState() {
  return {
    records: new Map(),
    corrections: [],
    disputes: [],
    revocations: []
  };
}

function buildAttributionState(events = []) {
  const state = emptyAttributionState();
  const priorEvents = [];

  for (const event of events) {
    const derived = deriveContributionFromEvent(event, priorEvents);
    if (derived) {
      addAttributionRecord(state, derived);
    }

    const payload = event?.payload || {};
    switch (event?.event_type) {
      case "ContributionAttributed": {
        const explicit = normalizeExplicitAttribution(payload.contributionAttribution, event, priorEvents);
        if (explicit) {
          addAttributionRecord(state, explicit);
        }
        break;
      }
      case "ContributionAttributionCorrected":
        applyAttributionCorrection(state, payload.attributionCorrection, event);
        break;
      case "ContributionAttributionDisputed":
        applyAttributionDispute(state, payload.attributionDispute, event);
        break;
      case "ContributionAttributionRevoked":
        applyAttributionRevocation(state, payload.attributionRevocation, event);
        break;
      default:
        break;
    }

    priorEvents.push(event);
  }

  return state;
}

function deriveContributionFromEvent(event, priorEvents = []) {
  const meta = contributionMetaForEvent(event);
  if (!meta) {
    return null;
  }
  const identityAtEventTime = buildIdentityState(priorEvents);
  return buildAttributionRecord({
    id: `atr_${event.event_id}`,
    explicit: false,
    derived: true,
    attributedBy: "protocol_projection",
    attributedAt: event.timestamp,
    ...meta
  }, event, identityAtEventTime);
}

function normalizeExplicitAttribution(attribution, event, priorEvents) {
  if (!attribution) {
    return null;
  }
  const resolved = resolveContributionAttribution(attribution, priorEvents);
  const source = resolved.sourceRecord;
  return {
    ...(source || {}),
    id: attribution.id || `atr_${event.event_id}`,
    object: "contributionAttribution",
    contributionId: attribution.contributionId || source?.contributionId,
    contributionType: normalizeContributionType(attribution.contributionType || source?.contributionType),
    sourceEventId: attribution.sourceEventId || attribution.eventId || source?.sourceEventId,
    sourceEventType: source?.sourceEventType || null,
    threadId: attribution.threadId || source?.threadId || event.thread_id,
    participantId: attribution.participantId || source?.participantId,
    role: attribution.role ? normalizeRole(attribution.role) : source?.role || null,
    roleContext: {
      ...(source?.roleContext || {}),
      ...(attribution.roleContext || {})
    },
    authorityContext: {
      ...(source?.authorityContext || {}),
      ...(attribution.authorityContext || {})
    },
    provenance: {
      ...(source?.provenance || {}),
      ...(attribution.provenance || {})
    },
    attributedBy: attribution.attributedBy || event.actor_id,
    attributedAt: attribution.attributedAt || event.timestamp,
    explicit: true,
    derived: false,
    status: "active"
  };
}

function buildAttributionRecord(meta, event, identityAtEventTime) {
  const participant = identityAtEventTime.participants.get(meta.participantId) || null;
  const roleRecord = latestRoleForParticipant(identityAtEventTime, meta.participantId, meta.threadId);
  const authorities = activeAuthoritiesForParticipant(identityAtEventTime, meta.participantId, meta.threadId);
  const requiredAuthority = requiredAuthorityForContributionType(meta.contributionType);
  const requiredAuthorityRecord = requiredAuthority
    ? authorities.find((authority) => authority.authority === requiredAuthority) || null
    : null;

  return {
    id: meta.id,
    object: "contributionAttribution",
    contributionId: meta.contributionId,
    contributionType: meta.contributionType,
    sourceEventId: event.event_id,
    sourceEventType: event.event_type,
    threadId: meta.threadId || event.thread_id,
    participantId: meta.participantId,
    participantActiveAtEventTime: Boolean(participant),
    participantActiveNow: Boolean(participant),
    contributedAt: event.timestamp,
    role: roleRecord?.role || null,
    roleContext: {
      role: roleRecord?.role || null,
      displayRole: roleRecord?.displayRole || null,
      scope: roleRecord?.scope || null,
      threadId: roleRecord?.threadId || null,
      sourceEventId: roleRecord?.sourceEventId || null,
      assignedAt: roleRecord?.assignedAt || null,
      activeAtEventTime: Boolean(roleRecord),
      legacy: Boolean(roleRecord?.legacy)
    },
    authorityContext: {
      activeAtEventTime: Boolean(participant),
      requiredAuthority,
      permitted: !requiredAuthority || Boolean(requiredAuthorityRecord),
      decision_owner: authorities.some((authority) => authority.authority === "decision_owner"),
      authorityScope: requiredAuthorityRecord?.scope || null,
      threadId: requiredAuthorityRecord?.threadId || null,
      activeAuthorities: authorities.map((authority) => ({
        authority: authority.authority,
        scope: authority.scope,
        threadId: authority.threadId || null,
        sourceEventId: authority.sourceEventId || null,
        legacy: Boolean(authority.legacy)
      }))
    },
    provenance: {
      sourceEventId: event.event_id,
      sourceType: "event_log",
      sourceRef: event.event_id,
      supportingEvidenceIds: meta.supportingEvidenceIds || [],
      supportingClaimIds: meta.supportingClaimIds || [],
      supportingAssumptionIds: meta.supportingAssumptionIds || [],
      objectionIds: meta.objectionIds || [],
      reviewIds: meta.reviewIds || []
    },
    attributedBy: meta.attributedBy,
    attributedAt: meta.attributedAt,
    explicit: Boolean(meta.explicit),
    derived: Boolean(meta.derived),
    status: "active",
    corrections: [],
    disputes: [],
    revocations: []
  };
}

function contributionMetaForEvent(event) {
  const payload = event?.payload || {};
  switch (event?.event_type) {
    case "EvidenceCommitted":
      return metaFromObject(event, payload.evidence, "evidence", payload.evidence?.committedByParticipantId);
    case "AssumptionDeclared":
      return metaFromObject(event, payload.assumption, "assumption", payload.assumption?.declaredByParticipantId, {
        supportingEvidenceIds: payload.assumption?.evidenceIds
      });
    case "ClaimCreated":
      return metaFromObject(event, payload.claim, "claim", payload.claim?.createdByParticipantId, {
        supportingEvidenceIds: payload.claim?.evidenceIds,
        supportingAssumptionIds: payload.claim?.assumptionIds
      });
    case "PositionTaken":
      return metaFromObject(event, payload.position, "position", payload.position?.participantId);
    case "ObjectionRaised":
      return metaFromObject(event, payload.objection, "objection", payload.objection?.participantId);
    case "ObjectionResolved": {
      const objectionId = payload.objectionId || payload.objection?.id;
      if (!objectionId) {
        return null;
      }
      return {
        contributionId: `obr_${objectionId}_${event.event_id}`,
        contributionType: "objection_resolution",
        threadId: event.thread_id,
        participantId: event.actor_id,
        objectionIds: [objectionId]
      };
    }
    case "DecisionRequestOpened":
      return metaFromObject(event, payload.decisionRequest, "decision_request", payload.decisionRequest?.openedByParticipantId, {
        supportingEvidenceIds: payload.decisionRequest?.supportingEvidenceIds,
        supportingClaimIds: payload.decisionRequest?.supportingClaimIds,
        supportingAssumptionIds: payload.decisionRequest?.supportingAssumptionIds,
        objectionIds: payload.decisionRequest?.objectionIds
      });
    case "ReviewSubmitted":
      return metaFromObject(event, payload.review, "governance", payload.review?.reviewerParticipantId);
    case "DecisionMerged":
      return metaFromObject(event, payload.decisionRecord, "decision", payload.decisionRecord?.decidedByParticipantId, {
        supportingEvidenceIds: payload.decisionRecord?.supportingEvidenceIds,
        supportingClaimIds: payload.decisionRecord?.supportingClaimIds,
        supportingAssumptionIds: payload.decisionRecord?.supportingAssumptionIds,
        objectionIds: payload.decisionRecord?.objectionIds,
        reviewIds: payload.decisionRecord?.reviewIds
      });
    case "MinorityReportFiled":
      return metaFromObject(event, payload.minorityReport, "minority_report", payload.minorityReport?.participantId, {
        objectionIds: payload.minorityReport?.objectionIds
      });
    case "ExpectedOutcomeDeclared":
      return metaFromObject(event, payload.expectedOutcome, "outcome", payload.expectedOutcome?.declaredByParticipantId, {
        supportingEvidenceIds: payload.expectedOutcome?.evidenceIds,
        supportingAssumptionIds: payload.expectedOutcome?.assumptionIds
      });
    case "OutcomeAudited":
      return metaFromObject(event, payload.outcomeAudit, "outcome_audit", payload.outcomeAudit?.auditedBy || payload.outcomeAudit?.auditedByParticipantId, {
        supportingEvidenceIds: payload.outcomeAudit?.evidenceIds,
        supportingAssumptionIds: payload.outcomeAudit?.failedAssumptionIds
      });
    case "DecisionScored":
      return metaFromObject(event, payload.decisionScore, "decision_score", payload.decisionScore?.scoredByParticipantId, {
        supportingEvidenceIds: payload.decisionScore?.basedOnOutcomeAuditIds
      });
    case "ThreadForked":
      return metaFromObject(event, payload.threadFork, "fork", payload.threadFork?.forkedBy);
    case "MergeRequestOpened":
      return metaFromObject(event, payload.mergeRequest, "merge", payload.mergeRequest?.openedBy, {
        supportingEvidenceIds: payload.mergeRequest?.proposedEvidenceIds,
        supportingClaimIds: payload.mergeRequest?.proposedClaimIds,
        supportingAssumptionIds: payload.mergeRequest?.proposedAssumptionIds,
        objectionIds: payload.mergeRequest?.proposedObjectionIds
      });
    case "MergeReviewSubmitted":
      return metaFromObject(event, payload.mergeReview, "governance", payload.mergeReview?.reviewerId || payload.mergeReview?.reviewerParticipantId);
    case "MergeConflictDeclared":
      return metaFromObject(event, payload.mergeConflict, "merge_conflict", payload.mergeConflict?.declaredBy || event.actor_id);
    case "MergeConflictResolved":
      return metaFromObject(event, payload.mergeConflictResolution, "merge_conflict_resolution", payload.mergeConflictResolution?.resolvedBy);
    case "MergeCompleted":
      return metaFromObject(event, payload.mergeCompletion, "merge_completion", payload.mergeCompletion?.mergedBy);
    default:
      return null;
  }
}

function metaFromObject(event, object, contributionType, participantId, provenance = {}) {
  if (!object?.id || !participantId) {
    return null;
  }
  return {
    contributionId: object.id,
    contributionType,
    threadId: object.threadId || event.thread_id,
    participantId,
    supportingEvidenceIds: provenance.supportingEvidenceIds || [],
    supportingClaimIds: provenance.supportingClaimIds || [],
    supportingAssumptionIds: provenance.supportingAssumptionIds || [],
    objectionIds: provenance.objectionIds || [],
    reviewIds: provenance.reviewIds || []
  };
}

function validateContributionAttribution(attribution, priorEvents) {
  const reasons = [];
  if (!attribution?.id) {
    reasons.push("ContributionAttributed payload missing contributionAttribution.id");
  }
  if (!attribution?.contributionId) {
    reasons.push("contribution attribution requires contributionId");
  }
  if (!attribution?.sourceEventId && !attribution?.eventId) {
    reasons.push("contribution attribution requires sourceEventId");
  }
  if (!attribution?.participantId) {
    reasons.push("contribution attribution requires participantId");
  }
  const contributionType = normalizeContributionType(attribution?.contributionType);
  if (!VALID_CONTRIBUTION_TYPES.has(contributionType)) {
    reasons.push(`unsupported contribution type ${attribution?.contributionType}`);
  }

  const resolved = resolveContributionAttribution(attribution, priorEvents);
  const sourceRecord = resolved.sourceRecord;
  if (!sourceRecord) {
    reasons.push(`attribution source event is not attributable: ${attribution?.sourceEventId || attribution?.eventId}`);
    return reasons;
  }
  if (attribution.contributionId && attribution.contributionId !== sourceRecord.contributionId) {
    reasons.push(`attribution contributionId ${attribution.contributionId} does not match source contribution ${sourceRecord.contributionId}`);
  }
  if (contributionType && contributionType !== sourceRecord.contributionType) {
    reasons.push(`attribution contributionType ${contributionType} does not match source contribution type ${sourceRecord.contributionType}`);
  }
  if (attribution.participantId && attribution.participantId !== sourceRecord.participantId) {
    reasons.push(`attribution participant ${attribution.participantId} does not match source event participant ${sourceRecord.participantId}`);
  }
  if (!sourceRecord.participantActiveAtEventTime) {
    reasons.push(`participant ${sourceRecord.participantId} was not active at contribution event time`);
  }
  if (attribution.participantId) {
    const identityAtEventTime = identityStateBeforeEvent(priorEvents, sourceRecord.sourceEventId);
    if (!identityAtEventTime.participants.has(attribution.participantId)) {
      reasons.push(`participant ${attribution.participantId} was not active at contribution event time`);
    }
  }
  if (attribution.role && normalizeRole(attribution.role) !== sourceRecord.role) {
    reasons.push(`attribution role ${attribution.role} was not valid at contribution event time`);
  }
  if (sourceRecord.authorityContext.requiredAuthority && !sourceRecord.authorityContext.permitted) {
    reasons.push(`authority context does not permit contribution type ${sourceRecord.contributionType}`);
  }
  if (attribution.authorityContext?.activeAtEventTime === false) {
    reasons.push("attribution authorityContext.activeAtEventTime cannot be false");
  }
  if (
    attribution.authorityContext
    && attribution.authorityContext.decision_owner !== undefined
    && Boolean(attribution.authorityContext.decision_owner) !== Boolean(sourceRecord.authorityContext.decision_owner)
  ) {
    reasons.push("attribution authority context does not match event-time authority");
  }

  return reasons;
}

function validateAttributionCorrection(correction, priorEvents) {
  const reasons = [];
  if (!correction?.id) {
    reasons.push("ContributionAttributionCorrected payload missing attributionCorrection.id");
  }
  if (!correction?.attributionId) {
    reasons.push("attribution correction requires attributionId");
    return reasons;
  }
  const state = buildAttributionState(priorEvents);
  const record = state.records.get(correction.attributionId);
  if (!record) {
    reasons.push(`attribution correction references unknown attribution ${correction.attributionId}`);
    return reasons;
  }
  if (!String(correction.reason || correction.rationale || "").trim()) {
    reasons.push("attribution correction requires reason");
  }
  if (correction.correctedParticipantId) {
    const identityAtEventTime = identityStateBeforeEvent(priorEvents, record.sourceEventId);
    if (!identityAtEventTime.participants.has(correction.correctedParticipantId)) {
      reasons.push(`corrected participant ${correction.correctedParticipantId} was not active at contribution event time`);
    }
    if (correction.correctedRole) {
      const role = latestRoleForParticipant(identityAtEventTime, correction.correctedParticipantId, record.threadId);
      if (!role || role.role !== normalizeRole(correction.correctedRole)) {
        reasons.push(`corrected role ${correction.correctedRole} was not valid at contribution event time`);
      }
    }
  }
  return reasons;
}

function validateAttributionDispute(dispute, priorEvents) {
  const reasons = [];
  if (!dispute?.id) {
    reasons.push("ContributionAttributionDisputed payload missing attributionDispute.id");
  }
  if (!dispute?.attributionId) {
    reasons.push("attribution dispute requires attributionId");
    return reasons;
  }
  const state = buildAttributionState(priorEvents);
  if (!state.records.has(dispute.attributionId)) {
    reasons.push(`attribution dispute references unknown attribution ${dispute.attributionId}`);
  }
  if (!String(dispute.reason || "").trim()) {
    reasons.push("attribution dispute requires reason");
  }
  return reasons;
}

function validateAttributionRevocation(revocation, priorEvents) {
  const reasons = [];
  if (!revocation?.id) {
    reasons.push("ContributionAttributionRevoked payload missing attributionRevocation.id");
  }
  if (!revocation?.attributionId) {
    reasons.push("attribution revocation requires attributionId");
    return reasons;
  }
  const state = buildAttributionState(priorEvents);
  if (!state.records.has(revocation.attributionId)) {
    reasons.push(`attribution revocation references unknown attribution ${revocation.attributionId}`);
  }
  if (!String(revocation.reason || "").trim()) {
    reasons.push("attribution revocation requires reason");
  }
  return reasons;
}

function resolveContributionAttribution(attribution, priorEvents) {
  const sourceEventId = attribution?.sourceEventId || attribution?.eventId;
  const sourceIndex = priorEvents.findIndex((event) => event.event_id === sourceEventId);
  if (sourceIndex === -1) {
    return { sourceEvent: null, sourceRecord: null };
  }
  const sourceEvent = priorEvents[sourceIndex];
  const sourceRecord = deriveContributionFromEvent(sourceEvent, priorEvents.slice(0, sourceIndex));
  return { sourceEvent, sourceRecord };
}

function identityStateBeforeEvent(events, eventId) {
  const index = events.findIndex((event) => event.event_id === eventId);
  return buildIdentityState(index === -1 ? events : events.slice(0, index));
}

function addAttributionRecord(state, record) {
  if (!record?.id) {
    return;
  }
  state.records.set(record.id, record);
}

function applyAttributionCorrection(state, correction, event) {
  if (!correction?.attributionId) {
    return;
  }
  const normalized = {
    id: correction.id || `atc_${event.event_id}`,
    object: "attributionCorrection",
    attributionId: correction.attributionId,
    correctedParticipantId: correction.correctedParticipantId || null,
    correctedRole: correction.correctedRole ? normalizeRole(correction.correctedRole) : null,
    reason: correction.reason || correction.rationale,
    correctedBy: correction.correctedBy || event.actor_id,
    correctedAt: correction.correctedAt || event.timestamp,
    sourceEventId: event.event_id
  };
  state.corrections.push(normalized);
  const record = state.records.get(correction.attributionId);
  if (record) {
    record.status = "corrected";
    record.corrections.push(normalized);
    record.latestCorrection = normalized;
  }
}

function applyAttributionDispute(state, dispute, event) {
  if (!dispute?.attributionId) {
    return;
  }
  const normalized = {
    id: dispute.id || `atd_${event.event_id}`,
    object: "attributionDispute",
    attributionId: dispute.attributionId,
    reason: dispute.reason,
    disputedBy: dispute.disputedBy || event.actor_id,
    disputedAt: dispute.disputedAt || event.timestamp,
    sourceEventId: event.event_id
  };
  state.disputes.push(normalized);
  const record = state.records.get(dispute.attributionId);
  if (record) {
    record.status = record.status === "revoked" ? "revoked" : "disputed";
    record.disputes.push(normalized);
  }
}

function applyAttributionRevocation(state, revocation, event) {
  if (!revocation?.attributionId) {
    return;
  }
  const normalized = {
    id: revocation.id || `atv_${event.event_id}`,
    object: "attributionRevocation",
    attributionId: revocation.attributionId,
    reason: revocation.reason,
    revokedBy: revocation.revokedBy || event.actor_id,
    revokedAt: revocation.revokedAt || event.timestamp,
    sourceEventId: event.event_id
  };
  state.revocations.push(normalized);
  const record = state.records.get(revocation.attributionId);
  if (record) {
    record.status = "revoked";
    record.revocations.push(normalized);
    record.latestRevocation = normalized;
  }
}

function projectAttribution(state, finalIdentityState) {
  const attributions = Array.from(state.records.values()).map((record) => ({
    ...record,
    participantActiveNow: finalIdentityState
      ? finalIdentityState.participants.has(record.participantId)
      : record.participantActiveNow
  }));
  return {
    schema: "clista.attribution.v0",
    attributions,
    byContribution: groupBy(attributions, "contributionId"),
    byParticipant: groupBy(attributions, "participantId"),
    byEvent: groupBy(attributions, "sourceEventId"),
    corrections: state.corrections,
    disputes: state.disputes,
    revocations: state.revocations,
    attributionValidationStatus: {
      valid: true,
      attributionCount: attributions.length,
      correctedCount: state.corrections.length,
      disputedCount: state.disputes.length,
      revokedCount: state.revocations.length
    }
  };
}

function attributionForContribution(attributionProjection, contributionId) {
  return {
    schema: "clista.attribution.contribution.v0",
    contributionId,
    attributions: attributionProjection.byContribution[contributionId] || [],
    corrections: attributionProjection.corrections.filter((correction) => {
      return (attributionProjection.byContribution[contributionId] || [])
        .some((record) => record.id === correction.attributionId);
    }),
    disputes: attributionProjection.disputes.filter((dispute) => {
      return (attributionProjection.byContribution[contributionId] || [])
        .some((record) => record.id === dispute.attributionId);
    }),
    revocations: attributionProjection.revocations.filter((revocation) => {
      return (attributionProjection.byContribution[contributionId] || [])
        .some((record) => record.id === revocation.attributionId);
    })
  };
}

function attributionsForParticipant(attributionProjection, participantId) {
  return {
    schema: "clista.attribution.participant.v0",
    participantId,
    attributions: attributionProjection.byParticipant[participantId] || []
  };
}

function selectAttributionForThread(attributionProjection, threadId) {
  const attributions = attributionProjection.attributions.filter((record) => record.threadId === threadId);
  const attributionIds = new Set(attributions.map((record) => record.id));
  return {
    schema: "clista.attribution.thread.v0",
    threadId,
    attributions,
    byContribution: groupBy(attributions, "contributionId"),
    byParticipant: groupBy(attributions, "participantId"),
    byEvent: groupBy(attributions, "sourceEventId"),
    corrections: attributionProjection.corrections.filter((correction) => attributionIds.has(correction.attributionId)),
    disputes: attributionProjection.disputes.filter((dispute) => attributionIds.has(dispute.attributionId)),
    revocations: attributionProjection.revocations.filter((revocation) => attributionIds.has(revocation.attributionId))
  };
}

function activeAuthoritiesForParticipant(identityState, participantId, threadId) {
  return Array.from(VALID_AUTHORITIES)
    .flatMap((authority) => activeAuthoritiesFor(identityState, authority, threadId))
    .filter((authority) => authority.participantId === participantId)
    .map((authority) => ({
      ...authority,
      authority: normalizeAuthority(authority.authority)
    }));
}

function latestRoleForParticipant(identityState, participantId, threadId) {
  return identityState.roles
    .filter((role) => role.participantId === participantId)
    .filter((role) => role.scope === "global" || role.threadId === threadId)
    .at(-1) || null;
}

function requiredAuthorityForContributionType(contributionType) {
  return REQUIRED_AUTHORITY_BY_CONTRIBUTION_TYPE.get(normalizeContributionType(contributionType)) || null;
}

function normalizeContributionType(contributionType) {
  return String(contributionType || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
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

module.exports = {
  ATTRIBUTION_EVENT_TYPES,
  VALID_CONTRIBUTION_TYPES,
  attributionForContribution,
  attributionsForParticipant,
  buildAttributionState,
  deriveContributionFromEvent,
  emptyAttributionState,
  normalizeContributionType,
  projectAttribution,
  requiredAuthorityForContributionType,
  selectAttributionForThread,
  validateAttributionCorrection,
  validateAttributionDispute,
  validateAttributionRevocation,
  validateContributionAttribution
};
