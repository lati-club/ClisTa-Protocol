# Draft — Independence Attestation (commit-reveal for sealed sessions)

Status: **draft / decision input, not a commitment.** Nothing here ships as a protocol layer
under the current scope freeze (`README.md` → Boundaries → Scope freeze; `pack/GATES.md`): no
new verifier layers until five external runs exist. This document decides *where the
independence boundary should fall* — and what can be built as **product-layer procedure**
versus what must wait for a spine primitive — so the decision is made deliberately, on the
record, before a pilot forces it.

`trusted: false` is assumed throughout. Attestation evidences structure; it never proves the
absence of out-of-band collusion, and an independence claim is a *bounded claim about*
sessions, never a *fact in* them.

## Why this exists

The ClisTa Challenge product (`Effective Challenge as a Service`, v0 spec) leads with one
sentence: *"five independent adversarial reviews that provably never talked to each other."*
That word — **provably** — is a load-bearing claim made to a model-risk officer who will probe
it. The spine today does not have a primitive whose job is to substantiate it. This ADR
decides what "provably" can honestly mean before pilot #1 ships, and how much of that is
procedure vs. protocol.

## What independence actually requires

"Never talked to each other" decomposes into two distinct properties. They are not the same,
and the protocol can underwrite only one of them.

| Property | What it asserts | Underwritable? |
|----------|-----------------|----------------|
| (a) **No output contamination** | Session B's committed objections were fixed *before* B had any visibility into A's — B did not author its findings by reading A's. | Yes — by ordering + tamper-evidence (commit-reveal). |
| (b) **No shared substrate** | The sessions share no upstream cause that makes them dependent (same base model, same training corpus, same operator steering both). | **No.** This is a fact about the world outside the logs. The protocol cannot see it. |

The honest product claim is therefore bounded to (a): *we can prove no session's recorded
objections were written or altered after it could see another's.* Convergence across sessions
is evidence of independent agreement **only to the extent (b) holds**, and (b) is disclosed,
not proven. Conflating the two is the exact "vibes with hashes" anti-pattern the README
refuses — hashing artifacts without proving the conditions that make agreement meaningful.

## What existing primitives already give

- **Append-only event log** — total order *within* a session's log. Gives commit ordering for
  free, per log.
- **`integrity verify`** — hash chain over events; tamper-evidence. A committed objection set
  cannot be silently rewritten after the fact.
- **Attribution** — binds each objection to a participant (vendor + version, or named human)
  and event-time authority.
- **Federation** (`FederatedStateReferenceRecorded`, by-hash, `shared_state != shared_authority`)
  — the **sealed-bid property**: one log can reference another's sealed state by hash without
  importing its authority. This is precisely the shape commit-reveal needs at the cross-session
  boundary.

What is **missing**: nothing in the spine establishes *cross-session* ordering — that B's
commit hash existed before A's reveal. Within a log, order is intrinsic; across independently-run
logs, it is not.

## The decision

**For the pilot: implement commit-reveal as a product-layer delivery procedure using only
existing primitives. Do not add a spine layer.**

The procedure:

1. **Commit phase.** Each session runs sealed (no cross-session visibility) and emits its
   complete objection set as ordinary events into its own NDJSON log. The log is closed and its
   hash computed via `integrity verify`. This **commit hash** is recorded in the Challenge
   Record's Challenge Design section.
2. **Seal.** All N commit hashes are collected *before* any reveal. The set of commit hashes is
   itself recorded (and ideally externally anchored — see Open Questions) so the commit ordering
   is fixed on the record.
3. **Reveal phase.** Only after all commits are sealed may cross-session aggregation begin. Any
   cross-session reference uses the federation by-hash mechanism — pointing at a sealed log
   without importing its authority.
4. **Attestation.** The verification bundle carries the N commit hashes, the seal record, and
   replay instructions. An auditor re-runs `integrity verify` on each log and confirms each
   committed set matches its recorded hash — proving no committed objection set was altered after
   reveal.

