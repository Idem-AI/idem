#!/usr/bin/env bash
#
# Restore a database from the nightly backups (backup.sh, S3 bucket).
#
#   restore.sh list [base]               the dumps available, newest first
#   restore.sh test <base> [YYYY-MM-DD]  restore into a throw-away container and
#                                        show what came back (production untouched)
#   restore.sh prod <base> [YYYY-MM-DD]  restore over the production database
#
# Instead of a date, a file name of that base's folder can be given -- e.g. the
# `pre-restore-...gz` saved by a previous restore, to undo it.
#
# Drill: RESTORE_TARGET=<container> RESTORE_APPS="" restore.sh prod <base>
# runs the production path against another container (a copy made for the
# exercise), never against the real one.
#
# Bases: ideploy-postgres, auth-postgres, infisical-postgres, wikijs-postgres,
#        mongodb, wegift-mysql. Without a date: the most recent dump.
#
# `prod` is the only mode that changes anything, and before it does:
#   1. it asks to type the base name (or --yes);
#   2. it dumps the current state to s3://<bucket>/<base>/pre-restore-<time>.gz,
#      so a wrong restore can itself be undone;
#   3. it stops the applications using the base, restores, and starts them again.
#
# Settings: backup.env next to this script (same file as backup.sh).
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/backup.env"
: "${S3_ENDPOINT:?}" "${S3_BUCKET:?}" "${S3_ACCESS_KEY:?}" "${S3_SECRET_KEY:?}"

WORK="$(mktemp -d /tmp/idem-restore.XXXXXX)"
TEST_CONTAINER="idem-restore-test"
cleanup() { docker rm -f "$TEST_CONTAINER" >/dev/null 2>&1; rm -rf "$WORK"; }
trap cleanup EXIT

die() { echo "ERROR: $*" >&2; exit 1; }
say() { echo "── $*"; }

s3() {
  docker run --rm -v "$WORK":/work -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
    -e AWS_DEFAULT_REGION=us-east-1 amazon/aws-cli:2.17.0 --endpoint-url "$S3_ENDPOINT" "$@"
}

# base → kind | production container | applications to stop during a restore
info() {
  case "$1" in
    ideploy-postgres)   echo "postgres|ideploy-db|ideploy-api ideploy-worker" ;;
    auth-postgres)      echo "postgres|idem-auth-db|idem-auth" ;;
    infisical-postgres) echo "postgres|infisical-db|infisical-backend" ;;
    wikijs-postgres)    echo "postgres|wikijs-db|wikijs" ;;
    mongodb)            echo "mongo|mongodb|idem-api ivision-api appgen-server idem-admin-api" ;;
    wegift-mysql)       echo "mysql|wegift-mysql|wegift-backend" ;;
    *) return 1 ;;
  esac
}

BASES="ideploy-postgres auth-postgres infisical-postgres wikijs-postgres mongodb wegift-mysql"

# The dump of <base> for <date> (or the newest), downloaded to $WORK/dump.gz.
fetch() {
  local base="$1" date="${2:-}" key
  if [[ "$date" == *.gz ]]; then
    key="$base/$date"
  elif [ -n "$date" ]; then
    key="$base/$base-$date.gz"
  else
    key=$(s3 s3 ls "s3://$S3_BUCKET/$base/" | awk '{print $4}' | grep -E "^$base-[0-9]{4}-[0-9]{2}-[0-9]{2}\.gz$" | sort | tail -1)
    [ -n "$key" ] || die "no backup of $base in s3://$S3_BUCKET/$base/"
    key="$base/$key"
  fi
  say "Downloading s3://$S3_BUCKET/$key"
  s3 s3 cp "s3://$S3_BUCKET/$key" /work/dump.gz --only-show-errors || die "cannot download $key"
  gzip -t "$WORK/dump.gz" || die "$key is not a valid gzip file"
  echo "$key" >"$WORK/key"
}

# Waits until a database in <container> answers.
wait_ready() {
  local kind="$1" container="$2" i
  for i in $(seq 1 60); do
    case "$kind" in
      postgres) docker exec "$container" pg_isready -U postgres >/dev/null 2>&1 && return 0 ;;
      mongo)    docker exec "$container" mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1 && return 0 ;;
      mysql)    docker exec "$container" mysql -uroot -ptest -e 'select 1' >/dev/null 2>&1 && return 0 ;;
    esac
    sleep 2
  done
  die "$container did not start"
}

