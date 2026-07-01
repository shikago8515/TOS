# -*- coding: utf-8 -*-
"""Generic Excel template mapper API router."""

from __future__ import annotations

import json
import logging
import os
import shutil
from typing import Any, NoReturn, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.excel_template_mapper_module import (
    ExcelTemplateFieldMapping,
    ExcelTemplateMapperConfig,
    ExcelTemplateMapperModule,
)
from utils.excel_result_history import archive_process_output_history
from utils.excel_upload_backup import ExcelUploadBackupContext
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_reference,
    validate_upload_filename,
)
from utils.minio_storage import get_object_response
from utils.mysql_store import get_excel_template


router = APIRouter(prefix="/excel-template-mapper", tags=["通用 Excel 映射测试"])
excel_template_mapper_module = ExcelTemplateMapperModule()
logger = logging.getLogger(__name__)

MODULE_ID = "excel-template-mapper-test"
ALLOWED_EXCEL_EXTENSIONS = {".xls", ".xlsx", ".xlsm"}
PROCESSING_ERROR_MESSAGE = "处理失败，请查看诊断日志或稍后重试"

UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _validate_excel_filename(filename: Optional[str], label: str) -> str:
    try:
        return validate_upload_filename(filename, ALLOWED_EXCEL_EXTENSIONS, label)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _download_path(filename: str) -> str:
    try:
        return resolve_download_path(UPLOAD_DIR, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _copy_output_to_upload_dir(output_path: str) -> str:
    try:
        return copy_output_to_directory(output_path, UPLOAD_DIR)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc


def _raise_processing_error(exc: Exception) -> NoReturn:
    logger.exception("Excel template mapper processing failed")
    raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc


def _backup_context(
    upload: UploadFile,
    safe_name: str,
    *,
    request_id: str,
    file_role: str,
) -> ExcelUploadBackupContext:
    return ExcelUploadBackupContext(
        module_id=MODULE_ID,
        request_id=request_id,
        file_role=file_role,
        original_filename=safe_name,
        content_type=getattr(upload, "content_type", "") or "",
    )


@router.post("/inspect")
async def inspect_excel_template_mapper_workbook(
    excel_file: UploadFile | None = File(None),
    template_id: Optional[int] = Form(None),
    sheet_name: Optional[str] = Form(None),
    header_row: int = Form(1),
):
    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"excel_template_mapper_inspect_{request_id}")
    os.makedirs(work_dir, exist_ok=True)

    try:
        excel_path = _resolve_inspect_workbook_path(
            work_dir=work_dir,
            request_id=request_id,
            excel_file=excel_file,
            template_id=template_id,
        )
        return excel_template_mapper_module.inspect_workbook(
            excel_path,
            sheet_name=sheet_name,
            header_row=header_row,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        _raise_processing_error(exc)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.post("/process")
async def process_excel_template_mapper_files(
    source_file: UploadFile = File(...),
    template_file: UploadFile | None = File(None),
    template_id: Optional[int] = Form(None),
    config_json: str = Form(...),
    output_dir: Optional[str] = Form(None),
):
    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"excel_template_mapper_{request_id}")
    os.makedirs(work_dir, exist_ok=True)

    try:
        source_name = _validate_excel_filename(source_file.filename, "源文件")
        source_path = os.path.join(work_dir, f"source_{source_name}")
        copy_upload_to_path(
            source_file,
            source_path,
            backup_context=_backup_context(
                source_file,
                source_name,
                request_id=request_id,
                file_role="source",
            ),
        )

        template_path = _resolve_process_template_path(
            work_dir=work_dir,
            request_id=request_id,
            template_file=template_file,
            template_id=template_id,
        )
        config = _parse_config(config_json)

        result = excel_template_mapper_module.process_files(
            source_path=source_path,
            template_path=template_path,
            config=config,
            output_dir=output_dir if output_dir else UPLOAD_DIR,
        )
        output_path = result["output_path"]
        output_filename = _copy_output_to_upload_dir(output_path)
        public_message = sanitize_output_reference(
            result["message"],
            output_path,
            output_filename,
        )

        return {
            "success": True,
            "message": public_message,
            "output_file": output_filename,
            "source_row_count": result["source_row_count"],
            "written_row_count": result["written_row_count"],
            "mapped_field_count": result["mapped_field_count"],
            "unmapped_required_fields": result["unmapped_required_fields"],
            **archive_process_output_history(
                upload_dir=UPLOAD_DIR,
                module_id=MODULE_ID,
                request_id=request_id,
                output_filename=output_filename,
            ),
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        _raise_processing_error(exc)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.get("/download/{filename}")
async def download_excel_template_mapper_result(filename: str):
    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )


