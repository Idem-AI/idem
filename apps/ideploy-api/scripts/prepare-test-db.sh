#!/usr/bin/env bash
#
# Create (or recreate) the integration-test database from the committed schema
# snapshot in `tests/schema.sql`.
#
# Works in two environments:
#   • dev  — talks to the `postgres` service of the dev compose stack (default)
#   • CI   — set DIRECT_PSQL=1 to use a psql already on PATH (service container)
#
# Refresh the snapshot with `scripts/dump-schema.sh` after Laravel migrations.
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
ENV_FILE="${ENV_FILE:-.env.dev}"
PG_SERVICE="${PG_SERVICE:-postgres}"

TEST_DB="${TEST_DB_DATABASE:-coolify_test}"
DB_USER="${IDEPLOY_DB_USERNAME:-coolify}"
DIRECT_PSQL="${DIRECT_PSQL:-0}"

# Locate the snapshot relative to this script, so the caller's cwd does not matter.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMA_FILE="${SCHEMA_FILE:-$SCRIPT_DIR/../tests/schema.sql}"

case "$TEST_DB" in
  *_test) ;;
  *)
    echo "Refusing to use '$TEST_DB' as a test database: the name must end with '_test'." >&2
    exit 1
    ;;
esac

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "Schema snapshot not found at $SCHEMA_FILE — run scripts/dump-schema.sh first." >&2
  exit 1
fi

# One indirection so the rest of the script is environment-agnostic.
if [ "$DIRECT_PSQL" = "1" ]; then
  psql_do() { psql -U "$DB_USER" -v ON_ERROR_STOP=1 "$@"; }
else
  if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Run this from the repository root, or set DIRECT_PSQL=1." >&2
    exit 1
  fi
  psql_do() {
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$PG_SERVICE" \
      psql -U "$DB_USER" -v ON_ERROR_STOP=1 "$@"
  }
fi

echo "→ Recreating $TEST_DB from $(basename "$SCHEMA_FILE")"

psql_do -d postgres <<SQL
DROP DATABASE IF EXISTS ${TEST_DB};
CREATE DATABASE ${TEST_DB} OWNER ${DB_USER};
SQL

psql_do -d "$TEST_DB" -q < "$SCHEMA_FILE" > /dev/null

TABLES=$(psql_do -d "$TEST_DB" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'" | tr -d '[:space:]')
echo "✓ $TEST_DB ready — $TABLES tables"
