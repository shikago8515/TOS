from __future__ import annotations

import copy
import json
import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app_version import APP_VERSION
from utils.automation_module_manifest import (
    AUTOMATION_MODULE_MANIFEST_OBJECT_KEY,
    read_automation_module_manifest,
)
from utils.minio_storage import get_minio_bucket, put_object_bytes, sha256_bytes


AUTOMATION_MODULE_CONTENT_TYPE = "application/zip"
AUTOMATION_MODULE_MANIFEST_CONTENT_TYPE = "application/json; charset=utf-8"


def upload_automation_modules(dist_dir: Path, preserve_existing: bool = False) -> dict[str, Any]:
    manifest_path = dist_dir / "manifest.json"
    if not manifest_path.exists() or not manifest_path.is_file():
        raise FileNotFoundError(f"Automation module manifest not found: {manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    modules = _normalize_modules(manifest.get("modules"))
    if not modules:
        raise ValueError(f"Automation module manifest has no modules: {manifest_path}")

    uploaded_modules: dict[str, dict[str, Any]] = {}
    for module_id, module in modules.items():
        uploaded_modules[module_id] = _upload_module(dist_dir, module_id, module)

    now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    normalized_manifest = (
        copy.deepcopy(read_automation_module_manifest())
        if preserve_existing
        else copy.deepcopy(manifest)
    )
    merged_modules = _normalize_modules(normalized_manifest.get("modules"))
    merged_modules.update(uploaded_modules)
    normalized_manifest.update(
        {
            "kind": "tos-automation-module-manifest",
            "version": str(manifest.get("version") or APP_VERSION),
            "updatedAt": now,
            "modules": merged_modules,
        }
    )

    manifest_content = (
        json.dumps(normalized_manifest, ensure_ascii=False, indent=2).encode("utf-8")
        + b"\n"
    )
    manifest_bucket = get_minio_bucket("downloads")
    manifest_storage = put_object_bytes(
        bucket=manifest_bucket,
        object_key=AUTOMATION_MODULE_MANIFEST_OBJECT_KEY,
        content=manifest_content,
        content_type=AUTOMATION_MODULE_MANIFEST_CONTENT_TYPE,
    )

    return {
        "ok": True,
        "bucket": manifest_bucket,
        "objectKey": AUTOMATION_MODULE_MANIFEST_OBJECT_KEY,
        "fileSize": manifest_storage["file_size"],
        "sha256": manifest_storage["sha256"],
        "moduleCount": len(merged_modules),
        "uploadedModuleCount": len(uploaded_modules),
        "modules": merged_modules,
        "uploadedModules": uploaded_modules,
    }


def _upload_module(dist_dir: Path, module_id: str, module: dict[str, Any]) -> dict[str, Any]:
    filename = str(module.get("filename") or f"{module_id}.{APP_VERSION}.zip")
    package_path = dist_dir / filename
    if not package_path.exists() or not package_path.is_file():
        raise FileNotFoundError(f"Automation module package not found: {package_path}")

    content = package_path.read_bytes()
    if len(content) < 256:
        raise ValueError(f"Automation module package is unexpectedly small: {package_path}")
    if not content.startswith(b"PK"):
        raise ValueError(f"Automation module package is not a zip file: {package_path}")

    sha256 = sha256_bytes(content)
    expected_sha = str(module.get("sha256") or "").strip().lower()
    if expected_sha and expected_sha != sha256:
        raise ValueError(
            f"Automation module package checksum mismatch for {module_id}: "
            f"expected {expected_sha}, got {sha256}"
        )

    bucket = str(module.get("bucket") or get_minio_bucket("downloads"))
    object_key = str(
        module.get("objectKey")
        or module.get("object_key")
        or f"automation-modules/{module_id}/{filename}"
    )
    storage = put_object_bytes(
        bucket=bucket,
        object_key=object_key,
        content=content,
        content_type=str(module.get("contentType") or AUTOMATION_MODULE_CONTENT_TYPE),
    )

    uploaded = copy.deepcopy(module)
    uploaded.update(
        {
            "id": module_id,
            "filename": filename,
            "bucket": bucket,
            "objectKey": object_key,
            "contentType": str(module.get("contentType") or AUTOMATION_MODULE_CONTENT_TYPE),
            "fileSize": storage["file_size"],
            "sha256": sha256,
            "downloadPath": str(
                module.get("downloadPath")
                or f"/api/system/config/automation-modules/{module_id}/download"
            ),
            "updatedAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        }
    )
    return uploaded


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload TOS automation module packages to MinIO.")
    default_dist_dir = BACKEND_ROOT.parent / "tms-electron-app" / "dist-automation-modules"
    parser.add_argument("dist_dir", nargs="?", default=str(default_dist_dir))
    parser.add_argument(
        "--preserve-existing",
        action="store_true",
        help="Merge uploaded modules into the existing server manifest instead of replacing it wholesale.",
    )
    args = parser.parse_args()
    dist_dir = Path(args.dist_dir).resolve()
    print(json.dumps(upload_automation_modules(dist_dir, preserve_existing=args.preserve_existing), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
