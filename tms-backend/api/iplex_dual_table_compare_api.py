# -*- coding: utf-8 -*-
"""iPlex 双表数据核对 API Router。"""

from __future__ import annotations

import json
import logging
import os
import shutil
from typing import Any, NoReturn, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from api.iplex_dual_table_compare_schemas import (
    IplexDualTableCompareProcessResponse,
    IplexDualTableInspectionResponse,
)
from modules.iplex_dual_table_compare_module import (
    IplexDualTableCompareConfig,
    IplexDualTableCompareModule,
)
from utils.excel_result_history import archive_process_output_history
from utils.excel_upload_backup import ExcelUploadBackupContext
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_logs,
    sanitize_output_reference,
    validate_upload_filename,
)


router = APIRouter(prefix="/iplex/dual-table-compare", tags=["iPlex 双表核对"])
iplex_dual_table_compare_module = IplexDualTableCompareModule()
logger = logging.getLogger(__name__)

ALLOWED_EXCEL_EXTENSIONS = {".xls", ".xlsx", ".xlsm"}
MODULE_ID = "iplex-dual-table-compare"
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
    logger.exception("iPlex dual-table compare processing failed")
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


@router.post("/inspect", response_model=IplexDualTableInspectionResponse)
async def inspect_iplex_workbook(
    excel_file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    header_row: int = Form(1),
):
    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"iplex_dual_table_inspect_{request_id}")
    os.makedirs(work_dir, exist_ok=True)

    try:
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

        return iplex_dual_table_compare_module.inspect_workbook(
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


@router.post(
    "/process",
    response_model=IplexDualTableCompareProcessResponse,
    response_model_exclude_none=True,
)
async def process_iplex_dual_table_compare(
    main_file: UploadFile = File(...),
    lookup_file: UploadFile = File(...),
    config_json: str = Form(...),
    output_dir: Optional[str] = Form(None),
):
    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"iplex_dual_table_compare_{request_id}")
    os.makedirs(work_dir, exist_ok=True)

    try:
        main_name = _validate_excel_filename(main_file.filename, "主表")
        lookup_name = _validate_excel_filename(lookup_file.filename, "查找表")
        main_path = os.path.join(work_dir, f"main_{main_name}")
        lookup_path = os.path.join(work_dir, f"lookup_{lookup_name}")
        copy_upload_to_path(
            main_file,
            main_path,
            backup_context=_backup_context(
                main_file,
                main_name,
                request_id=request_id,
                file_role="main",
            ),
        )
        copy_upload_to_path(
            lookup_file,
            lookup_path,
            backup_context=_backup_context(
                lookup_file,
                lookup_name,
                request_id=request_id,
                file_role="lookup",
            ),
        )
        config = _parse_config(config_json)

        result = iplex_dual_table_compare_module.process_files(
            main_path=main_path,
            lookup_path=lookup_path,
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
            "logs": sanitize_output_logs(result["logs"], output_path, output_filename),
            "output_file": output_filename,
            "main_row_count": result["main_row_count"],
            "lookup_row_count": result["lookup_row_count"],
            "matched_count": result["matched_count"],
            "unmatched_count": result["unmatched_count"],
            "four_digit_mismatch_count": result["four_digit_mismatch_count"],
            "two_digit_mismatch_count": result["two_digit_mismatch_count"],
            "preview_rows": result["preview_rows"],
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
async def download_iplex_dual_table_compare_result(filename: str):
    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )


def _parse_config(config_json: str) -> IplexDualTableCompareConfig:
    try:
        payload = json.loads(config_json)
    except json.JSONDecodeError as exc:
        raise ValueError("列配置 JSON 无效") from exc

    if not isinstance(payload, dict):
        raise ValueError("列配置 JSON 无效")

    return IplexDualTableCompareConfig(
        main_sheet_name=_read_required_string(payload, "main_sheet_name"),
        lookup_sheet_name=_read_required_string(payload, "lookup_sheet_name"),
        main_header_row=_read_required_int(payload, "main_header_row"),
        lookup_header_row=_read_required_int(payload, "lookup_header_row"),
        main_key_column=_read_required_int(payload, "main_key_column"),
        lookup_key_column=_read_required_int(payload, "lookup_key_column"),
        four_digit_main_column=_read_required_int(payload, "four_digit_main_column"),
        four_digit_lookup_column=_read_required_int(payload, "four_digit_lookup_column"),
        two_digit_main_column=_read_required_int(payload, "two_digit_main_column"),
        two_digit_lookup_column=_read_required_int(payload, "two_digit_lookup_column"),
        four_digit_result_header=_read_optional_string(
            payload,
            "four_digit_result_header",
            "4位小数差值",
        ),
        two_digit_result_header=_read_optional_string(
            payload,
            "two_digit_result_header",
            "2位小数差值",
        ),
    )


def _read_required_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"缺少列配置：{key}")
    return value.strip()


def _read_optional_string(payload: dict[str, Any], key: str, default: str) -> str:
    value = payload.get(key)
    if value is None:
        return default
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"列配置无效：{key}")
    return value.strip()


def _read_required_int(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int):
        raise ValueError(f"缺少列配置：{key}")
    return value
