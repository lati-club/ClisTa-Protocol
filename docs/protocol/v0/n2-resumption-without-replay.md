# N2: Resumption Without Replay

## Claim

```text
A successor may treat a thread's reasoning state as settled, and resume from it,
using only the verified continuity packet — not the original transcript.
```

N2 is the one candidate-novel primitive ClisTa carries over its ancestors
(ADR, IBIS, DACI, RTM, comment-resolution processes). Those define how a group
*reaches* a decision. None of them define **what a newcomer may treat as settled
without re-reading the conversation**. That successor contract is N2.

It is also the property that separates the protocol from the lightweight pair it
is measured against:

```text
prompt proves behavior · markdown preserves result · protocol guarantees continuation
```

A prompt reproduces *behavior*; a markdown doc preserves a *result*. Neither
gives a successor a verifiable contract for what is settled. N2 does.

## The successor contract

The continuity packet (`clista.continuity.*`) is the defined successor contract.
Given a verified packet, a successor may rely on, without replaying the
transcript:

- `current_decision` and `status` — what is decided and whether it is settled
- `next_action` — what should happen next
- `open_objection_ids` — dissent that survived the decision
- `active_assumptions`, `accepted_claims` — the state the decision rests on
- `resume_status` — `verified` only when the projection and audit chain check out

`resume_status = verified` is the settle signal. A `degraded` or failed packet
means the successor must **not** treat the state as settled — context transfer is
not the same as trusting it.

## Realization

N2 is realized by the continuity surface, not by anything new:

```text
theorem:   reasoning_continuity = resume(project(event_log), verification_state)
hard law:  context transfer != memory trust
```

```sh
node src/cli.js continuity export  --events <log> --out packet.json
node src/cli.js continuity verify  --packet packet.json
node src/cli.js continuity summary --packet packet.json
node src/cli.js continuity resume  --packet packet.json
```

`export` reads the append-only event log; `verify` / `summary` / `resume` read
only the packet. The transcript is never an input on either path.

## Test

`test/n2-resumption-without-replay.test.js` asserts the claim end-to-end on the
Hermes adapter example (`examples/hermes-ingest/`), whose own input *is* a
transcript — so the test exercises exactly the prompt-vs-protocol comparison:

1. export a continuity packet from the event log (`resume_status = verified`);
2. from the **packet alone** — no event log, no transcript — `verify` passes,
   `resume` succeeds, and `summary` carries the settled decision plus the
   preserved privacy objection.

If a successor could not reconstruct the settled decision from the packet alone,
or if a tampered/degraded packet still reported `verified`, the test fails.

## Boundary

N2 is a claim about **continuation**, not about truth, governance, or product
readiness:

- A verified packet means the state is settled and self-contained, not that the
  decision was correct.
- N2 does not create trust, authority, governance approval, or amendment
  approval. `context transfer != memory trust`.
- N2 does not add protocol event types or change validation, projection, or
  export behavior; it names and tests an existing property of the protocol.
