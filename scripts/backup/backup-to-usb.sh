#!/usr/bin/env bash
# Dump restaurant-pos MongoDB to USB flash drive (POS-BACKUP.id).
# Usage:
#   ./backup-to-usb.sh
#   POS_BACKUP_USB=/media/$USER/POS-BACKUP ./backup-to-usb.sh
#   ./backup-to-usb.sh --keep-days 14
set -euo pipefail

MARKER_NAME="POS-BACKUP.id"
DB_NAME="${DB_NAME:-restaurant-pos}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
LOG_PREFIX="[POS-BACKUP $STAMP]"

log() { echo "$LOG_PREFIX $*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --usb) POS_BACKUP_USB="$2"; shift 2 ;;
    --keep-days) KEEP_DAYS="$2"; shift 2 ;;
    --db) DB_NAME="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

find_usb_root() {
  if [ -n "${POS_BACKUP_USB:-}" ] && [ -d "$POS_BACKUP_USB" ]; then
    echo "$POS_BACKUP_USB"
    return 0
  fi

  local d
  for d in /media/*/* /run/media/*/* /mnt/* /media/*; do
    [ -d "$d" ] || continue
    if [ -f "$d/$MARKER_NAME" ]; then
      echo "$d"
      return 0
    fi
  done

  # Volume label POS-BACKUP via findmnt/lsblk
  if command -v lsblk >/dev/null 2>&1; then
    local mnt
    mnt="$(lsblk -o LABEL,MOUNTPOINT -nr 2>/dev/null | awk '$1=="POS-BACKUP" && $2!="" {print $2; exit}')"
    if [ -n "${mnt:-}" ] && [ -d "$mnt" ]; then
      echo "$mnt"
      return 0
    fi
  fi

  return 1
}

find_mongo_container() {
  command -v docker >/dev/null 2>&1 || return 1
  docker info >/dev/null 2>&1 || return 1
  local id
  id="$(docker ps --filter 'ancestor=mongo:7' --format '{{.ID}}' 2>/dev/null | head -n1)"
  if [ -n "$id" ]; then
    echo "$id"
    return 0
  fi
  id="$(docker ps --format '{{.ID}} {{.Names}} {{.Image}}' 2>/dev/null | awk 'tolower($0) ~ /mongo/ {print $1; exit}')"
  if [ -n "$id" ]; then
    echo "$id"
    return 0
  fi
  return 1
}

dump_docker() {
  local cid="$1" out="$2"
  local remote="/tmp/pos-backup-$STAMP"
  log "Dump via Docker container $cid ..."
  mkdir -p "$out"
  docker exec "$cid" mongodump --db="$DB_NAME" --out="$remote"
  docker cp "$cid:$remote/$DB_NAME" "$out/"
  docker exec "$cid" rm -rf "$remote" >/dev/null 2>&1 || true
}

dump_local() {
  local out="$1"
  if ! command -v mongodump >/dev/null 2>&1; then
    echo "mongodump not found. Install mongodb-database-tools or use Docker mongo." >&2
    exit 1
  fi
  log "Dump via local mongodump ($MONGO_URI) ..."
  mkdir -p "$out"
  mongodump --uri="$MONGO_URI" --db="$DB_NAME" --out="$out"
}

prune_old() {
  local root="$1" days="$2"
  [ "$days" -gt 0 ] || return 0
  find "$root" -mindepth 1 -maxdepth 1 -type d -mtime "+$days" -print0 2>/dev/null |
    while IFS= read -r -d '' dir; do
      log "Prune old backup: $(basename "$dir")"
      rm -rf "$dir"
    done
}

USB_ROOT="$(find_usb_root || true)"
if [ -z "${USB_ROOT:-}" ]; then
  echo "USB backup target not found. Run ./init-usb.sh or set POS_BACKUP_USB." >&2
  exit 1
fi

if [ ! -f "$USB_ROOT/$MARKER_NAME" ]; then
  log "Warning: $MARKER_NAME missing on $USB_ROOT — continuing anyway."
fi

BACKUP_ROOT="$USB_ROOT/pos-backups"
DEST="$BACKUP_ROOT/$STAMP"
mkdir -p "$DEST"

log "USB: $USB_ROOT"
log "Destination: $DEST"

METHOD=""
if CID="$(find_mongo_container)"; then
  dump_docker "$CID" "$DEST"
  METHOD="docker:$CID"
else
  dump_local "$DEST"
  METHOD="local:$MONGO_URI"
fi

cat > "$DEST/backup-meta.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "os": "linux",
  "db": "$DB_NAME",
  "method": "$METHOD",
  "destination": "$DEST"
}
EOF

prune_old "$BACKUP_ROOT" "$KEEP_DAYS"

SIZE="$(du -sh "$DEST" 2>/dev/null | awk '{print $1}')"
log "OK — backup complete ($SIZE)"
