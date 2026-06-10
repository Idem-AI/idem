#!/usr/bin/env bash
#
# Upload every variable from .env.secret to Google Secret Manager.
#
# Usage:
#   GCP_PROJECT_ID=my-project ./scripts/upload-secrets.sh [ENV_FILE] [SECRET_PREFIX]
#
# Defaults:
#   ENV_FILE      → .env.secret  (only secrets, no infra config)
#   SECRET_PREFIX → value of SECRET_PREFIX in the env file, or empty
#
# Requirements:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Secret Manager API enabled on the target project
#   - Caller must hold roles/secretmanager.admin on the project
#
# Behaviour:
#   - Reads ONLY from .env.secret (secrets flagged for Secret Manager).
#   - Creates the secret if it does not exist.
#   - Adds a new VERSION on every run (rotation friendly).
#   - Empty values and placeholder values (your-*, change-in-production) are skipped.
#   - Lines starting with # and blank lines are ignored.

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve arguments
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="${1:-${REPO_ROOT}/.env.secret}"
PROJECT="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"

# If no prefix passed as arg, try to read SECRET_PREFIX from the env file itself
if [[ $# -ge 2 ]]; then
  PREFIX="$2"
else
  # Extract SECRET_PREFIX from .env.secret (or .env as fallback)
  PREFIX=""
  for candidate in "$ENV_FILE" "${REPO_ROOT}/.env"; do
    if [[ -f "$candidate" ]]; then
      extracted=$(grep -E '^SECRET_PREFIX=' "$candidate" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'") || true
      if [[ -n "$extracted" ]]; then
        PREFIX="$extracted"
        break
      fi
    fi
  done
fi

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
if [[ -z "$PROJECT" ]]; then
  # Try to extract from .env
  for candidate in "$ENV_FILE" "${REPO_ROOT}/.env"; do
    if [[ -f "$candidate" ]]; then
      extracted=$(grep -E '^GCP_PROJECT_ID=' "$candidate" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'") || true
      if [[ -n "$extracted" ]]; then
        PROJECT="$extracted"
        break
      fi
    fi
  done
fi

if [[ -z "$PROJECT" ]]; then
  echo "ERROR: GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) env var required." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: secrets file not found: $ENV_FILE" >&2
  echo "       Create it or pass the path as first argument." >&2
  exit 1
fi

echo "=============================================="
echo " Google Secret Manager — Upload Secrets"
echo "=============================================="
echo "Project   : $PROJECT"
echo "Env file  : $ENV_FILE"
echo "Prefix    : ${PREFIX:-<none>}"
echo ""

# Confirm.
read -r -p "Upload all secrets from this file to Secret Manager? [y/N] " ans
[[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
echo ""

CREATED=0
UPDATED=0
SKIPPED=0

# ---------------------------------------------------------------------------
# Read env file line by line preserving multi-line values via shell.
# ---------------------------------------------------------------------------
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

  # Skip placeholders / empty
  if [[ -z "$value" || "$value" == your-* || "$value" == *change-in-production* || "$value" == \$\{*\} ]]; then
    echo "  skip   $key (placeholder/empty)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  secret_name="${PREFIX}${key}"

  # Create secret if missing
  if ! gcloud secrets describe "$secret_name" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" \
      --project="$PROJECT" \
      --replication-policy="automatic" >/dev/null
    echo "  create $secret_name"
    CREATED=$((CREATED + 1))
  else
    UPDATED=$((UPDATED + 1))
  fi

  # Add a new version
  printf '%s' "$value" | gcloud secrets versions add "$secret_name" \
    --project="$PROJECT" \
    --data-file=- >/dev/null
  echo "  push   $secret_name ✓"

done < "$ENV_FILE"

echo ""
echo "=============================================="
echo " Summary"
echo "=============================================="
echo "  Created : $CREATED"
echo "  Updated : $UPDATED"
echo "  Skipped : $SKIPPED"
echo ""
echo "Grant the runtime service account secretmanager.secretAccessor:"
echo "  gcloud projects add-iam-policy-binding $PROJECT \\"
echo "    --member='serviceAccount:RUNTIME_SA@$PROJECT.iam.gserviceaccount.com' \\"
echo "    --role='roles/secretmanager.secretAccessor'"
