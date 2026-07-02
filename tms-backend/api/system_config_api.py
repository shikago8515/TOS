from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from app_version import APP_VERSION
from utils.automation_module_manifest import read_automation_module_manifest
from utils.installer_manifest import read_installer_manifest
from utils.minio_storage import get_minio_bucket, get_object_response, object_exists
from utils.settings import get_settings, get_settings_summary, resolve_settings_path


router = APIRouter(prefix="/system/config", tags=["System Config"])

HELPER_DEFAULT_BUCKET_KEY = "downloads"
HELPER_DEFAULT_OBJECT_KEY = "automation-helper/TOS-Automation-Helper-Setup.exe"
HELPER_LEGACY_FILENAME = "TOS-Automation-Helper-Setup.exe"
HELPER_DEFAULT_FILENAME = f"TOS-Automation-Helper-Setup.{APP_VERSION}.exe"
HELPER_CONTENT_TYPE = "application/vnd.microsoft.portable-executable"
HELPER_PAYLOAD_DEFAULT_OBJECT_KEY = "automation-helper/TOS-Automation-Helper-Payload.zip"
HELPER_PAYLOAD_DEFAULT_FILENAME = "TOS-Automation-Helper-Payload.zip"
HELPER_PAYLOAD_CONTENT_TYPE = "application/zip"
HELPER_PAYLOAD_VERSIONED_PREFIX = "automation-helper/payloads"
TOS_DESKTOP_DEFAULT_BUCKET_KEY = "downloads"
TOS_DESKTOP_DEFAULT_OBJECT_KEY = "tos-desktop/TOS-Desktop-Setup.exe"
TOS_DESKTOP_LEGACY_FILENAME = "TOS-Desktop-Setup.exe"
TOS_DESKTOP_DEFAULT_FILENAME = f"TOS-Desktop-Setup.{APP_VERSION}.exe"
TOS_DESKTOP_CONTENT_TYPE = "application/vnd.microsoft.portable-executable"
TOS_DESKTOP_PAYLOAD_DEFAULT_OBJECT_KEY = "tos-desktop/TOS-Desktop-Payload.zip"
TOS_DESKTOP_PAYLOAD_DEFAULT_FILENAME = "TOS-Desktop-Payload.zip"
TOS_DESKTOP_PAYLOAD_CONTENT_TYPE = "application/zip"
TOS_DESKTOP_PAYLOAD_VERSIONED_PREFIX = "tos-desktop/payloads"
TOS_DESKTOP_FULL_DEFAULT_BUCKET_KEY = "downloads"
TOS_DESKTOP_FULL_DEFAULT_OBJECT_KEY = "tos-desktop-full/TOS-Desktop-Full-Setup.exe"
TOS_DESKTOP_FULL_LEGACY_FILENAME = "TOS-Desktop-Full-Setup.exe"
TOS_DESKTOP_FULL_DEFAULT_FILENAME = f"TOS-Desktop-Full-Setup.{APP_VERSION}.exe"
TOS_DESKTOP_FULL_CONTENT_TYPE = "application/vnd.microsoft.portable-executable"
PO_AUTO_DOWNLOAD_TEMPLATE_DEFAULT_BUCKET_KEY = "templates"
PO_AUTO_DOWNLOAD_TEMPLATE_DEFAULT_OBJECT_KEY = "po-auto-download/po-auto-download-template.xls"
PO_AUTO_DOWNLOAD_TEMPLATE_DEFAULT_FILENAME = "PO 自动下载模板.XLS"
PO_AUTO_DOWNLOAD_TEMPLATE_CONTENT_TYPE = "application/vnd.ms-excel"
AUTOMATION_MODULE_DEFAULT_BUCKET_KEY = "downloads"
AUTOMATION_MODULE_CONTENT_TYPE = "application/zip"


