from __future__ import annotations

import copy
import json
from datetime import datetime
from typing import Any

from app_version import APP_VERSION
from utils.minio_storage import get_minio_bucket, get_object_response, put_object_bytes


INSTALLER_MANIFEST_OBJECT_KEY = "installers/manifest.json"
INSTALLER_MANIFEST_CONTENT_TYPE = "application/json; charset=utf-8"


def read_installer_manifest() -> dict[str, Any]:
    bucket = get_minio_bucket("downloads")

    try:
        response = get_object_response(bucket, INSTALLER_MANIFEST_OBJECT_KEY)
    except Exception:
        return _empty_manifest()

    try:
        content = b"".join(response.stream(64 * 1024))
    finally:
        response.close()

    try:
        payload = json.loads(content.decode("utf-8"))
    except Exception:
        return _empty_manifest()

    if not isinstance(payload, dict):
        return _empty_manifest()

    manifest = copy.deepcopy(payload)
    manifest["packages"] = _normalize_packages(manifest.get("packages"))
    return manifest


def update_installer_manifest(entries: dict[str, dict[str, Any]]) -> dict[str, Any]:
    bucket = get_minio_bucket("downloads")
    manifest = read_installer_manifest()
    now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    packages = _normalize_packages(manifest.get("packages"))

    for package_id, entry in entries.items():
        normalized = copy.deepcopy(entry)
        normalized["id"] = package_id
        normalized["updatedAt"] = now
        packages[package_id] = normalized

    manifest.update(
        {
            "kind": "tos-installer-manifest",
            "appVersion": APP_VERSION,
            "updatedAt": now,
            "packages": packages,
        }
    )

    content = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8") + b"\n"
    storage = put_object_bytes(
        bucket=bucket,
        object_key=INSTALLER_MANIFEST_OBJECT_KEY,
        content=content,
        content_type=INSTALLER_MANIFEST_CONTENT_TYPE,
    )
    return {
        "bucket": bucket,
        "objectKey": INSTALLER_MANIFEST_OBJECT_KEY,
        "fileSize": storage["file_size"],
        "sha256": storage["sha256"],
        "manifest": manifest,
    }


def _empty_manifest() -> dict[str, Any]:
    return {
        "kind": "tos-installer-manifest",
        "appVersion": APP_VERSION,
        "updatedAt": None,
        "packages": {},
    }


def _normalize_packages(value: Any) -> dict[str, dict[str, Any]]:
    if isinstance(value, dict):
        return {
            str(package_id): copy.deepcopy(package)
            for package_id, package in value.items()
            if isinstance(package, dict)
        }

    if isinstance(value, list):
        packages: dict[str, dict[str, Any]] = {}
        for package in value:
            if not isinstance(package, dict):
                continue
            package_id = str(package.get("id") or "").strip()
            if package_id:
                packages[package_id] = copy.deepcopy(package)
        return packages

    return {}
