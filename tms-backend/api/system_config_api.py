from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from utils.minio_storage import get_minio_bucket, get_object_response
from utils.settings import get_settings, get_settings_summary, resolve_settings_path


router = APIRouter(prefix="/system/config", tags=["System Config"])

HELPER_DEFAULT_BUCKET_KEY = "downloads"
HELPER_DEFAULT_OBJECT_KEY = "automation-helper/TOS-Automation-Helper-Setup.exe"
HELPER_DEFAULT_FILENAME = "TOS-Automation-Helper-Setup.exe"
HELPER_CONTENT_TYPE = "application/vnd.microsoft.portable-executable"
HELPER_PAYLOAD_DEFAULT_OBJECT_KEY = "automation-helper/TOS-Automation-Helper-Payload.zip"
HELPER_PAYLOAD_DEFAULT_FILENAME = "TOS-Automation-Helper-Payload.zip"
HELPER_PAYLOAD_CONTENT_TYPE = "application/zip"
HELPER_PAYLOAD_VERSIONED_PREFIX = "automation-helper/payloads"
TOS_DESKTOP_DEFAULT_BUCKET_KEY = "downloads"
TOS_DESKTOP_DEFAULT_OBJECT_KEY = "tos-desktop/TOS-Desktop-Setup.exe"
TOS_DESKTOP_DEFAULT_FILENAME = "TOS-Desktop-Setup.exe"
TOS_DESKTOP_CONTENT_TYPE = "application/vnd.microsoft.portable-executable"
TOS_DESKTOP_PAYLOAD_DEFAULT_OBJECT_KEY = "tos-desktop/TOS-Desktop-Payload.zip"
TOS_DESKTOP_PAYLOAD_DEFAULT_FILENAME = "TOS-Desktop-Payload.zip"
TOS_DESKTOP_PAYLOAD_CONTENT_TYPE = "application/zip"
TOS_DESKTOP_PAYLOAD_VERSIONED_PREFIX = "tos-desktop/payloads"
TOS_DESKTOP_FULL_DEFAULT_BUCKET_KEY = "downloads"
TOS_DESKTOP_FULL_DEFAULT_OBJECT_KEY = "tos-desktop-full/TOS-Desktop-Full-Setup.exe"
TOS_DESKTOP_FULL_DEFAULT_FILENAME = "TOS-Desktop-Full-Setup.exe"
TOS_DESKTOP_FULL_CONTENT_TYPE = "application/vnd.microsoft.portable-executable"


@router.get("/summary")
async def config_summary() -> dict[str, Any]:
    return {
        "settingsFile": str(resolve_settings_path()),
        "settings": get_settings_summary(),
    }


@router.get("/automation-helper/download")
async def automation_helper_download() -> StreamingResponse:
    helper_config = (
        get_settings()
        .get("downloads", {})
        .get("automation_helper", {})
    )
    bucket = str(helper_config.get("bucket") or get_minio_bucket(HELPER_DEFAULT_BUCKET_KEY))
    object_key = str(helper_config.get("object_key") or HELPER_DEFAULT_OBJECT_KEY)
    filename = str(helper_config.get("filename") or HELPER_DEFAULT_FILENAME)

    try:
        response = get_object_response(bucket, object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail="TOS 自动化助手安装包未上传，请先生成并上传到 MinIO。",
        ) from exc

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(helper_config.get("content_type") or HELPER_CONTENT_TYPE),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get("/automation-helper/payload")
async def automation_helper_payload_download() -> StreamingResponse:
    helper_config = (
        get_settings()
        .get("downloads", {})
        .get("automation_helper", {})
    )
    bucket = str(helper_config.get("bucket") or get_minio_bucket(HELPER_DEFAULT_BUCKET_KEY))
    object_key = str(
        helper_config.get("payload_object_key") or HELPER_PAYLOAD_DEFAULT_OBJECT_KEY
    )
    filename = str(
        helper_config.get("payload_filename") or HELPER_PAYLOAD_DEFAULT_FILENAME
    )

    try:
        response = get_object_response(bucket, object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail="TOS 自动化助手 payload 未上传，请先生成并上传到 MinIO。",
        ) from exc

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(
            helper_config.get("payload_content_type") or HELPER_PAYLOAD_CONTENT_TYPE
        ),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get("/automation-helper/payload/{payload_sha256}")
