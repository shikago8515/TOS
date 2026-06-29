from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from utils.minio_storage import get_minio_bucket, put_object_file, sanitize_object_segment
from utils.mysql_store import insert_excel_upload_backup


EXCEL_UPLOAD_BACKUP_PREFIX = "upload-backups"
DEFAULT_EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@dataclass(frozen=True)
class ExcelUploadBackupContext:
    module_id: str
    request_id: str
    file_role: str
    original_filename: str
    content_type: str = DEFAULT_EXCEL_CONTENT_TYPE


def store_excel_upload_backup(
    file_path: str | Path,
    context: ExcelUploadBackupContext,
) -> dict[str, Any]:
    path = Path(file_path)
    bucket = get_minio_bucket("upload_backups")
    object_key = build_excel_upload_backup_object_key(path, context)
    storage_record = put_object_file(
        bucket=bucket,
        object_key=object_key,
        file_path=path,
        content_type=context.content_type or DEFAULT_EXCEL_CONTENT_TYPE,
    )
    return insert_excel_upload_backup({
        "request_id": context.request_id,
        "module_id": context.module_id,
        "file_role": context.file_role,
        "bucket": storage_record["bucket"],
        "object_key": storage_record["object_key"],
        "original_filename": sanitize_object_segment(context.original_filename or path.name),
        "content_type": context.content_type or DEFAULT_EXCEL_CONTENT_TYPE,
        "file_size": storage_record["file_size"],
        "sha256": storage_record["sha256"],
    })


def build_excel_upload_backup_object_key(
    file_path: str | Path,
    context: ExcelUploadBackupContext,
) -> str:
    now = datetime.now(UTC)
    timestamp = now.strftime("%Y%m%d%H%M%S%f")
    filename = sanitize_object_segment(context.original_filename or Path(file_path).name)
    parts = [
        EXCEL_UPLOAD_BACKUP_PREFIX,
        sanitize_object_segment(context.module_id),
        now.strftime("%Y"),
        now.strftime("%m"),
        now.strftime("%d"),
        sanitize_object_segment(context.request_id),
        sanitize_object_segment(context.file_role),
        f"{timestamp}-{filename}",
    ]
    return "/".join(parts)
