# The ClisTa Sidecar Gate

`clista validate` checks a log after the fact. For a routine build arm under a
`DelegationGranted` grant, that's the right amount of friction — execute, let
governance ratify via `DecisionMerged` afterward. For a high-stakes context —
model risk management, financial underwriting, anything that wants
`authorizationRef.type: "decision"` on its `ExecutionStarted` record — waiting
until after the fact is too late. `src/gate.js` is a pre-append check for
exactly that case: `decision propose` either appends a `DecisionRequestOpened`
that's already known-valid, or appends nothing and tells you why.

## What the gate actually checks

Two layers, and they are not the same kind of check.

**Structural completeness** is gate policy, not an engine rule. Nothing in
`validateDecisionRequestOpened` requires a non-empty `supportingEvidenceIds`
or `supportingAssumptionIds` — that array is only checked for *existence* of
whatever ids it contains, not for having any. `src/gate.js` adds the
non-empty requirement itself, on top of the engine, because "propose a
decision citing nothing" should fail before it ever reaches review.

**Existential validity** is not gate policy — it's the engine's own rule,
reused as-is. The gate builds the candidate `DecisionRequestOpened` event,
chains it onto the real log in memory with `prepareEventForAppend`, and runs
the same `validateEvents` the `validate` command runs. If any cited id
doesn't resolve, `validateEvents` says so, in its own words, and the gate
appends nothing. There is no separate existence-checking logic in `gate.js`
to drift from the engine's — there's only the engine's, called early.

## Using it

```sh
npm run clista -- evidence commit --thread <id> --source "..." --finding "..." --tags "safety-data,phase2"
npm run clista -- evidence list --thread <id> --tag safety-data
npm run clista -- decision propose --thread <id> --proposal "..." --evidence <evd_id[,evd_id]> --assumptions <asm_id[,asm_id]>
```

`evidence list` / `assumptions list` accept `--tag` to filter thread state
that's already been projected — the only correct way for an agent to obtain
an id is to copy one out of a query result, never to recall one from earlier
in its own context. `decision propose` is where that discipline pays off: a
copied id passes the existential check; a recalled-and-slightly-wrong id
fails it, loudly, before anything is written.

## Worked example (run this)

```sh
npm run clista -- decision propose --thread $THREAD --proposal "Ship it" \
  --evidence $EVD --assumptions $ASM
# => { "valid": true, "errors": [], "event": { "event_type": "DecisionRequestOpened", ... } }

npm run clista -- decision propose --thread $THREAD --proposal "Ship it again" \
  --evidence evd_totally_made_up_ffffffff --assumptions $ASM
# => { "valid": false, "errors": [
#      { "event_type": "DecisionRequestOpened",
#        "reason": "evidence reference does not exist: evd_totally_made_up_ffffffff" } ] }
# log length unchanged — nothing was appended

npm run clista -- decision propose --thread $THREAD --proposal "Ship it with nothing"
# => { "valid": false, "errors": [
#      { "reason": "propose_decision requires at least one supportingEvidenceIds pointer" },
#      { "reason": "propose_decision requires at least one supportingAssumptionIds pointer" } ] }
# log length unchanged — nothing was appended
```

All three cases above were run against a real thread as part of verifying
this feature; `clista validate` on the resulting log reports
`{ "valid": true, "errors": [] }` after all of it, including the two
rejected attempts.

The gate also checks the *existing* log's validity before it checks the
draft's. If a thread already has an invalid event in it — written by one of
the unguarded commands like `evidence commit` or `objection raise`, which
still append without pre-validating — `decision propose` reports those
pre-existing errors with a `note` explaining they predate this proposal,
rather than attributing them to whatever was just proposed. Confirmed by
corrupting a log with `objection raise --target <a claim id that was never
created>`, then proposing a perfectly valid decision on top of it: the gate
still refused to append, and the response distinguished "your thread is
already broken" from "your proposal is broken."

## Strictness modes: delegation vs. decision

Passing `decision propose` does not authorize execution by itself.
`ExecutionStarted` checks `authorizationRef.type`, and that field carries two
very different guarantees:

**Delegation mode** (`authorizationRef.type: "delegation"`) — checked
against a `DelegationGranted` record only. No review requirement, no
blocking-objection check. This is the ratify-after path: execute now,
`DecisionMerged` reconciles later. Appropriate for routine, revocable work —
the Octopus build-arm arms use this.

**Decision mode** (`authorizationRef.type: "decision"`) — checked against an
approved `DecisionMerged` record, with matching actor, scope, and any
declared conditions (`validateExecutionAgainstDecision`). `decision propose`
is only the first link in this chain: `ReviewSubmitted` and a
`DecisionMerged` that survives the blocking-objection check
(`isBlockingObjection` in `src/governance.js`) still have to happen before
`ExecutionStarted` will validate. This is the fail-closed path — the one an
SR 11-7 "effective challenge" claim actually requires.

Which mode a given execution context requires is not something the executing
agent decides. It's a property of the delegation grant or thread the
execution runs under — the same way `DelegationGranted` already carries a
declarative `authorityRequired` field, checked by the engine, never asserted
by the delegate. An agent self-reporting its own strictness mode reintroduces
exactly the failure this whole feature exists to close: trusting the agent's
account of something with security consequences instead of checking it
structurally.

## What the gate does not catch

A cited pointer can be real and still be the wrong evidence for this
decision — evidence gathered for a different proposal, bound here because it
happened to exist and pass the existence check. Structural completeness and
existential validity are both mechanical; neither one is a judgment about
relevance. That's what `ObjectionRaised` and the review layer are for: a
reviewer (human or agent) can raise a non-blocking, `preserved` objection
that rides along into `DecisionMerged` without stopping it, or a blocking one
that does stop it. The gate's job is narrower than "the decision is right."
Its job is "the decision is accountable" — every pointer it cites is real,
and every required slot is filled. Whether those pointers actually support
the claim is a review-layer question, on the record either way.

## Test coverage

`test/gate.test.js` covers all four `decision propose` cases above (golden
path, structural rejection, existential rejection, pre-existing-corruption
attribution) plus the `--tag` filtering behavior, via `runCaptured` against
scoped temp directories — the same in-process pattern `cli-capture.test.js`
already uses, not a subprocess spawn per test. `test/projector.test.js`
adds a direct unit test of `allEvidence` vs. `supportingEvidence` and a
tags-round-trip check, independent of the CLI layer. `node --test` is
295 tests, 294 passing, 1 pre-existing skip, 0 failures.
