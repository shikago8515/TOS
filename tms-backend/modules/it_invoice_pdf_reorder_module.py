from __future__ import annotations

import argparse
import re
import sys
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


PO_ROW_RE = re.compile(r"(?m)^(?P<line>(?P<po>\d{10})\s+\d+\s+\S+\s+\S+.+)$")
ORDER_NUMBER_RE = re.compile(r"Order\s+Number\s+Version\s+(\d{10})\s+\d+", re.I)
MONEY_RE = re.compile(r"^-?\d[\d,]*(?:\.\d+)?$")
SHAS_VAS_RE = re.compile(
    r"\b(?:ZPSH\s+)?SHAS\s+price\s+"
    r"(?P<unit_price>-?\d[\d,]*(?:\.\d+)?)\s+CNY\s+per\s+Unit\s+"
    r"(?P<quantity>[\d,]+(?:\.\d+)?)\s+"
    r"(?P<amount>-?\d[\d,]*(?:\.\d+)?)",
    re.I | re.S,
)


@dataclass
class InvoiceEntry:
    po: str
    working_no: str = ""
    article_no: str = ""
    description: str = ""
    gender: str = ""
    category: str = ""
    quantity: Decimal = Decimal("0")
    unit_price: Decimal | None = None
    total_amount: Decimal = Decimal("0")
    net_amount: Decimal | None = None
    shas_vas_price: Decimal | None = None
    merchandise_amount: Decimal = Decimal("0")
    total_adjustment: Decimal = Decimal("0")
    total_taxes: Decimal | None = None
    order_total: Decimal | None = None
    invoice_pages: list[int] | None = None
    line_count: int = 1


@dataclass
class ParseResult:
    invoice_entries: list[InvoiceEntry]
    invoice_totals: dict[str, Decimal]
    po_pages: dict[str, list[int]]
    extra_po_numbers: list[str]
    missing_po_numbers: list[str]


def configure_stdout() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def to_decimal(value: str | None, default: Decimal = Decimal("0")) -> Decimal:
    if not value:
        return default
    try:
        return Decimal(value.replace(",", "").strip())
    except (InvalidOperation, AttributeError):
        return default


def format_decimal(value: Decimal | None, places: int = 2) -> str:
    if value is None:
        return "-"
    quantum = Decimal("1") if places == 0 else Decimal("1").scaleb(-places)
    rounded = value.quantize(quantum)
    return f"{rounded:,.{places}f}"


def format_quantity(value: Decimal | None) -> str:
    if value is None:
        return "-"
    if value == value.to_integral():
        return f"{value:,.0f}"
    return f"{value:,.3f}".rstrip("0").rstrip(".")


def extract_pdf_pages_text(path: Path) -> list[str]:
    reader = PdfReader(str(path))
    return [page.extract_text() or "" for page in reader.pages]