def _po_auto_download_template_config() -> dict[str, str]:
    template_config = (
        get_settings()
        .get("downloads", {})
        .get("po_auto_download_template", {})
    )
    return {
        "bucket": str(
            template_config.get("bucket")
            or get_minio_bucket(PO_AUTO_DOWNLOAD_TEMPLATE_DEFAULT_BUCKET_KEY)
        ),
        "object_key": str(
            template_config.get("object_key")
            or PO_AUTO_DOWNLOAD_TEMPLATE_DEFAULT_OBJECT_KEY
        ),
        "filename": str(
            template_config.get("filename")
            or PO_AUTO_DOWNLOAD_TEMPLATE_DEFAULT_FILENAME
        ),
        "content_type": str(
            template_config.get("content_type")
            or PO_AUTO_DOWNLOAD_TEMPLATE_CONTENT_TYPE
        ),
    }


def _versioned_download_filename(configured_filename: Any, legacy_filename: str, versioned_filename: str) -> str:
    filename = str(configured_filename or "")
    if not filename or filename == legacy_filename:
        return versioned_filename
    return filename


def _installer_download_filename(
    package_id: str,
    object_key: str,
    configured_filename: Any,
    legacy_filename: str,
    versioned_filename: str,
) -> str:
    filename = str(configured_filename or "")
    if filename and filename != legacy_filename:
        return filename

    manifest_filename = _manifest_filename_for_stable_object(package_id, object_key)
    if manifest_filename:
        return manifest_filename

    return versioned_filename


def _manifest_filename_for_stable_object(package_id: str, object_key: str) -> str:
    package = _manifest_package_for_stable_object(package_id, object_key)
    return str(package.get("filename") or "").strip()


def _manifest_file_size_for_stable_object(package_id: str, object_key: str) -> int | None:
    package = _manifest_package_for_stable_object(package_id, object_key)
    return _positive_int(package.get("fileSize") or package.get("file_size"))


def _manifest_payload_file_size(package_id: str, object_key: str) -> int | None:
    package = _manifest_package_for_stable_object(package_id, "")
    payload = package.get("payload")
    if not isinstance(payload, dict):
        return None

    payload_object_key = str(payload.get("objectKey") or payload.get("object_key") or "")
    payload_versioned_object_key = str(
        payload.get("versionedObjectKey") or payload.get("versioned_object_key") or ""
    )
    if object_key == payload_object_key:
        return _positive_int(payload.get("fileSize") or payload.get("file_size"))
    if object_key == payload_versioned_object_key:
        return _positive_int(
            payload.get("versionedFileSize")
            or payload.get("versioned_file_size")
            or payload.get("fileSize")
            or payload.get("file_size")
        )
    return None


def _manifest_package_for_stable_object(package_id: str, object_key: str) -> dict[str, Any]:
    manifest = read_installer_manifest()
    packages = manifest.get("packages")
    if not isinstance(packages, dict):
        return {}

    package = packages.get(package_id)
    if not isinstance(package, dict):
        return {}

    package_object_key = str(package.get("objectKey") or package.get("object_key") or "")
    if object_key and package_object_key != object_key:
        return {}

    return package


def _positive_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _object_response_content_length(response: Any, fallback_size: Any = None) -> int | None:
    headers = getattr(response, "headers", None)
    if headers is not None:
        for header_name in ("content-length", "Content-Length"):
            try:
                length = _positive_int(headers.get(header_name))
            except Exception:
                length = None
            if length is not None:
                return length

    for attr_name in ("content_length", "length"):
        length = _positive_int(getattr(response, attr_name, None))
        if length is not None:
            return length

    return _positive_int(fallback_size)


def _add_stream_download_headers(
    headers: dict[str, str],
    response: Any,
    fallback_size: Any = None,
) -> dict[str, str]:
    length = _object_response_content_length(response, fallback_size)
    if length is not None:
        headers["Content-Length"] = str(length)
        headers["Accept-Ranges"] = "bytes"
    return headers


