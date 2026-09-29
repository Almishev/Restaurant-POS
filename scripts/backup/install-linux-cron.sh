#!/usr/bin/env bash
# Install daily cron job (23:00) for POS USB backup.
# Usage: ./install-linux-cron.sh
#        ./install-linux-cron.sh 22:00
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-to-usb.sh"
LOG_FILE="${POS_BACKUP_LOG:-$HOME/pos-backup.log}"
TIME="${1:-23:00}"

HOUR="${TIME%%:*}"
MIN="${TIME##*:}"

chmod +x "$BACKUP_SCRIPT" "$SCRIPT_DIR/init-usb.sh" 2>/dev/null || true

CRON_LINE="$MIN $HOUR * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

# Remove old lines for this script, then add
TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -vF "$BACKUP_SCRIPT" >"$TMP" || true
echo "$CRON_LINE" >>"$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Cron installed: daily at $TIME"
echo "Command: $BACKUP_SCRIPT"
echo "Log: $LOG_FILE"
echo "Test now: $BACKUP_SCRIPT"
