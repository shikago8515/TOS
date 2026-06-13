from __future__ import annotations

from pydantic import BaseModel, Field


class JasonPdfReorderHealthResponse(BaseModel):
    status: str


class JasonPdfReorderEntryPayload(BaseModel):
    index: int
    po: str
    invoicePages: list[int] = Field(default_factory=list)
    poPages: list[int] = Field(default_factory=list)
    workingNo: str = ""
    articleNo: str = ""
    description: str = ""
    quantity: str | None = None
    unitPrice: str | None = None
    totalAmount: str | None = None
    netAmount: str | None = None
    shasVasPrice: str | None = None
    merchandiseAmount: str | None = None
    totalAdjustment: str | None = None
    totalTaxes: str | None = None
    orderTotal: str | None = None
    status: str


class JasonPdfReorderSummaryPayload(BaseModel):
    invoicePoCount: int | None = None
    outputPoCount: int | None = None
    missingPoNumbers: list[str] = Field(default_factory=list)
    extraPoNumbers: list[str] = Field(default_factory=list)
    totalQuantity: str | None = None
    totalAmount: str | None = None
    totalNetAmount: str | None = None
    totalShasVasPrice: str | None = None
    totalMerchandiseAmount: str | None = None
    totalAdjustment: str | None = None
    totalTaxes: str | None = None
    orderTotal: str | None = None
    invoiceTotals: dict[str, str | None] = Field(default_factory=dict)


class JasonPdfReorderPreviewResponse(BaseModel):
    entries: list[JasonPdfReorderEntryPayload]
    summary: JasonPdfReorderSummaryPayload
    logs: list[str] = Field(default_factory=list)


class JasonPdfReorderPoPageGroup(BaseModel):
    po: str
    pages: list[int]


class JasonPdfReorderPoPreviewResponse(BaseModel):
    poPages: list[JasonPdfReorderPoPageGroup]
    poCount: int
    pageCount: int
    logs: list[str] = Field(default_factory=list)


class JasonPdfReorderExtractPage(BaseModel):
    pageNum: int
    numbers: list[str]


class JasonPdfReorderExtractFile(BaseModel):
    fileName: str
    pages: list[JasonPdfReorderExtractPage]


class JasonPdfReorderExtractResponse(BaseModel):
    files: list[JasonPdfReorderExtractFile]
    numbers: list[str]
    count: int
    logs: list[str] = Field(default_factory=list)


class JasonPdfReorderProcessResponse(BaseModel):
    jobId: str
    fileName: str
    downloadUrl: str
    summary: JasonPdfReorderSummaryPayload
    entries: list[JasonPdfReorderEntryPayload]
    logs: list[str] = Field(default_factory=list)
