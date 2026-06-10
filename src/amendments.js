const { contentHash } = require("./integrity");
const { groupByByValues, indexBy, normalizeType, stripUndefined, unique } = require("./utils");

const AMENDMENT_SCHEMA = "clista.amendments.v0";
const AMENDMENT_VERIFY_SCHEMA = "clista.amendments.verify.v0";

const AMENDMENT_EVENT_TYPES = new Set([
  "ProtocolAmendmentProposed",
  "ProtocolAmendmentReviewed",
  "ProtocolAmendmentApproved",
  "ProtocolAmendmentRejected",
  "ProtocolAmendmentSuperseded"
]);

const VALID_AMENDMENT_TYPES = new Set([
  "protocol_rule",
  "governance_requirement",
  "evidence_threshold",
  "revisit_trigger",
  "decision_gate",
  "schema",
  "validation_policy",
  "interpretive_guidance"
]);

const VALID_EFFECT_SCOPES = new Set([
  "future_only",
  "interpretive_guidance"
]);

const VALID_REVIEW_STATUSES = new Set([
  "comment",
  "approve",
  "request_changes",
  "reject"
]);

const FORBIDDEN_KEY_PATTERNS = [
  /automatic.?amend/i,
  /implicit.?mutation/i,
  /hidden.?policy/i,
  /retroactive.?mutation/i,
  /retroactive.?rewrite/i,
  /rewrite.?past/i,
  /rewrite.?event/i,
  /rewrite.?history/i,
  /recommendation.?becomes.?amendment/i
];

const GUARD_FIELDS = new Set([
  "automaticAmendment",
  "implicitMutation",
  "hiddenPolicyMutation",
  "retroactiveMutation",
  "rewritesPastEvents",
  "recommendationBecomesAmendment"
]);

function emptyAmendmentState() {
  return {
    entries: []
  };
}

function buildAmendmentState(events = []) {
  const state = emptyAmendmentState();
  applyExplicitAmendmentEvents(events, state);
  return state;
}

function applyExplicitAmendmentEvents(events, state) {
  for (const event of events || []) {
    const payload = event.payload || {};
    switch (event.event_type) {
      case "ProtocolAmendmentProposed":
        addEntry(state, "proposal", normalizeProtocolAmendment(
          payload.protocolAmendment || payload.amendment,
          event
        ));
        break;
      case "ProtocolAmendmentReviewed":
        addEntry(state, "review", normalizeAmendmentReview(
          payload.protocolAmendmentReview || payload.amendmentReview,
          event
        ));
        break;
      case "ProtocolAmendmentApproved":
        addEntry(state, "approval", normalizeAmendmentApproval(
          payload.protocolAmendmentApproval || payload.amendmentApproval,
          event
        ));
        break;
      case "ProtocolAmendmentRejected":
        addEntry(state, "rejection", normalizeAmendmentRejection(
          payload.protocolAmendmentRejection || payload.amendmentRejection,
          event
        ));
        break;
      case "ProtocolAmendmentSuperseded":
        addEntry(state, "supersession", normalizeAmendmentSupersession(
          payload.protocolAmendmentSupersession || payload.amendmentSupersession,
          event
        ));
        break;
      default:
        break;
    }
  }
}

