#!/usr/bin/env bash
#
# Nightly PostgreSQL dump.
#
#   20 3 * * * /opt/imix/scripts/backup-db.sh >> /opt/imix/backups/backup.log 2>&1
#
# The dumps land on the host filesystem, deliberately outside the imix-db-data
# volume: a backup that only exists inside the thing it is backing up is not a
# backup. A copy off this machine entirely is the next step and is not set up
# here — see DEPLOYMENT.md.
#
# Read-only with respect to the database. It never drops, never restores, and
# only ever deletes its own older dumps.

set -euo pipefail

COMPOSE_DIR=${COMPOSE_DIR:-/opt/imix}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
BACKUP_DIR=${BACKUP_DIR:-$COMPOSE_DIR/backups}
KEEP=${KEEP:-7}

cd "$COMPOSE_DIR"

# POSTGRES_USER / POSTGRES_DB come from the same .env compose reads.
set -a
# shellcheck disable=SC1091
source ./.env
set +a

mkdir -p "$BACKUP_DIR"
stamp=$(date +%Y%m%d-%H%M%S)
target="$BACKUP_DIR/imix-$stamp.dump"

echo "[$(date -Is)] dumping $POSTGRES_DB → $target.gz"

# --format=custom rather than plain SQL: pg_restore can then pick out a single
# table, and the format is compressed and version-tolerant.
# -T keeps docker from allocating a TTY, which would corrupt the binary stream.
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$target"

# A dump that failed halfway is worse than no dump, because it looks like one.
if [[ ! -s $target ]]; then
  echo "[$(date -Is)] dump is empty — removing it and failing" >&2
  rm -f "$target"
  exit 1
fi

gzip -f "$target"
echo "[$(date -Is)] wrote $(du -h "$target.gz" | cut -f1)"

# Retention. `ls -t` newest first, everything past $KEEP goes.
mapfile -t stale < <(ls -1t "$BACKUP_DIR"/imix-*.dump.gz 2>/dev/null | tail -n +$((KEEP + 1)))
for old in "${stale[@]:-}"; do
  [[ -n $old ]] || continue
  echo "[$(date -Is)] pruning $(basename "$old")"
  rm -f "$old"
done

echo "[$(date -Is)] done — $(ls -1 "$BACKUP_DIR"/imix-*.dump.gz 2>/dev/null | wc -l) backups on disk"
