# Equivalence Log — Objection Deduplication Across 5 Sealed Sessions

equivalence_log_convention: v0.1
purpose: Every judgment call made when collapsing the 55 raw objections (across sessions 1–5)
  into 17 canonical objections for the Challenge Record's Objection Register and Convergence
  Analysis. Aggregation for this pilot is MANUAL by design (spec: "Dedup objections by hand;
  note where equivalence judgment was required"). This log is the audit trail of that manual
  judgment so a reviewer can re-derive or dispute any merge.
prepared: 2026-06-10
inputs: sessions/session-{1..5}/session-data.json (the structured blocks the sealed sessions
  emitted) and the encoded event logs. Raw counts reproduced by `node /tmp/aggregate.js`-style
  clustering; the canonical map is reproduced verbatim in the table below.

## How to read this

Each canonical objection has an ID (O1–O17), a count of how many of the 5 sessions raised it,
and the list of source rows (`S<session>:<objection-id>`). Where a merge required judgment —
because sessions used different lane IDs, different severities, or split/combined a concern —
the reasoning is given explicitly. "Clean" merges (same lane, same failure mode, same target)
are noted as such without elaboration.

## Canonical objection map (the deduplication, in full)

| Canon | Sessions | Source rows | Merge type |
|-------|----------|-------------|------------|
| O1 — v2 deployed performance unvalidated (E7) | 5/5 | S1:A1 S2:A1 S3:A1 S4:A1 S5:A1 | CLEAN (identical lane A, identical failure mode) |
| O2 — E1 before/after cannot establish causal benefit | 5/5 | S1:A2 S2:A2 S3:A2 S4:A2 S5:A2 | CLEAN (identical lane A) |
| O3 — E1 model version unspecified, not attributable to v2 | 3/5 | S2:B2 S3:B2 S4:B2 | JUDGMENT (kept distinct from O2 — see §1) |
| O4 — v2 lineage opacity + antibiotic-order leakage + local-label quality | 5/5 | S1:B1 S1:B2 S2:B1 S3:B1 S4:B1 S5:B1 S5:B2 | JUDGMENT (merged 3 facets; see §2) |
| O5 — Equity / population mismatch unverified (E5) | 5/5 | S1:H1 S2:H1 S3:H2 S4:H1 S5:H1 | JUDGMENT (S3 used H2 where others used H1; see §3) |
| O6 — False-negative harm / false reassurance | 3/5 | S2:H3 S3:H1 S4:H2 | JUDGMENT (severity + ID vary; see §4) |
| O7 — False-positive burden / alert fatigue | 5/5 | S1:H2 S2:D1 S3:H3 S4:D1 S5:D1 | JUDGMENT (cross-LANE merge H↔D; see §5) |
| O8 — No monitoring / recalibration / decommissioning plan | 5/5 | S1:D1 S2:D2 S3:D1 S4:D2 S5:D2 | JUDGMENT (cross-ID D1/D2; see §6) |
| O9 — Single pilot unit may not generalize house-wide | 1/5 | S1:D2 | CLEAN (unique to S1) |
| O10 — Version category error (v1 evidence ≠ v2 evidence) | 1/5 | S5:A3 | JUDGMENT (principle settled in 4/5; see §7) |
| O11 — Cost of NON-deployment / over-conditioning as permanent veto | 4/5 | S1:E1o S2:E1o S4:E1o S4:E2o S5:E1o | JUDGMENT (S4 raised twice; see §8) |
| O12 — Silent/shadow mode could be theater; needs pre-registered criteria + sunset | 2/5 | S1:E2o S3:E2x | JUDGMENT (see §8) |
| O13 — Consent / transparency | 2/5 | S2:H2 S5:H2 | JUDGMENT (S5 combined w/ false-positive; see §9) |
| O14 — Base-rate (E2) is a non-sequitur for efficacy | 2/5 | S2:A3 S3:E1x | JUDGMENT (cross-lane A↔E; see §8) |
| O15 — Devil's-advocate do_not_deploy thesis (objection form) | 2/5 | S2:E2o S5:E2o | JUDGMENT (also seeds minority reports; see §10) |
| O16 — Threshold must be locally calibrated, not Epic default ≥6 | 1/5 | S1:A3 | JUDGMENT (others carried it as a claim, not an objection; see §11) |
| O17 — Silent-run/human-in-loop must be binding preconditions | 1/5 | S3:D2 | CLEAN (unique to S3) |

55 raw objections → 17 canonical. (Counts verified programmatically against the five
`session-data.json` files.)

---

## The judgment calls, in detail

### §1 — O2 vs O3: kept SEPARATE (could have been merged)
Both O2 ("E1's before/after design can't isolate the model's effect") and O3 ("E1 doesn't
state which model version it studied") attack the *same target* — the use of E1 as affirmative
evidence for a v2 deployment — and both resolve the same way (E1 demoted from proof to weak
prior). I could have collapsed them into one "E1 is not usable v2 evidence" objection (which
would read as 5/5). **I did not**, because the *failure modes are genuinely different*: O2 is a
causal-inference defect (confounding by co-occurring sepsis-program changes), O3 is a
provenance defect (version ambiguity). A data-lineage skeptic and a model validator would file
these as separate findings, and an MRM officer would want them tracked separately because they
have different fixes (a controlled study fixes O2; a version attestation fixes O3). Merging them
would also have *inflated* the headline convergence number. Recorded honestly as 5/5 (O2) and
3/5 (O3). Note S1 raised O2 but not O3 — S1's lane B spent its second objection on label
quality (folded into O4) rather than on version provenance.

### §2 — O4: merged THREE facets (the largest merge in this log)
O4 absorbs three related but distinguishable data-lineage concerns:
(a) vendor opacity of v2's internals (S5:B2, and a clause of S1:B1/S2:B1),
(b) antibiotic-order target leakage potentially recurring in a locally-trained v2 (all five B1),
(c) local sepsis-onset label quality (S1:B2; a clause of S3:B1, S5:B1).
**Merge rationale:** sessions 3 and 5 explicitly bundled (b) and (c) into a single B1 objection
("a weak local label reproduces v1's leakage"), treating them as one "can we trust the local v2
pipeline?" concern. Session 1 split them (B1 = leakage/opacity, B2 = label quality). To count
consistently across sessions, I treated the bundle as one canonical objection; otherwise S1
would appear to raise "more" data-lineage objections than S3/S5 purely because of how it
chunked them. **Risk of this merge:** it hides that S1 raised label-quality as a distinct,
separately-resolved item. Mitigation: both S1 rows (B1, B2) are listed in the source column so
the split is visible. A reviewer who prefers to separate "leakage" from "label quality" should
split O4 into O4a (leakage/opacity, 5/5) and O4b (label quality, 3/5: S1,S3,S5).

### §3 — O5: S3 filed equity as H2, everyone else as H1
Four sessions filed the equity/population-mismatch objection as their first harm-lane objection
(H1); session 3 filed it as H2 because S3's H1 was a false-negative-harm objection instead (see
§4). Same substance (v1 performed worst in a 59% Hispanic / 26% Black, lower-SES population per
E5; local subgroup performance unverified), same verification (subgroup-stratified validation),
so merged. Judgment: ID position is not semantic identity; the failure mode is. **Severity
note:** O5 was BLOCKING in 4 sessions and NON-BLOCKING in S3 (where S3 elevated false-negative
harm to its blocking equity-adjacent concern instead). Recorded as raised 5/5, blocking 4/5,
survived 5/5.

### §4 — O6: false-negative harm — severity and framing vary
O6 ("a 'no alert' could be misread as reassurance and displace clinical vigilance / automation
complacency") appears in S2 (H3, non-blocking amendment), S3 (H1, BLOCKING survived), and S4
(H2, non-blocking amendment). Only 3/5 sessions raised it as a distinct objection; S1 and S5
folded false-negative concern into their equity/validation objections rather than naming it
separately. Kept as its own canonical objection because where raised it has a distinct fix
(additive-only protocol + missed-case tracking) different from the equity fix. The severity
disagreement (blocking in S3, non-blocking elsewhere) is real signal, not noise — preserved.

### §5 — O7: cross-LANE merge (harm lane ↔ ops lane)
The alert-fatigue / false-positive-burden objection (anchored on E4's 18% alert rate at 12% PPV)
was filed in the **patient-harm lane (H)** by S1 and S3, but in the **ops & monitoring lane (D)**
by S2, S4, S5. This is the clearest cross-lane equivalence: the same evidence-grounded concern
was "owned" by different roles in different sessions. Merged on substance. Judgment flagged
because lane identity is part of an objection's metadata in the pack, and merging across lanes
discards that — a reviewer tracking "which role caught what" should know O7 was caught by
whichever of H/D the session assigned it to. Raised 5/5; blocking only in S5; otherwise accepted
as an amendment (alert-burden ceiling + override tracking).

### §6 — O8: cross-ID merge (D1 vs D2)
"No monitoring / recalibration / decommissioning plan exists yet" was filed as D1 in S1 and S3,
and as D2 in S2, S4, S5. Pure ID-position difference; identical substance and identical fix (a
signed monitoring/decommissioning runbook with a kill-switch). Merged. Raised 5/5; blocking in
4/5 (non-blocking amendment in S5).

### §7 — O10: explicit objection vs settled principle
The "version category error" (v1 evidence must not be used to approve OR reject v2) was raised
as an explicit, dispositioned objection only in S5 (A3). **However**, the underlying principle —
"v1 and v2 are different models; v1 evidence does not transfer" — appears in the SETTLED-points
section of the Transfer State in sessions 2, 3, 4, and 5. I counted O10 as **1/5 as an
objection** (the honest count for the register) and note here that the *principle* it encodes is
present in 4/5 sessions as settled background. The Convergence Analysis uses the 1/5 figure to
avoid double-counting a settled premise as a raised objection.

### §8 — The devil's-advocate (lane E) two-directional split
Lane E was, by design, the hardest to deduplicate because it argues against whatever consensus
is forming — so it pointed in opposite directions across sessions:
- **O11 (cost of inaction / don't over-condition)** — pro-deployment pressure: S1:E1o, S2:E1o,
  S4:E1o, S4:E2o, S5:E1o. Session 4 raised it *twice* (both E-lane objections pushed this
  direction), so 4/5 sessions, 5 source rows. Note S4:E2o ("cost of NON-deployment… delay costs
  lives") is pro-deployment and was mapped here, NOT to the do_not_deploy thesis O15, despite
  sharing the E2o ID with other sessions' do_not_deploy E2o. **This is the subtlest call in the
  log:** the same objection ID (E2o) means opposite things in S4 vs S2/S5, so I mapped by
  *content*, not ID.
- **O12 (silent mode could be theater / ossification)** — process-integrity attack: S1:E2o,
  S3:E2x. 2/5.
- **O14 (base-rate is a non-sequitur for efficacy)** — anti-hand-wave attack: S2:A3 (filed in
  lane A), S3:E1x (filed in lane E). Cross-lane; merged on content. 2/5.
- **O15 (do_not_deploy thesis as an objection)** — S2:E2o, S5:E2o. 2/5 (see §10).
The lane-E heterogeneity is itself a finding: it is the one place the five sessions genuinely
diverged in *what they argued*, even though they converged on the verdict.

### §9 — O13: S5 combined consent with false-positive harm
S5's H2 objection bundles consent/transparency ("patients not informed an opaque algorithm
screens them") with false-positive/stewardship harm. I assigned S5:H2 to O13 (consent) because
consent is the novel concern there, and noted that its false-positive clause overlaps O7.
Reviewer alternative: split S5:H2 across O13 and O7. Effect on counts: would raise O7 to a 6th
source row but still 5/5 sessions; would not change O13's 2/5.

### §10 — O15 vs the minority reports (avoiding a double-count)
The "the defensible verdict may be do_not_deploy" thesis exists at two levels: (a) as a
dispositioned *objection* in the register (O15, 2/5: S2:E2o, S5:E2o), and (b) as a filed
*minority report* in 4/5 sessions (S1, S2, S3, S4; S5 filed none). These are different artifacts
and I report them separately: O15 is the objection-register count; the 4/5 minority-report count
is reported in the Convergence Analysis and Minority Reports sections of the Record. They are
NOT summed. The minority-report count is the more important number for an examiner because a
minority report is the protocol's formal carrier of surviving dissent.

### §11 — O16: objection in S1, claim elsewhere
"Don't import Epic's default ≥6 threshold; calibrate locally" was a dispositioned *objection*
(A3) only in S1. In the other four sessions the same content appears inside the advocate's
*proposal/claims* ("threshold set locally, not Epic default") — i.e., the advocate pre-conceded
it, so no lane needed to raise it as an objection. Counted as 1/5 objection. This is a place
where convergence is real (5/5 sessions reject the default threshold) but lives in different
artifact types (1 objection + 4 claims), so it is NOT reported as a 5/5 surviving objection.

---

## What the deduplication did NOT have to resolve

No two sessions raised *contradictory* objections (e.g., one demanding house-wide rollout while
another demanded ED-only). The divergence was entirely in (a) which lane owned a concern, (b)
severity weighting, and (c) the two-directional devil's-advocate framing. There were no
genuine substantive conflicts to adjudicate — which is itself a symptom of the low session
diversity discussed in the Challenge Record's Challenge Design (single model family, single
author). A panel of genuinely independent vendors would more likely have produced at least one
contradictory objection requiring real adjudication here.

---

## PARKING-LOT — for the production delivery model (not engine changes)

Per the engagement amendment of 2026-06-10, recorded here so it is not lost (these are
product/process notes, NOT proposed ClisTa protocol layers; the spine stays frozen):

1. **Customer-executed sessions are required for gate validity AND SR 11-7 credibility.**
   This dry run's sessions were generated by us (the project), so they count toward nothing on
   the EXTERNAL-RUNS gate (`pack/GATES.md` requires runs "not prompted/hosted/graded by us").
   Separately, even a *paid pilot's* sessions only count toward the gate when executed by the
   **customer's own staff** using `pack-mrm`, not when run by us on the customer's behalf.
   Effective challenge under SR 11-7 also requires reviewers "with authority and incentive to
   push back" — vendor-run reviews are weaker on that axis than bank-staff-run reviews. The
   production delivery model should therefore put the customer's MRM/validation staff in the
   lane seats (or at minimum co-author), with us providing only the pack and the engine.

2. **Independence attestation (commit-reveal) is the most likely missing primitive.** The single
   biggest weakness this dry run exposed is that "sessions were sealed" currently rests on an
   assertion (separate subagent contexts), not a verifiable commit-before-reveal artifact. The
   spec already parks this; the dry run confirms a buyer would reasonably ask "prove they didn't
   talk to each other." Candidate future ADR, not an engine change before the gate.

3. **Objection-equivalence judgment should be logged every pilot (this file is the template).**
   The merges in §1–§11 are defensible but author-made. After ~3 pilots, decide whether
   aggregation deserves a protocol-vs-product home. Until then: log every call, as here.

4. **Single-vendor monoculture is a measurable defect, not just a disclaimer.** The echo check
   (Challenge Design §B) should be run on every engagement and its results reported in the
   Record, because near-total structural convergence among same-family reviewers is evidence of
   correlated blind spots, not of robustness.
