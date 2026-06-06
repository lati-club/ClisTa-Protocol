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
