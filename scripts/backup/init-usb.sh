#!/usr/bin/env bash
# Initialize USB stick as POS backup target (writes POS-BACKUP.id).
# Usage:
#   ./init-usb.sh /media/$USER/POS-BACKUP
#   ./init-usb.sh          # auto-find first removable-looking mount without marker
set -euo pipefail

MARKER_NAME="POS-BACKUP.id"
LABEL="POS-BACKUP"

find_candidate() {
  local d
  for d in /media/*/* /run/media/*/* /mnt/* /media/*; do
    [ -d "$d" ] || continue
    # skip system-ish mounts
    case "$d" in
      /media/cdrom*|/media/floppy*) continue ;;
    esac
    echo "$d"
    return 0
  done
  return 1
}

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  TARGET="$(find_candidate || true)"
fi

if [ -z "$TARGET" ] || [ ! -d "$TARGET" ]; then
  echo "USB mount not found. Pass path: ./init-usb.sh /media/\$USER/<usb>" >&2
  exit 1
fi

MARKER="$TARGET/$MARKER_NAME"
cat > "$MARKER" <<EOF
Restaurant-POS backup target
created=$(date -Iseconds)
hostname=$(hostname)
os=linux
EOF

mkdir -p "$TARGET/pos-backups"

# Best-effort label (needs device + root; ignore failures)
if command -v lsblk >/dev/null 2>&1; then
  DEV="$(findmnt -n -o SOURCE --target "$TARGET" 2>/dev/null || true)"
  if [ -n "${DEV:-}" ] && command -v fatlabel >/dev/null 2>&1; then
    sudo fatlabel "$DEV" "$LABEL" 2>/dev/null || true
  elif [ -n "${DEV:-}" ] && command -v ntfslabel >/dev/null 2>&1; then
    sudo ntfslabel "$DEV" "$LABEL" 2>/dev/null || true
  fi
fi

echo "USB ready: $MARKER"
echo "Backups will go to: $TARGET/pos-backups"
