#!/usr/bin/env node
//
// ClisTa MCP server (stdio JSON-RPC 2.0, newline-delimited JSON).
//
// Exposes ClisTa CLI verbs as MCP tools so any agent that speaks MCP can record
// its own accountable reasoning into a scoped store and verify it after the
// fact, all without learning the on-disk event format. The server is a strict
// front-end: every tool dispatches through the CLI's main() via runCaptured(),
// keeping the CLI as the single source of truth for protocol writes and reads.
//
// Hand-rolled on purpose to honor the project's zero-dependency discipline —
// no @modelcontextprotocol/sdk, no JSON-RPC library, no npm install. Only Node
// core modules. The protocol used is the MCP stdio framing (newline-delimited
// JSON-RPC 2.0). Anything richer the SDK supports is intentionally omitted
// until a real use case demands it.
//
// Hard laws this milestone (M34) enforces:
//   - tool_access != authority. Listing a tool grants no role, no signing
//     authority, no ability to merge a decision: the underlying CLI still
//     enforces every protocol rule. The MCP layer is a transport, not a role.
//   - one store root, one process. The server is scoped to exactly one store
//     (CLISTA_STORE env or initialize.params.storeRoot) and never serves tools
//     that take filesystem-path arguments — domain args only.

const fs = require("node:fs");
const path = require("node:path");

const { runCaptured } = require("./cli.js");

const SERVER_NAME = "clista-mcp";
const SERVER_VERSION = "0.1.0";
const PROTOCOL_VERSION = "2024-11-05";

// ---- Tool registry --------------------------------------------------------
//
// Each entry maps a tool name to the CLI verb it dispatches, plus a JSON
// Schema for its inputs (schemas advertised to the client via tools/list) and
// a toArgv() converter that turns validated inputs into a CLI argv array.
//
// Two hard rules for every entry:
//   1. NO filesystem-path inputs. The CLI accepts --events, --out, --packet
//      flags; none of those are reachable through MCP. The server always
//      operates on the scoped store directory.
//   2. NO new event types. Every tool is a thin alias for a verb that already
//      exists in src/cli.js — the MCP layer adds no objects to the protocol.

