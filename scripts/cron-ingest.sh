#!/bin/sh
set -e

TARGET_URL="${APP_URL:-https://hub.production-solutions.group}/api/show-reports/ingest"

echo "[cron-ingest] $(date -u '+%Y-%m-%dT%H:%M:%SZ') calling $TARGET_URL"

# Each call parses for up to ~40s; keep calling (max 5) while the server reports deferred reports
RUN=1
while [ "$RUN" -le 5 ]; do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$TARGET_URL" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    --max-time 90)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  echo "[cron-ingest] run $RUN: HTTP $HTTP_CODE"
  echo "[cron-ingest] $BODY"

  if [ "$HTTP_CODE" -ge 400 ]; then
    echo "[cron-ingest] ERROR: non-2xx response"
    exit 1
  fi

  # Stop unless the response says some reports were left for the next batch
  echo "$BODY" | grep -q '"deferred":[1-9]' || break
  RUN=$((RUN + 1))
done

echo "[cron-ingest] done"