function projectAmendments(state) {
  const amendments = {};
  const proposals = [];
  const reviews = [];
  const approvals = [];
  const rejections = [];
  const supersessions = [];

  for (const entry of state.entries) {
    const record = entry.record;
    if (!record) {
      continue;
    }
    switch (entry.kind) {
      case "proposal":
        amendments[record.id] = {
          ...record,
          status: "pending",
          active: false,
          reviews: [],
          approval: null,
          rejection: null,
          supersession: null,
          history: [historyEntry(entry.kind, record)]
        };
        proposals.push(record);
        break;
      case "review":
        reviews.push(record);
        if (amendments[record.amendmentId]) {
          amendments[record.amendmentId].reviews.push(record);
          amendments[record.amendmentId].history.push(historyEntry(entry.kind, record));
        }
        break;
      case "approval":
        approvals.push(record);
        if (amendments[record.amendmentId]) {
          amendments[record.amendmentId] = {
            ...amendments[record.amendmentId],
            status: "approved",
            active: true,
            approval: record,
            rejection: null,
            approvedBy: record.approvedBy,
            approvedAt: record.approvedAt,
            appliesFromEventId: record.sourceEventId,
            history: [
              ...amendments[record.amendmentId].history,
              historyEntry(entry.kind, record)
            ]
          };
        }
        break;
      case "rejection":
        rejections.push(record);
        if (amendments[record.amendmentId]) {
          amendments[record.amendmentId] = {
            ...amendments[record.amendmentId],
            status: "rejected",
            active: false,
            rejection: record,
            rejectedBy: record.rejectedBy,
            rejectedAt: record.rejectedAt,
            history: [
              ...amendments[record.amendmentId].history,
              historyEntry(entry.kind, record)
            ]
          };
        }
        break;
      case "supersession":
        supersessions.push(record);
        if (amendments[record.amendmentId]) {
          amendments[record.amendmentId] = {
            ...amendments[record.amendmentId],
            status: "superseded",
            active: false,
            supersession: record,
            supersededByAmendmentId: record.supersededByAmendmentId,
            supersededBy: record.supersededBy,
            supersededAt: record.supersededAt,
            history: [
              ...amendments[record.amendmentId].history,
              historyEntry(entry.kind, record)
            ]
          };
        }
        break;
      default:
        break;
    }
  }

  const amendmentList = Object.values(amendments);
  const activeAmendments = amendmentList.filter((amendment) => amendment.active);
  const rejectedAmendments = amendmentList.filter((amendment) => amendment.status === "rejected");
  const supersededAmendments = amendmentList.filter((amendment) => amendment.status === "superseded");
  const pendingAmendments = amendmentList.filter((amendment) => amendment.status === "pending");

  return {
    schema: AMENDMENT_SCHEMA,
    theorem: "authorized_protocol_change = approve(amendment, governance_authority)",
    hardLaw: "recommendation != amendment",
    amendments: amendmentList,
    activeAmendments,
    pendingAmendments,
    rejectedAmendments,
    supersededAmendments,
    proposals,
    reviews,
    approvals,
    rejections,
    supersessions,
    byAmendment: indexBy(amendmentList, "id"),
    historyByAmendment: amendmentList.reduce((indexed, amendment) => {
      indexed[amendment.id] = amendment.history || [];
      return indexed;
    }, {}),
    byAdaptationRecommendation: groupByByValues(amendmentList, "adaptationRecommendationIds"),
    byLearningSignal: groupByByValues(amendmentList, "learningSignalIds"),
    amendmentValidationStatus: {
      valid: true,
      amendmentCount: amendmentList.length,
      activeCount: activeAmendments.length,
      pendingCount: pendingAmendments.length,
      rejectedCount: rejectedAmendments.length,
      supersededCount: supersededAmendments.length,
      implicitMutation: false,
      automaticAmendment: false,
      retroactiveMutation: false,
      recommendationBecomesAmendment: false
    }
  };
}

function amendmentForId(amendmentProjection, amendmentId) {
  return {
    schema: "clista.amendment.item.v0",
    amendmentId,
    amendment: amendmentProjection.byAmendment[amendmentId] || null,
    history: amendmentProjection.historyByAmendment[amendmentId] || []
  };
}

