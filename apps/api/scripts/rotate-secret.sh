#!/usr/bin/env bash
#
# Rotate (add a new version of) a single secret in Google Secret Manager.
#
# Usage:
#   GCP_PROJECT_ID=my-project ./scripts/rotate-secret.sh SECRET_NAME
#
# The new value is read from STDIN (so it never appears in shell history or
# process listings). Example:
#   pbpaste | GCP_PROJECT_ID=my-project ./scripts/rotate-secret.sh GEMINI_API_KEY
#
# After a successful rotation, previous versions are DISABLED (not destroyed)
# so you can roll back within 24h if something breaks.


set -euo pipefail

NAME="${1:-}"
PROJECT="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
PREFIX="${SECRET_PREFIX:-}"

if [[ -z "$NAME" || -z "$PROJECT" ]]; then
  echo "Usage: GCP_PROJECT_ID=<project> $0 <SECRET_NAME>" >&2
  exit 1
fi

SECRET="${PREFIX}${NAME}"

if [[ -t 0 ]]; then
  echo "Paste the new value, then press Ctrl-D:" >&2
fi

NEW_VALUE="$(cat)"
if [[ -z "$NEW_VALUE" ]]; then
  echo "ERROR: empty value, aborting." >&2
  exit 1
fi

# Ensure secret exists
if ! gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud secrets create "$SECRET" --project="$PROJECT" --replication-policy="automatic"
fi

# Add new version, capturing its id
NEW_VERSION=$(printf '%s' "$NEW_VALUE" | gcloud secrets versions add "$SECRET" \
  --project="$PROJECT" --data-file=- --format='value(name)')
echo "Added new version: $NEW_VERSION"

# Disable older enabled versions (keep them for rollback)
for v in $(gcloud secrets versions list "$SECRET" --project="$PROJECT" \
            --filter="state=ENABLED" --format='value(name)'); do
  if [[ "$v" != "$NEW_VERSION" && "$v" != *"/$NEW_VERSION" ]]; then
    gcloud secrets versions disable "$v" --secret="$SECRET" --project="$PROJECT" --quiet || true
    echo "Disabled previous version: $v"
  fi
done

echo "Done. Restart the API runtime (or wait for cache TTL) to pick up the new value."
