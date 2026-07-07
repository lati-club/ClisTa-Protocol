const fs = require("node:fs");
const path = require("node:path");
const { decisionSummary } = require("../cli/decision");
const {
  readEvents,
  readEventsAt,
  writeEvents
} = require("../events");
const {
  PROTOCOL_VERSION,
  formatIntegrityReasons,
  verifyEventIntegrity
} = require("../integrity");
const {
  exportProtocol,
  projectEvents,
  selectDecisionSummary
} = require("../projector");
const {
  assertValidEvents,
  validateEvents
} = require("../validator");
const {
  booleanOption,
  print,
  readEventsForOptions,
  readValidEventsForOptions,
  requireOption
} = require("./shared");

function exportShow(options, cwd) {
  const projection = projectEvents(readValidEventsForOptions(options, cwd));
  return print(exportProtocol(projection));
}

function runReport(options, cwd) {
  const events = readEventsForOptions(options, cwd);
  const result = validateEvents(events);
  if (!result.valid) {
    print({
      schema: "clista.run.report.v0",
      valid: false,
      trusted: false,
      reportable: false,
      errors: result.errors,
      guidance:
        "Fix these validation errors before reporting. The gate accepts only logs that pass `clista validate` — an invalid log is not a reportable run."
    });
    process.exitCode = 1;
    return;
  }

  const projection = projectEvents(events);
  const integrity = verifyEventIntegrity(projection.events);
  const summary = selectDecisionSummary(projection, options.thread);

  let bundle = { written: false, hint: "re-run with --out <path> to write a portable submission bundle" };
  if (options.out) {
    const bundlePath = path.resolve(cwd, options.out);
    fs.writeFileSync(bundlePath, `${JSON.stringify(exportProtocol(projection), null, 2)}\n`);
    bundle = { written: true, path: options.out, format: PROTOCOL_VERSION };
  }

  const decisionTitle = options.title || summary.title || summary.threadId || "untitled run";
  const issueTitle = `External run report: ${decisionTitle}`;
  const issueBody = [
    "<!-- ClisTa external debate-pack run. -->",
    "",
    "This run was NOT prompted, hosted, refereed, or graded by the ClisTa project.",
    "epistemic_state: unaudited — a clean closure means well-shaped, not right.",
    "",
    "## Artifacts (attach or link)",
    "- [ ] LEDGER.md (or the submission bundle written with --out)",
    "- [ ] failures.md — discipline failures observed (or \"none observed\")",
    "- [ ] cost.md — wall-clock, rounds, tokens, human-minutes of format overhead",
    "- [ ] outcome.md — later, if the decision gets executed",
    "",
    "## One-line integrity verdict",
    "Was the debate real?",
    ""
  ].join("\n");
  const issueUrl =
    "https://github.com/lati-club/ClisTa-Protocol/issues/new" +
    `?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

  return print({
    schema: "clista.run.report.v0",
    valid: true,
    trusted: false,
    reportable: true,
    threadId: summary.threadId || options.thread || null,
    eventCount: projection.events.length,
    integrityValid: integrity.valid,
    decisionSummary: summary,
    bundle,
    submit: {
      gate: "EXTERNAL-RUNS",
      deadline: "2026-09-07",
      issueTitle,
      issueUrl,
      url: "https://github.com/lati-club/ClisTa-Protocol/issues/new",
      emailFallback: "lati@clista.ai",
      include: [
        "this event log (or the bundle written with --out)",
        "failures.md — every discipline failure observed",
        "cost.md — wall-clock, rounds, tokens, human-minutes of format overhead",
        "outcome.md — later, if the decision gets executed"
      ],
      runbook: "pack/RUNBOOK.md"
    },
    boundary:
      "Structure validated, content not endorsed. trusted:false stays the default: a clean report means the log is well-formed and reportable, not that the decision was good. Only blind external judging (docs/judging.md) decides whether a run counts toward the gate. Failed and abandoned runs are wanted evidence — report them too."
  });
}

function importCommand(options, cwd) {
  requireOption(options, "events");
  const sourcePath = path.resolve(cwd, options.events);
  const existingEvents = readEvents(cwd);
  if (existingEvents.length && !booleanOption(options.replace, false)) {
    throw new Error("Refusing to import into a non-empty ClisTa store; pass --replace true to overwrite .clista/events.ndjson");
  }

  const events = readImportEventsAt(sourcePath);
  const integrity = verifyEventIntegrity(events);
  if (!integrity.valid) {
    throw new Error(formatIntegrityReasons(integrity.reasons));
  }
  assertValidEvents(events);

  const importedEvents = writeEvents(events, cwd);
  const strictIntegrity = verifyEventIntegrity(importedEvents, { strict: true });
  if (!strictIntegrity.valid) {
    throw new Error(formatIntegrityReasons(strictIntegrity.reasons));
  }
  return print({
    schema: "clista.import.v0",
    source: sourcePath,
    valid: strictIntegrity.valid,
    importedEvents: importedEvents.length,
    integrity: strictIntegrity
  });
}

function readImportEventsAt(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Import source not found: ${sourcePath}`);
  }
  const raw = fs.readFileSync(sourcePath, "utf8").trim();
  if (!raw) {
    return [];
  }
  if (!raw.startsWith("{")) {
    return readEventsAt(sourcePath);
  }

  const exported = JSON.parse(raw);
  if (exported.schema !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported import schema ${exported.schema}`);
  }
  if (exported.protocolVersion && exported.protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported import protocolVersion ${exported.protocolVersion}`);
  }
  if (!Array.isArray(exported.events)) {
    throw new Error("Protocol export missing events array");
  }
  return exported.events;
}

module.exports = {
  exportShow,
  importCommand,
  runReport
};
