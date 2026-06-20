# Milestone 33: Generic Session Adapter

## Theorem

```text
ingestion_pipeline = normalize(provider_session) >>> shared_event_pipeline
```

## Hard Law

```text
provider_profile != protocol_change
```

## Capability

M33 generalizes the Hermes ingestion adapter (M30 / M32) into a single front
end with a small registry of provider profiles. Each profile knows only how to
flatten its provider's raw session format into a canonical normalized message
list `[{role, content, tool_calls, tool_call_id, timestamp}, ...]`. After
normalization, the SAME `session_to_events` pipeline runs for every provider:
same content-derived ids, same recommendation / objection detection, same
decision-merge gating.

Two profiles ship at M33:

- `hermes` — the existing adapter, now a profile entry. Output is
  byte-identical to M32 for the committed `examples/hermes-ingest/`
  session; `scripts/replay.sh` enforces this.
- `claude-code` — a Claude Code `session.jsonl` transcript. Tool-use blocks
  become evidence, the recommending assistant turn (if any) becomes a
  proposal, with the same shared pipeline emitting the decision events.

`src/ingest_hermes.py` is reduced to a thin shim over `ingest_session.py
--profile hermes` to keep older scripts and docs working unchanged. The
clean-room replay (`npm run replay`) ingests BOTH profiles and asserts each
log is byte-identical to its committed example.

## Proof Case

- `test/hermes-ingest-replay.test.js` and the M32 byte-identical proof are
  unaltered: the existing example log validates and its `decision summary`
  equals the committed `expected-summary.json`.
- `test/claude-code-ingest-replay.test.js` re-ingests the Claude Code
  example twice and asserts byte-identical regeneration; it also re-asserts
  validate-true and the committed answer view.
- `scripts/replay.sh` runs both profiles in a fresh temp dir from copied
  public artifacts only — no `.clista/` state required.

## Boundary

M33 may:

- introduce `src/ingest_session.py` and its profile registry
- add the `claude-code` profile and its example
- reduce `src/ingest_hermes.py` to a profile shim
- extend `scripts/replay.sh` to cover every committed profile

M33 must not:

- add or change protocol event types
- change the validator, projector, or exporter
- change the content shape of emitted objects beyond what a profile's
  normalization step legitimately changes (i.e. which messages exist)
- alter the hermes example's committed `events.ndjson`

## Relation To Protocol State

M33 is interface code only. The protocol's object model is untouched.
Adding a new provider profile must never change protocol output for any
existing profile — the hermes byte-identical replay is the standing
regression test.
