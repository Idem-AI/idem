#!/bin/bash
# Runs DB provisioning, then migrations, then the server — in that order, in
# one shell so the environment (secrets, DATABASE_URL) reaches every step.
# `npm run a && npm run b` would not share it: each `npm run` is its own child
# process.
#
# The whole chain runs under scripts/with-secrets.js, which loads the secrets
# from Infisical and builds DATABASE_URL (node-pg-migrate and Prisma only read
# that one). Without it, provisioning and migrations connect to the database
# before dist/index.js has loaded any secret, and fail to authenticate.
set -e

if [ -z "$IDEPLOY_SECRETS_LOADED" ]; then
  export IDEPLOY_SECRETS_LOADED=1
  exec node scripts/with-secrets.js bash "$0"
fi

node scripts/provision-db.js
npm run migrate:up
exec node dist/index.js
