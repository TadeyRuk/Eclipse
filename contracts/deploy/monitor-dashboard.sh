#!/usr/bin/env bash
cd "$(dirname "$0")/../.."
while true; do
  clear
  LOG=$(ls -t contracts/logs/watchdog/lifecycle-watchdog-attempt*.log 2>/dev/null | head -1)
  echo "=== Eclipse Preprod Lifecycle Live Monitor (Ctrl+C to exit) ==="
  date
  echo
  if [ -n "$LOG" ]; then
    echo "Log: $LOG"
    INDEX_LINE=$(grep -o '"appliedIndex":"[0-9]*","highestRelevantWalletIndex":"[0-9]*"' "$LOG" | tail -1)
    if [ -n "$INDEX_LINE" ]; then
      APPLIED=$(echo "$INDEX_LINE" | sed -E 's/.*"appliedIndex":"([0-9]+)".*/\1/')
      TOTAL=$(echo "$INDEX_LINE" | sed -E 's/.*"highestRelevantWalletIndex":"([0-9]+)".*/\1/')
      if [ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ] 2>/dev/null; then
        PCT=$(( APPLIED * 100 / TOTAL ))
        echo "Sync Progress: ${APPLIED} / ${TOTAL} (${PCT}%)"
      else
        echo "Sync Progress: $INDEX_LINE"
      fi
    fi
    CHECKPOINT=$(grep -oE 'Checkpointed wallet sync at appliedIndex=[0-9]+' "$LOG" | tail -1)
    echo "Last checkpoint: ${CHECKPOINT:-none yet}"
    echo
    echo "--- Recent Lifecycle Events ---"
    grep -E 'Restored wallet from checkpoint|No usable wallet checkpoint|Circuit phase started|Contract deployed at:|Wrote [0-9]+ demo instance|Lifecycle contract=|Calling |txId=|failed \(attempt|landed in an earlier attempt|Ledger status after:|ECLIPSE_L3_ONCHAIN_OK|FATAL|Unhandled|Timeout waiting' "$LOG" | tail -12
  fi
  sleep 5
done
