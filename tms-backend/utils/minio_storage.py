from __future__ import annotations

import hashlib
import re
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from utils.settings import get_settings


DEFAULT_BUCKET_NAMES = {
    "templates": "tos-templates",
    "run_files": "tos-run-files",
    "results": "tos-results",
    "downloads": "tos-downloads",
    "upload_backups": "tos-upload-backups",
}


def get_minio_bucket(bucket_key: str) -> str:
    buckets = (
        get_settings()
        .get("storage", {})
        .get("minio", {})
        .get("buckets", {})
    )
    fallback_name = DEFAULT_BUCKET_NAMES.get(bucket_key) or f"tos-{sanitize_object_segment(bucket_key).replace('_', '-')}"
    return str(buckets.get(bucket_key) or fallback_name)


def put_object_bytes(
    *,
    bucket: str,
    object_key: str,
    content: bytes,
    content_type: str = "application/octet-stream",
) -> dict[str, Any]:
    client = _build_minio_client()
    _ensure_bucket(client, bucket)
    client.put_object(
        bucket,
        object_key,
        BytesIO(content),
        length=len(content),
        content_type=content_type or "application/octet-stream",
    )
    return {
        "bucket": bucket,
        "object_key": object_key,
        "file_size": len(content),
        "sha256": sha256_bytes(content),
    }


def put_object_file(
    *,
    bucket: str,
    object_key: str,
    file_path: str | Path,
    content_type: str = "application/octet-stream",
) -> dict[str, Any]:
    path = Path(file_path)
    file_size = path.stat().st_size
    file_hash = sha256_file(path)
    client = _build_minio_client()
    _ensure_bucket(client, bucket)
    with path.open("rb") as file_obj:
        client.put_object(
            bucket,
            object_key,
            file_obj,
            length=file_size,
            content_type=content_type or "application/octet-stream",
        )
    return {
        "bucket": bucket,
        "object_key": object_key,
        "file_size": file_size,
        "sha256": file_hash,
    }


def get_object_response(bucket: str, object_key: str) -> Any:
    client = _build_minio_client()
    return client.get_object(bucket, object_key)


def object_exists(bucket: str, object_key: str) -> bool:
    client = _build_minio_client()
    try:
        client.stat_object(bucket, object_key)
    except Exception:
        return False
    return True


def download_url_bytes(url: str, timeout: int = 30) -> tuple[bytes, str]:
    request = Request(url, headers={"User-Agent": "TOS-Backend/1.0"})
    with urlopen(request, timeout=timeout) as response:
        content_type = response.headers.get("Content-Type", "application/octet-stream")
        return response.read(), content_type


def build_object_key(*parts: str) -> str:
    cleaned = [sanitize_object_segment(part) for part in parts if str(part or "").strip()]
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    if cleaned:
        cleaned[-1] = f"{timestamp}-{cleaned[-1]}"
    return "/".join(cleaned)


def sanitize_object_segment(value: str) -> str:
    text = str(value or "").strip().replace("\\", "/").split("/")[-1]
    text = re.sub(r"[^A-Za-z0-9._\-\u4e00-\u9fff]+", "-", text)
    text = text.strip(".-")
    return text[:120] or "file"


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sha256_file(file_path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(file_path).open("rb") as file_obj:
        for chunk in iter(lambda: file_obj.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _build_minio_client() -> Any:
    try:
        from minio import Minio
    except ImportError as exc:
        raise RuntimeError("minio is not installed. Run `pip install -r tms-backend/requirements.txt`.") from exc

    config = get_settings().get("storage", {}).get("minio", {})
    return Minio(
        str(config.get("endpoint", "127.0.0.1:9000")),
        access_key=str(config.get("access_key", "minioadmin")),
        secret_key=str(config.get("secret_key", "minioadmin")),
        secure=bool(config.get("secure", False)),
    )


def _ensure_bucket(client: Any, bucket: str) -> None:
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
