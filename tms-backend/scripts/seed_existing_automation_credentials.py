from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from utils.credential_crypto import encrypt_secret
from utils.mysql_store import ensure_schema, upsert_automation_credentials


INFOR_NEXUS_AUTOMATION_IDS = [
    "shipping-automation",
    "xinlongtai-shipping-automation",
    "shipping-automation-2",
    "infornexus-auto-add",
    "tc-inv-automation",
    "xo-tc-inv-automation",
    "po-auto-download",
]
MICROSOFT_AUTOMATION_IDS = [
    "microsoft-login-n8n",
    "ticket-owner-statistics",
]

LEGACY_SECRET_CANDIDATES = [
    PROJECT_ROOT / "tms-electron-app" / "automation-apps" / "shipping-automation-demo" / "executor.secret.local.json",
    PROJECT_ROOT / "tms-electron-app" / "dist" / "win-unpacked" / "resources" / "automation-apps" / "shipping-automation-demo" / "executor.secret.local.json",
]
MICROSOFT_LEGACY_SECRET_CANDIDATES = [
    PROJECT_ROOT / "tms-electron-app" / "automation-apps" / "microsoft-login-n8n-demo" / "executor.secret.local.json",
    PROJECT_ROOT / "tms-electron-app" / "dist" / "win-unpacked" / "resources" / "automation-apps" / "microsoft-login-n8n-demo" / "executor.secret.local.json",
    Path(os.environ.get("APPDATA", "")) / "tms-integration-tool" / "automation-apps" / "microsoft-login-n8n-demo" / "executor.secret.local.json",
]


def main() -> None:
    credential_groups = [
        {
            "name": "Infor Nexus",
            "automation_ids": INFOR_NEXUS_AUTOMATION_IDS,
            "credentials": load_infor_nexus_credentials(),
        },
        {
            "name": "Microsoft / SAP BTP",
            "automation_ids": MICROSOFT_AUTOMATION_IDS,
            "credentials": load_microsoft_credentials(),
        },
    ]
    available_groups = [group for group in credential_groups if group["credentials"]]
    if not available_groups:
        raise SystemExit(
            "No existing automation login account was found. "
            "Set TOS_INFORNEXUS_USERNAME/TOS_INFORNEXUS_PASSWORD or "
            "TOS_MICROSOFT_USERNAME/TOS_MICROSOFT_PASSWORD, "
            "or keep the legacy executor.secret.local.json files in place, then run this script again."
        )

    ensure_schema()
    updated = []
    sources = {}
    for group in available_groups:
        credentials = group["credentials"]
        sources[group["name"]] = credentials["source"]
        for automation_id in group["automation_ids"]:
            row = upsert_automation_credentials(
                automation_id,
                "default",
                credentials["username"],
                encrypt_secret(credentials["password"]),
            )
            updated.append({
                "automationId": row["automation_id"],
                "accountKey": row["account_key"],
                "username": row["username"],
                "hasPassword": bool(row["password_ciphertext"]),
            })

    print(json.dumps({
        "ok": True,
        "sources": sources,
        "updated": updated,
    }, ensure_ascii=False, indent=2))


def load_infor_nexus_credentials() -> dict[str, str] | None:
    return load_credentials_from_env_or_paths(
        username_env="TOS_INFORNEXUS_USERNAME",
        password_env="TOS_INFORNEXUS_PASSWORD",
        paths=LEGACY_SECRET_CANDIDATES,
    )


def load_microsoft_credentials() -> dict[str, str] | None:
    return load_credentials_from_env_or_paths(
        username_env="TOS_MICROSOFT_USERNAME",
        password_env="TOS_MICROSOFT_PASSWORD",
        paths=MICROSOFT_LEGACY_SECRET_CANDIDATES,
    )


def load_credentials_from_env_or_paths(
    *,
    username_env: str,
    password_env: str,
    paths: list[Path],
) -> dict[str, str] | None:
    env_username = os.environ.get(username_env, "").strip()
    env_password = os.environ.get(password_env, "")
    if env_username and env_password:
        return {
            "source": "environment",
            "username": env_username,
            "password": env_password,
        }

    for path in paths:
        payload = read_legacy_secret(path)
        if payload:
            return payload
    return None


def read_legacy_secret(path: Path) -> dict[str, str] | None:
    if not path.exists():
        return None

    with path.open("r", encoding="utf-8") as file:
        payload: Any = json.load(file)

    if not isinstance(payload, dict):
        return None

    username = str(payload.get("username") or payload.get("userId") or "").strip()
    password = str(payload.get("password") or "")
    if not username or not password:
        return None

    return {
        "source": format_source_path(path),
        "username": username,
        "password": password,
    }


def format_source_path(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


if __name__ == "__main__":
    main()
