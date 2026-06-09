# Draft — The Aggregation Boundary (multi-log aggregation)

Status: **draft / decision input, not a commitment.** Nothing here ships under the current
scope freeze (`README.md` → Boundaries → Scope freeze; `pack/GATES.md`): no new verifier
layers until five external runs exist. This document decides *where a boundary should fall*
if and when aggregation is built — so the decision is made deliberately, on the record,
before code forces it.

`trusted: false` is assumed throughout. Aggregation verifies and references structure; it
never endorses content, and an aggregate is a *claim about* logs, never a *fact in* them.

## The use case

A "Thread Hub" wants to aggregate across ~1000 independently-run ClisTa logs and answer
questions like:

> "The same privacy objection survived approval in 340 of 1000 logs."

That single sentence hides three distinct operations, each of which the existing spine either
already supports, partially supports, or deliberately refuses.

## What federation already gives (and what it does not)

Federation's law is `protocol_federation = align(independent_reasoning_states,
shared_protocol_rules)`, hard law **`shared_state != shared_authority`** — enforced by the
`remoteAuthorityImported` invariant ("remote authority cannot become local authority"). A
`FederatedStateReferenceRecorded` event references an external packet *by hash*
(`packetHash`, `federationHash`) without importing its authority. Call this the **sealed-bid
property**: you can point at another log's sealed reasoning state and verify the reference is
intact, without that log's decisions becoming yours, and without yours becoming theirs.

Aggregation across 1000 logs is "federation at fan-out." The sealed-bid property scales
fine — referencing 1000 packets by hash is just 1000 references. But the *headline question*
needs three things federation does not provide:

| Need | What it asks | Federation provides it? |
|------|--------------|-------------------------|
| (a) Cross-log objection **deduplication** | Are these two objection records the same item? | Only for byte-identical records (hash match). Not for the realistic case. |
| (b) Semantic **equivalence** of objections | Do two *differently-worded* objections mean "the same privacy objection"? | No. Requires interpretation. |
| (c) Cross-log participant **identity** | Is "Alice" in log A the same principal as "A. Smith" in log B? | No. Requires an identity authority federation forbids importing. |

## The core tension

The protocol's interoperability law is `protocol_interoperability = preserve(meaning,
across_compatible_contexts)`, hard law **`translation != reinterpretation`**, enforced by
`semanticReinterpretation: false` ("semantic mapping cannot reinterpret sourceSemantic").

Objection *equivalence* is, by definition, a claim that two utterances **mean the same
thing**. Deciding that — when the wording differs — is interpretation. So a protocol-level
"these two objections are equivalent" decision is exactly the move
`translation != reinterpretation` forbids: a non-source authority reinterpreting source
semantics. It also leans on `shared_state != shared_authority`: whoever gets to declare "this
privacy objection survived in 340 logs" is exercising authority over 340 logs' meaning that
those logs never granted.

So the question is not "can we compute equivalence" (a model obviously can). It is: **can
equivalence be a *protocol* concern — a new deterministic event family with matching rules —
without breaking the two hard laws that make federation worth anything?**

A second constraint sharpens it: **anything in the protocol must be deterministic** (same
events → same state, for anyone, no privileged server). Semantic matching by a language model
is not deterministic and not reproducible across aggregators. Determinism alone rules out
"the protocol runs a model to cluster objections."

## The decision, taken need by need

The three needs do not land on the same side of the boundary. Forcing one verdict for all
three is the trap.

### (a) Deduplication → already derivable; no new layer

Exact-match dedup over federated references is deterministic and already computable from
existing hashes (`packetHash`, content hashes). It is a *query over federation output*, not a
new authority. **Product concern, but free** — Thread Hub can compute it today; the protocol
needs nothing new. The honest limit: exact-match dedup only catches literally-identical
records, which is rare across independently-authored logs. The interesting dedup *is*
equivalence (b).

### (b) Semantic equivalence → product concern, with one narrow protocol affordance

Split this in two:

- **Post-hoc semantic judgment** ("an aggregator reads two differently-worded objections and
  declares them the same") is **reinterpretation by a non-source authority**. It violates
  `translation != reinterpretation` and `shared_state != shared_authority`, and it is
  non-deterministic. It **must stay a product concern.** Thread Hub may do it, but its output
  is a `trusted: false` aggregate artifact — a claim *about* the logs — that is **never
  written back** into any source log and **never** confers authority over them.

- **Authoring-time declared equivalence** is the one move that can be protocol-safe. A source
  log may, *at authoring time, under its own authority*, tag an objection with a key from a
  shared controlled vocabulary (e.g. `category: "privacy"`) and/or a stable hash. Matching on
  a *declared* key is deterministic and stays inside the source's own authority — the
  aggregator references the declaration, it does not reinterpret meaning. This is "translation
  by a declared mapping," which `translation != reinterpretation` explicitly permits.

  The cost of even this narrow affordance: a shared controlled vocabulary needs an owner, and
  "who owns the privacy-category taxonomy" is itself shared authority — the exact thing
  `shared_state != shared_authority` resists. So the affordance only earns its place if the
  vocabulary is small, additive, and optional, and counts built on it are explicitly labelled
  "declared-category counts," not "semantic counts."

### (c) Cross-log identity → product concern; protocol carries declared ids only

Correlating principals across logs is an **identity authority claim**. Federation forbids
importing remote authority, and identity is the sharpest form of it. The protocol may carry a
*declared, stable identifier* per participant (a keyed identity the source log already
asserts) and deterministically match on exact identifier equality. Any correlation *beyond*
exact declared-id match — "Alice ≈ A. Smith" — is inference, hence **product concern,
`trusted: false`**, and must never be written back as a source-log identity fact.

## Recommendation

**Equivalence is primarily a product (Thread Hub) concern. The protocol stays out of
*deciding* meaning. Its only candidate contribution is a narrow, optional, authoring-time
*declared-equivalence key* that preserves deterministic matching without the protocol ever
interpreting.** And under the scope freeze, even that ships only after the gate lifts.

Concretely, if/when built:

1. **No new "objection-equivalence" verifier layer that adjudicates meaning.** That would put
   reinterpretation inside the protocol and add permanent non-deterministic surface area.
2. **Thread Hub owns semantic aggregation.** It runs over federated references, emits an
   aggregate artifact carrying `trusted: false`, `semanticReinterpretation`-style honesty, and
   provenance back to each source reference. The "340/1000" headline lives here, labelled as a
   Hub assertion, not a protocol-verified fact.
3. **The protocol's only optional affordance** is letting source logs *declare* equivalence
   keys (controlled-vocabulary `category`, stable hashes, stable participant identifiers) at
   authoring time. Matching on declared keys is deterministic and authority-safe.
4. **Nothing aggregated is ever written back** into a source log. Aggregates reference; they
   never mutate or re-author. This is the dedup/identity analogue of `recommendation != amendment`.

### Tradeoffs (explicit)

| Choice | Gain | Accepted cost |
|--------|------|----------------|
| Equivalence as **product** (recommended) | Hard laws (`translation != reinterpretation`, `shared_state != shared_authority`) stay intact; aggregation can be arbitrarily smart without contaminating source authority; no permanent deterministic surface added now; respects the scope freeze. | The "340/1000" number is a Thread Hub assertion (`trusted: false`), not a protocol-verified fact. Two aggregators with different interpretation models may disagree; only *declared-key* counts are reproducible byte-for-byte. |
| Equivalence as **protocol** (new event family + matching rules) | Reproducible, independently-verifiable equivalence counts. | Forces interpretation into the spine (breaks `translation != reinterpretation`) or forces a protocol-owned taxonomy (breaks `shared_state != shared_authority`); adds permanent non-deterministic or governance-heavy surface; violates the scope freeze. |
| **Declared-key affordance only** (the seam) | Deterministic, authority-safe matching for the subset of logs that opt in. | Needs a vocabulary owner (a sliver of shared authority); only works where every relevant source log adopted the same keys; partial coverage. |

## What would change this recommendation

- An external-run cohort that actually needs cross-log counts *as verifiable protocol facts*
  (not Hub assertions) would raise the value of the declared-key affordance — but that demand
  should be shown by real runs, not assumed. (This is itself an argument for the gate.)
- A deterministic, reproducible, model-free equivalence rule that every party can re-run to
  byte-identical results would move (b) toward "protocol" — but no such rule exists for
  free-text meaning, and inventing one is a research project, not a layer.
- A federation-native identity scheme that makes cross-log identity a *declaration* rather
  than an *inference* would move (c)'s exact-match case fully into protocol safely.

## One-line verdict

Aggregation is federation at fan-out plus interpretation; keep the fan-out in the protocol and
the interpretation in the product, and the protocol's hard laws survive contact with 1000
logs.
