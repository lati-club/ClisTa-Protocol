# Pharma Phase-Gate Example → Claude (science review) — transfer prompt

Paste everything below the line into a fresh Claude session that has clinical /
biostatistical / drug-development competence (or a Claude Code session in this
repo). The goal is a **domain credibility review** of the multi-thread pharma
example — is this a realistic Phase II→III go/no-go review? — NOT a review of
the ClisTa protocol, hashing, or event mechanics. Those are separately tested;
assume they work and ignore them.

---

You are reviewing a worked **example** shipped in the ClisTa Protocol repo:
a five-thread model of a Phase II/III go/no-go advancement decision for a
fictional drug candidate, **LTN-4481** (moderate-to-severe ulcerative colitis).
Read it as a **clinical development scientist / trial methodologist / DSMB
member would**, and tell us where it is credible and where a real reviewer
would push back. Treat it as a draft decision package submitted for your review.

## What this example is

A parent go/no-go thread delegates four workstreams; each is its own thread with
its own participants, evidence, objections, and decision; the parent imports each
arm's decision as cross-thread evidence and makes the advancement call.

| Thread | Decision as written |
|---|---|
| PK/PD modeling | 200mg Q4W confirmed; early PK sampling + dose-adjustment pathway required |
| Safety assessment (hepatotoxicity/DILI) | Safety acceptable for Phase III with three hard-gated conditions; **DSMB stopping rules a hard gate** (preserved objection + safety-officer minority report) |
| Subgroup review | Post-hoc bio-failure subgroup (46.3% remission, n=89, CI 32.8–59.8) designated **exploratory only** — no alpha allocation, enrichment, or stratification (proactive minority report for the trial master file) |
| Regulatory strategy | Single pivotal trial with adaptive design, interim futility, ≥500 patients, hepatic monitoring, per FDA Type B feedback |
| **Parent go/no-go** | Advance to Phase III; single pivotal, 200mg Q4W, adaptive; all arm-level conditions binding; scope narrower than requested (subgroup stays exploratory). Two arm objections and a biostatistician minority report propagate up and **survive** the approval. |

## Get the material

`git clone https://github.com/lati-club/ClisTa-Protocol` (private; needs
lati-club access — stop and ask if you can't clone). No build or install needed
to read it. The logs are plain NDJSON, one event per line, human-readable:

- `examples/pharma-phase-gate-multithreaded/README.md` — the map (read first)
- `examples/pharma-phase-gate-multithreaded/parent-go-nogo.ndjson`
- `.../arm-safety-assessment.ndjson`, `arm-subgroup-review.ndjson`,
  `arm-pkpd-modeling.ndjson`, `arm-regulatory-strategy.ndjson`

Each event has an `event_type` and a `payload`; the domain content lives in the
`claim`, `evidence`, `assumption`, `objection`, `decisionRecord`, `review`, and
`minorityReport` objects. Read the prose in those — ignore ids and hashes.

Optionally, to see how the arm decisions feed the parent as evidence:

```
node src/cli.js verify-cross-thread \
  --parent examples/pharma-phase-gate-multithreaded/parent-go-nogo.ndjson \
  --arm examples/pharma-phase-gate-multithreaded/arm-safety-assessment.ndjson \
  --arm examples/pharma-phase-gate-multithreaded/arm-subgroup-review.ndjson \
  --arm examples/pharma-phase-gate-multithreaded/arm-pkpd-modeling.ndjson \
  --arm examples/pharma-phase-gate-multithreaded/arm-regulatory-strategy.ndjson
```

## What to assess (this is the review)

For each arm and the parent, judge **domain realism**, not protocol form:

1. **Decision soundness.** Is each go/no-go call one a competent development team
   / DSMB could actually reach on the stated evidence? Where is the reasoning
   thin, and what evidence would a real reviewer demand before signing?
2. **Safety / DSMB.** Are the hepatotoxicity (DILI) framing, the enhanced-
   monitoring plan, and the "monitoring without pre-specified quantitative
   stopping rules is not a safety plan" objection medically and regulatorily
   correct? Would a real DSMB charter be gated this way? Anything missing
   (Hy's law criteria, rechallenge rules, hepatic adjudication)?
3. **Statistics / subgroup discipline.** Is the post-hoc bio-failure subgroup
   handled correctly — multiplicity, alpha, no enrichment/stratification off a
   post-hoc finding, the CI as reported? Is the biostatistician's dissent the
   right dissent? Is n=89 / 46.3% / CI 32.8–59.8 internally consistent and
   plausibly powered for anything?
4. **Regulatory realism.** Is a single pivotal trial with adaptive design +
   interim futility a defensible FDA posture for this indication? Are the
   assumptions ("Type B agreements will hold through IND amendment", "no
   material change in FDA posture") flagged at the right risk level?
5. **PK/PD.** Is "200mg Q4W confirmed" from Phase II exposure-response, with the
   stated assumption that the model generalizes to Phase III **without external
   validation**, an honest and appropriately-caveated claim?
6. **The cross-thread story.** The example's whole point is that two objections
   (safety stopping rules, subgroup discipline) and a minority report survive
   from the arms into the parent approval rather than being averaged away. Is
   that the *right* set of things to preserve? Would a real trial master file /
   DSMB record carry exactly these forward — and is anything a real reviewer
   would have escalated instead quietly dropped?

## Deliverables

- A short **verdict per arm + parent**: credible as-is / credible with fixes /
  not credible — with the specific clinical or statistical reason.
- The **top 3–5 changes** that would make this example ring true to a real
  development scientist or DSMB member (concrete: an added stopping criterion, a
  corrected stat claim, a missing assumption, a regulatory caveat).
- Any place the example is **too clean** — a real Phase III go/no-go this
  consequential would surface objections or evidence gaps this one glosses.
- Explicitly flag anything **medically wrong or misleading**, since this ships
  as a reference example others will copy.

## Boundaries (raise it and stop, don't fix silently)

- **This is a fictional example**, not a real trial or real drug. LTN-4481,
  the numbers, and the FDA interactions are invented for illustration. If a
  number is internally inconsistent, say so; don't treat it as a real dataset.
- **Review only — do not edit the NDJSON logs.** Regenerating them is done by
  `scripts/gen-pharma-multithreaded.js` (deterministic); log any change as a
  recommendation against that generator, so hashes and the cross-thread chain
  stay coherent. Editing a log by hand breaks the example.
- **Scope is the science, not the protocol.** If you find yourself commenting on
  event types, hashing, or validation, stop — that's out of scope and separately
  tested.
- This example was built to *demonstrate* that dissent survives an approval;
  that framing is intentional. Critique whether it demonstrates it *credibly*,
  not whether the framing should exist.
