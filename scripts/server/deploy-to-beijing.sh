#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"

REMOTE_HOST="${TOS_BEIJING_REMOTE_HOST:-${TOS_REMOTE_HOST:-tosadmin@218.240.184.58}}"
REMOTE_DEPLOY_ROOT="${TOS_BEIJING_DEPLOY_ROOT:-${TOS_REMOTE_DEPLOY_ROOT:-/home/tosadmin/TOS}}"
REMOTE_NAME="${TOS_REMOTE_NAME:-gitea}"
BRANCH="${TOS_DEPLOY_BRANCH:-main}"
REMOTE_LOCAL_FRONTEND_URL="${TOS_REMOTE_LOCAL_FRONTEND_URL:-http://127.0.0.1/tos/}"
REMOTE_LOCAL_HEALTH_URL="${TOS_REMOTE_LOCAL_HEALTH_URL:-http://127.0.0.1/tos/desktop-api/health}"
REMOTE_PUBLIC_URL="${TOS_REMOTE_PUBLIC_URL:-}"

SSH_OPTIONS=(-o ServerAliveInterval=30 -o ServerAliveCountMax=6)
SCP_OPTIONS=()
if [ -n "${TOS_SSH_PORT:-}" ]; then
  SSH_OPTIONS+=(-p "$TOS_SSH_PORT")
  SCP_OPTIONS+=(-P "$TOS_SSH_PORT")
fi

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

find_latest_package() {
  find "$REPO_ROOT/release/server" -maxdepth 1 -type f -name 'tos-server-update-*.tar.gz' -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr \
    | sed -n '1s/^[^ ]* //p'
}

require_command git
require_command npm
require_command ssh
require_command scp

cd "$REPO_ROOT"

if [ ! -d .git ]; then
  echo "Refusing to deploy: script must run inside a Git checkout: $REPO_ROOT" >&2
  exit 1
fi

if [ "${TOS_PULL:-0}" = "1" ]; then
  log "Updating local checkout from $REMOTE_NAME/$BRANCH"
  SOURCE_STATUS="$(git status --short)"
  if [ -n "$SOURCE_STATUS" ]; then
    echo "Refusing to pull: local checkout must be clean" >&2
    git status --short >&2
    exit 1
  fi
  git pull --ff-only "$REMOTE_NAME" "$BRANCH"
else
  log "Skipping git pull because TOS_PULL!=1"
fi

if [ "${TOS_RUN_CHANGED_CHECKS:-0}" = "1" ]; then
  log "Running changed checks because TOS_RUN_CHANGED_CHECKS=1"
  npm run check:changed
else
  log "Skipping changed checks because TOS_RUN_CHANGED_CHECKS!=1"
fi

if [ "${TOS_SKIP_PACKAGE_CHECKS:-0}" != "1" ]; then
  log "Running server package checks"
  npm run test:server-package
  npm run server:package:dry-run
else
  log "Skipping server package checks because TOS_SKIP_PACKAGE_CHECKS=1"
fi

if [ "${TOS_SKIP_PACKAGE:-0}" != "1" ]; then
  log "Creating standard server package"
  npm run server:package
else
  log "Skipping package creation because TOS_SKIP_PACKAGE=1"
fi

ARCHIVE_PATH="$(find_latest_package)"
if [ -z "$ARCHIVE_PATH" ]; then
  echo "No server update package found under $REPO_ROOT/release/server" >&2
  exit 1
fi

PACKAGE_NAME="$(basename "$ARCHIVE_PATH")"
REMOTE_PACKAGE_PATH=".deploy_uploads/$PACKAGE_NAME"

log "Preparing remote deploy root on $REMOTE_HOST:$REMOTE_DEPLOY_ROOT"
ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" bash -s -- "$REMOTE_DEPLOY_ROOT" <<'REMOTE_PREPARE'
set -euo pipefail
deploy_root="$1"

if [ -d "$deploy_root/.git" ]; then
  echo "Refusing to deploy: remote deploy root must not be a Git repository: $deploy_root" >&2
  exit 1
fi

if [ ! -f "$deploy_root/docker-compose.tos.yml" ]; then
  echo "Missing remote deployment compose file: $deploy_root/docker-compose.tos.yml" >&2
  exit 1
fi

mkdir -p "$deploy_root/.deploy_uploads"
REMOTE_PREPARE

log "Uploading $PACKAGE_NAME"
scp "${SCP_OPTIONS[@]}" "$ARCHIVE_PATH" "$REMOTE_HOST:$REMOTE_DEPLOY_ROOT/.deploy_uploads/"

log "Applying package on Beijing server"
ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" bash -s -- \
  "$REMOTE_DEPLOY_ROOT" \
  "$REMOTE_PACKAGE_PATH" \
  "$REMOTE_LOCAL_FRONTEND_URL" \
  "$REMOTE_LOCAL_HEALTH_URL" \
  "$REMOTE_PUBLIC_URL" <<'REMOTE_APPLY'
set -euo pipefail
deploy_root="$1"
package_path="$2"
local_frontend_url="$3"
local_health_url="$4"
public_url="$5"

cd "$deploy_root"

test -f "$package_path" || {
  echo "Missing uploaded package: $deploy_root/$package_path" >&2
  exit 1
}

deploy_id="${TOS_DEPLOY_ID:-$(date +%Y%m%d%H%M%S)}"
work=".deploy_uploads/work/$deploy_id"

rm -rf "$work"
mkdir -p "$work"
tar -xzf "$package_path" -C "$work"

PKG="$deploy_root/$package_path" DEPLOY_ID="$deploy_id" TOS_ROOT="$deploy_root" \
  bash "$work/deploy/apply-server-update.sh"

curl -fsSI "$local_frontend_url" >/dev/null
curl -fsS "$local_health_url" >/dev/null

if [ -n "$public_url" ]; then
  if ! curl -fsSI "$public_url" >/dev/null; then
    echo "Warning: public URL verification failed from remote server: $public_url" >&2
  fi
fi

echo "Remote deploy succeeded with deployId=$deploy_id"
REMOTE_APPLY

log "Deployed $PACKAGE_NAME to $REMOTE_HOST"
