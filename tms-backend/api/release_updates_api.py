from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Query
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


DEFAULT_RELEASE_UPDATE_RECORDS: list[dict[str, Any]] = [
    {
        "record_key": "2026-06-13-release-update-records-page",
        "version": APP_VERSION,
        "release_date": "2026-06-13",
        "category": "added",
        "page_name": "右上角系统菜单 / 版本更新记录",
        "page_path": "/release-updates",
        "title": "新增版本更新记录入口和独立页面",
        "description": "右上角系统菜单新增版本更新记录入口，页面从数据库读取历史更新，并明确每条更新影响的页面。",
        "created_by": "system",
    },
    {
        "record_key": "2026-06-13-automation-excel-drag-drop",
        "version": APP_VERSION,
        "release_date": "2026-06-13",
        "category": "fixed",
        "page_name": "网页自动化 / shipping 2 自动化",
        "page_path": "/web-automation/scenarios/*",
        "title": "优化自动化页面 Excel 拖拽上传",
        "description": "修复拖拽 Excel 经过上传框内部文字、图标和按钮时页面高亮反复闪烁的问题。",
        "created_by": "system",
    },
    {
        "record_key": "2026-06-13-automation-storage-minio-db",
        "version": APP_VERSION,
        "release_date": "2026-06-13",
        "category": "added",
        "page_name": "网页自动化页面",
        "page_path": "/web-automation",
        "title": "自动化模板、账号密码和运行记录接入数据库与 MinIO",
        "description": "自动化页面支持从数据库读取网站登录账号密码，Excel 模板和运行结果文件通过 MinIO 存储。",
        "created_by": "system",
    },
    {
        "record_key": "2026-06-13-automation-helper-installer",
        "version": APP_VERSION,
        "release_date": "2026-06-13",
        "category": "improved",
        "page_name": "网页自动化页面 / 系统设置",
        "page_path": "/settings",
        "title": "优化本机自动化助手下载与安装链路",
        "description": "右上角入口可下载自动化助手安装包，安装包从服务器地址下载完整 payload 并校验。",
        "created_by": "system",
    },
    {
        "record_key": "2026-06-13-it-invoice-summary-columns",
        "version": APP_VERSION,
        "release_date": "2026-06-13",
        "category": "improved",
        "page_name": "Jason / 发票 PDF 重排序",
        "page_path": "/it-invoice-pdf-reorder",
        "title": "调整 PO 重排汇总页金额字段",
        "description": "生成 PDF 的汇总页改用 Shas Vas Price，并增加 Merchandise Amount、Total Adjustment、Total Taxes、Order Total 汇总列。",
        "created_by": "system",
    },
]


@router.get("")
async def read_release_updates(limit: int = Query(100, ge=1, le=300)) -> dict[str, Any]:
    seed_default_release_updates()
    records = [_record_payload(row) for row in list_release_update_records(limit)]
    return {
        "ok": True,
        "version": APP_VERSION,
        "records": records,
        "total": len(records),
    }


@router.post("")
async def save_release_update(payload: ReleaseUpdatePayload) -> dict[str, Any]:
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