class SystemConfigSummaryResponse(BaseModel):
    settingsFile: str
    settings: dict[str, Any]


class InstallerPackageInfo(BaseModel):
    id: str
    label: str
    version: str
    filename: str
    downloadPath: str
    bucket: str
    objectKey: str
    contentType: str
    fileSize: int | None = None
    sha256: str | None = None
    updatedAt: str | None = None
    versionedObjectKey: str | None = None
    defaultFilename: str | None = None
    payload: dict[str, Any] | None = None
    source: str = "fallback"


class InstallerVersionsResponse(BaseModel):
    ok: bool
    version: str
    manifestUpdatedAt: str | None = None
    packages: list[InstallerPackageInfo]


class AutomationModuleInfo(BaseModel):
    id: str
    name: str
    provider: str = ""
    category: str = "Web Automation"
    version: str
    requiredHelperVersion: str = ""
    description: str = ""
    appDir: str
    entry: str = "bin/start.js"
    defaultPort: int = 3100
    filename: str
    downloadPath: str
    bucket: str
    objectKey: str
    contentType: str
    fileSize: int | None = None
    sha256: str | None = None
    updatedAt: str | None = None
    source: str = "manifest"


class AutomationModulesResponse(BaseModel):
    ok: bool
    version: str
    manifestUpdatedAt: str | None = None
    modules: list[AutomationModuleInfo]


HELPER_INSTALLER_RESPONSE = {
    "description": "TOS automation helper installer download.",
    "content": {HELPER_CONTENT_TYPE: {}},
}
HELPER_PAYLOAD_RESPONSE = {
    "description": "TOS automation helper payload archive download.",
    "content": {HELPER_PAYLOAD_CONTENT_TYPE: {}},
}
TOS_DESKTOP_INSTALLER_RESPONSE = {
    "description": "TOS desktop web installer download.",
    "content": {TOS_DESKTOP_CONTENT_TYPE: {}},
}
TOS_DESKTOP_FULL_INSTALLER_RESPONSE = {
    "description": "TOS desktop full installer download.",
    "content": {TOS_DESKTOP_FULL_CONTENT_TYPE: {}},
}
TOS_DESKTOP_PAYLOAD_RESPONSE = {
    "description": "TOS desktop payload archive download.",
    "content": {TOS_DESKTOP_PAYLOAD_CONTENT_TYPE: {}},
}
PO_AUTO_DOWNLOAD_TEMPLATE_RESPONSE = {
    "description": "PO auto download Excel template.",
    "content": {PO_AUTO_DOWNLOAD_TEMPLATE_CONTENT_TYPE: {}},
}
AUTOMATION_MODULE_RESPONSE = {
    "description": "TOS automation module package download.",
    "content": {AUTOMATION_MODULE_CONTENT_TYPE: {}},
}


@router.get("/summary", response_model=SystemConfigSummaryResponse)
async def config_summary() -> dict[str, Any]:
    return {
        "settingsFile": str(resolve_settings_path()),
        "settings": get_settings_summary(),
    }


@router.get("/installer-versions", response_model=InstallerVersionsResponse)
async def installer_versions() -> dict[str, Any]:
    fallback_packages = _build_fallback_installer_packages()
    manifest = read_installer_manifest()
    manifest_packages = manifest.get("packages")

    if isinstance(manifest_packages, dict):
        for package_id, package in manifest_packages.items():
            if not isinstance(package, dict):
                continue
            fallback = fallback_packages.get(str(package_id), {})
            merged = {**fallback, **package, "id": str(package_id), "source": "manifest"}
            fallback_packages[str(package_id)] = _normalize_installer_package(merged)

    return {
        "ok": True,
        "version": APP_VERSION,
        "manifestUpdatedAt": manifest.get("updatedAt"),
        "packages": [
            fallback_packages["tos-desktop"],
            fallback_packages["tos-desktop-full"],
            fallback_packages["automation-helper"],
        ],
    }