# What a database server holds: databases, tables or collections, rows.
summary() {
  local kind="$1" container="$2" user="${3:-postgres}" pass="${4:-}"
  case "$kind" in
    postgres)
      for db in $(docker exec "$container" psql -U "$user" -d postgres -At -c "select datname from pg_database where not datistemplate and datname <> 'postgres' order by 1"); do
        docker exec "$container" psql -U "$user" -d "$db" -At -c \
          "select '$db: ' || count(*) || ' tables, ~' || coalesce(sum(n_live_tup),0) || ' rows' from pg_stat_user_tables"
      done ;;
    mongo)
      docker exec "$container" mongosh --quiet ${pass:+-u "$user" -p "$pass" --authenticationDatabase admin} --eval '
        db.adminCommand({listDatabases:1}).databases.filter(d=>!["admin","config","local"].includes(d.name)).forEach(d=>{
          const s=db.getSiblingDB(d.name); const cols=s.getCollectionNames();
          let n=0; cols.forEach(c=>{n+=s.getCollection(c).estimatedDocumentCount()});
          print(d.name+": "+cols.length+" collections, ~"+n+" documents")})' ;;
    mysql)
      docker exec "$container" mysql -uroot -p"$pass" -N -e \
        "select concat(table_schema, ': ', count(*), ' tables, ~', coalesce(sum(table_rows),0), ' rows') from information_schema.tables
         where table_schema not in ('mysql','information_schema','performance_schema','sys') group by table_schema" 2>/dev/null ;;
  esac
}

# Feeds $WORK/dump.gz to <container>. Counts SQL errors other than objects
# that already exist (roles, the default database).
load() {
  local kind="$1" container="$2" auth="${3:-}"
  case "$kind" in
    postgres)
      gunzip -c "$WORK/dump.gz" | docker exec -i "$container" psql -U "${auth:-postgres}" -d postgres -q -o /dev/null 2>"$WORK/errors" ;;
    mongo)
      gunzip -c "$WORK/dump.gz" | docker exec -i "$container" sh -c "mongorestore --quiet --archive --drop $auth" 2>"$WORK/errors" ;;
    mysql)
      gunzip -c "$WORK/dump.gz" | docker exec -i "$container" sh -c "mysql -uroot -p\"$auth\"" 2>"$WORK/errors" ;;
  esac
  local real
  real=$(grep -E 'ERROR|error' "$WORK/errors" | grep -vE 'already exists|Using a password' | wc -l)
  if [ "$real" -gt 0 ]; then
    echo "   $real error(s) while loading; the first ones:"
    grep -E 'ERROR|error' "$WORK/errors" | grep -vE 'already exists|Using a password' | head -5 | sed 's/^/     /'
  fi
  LOAD_ERRORS="$real"
  return 0
}

cmd_list() {
  local only="${1:-}"
  for base in ${only:-$BASES}; do
    info "$base" >/dev/null || die "unknown base: $base (one of: $BASES)"
    echo "$base:"
    s3 s3 ls "s3://$S3_BUCKET/$base/" | sort -r | awk '{printf "   %s  %8.1f MB  %s\n", $1, $3/1048576, $4}'
  done
}

cmd_test() {
  local base="$1" date="${2:-}" kind prodc apps
  IFS='|' read -r kind prodc apps <<<"$(info "$base")" || die "unknown base: $base (one of: $BASES)"
  fetch "$base" "$date"
  say "Restoring $(cat "$WORK/key") into a throw-away $kind container (production untouched)"
  docker rm -f "$TEST_CONTAINER" >/dev/null 2>&1
  case "$kind" in
    postgres) docker run -d --name "$TEST_CONTAINER" -e POSTGRES_PASSWORD=test postgres:16-alpine >/dev/null ;;
    mongo)    docker run -d --name "$TEST_CONTAINER" mongo:7.0 >/dev/null ;;
    mysql)    docker run -d --name "$TEST_CONTAINER" -e MYSQL_ROOT_PASSWORD=test mysql:8.0 >/dev/null ;;
  esac
  wait_ready "$kind" "$TEST_CONTAINER"
  [ "$kind" = mysql ] && load "$kind" "$TEST_CONTAINER" test || load "$kind" "$TEST_CONTAINER"
  say "What the backup holds:"
  case "$kind" in
    mysql) summary mysql "$TEST_CONTAINER" root test | sed 's/^/   /' ;;
    *)     summary "$kind" "$TEST_CONTAINER" | sed 's/^/   /' ;;
  esac
  say "Test restore done. To compare with production: $0 test shows the backup, the counts above; production is unchanged."
}