function selectAmendmentsForThread(amendmentProjection, threadId) {
  const amendments = amendmentProjection.amendments.filter((amendment) => amendment.threadId === threadId);
  const amendmentIds = new Set(amendments.map((amendment) => amendment.id));
  return {
    schema: "clista.amendments.thread.v0",
    threadId,
    theorem: amendmentProjection.theorem,
    hardLaw: amendmentProjection.hardLaw,
    amendments: amendments.map(compactAmendment),
    activeAmendments: amendments.filter((amendment) => amendment.active).map(compactAmendment),
    pendingAmendments: amendments.filter((amendment) => amendment.status === "pending").map(compactAmendment),
    rejectedAmendments: amendments.filter((amendment) => amendment.status === "rejected").map(compactAmendment),
    supersededAmendments: amendments.filter((amendment) => amendment.status === "superseded").map(compactAmendment),
    historyByAmendment: Object.fromEntries(
      Object.entries(amendmentProjection.historyByAmendment)
        .filter(([id]) => amendmentIds.has(id))
    )
  };
}

function validateProtocolAmendment(amendment, priorEvents = []) {
  const reasons = [];
  const index = amendmentReferenceIndex(priorEvents);
  if (!amendment?.id) {
    reasons.push("protocol amendment requires id");
  } else if (index.amendments.has(amendment.id)) {
    reasons.push(`duplicate protocol amendment ${amendment.id}`);
  }
  if (!String(amendment?.title || "").trim()) {
    reasons.push("protocol amendment requires title");
  }
  if (!VALID_AMENDMENT_TYPES.has(normalizeType(amendment?.amendmentType || amendment?.type))) {
    reasons.push("protocol amendment requires supported amendmentType");
  }
  if (!String(amendment?.target || "").trim()) {
    reasons.push("protocol amendment requires target");
  }
  if (!String(amendment?.rationale || "").trim()) {
    reasons.push("protocol amendment requires rationale");
  }
  if (!String(amendment?.proposedChange || amendment?.change || "").trim()) {
    reasons.push("protocol amendment requires proposedChange");
  }
  reasons.push(...validateEffectScope(amendment, "protocol amendment"));
  reasons.push(...rejectImplicitMutationFields(amendment));
  reasons.push(...validateAmendmentReferences(amendment, priorEvents));
  return reasons;
}

function validateProtocolAmendmentReview(review, priorEvents = []) {
  const reasons = [];
  if (!review?.id) {
    reasons.push("protocol amendment review requires id");
  }
  if (!review?.amendmentId) {
    reasons.push("protocol amendment review requires amendmentId");
  }
  if (!String(review?.rationale || review?.comment || "").trim()) {
    reasons.push("protocol amendment review requires rationale");
  }
  const status = normalizeType(review?.status || "comment");
  if (!VALID_REVIEW_STATUSES.has(status)) {
    reasons.push("protocol amendment review requires supported status");
  }
  reasons.push(...rejectImplicitMutationFields(review));
  reasons.push(...validateAmendmentActionReferences(review, priorEvents, "protocol amendment review"));
  return reasons;
}

function validateProtocolAmendmentApproval(approval, priorEvents = []) {
  const reasons = [];
  if (!approval?.id) {
    reasons.push("protocol amendment approval requires id");
  }
  if (!approval?.amendmentId) {
    reasons.push("protocol amendment approval requires amendmentId");
  }
  if (!String(approval?.rationale || "").trim()) {
    reasons.push("protocol amendment approval requires rationale");
  }
  reasons.push(...validateEffectScope(approval, "protocol amendment approval"));
  reasons.push(...rejectImplicitMutationFields(approval));
  reasons.push(...validateAmendmentActionReferences(approval, priorEvents, "protocol amendment approval"));
  const status = amendmentStatusIndex(priorEvents).get(approval?.amendmentId);
  if (status === "approved") {
    reasons.push(`protocol amendment approval references already approved amendment ${approval.amendmentId}`);
  }
  if (status === "rejected") {
    reasons.push(`protocol amendment approval references rejected amendment ${approval.amendmentId}`);
  }
  if (status === "superseded") {
    reasons.push(`protocol amendment approval references superseded amendment ${approval.amendmentId}`);
  }
  return reasons;
}

