# Stage 0 Runbook — running an instrumented external debate

For teams trying the ClisTa pattern on a real decision. "External run" = a team we did not
prompt, host, or grade, running the pack on their own decision in their own harness.

## Before you start (prerequisites)

You need three things — nothing else:

1. **A real decision** that passes the applicability check in `PROMPT_PACK.md` (hard to
   reverse; multi-party or multi-session; key claims checkable against real artifacts).
2. **The pack**, which you already have: `PROMPT_PACK.md` (roles, rules, close protocol) and
   `LEDGER_TEMPLATE.md` (the artifact of record). Give every participant both. No tooling is
   required — one markdown ledger is the whole artifact.
3. **Participants**: 2–4 sides plus one referee. Any agent vendor, humans, or a mix.

Optional: **Node.js ≥ 18**, only if you want the `clista run report` helper at the end
(below). The markdown-ledger path needs no software at all.

## How to run one

1. Pick the decision (prerequisite 1 above).
2. Spawn/assign the roles (any agent vendor, or humans). Give every participant the pack.
3. Run the rounds. The referee keeps the ledger in `LEDGER_TEMPLATE.md` format as you go —
   the ledger is the artifact of record, not the chat.
4. Close per the close protocol; fill the Transfer State; set `closure_state: closed`.

## Instrumentation to capture (this is what makes the run count)

Per run, record alongside the ledger:

- **failures.md** — every discipline failure observed: silently dropped objections, renumbered
  IDs, closure declared with open points, residuals missing from Transfer State, hollow
  dispositions noticed later. These feed the failure log that gates all future tooling.
- **cost.md** — wall-clock duration; number of rounds/messages; approximate agent tokens;
  **human-minutes of overhead attributable to the format itself** (the headline claim under
  test is that agents bear the ceremony cost — help us check it).
- **outcome.md** (later) — if the decision gets executed: did reality match the ledger? Which
  residual risks fired? This is the only ground truth that exists.

## What "done" looks like (definition of done)

A run is ready to report when **all** of these are true — no ambiguity:

- [ ] `closure_state: closed` in the ledger, and **every** row has a terminal DISPOSITION.
- [ ] Every `BLOCKING` row has a non-empty `RATIONALE-REF`.
- [ ] The **Transfer State** section is filled (decision, settled points, residual risks with
      owners and triggers, open gates, authority boundary, caveats, next action).
- [ ] `failures.md` and `cost.md` exist alongside the ledger (even if `failures.md` is "none
      observed" — say so explicitly).
- [ ] You have sent the artifacts to us (next section) and the issue/email went through.

That last box is the real finish line: a run that doesn't reach us does not count.

## Reporting in one command (optional helper)

If you captured your run as a ClisTa **event log** (NDJSON), the engine does the last mile —
validate, package, and tell you exactly where to send it:

```sh
npm install
npm run clista -- run report --events <your-run>.ndjson --out submission.json
```

`run report` fails closed if the log is invalid (fix the errors first — an invalid log is not
a reportable run), writes a portable `submission.json` you can attach, and prints the exact
issue title and address. It keeps `trusted: false`: a clean report means well-formed and
reportable, never that the decision was good.

If your run is the **markdown ledger** instead (the default, no software), skip this — just
attach `LEDGER.md`, `failures.md`, and `cost.md` directly per the next section.

## What an external run must NOT involve (or it doesn't count toward the gate)

- Us writing or editing your prompts beyond this pack
- Us refereeing, scoring, or "helping" mid-run
- Cherry-picking: report failed/abandoned runs too — a run that exposes the format is worth
  more than one that flatters it

## Where to send it

A run counts toward the gate only if it reaches us. Send the ledger plus `failures.md` and
`cost.md` (and `outcome.md` later, if the decision gets executed):

- **Preferred:** open a
  [prefilled report issue](https://github.com/lati-club/clista-protocol/issues/new?title=External%20run%20report%3A%20%3Cdecision%20title%3E&body=%3C%21--%20ClisTa%20external%20debate-pack%20run.%20Edit%20%3Cdecision%20title%3E%20in%20the%20issue%20title%20above.%20--%3E%0A%0AThis%20run%20was%20NOT%20prompted%2C%20hosted%2C%20refereed%2C%20or%20graded%20by%20the%20ClisTa%20project.%0Aepistemic_state%3A%20unaudited%20%E2%80%94%20a%20clean%20closure%20means%20well-shaped%2C%20not%20right.%0A%0A%23%23%20Artifacts%20%28attach%20or%20link%29%0A-%20%5B%20%5D%20LEDGER.md%20%E2%80%94%20closure_state%3A%20closed%2C%20every%20row%20terminal%2C%20Transfer%20State%20filled%0A-%20%5B%20%5D%20failures.md%20%E2%80%94%20discipline%20failures%20observed%20%28or%20%22none%20observed%22%29%0A-%20%5B%20%5D%20cost.md%20%E2%80%94%20wall-clock%2C%20rounds%2C%20tokens%2C%20human-minutes%20of%20format%20overhead%0A-%20%5B%20%5D%20outcome.md%20%E2%80%94%20later%2C%20if%20the%20decision%20gets%20executed%0A%0A%23%23%20One-line%20integrity%20verdict%0AWas%20the%20debate%20real%3F%0A)
  (title + artifact checklist prefilled) at https://github.com/lati-club/clista-protocol and
  attach the artifacts. Public by default — which is the point; see the cherry-picking rule
  above.
- **Fallback (or if you need confidentiality):** email the artifacts to lati@clista.ai.
  Redact rather than withhold — privately reported runs still have to be judgeable by blind
  external judges to count.

Optional but valuable: tell us *before* you run ("we're going to try this on <decision>").
Pre-registered runs that get abandoned are evidence too; unregistered ones vanish silently.

"We"/"us" throughout this pack = the ClisTa protocol project (maintainer contact above). The
gate your run feeds is public and bidirectional — if five external runs don't materialize, or
runs show no advantage, the productization claim dies on the record (`GATES.md`).

## Why your run matters (honest framing)

All evidence so far (N=3 debates + 2 pilot experiments) comes from one authoring culture inside
one model ecosystem, refereed by the format's authors — formally `asserted`, not verified. The
format's own debate ruled that further clean closures by us confirm nothing. External runs are
the only way the central claims get tested. There is also a standing falsification frame: if
ledgered runs show no advantage over a strong prompt + freeform notes on decision quality,
relitigation rate, dropped residuals, or gate verification, the protocol thesis dies and we have
pre-committed to recording that.