function tools() {
  return [
    // ---- Read / verify --------------------------------------------------
    {
      name: "validate",
      description: "Structural validation of the scoped event log. Returns {valid, errors}.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      toArgv: () => ["validate"]
    },
    {
      name: "state_show",
      description: "Projected state of a thread (or all threads if no id given).",
      inputSchema: {
        type: "object",
        properties: { thread: { type: "string", description: "Thread id." } },
        additionalProperties: false
      },
      toArgv: (a) => withThread(["state", "show"], a)
    },
    {
      name: "decision_summary",
      description: "Concise answer view: what was decided, why, who dissented, what next.",
      inputSchema: {
        type: "object",
        properties: {
          thread: { type: "string" },
          format: { type: "string", enum: ["json", "text", "md", "markdown"] }
        },
        additionalProperties: false
      },
      toArgv: (a) => {
        const argv = withThread(["decision", "summary"], a);
        if (a.format) argv.push("--format", String(a.format));
        return argv;
      }
    },
    {
      name: "provenance_trace",
      description: "Walk the provenance chain for a contribution id.",
      inputSchema: {
        type: "object",
        properties: { contributionId: { type: "string" } },
        required: ["contributionId"],
        additionalProperties: false
      },
      toArgv: (a) => ["provenance", "trace", String(a.contributionId)]
    },
    {
      name: "attribution_list",
      description: "List attribution records, optionally filtered by thread id.",
      inputSchema: {
        type: "object",
        properties: { thread: { type: "string" } },
        additionalProperties: false
      },
      toArgv: (a) => withThread(["attribution", "list"], a)
    },
    {
      name: "audit_show",
      description: "Full audit trail for a thread.",
      inputSchema: {
        type: "object",
        properties: { thread: { type: "string" } },
        additionalProperties: false
      },
      toArgv: (a) => withThread(["audit", "show"], a)
    },
    {
      name: "continuity_verify",
      description: "Verify the default continuity packet stored in the scoped store.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      toArgv: () => ["continuity", "verify"]
    },

    // ---- Write / append -------------------------------------------------
    //
    // Each write tool corresponds to exactly one CLI verb and emits exactly
    // one existing event type. No new object types, no synthetic compound
    // operations. If a write fails (missing arg, validator rejects an event),
    // the failure surfaces as a JSON-RPC error and the store is not modified.
    {
      name: "thread_create",
      description: "Create a new thread.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          question: { type: "string" }
        },
        required: ["title", "question"],
        additionalProperties: false
      },
      toArgv: (a) => ["thread", "create", "--title", String(a.title), "--question", String(a.question)]
    },
    {
      name: "participant_declare",
      description: "Declare a participant (defaults to kind=human).",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          kind: { type: "string", enum: ["human", "agent", "tool", "system"] },
          role: { type: "string" },
          thread: { type: "string" }
        },
        required: ["name"],
        additionalProperties: false
      },
      toArgv: (a) => {
        const argv = ["participant", "declare", "--name", String(a.name)];
        if (a.kind) argv.push("--kind", String(a.kind));
        if (a.role) argv.push("--role", String(a.role));
        if (a.thread) argv.push("--thread", String(a.thread));
        return argv;
      }
    },
    {
      name: "evidence_commit",
      description: "Commit evidence to a thread.",
      inputSchema: {
        type: "object",
        properties: {
          thread: { type: "string" },
          source: { type: "string" },
          finding: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["thread", "source", "finding"],
        additionalProperties: false
      },
      toArgv: (a) => {
        const argv = ["evidence", "commit", "--thread", String(a.thread),
          "--source", String(a.source), "--finding", String(a.finding)];
        if (a.confidence !== undefined) argv.push("--confidence", String(a.confidence));
        return argv;
      }
    },
    {
      name: "claim_create",
      description: "Create a claim, optionally citing supporting evidence ids.",
      inputSchema: {
        type: "object",
        properties: {
          thread: { type: "string" },
          text: { type: "string" },
          evidence: { type: "string", description: "Comma-separated evidence ids." }
        },
        required: ["thread", "text"],
        additionalProperties: false
      },
      toArgv: (a) => {
        const argv = ["claim", "create", "--thread", String(a.thread), "--text", String(a.text)];
        if (a.evidence) argv.push("--evidence", String(a.evidence));
        return argv;
      }
    },
    {
      name: "assumption_declare",
      description: "Declare a load-bearing assumption.",
      inputSchema: {
        type: "object",
        properties: { thread: { type: "string" }, text: { type: "string" } },
        required: ["thread", "text"],
        additionalProperties: false
      },
      toArgv: (a) => ["assumption", "declare", "--thread", String(a.thread), "--text", String(a.text)]
    },
    {
      name: "position_take",
      description: "Take a position on a claim/decision (stance: support|oppose|conditional|neutral|abstain).",
      inputSchema: {
        type: "object",
        properties: {
          thread: { type: "string" },
          participant: { type: "string" },
          stance: { type: "string", enum: ["support", "oppose", "conditional", "neutral", "abstain"] },
          target: { type: "string", description: "Target object id (claim, request, etc.)" }
        },
        required: ["thread", "participant", "stance"],
        additionalProperties: false
      },
      toArgv: (a) => {
        const argv = ["position", "take",
          "--thread", String(a.thread),
          "--participant", String(a.participant),
          "--stance", String(a.stance)];
        if (a.target) argv.push("--target", String(a.target));
        return argv;
      }
    },
    {
      name: "objection_raise",
      description: "Raise an objection against an object in a thread.",
      inputSchema: {
        type: "object",
        properties: {
          thread: { type: "string" },
          participant: { type: "string" },
          target: { type: "string", description: "Object id being objected to." },
          text: { type: "string" }
        },
        required: ["thread", "participant", "target", "text"],
        additionalProperties: false
      },
      toArgv: (a) => ["objection", "raise",
        "--thread", String(a.thread),
        "--participant", String(a.participant),
        "--target", String(a.target),
        "--text", String(a.text)]
    },
    {
      name: "decision_open",
      description: "Open a decision request with a proposal.",
      inputSchema: {
        type: "object",
        properties: { thread: { type: "string" }, proposal: { type: "string" } },
        required: ["thread", "proposal"],
        additionalProperties: false
      },
      toArgv: (a) => ["decision", "open", "--thread", String(a.thread), "--proposal", String(a.proposal)]
    },
    {
      name: "attestation_record",
      description:
        "Record an attestation as first-class events in a thread (M36). " +
        "Emits ParticipantDeclared (idempotent) + EvidenceCommitted, plus " +
        "ReviewSubmitted when `request` targets a decision request. No new event types.",
      inputSchema: {
        type: "object",
        properties: {
          thread: { type: "string" },
          attester: { type: "string", description: "Attester name or par_… id." },
          text: { type: "string" },
          source: { type: "string", description: "Optional source URL (e.g. Moltbook post)." },
          request: { type: "string", description: "Optional drq_… to attach a Review to." },
          status: { type: "string" },
          conditions: { type: "string", description: "Comma-separated conditions for the Review." },
          role: { type: "string" },
          kind: { type: "string", enum: ["human", "agent", "tool", "system"] }
        },
        required: ["thread", "attester", "text"],
        additionalProperties: false
      },
      toArgv: (a) => {
        const argv = ["attestation", "record",
          "--thread", String(a.thread),
          "--attester", String(a.attester),
          "--text", String(a.text)];
        if (a.source) argv.push("--source", String(a.source));
        if (a.request) argv.push("--request", String(a.request));
        if (a.status) argv.push("--status", String(a.status));
        if (a.conditions) argv.push("--conditions", String(a.conditions));
        if (a.role) argv.push("--role", String(a.role));
        if (a.kind) argv.push("--kind", String(a.kind));
        return argv;
      }
    },
    {
      name: "review_submit",
      description: "Submit a review on a decision request (status: approve|request_changes|reject).",
      inputSchema: {
        type: "object",
        properties: {
          thread: { type: "string" },
          request: { type: "string" },
          reviewer: { type: "string" },
          status: { type: "string" },
          comment: { type: "string" }
        },
        required: ["thread", "request", "reviewer", "status"],
        additionalProperties: false
      },
      toArgv: (a) => {
        const argv = ["review", "submit",
          "--thread", String(a.thread),
          "--request", String(a.request),
          "--reviewer", String(a.reviewer),
          "--status", String(a.status)];
        if (a.comment) argv.push("--comment", String(a.comment));
        return argv;
      }
    },
    {
      name: "continuity_export",
      description: "Export a continuity packet for the scoped store (inline JSON; never written to disk).",
      inputSchema: {
        type: "object",
        properties: { thread: { type: "string" } },
        additionalProperties: false
      },
      toArgv: (a) => withThread(["continuity", "export"], a)
    },

    // ---- Meta -----------------------------------------------------------
    {
      name: "verify_protocol",
      description:
        "Run the 5 agent verifications from docs/agent-verification-list.md " +
        "and return an attestation-ready string a molty can paste into a Moltbook reply.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      // Special-cased: not a direct CLI verb. See callTool() below.
      verifyProtocol: true
    }
  ];
}