def parse_invoice_pdf(invoice_pdf: Path) -> tuple[list[InvoiceEntry], dict[str, Decimal]]:
    page_texts = extract_pdf_pages_text(invoice_pdf)
    full_text = "\n".join(f"\n---PDF_PAGE_{idx}---\n{text}" for idx, text in enumerate(page_texts, 1))
    matches = list(PO_ROW_RE.finditer(full_text))
    entries_by_po: OrderedDict[str, InvoiceEntry] = OrderedDict()

    for idx, match in enumerate(matches):
        line = match.group("line").strip()
        parsed = parse_invoice_po_line(line)
        if not parsed:
            continue

        section_end = matches[idx + 1].start() if idx + 1 < len(matches) else len(full_text)
        section = full_text[match.end() : section_end]
        page_num = find_page_number_before(full_text, match.start())

        quantity, unit_price, total_amount = parse_quantity_price_amount(section)
        if quantity is None:
            quantity = parsed.quantity

        net_amount_match = re.search(r"\bNet\s+Amount\s+([\d,]+(?:\.\d+)?)", section, re.I)
        net_amount = to_decimal(net_amount_match.group(1)) if net_amount_match else None
        shas_vas_price, total_adjustment = parse_shas_vas_adjustment(section)
        merchandise_amount = total_amount
        total_taxes = parse_labeled_money(section, "Total Taxes")
        order_total = parse_labeled_money(section, "Order Total")

        existing = entries_by_po.get(parsed.po)
        if existing:
            existing.quantity += quantity
            existing.total_amount += total_amount
            existing.merchandise_amount += merchandise_amount
            existing.total_adjustment += total_adjustment
            existing.shas_vas_price = add_optional_decimal(existing.shas_vas_price, shas_vas_price)
            existing.total_taxes = add_optional_decimal(existing.total_taxes, total_taxes)
            existing.order_total = add_optional_decimal(existing.order_total, order_total)
            if net_amount is not None:
                existing.net_amount = (existing.net_amount or Decimal("0")) + net_amount
            existing.line_count += 1
            if existing.invoice_pages is not None and page_num not in existing.invoice_pages:
                existing.invoice_pages.append(page_num)
            continue

        parsed.quantity = quantity
        parsed.unit_price = unit_price
        parsed.total_amount = total_amount
        parsed.net_amount = net_amount
        parsed.shas_vas_price = shas_vas_price
        parsed.merchandise_amount = merchandise_amount
        parsed.total_adjustment = total_adjustment
        parsed.total_taxes = total_taxes
        parsed.order_total = order_total
        parsed.invoice_pages = [page_num] if page_num else []
        entries_by_po[parsed.po] = parsed

    totals = parse_invoice_totals(full_text)
    entries = list(entries_by_po.values())
    fill_derived_financials(entries, totals)
    return entries, totals


def parse_invoice_po_line(line: str) -> InvoiceEntry | None:
    tokens = line.split()
    if len(tokens) < 8:
        return None

    po = tokens[0]
    if not re.fullmatch(r"\d{10}", po):
        return None
    if not tokens[1].isdigit():
        return None
    if not MONEY_RE.match(tokens[-1]):
        return None

    working_no = tokens[2]
    article_no = tokens[3]
    gender = tokens[-3]
    category = tokens[-2]
    quantity = to_decimal(tokens[-1])
    description = " ".join(tokens[4:-3])

    return InvoiceEntry(
        po=po,
        working_no=working_no,
        article_no=article_no,
        description=description,
        gender=gender,
        category=category,
        quantity=quantity,
    )


def parse_quantity_price_amount(section: str) -> tuple[Decimal | None, Decimal | None, Decimal]:
    match = re.search(
        r"\bQTY\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)",
        section,
        re.I,
    )
    if not match:
        return None, None, Decimal("0")

    quantity = to_decimal(match.group(2))
    unit_price = to_decimal(match.group(3))
    total_amount = to_decimal(match.group(4))
    return quantity, unit_price, total_amount


def parse_shas_vas_adjustment(section: str) -> tuple[Decimal | None, Decimal]:
    unit_price: Decimal | None = None
    total_amount = Decimal("0")

    for match in SHAS_VAS_RE.finditer(section):
        unit_price = add_optional_decimal(unit_price, to_decimal(match.group("unit_price")))
        total_amount += to_decimal(match.group("amount"))

    return unit_price, total_amount


def parse_labeled_money(section: str, label: str) -> Decimal | None:
    match = re.search(
        re.escape(label).replace(r"\ ", r"\s+") + r"\s+(-?\d[\d,]*(?:\.\d+)?)",
        section,
        re.I,
    )
    return to_decimal(match.group(1)) if match else None


def add_optional_decimal(left: Decimal | None, right: Decimal | None) -> Decimal | None:
    if left is None:
        return right
    if right is None:
        return left
    return left + right


