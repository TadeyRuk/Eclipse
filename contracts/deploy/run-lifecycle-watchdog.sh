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

# During DUST sync testkit logs a status line every ~18s, even after the
# WebSocket replay has wedged. The only real progress signal in that phase is
# `dustProgress.appliedIndex`. Once deployment/proving starts, a transaction can
# legitimately be quiet for several minutes, so preserve the output-based
# watchdog there.
#
# `DUST_STALL_SECS` is separate so tests and recovery runs can shorten only the
# sync threshold without making proof submission timing-sensitive.
DUST_STALL_SECS="${DUST_STALL_SECS:-900}"
STALL_SECS="${STALL_SECS:-900}"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"
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
  last_output_change=$(date +%s)
  last_dust_index=''
  last_dust_index_change=$last_output_change

  while kill -0 "$child" 2>/dev/null; do
    sleep "$CHECK_INTERVAL"
    now_lines=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
    now=$(date +%s)
    current_dust_index=$(sed -nE 's/.*"appliedIndex":"([0-9]+)".*/\1/p' "$LOG_FILE" | tail -1)
    circuit_phase=false
    if grep -qE 'Deploying Eclipse contract to|Deploying a fresh Eclipse instance|Lifecycle contract=' "$LOG_FILE"; then
      circuit_phase=true
    fi

    if [ "$circuit_phase" = false ] && [ -n "$current_dust_index" ]; then
      if [ "$current_dust_index" != "$last_dust_index" ]; then
        last_dust_index=$current_dust_index
        last_dust_index_change=$now
      elif [ $((now - last_dust_index_change)) -ge "$DUST_STALL_SECS" ]; then
        echo "[watchdog] DUST appliedIndex stalled at ${current_dust_index} for ${DUST_STALL_SECS}s+, killing and retrying"
        kill "$child" 2>/dev/null
        wait "$child" 2>/dev/null
        break
      fi
    elif [ "$now_lines" -gt "$last_lines" ]; then
      last_lines=$now_lines
      last_output_change=$now
    elif [ $((now - last_output_change)) -ge "$STALL_SECS" ]; then
      echo "[watchdog] no circuit-phase log output for ${STALL_SECS}s+, killing and retrying"
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