function validateProtocolAmendmentRejection(rejection, priorEvents = []) {
  const reasons = [];
  if (!rejection?.id) {
    reasons.push("protocol amendment rejection requires id");
  }
  if (!rejection?.amendmentId) {
    reasons.push("protocol amendment rejection requires amendmentId");
  }
  if (!String(rejection?.rationale || "").trim()) {
    reasons.push("protocol amendment rejection requires rationale");
  }
  reasons.push(...rejectImplicitMutationFields(rejection));
  reasons.push(...validateAmendmentActionReferences(rejection, priorEvents, "protocol amendment rejection"));
  const status = amendmentStatusIndex(priorEvents).get(rejection?.amendmentId);
  if (status === "approved") {
    reasons.push(`protocol amendment rejection references already approved amendment ${rejection.amendmentId}`);
  }
  if (status === "rejected") {
    reasons.push(`protocol amendment rejection references already rejected amendment ${rejection.amendmentId}`);
  }
  if (status === "superseded") {
    reasons.push(`protocol amendment rejection references superseded amendment ${rejection.amendmentId}`);
  }
  return reasons;
}

function validateProtocolAmendmentSupersession(supersession, priorEvents = []) {
  const reasons = [];
  if (!supersession?.id) {
    reasons.push("protocol amendment supersession requires id");
  }
  if (!supersession?.amendmentId) {
    reasons.push("protocol amendment supersession requires amendmentId");
  }
  if (!supersession?.supersededByAmendmentId) {
    reasons.push("protocol amendment supersession requires supersededByAmendmentId");
  }
  if (supersession?.amendmentId === supersession?.supersededByAmendmentId) {
    reasons.push("protocol amendment cannot supersede itself");
  }
  if (!String(supersession?.rationale || "").trim()) {
    reasons.push("protocol amendment supersession requires rationale");
  }
  reasons.push(...rejectImplicitMutationFields(supersession));
  reasons.push(...validateAmendmentActionReferences(supersession, priorEvents, "protocol amendment supersession"));
  const index = amendmentReferenceIndex(priorEvents);
  if (supersession?.supersededByAmendmentId && !index.amendments.has(supersession.supersededByAmendmentId)) {
    reasons.push(`protocol amendment supersession references unknown or future replacement amendment ${supersession.supersededByAmendmentId}`);
  }
  const status = amendmentStatusIndex(priorEvents).get(supersession?.amendmentId);
  if (status !== "approved") {
    reasons.push(`protocol amendment supersession requires approved amendment ${supersession?.amendmentId}`);
  }
  return reasons;
}

function normalizeProtocolAmendment(amendment, event) {
  if (!amendment) {
    return null;
  }
  const normalized = stripUndefined({
    id: amendment.id || deterministicId("amd", "protocol_amendment", event.event_id),
    object: "protocolAmendment",
    title: amendment.title,
    amendmentType: normalizeType(amendment.amendmentType || amendment.type),
    target: amendment.target,
    rationale: amendment.rationale,
    proposedChange: amendment.proposedChange || amendment.change,
    effectScope: normalizeEffectScope(amendment.effectScope),
    threadId: amendment.threadId || event.thread_id,
    adaptationRecommendationIds: unique(amendment.adaptationRecommendationIds || amendment.adaptationIds || []),
    learningSignalIds: unique(amendment.learningSignalIds || amendment.learningIds || []),
    sourceEventIds: unique(amendment.sourceEventIds || amendment.generatedFromEventIds || []),
    proposedBy: amendment.proposedBy || event.actor_id,
    proposedAt: amendment.proposedAt || event.timestamp,
    sourceEventId: event.event_id,
    automaticAmendment: false,
    implicitMutation: false,
    hiddenPolicyMutation: false,
    retroactiveMutation: false,
    rewritesPastEvents: false,
    recommendationBecomesAmendment: false
  });
  normalized.amendmentHash = contentHash({
    title: normalized.title,
    amendmentType: normalized.amendmentType,
    target: normalized.target,
    rationale: normalized.rationale,
    proposedChange: normalized.proposedChange,
    effectScope: normalized.effectScope,
    adaptationRecommendationIds: normalized.adaptationRecommendationIds,
    learningSignalIds: normalized.learningSignalIds,
    sourceEventIds: normalized.sourceEventIds
  });
  return normalized;
}

