from __future__ import annotations

import logging
import os
import re
import shutil
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.it_invoice_pdf_reorder_module import (
    build_reordered_pdf,
    extract_pdf_pages_text,
    normalize_po_order,
    parse_invoice_pdf,
    parse_po_pdf_pages,
)


router = APIRouter(prefix="/it-invoice-pdf-reorder", tags=["IT Invoice PDF Reorder"])
logger = logging.getLogger(__name__)

DATA_ROOT = Path(
    os.environ.get("TMS_BACKEND_DATA_DIR", Path(__file__).resolve().parents[1])
) / "it_invoice_pdf_reorder"
RUNTIME_DIR = DATA_ROOT / "runtime"
JOBS_DIR = RUNTIME_DIR / "jobs"
PREVIEWS_DIR = RUNTIME_DIR / "previews"
EXTRACTS_DIR = RUNTIME_DIR / "extracts"


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/preview-invoice")
async def preview_invoice(invoice_pdf: UploadFile = File(...)) -> dict[str, Any]:
    ensure_pdf(invoice_pdf, "发票PDF")
    logs = [f"收到发票PDF：{invoice_pdf.filename or 'invoice.pdf'}"]

    preview_dir = PREVIEWS_DIR / uuid.uuid4().hex
    preview_dir.mkdir(parents=True, exist_ok=True)
    invoice_path = preview_dir / safe_filename(invoice_pdf.filename or "invoice.pdf")

    try:
        await save_upload(invoice_pdf, invoice_path)
        logs.append(f"发票PDF已保存到临时目录，大小 {invoice_path.stat().st_size} 字节")
        entries, totals = parse_invoice_pdf(invoice_path)
        logs.append(f"发票解析完成，识别到 {len(entries)} 个PO")
        logs.append(
            "数量合计 "
            + str(sum((entry.quantity for entry in entries), Decimal("0")))
            + "，净额合计 "
            + str(sum((entry.net_amount or Decimal("0") for entry in entries), Decimal("0")))
        )
        if not entries:
            raise RuntimeError("没有从发票PDF中识别到PO明细")
        return {
            "entries": [entry_to_payload(idx, entry) for idx, entry in enumerate(entries, 1)],
            "summary": build_invoice_preview_summary(entries, totals),
            "logs": logs,
        }
    except Exception as exc:
        logs.append("处理失败：" + str(exc))
        logger.exception("Invoice PDF preview failed")
        raise HTTPException(status_code=400, detail={"message": str(exc), "logs": logs}) from exc
    finally:
        shutil.rmtree(preview_dir, ignore_errors=True)


@router.post("/preview-po")
async def preview_po(po_pdf: UploadFile = File(...)) -> dict[str, Any]:
    ensure_pdf(po_pdf, "PO PDF")
    logs = [f"收到PO PDF：{po_pdf.filename or 'po.pdf'}"]

    preview_dir = PREVIEWS_DIR / uuid.uuid4().hex
    preview_dir.mkdir(parents=True, exist_ok=True)
    po_path = preview_dir / safe_filename(po_pdf.filename or "po.pdf")

    try:
        await save_upload(po_pdf, po_path)
        logs.append(f"PO PDF已保存到临时目录，大小 {po_path.stat().st_size} 字节")
        po_pages = parse_po_pdf_pages(po_path)
        logs.append(f"PO页码识别完成，识别到 {len(po_pages)} 个PO")
        if not po_pages:
            raise RuntimeError("没有从PO PDF中识别到PO页码")
        return {
            "poPages": [{"po": po, "pages": pages} for po, pages in po_pages.items()],
            "poCount": len(po_pages),
            "pageCount": sum(len(pages) for pages in po_pages.values()),
            "logs": logs,
        }
    except Exception as exc:
        logs.append("处理失败：" + str(exc))
        logger.exception("PO PDF preview failed")
        raise HTTPException(status_code=400, detail={"message": str(exc), "logs": logs}) from exc
    finally:
        shutil.rmtree(preview_dir, ignore_errors=True)


