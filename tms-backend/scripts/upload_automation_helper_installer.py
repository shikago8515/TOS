from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from utils.minio_storage import get_minio_bucket, put_object_bytes, sha256_bytes
from app_version import APP_VERSION


HELPER_OBJECT_KEY = "automation-helper/TOS-Automation-Helper-Setup.exe"
HELPER_LEGACY_FILENAME = "TOS-Automation-Helper-Setup.exe"
HELPER_FILENAME = f"TOS-Automation-Helper-Setup.{APP_VERSION}.exe"
HELPER_CONTENT_TYPE = "application/vnd.microsoft.portable-executable"
HELPER_INSTALLER_VERSIONED_PREFIX = "automation-helper/installers"
HELPER_PAYLOAD_OBJECT_KEY = "automation-helper/TOS-Automation-Helper-Payload.zip"
HELPER_PAYLOAD_FILENAME = "TOS-Automation-Helper-Payload.zip"
HELPER_PAYLOAD_CONTENT_TYPE = "application/zip"
HELPER_PAYLOAD_VERSIONED_PREFIX = "automation-helper/payloads"


def upload_installer(installer_path: Path, payload_path: Path | None = None) -> dict[str, Any]:
    if not installer_path.exists() or not installer_path.is_file():
        raise FileNotFoundError(f"Installer not found: {installer_path}")

    content = installer_path.read_bytes()
    if len(content) < 64 * 1024:
        raise ValueError(f"Installer is unexpectedly small: {installer_path} ({len(content)} bytes)")

    if content[:2] != b"MZ":
        raise ValueError(f"Installer is not a Windows executable: {installer_path}")

    bucket = get_minio_bucket("downloads")
    storage = put_object_bytes(
        bucket=bucket,
        object_key=HELPER_OBJECT_KEY,
        content=content,
        content_type=HELPER_CONTENT_TYPE,
    )
    installer_versioned_object_key = (
        f"{HELPER_INSTALLER_VERSIONED_PREFIX}/{APP_VERSION}/{HELPER_FILENAME}"
    )
    installer_versioned_storage = put_object_bytes(
        bucket=bucket,
        object_key=installer_versioned_object_key,
        content=content,
        content_type=HELPER_CONTENT_TYPE,
    )

    payload_result: dict[str, Any] | None = None
    if payload_path is not None:
        if not payload_path.exists() or not payload_path.is_file():
            raise FileNotFoundError(f"Payload archive not found: {payload_path}")
        payload_content = payload_path.read_bytes()
        if len(payload_content) < 1024 * 1024:
            raise ValueError(
                f"Payload archive is unexpectedly small: {payload_path} ({len(payload_content)} bytes)"
            )
        if not payload_content.startswith(b"PK"):
            raise ValueError(f"Payload archive is not a zip file: {payload_path}")
        payload_sha256 = sha256_bytes(payload_content)
        payload_storage = put_object_bytes(
            bucket=bucket,
            object_key=HELPER_PAYLOAD_OBJECT_KEY,
            content=payload_content,
            content_type=HELPER_PAYLOAD_CONTENT_TYPE,
        )
        versioned_object_key = (
            f"{HELPER_PAYLOAD_VERSIONED_PREFIX}/{payload_sha256}/{HELPER_PAYLOAD_FILENAME}"
        )
        versioned_storage = put_object_bytes(
            bucket=bucket,
            object_key=versioned_object_key,
            content=payload_content,
            content_type=HELPER_PAYLOAD_CONTENT_TYPE,
        )
        payload_result = {
            "bucket": bucket,
            "objectKey": HELPER_PAYLOAD_OBJECT_KEY,
            "versionedObjectKey": versioned_object_key,
            "filename": HELPER_PAYLOAD_FILENAME,
            "fileSize": payload_storage["file_size"],
            "versionedFileSize": versioned_storage["file_size"],
            "sha256": payload_sha256,
            "downloadPath": "/api/system/config/automation-helper/payload",
            "versionedDownloadPath": f"/api/system/config/automation-helper/payload/{payload_sha256}",
        }

    result = {
        "ok": True,
        "bucket": bucket,
        "objectKey": HELPER_OBJECT_KEY,
        "versionedObjectKey": installer_versioned_object_key,
        "filename": installer_path.name,
        "defaultFilename": HELPER_FILENAME,
        "fileSize": storage["file_size"],
        "versionedFileSize": installer_versioned_storage["file_size"],
        "sha256": sha256_bytes(content),
        "downloadPath": "/api/system/config/automation-helper/download",
        "version": APP_VERSION,
    }
    if payload_result is not None:
        result["payload"] = payload_result
    return result


def main() -> None:
    default_path = (
        BACKEND_ROOT.parent
        / "tms-electron-app"
        / "dist-automation-helper"
        / HELPER_FILENAME
    )
    if not default_path.exists():
        default_path = default_path.with_name(HELPER_LEGACY_FILENAME)
    default_payload_path = default_path.with_name(HELPER_PAYLOAD_FILENAME)
    installer_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else default_path
    payload_path = (
        Path(sys.argv[2]).resolve()
        if len(sys.argv) > 2
        else default_payload_path
    )
    print(json.dumps(upload_installer(installer_path, payload_path), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