async def automation_helper_versioned_payload_download(
    payload_sha256: str,
) -> StreamingResponse:
    normalized_sha = payload_sha256.strip().lower()
    if not re.fullmatch(r"[a-f0-9]{64}", normalized_sha):
        raise HTTPException(status_code=400, detail="Invalid payload sha256.")

    helper_config = (
        get_settings()
        .get("downloads", {})
        .get("automation_helper", {})
    )
    bucket = str(helper_config.get("bucket") or get_minio_bucket(HELPER_DEFAULT_BUCKET_KEY))
    versioned_prefix = str(
        helper_config.get("payload_versioned_prefix") or HELPER_PAYLOAD_VERSIONED_PREFIX
    ).strip("/")
    filename = str(
        helper_config.get("payload_filename") or HELPER_PAYLOAD_DEFAULT_FILENAME
    )
    object_key = f"{versioned_prefix}/{normalized_sha}/{filename}"

    try:
        response = get_object_response(bucket, object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"TOS 自动化助手 payload 版本不存在：{normalized_sha}",
        ) from exc

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(
            helper_config.get("payload_content_type") or HELPER_PAYLOAD_CONTENT_TYPE
        ),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get("/tos-desktop/download")
async def tos_desktop_download() -> StreamingResponse:
    desktop_config = (
        get_settings()
        .get("downloads", {})
        .get("tos_desktop", {})
    )
    bucket = str(desktop_config.get("bucket") or get_minio_bucket(TOS_DESKTOP_DEFAULT_BUCKET_KEY))
    object_key = str(desktop_config.get("object_key") or TOS_DESKTOP_DEFAULT_OBJECT_KEY)
    filename = str(desktop_config.get("filename") or TOS_DESKTOP_DEFAULT_FILENAME)

    try:
        response = get_object_response(bucket, object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail="TOS 应用安装包未上传，请先生成并上传到 MinIO。",
        ) from exc

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(desktop_config.get("content_type") or TOS_DESKTOP_CONTENT_TYPE),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get("/tos-desktop-full/download")
async def tos_desktop_full_download() -> StreamingResponse:
    desktop_config = (
        get_settings()
        .get("downloads", {})
        .get("tos_desktop_full", {})
    )
    bucket = str(desktop_config.get("bucket") or get_minio_bucket(TOS_DESKTOP_FULL_DEFAULT_BUCKET_KEY))
    object_key = str(desktop_config.get("object_key") or TOS_DESKTOP_FULL_DEFAULT_OBJECT_KEY)
    filename = str(desktop_config.get("filename") or TOS_DESKTOP_FULL_DEFAULT_FILENAME)

    try:
        response = get_object_response(bucket, object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail="TOS full desktop installer has not been uploaded to MinIO.",
        ) from exc

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(desktop_config.get("content_type") or TOS_DESKTOP_FULL_CONTENT_TYPE),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get("/tos-desktop/payload")
async def tos_desktop_payload_download() -> StreamingResponse:
    desktop_config = (
        get_settings()
        .get("downloads", {})
        .get("tos_desktop", {})
    )
    bucket = str(desktop_config.get("bucket") or get_minio_bucket(TOS_DESKTOP_DEFAULT_BUCKET_KEY))
    object_key = str(
        desktop_config.get("payload_object_key") or TOS_DESKTOP_PAYLOAD_DEFAULT_OBJECT_KEY
    )
    filename = str(
        desktop_config.get("payload_filename") or TOS_DESKTOP_PAYLOAD_DEFAULT_FILENAME
    )

    try:
        response = get_object_response(bucket, object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail="TOS 应用 payload 未上传，请先生成并上传到 MinIO。",
        ) from exc

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(
            desktop_config.get("payload_content_type") or TOS_DESKTOP_PAYLOAD_CONTENT_TYPE
        ),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get("/tos-desktop/payload/{payload_sha256}")
async def tos_desktop_versioned_payload_download(
    payload_sha256: str,
) -> StreamingResponse:
    normalized_sha = payload_sha256.strip().lower()
    if not re.fullmatch(r"[a-f0-9]{64}", normalized_sha):
        raise HTTPException(status_code=400, detail="Invalid payload sha256.")

    desktop_config = (
        get_settings()
        .get("downloads", {})
        .get("tos_desktop", {})
    )
    bucket = str(desktop_config.get("bucket") or get_minio_bucket(TOS_DESKTOP_DEFAULT_BUCKET_KEY))
    versioned_prefix = str(
        desktop_config.get("payload_versioned_prefix") or TOS_DESKTOP_PAYLOAD_VERSIONED_PREFIX
    ).strip("/")
    filename = str(
        desktop_config.get("payload_filename") or TOS_DESKTOP_PAYLOAD_DEFAULT_FILENAME
    )
    object_key = f"{versioned_prefix}/{normalized_sha}/{filename}"

    try:
        response = get_object_response(bucket, object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"TOS 应用 payload 版本不存在：{normalized_sha}",
        ) from exc

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(
            desktop_config.get("payload_content_type") or TOS_DESKTOP_PAYLOAD_CONTENT_TYPE
        ),
        headers=headers,
        background=BackgroundTask(response.close),
    )