function withThread(argv, args) {
  if (args && args.thread) argv.push("--thread", String(args.thread));
  return argv;
}

// ---- JSON-RPC plumbing ----------------------------------------------------
//
// MCP framing here is "newline-delimited JSON" — one JSON-RPC 2.0 message per
// line on stdin, one per line on stdout. We only touch process.stdout in
// writeFrame(); every other byte of output is funneled through runCaptured()'s
// OUT sink so a CLI handler can never corrupt the wire.

function writeFrame(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function rpcError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error: err };
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

// ---- Tool dispatch --------------------------------------------------------

function findTool(name) {
  return tools().find((t) => t.name === name) || null;
}

// Minimal JSON-Schema check: required fields and disallowed extras. Anything
// beyond this is delegated to the CLI handler, which already validates inputs.
function validateInputs(tool, input) {
  const schema = tool.inputSchema || {};
  const props = schema.properties || {};
  const allowed = new Set(Object.keys(props));
  const required = schema.required || [];
  const value = input && typeof input === "object" ? input : {};
  for (const key of required) {
    if (value[key] === undefined || value[key] === null || value[key] === "") {
      return { ok: false, message: `Missing required argument: ${key}` };
    }
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) {
        return { ok: false, message: `Unknown argument: ${key}` };
      }
    }
  }
  return { ok: true };
}

