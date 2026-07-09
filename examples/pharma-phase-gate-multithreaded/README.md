# Pharma Phase II/III Go/No-Go — Multi-Arm (Octopus) Example

Five ClisTa threads modelling a Phase II→III advancement decision for a drug
candidate (LTN-4481). A parent thread delegates four workstreams to Octopus,
each runs as its own thread with its own participants and decision, and the
parent imports each arm's decision as `CrossThreadEvidence`.

| Thread | Events | Decision |
|---|---|---|
| `arm-pkpd-modeling.ndjson` | 15 | 200mg Q4W maintenance dose confirmed; early PK sampling required; no hepatic exposure-response established |
| `arm-safety-assessment.ndjson` | 14 | Safety acceptable; stopping-rules hard gate (preserved objection + minority report) |
| `arm-subgroup-review.ndjson` | 13 | Bio-failure subgroup exploratory only (proactive minority report for TMF) |
| `arm-regulatory-strategy.ndjson` | 12 | Single pivotal (induction + maintenance treat-through) per FDA alignment |
| `parent-go-nogo.ndjson` | 41 | Phase III approved with nine binding conditions; three dissents preserved |

The parent imports six `CrossThreadEvidence` items: four `decision_output`, one
`preserved_objection` (safety stopping rules), and one `minority_report`
(subgroup discipline). Three dissents survive the parent approval: two objections
propagate from arms (safety stopping-rules hard gate, subgroup discipline), and a
third originates at the go/no-go itself — the independent DSMB chair's objection
that a single ~500-patient pivotal is an inadequate labeling safety database for a
known hepatic signal (a dissent on *whether* to advance, not just *how*). The
biostatistician's minority report traces two threads deep to the arm-level
subgroup decision; all three dissents are preserved in the decision record and
hash-verifiable.

## Regenerate

```
node scripts/gen-pharma-multithreaded.js
```

Each `CrossThreadEvidence.sourceEventHash` anchors on the content hash of the
arm's `DecisionMerged` event (not the last event in the file — arms may append a
`MinorityReportFiled` after the decision).

## Verify

Each thread validates independently:

```
clista validate --events examples/pharma-phase-gate-multithreaded/parent-go-nogo.ndjson
```

Cross-thread provenance is verified offline by holding the parent and arm logs
together and confirming each cited hash resolves to the arm's real decision:

```
clista verify-cross-thread \
  --parent examples/pharma-phase-gate-multithreaded/parent-go-nogo.ndjson \
  --arm examples/pharma-phase-gate-multithreaded/arm-pkpd-modeling.ndjson \
  --arm examples/pharma-phase-gate-multithreaded/arm-safety-assessment.ndjson \
  --arm examples/pharma-phase-gate-multithreaded/arm-subgroup-review.ndjson \
  --arm examples/pharma-phase-gate-multithreaded/arm-regulatory-strategy.ndjson
```

`--arm` is repeatable. Items whose source thread is not among the provided arm
logs are reported as `skipped` (unverified, not failed); a cited hash that does
not match the arm's decision is a `mismatch` and the command exits non-zero.
