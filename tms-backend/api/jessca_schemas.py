from __future__ import annotations

from pydantic import BaseModel, Field


class JesscaResultFile(BaseModel):
    id: int | None = None
    filename: str = ""
    contentType: str = ""
    fileSize: int = 0
    sha256: str = ""
    downloadPath: str = ""


class JesscaProcessResponse(BaseModel):
    success: bool
    message: str = ""
    logs: list[str] = Field(default_factory=list)
    invoice_count: int = 0
    total_items: int = 0
    matches: dict[str, int] = Field(default_factory=dict)
    diagnostics: dict[str, object] = Field(default_factory=dict)
    amount_words_count: int = 0
    amount_words_matched_count: int = 0
    amount_words_issue_count: int = 0
    tc_count: int = 0
    tc_matched_count: int = 0
    tc_issue_count: int = 0
    tc_summary_count: int = 0
    tc_summary_issue_count: int = 0
    tc_total_issue_count: int = 0
    output_file: str = ""
    request_id: str = ""
    history_id: str = ""
    result_file_id: int | None = None
    result_download_path: str = ""
    result_download_backend_target: str = ""
    result_file: JesscaResultFile | None = None
    history_warnings: list[str] = Field(default_factory=list)