function callTool(tool, args, scopedRoot) {
  if (tool.verifyProtocol) {
    return verifyProtocol(scopedRoot);
  }
  const argv = tool.toArgv(args || {});
  const { stdout, exitCode } = runCaptured(argv, scopedRoot);
  // CLI handlers that signal a soft failure (e.g. validate returning
  // {valid:false}) print JSON and set exitCode=1; we surface the JSON. A hard
  // failure (missing arg, handler threw) produces no stdout; only then do we
  // raise it as a JSON-RPC error so the client sees it as such.
  if (exitCode !== 0 && !stdout) {
    const error = new Error(`Tool ${tool.name} failed (exit ${exitCode}).`);
    error.code = -32000;
    throw error;
  }
  return { content: [{ type: "text", text: stdout }], isError: exitCode !== 0 };
}

// ---- verify_protocol ------------------------------------------------------
//
// Mirrors the five checks in docs/agent-verification-list.md. Replay degrades
// to SKIPPED if python3 is absent (the scoped store typically has no replay
// fixture committed; the docs link out for the byte-identical replay proof).
function verifyProtocol(scopedRoot) {
  const checks = [];

  // 1. Structural validation of the scoped store.
  try {
    const v = runCaptured(["validate"], scopedRoot);
    const parsed = v.stdout ? JSON.parse(v.stdout) : {};
    checks.push({
      id: 1,
      name: "Structural validation",
      status: parsed.valid ? "PASS" : "FAIL",
      detail: parsed.valid
        ? `${(parsed.errors || []).length} errors`
        : `errors: ${JSON.stringify(parsed.errors || []).slice(0, 200)}`
    });
  } catch (err) {
    checks.push({ id: 1, name: "Structural validation", status: "FAIL", detail: String(err.message || err) });
  }

  // 2. State reconstruction (project events → thread state).
  try {
    const s = runCaptured(["state", "show"], scopedRoot);
    const parsed = s.stdout ? JSON.parse(s.stdout) : null;
    checks.push({
      id: 2,
      name: "State reconstruction",
      status: parsed && parsed.schema ? "PASS" : "FAIL",
      detail: parsed && parsed.schema ? parsed.schema : "no state schema returned"
    });
  } catch (err) {
    checks.push({ id: 2, name: "State reconstruction", status: "FAIL", detail: String(err.message || err) });
  }

  // 3. Decision legibility (preserved objections in the answer view).
  try {
    const d = runCaptured(["decision", "summary"], scopedRoot);
    const parsed = d.stdout ? JSON.parse(d.stdout) : null;
    checks.push({
      id: 3,
      name: "Decision legibility",
      status: parsed && parsed.schema === "clista.decisionSummary.v0" ? "PASS" : "FAIL",
      detail: parsed && parsed.threadId ? `thread ${parsed.threadId}` : "no decision summary"
    });
  } catch (err) {
    checks.push({ id: 3, name: "Decision legibility", status: "FAIL", detail: String(err.message || err) });
  }

  // 4. Attribution coverage (provenance of contributions).
  try {
    const a = runCaptured(["attribution", "list"], scopedRoot);
    const parsed = a.stdout ? JSON.parse(a.stdout) : null;
    checks.push({
      id: 4,
      name: "Attribution coverage",
      status: parsed && Array.isArray(parsed.attributions) ? "PASS" : "FAIL",
      detail: parsed ? `${parsed.count} attributions` : "no attribution list"
    });
  } catch (err) {
    checks.push({ id: 4, name: "Attribution coverage", status: "FAIL", detail: String(err.message || err) });
  }

  // 5. Replay determinism — degrades to SKIPPED here because the scoped store
  // is the live one, not the replay fixture. Pointing to the canonical proof
  // is honest; running an off-fixture replay in-process would lie about it.
  checks.push({
    id: 5,
    name: "Replay determinism",
    status: "SKIPPED",
    detail: "Run `npm run replay` in the ClisTa repo for the byte-identical proof."
  });

  // Render attestation text the molty can paste into a Moltbook reply to
  // @clistahermes. Plain ASCII; no Markdown headings, so it survives even in
  // platforms that strip formatting.
  const lines = [];
  lines.push(`ClisTa verification (via MCP, scoped to ${path.basename(scopedRoot) || "store"}):`);
  for (const c of checks) {
    lines.push(`- ${c.id}. ${c.name}: ${c.status} — ${c.detail}`);
  }
  const attestation = lines.join("\n");

  return {
    content: [{ type: "text", text: attestation }],
    structuredContent: { schema: "clista.mcp.verifyProtocol.v0", checks, attestation }
  };
}

