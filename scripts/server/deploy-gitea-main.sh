#!/usr/bin/env bash
set -euo pipefail

REMOTE_URL="${TOS_GITEA_REMOTE_URL:-http://172.16.48.208:3001/luenthai-ai/TOS.git}"
REMOTE_NAME="${TOS_REMOTE_NAME:-origin}"
BRANCH="${TOS_DEPLOY_BRANCH:-main}"
SOURCE_DIR="${TOS_SOURCE_DIR:-$HOME/TOS-source}"
DEPLOY_ROOT="${TOS_DEPLOY_ROOT:-$HOME/TOS}"
DEPLOY_ID="${TOS_DEPLOY_ID:-$(date +%Y%m%d%H%M%S)}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command git
require_command npm
require_command tar
require_command sudo
require_command curl

if [ -d "$DEPLOY_ROOT/.git" ]; then
  echo "Refusing to deploy: DEPLOY_ROOT must stay a deployment directory, not a Git repository: $DEPLOY_ROOT" >&2
  exit 1
fi

if [ ! -f "$DEPLOY_ROOT/docker-compose.tos.yml" ]; then
  echo "Missing deployment compose file: $DEPLOY_ROOT/docker-compose.tos.yml" >&2
  exit 1
fi

if [ ! -d "$SOURCE_DIR/.git" ]; then
  if [ -e "$SOURCE_DIR" ] && [ "$(find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 | wc -l)" -gt 0 ]; then
    echo "Source directory exists but is not a Git repository: $SOURCE_DIR" >&2
    exit 1
  fi

  log "Cloning $REMOTE_URL#$BRANCH into $SOURCE_DIR"
  mkdir -p "$(dirname "$SOURCE_DIR")"
  git clone --branch "$BRANCH" "$REMOTE_URL" "$SOURCE_DIR"
fi

cd "$SOURCE_DIR"

log "Syncing source checkout from $REMOTE_NAME/$BRANCH"
if git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  git remote set-url "$REMOTE_NAME" "$REMOTE_URL"
else
  git remote add "$REMOTE_NAME" "$REMOTE_URL"
fi

git fetch "$REMOTE_NAME" "$BRANCH"
git checkout "$BRANCH"
git reset --hard "$REMOTE_NAME/$BRANCH"
git clean -fd

if [ "${TOS_SKIP_INSTALL:-0}" != "1" ]; then
  log "Installing repository dependencies"
  npm run ci:install
else
  log "Skipping dependency install because TOS_SKIP_INSTALL=1"
fi

log "Running pre-deploy checks"
npm run test:server-package
npm --prefix tms-frontend run typecheck
npm --prefix tms-frontend run test
(
  cd tms-backend
  ${PYTHON:-python3} -m unittest discover tests/ -v
)
npm run server:package:dry-run

log "Creating standard server update package"
npm run server:package

ARCHIVE_PATH="$(ls -t "$SOURCE_DIR"/release/server/tos-server-update-*.tar.gz | head -n 1)"
PACKAGE_NAME="$(basename "$ARCHIVE_PATH")"
TARGET_PKG="$DEPLOY_ROOT/.deploy_uploads/$PACKAGE_NAME"

log "Copying $PACKAGE_NAME to deployment uploads"
mkdir -p "$DEPLOY_ROOT/.deploy_uploads"
cp -f "$ARCHIVE_PATH" "$TARGET_PKG"

cd "$DEPLOY_ROOT"
WORK="$DEPLOY_ROOT/.deploy_uploads/work/$DEPLOY_ID"

log "Applying server update with deployId=$DEPLOY_ID"
rm -rf "$WORK"
mkdir -p "$WORK"
tar -xzf "$TARGET_PKG" -C "$WORK"

PKG="$TARGET_PKG" DEPLOY_ID="$DEPLOY_ID" TOS_ROOT="$DEPLOY_ROOT" bash "$WORK/deploy/apply-server-update.sh"

log "Verifying deployed services"
sudo docker compose -f docker-compose.tos.yml ps
curl -fsS http://127.0.0.1:18000/
curl -fsSI http://127.0.0.1:18080/

log "Deployed $PACKAGE_NAME from $REMOTE_NAME/$BRANCH"
