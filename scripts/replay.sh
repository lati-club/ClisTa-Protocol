#!/usr/bin/env bash
#
# Clean-room replay of the Hermes ingestion adapter.
#
# Copies only the public artifact into a fresh temporary directory, then, using
# nothing but those files, reproduces and verifies the whole adapter flow:
#
#   1. re-ingest the example session into a canonical event log
#   2. reproducibility: the regenerated log is byte-identical to the committed one
#   3. the engine accepts the log
#   4. `decision summary` matches the committed expected answer view
#   5. print the human-readable answer view
#
# This proves a non-builder can reproduce the flow from the public files alone,
# with no dependency on local or uncommitted state (e.g. no .clista/ store).
#
# Usage:  npm run replay        (or)        bash scripts/replay.sh

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hermes_example="examples/hermes-ingest"
claude_code_example="examples/claude-code-ingest"

command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
command -v node >/dev/null || { echo "node is required"; exit 1; }

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

green() { printf '\033[32m%s\033[0m\n' "$1"; }
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }

# Two profiles, one pipeline. The M33 hard law is enforced here: re-ingesting
# either profile's session.* must produce a byte-identical regenerated log
# against the committed example. If a profile change ever drifts the protocol
# output of another profile, this script fails.

echo "Clean-room: copying only the public artifact into $workdir"
for path in package.json src schemas "$hermes_example" "$claude_code_example"; do
  mkdir -p "$workdir/$(dirname "$path")"
  cp -R "$repo_root/$path" "$workdir/$(dirname "$path")/"
done
cd "$workdir"

replay_profile() {
  local profile="$1"
  local example="$2"
  local input="$3"
  local replay_file="$4"

  echo
  echo "== profile: $profile =="
  echo "1. Re-ingesting the session..."
  python3 src/ingest_session.py --profile "$profile" --input "$input" --output "$replay_file" >/dev/null

  echo "2. Reproducibility..."
  diff -q "$replay_file" "$example/events.ndjson" >/dev/null \
    && pass "regenerated log is byte-identical to the committed log" \
    || fail "regenerated log differs from the committed log"

  echo "3. Engine validation..."
  node src/cli.js validate --events "$replay_file" | grep -q '"valid": true' \
    && pass "engine accepts the log" \
    || fail "engine rejected the log"

  echo "4. Answer view..."
  node src/cli.js decision summary --events "$replay_file" | diff -q - "$example/expected-summary.json" >/dev/null \
    && pass "decision summary matches the committed expected answer view" \
    || fail "decision summary differs from the expected answer view"
}

replay_profile hermes      "$hermes_example"      "$hermes_example/session.json"        replay-hermes.ndjson
replay_profile claude-code "$claude_code_example" "$claude_code_example/session.jsonl"  replay-claude-code.ndjson

echo
echo "----- hermes decision summary -----"
node src/cli.js decision summary --events replay-hermes.ndjson --format text

echo
echo "----- claude-code decision summary -----"
node src/cli.js decision summary --events replay-claude-code.ndjson --format text

echo
green "Clean-room replay PASSED"