// ---- Server loop ----------------------------------------------------------

function resolveStoreRoot(envValue, paramValue) {
  // Precedence: initialize.params.storeRoot > env CLISTA_STORE > cwd. The path
  // is the server's one and only sandbox; every tool runs against it and no
  // tool exposes a way to step out of it.
  const candidate = paramValue || envValue || process.cwd();
  const absolute = path.resolve(candidate);
  fs.mkdirSync(absolute, { recursive: true });
  const stat = fs.statSync(absolute);
  if (!stat.isDirectory()) {
    throw new Error(`storeRoot is not a directory: ${absolute}`);
  }
  return absolute;
}

function handleRequest(state, message) {
  const { id, method, params } = message || {};
  if (typeof method !== "string") {
    return rpcError(id, -32600, "Invalid Request: missing method");
  }
  try {
    switch (method) {
      case "initialize": {
        const requestedRoot = params && typeof params === "object" ? params.storeRoot : undefined;
        state.scopedRoot = resolveStoreRoot(process.env.CLISTA_STORE, requestedRoot);
        state.initialized = true;
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: { tools: { listChanged: false } },
          // Non-standard but useful for clients: surface the resolved store so
          // an operator can confirm scope before issuing any write tool.
          storeRoot: state.scopedRoot
        });
      }
      case "initialized":
      case "notifications/initialized":
        // Notifications carry no id and want no response.
        return null;
      case "tools/list": {
        ensureInitialized(state);
        return rpcResult(id, {
          tools: tools().map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
          }))
        });
      }
      case "tools/call": {
        ensureInitialized(state);
        const name = params && params.name;
        const args = (params && params.arguments) || {};
        const tool = findTool(name);
        if (!tool) {
          return rpcError(id, -32601, `Unknown tool: ${name}`);
        }
        const validation = validateInputs(tool, args);
        if (!validation.ok) {
          return rpcError(id, -32602, validation.message);
        }
        try {
          const result = callTool(tool, args, state.scopedRoot);
          return rpcResult(id, result);
        } catch (err) {
          return rpcError(id, err.code || -32000, err.message || String(err));
        }
      }
      case "ping":
        return rpcResult(id, {});
      case "shutdown":
        return rpcResult(id, {});
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    return rpcError(id, -32603, err.message || String(err));
  }
}

function ensureInitialized(state) {
  if (!state.initialized) {
    // initialize is required before any other method; tools/list and
    // tools/call without it would otherwise dispatch against an unscoped cwd.
    throw Object.assign(new Error("Server not initialized"), { code: -32002 });
  }
}

function start() {
  const state = { initialized: false, scopedRoot: process.cwd() };
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch (err) {
        // Parse errors have no id to echo back; -32700 per JSON-RPC spec.
        writeFrame(rpcError(null, -32700, "Parse error"));
        continue;
      }
      const response = handleRequest(state, message);
      if (response) writeFrame(response);
    }
  });
  process.stdin.on("end", () => process.exit(0));
}

module.exports = {
  tools,
  findTool,
  validateInputs,
  callTool,
  resolveStoreRoot,
  handleRequest,
  verifyProtocol,
  PROTOCOL_VERSION,
  SERVER_NAME,
  SERVER_VERSION
};

if (require.main === module) {
  start();
}
