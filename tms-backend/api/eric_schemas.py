from __future__ import annotations

from pydantic import BaseModel, Field


class EricResultFile(BaseModel):
    id: int | None = None
    filename: str = ""
    contentType: str = ""
    fileSize: int = 0
    sha256: str = ""
    downloadPath: str = ""


class EricProcessResponse(BaseModel):
    success: bool
    message: str = ""
    logs: list[str] = Field(default_factory=list)
    row_count: int | None = None
    output_file: str | None = None
    difference_count: int | None = None
    po_difference_count: int | None = None
    size_check_count: int | None = None
    request_id: str | None = None
    history_id: str | None = None
    result_file_id: int | None = None
    result_download_path: str | None = None
    result_download_backend_target: str | None = None
    result_file: EricResultFile | None = None
    history_warnings: list[str] | None = None
