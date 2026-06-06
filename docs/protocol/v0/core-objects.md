# Core Objects v0

ClisTa preserves reasoning transitions as structured objects.

## Thread

The container for a reasoning question.

## Thread Fork

A divergent reasoning thread that inherits parent thread state through a declared event boundary.

## Merge Request

A governed request to integrate fork reasoning into an ancestor thread without erasing dissent.

## Merge Review

A governance response to a merge request.

## Merge Conflict

A declared incompatibility between parent reasoning and fork reasoning.

## Merge Completion

The immutable record of accepted, rejected, and preserved fork reasoning after merge governance succeeds.

## Participant

A human, agent, tool, or system actor with a declared role.

## Evidence

An immutable sourced finding committed to a thread.

## Assumption

A declared premise that claims or decisions depend on.

Many disagreements are assumption disagreements rather than evidence disagreements.

## Claim

An interpretation or assertion built from evidence and assumptions.

## Position

A participant stance toward a claim, decision request, or thread.

## Objection

A structured challenge to evidence, an assumption, a claim, a position, or a decision request.

## Decision Request

A proposal to update accepted reasoning state.

It is the ClisTa equivalent of a pull request.

## Review

A governance response to a decision request.

Examples include approval, approval with conditions, request changes, rejection, or comment.

## Decision Record

The immutable record of an accepted or rejected decision.

## Expected Outcome

A measurable expectation attached to a decision record before reality is known.

## Minority Report

Preserved dissent attached to a decision record.

## Outcome Audit

A later comparison between the decision and reality.

## Decision Score

An empirical quality score derived from outcome audits.

## Contribution Attribution

A derived or explicit record that binds a reasoning contribution to participant identity, role context, authority context, and source event.

## Contribution Provenance

A derived source-lineage record for a reasoning contribution.

It records source type, source id, introducing event, transformation, source hash where available, and whether the source was available at contribution event time.

Provenance does not score truth. It keeps the audit trail neutral.

## Learning Signal

A pattern-level observation derived from outcome evidence.

It may reference contributions, outcomes, provenance, and governance objects.

It must not assign participant scores, source scores, model rankings, or authority changes.

## Learning Pattern

A projected grouping of learning signals by reasoning pattern.

It describes a repeatable reasoning pattern, not a participant, source, agent, model, or institution.

## Learning Recommendation

A non-authoritative revisit suggestion derived from learning signals.

It may recommend future review. It must not mutate governance authority automatically.

## Adaptation Recommendation

A non-authoritative governance review recommendation derived from learning signals.

It may recommend review of evidence requirements, revisit triggers, decision gates, governance audit requirements, outcome windows, provenance completeness, or objection-resolution requirements.

It must not change authority, decision rules, governance thresholds, participant standing, source trust, or model preference.

## Adaptation Review

An explicit record that a governance adaptation recommendation was reviewed.

It preserves auditability without applying the governance change. Actual protocol or governance changes still require authorized governance events.

## Protocol Amendment

An explicit proposed change to protocol rules, governance requirements, evidence thresholds, revisit triggers, decision gates, schemas, or validation policies.

An amendment may reference learning signals and adaptation recommendations as rationale. Those references do not make it active.

Only an approved amendment is active. Rejected amendments and superseded amendments remain in history without changing active protocol state.

## Protocol Amendment Review

A recorded review of an amendment rationale.

It may support, reject, request changes, or comment on the amendment, but it does not make the amendment active.

## Protocol Amendment Approval

An authorized governance action that makes an amendment active for future validation or governance behavior.

Approval must be explicit and authority-validated. It must not rewrite past event validity.

## Protocol Amendment Rejection

An authorized governance action that rejects an amendment.

Rejected amendments do not alter active protocol state.

## Protocol Amendment Supersession

An authorized governance action that deactivates a previously approved amendment while preserving its history.

## Continuity Packet

A portable verification artifact for projected reasoning state.

It carries source events, event-log integrity proof, projected-state checksums, milestone capability set, verification state, and resume status.

It is not a transcript, not model memory, not governance approval, and not a new authority source.

## Continuity Verification State

A deterministic record of whether transferred reasoning state is `verified`, `degraded`, or `rejected`.

It records required verification layers for integrity, attribution, provenance, learning, adaptation, amendments, and compatibility.

## Compatibility Context

A deterministic declaration of the local protocol version, capability set, supported verification layers, supported continuity packet versions, and supported amendment types.

It is not governance approval and does not mutate imported state.

## Compatibility Check

A verification result that classifies a continuity packet as `compatible`, `degraded`, `incompatible`, or `rejected` for a specific receiving context.

Unsupported required capabilities or unsupported active amendments fail closed.
