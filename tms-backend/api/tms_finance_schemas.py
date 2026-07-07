from __future__ import annotations

from pydantic import BaseModel, Field


class TmsFinanceResultFile(BaseModel):
    id: int | None = None
    filename: str = ""
    contentType: str = ""
    fileSize: int = 0
    sha256: str = ""
    downloadPath: str = ""


class TmsFinanceInternalReconciliationTotals(BaseModel):
    quantity: int | float | None = None
    purchase_amount: int | float | None = None
    sales_amount_with_tax: int | float | None = None


class TmsFinanceInternalReconciliationSourceSummary(BaseModel):
    sample_rows: int | None = None
    bulk_rows: int | None = None
    source_rows: int | None = None
    source_files: int | None = None


class TmsFinanceInternalReconciliationProcessResponse(BaseModel):
    success: bool
    message: str = ""
    logs: list[str] = Field(default_factory=list)
    output_file: str | None = None
    updated_count: int | None = None
    source_row_count: int | None = None
    target_row_count: int | None = None
    excluded_rows: list[int] | None = None
    excluded_columns: list[int] | None = None
    appended_count: int | None = None
    skipped_count: int | None = None
    duplicate_count: int | None = None
    similar_count: int | None = None
    diagnostic_count: int | None = None
    diagnostics: list[dict[str, object]] | None = None
    totals: TmsFinanceInternalReconciliationTotals | None = None
    source_summary: TmsFinanceInternalReconciliationSourceSummary | None = None
    request_id: str | None = None
    history_id: str | None = None
    result_file_id: int | None = None
    result_download_path: str | None = None
    result_download_backend_target: str | None = None
    result_file: TmsFinanceResultFile | None = None
    history_warnings: list[str] | None = None


class TmsFinanceWorkSalesTotals(BaseModel):
    sales_written_count: int | None = None
    purchase_written_count: int | None = None
    cleared_sales_count: int | None = None
    cleared_purchase_count: int | None = None
    sales_appended_count: int | None = None
    purchase_appended_count: int | None = None


class TmsFinanceWorkSalesSourceSummary(BaseModel):
    source_rows: int | None = None
    sales_rows: int | None = None
    purchase_rows: int | None = None
    sales_written_rows: int | None = None
    purchase_written_rows: int | None = None
    cleared_sales_rows: int | None = None
    cleared_purchase_rows: int | None = None
    duplicate_rows: int | None = None


class TmsFinanceWorkSalesProcessResponse(BaseModel):
    success: bool
    message: str = ""
    logs: list[str] = Field(default_factory=list)
    output_file: str | None = None
    extracted_count: int | None = None
    source_row_count: int | None = None
    sales_written_count: int | None = None
    purchase_written_count: int | None = None
    cleared_sales_count: int | None = None
    cleared_purchase_count: int | None = None
    sales_appended_count: int | None = None
    purchase_appended_count: int | None = None
    duplicate_count: int | None = None
    diagnostic_count: int | None = None
    diagnostics: list[dict[str, object]] | None = None
    totals: TmsFinanceWorkSalesTotals | None = None
    source_summary: TmsFinanceWorkSalesSourceSummary | None = None
    request_id: str | None = None
    history_id: str | None = None
    result_file_id: int | None = None
    result_download_path: str | None = None
    result_download_backend_target: str | None = None
    result_file: TmsFinanceResultFile | None = None
    history_warnings: list[str] | None = None
