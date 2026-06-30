// Phase 1 of the event-type registry (#51). The registry (src/event-types.js) is
// the single declared list of event types; these tests lock it to the live
// validator and projector switches so the two can't drift, and codify the
// invariant that broke in #40/#45: no event type may be projected into state
// while the validator no-ops it (fail-open).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { EVENT_TYPES, EVENT_TYPE_SET, isKnownEventType } = require("../src/event-types");

const root = path.resolve(__dirname, "..");
const validatorSrc = fs.readFileSync(path.join(root, "src", "validator.js"), "utf8");
const projectorSrc = fs.readFileSync(path.join(root, "src", "projector.js"), "utf8");

// Parse a top-level `switch (...) { case "X": ... }` into { type -> bodyText },
// joining fall-through labels so each shares the body that follows them. Only
// the 6-space-indented case arms of the main dispatch switch are considered.
function parseSwitch(source) {
  const lines = source.split("\n");
  const groups = {};
  let pending = [];
  let body = [];
  const flush = () => {
    const text = body.join("\n");
    for (const label of pending) groups[label] = text;
    pending = [];
    body = [];
  };
  for (const line of lines) {
    const caseMatch = line.match(/^ {6}case "([A-Za-z]+)":$/);
    if (caseMatch) {
      if (body.length) flush(); // previous arm ended
      pending.push(caseMatch[1]);
      continue;
    }
    if (/^ {6}default:/.test(line)) {
      if (body.length) flush();
      continue;
    }
    if (pending.length) body.push(line);
  }
  if (body.length) flush();
  return groups;
}

const validatorCases = parseSwitch(validatorSrc);
const projectorCases = parseSwitch(projectorSrc);

test("registry has no duplicates and only non-empty type strings", () => {
  assert.equal(EVENT_TYPES.length, EVENT_TYPE_SET.size);
  for (const type of EVENT_TYPES) {
    assert.equal(typeof type, "string");
    assert.ok(type.length > 0);
  }
});

test("registry exactly matches the validator's event-type switch", () => {
  const validatorTypes = new Set(Object.keys(validatorCases));
  assert.ok(validatorTypes.size >= 100, `parsed too few validator cases: ${validatorTypes.size}`);
  const missingFromRegistry = [...validatorTypes].filter((t) => !EVENT_TYPE_SET.has(t));
  const missingFromValidator = [...EVENT_TYPE_SET].filter((t) => !validatorTypes.has(t));
  assert.deepEqual(missingFromRegistry, [], "validator handles types absent from the registry");
  assert.deepEqual(missingFromValidator, [], "registry lists types the validator does not handle");
});

test("every event type the projector switches on is in the registry", () => {
  const projectorTypes = Object.keys(projectorCases);
  assert.ok(projectorTypes.length >= 90, `parsed too few projector cases: ${projectorTypes.length}`);
  const unknown = projectorTypes.filter((t) => !isKnownEventType(t));
  assert.deepEqual(unknown, [], "projector switches on types absent from the registry");
});

test("no event type is projected into state while the validator no-ops it (fail-open guard)", () => {
  // The #40 / #45 class: a projector case that mutates state paired with a
  // validator case that is a bare `break` (no validate call, no addError).
  const mutates = (bodyText) => /\b(upsert|setThreadStatus|touchThread|applyThreadFork)\s*\(/.test(bodyText);
  const validates = (bodyText) => /\b(validate[A-Z]\w*|addError)\s*\(/.test(bodyText);

  const offenders = Object.keys(projectorCases).filter((type) => {
    const projectorBody = projectorCases[type] || "";
    const validatorBody = validatorCases[type];
    return mutates(projectorBody) && validatorBody !== undefined && !validates(validatorBody);
  });

  assert.deepEqual(
    offenders,
    [],
    `these event types mutate projected state but their validator case is a no-op: ${offenders.join(", ")}`
  );
});
