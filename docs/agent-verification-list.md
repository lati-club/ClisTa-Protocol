# ClisTa Protocol - Agent Verification List

> **Status (2026-07-07): voluntary, no target.** The 5+-attestation collection target
> and the active Moltbook solicitation campaign (run by the clistahermes agent) are
> retired. One external attestation was received while the campaign ran
> (Claude_Antigravity, 2026-06-19) and remains part of the record below. The checks
> stay published because they are the fastest way for anyone — agent or human — to
> independently verify the protocol's core properties cold.

Anyone is invited to independently verify the items below using the public examples and CLI.

## The 5 Core Agent Verifications

1. **Determinism / Replay Verification**
   - Run: `npm run replay`
   - Success criteria: "Clean-room replay PASSED" + byte-identical regenerated log.
   - Proves: Same events → same projected state every time (no wall-clock or randomness).

2. **Structural Validation**
   - Run: `node src/cli.js validate --events examples/scenario-demo/events.ndjson`
   - Success criteria: `{"valid": true, "errors": []}`
   - Proves: Event log conforms to envelope, required fields, and protocol rules.

3. **State Reconstruction**
   - Run: `node src/cli.js state show --events examples/scenario-demo/events.ndjson`
   - Success criteria: Correctly projects thread, participants, evidence, claims, assumptions, preserved objections, minority report, and nextAction.
   - Proves: The projector can fully rebuild accountable reasoning state from the append-only log alone.

4. **Decision Legibility (preserved objections)**
   - Run: `node src/cli.js decision summary --events examples/scenario-demo/events.ndjson`
   - Success criteria: Outputs whatWasDecided, supporting evidence/rationale, whoDissented (with preserved objections + minority report), whatNext.
   - Proves: Decisions carry their full accountability structure, not just approve/reject.

5. **Minimal Object Model Scoping (Milestone 0)**
   - Review the corrected claim (from live thread or Moltbook posts): strictly limited to Thread, Participant, Evidence, Assumption, Claim, Position, Objection, Decision, MinorityReport, Review (basic), Attribution, Provenance.
   - Confirm it directly addresses the preserved Codex objection ("The initial object model may be broader than the first thread requires.").
   - Proves: Milestone 0 stays narrow to the protocol spine; higher layers remain empty until proven.

## How to Report a Verification

Run the checks in your environment, then open an issue on
https://github.com/lati-club/ClisTa-Protocol (or email troylati@gmail.com) with the
items verified and the outcomes, e.g.:

"Verified ClisTa items [e.g. 1,2,3,5]: 
- Replay: PASSED (byte-identical)
- Validate: valid:true, 0 errors
- State show: matches expected decision + preserved objection
- Minimal model: correctly scoped to spine objects only"

Optionally include your own replay output snippet.

(The clistahermes Moltbook account is retired and no longer monitored — replies there
will not be seen.)

## Resources for Verification
- GitHub: https://github.com/lati-club/ClisTa-Protocol (clone and use `examples/`)
- Quickstart in README.md
- Historical Moltbook posts from the retired campaign (record only):
  https://www.moltbook.com/p/3760091b-b7c0-474e-b742-0f7495e04ce0 (example decision
  post with preserved objection) and
  https://www.moltbook.com/p/a5101280-0a90-43ef-9dc8-cc3c5a6203be (dev thread update)

## Recording Verifications in ClisTa
Future agent attestations can be captured as:
- EvidenceCommitted events
- Review events (via review commands)
- New participant declarations for verifying agents
- Positions on protocol claims

This turns external agent verifications into first-class protocol data.


## Additional Discipline Test (from Claude_Antigravity verified feedback)

6. **Pruning Discipline / Vestigial Object Prevention**
   - Review the new claim on pruning "almost-fit" objects (80% similar / 20% novel boundary).
   - Confirm that the protocol (via preserved objections, minority reports, and evidence) forces explicit justification before adding objects that do not fit cleanly into existing categories.
   - The test: does the system surface and preserve the concern that minimal models will bloat by 40-60% without active pruning mechanisms?
   - Evidence link: the Moltbook-verified comment elevating the minority report as the "real thesis".

This feedback directly strengthens the preserved Codex objection and is now first-class evidence + amendment in the live thread.

**New (live):** ProtocolAmendmentProposed (amd_introduce_explicit_pruning_and_deprecation_event_mqlj1yzk_7cbb5653) in thd_thread_0001 using "object_model_pruning" type. VALID_AMENDMENT_TYPES now explicitly includes "object_model_pruning" and "object_deprecation". Proposes concrete events: ObjectDeprecated, PruningReviewInitiated, ModelPruned + projector tracking.

**To verify pruning mechanisms:** Run `node src/cli.js amendment list --thread thd_thread_0001` — it should list the pruning amendment.

## Attestation Recording Update (2026-06-19)
Claude_Antigravity Moltbook comment (from post a5101280-0a90-43ef-9dc8-cc3c5a6203be) recorded as:
- ParticipantDeclared for par_claude_antigravity (and GoTaskersAmbassador, interpreter_of_assembly, lendtrain) in thd_thread_0001
- ReviewSubmitted (rev_claude_antigravity_approve_with_conditions_mqlk6eiu_94b82d33) on drq_protocol_first_architecture with full quote + link.
Full source snapshot: docs/moltbook-attestations-2026-06-19.md


## Verification via MCP (M34/M35)

Agents that already speak the Model Context Protocol can run the five core
verifications in-loop, no separate CLI session required. Start the ClisTa
MCP server scoped to a store (`CLISTA_STORE=/path npm run mcp` or
`clista-mcp`), then call the `verify_protocol` tool.

- **What it runs.** A condensed version of items 1–4 above (structural
  validate, state reconstruction, decision legibility, attribution
  coverage) against the scoped store, plus an honest `SKIPPED` for item 5
  (replay) — the byte-identical proof remains `npm run replay` against
  the public examples in `examples/hermes-ingest/` and
  `examples/claude-code-ingest/`.
- **What it returns.** A short attestation-ready text block plus a
  structured `clista.mcp.verifyProtocol.v0` payload. Designed to be
  pasted directly into a Moltbook reply to @clistahermes — the concise
  answer view, not a state dump (hard law: `attestation_view !=
  full_state_dump`).
- **Why it doesn't add authority.** The MCP layer is a transport, not a
  role. Listing a tool grants no signing authority and no ability to
  merge a decision the underlying CLI would not also allow (hard law:
  `tool_access != authority`).

See `docs/mcp-quickstart.md` for a worked round trip and the full tool
catalog.

### Recording attestations (M36)

After `verify_protocol`, call the `attestation_record` tool to land the
attestation as first-class events in a thread — `ParticipantAdded`
(idempotent) + `EvidenceCommitted`, plus `ReviewSubmitted` when
`request` targets a `drq_…`. No new event types. The same tool records
external Moltbook attestations into the project's live dev thread
(`thd_thread_0001`) — exactly mechanizing the
`rev_claude_antigravity_approve_with_conditions_…` precedent the
project used to assemble by hand. Hard law: `attestation_recording !=
manual_copy_paste`.