@router.post("/extract-numbers")
async def extract_numbers(
    files: list[UploadFile] | None = File(None),
    pattern: str = Form("090|45"),
    search_type: str = Form("startsWith"),
) -> dict[str, Any]:
    if not files:
        raise HTTPException(status_code=400, detail="请上传至少一个PDF文件")

    try:
        regex = build_number_regex(pattern, search_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    logs = [f"开始自定义数字提取：规则={pattern}，类型={search_type}，文件数={len(files)}"]
    extract_dir = EXTRACTS_DIR / uuid.uuid4().hex
    extract_dir.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    ordered_numbers: list[str] = []
    file_results: list[dict[str, Any]] = []

    try:
        for upload in files:
            ensure_pdf(upload, "提取PDF")
            path = extract_dir / safe_filename(upload.filename or "extract.pdf")
            await save_upload(upload, path)
            logs.append(f"解析文件：{upload.filename or path.name}")

            page_results: list[dict[str, Any]] = []
            for page_num, text in enumerate(extract_pdf_pages_text(path), 1):
                numbers = []
                for value in extract_numbers_from_text(text, regex):
                    if value not in seen:
                        seen.add(value)
                        ordered_numbers.append(value)
                        numbers.append(value)
                if numbers:
                    page_results.append({"pageNum": page_num, "numbers": numbers})
                    logs.append(f"{upload.filename or path.name} 第 {page_num} 页提取到 {len(numbers)} 个新号码")

            file_results.append({"fileName": upload.filename or path.name, "pages": page_results})

        logs.append(f"自定义数字提取完成，共 {len(ordered_numbers)} 个去重号码")
        return {
            "files": file_results,
            "numbers": ordered_numbers,
            "count": len(ordered_numbers),
            "logs": logs,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logs.append("处理失败：" + str(exc))
        logger.exception("Number extraction failed")
        raise HTTPException(status_code=400, detail={"message": str(exc), "logs": logs}) from exc
    finally:
        shutil.rmtree(extract_dir, ignore_errors=True)


@router.post("/process")
async def process_pdfs(
    invoice_pdf: UploadFile = File(...),
    po_pdf: UploadFile = File(...),
    po_order_text: str | None = Form(None),
    print_current_only: str = Form("true"),
    print_next_page: str = Form("true"),
    include_not_found: str = Form("false"),
) -> dict[str, Any]:
    ensure_pdf(invoice_pdf, "发票PDF")
    ensure_pdf(po_pdf, "PO PDF")
    logs = [
        f"开始生成重排PDF：发票={invoice_pdf.filename or 'invoice.pdf'}，PO={po_pdf.filename or 'po.pdf'}",
        f"选项：当前页={parse_bool(print_current_only, True)}，下一页={parse_bool(print_next_page, True)}",
    ]

    job_id = uuid.uuid4().hex
    job_dir = JOBS_DIR / job_id
    upload_dir = job_dir / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    invoice_path = upload_dir / safe_filename(invoice_pdf.filename or "invoice.pdf")
    po_path = upload_dir / safe_filename(po_pdf.filename or "po.pdf")
    output_path = job_dir / "PO按发票顺序重排_含汇总页.pdf"

    try:
        await save_upload(invoice_pdf, invoice_path)
        await save_upload(po_pdf, po_path)
        logs.append("上传文件已写入任务目录")
        po_order = normalize_po_order([po_order_text]) if po_order_text else None
        logs.append(f"前端PO顺序数量：{len(po_order) if po_order else '未指定，使用发票顺序'}")
        result = build_reordered_pdf(
            invoice_path,
            po_path,
            output_path,
            po_order=po_order,
            print_current_only=parse_bool(print_current_only, True),
            print_next_page=parse_bool(print_next_page, True),
        )
        logs.append(f"PDF生成完成，输出PO数量 {len(result.invoice_entries) - len(result.missing_po_numbers)}")
        if result.missing_po_numbers:
            logs.append("发票中有但PO PDF未找到：" + ", ".join(result.missing_po_numbers))
        if result.extra_po_numbers:
            logs.append("PO PDF中有但发票未包含，已跳过：" + ", ".join(result.extra_po_numbers))
    except Exception as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        logs.append("处理失败：" + str(exc))
        logger.exception("PDF reorder failed")
        raise HTTPException(status_code=400, detail={"message": str(exc), "logs": logs}) from exc

    return {
        "jobId": job_id,
        "fileName": output_path.name,
        "downloadUrl": f"/api/it-invoice-pdf-reorder/download/{job_id}",
        "summary": build_summary(result),
        "entries": [entry_to_payload(idx, entry, result.po_pages) for idx, entry in enumerate(result.invoice_entries, 1)],
        "logs": logs,
    }


@router.get("/download/{job_id}")
def download_result(job_id: str) -> FileResponse:
    if not job_id or not all(ch in "0123456789abcdef" for ch in job_id.lower()):
        raise HTTPException(status_code=404, detail="结果不存在")

    output_path = JOBS_DIR / job_id / "PO按发票顺序重排_含汇总页.pdf"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="结果不存在")

    return FileResponse(
        path=output_path,
        media_type="application/pdf",
        filename=output_path.name,
    )


def ensure_pdf(upload: UploadFile, label: str) -> None:
    name = upload.filename or ""
    content_type = upload.content_type or ""
    safe_filename(name or f"{label}.pdf")
    if not name.lower().endswith(".pdf") and content_type != "application/pdf":
        raise HTTPException(status_code=400, detail=f"{label}必须是PDF文件")


async def save_upload(upload: UploadFile, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb") as fh:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            fh.write(chunk)


def safe_filename(filename: str) -> str:
    cleaned = Path(filename).name.strip()
    if cleaned != filename.strip() or not cleaned or cleaned in {".", ".."}:
        raise HTTPException(status_code=400, detail="文件名无效")
    cleaned = "".join(ch for ch in cleaned if ch not in '<>:"/\\|?*')
    if not cleaned.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持PDF文件")
    return cleaned


def parse_bool(value: str | bool | None, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def build_number_regex(pattern: str, search_type: str) -> re.Pattern[str]:
    cleaned = (pattern or "").strip()
    if not cleaned:
        raise ValueError("提取规则不能为空")

    if search_type == "startsWith":
        prefixes = [item.strip() for item in cleaned.split("|") if item.strip()]
        if not prefixes:
            raise ValueError("开头匹配规则不能为空")
        source = r"\b(?:" + "|".join(re.escape(item) for item in prefixes) + r")\d*\b"
    elif search_type == "contains":
        source = r"\b\d*" + re.escape(cleaned) + r"\d*\b"
    elif search_type == "exact":
        values = [item.strip() for item in cleaned.split("|") if item.strip()]
        if not values:
            raise ValueError("精确匹配规则不能为空")
        source = r"\b(?:" + "|".join(re.escape(item) for item in values) + r")\b"
    elif search_type == "regex":
        source = cleaned
    else:
        raise ValueError(f"不支持的提取类型：{search_type}")

    return re.compile(source)


def extract_numbers_from_text(text: str, regex: re.Pattern[str]) -> list[str]:
    values: list[str] = []
    for match in regex.finditer(text or ""):
        value = match.group(1) if match.groups() else match.group(0)
        value = value.strip()
        if value:
            values.append(value)
    return values


def build_summary(result: Any) -> dict[str, Any]:
    total_quantity = sum((entry.quantity for entry in result.invoice_entries), Decimal("0"))
    total_amount = sum((entry.total_amount for entry in result.invoice_entries), Decimal("0"))
    net_values = [entry.net_amount for entry in result.invoice_entries if entry.net_amount is not None]
    total_net_amount = sum(net_values, Decimal("0")) if net_values else None

    return {
        "invoicePoCount": len(result.invoice_entries),
        "outputPoCount": len(result.invoice_entries) - len(result.missing_po_numbers),
        "missingPoNumbers": result.missing_po_numbers,
        "extraPoNumbers": result.extra_po_numbers,
        "totalQuantity": decimal_to_text(total_quantity),
        "totalAmount": decimal_to_text(total_amount),
        "totalNetAmount": decimal_to_text(total_net_amount),
        "invoiceTotals": {key: decimal_to_text(value) for key, value in result.invoice_totals.items()},
    }


def build_invoice_preview_summary(entries: list[Any], totals: dict[str, Decimal]) -> dict[str, Any]:
    total_quantity = sum((entry.quantity for entry in entries), Decimal("0"))
    total_amount = sum((entry.total_amount for entry in entries), Decimal("0"))
    net_values = [entry.net_amount for entry in entries if entry.net_amount is not None]
    total_net_amount = sum(net_values, Decimal("0")) if net_values else None

    return {
        "invoicePoCount": len(entries),
        "totalQuantity": decimal_to_text(total_quantity),
        "totalAmount": decimal_to_text(total_amount),
        "totalNetAmount": decimal_to_text(total_net_amount),
        "invoiceTotals": {key: decimal_to_text(value) for key, value in totals.items()},
    }


def entry_to_payload(idx: int, entry: Any, po_pages: dict[str, list[int]] | None = None) -> dict[str, Any]:
    pages = po_pages.get(entry.po, []) if po_pages else []
    return {
        "index": idx,
        "po": entry.po,
        "invoicePages": entry.invoice_pages or [],
        "poPages": pages,
        "workingNo": entry.working_no,
        "articleNo": entry.article_no,
        "description": entry.description,
        "quantity": decimal_to_text(entry.quantity),
        "unitPrice": decimal_to_text(entry.unit_price),
        "totalAmount": decimal_to_text(entry.total_amount),
        "netAmount": decimal_to_text(entry.net_amount),
        "status": "found" if pages else "missing",
    }


def decimal_to_text(value: Decimal | None) -> str | None:
    if value is None:
        return None
    if value == value.to_integral():
        return str(value.quantize(Decimal("1")))
    return format(value.normalize(), "f")
