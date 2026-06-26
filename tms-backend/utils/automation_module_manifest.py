from __future__ import annotations

import copy
import json
from typing import Any

from app_version import APP_VERSION
from utils.minio_storage import get_minio_bucket, get_object_response


AUTOMATION_MODULE_MANIFEST_OBJECT_KEY = "automation-modules/manifest.json"


def read_automation_module_manifest() -> dict[str, Any]:
    bucket = get_minio_bucket("downloads")

    try:
        response = get_object_response(bucket, AUTOMATION_MODULE_MANIFEST_OBJECT_KEY)
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
    manifest["modules"] = _normalize_modules(manifest.get("modules"))
    return manifest


def _empty_manifest() -> dict[str, Any]:
    return {
        "kind": "tos-automation-module-manifest",
        "version": APP_VERSION,
        "updatedAt": None,
        "modules": {},
    }


def _normalize_modules(value: Any) -> dict[str, dict[str, Any]]:
    if isinstance(value, dict):
        return {
            str(module_id): copy.deepcopy(module)
            for module_id, module in value.items()
            if isinstance(module, dict)
        }

    if isinstance(value, list):
        modules: dict[str, dict[str, Any]] = {}
        for module in value:
            if not isinstance(module, dict):
                continue
            module_id = str(module.get("id") or "").strip()
            if module_id:
                modules[module_id] = copy.deepcopy(module)
        return modules

    return {}