function normalizeAmendmentReview(review, event) {
  if (!review) {
    return null;
  }
  return hashAmendmentAction(stripUndefined({
    id: review.id || deterministicId("amr", "protocol_amendment_review", event.event_id),
    object: "protocolAmendmentReview",
    amendmentId: review.amendmentId,
    status: normalizeType(review.status || "comment"),
    reviewerParticipantId: review.reviewerParticipantId || review.reviewedBy || event.actor_id,
    rationale: review.rationale || review.comment,
    threadId: review.threadId || event.thread_id,
    reviewedAt: review.reviewedAt || event.timestamp,
    sourceEventId: event.event_id,
    automaticAmendment: false,
    implicitMutation: false,
    hiddenPolicyMutation: false,
    retroactiveMutation: false,
    rewritesPastEvents: false,
    recommendationBecomesAmendment: false
  }));
}

function normalizeAmendmentApproval(approval, event) {
  if (!approval) {
    return null;
  }
  return hashAmendmentAction(stripUndefined({
    id: approval.id || deterministicId("ama", "protocol_amendment_approval", event.event_id),
    object: "protocolAmendmentApproval",
    amendmentId: approval.amendmentId,
    approvedBy: approval.approvedBy || event.actor_id,
    authority: approval.authority || "decision_owner",
    rationale: approval.rationale,
    effectScope: normalizeEffectScope(approval.effectScope),
    threadId: approval.threadId || event.thread_id,
    approvedAt: approval.approvedAt || event.timestamp,
    sourceEventId: event.event_id,
    automaticAmendment: false,
    implicitMutation: false,
    hiddenPolicyMutation: false,
    retroactiveMutation: false,
    rewritesPastEvents: false,
    recommendationBecomesAmendment: false
  }));
}

function normalizeAmendmentRejection(rejection, event) {
  if (!rejection) {
    return null;
  }
  return hashAmendmentAction(stripUndefined({
    id: rejection.id || deterministicId("amj", "protocol_amendment_rejection", event.event_id),
    object: "protocolAmendmentRejection",
    amendmentId: rejection.amendmentId,
    rejectedBy: rejection.rejectedBy || event.actor_id,
    authority: rejection.authority || "decision_owner",
    rationale: rejection.rationale,
    threadId: rejection.threadId || event.thread_id,
    rejectedAt: rejection.rejectedAt || event.timestamp,
    sourceEventId: event.event_id,
    automaticAmendment: false,
    implicitMutation: false,
    hiddenPolicyMutation: false,
    retroactiveMutation: false,
    rewritesPastEvents: false,
    recommendationBecomesAmendment: false
  }));
}

function normalizeAmendmentSupersession(supersession, event) {
  if (!supersession) {
    return null;
  }
  return hashAmendmentAction(stripUndefined({
    id: supersession.id || deterministicId("ams", "protocol_amendment_supersession", event.event_id),
    object: "protocolAmendmentSupersession",
    amendmentId: supersession.amendmentId,
    supersededByAmendmentId: supersession.supersededByAmendmentId,
    supersededBy: supersession.supersededBy || event.actor_id,
    authority: supersession.authority || "decision_owner",
    rationale: supersession.rationale,
    threadId: supersession.threadId || event.thread_id,
    supersededAt: supersession.supersededAt || event.timestamp,
    sourceEventId: event.event_id,
    automaticAmendment: false,
    implicitMutation: false,
    hiddenPolicyMutation: false,
    retroactiveMutation: false,
    rewritesPastEvents: false,
    recommendationBecomesAmendment: false
  }));
}

