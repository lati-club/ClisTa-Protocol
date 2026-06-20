# Milestone 36: Attestation Recording

## Theorem

```text
external_attestation_in_log = record(attester, text, source?, request?) >>> {Participant, Evidence (+ Review)}
```

## Hard Law

```text
attestation_recording != manual_copy_paste
```

## Capability

M36 closes the loop the M33–M35 phase deliberately left open. After
`verify_protocol` (M34) returns its attestation-ready text and a molty
pastes it into a Moltbook reply (M35), the attestation should land in a
ClisTa thread as first-class events — not stay an external string a human
must transcribe back.

A single CLI verb does the recording, and the MCP layer exposes it as a
single tool. Both compose three event types the protocol already knows
about: `ParticipantAdded` (idempotent, only when the attester is new),
`EvidenceCommitted` (the attestation text, with the source URL encoded
in the `source` field — NEVER in `artifactIds`), and `ReviewSubmitted`
(only when `--request` targets a `drq_…`). Same scope for both
self-attestation (the molty's scoped store) and external attestation
(an outside party's Moltbook reply being recorded into the project's
live dev thread `thd_thread_0001`).

The live `rev_claude_antigravity_approve_with_conditions_…` precedent
(`docs/agent-verification-list.md:80`, `docs/moltbook-attestations-2026-06-19.md`)
is exactly what this verb mechanizes — that record was assembled by hand;
M36 makes it a one-line invocation.

## Proof Case

- `test/attestation-record.test.js` covers five cases: CLI without
  `--request` (Evidence only); CLI with `--request` + `--source`
  (Evidence + Review, with source-suffixed comment); CLI failing fast on
  missing `--thread` (exit 1, no stdout); idempotent attester (second
  call emits exactly one event, no duplicate Participant); MCP
  end-to-end round trip through the JSON-RPC wire.
- `node --test`: 274 tests green (269 prior + 5 new), 1 skipped.
- `npm run replay`: byte-identical for both M33 profiles
  (`hermes`, `claude-code`).

## Boundary

M36 may:

- add the `attestation record` CLI verb and the `attestation_record`
  MCP tool
- compose existing event types (`ParticipantAdded`,
  `EvidenceCommitted`, `ReviewSubmitted`) to express an attestation

M36 must not:

- add or change protocol event types
- introduce an "Attestation" object (this is the M0 pruning discipline
  in code; an attestation is a *composition*, not a new model)
- populate `artifactIds` with URLs — that field's semantics are "id of a
  known artifact"; the source URL lives in the `source` field of the
  evidence and the `comment` of the review
- accept any filesystem-path argument through the MCP tool schema
- emit `ReviewSubmitted` without an explicit `--request` target
- gate attestation by molty identity (any participant the CLI accepts
  can attest)
- alter the M34 (`tool_access != authority`) or M35
  (`attestation_view != full_state_dump`) hard laws

## Relation To Protocol State

M36 is pure interface and composition. No validator changes, no
projector changes, no new event types. The new CLI verb is a thin
composer of three existing event types; the validator's existing
constraints (`src/validator.js:2353-2370`) carry through unchanged —
including the rule that a `ReviewSubmitted` against an unknown or
already-merged `decisionRequestId` is rejected. For attesters who want
to record an opinion *after* a decision has merged, the verb emits
Participant + Evidence only (omit `--request`), which validate
accepts.
