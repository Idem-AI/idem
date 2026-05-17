#!/usr/bin/env bash
#
# Purge leaked .env files (and other sensitive paths) from the ENTIRE git
# history. Uses git-filter-repo (recommended by GitHub).
#
# Prerequisites:
#   - git-filter-repo: `brew install git-filter-repo`
#   - A FRESH backup clone of the repo (this rewrites all SHAs).
#   - Every collaborator must re-clone after the push --force.
#
# Usage (from monorepo root):
#   ./apps/api/scripts/purge-env-from-history.sh
#
# After running, you MUST also:
#   1. git push --force --all && git push --force --tags
#   2. Rotate every leaked credential (you should consider them compromised
#      forever, history rewrite is not enough).
#   3. Invalidate caches on GitHub/GitLab (contact support if needed - some
#      providers keep old refs reachable for a while).

set -euo pipefail

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "ERROR: git-filter-repo is required. Install with: brew install git-filter-repo" >&2
  exit 1
fi

# Refuse to run on a dirty tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is dirty. Commit or stash first." >&2
  exit 1
fi

echo "About to rewrite history to remove sensitive files."
echo "This is DESTRUCTIVE. Make sure you have a backup clone."
read -r -p "Type 'rewrite' to continue: " ans
[[ "$ans" == "rewrite" ]] || { echo "Aborted."; exit 0; }

# Paths to strip everywhere they appear
PATHS=(
  ".env"
  ".env.*"
  "apps/api/.env"
  "apps/api/.env.*"
  "apps/api/firebase-admin.json"
  "**/firebase-admin.json"
  "**/serviceAccount.json"
  "**/serviceAccountKey.json"
)

ARGS=()
for p in "${PATHS[@]}"; do
  ARGS+=("--path-glob" "$p")
done

git filter-repo --invert-paths "${ARGS[@]}" --force

echo
echo "History rewritten. Next steps:"
echo "  git remote add origin <your-remote-url>   # filter-repo strips remotes"
echo "  git push --force --all"
echo "  git push --force --tags"
echo
echo "Then ROTATE EVERY CREDENTIAL that ever lived in those files."
