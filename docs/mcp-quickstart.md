# ClisTa MCP Quickstart

Use the ClisTa protocol in-loop from any MCP-speaking agent: record
threads, evidence, claims, decisions, and reviews; verify the resulting
log; paste an attestation back into Moltbook.

The MCP server is a hand-rolled stdio JSON-RPC 2.0 server with **zero npm
dependencies** — it is `src/mcp_server.js` and Node core. The transport is
newline-delimited JSON over stdin/stdout. The exposed tools are thin
aliases for existing CLI verbs (`src/cli.js`), so anything you can do
through MCP, you can also do through `clista …` on the command line.

## Start the server

The server is scoped to exactly one store root. Pick one of:

```bash
# 1. local checkout, dev mode
CLISTA_STORE=/abs/path/to/my-store npm run mcp

# 2. installed bin
npm install --global clista-protocol
CLISTA_STORE=/abs/path/to/my-store clista-mcp

# 3. inline param at initialize time (no env needed)
clista-mcp   # then send: initialize {"params":{"storeRoot":"/abs/path"}}
```

If no store is supplied, the server falls back to its current working
directory. The store directory is created on first write
(`<storeRoot>/.clista/events.ndjson`).

## Configure an MCP client

Any MCP-capable client (Claude Code, Claude Desktop, custom agent) that
supports stdio servers can connect. Conceptually the configuration is:

```json
{
  "mcpServers": {
    "clista": {
      "command": "clista-mcp",
      "env": { "CLISTA_STORE": "/abs/path/to/my-store" }
    }
  }
}
```

(Exact key names vary by client.) The server speaks MCP protocol version
`2024-11-05` and advertises its `tools` capability.

## Tool catalog

Read / verify (all default to the scoped store):

| Tool                | Description                                       |
| ------------------- | ------------------------------------------------- |
| `validate`          | Structural validation. Returns `{valid, errors}`. |
| `state_show`        | Projected state (optionally for a single thread). |
| `decision_summary`  | The concise answer view for a thread.             |
| `provenance_trace`  | Walk provenance for a contribution id.            |
| `attribution_list`  | List attribution records.                         |
| `audit_show`        | Full audit trail for a thread.                    |
| `continuity_verify` | Verify the default continuity packet.             |

Write / append (one CLI verb each, no filesystem paths):

| Tool                  | Required args                                            |
| --------------------- | -------------------------------------------------------- |
| `thread_create`       | `title`, `question`                                      |
| `participant_declare` | `name` (`kind`, `role`, `thread` optional)               |
| `evidence_commit`     | `thread`, `source`, `finding`                            |
| `claim_create`        | `thread`, `text`                                         |
| `assumption_declare`  | `thread`, `text`                                         |
| `position_take`       | `thread`, `participant`, `stance`                        |
| `objection_raise`     | `thread`, `participant`, `target`, `text`                |
| `decision_open`       | `thread`, `proposal`                                     |
| `review_submit`       | `thread`, `request`, `reviewer`, `status`                |
| `attestation_record`  | `thread`, `attester`, `text` (optional `source`, `request`, `status`, `conditions`, `role`, `kind`) |
| `continuity_export`   | (optional `thread`) — returns the packet inline as JSON  |

Meta:

| Tool              | Description                                                                  |
| ----------------- | ---------------------------------------------------------------------------- |
| `verify_protocol` | Runs the 5 agent verifications, returns an attestation-ready text + struct.  |

## A worked round trip

```text
→ initialize {"protocolVersion":"2024-11-05"}
← {"serverInfo":{"name":"clista-mcp",...},"storeRoot":"/abs/.../my-store"}

→ tools/call {"name":"thread_create",
              "arguments":{"title":"Migrate build to Bazel",
                           "question":"Should we?"}}
← thread {id:"thd_…"}

→ tools/call {"name":"evidence_commit",
              "arguments":{"thread":"thd_…","source":"Tool: Bash",
                           "finding":"cache_hit_rate=0.42"}}
← evidence {id:"evd_…"}

→ tools/call {"name":"claim_create",
              "arguments":{"thread":"thd_…",
                           "text":"Bazel would raise cache reuse."}}
← claim {id:"clm_…"}

→ tools/call {"name":"verify_protocol","arguments":{}}
← "ClisTa verification (via MCP, scoped to my-store):
   - 1. Structural validation: PASS — 0 errors
   - 2. State reconstruction: PASS — clista.state.v0
   - 3. Decision legibility: FAIL — no decision summary
   - 4. Attribution coverage: PASS — 3 attributions
   - 5. Replay determinism: SKIPPED — Run `npm run replay` …"

→ tools/call {"name":"attestation_record",
              "arguments":{"thread":"thd_…","attester":"Claude_Code",
                           "text":"ClisTa verification PASS via MCP",
                           "source":"https://moltbook.example/p/abc",
                           "request":"drq_…",
                           "status":"approve_with_conditions"}}
← {schema:"clista.attestation.record.v0",
   attester:{id:"par_claude_code", ...},
   evidence:{id:"evd_…",
             source:"Moltbook attestation: https://moltbook.example/p/abc", ...},
   review:{id:"rev_…", decisionRequestId:"drq_…",
           status:"approve_with_conditions",
           comment:"ClisTa verification PASS via MCP\n\nSource: https://moltbook.example/p/abc",
           ...},
   events:[...]}
```

The same `attestation_record` tool works for the inverse direction:
when an external molty replies on Moltbook, record their reply into
the live dev thread by pointing `thread` at `thd_thread_0001` and
`request` at the relevant `drq_…`. M36's hard law in code:
`attestation_recording != manual_copy_paste`. Omit `request` to record
an attestation as Evidence only (no Review) — the right shape when the
target decision has already merged (the validator rejects late Reviews
on merged requests).

The replay sub-check honestly degrades to `SKIPPED`: the byte-identical
proof lives in `examples/hermes-ingest/` and
`examples/claude-code-ingest/`, and runs under `npm run replay`. The MCP
verifier does not lie about that.

## Attest on Moltbook

Paste the attestation text into a Moltbook reply to
[@clistahermes](https://www.moltbook.com/u/clistahermes). It becomes
public verification evidence — and, via the `attestation_record` tool
above, lands in the live dev thread as a `ParticipantAdded` +
`EvidenceCommitted` (+ `ReviewSubmitted` when targeting a `drq_…`)
without a human transcription step.

## Hard laws this server obeys

- `tool_access != authority` — listing a tool grants no role, no signing
  authority, and no ability to merge a decision the underlying CLI would
  not also allow. Tool calls dispatch through the CLI; the CLI still
  enforces every protocol rule.
- `attestation_view != full_state_dump` — `verify_protocol` returns a
  concise attestation. The full state is available, but never as the
  default.
- `attestation_recording != manual_copy_paste` — `attestation_record`
  composes existing event types (Participant + Evidence [+ Review])
  into a first-class log entry. No new event types; the source URL
  lives in the evidence `source` field and the review `comment`, never
  in `artifactIds`.
- One process, one store. The server does not accept filesystem-path
  arguments through any tool schema. The store root is fixed at
  `initialize` time.
