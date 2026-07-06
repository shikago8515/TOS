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
