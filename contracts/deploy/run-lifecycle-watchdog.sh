#!/usr/bin/env bash
# Restarts a Preprod script when the testkit-js dust sync wedges (it sometimes
# stops advancing after a WS reconnect and never recovers on its own).
#
# Usage: run-lifecycle-watchdog.sh [lifecycle|deploy] [log-dir]
#
# Observed 2026-07-26: a cold `deploy` reached appliedIndex 1188793/1333371 (89%)
# in 105 minutes at ~11k/min, then emitted nothing for the remaining 75 minutes
# of its 3-hour budget. Observed 2026-09-25: wedges at 966k, 310k and 280k, each
# still printing an 18s status line with a frozen appliedIndex.
#
# The scripts checkpoint the wallet sync (deploy/walletState.ts) and lifecycle
# progress, so a restart resumes where the last attempt stopped. That makes a
# restart cheap, which is why stall thresholds here are short.
set -uo pipefail

TARGET="${1:-lifecycle}"

# Keep the machine awake: a suspend drops the indexer WebSocket mid-sync.
if [ -z "${ECLIPSE_WATCHDOG_INHIBITED:-}" ] && command -v systemd-inhibit >/dev/null 2>&1 &&
  systemd-inhibit --what=sleep:idle --who=eclipse-watchdog --why=probe --mode=block true 2>/dev/null; then
  export ECLIPSE_WATCHDOG_INHIBITED=1
  exec systemd-inhibit --what=sleep:idle --who=eclipse-watchdog \
    --why="Eclipse Preprod $TARGET run" --mode=block bash "$0" "$@"
fi

cd "$(dirname "$0")/.."

LOG_DIR="${2:-${TMPDIR:-/tmp}/eclipse-watchdog}"
mkdir -p "$LOG_DIR"

# Success markers are printed only after the evidence file is written.
case "$TARGET" in
  lifecycle) SUCCESS_PATTERN='ECLIPSE_L3_ONCHAIN_OK' ;;
  deploy)    SUCCESS_PATTERN='ECLIPSE_CONTRACT_ADDRESS=' ;;
  *) echo "usage: $0 [lifecycle|deploy] [log-dir]" >&2; exit 2 ;;
esac

# During DUST sync testkit logs a status line every ~18s even after the replay
# has wedged, so the only real progress signal is `dustProgress.appliedIndex`.
# Once the circuit phase starts, a proof+submit+confirm can legitimately be quiet
# for several minutes, so that phase watches log output instead.
DUST_STALL_SECS="${DUST_STALL_SECS:-300}"
STALL_SECS="${STALL_SECS:-900}"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-10}"
RETRY_DELAY_SECS="${RETRY_DELAY_SECS:-30}"
PROOF_SERVER="${MIDNIGHT_PROOF_SERVER:-http://127.0.0.1:6300}"
PROOF_SERVER_CONTAINER="${PROOF_SERVER_CONTAINER:-eclipse-proof}"
CIRCUIT_PHASE_PATTERN='Circuit phase started|Deploying Eclipse contract to'

ensure_proof_server() {
  curl -fsS -m 5 "$PROOF_SERVER/health" >/dev/null 2>&1 && return 0
  echo "[watchdog] proof server $PROOF_SERVER unhealthy; starting container $PROOF_SERVER_CONTAINER"
  docker start "$PROOF_SERVER_CONTAINER" >/dev/null 2>&1
  for _ in $(seq 1 30); do
    curl -fsS -m 5 "$PROOF_SERVER/health" >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "[watchdog] proof server still unhealthy; proving will fail until it is up"
  return 1
}

# Two wallets writing one checkpoint would corrupt the resume, so a restart must
# not begin until the previous script process is really gone.
stop_child() {
  kill "$child" 2>/dev/null
  for _ in $(seq 1 20); do
    pgrep -f "deploy/${TARGET}.ts" >/dev/null || break
    sleep 1
  done
  pkill -9 -f "deploy/${TARGET}.ts" 2>/dev/null
  wait "$child" 2>/dev/null
}

attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  LOG_FILE="$LOG_DIR/${TARGET}-watchdog-attempt${attempt}.log"
  echo "[watchdog] attempt $attempt/$MAX_ATTEMPTS ($TARGET) -> $LOG_FILE"
  ensure_proof_server

  MIDNIGHT_NETWORK="${MIDNIGHT_NETWORK:-preprod}" \
    MIDNIGHT_DUST_TIMEOUT_MS="${MIDNIGHT_DUST_TIMEOUT_MS:-14400000}" \
    npm run "$TARGET" > "$LOG_FILE" 2>&1 &
  child=$!

  last_lines=0
  last_output_change=$(date +%s)
  last_dust_index=''
  last_dust_index_change=$last_output_change

  while kill -0 "$child" 2>/dev/null; do
    sleep "$CHECK_INTERVAL"
    if grep -qE "$SUCCESS_PATTERN" "$LOG_FILE" 2>/dev/null; then
      echo "[watchdog] success detected; waiting for the script to exit"
      wait "$child" 2>/dev/null
      exit 0
    fi

    now_lines=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
    now=$(date +%s)
    current_dust_index=$(sed -nE 's/.*"appliedIndex":"([0-9]+)".*/\1/p' "$LOG_FILE" | tail -1)

    if ! grep -qE "$CIRCUIT_PHASE_PATTERN" "$LOG_FILE" && [ -n "$current_dust_index" ]; then
      if [ "$current_dust_index" != "$last_dust_index" ]; then
        last_dust_index=$current_dust_index
        last_dust_index_change=$now
      elif [ $((now - last_dust_index_change)) -ge "$DUST_STALL_SECS" ]; then
        echo "[watchdog] DUST appliedIndex stalled at ${current_dust_index} for ${DUST_STALL_SECS}s+, restarting from checkpoint"
        stop_child
        break
      fi
    elif [ "$now_lines" -gt "$last_lines" ]; then
      last_lines=$now_lines
      last_output_change=$now
    elif [ $((now - last_output_change)) -ge "$STALL_SECS" ]; then
      echo "[watchdog] no circuit-phase log output for ${STALL_SECS}s+, restarting from checkpoint"
      stop_child
      break
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
  echo "[watchdog] attempt $attempt ended (exit=$code); retrying in ${RETRY_DELAY_SECS}s"
  sleep "$RETRY_DELAY_SECS"
done

echo "[watchdog] gave up after $MAX_ATTEMPTS attempts — no success marker in $LOG_DIR" >&2
exit 1
