from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app_version import APP_VERSION
from utils.minio_storage import get_minio_bucket, put_object_bytes, sha256_bytes


DESKTOP_OBJECT_KEY = "tos-desktop/TOS-Desktop-Setup.exe"
DESKTOP_LEGACY_FILENAME = "TOS-Desktop-Setup.exe"
DESKTOP_FILENAME = f"TOS-Desktop-Setup.{APP_VERSION}.exe"
DESKTOP_CONTENT_TYPE = "application/vnd.microsoft.portable-executable"
DESKTOP_INSTALLER_VERSIONED_PREFIX = "tos-desktop/installers"
DESKTOP_PAYLOAD_OBJECT_KEY = "tos-desktop/TOS-Desktop-Payload.zip"
DESKTOP_PAYLOAD_FILENAME = "TOS-Desktop-Payload.zip"
DESKTOP_PAYLOAD_CONTENT_TYPE = "application/zip"
DESKTOP_PAYLOAD_VERSIONED_PREFIX = "tos-desktop/payloads"


def upload_release(installer_path: Path, payload_path: Path | None = None) -> dict[str, Any]:
    if not installer_path.exists() or not installer_path.is_file():
        raise FileNotFoundError(f"Installer not found: {installer_path}")

    installer_content = installer_path.read_bytes()
    if len(installer_content) < 64 * 1024:
        raise ValueError(
            f"Installer is unexpectedly small: {installer_path} ({len(installer_content)} bytes)"
        )
    if installer_content[:2] != b"MZ":
        raise ValueError(f"Installer is not a Windows executable: {installer_path}")

    bucket = get_minio_bucket("downloads")
    storage = put_object_bytes(
        bucket=bucket,
        object_key=DESKTOP_OBJECT_KEY,
        content=installer_content,
        content_type=DESKTOP_CONTENT_TYPE,
    )
    installer_versioned_object_key = (
        f"{DESKTOP_INSTALLER_VERSIONED_PREFIX}/{APP_VERSION}/{DESKTOP_FILENAME}"
    )
    installer_versioned_storage = put_object_bytes(
        bucket=bucket,
        object_key=installer_versioned_object_key,
        content=installer_content,
        content_type=DESKTOP_CONTENT_TYPE,
    )

    payload_result: dict[str, Any] | None = None
    if payload_path is not None:
        if not payload_path.exists() or not payload_path.is_file():
            raise FileNotFoundError(f"Payload archive not found: {payload_path}")
        payload_content = payload_path.read_bytes()
        if len(payload_content) < 5 * 1024 * 1024:
            raise ValueError(
                f"Payload archive is unexpectedly small: {payload_path} ({len(payload_content)} bytes)"
            )
        if not payload_content.startswith(b"PK"):
            raise ValueError(f"Payload archive is not a zip file: {payload_path}")

        payload_sha256 = sha256_bytes(payload_content)
        payload_storage = put_object_bytes(
            bucket=bucket,
            object_key=DESKTOP_PAYLOAD_OBJECT_KEY,
            content=payload_content,
            content_type=DESKTOP_PAYLOAD_CONTENT_TYPE,
        )
        versioned_object_key = (
            f"{DESKTOP_PAYLOAD_VERSIONED_PREFIX}/{payload_sha256}/{DESKTOP_PAYLOAD_FILENAME}"
        )
        versioned_storage = put_object_bytes(
            bucket=bucket,
            object_key=versioned_object_key,
            content=payload_content,
            content_type=DESKTOP_PAYLOAD_CONTENT_TYPE,
        )
        payload_result = {
            "bucket": bucket,
            "objectKey": DESKTOP_PAYLOAD_OBJECT_KEY,
            "versionedObjectKey": versioned_object_key,
            "filename": DESKTOP_PAYLOAD_FILENAME,
            "fileSize": payload_storage["file_size"],
            "versionedFileSize": versioned_storage["file_size"],
            "sha256": payload_sha256,
            "downloadPath": "/api/system/config/tos-desktop/payload",
            "versionedDownloadPath": f"/api/system/config/tos-desktop/payload/{payload_sha256}",
        }

    result = {
        "ok": True,
        "bucket": bucket,
        "objectKey": DESKTOP_OBJECT_KEY,
        "versionedObjectKey": installer_versioned_object_key,
        "filename": installer_path.name,
        "defaultFilename": DESKTOP_FILENAME,
        "fileSize": storage["file_size"],
        "versionedFileSize": installer_versioned_storage["file_size"],
        "sha256": sha256_bytes(installer_content),
        "downloadPath": "/api/system/config/tos-desktop/download",
        "version": APP_VERSION,
    }
    if payload_result is not None:
        result["payload"] = payload_result
    return result


def main() -> None:
    default_path = (
        BACKEND_ROOT.parent
        / "tms-electron-app"
        / "dist-tos-desktop"
        / DESKTOP_FILENAME
    )
    if not default_path.exists():
        default_path = default_path.with_name(DESKTOP_LEGACY_FILENAME)
    default_payload_path = default_path.with_name(DESKTOP_PAYLOAD_FILENAME)
    installer_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else default_path
    payload_path = (
        Path(sys.argv[2]).resolve()
        if len(sys.argv) > 2
        else default_payload_path
    )
    print(json.dumps(upload_release(installer_path, payload_path), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
