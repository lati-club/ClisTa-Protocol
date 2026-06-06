const crypto = require("node:crypto");

const PROTOCOL_VERSION = "clista.protocol.v0";
const EVENT_HASH_VERSION = "clista.event_hash.v1";
const INTEGRITY_SCHEMA = "clista.integrity.v0";
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

function stableStringify(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        if (value[key] !== undefined) {
          sorted[key] = sortKeys(value[key]);
        }
        return sorted;
      }, {});
  }
  return value;
}

function contentHash(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function canonicalEventHashMaterial(event) {
  const material = {};
  for (const [key, value] of Object.entries(event || {})) {
    if (key !== "content_hash" && key !== "previous_hash" && value !== undefined) {
      material[key] = value;
    }
  }
  return material;
}

function legacyEventHashMaterial(event) {
  return {
    event_type: event.event_type,
    thread_id: event.thread_id,
    actor_id: event.actor_id,
    timestamp: event.timestamp,
    payload: event.payload,
    metadata: event.metadata
  };
}

function computeEventHash(event) {
  if (event?.hash_version === EVENT_HASH_VERSION) {
    return contentHash(canonicalEventHashMaterial(event));
  }
  return contentHash(legacyEventHashMaterial(event || {}));
}

function prepareEventForAppend(event, previousHash) {
  const prepared = { ...(event || {}) };
  prepared.protocol_version = prepared.protocol_version || PROTOCOL_VERSION;
  prepared.hash_version = prepared.hash_version || EVENT_HASH_VERSION;
  delete prepared.content_hash;
  delete prepared.previous_hash;
  if (previousHash) {
    prepared.previous_hash = previousHash;
  }
  prepared.content_hash = computeEventHash(prepared);
  return prepared;
}

function chainEvents(events) {
  let previousHash;
  return events.map((event) => {
    const prepared = prepareEventForAppend(event, previousHash);
    previousHash = prepared.content_hash;
    return prepared;
  });
}

function canonicalEventLine(event) {
  return stableStringify(event);
}

function serializeEventsNdjson(events) {
  if (!events.length) {
    return "";
  }
  return `${events.map(canonicalEventLine).join("\n")}\n`;
}

function verifyEventIntegrity(events, options = {}) {
  const strict = Boolean(options.strict);
  const reasons = [];
  let previousHash;

  events.forEach((event, index) => {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      reasons.push({
        event_id: null,
        index,
        reason: "event is not an object"
      });
      previousHash = undefined;
      return;
    }

    if (event.protocol_version && event.protocol_version !== PROTOCOL_VERSION) {
      reasons.push(reasonFor(event, index, `unsupported protocol_version ${event.protocol_version}`));
    } else if (strict && !event.protocol_version) {
      reasons.push(reasonFor(event, index, "missing protocol_version"));
    }

    const hashVersionSupported = !event.hash_version || event.hash_version === EVENT_HASH_VERSION;
    if (event.hash_version && event.hash_version !== EVENT_HASH_VERSION) {
      reasons.push(reasonFor(event, index, `unsupported hash_version ${event.hash_version}`));
    } else if (strict && !event.hash_version) {
      reasons.push(reasonFor(event, index, "missing hash_version"));
    }

    if (event.content_hash && !HASH_PATTERN.test(event.content_hash)) {
      reasons.push(reasonFor(event, index, `malformed content_hash ${event.content_hash}`));
    }
    if (event.previous_hash && !HASH_PATTERN.test(event.previous_hash)) {
      reasons.push(reasonFor(event, index, `malformed previous_hash ${event.previous_hash}`));
    }
    if (event.hash_version && !event.content_hash) {
      reasons.push(reasonFor(event, index, "hash_version requires content_hash"));
    }
    if (strict && !event.content_hash) {
      reasons.push(reasonFor(event, index, "missing content_hash"));
    }

    if (event.content_hash && hashVersionSupported) {
      const expectedHash = computeEventHash(event);
      if (event.content_hash !== expectedHash) {
        reasons.push({
          ...reasonFor(event, index, "content_hash does not match canonical event serialization"),
          expected: expectedHash,
          actual: event.content_hash
        });
      }
    }

    if (index === 0) {
      if (event.previous_hash) {
        reasons.push(reasonFor(event, index, "first event cannot have previous_hash"));
      }
    } else if (strict && !event.previous_hash) {
      reasons.push(reasonFor(event, index, "missing previous_hash"));
    }

    if (event.previous_hash && event.previous_hash !== previousHash) {
      reasons.push({
        ...reasonFor(event, index, "invalid previous_hash chain"),
        expected: previousHash || null,
        actual: event.previous_hash
      });
    }

    previousHash = event.content_hash || undefined;
  });

  return {
    schema: INTEGRITY_SCHEMA,
    protocolVersion: PROTOCOL_VERSION,
    hashVersion: EVENT_HASH_VERSION,
    strict,
    valid: reasons.length === 0,
    eventCount: events.length,
    headHash: previousHash || null,
    reasons
  };
}

function reasonFor(event, index, reason) {
  return {
    event_id: event.event_id || null,
    event_type: event.event_type || null,
    index,
    reason
  };
}

function formatIntegrityReasons(reasons) {
  return reasons.map((error) => {
    const eventId = error.event_id || `index ${error.index}`;
    return `${eventId}: ${error.reason}`;
  }).join("\n");
}

module.exports = {
  EVENT_HASH_VERSION,
  HASH_PATTERN,
  INTEGRITY_SCHEMA,
  PROTOCOL_VERSION,
  canonicalEventHashMaterial,
  canonicalEventLine,
  chainEvents,
  computeEventHash,
  contentHash,
  formatIntegrityReasons,
  legacyEventHashMaterial,
  prepareEventForAppend,
  serializeEventsNdjson,
  stableStringify,
  verifyEventIntegrity
};