def _resolve_inspect_workbook_path(
    *,
    work_dir: str,
    request_id: str,
    excel_file: UploadFile | None,
    template_id: int | None,
) -> str:
    if excel_file is not None:
        excel_name = _validate_excel_filename(excel_file.filename, "Excel 文件")
        excel_path = os.path.join(work_dir, excel_name)
        copy_upload_to_path(
            excel_file,
            excel_path,
            backup_context=_backup_context(
                excel_file,
                excel_name,
                request_id=request_id,
                file_role="inspect_excel",
            ),
        )
        return excel_path

    if template_id is not None:
        return _copy_template_record_to_path(template_id, work_dir)

    raise HTTPException(status_code=400, detail="请上传 Excel 文件或选择模板")


def _resolve_process_template_path(
    *,
    work_dir: str,
    request_id: str,
    template_file: UploadFile | None,
    template_id: int | None,
) -> str:
    if template_file is not None:
        template_name = _validate_excel_filename(template_file.filename, "模板文件")
        template_path = os.path.join(work_dir, f"template_{template_name}")
        copy_upload_to_path(
            template_file,
            template_path,
            backup_context=_backup_context(
                template_file,
                template_name,
                request_id=request_id,
                file_role="template",
            ),
        )
        return template_path

    if template_id is not None:
        return _copy_template_record_to_path(template_id, work_dir)

    raise HTTPException(status_code=400, detail="请上传模板文件或选择模板")


def _copy_template_record_to_path(template_id: int, work_dir: str) -> str:
    row = get_excel_template(template_id)
    if not row:
        raise HTTPException(status_code=404, detail="模板不存在或已停用")

    filename = _validate_excel_filename(row.get("original_filename") or f"template-{template_id}.xlsx", "模板文件")
    target_path = os.path.join(work_dir, f"template_record_{template_id}_{filename}")
    response = get_object_response(row["bucket"], row["object_key"])
    try:
        with open(target_path, "wb") as file_obj:
            for chunk in response.stream(32 * 1024):
                file_obj.write(chunk)
    finally:
        if hasattr(response, "close"):
            response.close()
        if hasattr(response, "release_conn"):
            response.release_conn()
    return target_path


def _parse_config(config_json: str) -> ExcelTemplateMapperConfig:
    try:
        payload = json.loads(config_json)
    except json.JSONDecodeError as exc:
        raise ValueError("字段映射 JSON 无效") from exc

    if not isinstance(payload, dict):
        raise ValueError("字段映射 JSON 无效")

    mappings_payload = payload.get("mappings")
    if not isinstance(mappings_payload, list):
        raise ValueError("缺少字段映射")

    return ExcelTemplateMapperConfig(
        source_sheet_name=_read_required_string(payload, "source_sheet_name"),
        template_sheet_name=_read_required_string(payload, "template_sheet_name"),
        source_header_row=_read_required_int(payload, "source_header_row"),
        source_data_start_row=_read_required_int(payload, "source_data_start_row"),
        template_header_row=_read_required_int(payload, "template_header_row"),
        template_data_start_row=_read_required_int(payload, "template_data_start_row"),
        mappings=[_parse_mapping(item) for item in mappings_payload],
    )


def _parse_mapping(value: Any) -> ExcelTemplateFieldMapping:
    if not isinstance(value, dict):
        raise ValueError("字段映射无效")
    return ExcelTemplateFieldMapping(
        target_column=_read_required_int(value, "target_column"),
        source_column=_read_required_int(value, "source_column"),
        target_header=_read_optional_string(value, "target_header", ""),
        source_header=_read_optional_string(value, "source_header", ""),
        required=_read_optional_bool(value, "required", True),
    )


def _read_required_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"缺少字段映射配置：{key}")
    return value.strip()


def _read_optional_string(payload: dict[str, Any], key: str, default: str) -> str:
    value = payload.get(key)
    if value is None:
        return default
    if not isinstance(value, str):
        raise ValueError(f"字段映射配置无效：{key}")
    return value.strip()


def _read_required_int(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int):
        raise ValueError(f"缺少字段映射配置：{key}")
    return value


def _read_optional_bool(payload: dict[str, Any], key: str, default: bool) -> bool:
    value = payload.get(key)
    if value is None:
        return default
    if not isinstance(value, bool):
        raise ValueError(f"字段映射配置无效：{key}")
    return value
