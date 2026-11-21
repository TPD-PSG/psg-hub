#!/bin/sh
set -e

TARGET_URL="${APP_URL:-https://hub.production-solutions.group}/api/show-reports/ingest"

echo "[cron-ingest] $(date -u '+%Y-%m-%dT%H:%M:%SZ') calling $TARGET_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$TARGET_URL" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 90)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "[cron-ingest] HTTP $HTTP_CODE"
echo "[cron-ingest] $BODY"

if [ "$HTTP_CODE" -ge 400 ]; then
  echo "[cron-ingest] ERROR: non-2xx response"
  exit 1
fi

echo "[cron-ingest] done"
