#!/usr/bin/env bash
#
# Nightly backups of the production databases, sent off the server to an S3
# bucket (Hetzner Object Storage). Run by cron on the production host:
#
#   15 3 * * * /root/application/backup/backup.sh
#
# Settings in backup.env, next to this script (chmod 600, never committed):
#   S3_ENDPOINT=https://fsn1.your-objectstorage.com
#   S3_BUCKET=idem-backups
#   S3_ACCESS_KEY=…   S3_SECRET_KEY=…
#   RETENTION_DAYS=14
#
# Each dump runs inside its own database container (no client to install),
# is compressed, uploaded, then removed locally. Every step prints one JSON
# line through the `idem-backup` container, which Alloy ships to Loki: the
# alerts "Sauvegarde en échec" and "Aucune sauvegarde depuis 26 heures" read them.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/backup.env"
: "${S3_ENDPOINT:?}" "${S3_BUCKET:?}" "${S3_ACCESS_KEY:?}" "${S3_SECRET_KEY:?}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

DAY="$(date -u +%Y-%m-%d)"
WORK="$(mktemp -d /tmp/idem-backup.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
FAILED=0

# One JSON line per step, printed here and kept for publish_logs.
LINES="$WORK/lines.jsonl"
log() {
  local level="$1" event="$2" target="$3" extra="${4:-}"
  local line
  line=$(printf '{"timestamp":"%s","level":"%s","service":"backup","environment":"production","event":"%s","target":"%s"%s}' \
    "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" "$level" "$event" "$target" "$extra")
  echo "$line"
  echo "$line" >>"$LINES"
}

# The lines reach Loki like any service log: printed by a container named
# idem-backup, which Alloy collects. It stays up 30 s so that Alloy, which
# looks for new containers every 10 s, sees it; it runs detached and removes
# itself. Each line keeps its own timestamp.
publish_logs() {
  [ -s "$LINES" ] || return 0
  # Outside WORK, which is deleted on exit while the container still reads it.
  local published=/tmp/idem-backup-lines.jsonl
  cp "$LINES" "$published"
  docker rm -f idem-backup >/dev/null 2>&1
  docker run -d --rm --name idem-backup -v "$published":/lines.jsonl:ro alpine:3.20 \
    sh -c 'cat /lines.jsonl; sleep 30' >/dev/null 2>&1 || true
}

s3() {
  docker run --rm -v "$WORK":/work -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
    -e AWS_DEFAULT_REGION=us-east-1 amazon/aws-cli:2.17.0 --endpoint-url "$S3_ENDPOINT" "$@"
}

# name | container | dump command run inside the container (stdout = dump)
TARGETS=(
  "ideploy-postgres|ideploy-db|pg_dumpall -U \"\$POSTGRES_USER\""
  "auth-postgres|idem-auth-db|pg_dumpall -U \"\$POSTGRES_USER\""
  "infisical-postgres|infisical-db|pg_dumpall -U \"\$POSTGRES_USER\""
  "wikijs-postgres|wikijs-db|pg_dumpall -U \"\$POSTGRES_USER\""
  "mongodb|mongodb|mongodump --quiet --archive -u \"\$MONGO_INITDB_ROOT_USERNAME\" -p \"\$MONGO_INITDB_ROOT_PASSWORD\" --authenticationDatabase admin"
  "wegift-mysql|wegift-mysql|mysqldump --all-databases --single-transaction -uroot -p\"\$MYSQL_ROOT_PASSWORD\""
)

for entry in "${TARGETS[@]}"; do
  IFS='|' read -r name container cmd <<<"$entry"
  if ! docker ps --format '{{.Names}}' | grep -qx "$container"; then
    log warn backup.skipped "$name" ',"reason":"container not running"'
    continue
  fi
  file="$WORK/$name-$DAY.gz"
  start=$(date +%s)
  if docker exec "$container" sh -c "$cmd" 2>"$WORK/err" | gzip -c >"$file" && [ "${PIPESTATUS[0]}" -eq 0 ] && [ -s "$file" ]; then
    size=$(stat -c %s "$file")
    if s3 s3 cp "/work/$(basename "$file")" "s3://$S3_BUCKET/$name/$(basename "$file")" --only-show-errors >"$WORK/err" 2>&1; then
      log info backup.uploaded "$name" ",\"bytes\":$size,\"durationMs\":$(( ($(date +%s) - start) * 1000 ))"
    else
      FAILED=1
      log error backup.failed "$name" ",\"step\":\"upload\",\"error_message\":$(head -c 300 "$WORK/err" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
    fi
  else
    FAILED=1
    log error backup.failed "$name" ",\"step\":\"dump\",\"error_message\":$(head -c 300 "$WORK/err" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
  fi
  rm -f "$file"
done

# Retention: delete dumps older than RETENTION_DAYS, by the date in their name.
cutoff=$(date -u -d "-$RETENTION_DAYS days" +%Y-%m-%d)
s3 s3 ls "s3://$S3_BUCKET/" --recursive 2>/dev/null | awk '{print $4}' | while read -r key; do
  d=$(grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' <<<"$key" | tail -1)
  if [ -n "$d" ] && [[ "$d" < "$cutoff" ]]; then s3 s3 rm "s3://$S3_BUCKET/$key" --only-show-errors >/dev/null 2>&1; fi
done

if [ "$FAILED" -eq 0 ]; then log info backup.completed all; else log error backup.completed_with_errors all; fi
publish_logs
exit "$FAILED"
