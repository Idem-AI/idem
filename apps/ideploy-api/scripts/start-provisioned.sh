#!/bin/bash
# Runs DB provisioning, then migrations, then the server — in that order,
# in one shell so an env var set here (DATABASE_URL, below) actually reaches
# every step. `npm run a && npm run b` would not: each `npm run` is its own
# child process, so anything exported inside one is gone before the next
# starts. That's the gap that broke this in production the first time —
# provision-db.js got fixed to fall back to IDEPLOY_DB_*, but migrate:up
# (node-pg-migrate) and Prisma only ever read DATABASE_URL (see
# migrations/README.md) and nothing had ever set it there, because nothing
# in the automatic startup path needed it before this script existed.
set -e

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://${IDEPLOY_DB_USERNAME:-ideploy}:${IDEPLOY_DB_PASSWORD:-password}@${IDEPLOY_DB_HOST:-localhost}:${IDEPLOY_DB_PORT:-5432}/${IDEPLOY_DB_DATABASE:-ideploy}?schema=public"
fi

node scripts/provision-db.js
npm run migrate:up
exec node dist/index.js