@router.get("/automation-modules", response_model=AutomationModulesResponse)
async def automation_modules() -> dict[str, Any]:
    manifest = read_automation_module_manifest()
    modules = [
        _normalize_automation_module(module_id, module)
        for module_id, module in _automation_module_entries(manifest).items()
    ]
    return {
        "ok": True,
        "version": str(manifest.get("version") or manifest.get("appVersion") or APP_VERSION),
        "manifestUpdatedAt": manifest.get("updatedAt"),
        "modules": modules,
    }


@router.get(
    "/automation-modules/{module_id}/download",
    response_class=StreamingResponse,
    responses={200: AUTOMATION_MODULE_RESPONSE},
)
async def automation_module_download(module_id: str) -> StreamingResponse:
    module = _automation_module_entries(read_automation_module_manifest()).get(module_id)
    if not module:
        raise HTTPException(status_code=404, detail=f"Automation module not found: {module_id}")

    normalized = _normalize_automation_module(module_id, module)
    try:
        response = get_object_response(normalized["bucket"], normalized["objectKey"])
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Automation module package has not been uploaded to MinIO: {module_id}",
        ) from exc

    fallback_filename = f"{module_id}.zip"
    encoded_filename = quote(normalized["filename"])
    headers = {
        "Content-Disposition": (
            f'attachment; filename="{fallback_filename}"; '
            f"filename*=UTF-8''{encoded_filename}"
        ),
        "Cache-Control": "no-store",
    }
    _add_stream_download_headers(headers, response, normalized.get("fileSize"))
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=normalized["contentType"],
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get(
    "/automation-helper/download",
    response_class=StreamingResponse,
    responses={200: HELPER_INSTALLER_RESPONSE},
)
async def automation_helper_download() -> StreamingResponse:
    helper_config = (
        get_settings()
        .get("downloads", {})
        .get("automation_helper", {})
    )
    bucket = str(helper_config.get("bucket") or get_minio_bucket(HELPER_DEFAULT_BUCKET_KEY))
    object_key = str(helper_config.get("object_key") or HELPER_DEFAULT_OBJECT_KEY)
    filename = _installer_download_filename(
        "automation-helper",
        object_key,
        helper_config.get("filename"),
        HELPER_LEGACY_FILENAME,
        HELPER_DEFAULT_FILENAME,
    )

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
    _add_stream_download_headers(
        headers,
        response,
        _manifest_file_size_for_stable_object("automation-helper", object_key),
    )
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(helper_config.get("content_type") or HELPER_CONTENT_TYPE),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get(
    "/automation-helper/payload",
    response_class=StreamingResponse,
    responses={200: HELPER_PAYLOAD_RESPONSE},
)
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
    _add_stream_download_headers(
        headers,
        response,
        _manifest_payload_file_size("automation-helper", object_key),
    )
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(
            helper_config.get("payload_content_type") or HELPER_PAYLOAD_CONTENT_TYPE
        ),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get(
    "/automation-helper/payload/{payload_sha256}",
    response_class=StreamingResponse,
    responses={200: HELPER_PAYLOAD_RESPONSE},
)
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
    _add_stream_download_headers(
        headers,
        response,
        _manifest_payload_file_size("automation-helper", object_key),
    )
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(
            helper_config.get("payload_content_type") or HELPER_PAYLOAD_CONTENT_TYPE
        ),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get(
    "/tos-desktop/download",
    response_class=StreamingResponse,
    responses={200: TOS_DESKTOP_INSTALLER_RESPONSE},
)
async def tos_desktop_download() -> StreamingResponse:
    desktop_config = (
        get_settings()
        .get("downloads", {})
        .get("tos_desktop", {})
    )
    bucket = str(desktop_config.get("bucket") or get_minio_bucket(TOS_DESKTOP_DEFAULT_BUCKET_KEY))
    object_key = str(desktop_config.get("object_key") or TOS_DESKTOP_DEFAULT_OBJECT_KEY)
    filename = _installer_download_filename(
        "tos-desktop",
        object_key,
        desktop_config.get("filename"),
        TOS_DESKTOP_LEGACY_FILENAME,
        TOS_DESKTOP_DEFAULT_FILENAME,
    )

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
    _add_stream_download_headers(
        headers,
        response,
        _manifest_file_size_for_stable_object("tos-desktop", object_key),
    )
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(desktop_config.get("content_type") or TOS_DESKTOP_CONTENT_TYPE),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get(
    "/tos-desktop-full/download",
    response_class=StreamingResponse,
    responses={200: TOS_DESKTOP_FULL_INSTALLER_RESPONSE},
)
async def tos_desktop_full_download() -> StreamingResponse:
    desktop_config = (
        get_settings()
        .get("downloads", {})
        .get("tos_desktop_full", {})
    )
    bucket = str(desktop_config.get("bucket") or get_minio_bucket(TOS_DESKTOP_FULL_DEFAULT_BUCKET_KEY))
    object_key = str(desktop_config.get("object_key") or TOS_DESKTOP_FULL_DEFAULT_OBJECT_KEY)
    filename = _installer_download_filename(
        "tos-desktop-full",
        object_key,
        desktop_config.get("filename"),
        TOS_DESKTOP_FULL_LEGACY_FILENAME,
        TOS_DESKTOP_FULL_DEFAULT_FILENAME,
    )

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
    _add_stream_download_headers(
        headers,
        response,
        _manifest_file_size_for_stable_object("tos-desktop-full", object_key),
    )
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(desktop_config.get("content_type") or TOS_DESKTOP_FULL_CONTENT_TYPE),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get(
    "/tos-desktop/payload",
    response_class=StreamingResponse,
    responses={200: TOS_DESKTOP_PAYLOAD_RESPONSE},
)
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
    _add_stream_download_headers(
        headers,
        response,
        _manifest_payload_file_size("tos-desktop", object_key),
    )
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(
            desktop_config.get("payload_content_type") or TOS_DESKTOP_PAYLOAD_CONTENT_TYPE
        ),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get(
    "/tos-desktop/payload/{payload_sha256}",
    response_class=StreamingResponse,
    responses={200: TOS_DESKTOP_PAYLOAD_RESPONSE},
)
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
    _add_stream_download_headers(
        headers,
        response,
        _manifest_payload_file_size("tos-desktop", object_key),
    )
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=str(
            desktop_config.get("payload_content_type") or TOS_DESKTOP_PAYLOAD_CONTENT_TYPE
        ),
        headers=headers,
        background=BackgroundTask(response.close),
    )