This ships property (a) and nothing more. It requires **zero new event types** — it is a
discipline over existing events, plus a recorded artifact. That keeps the spine frozen, which
is the point.

### Options considered

| Option | Description | Verdict |
|--------|-------------|---------|
| **A — Procedure only** (existing primitives) | Commit hashes + seal record + federation by-hash refs, all product-layer. | **Chosen for pilot.** Substantiates (a), honors the freeze, no engine change. |
| **B — `IndependenceAttestation` spine primitive** | A first-class event family binding the N commit hashes into one verifiable attestation object with its own `... verify` command. | **Deferred.** Only build if a pilot buyer demands protocol-native attestation. Promotion criteria below. |
| **C — Trusted timestamp authority** | Anchor commit hashes to an external trusted-timestamping service to harden ordering. | **Rejected as a requirement** (optional hardening only). A *required* external authority imports trust the protocol is built to avoid; `trusted: false` includes timestamp authorities. Allowed as a disclosed, optional belt-and-suspenders, never as the basis of the claim. |

## The boundary — what attestation does and does not establish

- **Establishes:** committed objection sets are tamper-evident and ordered relative to reveal;
  no session's recorded findings were authored after seeing another's (given the seal record is
  intact).
- **Does NOT establish:** absence of a shared substrate (b); absence of an out-of-band side
  channel between operators; that any objection is correct; that convergence means truth.
  Convergence is independent *agreement*, not independent *correctness* — and only as independent
  as (b) permits.
- **Standing boundary line:** *Independence is evidenced, bounded, and disclosed — never proven
  absolute.* Attestation is not endorsement; commit-reveal is not collusion-proof; a sealed bid
  is not a guarantee the bidders share no upstream cause.

## Threat model (residual risk, disclosed not hidden)

| Threat | Procedure A mitigation | Residual |
|--------|------------------------|----------|
| Post-hoc editing of a session's objections | `integrity verify` against recorded commit hash | None for content; an editor would break the hash. |
| Re-ordering / back-dating a commit | Seal record fixes the hash set before reveal | Depends on seal integrity — hence optional external anchor (Option C). |
| Operator runs two "independent" sessions and steers both | **None — procedure cannot see this** | Disclosed under (b). Mitigated only by multi-vendor composition + named human roles, which is evidence, not proof. |
| Two vendors' models share a training corpus | **None** | Disclosed under (b). This is the dominant residual risk and must be stated in every Record's Boundary Statement. |

## Open questions

- **(Non-blocking)** Seal anchoring: is the in-bundle seal record sufficient, or does a pilot
  buyer want an external timestamp anchor (Option C, disclosed-optional)? Decide on first buyer
  ask, not speculatively.
- **(Non-blocking)** Cross-session participant identity: if the same vendor/version appears in
  two sessions, does that violate (a) or only (b)? Lean (b) — record it, disclose it, don't claim
  it away. Revisit with the aggregation-boundary draft, which faces the same identity question at
  fan-out.
- **Promotion criteria (A → B):** build the spine primitive only when **all** hold: (1) a paying
  buyer requires protocol-native attestation rather than a procedural one; (2) ≥3 pilots have
  exercised Procedure A and surfaced a concrete gap procedure cannot close; (3) the scope freeze
  has lifted per `GATES.md`. Until then, every manual seal step is logged honestly (mirroring the
  aggregation-boundary draft's stance) to feed this decision with evidence rather than
  speculation.

## Relationship to existing docs

- Reuses the **sealed-bid property** from `draft-aggregation-boundary.md` (federation by-hash) at
  the cross-session boundary; this ADR is its single-decision, small-N counterpart, where that
  draft is the fan-out (~1000 logs) counterpart.
- Honors `README.md` → Boundaries: *Federation is not centralization; verification of structure
  is never endorsement of content.*
- Subordinate to `pack/GATES.md`: nothing here is a spine layer; Procedure A is product delivery.
