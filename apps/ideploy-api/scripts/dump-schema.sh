#!/usr/bin/env bash
#
# Refresh `tests/schema.sql` from the live dev database.
#
# The schema is owned by the Laravel app (343 migrations). Rather than
# reimplement it, we snapshot it and commit the snapshot: integration tests then
# run against the real structure anywhere — including CI, which has no Laravel.
#
# Committing it also makes schema drift reviewable: when Laravel adds a column,
# it shows up as a diff in a pull request instead of as a mysterious test
# failure weeks later.
#
# Run from the repository root, with the dev stack up, after Laravel migrations:
#   ./apps/ideploy-api/scripts/dump-schema.sh
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
ENV_FILE="${ENV_FILE:-.env.dev}"
PG_SERVICE="${PG_SERVICE:-postgres}"
SRC_DB="${IDEPLOY_DB_DATABASE:-coolify}"
DB_USER="${IDEPLOY_DB_USERNAME:-coolify}"
OUT="apps/ideploy-api/tests/schema.sql"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Run this from the repository root (no $COMPOSE_FILE here)." >&2
  exit 1
fi

echo "→ Dumping the structure of $SRC_DB to $OUT"

# `\restrict`/`\unrestrict` are psql client directives emitted by patched
# pg_dump builds. They carry no schema and break older psql clients, so drop
# them to keep the snapshot portable across CI images.
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$PG_SERVICE" \
  pg_dump -U "$DB_USER" --schema-only --no-owner --no-privileges "$SRC_DB" \
  | sed '/^\\restrict /d; /^\\unrestrict /d' \
  > "$OUT"

echo "✓ $(grep -c 'CREATE TABLE' "$OUT") tables, $(wc -l < "$OUT") lines"
echo "  Review the diff before committing — it is the record of Laravel's schema changes."