def fill_derived_financials(entries: list[InvoiceEntry], totals: dict[str, Decimal]) -> None:
    total_po_net_amount = totals.get("total_po_net_amount")
    total_vat = totals.get("total_vat")

    for entry in entries:
        if entry.net_amount is None:
            entry.net_amount = entry.merchandise_amount + entry.total_adjustment

        if entry.total_taxes is None and entry.net_amount is not None and total_po_net_amount and total_vat:
            entry.total_taxes = entry.net_amount * total_vat / total_po_net_amount

        if entry.order_total is None:
            order_base = entry.net_amount if entry.net_amount is not None else entry.merchandise_amount + entry.total_adjustment
            entry.order_total = order_base + (entry.total_taxes or Decimal("0"))


def find_page_number_before(text: str, pos: int) -> int | None:
    marker = "---PDF_PAGE_"
    marker_pos = text.rfind(marker, 0, pos)
    if marker_pos == -1:
        return None
    match = re.match(r"---PDF_PAGE_(\d+)---", text[marker_pos:])
    return int(match.group(1)) if match else None


def parse_invoice_totals(full_text: str) -> dict[str, Decimal]:
    labels = {
        "total_quantity": r"Total\s+Quantity",
        "total_po_net_amount": r"Total\s+PO\s+Net\s+Amount",
        "total_vat": r"Total\s+VAT",
        "invoice_total": r"Invoice\s+Total",
        "total_taxes": r"Total\s+Taxes",
        "order_total": r"Order\s+Total",
    }
    totals: dict[str, Decimal] = {}
    for key, label_re in labels.items():
        matches = list(re.finditer(label_re + r"\s+([\d,]+(?:\.\d+)?)", full_text, re.I))
        if matches:
            totals[key] = to_decimal(matches[-1].group(1))
    return totals


def parse_po_pdf_pages(po_pdf: Path) -> dict[str, list[int]]:
    page_texts = extract_pdf_pages_text(po_pdf)
    po_pages: OrderedDict[str, list[int]] = OrderedDict()
    for page_idx, text in enumerate(page_texts, 1):
        po = find_order_number(text)
        if not po:
            continue
        po_pages.setdefault(po, []).append(page_idx)
    return dict(po_pages)


def find_order_number(page_text: str) -> str | None:
    normalized = re.sub(r"\s+", " ", page_text)
    match = ORDER_NUMBER_RE.search(normalized)
    if match:
        return match.group(1)

    fallback = re.search(r"\b(45\d{8}|09\d{8})\b", normalized)
    return fallback.group(1) if fallback else None