@router.get("/po-auto-download/template/status")
async def po_auto_download_template_status() -> dict[str, Any]:
    config = _po_auto_download_template_config()
    available = object_exists(config["bucket"], config["object_key"])
    return {
        "ok": True,
        "available": available,
        "bucket": config["bucket"],
        "objectKey": config["object_key"],
        "filename": config["filename"],
        "message": "" if available else "PO 自动下载模板未上传，请先上传到 MinIO。",
    }


@router.get(
    "/po-auto-download/template/download",
    response_class=StreamingResponse,
    responses={200: PO_AUTO_DOWNLOAD_TEMPLATE_RESPONSE},
)
async def po_auto_download_template_download() -> StreamingResponse:
    template_config = _po_auto_download_template_config()

    try:
        response = get_object_response(template_config["bucket"], template_config["object_key"])
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail="PO 自动下载模板未上传，请先上传到 MinIO。",
        ) from exc

    fallback_filename = "PO-auto-download-template.xls"
    encoded_filename = quote(template_config["filename"])
    headers = {
        "Content-Disposition": (
            f'attachment; filename="{fallback_filename}"; '
            f"filename*=UTF-8''{encoded_filename}"
        ),
        "Cache-Control": "no-store",
    }
    _add_stream_download_headers(headers, response)
    return StreamingResponse(
        response.stream(64 * 1024),
        media_type=template_config["content_type"],
        headers=headers,
        background=BackgroundTask(response.close),
    )


