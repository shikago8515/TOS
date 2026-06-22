from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app_version import APP_VERSION
from utils.mysql_store import (
    insert_release_update_record_once,
    list_release_update_records,
    upsert_release_update_record,
)


router = APIRouter(prefix="/release-updates", tags=["Release Updates"])


class ReleaseUpdatePayload(BaseModel):
    recordKey: str = Field(min_length=1, max_length=160)
    version: str = Field(default=APP_VERSION, min_length=1, max_length=64)
    releaseDate: str | None = None
    category: str = Field(default="improved", max_length=32)
    pageName: str = Field(min_length=1, max_length=255)
    pagePath: str = Field(default="", max_length=255)
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    createdBy: str = Field(default="manual", max_length=96)


class ReleaseUpdateRecordResponse(BaseModel):
    id: int
    recordKey: str
    version: str
    releaseDate: str
    category: str
    pageName: str
    pagePath: str
    title: str
    description: str
    createdBy: str
    createdAt: str
    updatedAt: str


class ReleaseUpdatesResponse(BaseModel):
    ok: bool
    version: str
    records: list[ReleaseUpdateRecordResponse]
    total: int


class ReleaseUpdateSaveResponse(BaseModel):
    ok: bool
    record: ReleaseUpdateRecordResponse


def _default_record(
    record_key: str,
    version: str,
    release_date: str,
    category: str,
    page_name: str,
    page_path: str,
    title: str,
    description: str,
) -> dict[str, Any]:
    return {
        "record_key": record_key,
        "version": version,
        "release_date": release_date,
        "category": category,
        "page_name": page_name,
        "page_path": page_path,
        "title": title,
        "description": description,
        "created_by": "system",
    }


RELEASE_UPDATE_SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "release_updates_seed.json"


def load_default_release_update_records(seed_path: Path = RELEASE_UPDATE_SEED_PATH) -> list[dict[str, Any]]:
    try:
        payload = json.loads(seed_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Invalid release update seed file: {seed_path.name}") from exc

    if not isinstance(payload, list):
        raise RuntimeError("Release update seed file must contain a JSON array.")

    records: list[dict[str, Any]] = []
    for raw_record in payload:
        if not isinstance(raw_record, dict):
            continue
        record = _normalize_default_record(raw_record)
        if record["record_key"] and record["version"] and record["title"]:
            records.append(record)
    return records


def _normalize_default_record(raw_record: dict[str, Any]) -> dict[str, Any]:
    return _default_record(
        _seed_value(raw_record, "recordKey", "record_key"),
        _seed_value(raw_record, "version", "version"),
        _seed_value(raw_record, "releaseDate", "release_date"),
        _seed_value(raw_record, "category", "category", "improved") or "improved",
        _seed_value(raw_record, "pageName", "page_name", "全局通用") or "全局通用",
        _seed_value(raw_record, "pagePath", "page_path"),
        _seed_value(raw_record, "title", "title"),
        _seed_value(raw_record, "description", "description"),
    )


def _seed_value(
    raw_record: dict[str, Any],
    camel_key: str,
    snake_key: str,
    default: str = "",
) -> str:
    value = raw_record.get(camel_key)
    if value is None:
        value = raw_record.get(snake_key)
    if value is None:
        value = default
    return str(value).strip()


DEFAULT_RELEASE_UPDATE_RECORDS: list[dict[str, Any]] = load_default_release_update_records()


@router.get("", response_model=ReleaseUpdatesResponse)
async def read_release_updates(limit: int = Query(100, ge=1, le=300)) -> dict[str, Any]:
    seed_default_release_updates()
    records = [_record_payload(row) for row in list_release_update_records(limit)]
    latest_record_version = records[0]["version"] if records else APP_VERSION
    return {
        "ok": True,
        "version": latest_record_version,
        "records": records,
        "total": len(records),
    }


@router.post("", response_model=ReleaseUpdateSaveResponse)
async def save_release_update(
    payload: ReleaseUpdatePayload,
    x_release_update_token: str | None = Header(default=None, alias="X-Release-Update-Token"),
) -> dict[str, Any]:
    _validate_release_update_write_token(x_release_update_token)
    row = upsert_release_update_record({
        "record_key": payload.recordKey.strip(),
        "version": payload.version.strip(),
        "release_date": payload.releaseDate,
        "category": payload.category.strip() or "improved",
        "page_name": payload.pageName.strip(),
        "page_path": payload.pagePath.strip(),
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "created_by": payload.createdBy.strip() or "manual",
    })
    return {
        "ok": True,
        "record": _record_payload(row),
    }


def seed_default_release_updates() -> None:
    for record in DEFAULT_RELEASE_UPDATE_RECORDS:
        insert_release_update_record_once(record)


def _validate_release_update_write_token(token: str | None) -> None:
    expected_token = os.environ.get("TOS_RELEASE_UPDATE_WRITE_TOKEN", "").strip()
    if expected_token and token != expected_token:
        raise HTTPException(status_code=401, detail="Unauthorized release update write.")


def _record_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "recordKey": row["record_key"],
        "version": row["version"],
        "releaseDate": _format_date(row.get("release_date")),
        "category": row.get("category", "improved"),
        "pageName": row.get("page_name", ""),
        "pagePath": row.get("page_path", ""),
        "title": row.get("title", ""),
        "description": row.get("description", ""),
        "createdBy": row.get("created_by", ""),
        "createdAt": _format_datetime(row.get("created_at")),
        "updatedAt": _format_datetime(row.get("updated_at")),
    }


def _format_date(value: Any) -> str:
    if isinstance(value, date):
        return value.isoformat()
    return str(value or "")


def _format_datetime(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value or "")
