#!/usr/bin/env bash
# Restarts a Preprod script when the testkit-js dust sync wedges (it sometimes
# stops advancing after a WS reconnect and never recovers on its own).
#
# Usage: run-lifecycle-watchdog.sh [lifecycle|deploy] [log-dir]
#
# Observed 2026-07-26: a cold `deploy` reached appliedIndex 1188793/1333371 (89%)
# in 105 minutes at ~11k/min, then emitted nothing for the remaining 75 minutes
# of its 3-hour budget. The last 145k indices should have taken ~13 minutes, so
# that silence is the wedge, not slow progress. A stall threshold well under the
# dust budget is what turns a dead run into a retry.
set -uo pipefail

cd "$(dirname "$0")/.."

TARGET="${1:-lifecycle}"
LOG_DIR="${2:-${TMPDIR:-/tmp}/eclipse-watchdog}"
mkdir -p "$LOG_DIR"

case "$TARGET" in
  lifecycle) SUCCESS_PATTERN='status = Distributed|ECLIPSE_L2_ONCHAIN_OK|Ledger status after: Distributed' ;;
  deploy)    SUCCESS_PATTERN='Contract deployed at:' ;;
  *) echo "usage: $0 [lifecycle|deploy] [log-dir]" >&2; exit 2 ;;
esac

# During the dust wait the script logs every ~18s, so silence there is abnormal
# fast. Past that, createPayroll/fund/distribute each cover
# build+prove+sign+submit+confirm in one call with no intermediate logging, and a
# real Preprod confirmation can exceed 10 minutes quietly — so a short threshold
# would kill healthy runs (observed 2026-07-25). 900s clears both: far above the
# 18s dust cadence, still under a legitimate confirmation wait.
STALL_SECS="${STALL_SECS:-900}"
CHECK_INTERVAL=30
MAX_ATTEMPTS="${MAX_ATTEMPTS:-4}"

attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  LOG_FILE="$LOG_DIR/${TARGET}-watchdog-attempt${attempt}.log"
  echo "[watchdog] attempt $attempt/$MAX_ATTEMPTS ($TARGET) -> $LOG_FILE"

  MIDNIGHT_NETWORK=preprod MIDNIGHT_DUST_TIMEOUT_MS=14400000 \
    npm run "$TARGET" > "$LOG_FILE" 2>&1 &
  child=$!

  last_lines=0
  last_change=$(date +%s)

  while kill -0 "$child" 2>/dev/null; do
    sleep "$CHECK_INTERVAL"
    now_lines=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
    now=$(date +%s)
    # Any new log output counts as progress, not just dust-sync appliedIndex
    # lines - once past the dust wait, createPayroll/fund/distribute log
    # sparsely (a couple of lines around each proof+submit), so a naive
    # appliedIndex-only check false-triggers during normal tx submission.
    if [ "$now_lines" -gt "$last_lines" ]; then
      last_lines="$now_lines"
      last_change="$now"
    elif [ $((now - last_change)) -ge "$STALL_SECS" ]; then
      echo "[watchdog] no new log output for ${STALL_SECS}s+, killing and retrying"
      kill "$child" 2>/dev/null
      wait "$child" 2>/dev/null
      break
    fi
    if grep -qE "$SUCCESS_PATTERN" "$LOG_FILE" 2>/dev/null; then
      echo "[watchdog] success detected"
      grep -E "$SUCCESS_PATTERN" "$LOG_FILE" | tail -3
      exit 0
    fi
  done

  wait "$child" 2>/dev/null
  code=$?
  # npm exits 0 on some failures, and the dust timeout exits 1 after logging an
  # Error line — so the marker, not the exit code, decides success.
  if grep -qE "$SUCCESS_PATTERN" "$LOG_FILE" 2>/dev/null; then
    echo "[watchdog] success marker present (exit=$code)"
    exit 0
  fi
  echo "[watchdog] attempt $attempt ended (exit=$code), retrying..."
done

echo "[watchdog] gave up after $MAX_ATTEMPTS attempts — no success marker in $LOG_DIR" >&2
exit 1