def create_summary_pdf(
    result: ParseResult,
    invoice_pdf: Path | None,
    po_pdf: Path,
    output_pdf: Path,
) -> bytes:
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CnTitle",
        parent=styles["Title"],
        fontName="STSong-Light",
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        spaceAfter=8,
    )
    normal_style = ParagraphStyle(
        "CnNormal",
        parent=styles["Normal"],
        fontName="STSong-Light",
        fontSize=8.5,
        leading=11,
        alignment=TA_LEFT,
    )
    right_style = ParagraphStyle(
        "CnRight",
        parent=normal_style,
        alignment=TA_RIGHT,
    )
    small_style = ParagraphStyle(
        "CnSmall",
        parent=normal_style,
        fontSize=7.5,
        leading=9.5,
    )

    source_label = invoice_pdf.name if invoice_pdf else "手动输入 PO 顺序"
    summary_title = "PO 按发票顺序重排汇总页" if invoice_pdf else "PO 按手动顺序重排汇总页"

    story: list = []
    story.append(Paragraph(summary_title, title_style))
    story.append(
        Paragraph(
            f"发票文件：{source_label}<br/>PO文件：{po_pdf.name}<br/>"
            f"输出文件：{output_pdf.name}<br/>生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            normal_style,
        )
    )
    story.append(Spacer(1, 5 * mm))

    header = [
        "序号",
        "PO号",
        "发票页",
        "PO页",
        "Working No",
        "Article",
        "描述",
        "数量",
        "单价",
        "Shas Vas Price",
        "Merchandise Amount",
        "Total Adjustment",
        "Total Taxes",
        "Order Total",
        "状态",
    ]
    rows: list[list] = [[Paragraph(text, normal_style) for text in header]]
    for idx, entry in enumerate(result.invoice_entries, 1):
        pages = result.po_pages.get(entry.po, [])
        status = "已输出" if pages else "PO PDF未找到"
        rows.append(
            [
                Paragraph(str(idx), right_style),
                Paragraph(entry.po, normal_style),
                Paragraph(", ".join(map(str, entry.invoice_pages or [])) or "-", normal_style),
                Paragraph(", ".join(map(str, pages)) or "-", normal_style),
                Paragraph(entry.working_no, normal_style),
                Paragraph(entry.article_no, normal_style),
                Paragraph(entry.description, small_style),
                Paragraph(format_quantity(entry.quantity), right_style),
                Paragraph(format_decimal(entry.unit_price), right_style),
                Paragraph(format_decimal(entry.shas_vas_price, places=6), right_style),
                Paragraph(format_decimal(entry.merchandise_amount), right_style),
                Paragraph(format_decimal(entry.total_adjustment), right_style),
                Paragraph(format_decimal(entry.total_taxes), right_style),
                Paragraph(format_decimal(entry.order_total), right_style),
                Paragraph(status, normal_style),
            ]
        )

    col_widths = [
        8 * mm,
        23 * mm,
        12 * mm,
        12 * mm,
        22 * mm,
        17 * mm,
        34 * mm,
        12 * mm,
        14 * mm,
        17 * mm,
        22 * mm,
        20 * mm,
        17 * mm,
        18 * mm,
        22 * mm,
    ]
    table = Table(rows, repeatRows=1, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "STSong-Light"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF7")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1F2937")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#B7C0CC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 5 * mm))

    story.append(create_totals_table(result, normal_style, right_style))

    notes = []
    if result.missing_po_numbers:
        notes.append("发票中存在但 PO PDF 未找到：" + ", ".join(result.missing_po_numbers))
    if result.extra_po_numbers:
        notes.append("PO PDF 中存在但发票未包含，未输出：" + ", ".join(result.extra_po_numbers))
    if notes:
        story.append(Spacer(1, 3 * mm))
        for note in notes:
            story.append(Paragraph(note, normal_style))

    story.append(PageBreak())
    doc.build(story)
    return buffer.getvalue()


def create_totals_table(result: ParseResult, normal_style: ParagraphStyle, right_style: ParagraphStyle) -> Table:
    sum_quantity = sum((entry.quantity for entry in result.invoice_entries), Decimal("0"))
    sum_shas_vas_price = sum_optional(entry.shas_vas_price for entry in result.invoice_entries)
    sum_merchandise_amount = sum((entry.merchandise_amount for entry in result.invoice_entries), Decimal("0"))
    sum_total_adjustment = sum((entry.total_adjustment for entry in result.invoice_entries), Decimal("0"))
    sum_total_taxes = sum_optional(entry.total_taxes for entry in result.invoice_entries)
    sum_order_total = sum_optional(entry.order_total for entry in result.invoice_entries)
    footer_total_adjustment = None
    if result.invoice_totals.get("total_po_net_amount") is not None:
        footer_total_adjustment = result.invoice_totals["total_po_net_amount"] - sum_merchandise_amount

    data = [
        [
            Paragraph("汇总项", normal_style),
            Paragraph("程序按PO行汇总", right_style),
            Paragraph("发票页脚总计", right_style),
        ],
        [
            Paragraph("总数量", normal_style),
            Paragraph(format_quantity(sum_quantity), right_style),
            Paragraph(format_quantity(result.invoice_totals.get("total_quantity")), right_style),
        ],
        [
            Paragraph("Shas Vas Price", normal_style),
            Paragraph(format_decimal(sum_shas_vas_price, places=6), right_style),
            Paragraph("-", right_style),
        ],
        [
            Paragraph("Merchandise Amount", normal_style),
            Paragraph(format_decimal(sum_merchandise_amount), right_style),
            Paragraph("-", right_style),
        ],
        [
            Paragraph("Total Adjustment", normal_style),
            Paragraph(format_decimal(sum_total_adjustment), right_style),
            Paragraph(format_decimal(footer_total_adjustment), right_style),
        ],
        [
            Paragraph("Total Taxes", normal_style),
            Paragraph(format_decimal(sum_total_taxes), right_style),
            Paragraph(format_decimal(result.invoice_totals.get("total_taxes") or result.invoice_totals.get("total_vat")), right_style),
        ],
        [
            Paragraph("Order Total", normal_style),
            Paragraph(format_decimal(sum_order_total), right_style),
            Paragraph(format_decimal(result.invoice_totals.get("order_total") or result.invoice_totals.get("invoice_total")), right_style),
        ],
    ]
    table = Table(data, colWidths=[42 * mm, 42 * mm, 42 * mm])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "STSong-Light"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8F5E9")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#B7C0CC")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def sum_optional(values: Iterable[Decimal | None]) -> Decimal | None:
    total = Decimal("0")
    found = False
    for value in values:
        if value is not None:
            total += value
            found = True
    return total if found else None


