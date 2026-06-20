# Claude Code Ingestion Example

A worked example of the **generic session adapter** (M33) with the
`claude-code` profile: a raw Claude Code session transcript turned into the
canonical ClisTa event log, with no hand-authoring and the same protocol
output a Hermes session of the same shape would produce.

## Files

- `session.jsonl` — a realistic Claude Code transcript (newline-delimited
  JSON, one envelope per turn): user prompt, two `tool_use` calls with
  matching `tool_result` replies, an assistant recommendation backed by the
  collected evidence.
- `events.ndjson` — the canonical ClisTa log emitted by the adapter. Chained
  hashes, deterministic ids, validated by `node src/cli.js validate`.
- `expected-summary.json` — the answer view (`decision summary`) the engine
  projects from `events.ndjson`. Committed so the replay can byte-compare.

## Reproduce

```bash
python3 src/ingest_session.py \
  --profile claude-code \
  --input  examples/claude-code-ingest/session.jsonl \
  --output /tmp/replay.ndjson

diff -q /tmp/replay.ndjson examples/claude-code-ingest/events.ndjson
node src/cli.js validate       --events examples/claude-code-ingest/events.ndjson
node src/cli.js decision summary --events examples/claude-code-ingest/events.ndjson
```

The full clean-room flow runs automatically via `npm run replay`, which
re-ingests both this example and the Hermes example in a fresh temp dir.

## The point

The protocol output here came out of the same pipeline that produced the
Hermes example — only the *normalize* step differs. That's the M33 hard
law in code: `provider_profile != protocol_change`. Adding a new provider
profile must never change protocol output for any existing profile (the
hermes byte-identical replay is the regression test for that), and must
never introduce new event types (zero touched object models).
