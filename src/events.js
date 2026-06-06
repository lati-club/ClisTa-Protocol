const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  EVENT_HASH_VERSION,
  PROTOCOL_VERSION,
  contentHash,
  prepareEventForAppend,
  serializeEventsNdjson,
  stableStringify
} = require("./integrity");

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
  const events = readEvents(cwd);
  const prepared = prepareEventForAppend(event, events.at(-1)?.content_hash);
  replaceObject(event, prepared);
  fs.appendFileSync(eventLogPath(cwd), serializeEventsNdjson([event]), "utf8");
  return event;
}

function writeEvents(events, cwd = process.cwd()) {
  initStore(cwd);
  const preparedEvents = [];
  let previousHash;
  for (const event of events) {
    const prepared = prepareEventForAppend(event, previousHash);
    previousHash = prepared.content_hash;
    preparedEvents.push(prepared);
  }
  fs.writeFileSync(eventLogPath(cwd), serializeEventsNdjson(preparedEvents), "utf8");
  return preparedEvents;
}

function createEvent({ type, threadId, actorId, payload, at = nowIso(), id, metadata }) {
  const base = {
    event_id: id || newId("evt", type),
    event_type: type,
    thread_id: threadId || null,
    actor_id: actorId || null,
    timestamp: at,
    payload,
    protocol_version: PROTOCOL_VERSION,
    hash_version: EVENT_HASH_VERSION
  };
  if (metadata && Object.keys(metadata).length) {
    base.metadata = metadata;
  }
  base.content_hash = prepareEventForAppend(base).content_hash;
  return base;
}

function replaceObject(target, source) {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
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
  storeDir,
  writeEvents
};
