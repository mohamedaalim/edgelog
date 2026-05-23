#!/usr/bin/env bash
# EdgeLog — daily P&L digest cron trigger
# Usage: add to system crontab or call from Docker cron container
#
# Crontab example (runs Mon-Fri at 5 PM New York time = 22:00 UTC):
#   0 22 * * 1-5 /path/to/edgelog/scripts/cron-daily-digest.sh >> /var/log/edgelog-digest.log 2>&1

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] EdgeLog digest:"

if [ -z "$CRON_SECRET" ] && [ -f "$(dirname "$0")/../.env" ]; then
  CRON_SECRET=$(grep '^CRON_SECRET=' "$(dirname "$0")/../.env" | cut -d= -f2- | tr -d '"')
fi

echo "$LOG_PREFIX triggering $APP_URL/api/alerts/daily-digest"

HTTP_STATUS=$(curl -s -o /tmp/edgelog-digest-response.json -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "${APP_URL}/api/alerts/daily-digest")

BODY=$(cat /tmp/edgelog-digest-response.json 2>/dev/null || echo "{}")

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "$LOG_PREFIX success — $BODY"
elif [ "$HTTP_STATUS" -eq 503 ]; then
  echo "$LOG_PREFIX skipped — SMTP not configured"
else
  echo "$LOG_PREFIX failed (HTTP $HTTP_STATUS) — $BODY" >&2
  exit 1
fi
