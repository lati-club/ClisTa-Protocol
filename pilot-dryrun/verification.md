# Verification — reproduce this Challenge Record from the logs alone

Everything below is copy-pasteable and was tested **cold from the repository root**
(`/Users/troylatimer/ClisTa-Protocol`) on 2026-06-10. No trust in the producer is required: the
five event logs are the artifacts of record, and these commands re-derive every structural claim
in `challenge-record.md` from those logs using the unmodified ClisTa engine.

Prerequisite: Node.js ≥ 18. Nothing to install (the engine has zero dependencies).

```sh
cd /path/to/clista-protocol   # repository root
```

## 1. Validate all five logs (each must exit 0 with `"valid": true`)

```sh
for n in 1 2 3 4 5; do
  echo "== session-$n =="
  node src/cli.js validate --events pilot-dryrun/sessions/session-$n/events.ndjson
done
```

Expected: five blocks, each ending `"valid": true` / `"errors": []`, exit 0. An invalid log is
not a reportable session — the validator fails closed.

## 2. Reconstruct each session's reasoning state and recommendation from the log alone

```sh
for n in 1 2 3 4 5; do
  echo "== session-$n state =="
  node src/cli.js state show --thread thd_dryrun_s$n --events pilot-dryrun/sessions/session-$n/events.ndjson \
    | node -e 'const d=JSON.parse(require("fs").readFileSync(0));const r=d.decisionStatus?.decisionRecord||{};console.log("recommendation:",r.recommendation,"| preserved objections:",(r.preservedObjectionIds||[]).length,"| claims:",d.claims.length,"| unresolved objections:",d.unresolvedObjections.length)'
done
```

Expected (reproduces §5 of the Record): all five print `recommendation: deploy_with_conditions`.
Preserved-objection counts: session 1 = 3, session 2 = 2, session 3 = 4, session 4 = 5,
session 5 = 0 (the one session with no minority report).

## 3. Portable export (each exits 0)

```sh
for n in 1 2 3 4 5; do
  node src/cli.js export --events pilot-dryrun/sessions/session-$n/events.ndjson > /dev/null && echo "session-$n export OK"
done
```

## 4. Integrity, attribution, provenance

```sh
for n in 1 2 3 4 5; do
  echo "== session-$n =="
  node src/cli.js integrity verify --events pilot-dryrun/sessions/session-$n/events.ndjson | tail -1
  node src/cli.js attribution list --thread thd_dryrun_s$n --events pilot-dryrun/sessions/session-$n/events.ndjson \
    | node -e 'const d=JSON.parse(require("fs").readFileSync(0));console.log("attributions:",d.count)'
  node src/cli.js provenance trace dcr_s$n --events pilot-dryrun/sessions/session-$n/events.ndjson > /dev/null && echo "provenance trace OK"
done
```

## 5. Reproduce the verdict + minority-report convergence (§5 / §6) from the logs alone

```sh
for n in 1 2 3 4 5; do
  node src/cli.js state show --thread thd_dryrun_s$n --events pilot-dryrun/sessions/session-$n/events.ndjson \
    | node -e 'const d=JSON.parse(require("fs").readFileSync(0));const r=d.decisionStatus?.decisionRecord||{};console.log("session '"$n"':",r.recommendation,"| minorityReports:",(r.minorityReportIds||[]).length)'
done
```

Expected: 5/5 `deploy_with_conditions`; minorityReports = 1,1,1,1,0 (4 of 5 sessions filed a
minority report — the §6 finding).

## 6. Recompute the binding hashes (§8 of the Record)

```sh
for n in 1 2 3 4 5; do shasum -a 256 pilot-dryrun/sessions/session-$n/events.ndjson; done
shasum -a 256 pilot-dryrun/evidence-packet.md pilot-dryrun/pack-mrm/PROMPT_PACK.md
```

These must match the table in `challenge-record.md` §8. If a log was edited, its hash changes and
the binding breaks — by design.

## 7. Re-derive the Objection Register counts (§3) from the structured session blocks

The Objection Register is an aggregation of the five sessions. The raw per-session objections live
both in the event logs (as `ObjectionRaised` events) and in the structured `session-data.json`
blocks. To re-derive the raw objection count:

```sh
for n in 1 2 3 4 5; do
  c=$(grep -c '"event_type":"ObjectionRaised"' pilot-dryrun/sessions/session-$n/events.ndjson)
  echo "session-$n raw objections: $c"
done
```

Expected: 11, 12, 11, 10, 11 → 55 total, matching "55 raw objections → 17 canonical" in §3 and
`equivalence-log.md`. The canonical clustering itself is a documented manual judgment
(`equivalence-log.md`); this step verifies only the raw input count, not the merge.

## What a clean run proves — and does not

A clean run of all seven steps proves the **structure** is reproducible: the logs are valid,
deterministic, integrity-checked, and bind every contribution to a participant and to evidence.
It does **not** prove any recommendation is correct, that the sessions were independent (they were
not — single model family, single author; see `challenge-record.md` §2), or that anything here is
trusted or approved. `trusted: false` holds until a non-participant audits the logs and the
institution's own authority grants trust.
