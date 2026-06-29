from __future__ import annotations

import json
import os
import threading
from datetime import date
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app_version import APP_VERSION
from utils.mysql_store import (
    get_latest_release_announcement,
    insert_release_update_record_once,
    list_release_update_records,
    upsert_release_announcement,
    upsert_release_update_record,
)


router = APIRouter(prefix="/release-updates", tags=["Release Updates"])
announcements_router = APIRouter(prefix="/release-announcements", tags=["Release Announcements"])


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


class ReleaseAnnouncementGroup(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    icon: str = Field(default="sparkles", max_length=48)
    items: list[str] = Field(default_factory=list)


class ReleaseAnnouncementPayload(BaseModel):
    noticeId: str = Field(min_length=1, max_length=160)
    version: str = Field(default=APP_VERSION, min_length=1, max_length=64)
    releaseDate: str | None = None
    showPopup: bool = False
    level: str = Field(default="info", max_length=32)
    title: str = Field(default="本次更新内容", min_length=1, max_length=255)
    groups: list[ReleaseAnnouncementGroup] = Field(default_factory=list)
    createdBy: str = Field(default="release", max_length=96)


class ReleaseAnnouncementResponse(BaseModel):
    noticeId: str
    version: str
    releaseDate: str
    showPopup: bool
    level: str
    title: str
    groups: list[ReleaseAnnouncementGroup]


class LatestReleaseAnnouncementResponse(BaseModel):
    ok: bool
    version: str
    announcement: ReleaseAnnouncementResponse | None


class ReleaseAnnouncementSaveResponse(BaseModel):
    ok: bool
    announcement: ReleaseAnnouncementResponse


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
_release_update_seed_lock = threading.Lock()
_release_update_seeded = False


@router.get("", response_model=ReleaseUpdatesResponse)
def read_release_updates(limit: int = Query(100, ge=1, le=300)) -> dict[str, Any]:
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
def save_release_update(
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


@announcements_router.get("/latest", response_model=LatestReleaseAnnouncementResponse)
def read_latest_release_announcement() -> dict[str, Any]:
    row = get_latest_release_announcement()
    if not row:
        return {
            "ok": True,
            "version": APP_VERSION,
            "announcement": None,
        }

    announcement = _announcement_payload(row)
    return {
        "ok": True,
        "version": announcement["version"],
        "announcement": announcement,
    }


@announcements_router.post("", response_model=ReleaseAnnouncementSaveResponse)
def save_release_announcement(
    payload: ReleaseAnnouncementPayload,
    x_release_update_token: str | None = Header(default=None, alias="X-Release-Update-Token"),
) -> dict[str, Any]:
    _validate_release_update_write_token(x_release_update_token)
    row = upsert_release_announcement({
        "notice_id": payload.noticeId.strip(),
        "version": payload.version.strip(),
        "release_date": payload.releaseDate,
        "show_popup": payload.showPopup,
        "level": payload.level.strip() or "info",
        "title": payload.title.strip(),
        "groups": [
            {
                "title": group.title.strip(),
                "icon": group.icon.strip() or "sparkles",
                "items": [item.strip() for item in group.items if item.strip()],
            }
            for group in payload.groups
        ],
        "created_by": payload.createdBy.strip() or "release",
    })
    return {
        "ok": True,
        "announcement": _announcement_payload(row),
    }


def seed_default_release_updates() -> None:
    global _release_update_seeded

    if _release_update_seeded:
        return

    with _release_update_seed_lock:
        if _release_update_seeded:
            return

        for record in DEFAULT_RELEASE_UPDATE_RECORDS:
            insert_release_update_record_once(record)

        _release_update_seeded = True


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


def _announcement_payload(row: dict[str, Any]) -> dict[str, Any]:
    groups = _parse_announcement_groups(row.get("groups_json"))
    return {
        "noticeId": row["notice_id"],
        "version": row["version"],
        "releaseDate": _format_date(row.get("release_date")),
        "showPopup": bool(row.get("show_popup")),
        "level": row.get("level", "info"),
        "title": row.get("title", ""),
        "groups": groups,
    }


def _parse_announcement_groups(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    if not isinstance(value, list):
        return []

    groups: list[dict[str, Any]] = []
    for raw_group in value:
        if not isinstance(raw_group, dict):
            continue
        items = raw_group.get("items")
        groups.append({
            "title": str(raw_group.get("title") or "").strip(),
            "icon": str(raw_group.get("icon") or "sparkles").strip() or "sparkles",
            "items": [
                str(item).strip()
                for item in (items if isinstance(items, list) else [])
                if str(item).strip()
            ],
        })
    return [group for group in groups if group["title"] and group["items"]]


def _format_date(value: Any) -> str:
    if isinstance(value, date):
        return value.isoformat()
    return str(value or "")


def _format_datetime(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value or "")