cmd_prod() {
  local base="$1" date="${2:-}" yes="${3:-}" kind prodc apps
  IFS='|' read -r kind prodc apps <<<"$(info "$base")" || die "unknown base: $base (one of: $BASES)"
  prodc="${RESTORE_TARGET:-$prodc}"
  apps="${RESTORE_APPS-$apps}"
  docker ps --format '{{.Names}}' | grep -qx "$prodc" || die "$prodc is not running"
  fetch "$base" "$date"

  echo
  echo "  This REPLACES the production data of $base ($prodc) with $(cat "$WORK/key")."
  echo "  Stopped meanwhile: $apps"
  if [ "$yes" != "--yes" ]; then
    read -r -p "  Type the base name to continue ($base): " answer
    [ "$answer" = "$base" ] || die "cancelled"
  fi

  # The current state, kept so that this restore can itself be undone.
  local stamp safety
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  safety="pre-restore-$stamp.gz"
  say "Saving the current state to s3://$S3_BUCKET/$base/$safety"
  local dumped=0
  case "$kind" in
    postgres) docker exec "$prodc" sh -c 'pg_dumpall -U "${POSTGRES_USER:-postgres}"' 2>"$WORK/safety.err" | gzip -c >"$WORK/$safety" && dumped=1 ;;
    mongo)    docker exec "$prodc" sh -c 'mongodump --quiet --archive -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' 2>"$WORK/safety.err" | gzip -c >"$WORK/$safety" && dumped=1 ;;
    mysql)    docker exec "$prodc" sh -c 'mysqldump --all-databases --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD"' 2>"$WORK/safety.err" | gzip -c >"$WORK/$safety" && dumped=1 ;;
  esac
  # A failed dump still leaves a gzip header: check the command and the content.
  if [ "$dumped" != 1 ] || [ "$(gunzip -c "$WORK/$safety" | head -c 1024 | wc -c)" -lt 100 ]; then
    sed 's/^/   /' "$WORK/safety.err" | grep -v 'Using a password' | head -3
    die "could not save the current state; nothing was changed"
  fi
  s3 s3 cp "/work/$safety" "s3://$S3_BUCKET/$base/$safety" --only-show-errors || die "could not upload the current state; nothing was changed"

  local running=()
  for app in $apps; do
    docker ps --format '{{.Names}}' | grep -qx "$app" && running+=("$app")
  done
  if [ ${#running[@]} -gt 0 ]; then
    say "Stopping ${running[*]}"
    docker stop -t 60 "${running[@]}" >/dev/null
  fi

  say "Restoring into $prodc"
  case "$kind" in
    postgres)
      local user
      user=$(docker exec "$prodc" printenv POSTGRES_USER || true); user="${user:-postgres}"
      # The dump recreates its databases: drop them first (connections closed).
      for db in $(gunzip -c "$WORK/dump.gz" | grep -oE '^CREATE DATABASE "?[A-Za-z0-9_]+' | awk '{print $3}' | tr -d '"'); do
        [ "$db" = postgres ] && continue
        docker exec "$prodc" psql -U "$user" -d postgres -q -c "DROP DATABASE IF EXISTS \"$db\" WITH (FORCE)" || die "cannot drop $db"
      done
      load postgres "$prodc" "$user" ;;
    mongo)
      load mongo "$prodc" '-u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' ;;
    mysql)
      load mysql "$prodc" "$(docker exec "$prodc" printenv MYSQL_ROOT_PASSWORD)" ;;
  esac

  if [ ${#running[@]} -gt 0 ]; then
    say "Starting ${running[*]}"
    docker start "${running[@]}" >/dev/null
  fi

  say "Production now holds:"
  case "$kind" in
    postgres) summary postgres "$prodc" "${user:-postgres}" | sed 's/^/   /' ;;
    mongo)    summary mongo "$prodc" "$(docker exec "$prodc" printenv MONGO_INITDB_ROOT_USERNAME)" "$(docker exec "$prodc" printenv MONGO_INITDB_ROOT_PASSWORD)" | sed 's/^/   /' ;;
    mysql)    summary mysql "$prodc" root "$(docker exec "$prodc" printenv MYSQL_ROOT_PASSWORD)" | sed 's/^/   /' ;;
  esac
  if [ "${LOAD_ERRORS:-0}" -gt 0 ]; then
    say "WARNING: restored with $LOAD_ERRORS error(s) (above). Check the applications; to undo: $0 prod $base $safety"
    exit 2
  fi
  say "Done. To undo: $0 prod $base $safety"
}

case "${1:-}" in
  list) cmd_list "${2:-}" ;;
  test) [ -n "${2:-}" ] || die "usage: $0 test <base> [YYYY-MM-DD]"; cmd_test "$2" "${3:-}" ;;
  prod) [ -n "${2:-}" ] || die "usage: $0 prod <base> [YYYY-MM-DD] [--yes]"
        d="${3:-}"; y="${4:-}"; [ "$d" = --yes ] && { y=--yes; d=""; }
        cmd_prod "$2" "$d" "$y" ;;
  *) sed -n '3,28p' "$0"; exit 1 ;;
esac
