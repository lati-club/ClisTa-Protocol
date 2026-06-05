const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const STORE_DIR = ".clista";
const EVENTS_FILE = "events.ndjson";

function storeDir(cwd = process.cwd()) {
  return path.join(cwd, STORE_DIR);
}

function eventLogPath(cwd = process.cwd()) {
  return path.join(storeDir(cwd), EVENTS_FILE);
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function newId(prefix, hint = "") {
  const slug = slugify(hint);
  const entropy = crypto.randomBytes(4).toString("hex");
  const time = Date.now().toString(36);
  return `${prefix}_${slug ? `${slug}_` : ""}${time}_${entropy}`;
}

function participantIdFor(value) {
  if (!value) {
    return "par_system";
  }
  const text = String(value).trim();
  if (/^par_[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(text)) {
    return text;
  }
  return `par_${slugify(text) || "participant"}`;
}

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
        sorted[key] = sortKeys(value[key]);
        return sorted;
      }, {});
  }
  return value;
}

function contentHash(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function initStore(cwd = process.cwd()) {
  fs.mkdirSync(storeDir(cwd), { recursive: true });
  const eventsPath = eventLogPath(cwd);
  if (!fs.existsSync(eventsPath)) {
    fs.writeFileSync(eventsPath, "", "utf8");
  }
  const configPath = path.join(storeDir(cwd), "config.json");
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      `${JSON.stringify({ schema: "clista.store.v0", createdAt: nowIso() }, null, 2)}\n`,
      "utf8"
    );
  }
  return { storeDir: storeDir(cwd), eventsPath };
}

function readEventsAt(eventsPath) {
  if (!fs.existsSync(eventsPath)) {
    return [];
  }
  const raw = fs.readFileSync(eventsPath, "utf8").trim();
  if (!raw) {
    return [];
  }
  return raw.split(/\r?\n/).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid NDJSON event at ${eventsPath}:${index + 1}: ${error.message}`);
    }
  });
}

function readEvents(cwd = process.cwd()) {
  return readEventsAt(eventLogPath(cwd));
}

function appendEvent(event, cwd = process.cwd()) {
  initStore(cwd);
  fs.appendFileSync(eventLogPath(cwd), `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

function createEvent({ type, threadId, actorId, payload, at = nowIso(), id, metadata }) {
  const base = {
    event_id: id || newId("evt", type),
    event_type: type,
    thread_id: threadId || null,
    actor_id: actorId || null,
    timestamp: at,
    payload
  };
  if (metadata && Object.keys(metadata).length) {
    base.metadata = metadata;
  }
  base.content_hash = contentHash({
    event_type: base.event_type,
    thread_id: base.thread_id,
    actor_id: base.actor_id,
    timestamp: base.timestamp,
    payload: base.payload,
    metadata: base.metadata
  });
  return base;
}

function createParticipant(value, role, kind = "human") {
  const id = participantIdFor(value);
  const name = /^par_/.test(String(value || "")) ? id.replace(/^par_/, "").replace(/_/g, " ") : String(value || "System");
  return {
    id,
    object: "participant",
    kind,
    name,
    role
  };
}

function parseList(value) {
  if (Array.isArray(value)) {
    return value.flatMap(parseList);
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  STORE_DIR,
  EVENTS_FILE,
  appendEvent,
  contentHash,
  createEvent,
  createParticipant,
  eventLogPath,
  initStore,
  newId,
  nowIso,
  parseList,
  participantIdFor,
  readEvents,
  readEventsAt,
  slugify,
  stableStringify,
  storeDir
};