function validateEffectScope(object, label) {
  const scope = normalizeEffectScope(object?.effectScope);
  const reasons = [];
  if (!VALID_EFFECT_SCOPES.has(scope)) {
    reasons.push(`${label} requires effectScope future_only or interpretive_guidance`);
  }
  if (object?.retroactive === true || object?.retroactiveMutation === true || object?.rewritesPastEvents === true) {
    reasons.push(`${label} cannot rewrite past event validity`);
  }
  return reasons;
}

function rejectImplicitMutationFields(value, path = []) {
  const reasons = [];
  if (!value || typeof value !== "object") {
    return reasons;
  }

  for (const [key, child] of Object.entries(value)) {
    const fullPath = [...path, key];
    if (GUARD_FIELDS.has(key)) {
      if (child === true) {
        reasons.push(`amendment field ${fullPath.join(".")} must be false`);
      }
      continue;
    }
    if (FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key)) && child !== false) {
      reasons.push(`amendment cannot include implicit, automatic, hidden, or retroactive mutation field ${fullPath.join(".")}`);
    }
    if (child && typeof child === "object") {
      reasons.push(...rejectImplicitMutationFields(child, fullPath));
    }
  }

  return reasons;
}

function validateAmendmentReferences(amendment, priorEvents = []) {
  const reasons = [];
  const index = amendmentReferenceIndex(priorEvents);
  for (const id of amendment?.adaptationRecommendationIds || amendment?.adaptationIds || []) {
    if (!index.adaptationRecommendations.has(id)) {
      reasons.push(`protocol amendment references unknown or future adaptation recommendation ${id}`);
    }
  }
  for (const id of amendment?.learningSignalIds || amendment?.learningIds || []) {
    if (!index.learningSignals.has(id)) {
      reasons.push(`protocol amendment references unknown or future learning signal ${id}`);
    }
  }
  for (const eventId of amendment?.sourceEventIds || amendment?.generatedFromEventIds || []) {
    if (!index.events.has(eventId)) {
      reasons.push(`protocol amendment references unknown or future event ${eventId}`);
    }
  }
  return reasons;
}

function validateAmendmentActionReferences(action, priorEvents = [], label) {
  const reasons = [];
  const index = amendmentReferenceIndex(priorEvents);
  if (action?.amendmentId && !index.amendments.has(action.amendmentId)) {
    reasons.push(`${label} references unknown or future amendment ${action.amendmentId}`);
  }
  for (const eventId of action?.sourceEventIds || action?.generatedFromEventIds || []) {
    if (!index.events.has(eventId)) {
      reasons.push(`${label} references unknown or future event ${eventId}`);
    }
  }
  return reasons;
}

function amendmentReferenceIndex(events = []) {
  const eventsById = new Map();
  const amendments = new Set();
  const learningSignals = new Set();
  const adaptationRecommendations = new Set();

  for (const event of events || []) {
    if (event?.event_id) {
      eventsById.set(event.event_id, event);
    }
    const payload = event?.payload || {};
    if (event?.event_type === "ProtocolAmendmentProposed") {
      const amendment = payload.protocolAmendment || payload.amendment;
      if (amendment?.id) {
        amendments.add(amendment.id);
      }
    }
    if (event?.event_type === "LearningSignalRecorded" && payload.learningSignal?.id) {
      learningSignals.add(payload.learningSignal.id);
    }
    for (const key of [
      "governanceReviewRecommendation",
      "evidenceRequirementReviewRecommendation",
      "revisitTriggerReviewRecommendation",
      "decisionGateReviewRecommendation"
    ]) {
      if (payload[key]?.id) {
        adaptationRecommendations.add(payload[key].id);
      }
    }
  }

  return {
    events: eventsById,
    amendments,
    learningSignals,
    adaptationRecommendations
  };
}

