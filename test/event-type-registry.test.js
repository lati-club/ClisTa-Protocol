// Phase 1 of the event-type registry (#51). The registry (src/event-types.js) is
// the single declared list of event types; these tests lock it to the live
// validator and projector switches so the two can't drift, and codify the
// invariant that broke in #40/#45: no event type may be projected into state
// while the validator no-ops it (fail-open).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { PROTOCOL_EVENT_TYPES } = require("../src/event-types");

const root = path.resolve(__dirname, "..");

// Extract the set of `case "X":` labels from the switch that begins at the
// first line containing `switchNeedle`, walking until the switch block's
// braces close. This is how we assert both engine switches enumerate exactly
// the canonical registry without a static type system.
function switchCaseLabels(file, switchNeedle) {
  const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
  const start = lines.findIndex((line) => line.includes(switchNeedle));
  assert.notEqual(start, -1, `could not find switch "${switchNeedle}" in ${file}`);

  const labels = new Set();
  let brace = 0;
  let began = false;
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    for (const match of line.match(/case\s+"([^"]+)":/g) || []) {
      labels.add(match.match(/"([^"]+)"/)[1]);
    }
    brace += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    if (line.includes("switch (")) {
      began = true;
    }
    if (began && brace <= 0 && i > start) {
      break;
    }
  }
  return labels;
}

function diff(actual, expected) {
  const missing = expected.filter((type) => !actual.has(type)).sort();
  const extra = [...actual].filter((type) => !expected.includes(type)).sort();
  return { missing, extra };
}

test("registry is sorted and unique", () => {
  const sorted = [...PROTOCOL_EVENT_TYPES].sort();
  assert.deepEqual(PROTOCOL_EVENT_TYPES, sorted, "PROTOCOL_EVENT_TYPES must be sorted");
  assert.equal(new Set(PROTOCOL_EVENT_TYPES).size, PROTOCOL_EVENT_TYPES.length, "PROTOCOL_EVENT_TYPES must be unique");
});

test("validator switch enumerates exactly the registry", () => {
  const labels = switchCaseLabels("src/validator.js", "switch (event.event_type)");
  const { missing, extra } = diff(labels, PROTOCOL_EVENT_TYPES);
  assert.deepEqual(missing, [], `validator switch is missing registry types: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `validator switch has types absent from the registry: ${extra.join(", ")}`);
});

test("projector switch enumerates exactly the registry", () => {
  const labels = switchCaseLabels("src/projector.js", "switch (eventType(event))");
  const { missing, extra } = diff(labels, PROTOCOL_EVENT_TYPES);
  assert.deepEqual(missing, [], `projector switch is missing registry types (they would fall through to default): ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `projector switch has types absent from the registry: ${extra.join(", ")}`);
});

test("validator and projector agree on the event-type set (no drift)", () => {
  const validatorLabels = switchCaseLabels("src/validator.js", "switch (event.event_type)");
  const projectorLabels = switchCaseLabels("src/projector.js", "switch (eventType(event))");
  const validatedNotProjected = [...validatorLabels].filter((type) => !projectorLabels.has(type)).sort();
  const projectedNotValidated = [...projectorLabels].filter((type) => !validatorLabels.has(type)).sort();
  assert.deepEqual(validatedNotProjected, [], `validated but no projector case: ${validatedNotProjected.join(", ")}`);
  assert.deepEqual(projectedNotValidated, [], `projected but no validator case: ${projectedNotValidated.join(", ")}`);
const {
  EVENT_TYPES, EVENT_TYPE_SET, PRIMARY_OBJECT_KEYS, isKnownEventType, primaryObject
} = require("../src/event-types");

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

test("primaryObject resolves every registered primary-object key", () => {
  assert.ok(PRIMARY_OBJECT_KEYS.length >= 77);
  for (const key of PRIMARY_OBJECT_KEYS) {
    const obj = { id: `obj_${key}` };
    assert.equal(primaryObject({ payload: { [key]: obj } }), obj, `primaryObject missed key ${key}`);
  }
  assert.equal(primaryObject({ payload: {} }), null);
});

test("validator and projector use the shared primaryObject (no local re-divergence)", () => {
  // #51 phase 4: the two files previously defined their own primaryObject with
  // divergent key sets. Both must now import the single registry implementation.
  for (const [name, src] of [["validator.js", validatorSrc], ["projector.js", projectorSrc]]) {
    assert.doesNotMatch(src, /\nfunction primaryObject\(/, `${name} redefines primaryObject locally`);
    assert.match(src, /require\("\.\/event-types"\)/, `${name} does not import from the registry`);
  }
});
