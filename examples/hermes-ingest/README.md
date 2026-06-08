# Hermes Ingestion Example

A worked example of the **agent ingestion adapter** (M30): a raw Hermes session
turned into the canonical ClisTa event log, with no hand-authoring.

Unlike the hand-built `scenario-demo`, every event here was *generated* by
`src/ingest_hermes.py` from `session.json`. The adapter is the subject of the
demonstration; the engine then validates and projects the result like any other
log.

## Files

- `session.json` — the input Hermes transcript (4 messages: a user question, an
  assistant tool call, the tool output, and an assistant recommendation that
  also names a privacy concern).
- `events.ndjson` — the generated append-only event log (10 events).

## Regenerate

From the repository root:

```sh
python3 src/ingest_hermes.py --input examples/hermes-ingest/session.json --output examples/hermes-ingest/events.ndjson
```

Object ids and the thread/participant timestamps are freshly generated, so a new
run produces an equivalent log with different ids. The committed `events.ndjson`
is one such snapshot — there is no `expected-state.json` to diff against, because
the ids vary by design.

## What the adapter emits

The 4-message session maps to 10 canonical events:

| Source | Events |
| --- | --- |
| Human + agent identities | `ParticipantAdded` ×2 |
| Session | `ThreadCreated` |
| User question | `ClaimCreated` |
| Tool output | `EvidenceCommitted` |
| Named concern ("must ensure … privacy") | `ObjectionRaised` (non-blocking) |
| Assistant recommendation (evidence-backed) | `AssumptionDeclared` + `DecisionRequestOpened` + `ReviewSubmitted` + `DecisionMerged` |

See `docs/hermes-thread-emission.md` for the full mapping and extraction rules.

## Run It

From the repository root — the engine validates and projects the generated log
exactly like any hand-authored one:

```sh
node src/cli.js validate  --events examples/hermes-ingest/events.ndjson
node src/cli.js state show --events examples/hermes-ingest/events.ndjson
node src/cli.js audit show --events examples/hermes-ingest/events.ndjson
```

To trace the decision back to its source event, participant, and authority
context (ids vary per run, so read one from the log):

```sh
DECISION=$(grep -o '"id":"dcr_[a-f0-9]*"' examples/hermes-ingest/events.ndjson | head -1 | cut -d'"' -f4)
node src/cli.js provenance trace "$DECISION" --events examples/hermes-ingest/events.ndjson
```

## What It Demonstrates

A messy conversation becomes durable, reloadable, engine-verifiable state:

- the user's question is a `claim`; the tool output is `evidence`
- the assistant's privacy caveat is a recorded, non-blocking `objection`
- the recommendation is an `approved decision` that rests on the evidence and a
  named assumption, and is shown to have considered the objection
- every contribution is attributed to a source event, a participant, and an
  authority context; the audit chain is content-hash linked end to end

```text
adapter_emits_protocol != adapter_owns_protocol
```

The session is input; the engine owns protocol state. No privileged server is
required — the event log is the source of truth.
