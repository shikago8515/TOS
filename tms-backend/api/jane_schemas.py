from __future__ import annotations

from pydantic import BaseModel, Field


class JaneResultFile(BaseModel):
    id: int | None = None
    filename: str = ""
    contentType: str = ""
    fileSize: int = 0
    sha256: str = ""
    downloadPath: str = ""


class JaneProcessResponse(BaseModel):
    success: bool
    message: str = ""
    logs: list[str] = Field(default_factory=list)
    working_count: int | None = None
    output_file: str | None = None
    request_id: str | None = None
    history_id: str | None = None
    result_file_id: int | None = None
    result_download_path: str | None = None
    result_download_backend_target: str | None = None
    result_file: JaneResultFile | None = None
    history_warnings: list[str] | None = None


class JaneBomSummaryProcessResponse(BaseModel):
    success: bool
    message: str = ""
    logs: list[str] = Field(default_factory=list)
    bom_count: int | None = None
    row_count: int | None = None
    output_file: str | None = None
    request_id: str | None = None
    history_id: str | None = None
    result_file_id: int | None = None
    result_download_path: str | None = None
    result_download_backend_target: str | None = None
    result_file: JaneResultFile | None = None
    history_warnings: list[str] | None = None


class JaneBomCompareProcessResponse(BaseModel):
    success: bool
    message: str = ""
    logs: list[str] = Field(default_factory=list)
    bom_count: int | None = None
    bom_material_row_count: int | None = None
    checked_row_count: int | None = None
    mismatch_cell_count: int | None = None
    inconsistent_group_count: int | None = None
    extra_material_row_count: int | None = None
    missing_row_count: int | None = None
    rate_row_count: int | None = None
    no_bom_key_count: int | None = None
    output_file: str | None = None
    request_id: str | None = None
    history_id: str | None = None
    result_file_id: int | None = None
    result_download_path: str | None = None
    result_download_backend_target: str | None = None
    result_file: JaneResultFile | None = None
    history_warnings: list[str] | None = None


class JaneOutboundCompareProcessResponse(BaseModel):
    success: bool
    message: str = ""
    logs: list[str] = Field(default_factory=list)
    checked_row_count: int | None = None
    matched_row_count: int | None = None
    missing_tms_row_count: int | None = None
    missing_outbound_row_count: int | None = None
    difference_cell_count: int | None = None
    issue_count: int | None = None
    output_file: str | None = None
    request_id: str | None = None
    history_id: str | None = None
    result_file_id: int | None = None
    result_download_path: str | None = None
    result_download_backend_target: str | None = None
    result_file: JaneResultFile | None = None
    history_warnings: list[str] | None = None
