# Pharma Phase II/III Go/No-Go — Multi-Arm (Octopus) Example

Five ClisTa threads modelling a Phase II→III advancement decision for a drug
candidate (LTN-4481). A parent thread delegates four workstreams to Octopus,
each runs as its own thread with its own participants and decision, and the
parent imports each arm's decision as `CrossThreadEvidence`.

| Thread | Events | Decision |
|---|---|---|
| `arm-pkpd-modeling.ndjson` | 13 | 200mg Q4W confirmed; early PK sampling required |
| `arm-safety-assessment.ndjson` | 14 | Safety acceptable; stopping-rules hard gate (preserved objection + minority report) |
| `arm-subgroup-review.ndjson` | 13 | Bio-failure subgroup exploratory only (proactive minority report for TMF) |
| `arm-regulatory-strategy.ndjson` | 12 | Single pivotal trial per FDA alignment |
| `parent-go-nogo.ndjson` | 37 | Phase III approved with nine binding conditions propagated from the arms |

The parent imports six `CrossThreadEvidence` items: four `decision_output`, one
`preserved_objection` (safety stopping rules), and one `minority_report`
(subgroup discipline). Two objections propagate from arms and survive the parent
decision; the biostatistician's minority report traces from the arm-level
subgroup decision through the parent go/no-go — two threads deep, both
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
