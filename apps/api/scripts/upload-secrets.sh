#!/usr/bin/env bash
#
# Upload every variable from a local .env file to Google Secret Manager.
#
# Usage:
#   GCP_PROJECT_ID=my-project ./scripts/upload-secrets.sh .env [SECRET_PREFIX]
#
# Requirements:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Secret Manager API enabled on the target project
#   - Caller must hold roles/secretmanager.admin on the project
#
# Behaviour:
#   - Creates the secret if it does not exist.
#   - Adds a new VERSION on every run (rotation friendly).
#   - Empty values and placeholder values (your-*, change-in-production) are skipped.
#   - Lines starting with # and blank lines are ignored.

set -euo pipefail

ENV_FILE="${1:-.env}"
PREFIX="${2:-}"
PROJECT="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"

if [[ -z "$PROJECT" ]]; then
  echo "ERROR: GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) env var required." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  exit 1
fi

echo "Project   : $PROJECT"
echo "Env file  : $ENV_FILE"
echo "Prefix    : ${PREFIX:-<none>}"
echo

# Confirm.
read -r -p "Upload all secrets from this file to Secret Manager? [y/N] " ans
[[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# Read env file line by line preserving multi-line values via shell.
while IFS= read -r line || [[ -n "$line" ]]; do
  # Strip CR for Windows-style files
  line="${line%$'\r'}"
  # Skip comments / empty
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  # Must contain '='
  [[ "$line" != *=* ]] && continue

  key="${line%%=*}"
  value="${line#*=}"
  # Trim surrounding quotes (single or double) once
  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  # Skip placeholders
  if [[ -z "$value" || "$value" == your-* || "$value" == *change-in-production* ]]; then
    echo "skip   $key (placeholder/empty)"
    continue
  fi

  secret_name="${PREFIX}${key}"

  # Create secret if missing
  if ! gcloud secrets describe "$secret_name" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" \
      --project="$PROJECT" \
      --replication-policy="automatic" >/dev/null
    echo "create $secret_name"
  fi

  # Add a new version
  printf '%s' "$value" | gcloud secrets versions add "$secret_name" \
    --project="$PROJECT" \
    --data-file=- >/dev/null
  echo "push   $secret_name"
done < "$ENV_FILE"

echo
echo "Done. Grant the runtime service account secretmanager.secretAccessor:"
echo "  gcloud projects add-iam-policy-binding $PROJECT \\"
echo "    --member='serviceAccount:RUNTIME_SA@$PROJECT.iam.gserviceaccount.com' \\"
echo "    --role='roles/secretmanager.secretAccessor'"
