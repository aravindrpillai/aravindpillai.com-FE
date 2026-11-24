#!/usr/bin/env bash
#
# deploy.sh - pull, build and deploy aravindpillai.com (static Vite build served by Nginx)
# Usage: bash deploy.sh
#
# The .env / .env.production files are committed to the (private) repo, so `npm run build`
# picks up the live settings (VITE_API_BASE_URL=https://be.aravindpillai.com/arp/) on its own.

# Everything lives inside main(), which runs only after bash has read the whole file.
# That way a `git pull` that changes this script can't break the run in progress.
main() {
  set -euo pipefail

  # ---- Config ----
  APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  WEB_ROOT="/var/www/aravindpillai.com"
  BRANCH="main"
  DOMAIN="aravindpillai.com"
  API_HOST="be.aravindpillai.com"

  # ---- Helpers ----
  log()  { echo -e "\n\033[1;34m==> $*\033[0m"; }
  fail() { echo -e "\n\033[1;31m✖ $*\033[0m" >&2; exit 1; }
  trap 'fail "Deploy failed at line $LINENO"' ERR

  # Only one deploy at a time
  exec 9>/tmp/aravindpillai-fe-deploy.lock
  flock -n 9 || fail "Another deploy is already running."

  cd "$APP_DIR"

  log "Pre-flight checks"
  for cmd in git node npm rsync curl; do
    command -v "$cmd" >/dev/null || fail "'$cmd' is not installed (apt install -y $cmd)"
  done
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  (( NODE_MAJOR >= 18 )) || fail "Node $NODE_MAJOR is too old for Vite 5 — need Node 18+"
  echo "Node $(node -v), npm $(npm -v)"

  log "Pulling latest code ($BRANCH)"
  OLD_COMMIT=$(git rev-parse --short HEAD)
  git fetch --quiet origin "$BRANCH"
  # reset --hard (not pull --ff-only): a package-lock.json rewritten by npm on the server,
  # or any other local edit, can never block the deploy
  git checkout --quiet "$BRANCH"
  git reset --hard --quiet "origin/$BRANCH"
  NEW_COMMIT=$(git rev-parse --short HEAD)
  if [[ "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
    echo "Already up to date ($NEW_COMMIT)."
  else
    echo "Updated $OLD_COMMIT -> $NEW_COMMIT:"
    git --no-pager log --oneline -n 20 "$OLD_COMMIT..$NEW_COMMIT"
  fi

  [[ -f .env.production ]] || fail ".env.production is missing (is it committed to the repo?)"

  log "Installing dependencies"
  # --include=dev: the build needs devDependencies (vite, plugins) even if NODE_ENV=production
  if ! npm ci --include=dev --no-audit --no-fund; then
    echo "npm ci failed (package-lock.json out of sync?) — falling back to npm install"
    npm install --include=dev --no-audit --no-fund
    git checkout -- package-lock.json 2>/dev/null || true   # keep the tree clean
  fi

  log "Building"
  rm -rf dist
  npm run build
  [[ -f dist/index.html ]] || fail "Build output missing (dist/index.html not found)"
  grep -rqs "$API_HOST" dist/assets \
    || fail "Build does not point at $API_HOST — check VITE_API_BASE_URL in .env.production"

  log "Deploying to $WEB_ROOT"
  mkdir -p "$WEB_ROOT"
  # --delay-updates + --delete-after: new files appear together and old ones go last,
  # so visitors mid-deploy don't get a half-copied site
  rsync -a --delay-updates --delete-after dist/ "$WEB_ROOT/"
  chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true
  chmod -R a+rX "$WEB_ROOT"

  log "Checking https://$DOMAIN"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
           --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" || true)
  if [[ "$CODE" == "200" ]]; then
    echo "HTTP $CODE"
  else
    echo -e "\033[1;33m! https://$DOMAIN answered HTTP $CODE — files are deployed, check nginx (nginx -t; systemctl status nginx)\033[0m"
  fi

  echo -e "\n\033[1;32m✔ Deployed $NEW_COMMIT successfully at $(date '+%Y-%m-%d %H:%M:%S')\033[0m"
}

main "$@"
