#!/usr/bin/env bash
set -euo pipefail

ROOT="${TOS_ROOT:-$(pwd)}"
cd "$ROOT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SRC="$(cd "$SCRIPT_DIR/.." && pwd -P)"
MANIFEST="$SRC/deploy/manifest.json"
DEPLOY_ID="${DEPLOY_ID:-$(date +%Y%m%d%H%M%S)}"

test -f "$MANIFEST" || { echo "Missing manifest: $MANIFEST"; exit 1; }
test -d "$SRC/tms-backend" || { echo "Missing backend source in package"; exit 1; }
test -d "$SRC/tms-frontend" || { echo "Missing frontend source in package"; exit 1; }

VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$MANIFEST" | head -n 1)"
test -n "$VERSION" || { echo "Missing version in manifest"; exit 1; }

mkdir -p backups .deploy_uploads/applied

cp -a tms-backend "backups/tms-backend.$DEPLOY_ID"
cp -a tms-frontend "backups/tms-frontend.$DEPLOY_ID"
if [ -f app-version.json ]; then
  cp -a app-version.json "backups/app-version.$DEPLOY_ID.json"
fi

rm -rf tms-backend/api tms-backend/data tms-backend/modules tms-backend/templates tms-backend/utils
cp -a "$SRC/tms-backend/api" tms-backend/
cp -a "$SRC/tms-backend/data" tms-backend/
cp -a "$SRC/tms-backend/modules" tms-backend/
cp -a "$SRC/tms-backend/templates" tms-backend/
cp -a "$SRC/tms-backend/utils" tms-backend/
cp -a "$SRC/tms-backend/app_version.py" tms-backend/
cp -a "$SRC/tms-backend/main.py" tms-backend/
cp -a "$SRC/tms-backend/backend_launcher.py" tms-backend/
cp -a "$SRC/tms-backend/requirements.txt" tms-backend/

rm -rf tms-frontend/src tms-frontend/dist
cp -a "$SRC/tms-frontend/src" tms-frontend/
cp -a "$SRC/tms-frontend/dist" tms-frontend/
cp -a "$SRC/tms-frontend/index.html" tms-frontend/
cp -a "$SRC/tms-frontend/package.json" tms-frontend/
cp -a "$SRC/tms-frontend/package-lock.json" tms-frontend/
cp -a "$SRC/tms-frontend/tsconfig.json" tms-frontend/
cp -a "$SRC/tms-frontend/tsconfig.node.json" tms-frontend/
cp -a "$SRC/tms-frontend/vite.config.ts" tms-frontend/
cp -a "$SRC/app-version.json" ./

sudo docker compose -f docker-compose.tos.yml build --no-cache tos-backend tos-frontend
sudo docker compose -f docker-compose.tos.yml up -d tos-backend tos-frontend
sudo docker compose -f docker-compose.tos.yml ps

curl -fsS http://127.0.0.1:18000/
curl -fsSI http://127.0.0.1:18080/

sync_release_update_record() {
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Warning: python3 not found; skipped release update record sync" >&2
    return 0
  fi

  local payload
  if ! payload="$(python3 - "$MANIFEST" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    manifest = json.load(handle)

record = manifest.get("releaseUpdateRecord")
if not isinstance(record, dict) or not record.get("recordKey"):
    raise SystemExit(2)

print(json.dumps(record, ensure_ascii=False))
PY
)"; then
    echo "Warning: failed to sync release update record" >&2
    return 0
  fi

  if ! curl -fsS -X POST http://127.0.0.1:18000/api/release-updates -H 'Content-Type: application/json' --data-binary "$payload" >/dev/null; then
    echo "Warning: failed to sync release update record" >&2
  fi
}

sync_release_update_record

if [ -n "${PKG:-}" ] && [ -f "$PKG" ]; then
  mv "$PKG" ".deploy_uploads/applied/"
fi

echo "Applied TOS server update $VERSION with deployId=$DEPLOY_ID"
