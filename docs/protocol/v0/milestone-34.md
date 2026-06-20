# Milestone 34: MCP Interface

## Theorem

```text
mcp_tool_call(verb, args) = runCaptured(cli_argv_for(verb, args), scoped_store)
```

## Hard Law

```text
tool_access != authority
```

## Capability

M34 exposes the ClisTa CLI's read and write verbs to any MCP-speaking agent
through a hand-rolled stdio JSON-RPC 2.0 server (`src/mcp_server.js`). The
server is the front door for in-loop use: an agent that already speaks MCP
can `thread_create`, `evidence_commit`, `claim_create`, `decision_open`, and
later `verify_protocol` — without learning the event log on disk, the CLI
flag conventions, or the hashing pipeline.

Key design properties (each is a constraint):

- **Zero dependencies.** No `@modelcontextprotocol/sdk`. The server is
  newline-delimited JSON over stdio using only Node core modules.
- **Single source of truth.** Every tool dispatches through
  `runCaptured(argv, cwd)` in `src/cli.js`. The CLI is still the only code
  that mutates the store; the MCP layer is a transport.
- **One store per process.** The server is scoped to exactly one store root
  (env `CLISTA_STORE` or `initialize.params.storeRoot`). All tool dispatch
  uses that root as `cwd`; there is no tool that takes a filesystem path.
- **Stdout discipline.** Only the JSON-RPC response writer touches the real
  stdout. CLI handlers route their output through `OUT`, which `runCaptured`
  swaps for a buffering sink — so a tool result and a JSON-RPC frame can
  never collide on the wire.
- **No new event types.** Every tool is an alias for an existing CLI verb.
  M34 adds NO objects to the protocol; "attestations" are expressed as
  existing Review / Evidence / Participant events.

The `verify_protocol` meta-tool runs the five agent verifications from
`docs/agent-verification-list.md` against the scoped store and returns an
attestation-ready text block plus structured results. The replay sub-check
degrades to `SKIPPED` honestly: the canonical byte-identical proof is
`npm run replay` against the public examples.

## Proof Case

- `test/cli-capture.test.js` proves the OUT seam: `runCaptured` returns the
  full stdout the CLI would emit, never touches real stdout, restores the
  sink and `process.exitCode` on every code path.
- `test/mcp-server.test.js` spawns the server with a scoped store and over
  stdio: asserts `initialize` / `tools/list`, an end-to-end
  `thread_create` → `claim_create` → `validate` round trip (`{valid:true}`),
  the `verify_protocol` shape, that a missing required argument returns
  JSON-RPC `-32602`, and that a `../`-laden scalar argument cannot escape
  the scoped store.

## Boundary

M34 may:

- add `src/mcp_server.js`, the `clista-mcp` bin, and the `npm run mcp` script
- expose existing CLI verbs as MCP tools with domain-only argument schemas
- add a `verify_protocol` meta-tool that runs the five existing agent
  verifications and returns an attestation string
- add the cli.js OUT seam and the exported `runCaptured`

M34 must not:

- add or change protocol event types
- expose any filesystem path argument through a tool schema
- bypass the CLI: every write must go through `main(argv, cwd)`
- claim a protocol role for tool callers: listing a tool grants no
  authority, no signing key, and no ability to merge a decision the
  underlying CLI would not also allow

## Relation To Protocol State

M34 is pure interface. No event types, no projector changes, no validator
changes. A tool call mutates the store iff the equivalent CLI invocation
would, and produces the same events.