def _automation_module_entries(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    modules = manifest.get("modules")
    if isinstance(modules, dict):
        return {
            str(module_id): module
            for module_id, module in modules.items()
            if isinstance(module, dict)
        }

    if isinstance(modules, list):
        entries: dict[str, dict[str, Any]] = {}
        for module in modules:
            if not isinstance(module, dict):
                continue
            module_id = str(module.get("id") or "").strip()
            if module_id:
                entries[module_id] = module
        return entries

    return {}


def _normalize_automation_module(module_id: str, module: dict[str, Any]) -> dict[str, Any]:
    safe_module_id = str(module_id or module.get("id") or "").strip()
    version = str(module.get("version") or APP_VERSION)
    filename = str(
        module.get("filename")
        or f"{safe_module_id}.{version}.zip"
    )
    bucket = str(
        module.get("bucket")
        or get_minio_bucket(AUTOMATION_MODULE_DEFAULT_BUCKET_KEY)
    )
    object_key = str(
        module.get("objectKey")
        or module.get("object_key")
        or f"automation-modules/{safe_module_id}/{filename}"
    )
    download_path = str(
        module.get("downloadPath")
        or f"/api/system/config/automation-modules/{quote(safe_module_id, safe='')}/download"
    )
    return {
        "id": safe_module_id,
        "name": str(module.get("name") or safe_module_id),
        "provider": str(module.get("provider") or ""),
        "category": str(module.get("category") or "Web Automation"),
        "version": version,
        "requiredHelperVersion": str(module.get("requiredHelperVersion") or ""),
        "description": str(module.get("description") or ""),
        "appDir": str(module.get("appDir") or safe_module_id),
        "entry": str(module.get("entry") or "bin/start.js"),
        "defaultPort": int(module.get("defaultPort") or module.get("port") or 3100),
        "filename": filename,
        "downloadPath": download_path,
        "bucket": bucket,
        "objectKey": object_key,
        "contentType": str(module.get("contentType") or AUTOMATION_MODULE_CONTENT_TYPE),
        "fileSize": module.get("fileSize") or module.get("file_size"),
        "sha256": module.get("sha256") or module.get("packageSha256"),
        "updatedAt": module.get("updatedAt"),
        "source": str(module.get("source") or "manifest"),
    }


def _build_fallback_installer_packages() -> dict[str, dict[str, Any]]:
    settings = get_settings()
    downloads = settings.get("downloads", {}) if isinstance(settings.get("downloads"), dict) else {}
    helper_config = downloads.get("automation_helper", {}) if isinstance(downloads.get("automation_helper"), dict) else {}
    desktop_config = downloads.get("tos_desktop", {}) if isinstance(downloads.get("tos_desktop"), dict) else {}
    full_config = downloads.get("tos_desktop_full", {}) if isinstance(downloads.get("tos_desktop_full"), dict) else {}

    helper_filename = _versioned_download_filename(
        helper_config.get("filename"),
        HELPER_LEGACY_FILENAME,
        HELPER_DEFAULT_FILENAME,
    )
    desktop_filename = _versioned_download_filename(
        desktop_config.get("filename"),
        TOS_DESKTOP_LEGACY_FILENAME,
        TOS_DESKTOP_DEFAULT_FILENAME,
    )
    full_filename = _versioned_download_filename(
        full_config.get("filename"),
        TOS_DESKTOP_FULL_LEGACY_FILENAME,
        TOS_DESKTOP_FULL_DEFAULT_FILENAME,
    )

    return {
        "tos-desktop": _normalize_installer_package(
            {
                "id": "tos-desktop",
                "label": "TOS Desktop Lightweight Installer",
                "version": _extract_version_from_filename(desktop_filename) or APP_VERSION,
                "filename": desktop_filename,
                "defaultFilename": TOS_DESKTOP_DEFAULT_FILENAME,
                "downloadPath": "/api/system/config/tos-desktop/download",
                "bucket": str(desktop_config.get("bucket") or get_minio_bucket(TOS_DESKTOP_DEFAULT_BUCKET_KEY)),
                "objectKey": str(desktop_config.get("object_key") or TOS_DESKTOP_DEFAULT_OBJECT_KEY),
                "contentType": str(desktop_config.get("content_type") or TOS_DESKTOP_CONTENT_TYPE),
                "source": "fallback",
            }
        ),
        "tos-desktop-full": _normalize_installer_package(
            {
                "id": "tos-desktop-full",
                "label": "TOS Desktop Full Installer",
                "version": _extract_version_from_filename(full_filename) or APP_VERSION,
                "filename": full_filename,
                "defaultFilename": TOS_DESKTOP_FULL_DEFAULT_FILENAME,
                "downloadPath": "/api/system/config/tos-desktop-full/download",
                "bucket": str(full_config.get("bucket") or get_minio_bucket(TOS_DESKTOP_FULL_DEFAULT_BUCKET_KEY)),
                "objectKey": str(full_config.get("object_key") or TOS_DESKTOP_FULL_DEFAULT_OBJECT_KEY),
                "contentType": str(full_config.get("content_type") or TOS_DESKTOP_FULL_CONTENT_TYPE),
                "source": "fallback",
            }
        ),
        "automation-helper": _normalize_installer_package(
            {
                "id": "automation-helper",
                "label": "TOS Web Automation Helper",
                "version": _extract_version_from_filename(helper_filename) or APP_VERSION,
                "filename": helper_filename,
                "defaultFilename": HELPER_DEFAULT_FILENAME,
                "downloadPath": "/api/system/config/automation-helper/download",
                "bucket": str(helper_config.get("bucket") or get_minio_bucket(HELPER_DEFAULT_BUCKET_KEY)),
                "objectKey": str(helper_config.get("object_key") or HELPER_DEFAULT_OBJECT_KEY),
                "contentType": str(helper_config.get("content_type") or HELPER_CONTENT_TYPE),
                "source": "fallback",
            }
        ),
    }


def _normalize_installer_package(package: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(package.get("id") or ""),
        "label": str(package.get("label") or ""),
        "version": str(package.get("version") or APP_VERSION),
        "filename": str(package.get("filename") or package.get("defaultFilename") or ""),
        "downloadPath": str(package.get("downloadPath") or ""),
        "bucket": str(package.get("bucket") or ""),
        "objectKey": str(package.get("objectKey") or package.get("object_key") or ""),
        "contentType": str(package.get("contentType") or package.get("content_type") or "application/octet-stream"),
        "fileSize": package.get("fileSize") or package.get("file_size"),
        "sha256": package.get("sha256"),
        "updatedAt": package.get("updatedAt"),
        "versionedObjectKey": package.get("versionedObjectKey") or package.get("versioned_object_key"),
        "defaultFilename": package.get("defaultFilename"),
        "payload": package.get("payload") if isinstance(package.get("payload"), dict) else None,
        "source": str(package.get("source") or "fallback"),
    }


def _extract_version_from_filename(filename: str) -> str:
    stem = str(filename or "").strip().replace("\\", "/").rsplit("/", 1)[-1]
    for suffix in (".exe", ".zip"):
        if stem.lower().endswith(suffix):
            stem = stem[: -len(suffix)]
            break
    match = re.search(r"(\d+\.\d+\.\d+(?:-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)?)$", stem)
    return match.group(1) if match else ""
