from __future__ import annotations

from pydantic import BaseModel, Field


class IplexDualTableHeader(BaseModel):
    index: int
    letter: str = ""
    label: str = ""
    sample_value: str = ""


class IplexDualTableSheetSummary(BaseModel):
    name: str = ""
    max_row: int = 0
    max_column: int = 0


class IplexDualTableSelectedSheet(BaseModel):
    name: str = ""
    header_row: int = 1
    max_row: int = 0
    max_column: int = 0
    data_row_count: int = 0
    headers: list[IplexDualTableHeader] = Field(default_factory=list)


class IplexDualTableInspectionResponse(BaseModel):
    sheets: list[IplexDualTableSheetSummary] = Field(default_factory=list)
    selected_sheet: IplexDualTableSelectedSheet


class IplexDualTableComparePreviewMetric(BaseModel):
    main_value: str = ""
    lookup_value: str = ""
    difference: str = ""


class IplexDualTableComparePreviewRow(BaseModel):
    row_number: int
    key: str = ""
    status: str = ""
    four_digit: IplexDualTableComparePreviewMetric
    two_digit: IplexDualTableComparePreviewMetric


class IplexDualTableResultFile(BaseModel):
    id: int | None = None
    filename: str = ""
    contentType: str = ""
    fileSize: int = 0
    sha256: str = ""
    downloadPath: str = ""


class IplexDualTableCompareProcessResponse(BaseModel):
    success: bool
    message: str = ""
    logs: list[str] = Field(default_factory=list)
    output_file: str | None = None
    main_row_count: int | None = None
    lookup_row_count: int | None = None
    matched_count: int | None = None
    unmatched_count: int | None = None
    four_digit_mismatch_count: int | None = None
    two_digit_mismatch_count: int | None = None
    preview_rows: list[IplexDualTableComparePreviewRow] | None = None
    request_id: str | None = None
    history_id: str | None = None
    result_file_id: int | None = None
    result_download_path: str | None = None
    result_download_backend_target: str | None = None
    result_file: IplexDualTableResultFile | None = None
    history_warnings: list[str] | None = None
