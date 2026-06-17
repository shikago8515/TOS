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


FULL_OBJECT_KEY = "tos-desktop-full/TOS-Desktop-Full-Setup.exe"
FULL_LEGACY_FILENAME = "TOS-Desktop-Full-Setup.exe"
FULL_FILENAME = f"TOS-Desktop-Full-Setup.{APP_VERSION}.exe"
FULL_CONTENT_TYPE = "application/vnd.microsoft.portable-executable"
FULL_INSTALLER_VERSIONED_PREFIX = "tos-desktop-full/installers"


def upload_installer(installer_path: Path) -> dict[str, Any]:
    if not installer_path.exists() or not installer_path.is_file():
        raise FileNotFoundError(f"Installer not found: {installer_path}")

    content = installer_path.read_bytes()
    if len(content) < 5 * 1024 * 1024:
        raise ValueError(
            f"Installer is unexpectedly small: {installer_path} ({len(content)} bytes)"
        )
    if content[:2] != b"MZ":
        raise ValueError(f"Installer is not a Windows executable: {installer_path}")

    bucket = get_minio_bucket("downloads")
    storage = put_object_bytes(
        bucket=bucket,
        object_key=FULL_OBJECT_KEY,
        content=content,
        content_type=FULL_CONTENT_TYPE,
    )
    versioned_object_key = f"{FULL_INSTALLER_VERSIONED_PREFIX}/{APP_VERSION}/{FULL_FILENAME}"
    versioned_storage = put_object_bytes(
        bucket=bucket,
        object_key=versioned_object_key,
        content=content,
        content_type=FULL_CONTENT_TYPE,
    )

    return {
        "ok": True,
        "bucket": bucket,
        "objectKey": FULL_OBJECT_KEY,
        "versionedObjectKey": versioned_object_key,
        "filename": installer_path.name,
        "defaultFilename": FULL_FILENAME,
        "fileSize": storage["file_size"],
        "versionedFileSize": versioned_storage["file_size"],
        "sha256": sha256_bytes(content),
        "downloadPath": "/api/system/config/tos-desktop-full/download",
        "version": APP_VERSION,
    }


def main() -> None:
    default_path = (
        BACKEND_ROOT.parent
        / "tms-electron-app"
        / "dist-tos-desktop-full"
        / FULL_FILENAME
    )
    if not default_path.exists():
        default_path = default_path.with_name(FULL_LEGACY_FILENAME)
    installer_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else default_path
    print(json.dumps(upload_installer(installer_path), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
