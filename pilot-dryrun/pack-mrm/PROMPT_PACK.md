# ClisTa Challenge Prompt Pack — Model Risk Management v0.1 (Stage 0)

An adaptation of `pack/PROMPT_PACK.md` for **effective challenge** of AI/ML model deployment
decisions under SR 11-7 and interagency model risk guidance. Effective challenge means
documented, independent, credible review of a model before and during deployment, by parties
with the authority, competence, and incentive to push back. This pack structures one sealed
adversarial review session; an engagement aggregates N sealed sessions into a Challenge
Record. Output per session: a deployment recommendation you can defend, in a ledger you can
hand to a model risk officer. No tooling required; one markdown ledger is the whole artifact
(see `pack/LEDGER_TEMPLATE.md`).

**Core law:** Conversation is input. Reasoning state is output.
**Operating model:** Explore in threads. Project into state. Verify against artifacts. Act only
after alignment.

## Before you start — applicability check (skip this pack if any answer is "no")

- Is the deployment decision hard to reverse (live alerting, customer impact, regulatory exposure)?
- Does it span multiple stakeholders or review sessions?
- Can its key claims be checked against real artifacts (validation studies, data lineage
  documentation, monitoring plans, published performance figures)?

Do NOT use this for: reversible analytics experiments, brainstorming model ideas,
single-reviewer signoffs, pure value disputes, or live incident response.

## Evidence discipline (binding)

Every session receives an **evidence packet** and nothing else. All objections, defenses, and
claims must cite evidence-packet item IDs or be labeled ASSUMPTION. **No invented facts about
the model.** A claim about model performance, data provenance, or operational behavior that
cannot be traced to a packet item is an assumption and must be declared as one.

## Sealing discipline (binding)

Sessions in the same engagement are sealed: a session must not reference, quote, or be
influenced by any other session's content. The ledger is committed before any cross-session
visibility. Independence of sessions is what the Convergence Analysis in the Challenge Record
measures; breaking the seal invalidates the run.

## Roles (one agent or person each; five challenge lanes + one referee)

- **DEPLOYMENT ADVOCATE (proposer)** — opens with the CONCRETE deployment case as posed by the
  institution (scope, thresholds, alerting workflow, monitoring commitments — no vibes), claims
  numbered (C1, C2, …). Owns dispositioning every numbered objection. The advocate argues the
  institution's case from the evidence packet; they do not soften it to make challenge easier.
- **MODEL VALIDATOR (lane A)** — challenges statistical validity: discrimination, calibration,
  external validity, population mismatch, evaluation design, performance claims vs. evidence.
- **DATA LINEAGE SKEPTIC (lane B)** — challenges data provenance: training data sources,
  feature definitions, label quality, leakage, drift between development and deployment data,
  vendor opacity about inputs.
- **PATIENT/CONSUMER-HARM REVIEWER (lane C)** — challenges harm pathways: false negatives and
  false positives as experienced by the affected person, equity across subpopulations, consent
  and transparency, harm asymmetry in the decision threshold.
- **OPS & MONITORING REVIEWER (lane D)** — challenges operational integration: alert fatigue,
  workflow fit, override behavior, monitoring and recalibration plans, incident response,
  decommissioning criteria.
- **DEVIL'S ADVOCATE (lane E)** — challenges the challenge: attacks the strongest surviving
  defense each round, attacks any consensus forming without artifact verification, and argues
  the strongest available case AGAINST the emerging recommendation, whatever it is. If the
  session is converging on approval, lane E argues rejection; if on rejection, lane E argues
  the cost of non-deployment.
- **REFEREE (lead)** — carries no messages, argues no side. Enforces the rules below, keeps a
  visible state table per round, synthesizes the final report. The referee's job is protocol
  integrity, not opinion.

Each lane files numbered objections in its own ID namespace (A1.., B1.., C-lane uses H1..
to avoid colliding with claim IDs, D1.., E1..).

## State vocabulary (label every substantive point)

CLAIM · ASSUMPTION · EVIDENCE_NEEDED · OBJECTION · CONCESSION · AMENDMENT · RESIDUAL_RISK ·
BLOCKER · DECISION_IMPACT

## Rules of engagement

1. Advocate opens with the concrete deployment proposal, claims numbered (C1, C2, …) for
   attack-by-ID. Every claim cites evidence-packet items or is declared an ASSUMPTION.
2. Each challenge lane replies with numbered objections. Every objection must carry: TARGETS
   (claim ID), FAILURE MODE, CONSEQUENCE, SEVERITY (BLOCKING / NON-BLOCKING — blocking only if
   it should genuinely stop the deployment), VERIFICATION (what artifact would prove or refute
   it).
3. Each round the advocate must mark EVERY numbered point: CONCEDED / DEFENDED /
   PARTIALLY_CONCEDED / ACCEPTED_AS_AMENDMENT / NEEDS_ARTIFACT_VERIFICATION.
   **No silent drops.** Defenses must be mechanisms or evidence-packet citations, never
   reassurance.
4. After each advocate response, every lane re-marks every prior point: RESOLVED / STILL_OPEN /
   CONVERTED_TO_RESIDUAL_RISK / BLOCKING. New objections only against NEW surface (amendments).
   IDs are stable forever — never renumber, never reuse.
5. Up to 4 rounds. Stop early ONLY when every lane is at zero STILL_OPEN and zero BLOCKING.
   Agreement without resolved objections is not alignment.
6. The strongest convergence shape: blockers become **agreed gates** that lift mechanically when
   a named artifact exists (a local validation study, a monitoring dashboard, a recalibration
   report) — disagreement becomes empirical, not rhetorical.
7. Honesty norms (read these to every participant): concede real losses; mark genuine unknowns
   NEEDS_ARTIFACT_VERIFICATION instead of bluffing; a session where the advocate concedes
   nothing is a failed session; a lane that never resolves anything is a failed lane; do not
   inflate non-blockers. Role fidelity over consensus: lanes are paid to disagree where the
   evidence supports disagreement.

## Close protocol

1. Referee confirms every lane's final ledger (zero open / zero blocking, or round 4 reached).
2. Each lane supplies a final caveat: "I endorse this recommendation only if …".
3. Referee writes the final report: recommendation (deploy / deploy with conditions / do not
   deploy); why it advanced; key tradeoffs as "Chose X over Y because Z" (accepted costs, not
   fake solved problems); concessions; won-back claims; residual risks with owners and
   triggers; blocked items; artifact checks required; authority boundary (what this session was
   and was not allowed to decide — a session recommends, only named institutional authority
   approves); one-line integrity verdict ("Was the challenge real?").
4. Fill `pack/LEDGER_TEMPLATE.md` — the ledger table plus a Transfer State section a fresh
   reviewer can resume from without replaying the session.

## Honest labeling (do not skip)

The ledger header carries `epistemic_state: unaudited` until a NON-participant audits it.
A clean, closed ledger means the recommendation is **well-shaped — not right**. Closure is this
format's own success metric; never cite a clean closure as evidence the format works. A session
is challenge documentation, not approval: verification of structure is never endorsement of
content, and `trusted: false` holds until the institution's own named authority grants trust.
This pack supports an effective-challenge process; it is not legal advice and does not certify
SR 11-7 compliance.

---

License: CC BY 4.0 — adapted from `pack/PROMPT_PACK.md` (ClisTa protocol project, attribution:
lati-cooki). If you adapt this pack further, keep the honest-labeling section above; it is
load-bearing, not boilerplate.
