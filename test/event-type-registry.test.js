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
});