def build_reordered_pdf(
    invoice_pdf: Path | None,
    po_pdf: Path,
    output_pdf: Path,
    po_order: Iterable[str] | None = None,
    print_current_only: bool = True,
    print_next_page: bool = True,
) -> ParseResult:
    normalized_po_order = normalize_po_order(po_order)

    if invoice_pdf is not None:
        entries, invoice_totals = parse_invoice_pdf(invoice_pdf)
        if not entries and not normalized_po_order:
            raise RuntimeError(f"没有从发票中识别到PO行：{invoice_pdf}")
    else:
        entries = []
        invoice_totals = {}
        if not normalized_po_order:
            raise RuntimeError("请先输入PO顺序，或上传发票PDF自动提取PO顺序")

    if normalized_po_order:
        entries = apply_po_order(entries, normalized_po_order)

    raw_po_pages = parse_po_pdf_pages(po_pdf)
    po_page_count = len(PdfReader(str(po_pdf)).pages)
    po_pages = select_po_pages(raw_po_pages, po_page_count, print_current_only, print_next_page)
    missing = [entry.po for entry in entries if entry.po not in po_pages or not po_pages[entry.po]]
    invoice_po_set = {entry.po for entry in entries}
    extra = [po for po in raw_po_pages.keys() if po not in invoice_po_set]

    result = ParseResult(
        invoice_entries=entries,
        invoice_totals=invoice_totals,
        po_pages=po_pages,
        extra_po_numbers=extra,
        missing_po_numbers=missing,
    )

    summary_pdf_bytes = create_summary_pdf(result, invoice_pdf, po_pdf, output_pdf)
    summary_reader = PdfReader(BytesIO(summary_pdf_bytes))
    po_reader = PdfReader(str(po_pdf))
    writer = PdfWriter()

    writer.add_page(summary_reader.pages[0])
    for entry in entries:
        for page_num in po_pages.get(entry.po, []):
            writer.add_page(po_reader.pages[page_num - 1])

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    with output_pdf.open("wb") as fh:
        writer.write(fh)

    return result


def select_po_pages(
    raw_po_pages: dict[str, list[int]],
    total_pages: int,
    print_current_only: bool,
    print_next_page: bool,
) -> dict[str, list[int]]:
    selected: dict[str, list[int]] = {}
    for po, pages in raw_po_pages.items():
        if not pages:
            selected[po] = []
            continue
        first_page = pages[0]
        page_set: list[int] = []
        if print_current_only:
            page_set.append(first_page)
        if print_next_page and first_page + 1 <= total_pages:
            page_set.append(first_page + 1)
        if not print_current_only and not print_next_page:
            page_set.extend(pages)
        selected[po] = sorted(set(page_set))
    return selected


