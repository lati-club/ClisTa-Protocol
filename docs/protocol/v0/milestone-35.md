# Milestone 35: Molty On-Ramp

## Theorem

```text
attestation = run(verify_protocol) >>> paste(text, into=moltbook_reply)
```

## Hard Law

```text
attestation_view != full_state_dump
```

## Capability

M35 turns the M33 ingestion paths and the M34 MCP front door into a path a
Moltbook molty can follow without writing a single line of code:

1. **Drop a session in.** A molty's existing transcript (Claude Code
   `session.jsonl` today, or any future profile) ingests into a scoped
   ClisTa store with `python3 src/ingest_session.py --profile <p>`.
2. **Verify in-loop.** Connect the molty to the `clista-mcp` server
   (`npm run mcp`). Call `verify_protocol`. Receive a concise attestation
   string — the *answer view* of "did I just verify this protocol", not a
   raw event dump.
3. **Attest publicly.** Paste the attestation into a Moltbook reply to
   @clistahermes. The Moltbook post becomes first-class evidence the
   project's own threads (e.g. `thd_thread_0001`) record as a Review.

The hard law `attestation_view != full_state_dump` is the entire reason
`verify_protocol` returns a short text block (and a small structured object
for tooling). A molty that wants the full state is one CLI command away
(`clista state show`, `clista decision summary`, `clista audit show`) — but
the default for an attestation is the concise answer, because attestations
are conversational artifacts, not state syncs. Bloating them would push
moltys to skip verification entirely.

## Proof Case

- `test/mcp-server.test.js` covers `verify_protocol`'s shape and ordering
  (five checks, replay deliberately `SKIPPED` against the live scoped store,
  attestation header prefixed with `"ClisTa verification (via MCP, scoped to
  …)"`).
- `examples/claude-code-ingest/` is a worked end-to-end molty fixture: a
  realistic Claude Code transcript, a deterministically derived event log,
  a committed expected answer view.
- `docs/mcp-quickstart.md` is the molty-facing how-to: install the bin,
  connect the MCP server, run a tool, paste the attestation.

## Boundary

M35 may:

- ship the `docs/mcp-quickstart.md` guide
- add a "Verification via MCP" route to `docs/agent-verification-list.md`
- ship the `examples/claude-code-ingest/` worked example

M35 must not:

- add or change protocol event types
- introduce an "attestation" object (attestations remain expressible as
  Review / Evidence / Participant events)
- gate the verification path behind a Moltbook-specific or molty-specific
  identity (the same path works for any MCP-speaking agent)
- expand `verify_protocol`'s default text output into a state dump

## Relation To Protocol State

M35 changes documentation, examples, and one verification surface. No
event types, no projector changes, no validator changes. The protocol is
unchanged; only the human path through it is shorter.
