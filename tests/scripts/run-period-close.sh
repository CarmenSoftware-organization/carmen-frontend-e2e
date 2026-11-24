#!/usr/bin/env bash
# Run one period-close round, phase by phase, and stop before each irreversible
# step (Start Period Close, count submit, Close Period) if anything failed.
# Known bugs are pinned with test.fail(), so they do not stop the round.
#
# Usage:
#   ./run-period-close.sh <BU> [extra spec to run before Start …]
#   ./run-period-close.sh BU-96EAT3GX
#   ./run-period-close.sh BU-96EAT3GX tests/916-period-close-fix-guards.spec.ts
#
# <BU> is one of the TEST BUs (tests/test-users.ts TEST_BUS). The period under test is last
# month, the BU must have been reset first: `bun run data:reset --bu <BU> --with-history`.
# The irreversible steps (Start, count submit, Close) have no env gate any more — they run only
# on a TEST BU whose active period is the scenario's (irreversibleAllowed), and a TEST BU is
# reset with data:reset. Needs E2E_DB_URL (see .env.example). Evidence lands in
# runs/period-close/<BU>/<period>/ (results.json + screenshots).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if [ -z "${1:-}" ]; then
  echo "usage: $0 <BU> [extra spec …]" >&2
  exit 1
fi
export E2E_PERIOD_BU="$1"
shift
EXTRA=("$@")

phase() {
  local label=$1
  shift
  echo "== $E2E_PERIOD_BU · $label"
  bun run test:period-close -- "$@"
}

phase "before Start" \
  tests/910-period-close-prestep.spec.ts tests/911-period-close-blockers.spec.ts \
  tests/912-period-close-start-gate.spec.ts tests/914-period-close-out-of-period-docs.spec.ts \
  tests/917-period-close-new-rules.spec.ts ${EXTRA[@]+"${EXTRA[@]}"} || { echo "failures before Start — stopping"; exit 2; }

phase "Start" tests/918-period-close-start.spec.ts || exit 3

phase "counting" \
  tests/920-period-close-close-gate.spec.ts tests/921-period-close-count.spec.ts \
  tests/922-period-close-verify.spec.ts tests/923-period-close-ledger-views.spec.ts || { echo "failures before Close — stopping"; exit 4; }

phase "Close" tests/924-period-close-close.spec.ts || exit 5