def normalize_po_order(po_order: Iterable[str] | None) -> list[str]:
    if not po_order:
        return []

    ordered: list[str] = []
    seen: set[str] = set()
    for item in po_order:
        for match in re.findall(r"\b\d{10}\b", str(item)):
            if match not in seen:
                seen.add(match)
                ordered.append(match)
    return ordered


def apply_po_order(entries: list[InvoiceEntry], po_order: list[str]) -> list[InvoiceEntry]:
    entries_by_po = {entry.po: entry for entry in entries}
    ordered_entries: list[InvoiceEntry] = []

    for po in po_order:
        entry = entries_by_po.get(po)
        if entry:
            ordered_entries.append(entry)
        else:
            ordered_entries.append(
                InvoiceEntry(
                    po=po,
                    description="手动输入，发票中未匹配到明细",
                    invoice_pages=[],
                )
            )

    return ordered_entries


def find_default_pdfs(base_dir: Path) -> tuple[Path, Path]:
    pdfs = sorted(base_dir.rglob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"当前目录下没有找到PDF文件：{base_dir}")

    invoice_candidates = [
        p
        for p in pdfs
        if any(keyword in p.name.lower() for keyword in ["发票", "invoice"])
    ]
    po_candidates = [
        p
        for p in pdfs
        if p not in invoice_candidates
        and (
            "po" in p.name.lower()
            or "purchase" in p.name.lower()
            or "原始" in p.name
            or "顺序" in p.name
        )
    ]

    if len(invoice_candidates) != 1:
        raise RuntimeError(
            "无法唯一识别发票PDF，请用 --invoice 指定。候选："
            + ", ".join(str(p) for p in invoice_candidates)
        )
    if len(po_candidates) != 1:
        raise RuntimeError(
            "无法唯一识别PO PDF，请用 --po 指定。候选："
            + ", ".join(str(p) for p in po_candidates)
        )
    return invoice_candidates[0], po_candidates[0]


def default_output_path(base_dir: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return base_dir / "输出结果" / f"PO按发票顺序重排_含汇总页_{timestamp}.pdf"


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="按发票PDF中的PO顺序重排PO PDF，并在第一页生成数量/金额汇总。"
    )
    parser.add_argument("--invoice", type=Path, help="发票PDF路径。不填则自动查找。")
    parser.add_argument("--po", type=Path, help="下载的PO PDF路径。不填则自动查找。")
    parser.add_argument("--output", type=Path, help="输出PDF路径。不填则输出到 ./输出结果。")
    parser.add_argument("--base-dir", type=Path, default=Path.cwd(), help="自动查找PDF的目录。默认当前目录。")
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    configure_stdout()
    args = parse_args(argv)
    base_dir = args.base_dir.resolve()

    if args.invoice and args.po:
        invoice_pdf = args.invoice.resolve()
        po_pdf = args.po.resolve()
    else:
        invoice_pdf, po_pdf = find_default_pdfs(base_dir)
        invoice_pdf = invoice_pdf.resolve()
        po_pdf = po_pdf.resolve()

    if not invoice_pdf.exists():
        raise FileNotFoundError(f"发票PDF不存在：{invoice_pdf}")
    if not po_pdf.exists():
        raise FileNotFoundError(f"PO PDF不存在：{po_pdf}")

    output_pdf = args.output.resolve() if args.output else default_output_path(base_dir).resolve()

    print(f"发票PDF：{invoice_pdf}")
    print(f"PO PDF：{po_pdf}")
    print(f"输出PDF：{output_pdf}")

    result = build_reordered_pdf(invoice_pdf, po_pdf, output_pdf)

    print("\n处理完成")
    print(f"发票PO数量：{len(result.invoice_entries)}")
    print(f"已输出PO数量：{len(result.invoice_entries) - len(result.missing_po_numbers)}")
    if result.missing_po_numbers:
        print("发票中有但PO PDF未找到：" + ", ".join(result.missing_po_numbers))
    if result.extra_po_numbers:
        print("PO PDF中有但发票未包含，已跳过：" + ", ".join(result.extra_po_numbers))
    print(f"结果文件：{output_pdf}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
