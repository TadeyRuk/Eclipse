#!/usr/bin/env bash
# Restarts `npm run lifecycle` if appliedIndex stalls (testkit-js sync loop
# sometimes wedges after a WS reconnect and never recovers on its own).
set -uo pipefail

cd "$(dirname "$0")/.."
LOG_DIR="/tmp/claude-1000/-home-tadeyruk-Documents-Projects-Eclipse/9ed37b37-dba9-46fb-9185-e43bb11c2ea1/scratchpad"
# createPayroll/fund/distribute each cover build+prove+sign+submit+confirm in
# one call with no intermediate logging - real tx confirmation on Preprod can
# legitimately take longer than 10min with zero output, so a short threshold
# here kills healthy runs, not just genuinely wedged ones (observed 2026-07-25).
STALL_SECS=1800
CHECK_INTERVAL=30

attempt=0
while true; do
  attempt=$((attempt + 1))
  LOG_FILE="$LOG_DIR/lifecycle-watchdog-attempt${attempt}.log"
  echo "[watchdog] attempt $attempt -> $LOG_FILE"

  MIDNIGHT_NETWORK=preprod MIDNIGHT_DUST_TIMEOUT_MS=14400000 \
    npm run lifecycle > "$LOG_FILE" 2>&1 &
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
    if grep -q "status = Distributed\|Distribute succeeded\|Lifecycle complete" "$LOG_FILE" 2>/dev/null; then
      echo "[watchdog] success detected"
      exit 0
    fi
  done

  wait "$child" 2>/dev/null
  code=$?
  if [ "$code" -eq 0 ]; then
    echo "[watchdog] exited 0, checking for success marker"
    if grep -qi "distributed" "$LOG_FILE"; then
      exit 0
    fi
  fi
  echo "[watchdog] attempt $attempt ended (exit=$code), retrying..."
done