function amendmentStatusIndex(events = []) {
  const statuses = new Map();
  for (const event of events || []) {
    const payload = event?.payload || {};
    switch (event?.event_type) {
      case "ProtocolAmendmentProposed": {
        const amendment = payload.protocolAmendment || payload.amendment;
        if (amendment?.id) {
          statuses.set(amendment.id, "pending");
        }
        break;
      }
      case "ProtocolAmendmentApproved": {
        const approval = payload.protocolAmendmentApproval || payload.amendmentApproval;
        if (approval?.amendmentId) {
          statuses.set(approval.amendmentId, "approved");
        }
        break;
      }
      case "ProtocolAmendmentRejected": {
        const rejection = payload.protocolAmendmentRejection || payload.amendmentRejection;
        if (rejection?.amendmentId) {
          statuses.set(rejection.amendmentId, "rejected");
        }
        break;
      }
      case "ProtocolAmendmentSuperseded": {
        const supersession = payload.protocolAmendmentSupersession || payload.amendmentSupersession;
        if (supersession?.amendmentId) {
          statuses.set(supersession.amendmentId, "superseded");
        }
        break;
      }
      default:
        break;
    }
  }
  return statuses;
}

function addEntry(state, kind, record) {
  if (!record) {
    return;
  }
  state.entries.push({ kind, record });
}

function hashAmendmentAction(action) {
  action.amendmentHash = contentHash({
    object: action.object,
    amendmentId: action.amendmentId,
    status: action.status,
    rationale: action.rationale,
    effectScope: action.effectScope,
    supersededByAmendmentId: action.supersededByAmendmentId
  });
  return action;
}

function historyEntry(kind, record) {
  return {
    kind,
    id: record.id,
    eventId: record.sourceEventId,
    at: record.proposedAt || record.reviewedAt || record.approvedAt || record.rejectedAt || record.supersededAt || null,
    actorId: record.proposedBy || record.reviewerParticipantId || record.approvedBy || record.rejectedBy || record.supersededBy || null,
    status: record.status || kind
  };
}

function compactAmendment(amendment) {
  return {
    id: amendment.id,
    object: amendment.object,
    title: amendment.title,
    amendmentType: amendment.amendmentType,
    target: amendment.target,
    status: amendment.status,
    active: amendment.active,
    effectScope: amendment.effectScope,
    adaptationRecommendationIds: amendment.adaptationRecommendationIds,
    learningSignalIds: amendment.learningSignalIds,
    proposedBy: amendment.proposedBy,
    approvedBy: amendment.approvedBy,
    rejectedBy: amendment.rejectedBy,
    supersededByAmendmentId: amendment.supersededByAmendmentId,
    automaticAmendment: false,
    implicitMutation: false,
    retroactiveMutation: false,
    recommendationBecomesAmendment: false,
    amendmentHash: amendment.amendmentHash
  };
}


function normalizeEffectScope(value) {
  const normalized = normalizeType(value || "future_only");
  return normalized || "future_only";
}

function deterministicId(prefix, type, seed) {
  const hash = contentHash({ type, seed }).slice("sha256:".length, "sha256:".length + 16);
  return `${prefix}_${normalizeType(type).slice(0, 24) || "amendment"}_${hash}`;
}





module.exports = {
  AMENDMENT_EVENT_TYPES,
  AMENDMENT_SCHEMA,
  AMENDMENT_VERIFY_SCHEMA,
  amendmentForId,
  buildAmendmentState,
  emptyAmendmentState,
  projectAmendments,
  rejectImplicitMutationFields,
  selectAmendmentsForThread,
  validateProtocolAmendment,
  validateProtocolAmendmentApproval,
  validateProtocolAmendmentRejection,
  validateProtocolAmendmentReview,
  validateProtocolAmendmentSupersession
};
