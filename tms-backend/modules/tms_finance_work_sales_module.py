# -*- coding: utf-8 -*-
"""
TMS 财务 - Work Sales 数据提取模块。
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
from uuid import uuid4

import openpyxl
import xlrd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet


@dataclass
class DetailColumns:
    style: int
    unit_price: int
    quantity: int
    merchandiser: int
    handover_date: int
    invoice: int


@dataclass
class DetailRow:
    source_sheet: str
    source_row: int
    invoice: str
    style: str
    unit_price: Optional[float]
    quantity: Any
    merchandiser: str
    handover_date: Any


@dataclass
class ReferenceColumns:
    style: int
    buyer: Optional[int]
    customer: Optional[int]
    factory: Optional[int]
    sas_price: Optional[int]
    promo_price: Optional[int]
    upcharge: Optional[int]


@dataclass
class ReferenceRow:
    source_sheet: str
    source_row: int
    style: str
    buyer: str
    customer: str
    factory: str
    sas_price: Any
    promo_price: Any
    upcharge: Any


@dataclass
class WorkSalesOutputRow:
    invoice: str
    style: str
    sales_unit_price: Any
    buyer: str
    factory: str
    purchase_unit_price: Any
    customer: str
    merchandiser: str
    handover_date: Any
    sas_price: Any
    promo_price: Any
    upcharge: Any
    source_sheet: str
    source_row: int


class TmsFinanceWorkSalesModule:
    """从 iPlix Turnover Details 提取 Work Sales 核对汇总。"""

    DETAIL_SHEET_NAME = "Turnover Details"
    OUTPUT_SHEET_NAME = "Work Sales Summary"
    OUTPUT_HEADERS = [
        "Invoice No.",
        "Style Number",
        "Unit Price (Sales)",
        "Buyer",
        "Factory",
        "Unit Price (Purchase) / Customer Price",
        "Customer",
        "Merchandiser",
        "Handover Date",
        "SAS Price",
        "Promo Price",
        "Upcharge",
    ]
    VENDOR_ALIASES = {
        "1L8006": "SLT",
        "ELP008": "SLT",
        "SLT": "SLT",
        "DANDONGSLTGARMENTINDUSTRYCOLTD": "SLT",
        "DANDONGXINLONGTAI": "SLT",
        "丹东新龙太": "SLT",
        "丹东新龙泰": "SLT",
        "新龙太": "SLT",
        "新龙泰": "SLT",
    }

    def process_files(
        self,
        iplix_path: str,
        reference_path: str,
        output_dir: Optional[str] = None,
        today: Optional[date] = None,
    ) -> Dict[str, Any]:
        output_root = output_dir or os.path.dirname(os.path.abspath(iplix_path))
        os.makedirs(output_root, exist_ok=True)

        sales_rows, purchase_rows = self._extract_turnover_detail_rows(iplix_path)
        if not sales_rows:
            raise ValueError("iPlix Turnover Details 未读取到 Sales 明细")

        reference_rows, reference_diagnostics = self._extract_reference_rows(reference_path)
        reference_map, duplicate_reference_diagnostics = self._build_reference_map(reference_rows)
        diagnostics: List[Dict[str, Any]] = [
            *reference_diagnostics,
            *duplicate_reference_diagnostics,
        ]

        output_rows: List[WorkSalesOutputRow] = []
        matched_reference_count = 0
        missing_reference_count = 0

        for index, sales_row in enumerate(sales_rows):
            purchase_row = purchase_rows[index] if index < len(purchase_rows) else None
            row_diagnostics: List[str] = []
            if purchase_row is None:
                row_diagnostics.append("缺少对应 Purchase 明细")
            elif not self._details_match(sales_row, purchase_row):
                row_diagnostics.append("Sales/Purchase 明细不一致，已按原行序横向合并")

            style_key = self._normalize_style_key(sales_row.style)
            reference = reference_map.get(style_key)
            if reference:
                matched_reference_count += 1
            else:
                missing_reference_count += 1
                row_diagnostics.append("参考表未匹配到 Style，补充价格和文本字段留空")

            factory = ""
            if reference:
                factory, factory_diagnostic = self._map_factory(reference.factory)
                if factory_diagnostic:
                    row_diagnostics.append(factory_diagnostic)

            output_rows.append(
                WorkSalesOutputRow(
                    invoice=sales_row.invoice,
                    style=sales_row.style,
                    sales_unit_price=sales_row.unit_price,
                    buyer=reference.buyer if reference else "",
                    factory=factory,
                    purchase_unit_price=purchase_row.unit_price if purchase_row else "",
                    customer=reference.customer if reference else "",
                    merchandiser=sales_row.merchandiser or (purchase_row.merchandiser if purchase_row else ""),
                    handover_date=sales_row.handover_date,
                    sas_price=reference.sas_price if reference else "",
                    promo_price=reference.promo_price if reference else "",
                    upcharge=reference.upcharge if reference else "",
                    source_sheet=sales_row.source_sheet,
                    source_row=sales_row.source_row,
                )
            )

            for reason in row_diagnostics:
                diagnostics.append(self._build_detail_diagnostic(sales_row, reason))

        month_source = today or date.today()
        month_label = f"{month_source.year}年{month_source.month:02d}月"
        output_filename = f"tms_finance_work_sales_{uuid4().hex}.xlsx"
        output_path = os.path.join(output_root, output_filename)
        self._write_output_workbook(output_rows, month_label, output_path)

        totals = self._calculate_totals(output_rows)
        return {
            "success": True,
            "message": f"Work Sales 数据提取完成：提取 {len(output_rows)} 行。",
            "output_path": output_path,
            "output_file": output_filename,
            "extracted_count": len(output_rows),
            "matched_reference_count": matched_reference_count,
            "missing_reference_count": missing_reference_count,
            "diagnostic_count": len(diagnostics),
            "diagnostics": diagnostics,
            "month_label": month_label,
            "totals": totals,
            "source_summary": {
                "sales_rows": len(sales_rows),
                "purchase_rows": len(purchase_rows),
                "reference_rows": len(reference_rows),
            },
            "logs": [
                f"Sales 明细提取 {len(sales_rows)} 行",
                f"Purchase 明细提取 {len(purchase_rows)} 行",
                f"参考表读取 {len(reference_rows)} 行",
                f"生成 Work Sales 汇总 {len(output_rows)} 行",
            ],
        }

    def _extract_turnover_detail_rows(
        self,
        workbook_path: str,
    ) -> Tuple[List[DetailRow], List[DetailRow]]:
        workbook = openpyxl.load_workbook(workbook_path, data_only=True, read_only=True)
        try:
            if self.DETAIL_SHEET_NAME not in workbook.sheetnames:
                raise ValueError("iPlix 文件缺少 Turnover Details Sheet")
            ws = workbook[self.DETAIL_SHEET_NAME]
            sales_header_row = self._find_sales_header_row(ws)
            purchase_header_row = self._find_purchase_header_row(ws)
            sales_columns = self._build_detail_columns(ws, sales_header_row)
            purchase_columns = self._build_detail_columns(ws, purchase_header_row)
            return (
                self._read_detail_rows(ws, sales_header_row, sales_columns),
                self._read_detail_rows(ws, purchase_header_row, purchase_columns),
            )
        finally:
            workbook.close()

    def _find_sales_header_row(self, ws: Worksheet) -> int:
        for row in range(1, ws.max_row + 1):
            headers = self._header_values(ws, row)
            if (
                "STYLE NUMBER" in headers
                and "SALES INVOICE NUMBER" in headers
                and "PURCHASE AMOUNT" not in headers
            ):
                return row
        raise ValueError("Turnover Details 缺少 Sales 明细表头")

    def _find_purchase_header_row(self, ws: Worksheet) -> int:
        for row in range(1, ws.max_row + 1):
            headers = self._header_values(ws, row)
            if "STYLE NUMBER" in headers and "PURCHASE AMOUNT" in headers:
                return row
        raise ValueError("Turnover Details 缺少 Purchase 明细表头")

    def _header_values(self, ws: Worksheet, row: int) -> set[str]:
        return {
            self._normalize_header(ws.cell(row, column).value)
            for column in range(1, ws.max_column + 1)
            if self._normalize_header(ws.cell(row, column).value)
        }

    def _build_detail_columns(self, ws: Worksheet, header_row: int) -> DetailColumns:
        header_map = self._build_header_map(ws, header_row)
        return DetailColumns(
            style=self._required_column(header_map, ["STYLE NUMBER", "WORKING STYLE NUMBER"]),
            unit_price=self._required_column(
                header_map,
                ["UNIT PRICE EXCLUDE VAT", "UNIT PRICE SALES", "UNIT PRICE"],
            ),
            quantity=self._required_column(header_map, ["SHIP QUANTITY", "SHIP QTY"]),
            merchandiser=self._required_column(header_map, ["MERCH", "MERCHANDISER"]),
            handover_date=self._required_column(header_map, ["HANDOVER DATE"]),
            invoice=self._required_column(header_map, ["SALES INVOICE NUMBER", "INVOICE NUMBER"]),
        )

    def _read_detail_rows(
        self,
        ws: Worksheet,
        header_row: int,
        columns: DetailColumns,
    ) -> List[DetailRow]:
        rows: List[DetailRow] = []
        row_index = header_row + 1
        while row_index <= ws.max_row:
            if self._is_detail_stop_row(ws, row_index, columns):
                break
            style = self._clean_text(ws.cell(row_index, columns.style).value)
            invoice = self._clean_text(ws.cell(row_index, columns.invoice).value)
            if style or invoice:
                rows.append(
                    DetailRow(
                        source_sheet=ws.title,
                        source_row=row_index,
                        invoice=invoice,
                        style=style,
                        unit_price=self._money_or_none(ws.cell(row_index, columns.unit_price).value),
                        quantity=ws.cell(row_index, columns.quantity).value,
                        merchandiser=self._clean_text(ws.cell(row_index, columns.merchandiser).value),
                        handover_date=ws.cell(row_index, columns.handover_date).value,
                    )
                )
            row_index += 1
        return rows

    def _is_detail_stop_row(self, ws: Worksheet, row: int, columns: DetailColumns) -> bool:
        values = [ws.cell(row, column).value for column in range(1, min(ws.max_column, 18) + 1)]
        if all(value in (None, "") for value in values):
            return True
        style = self._clean_text(ws.cell(row, columns.style).value)
        if style:
            return False
        return any(
            self._clean_text(value).upper().startswith("=SUM(")
            for value in values
        )

    def _extract_reference_rows(self, workbook_path: str) -> Tuple[List[ReferenceRow], List[Dict[str, Any]]]:
        extension = os.path.splitext(workbook_path)[1].lower()
        if extension == ".xls":
            return self._extract_xls_reference_rows(workbook_path)
        if extension in {".xlsx", ".xlsm"}:
            return self._extract_openpyxl_reference_rows(workbook_path)
        raise ValueError("补充参考表仅支持 .xls / .xlsx / .xlsm")

    def _extract_openpyxl_reference_rows(
        self,
        workbook_path: str,
    ) -> Tuple[List[ReferenceRow], List[Dict[str, Any]]]:
        workbook = openpyxl.load_workbook(workbook_path, data_only=True, read_only=True)
        rows: List[ReferenceRow] = []
        diagnostics: List[Dict[str, Any]] = []
        try:
            for ws in workbook.worksheets:
                if ws.sheet_state != "visible":
                    continue
                header_row = self._find_reference_header_row(
                    ws.max_row,
                    lambda row, column: ws.cell(row, column).value,
                    ws.max_column,
                )
                if header_row is None:
                    continue
                columns, column_diagnostics = self._build_reference_columns(
                    self._build_header_map(ws, header_row),
                    ws.title,
                )
                diagnostics.extend(column_diagnostics)
                row_index = header_row + 1
                while row_index <= ws.max_row:
                    if self._is_reference_blank_row(
                        lambda column, row=row_index: ws.cell(row, column).value,
                        ws.max_column,
                    ):
                        break
                    row = self._build_reference_row(
                        ws.title,
                        row_index,
                        columns,
                        lambda column, row=row_index: ws.cell(row, column).value,
                    )
                    if row.style:
                        rows.append(row)
                    row_index += 1
        finally:
            workbook.close()
        return rows, diagnostics

    def _extract_xls_reference_rows(
        self,
        workbook_path: str,
    ) -> Tuple[List[ReferenceRow], List[Dict[str, Any]]]:
        book = xlrd.open_workbook(workbook_path, on_demand=True)
        rows: List[ReferenceRow] = []
        diagnostics: List[Dict[str, Any]] = []
        try:
            for sheet in book.sheets():
                if getattr(sheet, "visibility", 0) != 0:
                    continue
                header_row = self._find_reference_header_row(
                    sheet.nrows,
                    lambda row, column: sheet.cell_value(row - 1, column - 1),
                    sheet.ncols,
                )
                if header_row is None:
                    continue
                header_map = {
                    self._normalize_header(sheet.cell_value(header_row - 1, column)): column + 1
                    for column in range(sheet.ncols)
                    if self._normalize_header(sheet.cell_value(header_row - 1, column))
                }
                columns, column_diagnostics = self._build_reference_columns(header_map, sheet.name)
                diagnostics.extend(column_diagnostics)
                row_index = header_row + 1
                while row_index <= sheet.nrows:
                    if self._is_reference_blank_row(
                        lambda column, row=row_index: sheet.cell_value(row - 1, column - 1),
                        sheet.ncols,
                    ):
                        break
                    row = self._build_reference_row(
                        sheet.name,
                        row_index,
                        columns,
                        lambda column, row=row_index: sheet.cell_value(row - 1, column - 1),
                    )
                    if row.style:
                        rows.append(row)
                    row_index += 1
        finally:
            book.release_resources()
        return rows, diagnostics

    def _find_reference_header_row(
        self,
        max_row: int,
        read_cell: Callable[[int, int], Any],
        max_column: int,
    ) -> Optional[int]:
        for row in range(1, min(max_row, 20) + 1):
            values = {
                self._normalize_header(read_cell(row, column))
                for column in range(1, max_column + 1)
            }
            if "STYLE NUMBER" in values or "WORKING STYLE NUMBER" in values:
                return row
        return None

    def _build_reference_columns(
        self,
        header_map: Dict[str, int],
        sheet_name: str,
    ) -> Tuple[ReferenceColumns, List[Dict[str, Any]]]:
        optional_fields = {
            "SAS Price": ["SAS PRICE", "SAS"],
            "Promo Price": ["PROMO PRICE", "PROMO"],
            "Upcharge": ["UPCHARGE", "PROMO PRICE UPCHARGE", "PRICE UPCHARGE"],
        }
        diagnostics: List[Dict[str, Any]] = []
        missing_optional = [
            label
            for label, aliases in optional_fields.items()
            if self._optional_column(header_map, aliases) is None
        ]
        if missing_optional:
            diagnostics.append(
                {
                    "source_sheet": sheet_name,
                    "source_row": 0,
                    "reason": f"参考表缺少可选字段：{', '.join(missing_optional)}，输出留空",
                }
            )
        return (
            ReferenceColumns(
                style=self._required_column(header_map, ["STYLE NUMBER", "WORKING STYLE NUMBER"]),
                buyer=self._optional_column(header_map, ["BUYER NAME", "BUYER"]),
                customer=self._optional_column(header_map, ["BILL TO", "CUSTOMER", "CUSTOMER NAME"]),
                factory=self._optional_column(
                    header_map,
                    ["NAME OF FACTORY", "FACTORY CODE", "FACTORY"],
                ),
                sas_price=self._optional_column(header_map, optional_fields["SAS Price"]),
                promo_price=self._optional_column(header_map, optional_fields["Promo Price"]),
                upcharge=self._optional_column(header_map, optional_fields["Upcharge"]),
            ),
            diagnostics,
        )

    def _build_reference_row(
        self,
        sheet_name: str,
        row_index: int,
        columns: ReferenceColumns,
        read_cell: Callable[[int], Any],
    ) -> ReferenceRow:
        return ReferenceRow(
            source_sheet=sheet_name,
            source_row=row_index,
            style=self._clean_text(read_cell(columns.style)),
            buyer=self._clean_text(read_cell(columns.buyer)) if columns.buyer else "",
            customer=self._clean_text(read_cell(columns.customer)) if columns.customer else "",
            factory=self._clean_text(read_cell(columns.factory)) if columns.factory else "",
            sas_price=self._money_or_blank(read_cell(columns.sas_price)) if columns.sas_price else "",
            promo_price=self._money_or_blank(read_cell(columns.promo_price)) if columns.promo_price else "",
            upcharge=self._money_or_blank(read_cell(columns.upcharge)) if columns.upcharge else "",
        )

    def _is_reference_blank_row(
        self,
        read_cell: Callable[[int], Any],
        max_column: int,
    ) -> bool:
        return all(read_cell(column) in (None, "") for column in range(1, max_column + 1))

    def _build_reference_map(
        self,
        rows: Iterable[ReferenceRow],
    ) -> Tuple[Dict[str, ReferenceRow], List[Dict[str, Any]]]:
        mapping: Dict[str, ReferenceRow] = {}
        diagnostics: List[Dict[str, Any]] = []
        for row in rows:
            key = self._normalize_style_key(row.style)
            if not key:
                continue
            if key in mapping:
                diagnostics.append(
                    {
                        "source_sheet": row.source_sheet,
                        "source_row": row.source_row,
                        "style": row.style,
                        "reason": "参考表 Style 重复，已保留首条匹配",
                    }
                )
                continue
            mapping[key] = row
        return mapping, diagnostics

    def _write_output_workbook(
        self,
        rows: List[WorkSalesOutputRow],
        month_label: str,
        output_path: str,
    ) -> None:
        workbook = Workbook()
        ws = workbook.active
        ws.title = self.OUTPUT_SHEET_NAME

        ws["A1"] = "Work Sales Summary"
        ws["A2"] = f"月份：{month_label}"
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(self.OUTPUT_HEADERS))
        ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(self.OUTPUT_HEADERS))

        for column, header in enumerate(self.OUTPUT_HEADERS, start=1):
            ws.cell(4, column).value = header

        for row_index, item in enumerate(rows, start=5):
            values = [
                item.invoice,
                item.style,
                item.sales_unit_price,
                item.buyer,
                item.factory,
                item.purchase_unit_price,
                item.customer,
                item.merchandiser,
                item.handover_date,
                item.sas_price,
                item.promo_price,
                item.upcharge,
            ]
            for column, value in enumerate(values, start=1):
                ws.cell(row_index, column).value = value

        self._style_output_sheet(ws, len(rows))
        workbook.save(output_path)

    def _style_output_sheet(self, ws: Worksheet, row_count: int) -> None:
        white_fill = PatternFill("solid", fgColor="FFFFFF")
        header_fill = PatternFill("solid", fgColor="EAF7F3")
        title_font = Font(bold=True, size=16, color="1F2937")
        subtitle_font = Font(bold=True, size=11, color="475569")
        header_font = Font(bold=True, color="1F2937")
        thin_side = Side(style="thin", color="CBD5E1")
        border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
        max_row = max(4 + row_count, 4)

        for row in range(1, max_row + 1):
            for column in range(1, len(self.OUTPUT_HEADERS) + 1):
                cell = ws.cell(row, column)
                cell.fill = white_fill
                cell.alignment = Alignment(vertical="center")

        ws["A1"].font = title_font
        ws["A2"].font = subtitle_font
        for column in range(1, len(self.OUTPUT_HEADERS) + 1):
            cell = ws.cell(4, column)
            cell.fill = header_fill
            cell.font = header_font
            cell.border = border
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        for row in range(5, max_row + 1):
            for column in range(1, len(self.OUTPUT_HEADERS) + 1):
                ws.cell(row, column).border = border

        for column in (3, 6, 10, 11, 12):
            for row in range(5, max_row + 1):
                ws.cell(row, column).number_format = "0.00"
        for row in range(5, max_row + 1):
            ws.cell(row, 9).number_format = "yyyy-mm-dd"

        widths = [20, 18, 16, 22, 16, 26, 30, 16, 16, 14, 14, 14]
        for column, width in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(column)].width = width
        ws.row_dimensions[1].height = 24
        ws.row_dimensions[4].height = 34
        ws.freeze_panes = "A5"
        ws.auto_filter.ref = f"A4:{get_column_letter(len(self.OUTPUT_HEADERS))}{max_row}"

    def _calculate_totals(self, rows: Iterable[WorkSalesOutputRow]) -> Dict[str, Any]:
        sales_unit_price_total = Decimal("0")
        purchase_unit_price_total = Decimal("0")
        for row in rows:
            sales_unit_price_total += self._decimal_or_zero(row.sales_unit_price)
            purchase_unit_price_total += self._decimal_or_zero(row.purchase_unit_price)
        return {
            "sales_unit_price_total": self._money_for_response(sales_unit_price_total),
            "purchase_unit_price_total": self._money_for_response(purchase_unit_price_total),
        }

    def _build_header_map(self, ws: Worksheet, header_row: int) -> Dict[str, int]:
        mapping: Dict[str, int] = {}
        for column in range(1, ws.max_column + 1):
            header = self._normalize_header(ws.cell(header_row, column).value)
            if header:
                mapping[header] = column
        return mapping

    def _required_column(self, header_map: Dict[str, int], aliases: List[str]) -> int:
        column = self._optional_column(header_map, aliases)
        if column is None:
            raise ValueError(f"缺少必需字段：{' / '.join(aliases)}")
        return column

    def _optional_column(self, header_map: Dict[str, int], aliases: List[str]) -> Optional[int]:
        for alias in aliases:
            normalized = self._normalize_header(alias)
            if normalized in header_map:
                return header_map[normalized]
        return None

    def _details_match(self, sales_row: DetailRow, purchase_row: DetailRow) -> bool:
        return (
            self._normalize_style_key(sales_row.style) == self._normalize_style_key(purchase_row.style)
            and sales_row.invoice == purchase_row.invoice
            and self._normalize_date_for_key(sales_row.handover_date)
            == self._normalize_date_for_key(purchase_row.handover_date)
            and self._normalize_number_for_key(sales_row.quantity)
            == self._normalize_number_for_key(purchase_row.quantity)
        )

    def _build_detail_diagnostic(self, row: DetailRow, reason: str) -> Dict[str, Any]:
        return {
            "source_sheet": row.source_sheet,
            "source_row": row.source_row,
            "style": row.style,
            "invoice": row.invoice,
            "reason": reason,
        }

    def _map_factory(self, value: Any) -> Tuple[str, str]:
        text = self._clean_text(value)
        if not text:
            return "", ""
        normalized = self._normalize_factory_key(text)
        if normalized in self.VENDOR_ALIASES:
            return self.VENDOR_ALIASES[normalized], ""
        return text, f"未知工厂映射：{text}"

    def _normalize_header(self, value: Any) -> str:
        text = self._clean_text(value).upper().lstrip("*")
        return re.sub(r"[^A-Z0-9]+", " ", text).strip()

    def _normalize_style_key(self, value: Any) -> str:
        text = self._clean_text(value).upper()
        while text.endswith("."):
            text = text[:-1]
        return text.strip()

    def _normalize_factory_key(self, value: str) -> str:
        text = value.strip().upper()
        if text.isascii():
            return re.sub(r"[^A-Z0-9]+", "", text)
        return text

    def _normalize_date_for_key(self, value: Any) -> str:
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        return self._clean_text(value)

    def _normalize_number_for_key(self, value: Any) -> str:
        number = self._parse_decimal(value)
        if number is None:
            return self._clean_text(value)
        return str(number.normalize())

    def _clean_text(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value).strip()

    def _money_or_none(self, value: Any) -> Optional[float]:
        amount = self._parse_decimal(value)
        if amount is None:
            return None
        return self._money_for_response(amount)

    def _money_or_blank(self, value: Any) -> Any:
        amount = self._parse_decimal(value)
        if amount is None:
            return ""
        return self._money_for_response(amount)

    def _parse_decimal(self, value: Any) -> Optional[Decimal]:
        if value in (None, ""):
            return None
        try:
            return Decimal(str(value).replace(",", "").strip())
        except (InvalidOperation, AttributeError):
            return None

    def _decimal_or_zero(self, value: Any) -> Decimal:
        return self._parse_decimal(value) or Decimal("0")

    def _money_for_response(self, value: Decimal) -> float:
        return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
