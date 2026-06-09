# -*- coding: utf-8 -*-
"""
TMS 财务 - 内销对账单导入模块。
"""

from __future__ import annotations

import os
from copy import copy
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, Iterable, List, Optional, Tuple
from uuid import uuid4

import openpyxl
from openpyxl.worksheet.worksheet import Worksheet


BusinessKey = Tuple[str, str, str, str]


@dataclass
class SourceColumns:
    style: int
    article: int
    description: int
    order: int
    customer_order: int
    customer_no: int
    warehouse: int
    delivery_date: int
    quantity: int
    purchase_amount: int
    tms_unit_price: int
    promo_fee: int
    sales_amount: int
    vendor_code: int
    vendor_name: int
    mr: int
    commercial_invoice: Optional[int]


@dataclass
class ExtractedRow:
    source_file: str
    source_sheet: str
    source_row: int
    key: BusinessKey
    target_values: List[Any]
    diagnostics: List[str]


class TmsFinanceInternalReconciliationModule:
    """把合并 Sample/Bulk 数据追加到内销对账单副本。"""

    TARGET_SHEET_NAME = "未清账"
    TARGET_HEADERS = [
        "Date1",
        "Sales invoice",
        "Date2",
        "Purchase invoice",
        "REMARK",
        "VENDOR",
        "CUSTOMER",
        "QTY",
        "Purchase amount",
        "Sales amount  with Tax 13%",
        "货描",
        "WORKING  NO.(款号)",
        "PO ORDER NO.",
        "ARTICLE NO.(货号)",
        "CUSTOMER NO.(客户编码)",
        "CUSTOMER ORDER NO.(客户订单号)",
        "交期",
        "MR",
        "Commercial Invoice",
        "工厂Promo附加费",
        "采购",
        "销售",
    ]
    VENDOR_ALIASES = {
        "1L8006": "SLT",
        "ELP008": "SLT",
        "SLT": "SLT",
        "丹东新龙太": "SLT",
        "丹东新龙泰": "SLT",
        "新龙太": "SLT",
        "新龙泰": "SLT",
    }

    def process_files(
        self,
        sample_path: str,
        bulk_path: str,
        target_path: str,
        output_dir: Optional[str] = None,
    ) -> Dict[str, Any]:
        output_root = output_dir or os.path.dirname(os.path.abspath(target_path))
        os.makedirs(output_root, exist_ok=True)

        target_wb = openpyxl.load_workbook(target_path)
        if self.TARGET_SHEET_NAME not in target_wb.sheetnames:
            raise ValueError("内销对账单缺少 未清账 Sheet")

        target_ws = target_wb[self.TARGET_SHEET_NAME]
        existing_keys = self._collect_existing_keys(target_wb)
        last_row = self._find_last_nonempty_row(target_ws)
        sample_rows = self._extract_source_rows(sample_path)
        bulk_rows = self._extract_source_rows(bulk_path)

        appended_count = 0
        duplicate_count = 0
        diagnostics: List[Dict[str, Any]] = []
        totals = {
            "quantity": Decimal("0"),
            "purchase_amount": Decimal("0"),
            "sales_amount_with_tax": Decimal("0"),
        }

        for item in [*sample_rows, *bulk_rows]:
            if item.key in existing_keys:
                duplicate_count += 1
                diagnostics.append(self._build_diagnostic(item, "目标已存在"))
                continue

            append_row = last_row + appended_count + 1
            self._copy_row_style(target_ws, last_row, append_row)
            for column_index, value in enumerate(item.target_values, start=1):
                target_ws.cell(append_row, column_index).value = value

            self._format_appended_row(target_ws, append_row)
            existing_keys.add(item.key)
            appended_count += 1
            totals["quantity"] += self._decimal_or_zero(item.target_values[7])
            totals["purchase_amount"] += self._decimal_or_zero(item.target_values[8])
            totals["sales_amount_with_tax"] += self._decimal_or_zero(item.target_values[9])

            for message in item.diagnostics:
                diagnostics.append(self._build_diagnostic(item, message))

        output_filename = f"tms_finance_internal_reconciliation_{uuid4().hex}.xlsx"
        output_path = os.path.join(output_root, output_filename)
        target_wb.save(output_path)

        return {
            "success": True,
            "message": (
                f"内销对账单导入完成：新增 {appended_count} 行，"
                f"跳过 {duplicate_count} 行。"
            ),
            "output_path": output_path,
            "output_file": output_filename,
            "appended_count": appended_count,
            "skipped_count": duplicate_count,
            "duplicate_count": duplicate_count,
            "diagnostic_count": len(diagnostics),
            "diagnostics": diagnostics,
            "totals": {
                "quantity": self._number_for_response(totals["quantity"]),
                "purchase_amount": self._money_for_response(totals["purchase_amount"]),
                "sales_amount_with_tax": self._money_for_response(totals["sales_amount_with_tax"]),
            },
            "source_summary": {
                "sample_rows": len(sample_rows),
                "bulk_rows": len(bulk_rows),
            },
            "logs": [
                f"Sample 提取 {len(sample_rows)} 行",
                f"Bulk 提取 {len(bulk_rows)} 行",
                f"新增 {appended_count} 行，跳过 {duplicate_count} 行",
            ],
        }

    def _extract_source_rows(self, workbook_path: str) -> List[ExtractedRow]:
        values_wb = openpyxl.load_workbook(workbook_path, data_only=True, read_only=False)
        formula_wb = openpyxl.load_workbook(workbook_path, data_only=False, read_only=False)
        rows: List[ExtractedRow] = []

        for values_ws in values_wb.worksheets:
            if values_ws.sheet_state != "visible":
                continue
            formula_ws = formula_wb[values_ws.title]
            columns = self._find_source_columns(values_ws)
            if columns is None:
                continue
            header_row = self._find_header_row(values_ws)
            if header_row is None:
                continue

            # 源表为两层表头：主表头下一行是单价/税金/金额子表头，数据从再下一行开始。
            row_index = header_row + 2
            while row_index <= values_ws.max_row:
                if not self._is_business_row(values_ws, row_index, columns):
                    break
                rows.append(
                    self._build_extracted_row(
                        workbook_path,
                        values_ws,
                        formula_ws,
                        row_index,
                        columns,
                    )
                )
                row_index += 1

        return rows

    def _find_source_columns(self, ws: Worksheet) -> Optional[SourceColumns]:
        header_row = self._find_header_row(ws)
        if header_row is None:
            return None

        header_map = self._build_header_map(ws, header_row)
        required = [
            "款号",
            "颜色",
            "描述",
            "订单号",
            "客户订单号",
            "客户编号",
            "客户仓库",
            "大货交期",
            "数量",
            "TMS 业务",
        ]
        if any(name not in header_map for name in required):
            return None

        return SourceColumns(
            style=header_map["款号"],
            article=header_map["颜色"],
            description=header_map["描述"],
            order=header_map["订单号"],
            customer_order=header_map["客户订单号"],
            customer_no=header_map["客户编号"],
            warehouse=header_map["客户仓库"],
            delivery_date=header_map["大货交期"],
            quantity=header_map["数量"],
            purchase_amount=14,
            tms_unit_price=15,
            promo_fee=17,
            sales_amount=18,
            vendor_code=19,
            vendor_name=20,
            mr=header_map["TMS 业务"],
            commercial_invoice=header_map.get("TMS发票#"),
        )

    def _find_header_row(self, ws: Worksheet) -> Optional[int]:
        for row_index in range(1, min(ws.max_row, 10) + 1):
            values = {self._clean_text(ws.cell(row_index, column).value) for column in range(1, ws.max_column + 1)}
            if {"款号", "订单号", "数量"}.issubset(values):
                return row_index
        return None

    def _build_header_map(self, ws: Worksheet, header_row: int) -> Dict[str, int]:
        mapping: Dict[str, int] = {}
        for column in range(1, ws.max_column + 1):
            header = self._clean_text(ws.cell(header_row, column).value)
            if header:
                mapping[header] = column
        return mapping

    def _is_business_row(self, ws: Worksheet, row: int, columns: SourceColumns) -> bool:
        style = self._clean_text(ws.cell(row, columns.style).value)
        order = self._normalize_order(ws.cell(row, columns.order).value)
        quantity = ws.cell(row, columns.quantity).value
        return bool(style and order and self._parse_decimal(quantity) is not None)

    def _build_extracted_row(
        self,
        workbook_path: str,
        values_ws: Worksheet,
        formula_ws: Worksheet,
        row: int,
        columns: SourceColumns,
    ) -> ExtractedRow:
        warehouse = self._clean_text(values_ws.cell(row, columns.warehouse).value)
        remark = "SAMPLE" if warehouse.upper() == "MSO" else "BULK"
        vendor, vendor_diagnostic = self._map_vendor(
            values_ws.cell(row, columns.vendor_code).value,
            values_ws.cell(row, columns.vendor_name).value,
        )
        style = self._normalize_style(values_ws.cell(row, columns.style).value)
        order = self._normalize_order(values_ws.cell(row, columns.order).value)
        article = self._clean_text(values_ws.cell(row, columns.article).value)
        commercial_invoice = (
            self._clean_text(values_ws.cell(row, columns.commercial_invoice).value)
            if columns.commercial_invoice
            else ""
        )
        purchase_amount = self._read_purchase_amount(values_ws, row, columns)
        sales_amount = self._read_sales_amount(values_ws, formula_ws, row, columns)
        promo_fee = self._money_or_blank(values_ws.cell(row, columns.promo_fee).value)
        quantity = self._number_for_cell(values_ws.cell(row, columns.quantity).value)
        diagnostics = ["源表未提供系统 Sales invoice/Purchase invoice 长号"]
        if vendor_diagnostic:
            diagnostics.append(vendor_diagnostic)

        purchase_text = f"#{commercial_invoice}()" if commercial_invoice else ""
        sales_text = f"#{commercial_invoice}()" if commercial_invoice else ""
        target_values = [
            None,
            None,
            None,
            None,
            remark,
            vendor,
            "adidas",
            quantity,
            purchase_amount,
            sales_amount,
            self._clean_text(values_ws.cell(row, columns.description).value),
            style,
            order,
            article,
            self._clean_text(values_ws.cell(row, columns.customer_no).value),
            self._clean_placeholder(values_ws.cell(row, columns.customer_order).value),
            values_ws.cell(row, columns.delivery_date).value,
            self._clean_text(values_ws.cell(row, columns.mr).value),
            commercial_invoice,
            promo_fee,
            purchase_text,
            sales_text,
        ]

        return ExtractedRow(
            source_file=os.path.basename(workbook_path),
            source_sheet=values_ws.title,
            source_row=row,
            key=(remark, style, order, article),
            target_values=target_values,
            diagnostics=diagnostics,
        )

    def _read_purchase_amount(self, ws: Worksheet, row: int, columns: SourceColumns) -> Optional[float]:
        amount = self._parse_decimal(ws.cell(row, columns.purchase_amount).value)
        if amount is not None:
            return self._money_for_response(amount)

        quantity = self._decimal_or_zero(ws.cell(row, columns.quantity).value)
        unit_price = self._decimal_or_zero(ws.cell(row, 12).value)
        tax = self._round_money(quantity * unit_price * Decimal("0.13"))
        return self._money_for_response(quantity * unit_price + tax)

    def _read_sales_amount(
        self,
        values_ws: Worksheet,
        formula_ws: Worksheet,
        row: int,
        columns: SourceColumns,
    ) -> Optional[float]:
        amount = self._parse_decimal(values_ws.cell(row, columns.sales_amount).value)
        if amount is not None:
            return self._money_for_response(amount)

        quantity = self._decimal_or_zero(values_ws.cell(row, columns.quantity).value)
        unit_price = self._decimal_or_zero(values_ws.cell(row, columns.tms_unit_price).value)
        promo_fee = self._decimal_or_zero(values_ws.cell(row, columns.promo_fee).value)
        tax = self._round_money((quantity * unit_price + promo_fee) * Decimal("0.13"))
        formula_value = self._clean_text(formula_ws.cell(row, columns.sales_amount).value)
        if formula_value.startswith("="):
            return self._money_for_response(quantity * unit_price + tax + promo_fee)
        return None

    def _collect_existing_keys(self, workbook: openpyxl.Workbook) -> set[BusinessKey]:
        keys: set[BusinessKey] = set()
        for ws in workbook.worksheets:
            if self._clean_text(ws.cell(1, 2).value).lower() != "sales invoice":
                continue
            for row in range(2, ws.max_row + 1):
                remark = self._clean_text(ws.cell(row, 5).value).upper()
                style = self._normalize_style(ws.cell(row, 12).value)
                order = self._normalize_order(ws.cell(row, 13).value)
                article = self._clean_text(ws.cell(row, 14).value)
                if remark and style and order and article:
                    keys.add((remark, style, order, article))
        return keys

    def _find_last_nonempty_row(self, ws: Worksheet) -> int:
        for row in range(ws.max_row, 1, -1):
            if any(ws.cell(row, column).value not in (None, "") for column in range(1, len(self.TARGET_HEADERS) + 1)):
                return row
        return 1

    def _copy_row_style(self, ws: Worksheet, source_row: int, target_row: int) -> None:
        for column in range(1, len(self.TARGET_HEADERS) + 1):
            source = ws.cell(source_row, column)
            target = ws.cell(target_row, column)
            if source.has_style:
                target._style = copy(source._style)
            if source.number_format:
                target.number_format = source.number_format
            if source.alignment:
                target.alignment = copy(source.alignment)
            if source.font:
                target.font = copy(source.font)
            if source.fill:
                target.fill = copy(source.fill)
            if source.border:
                target.border = copy(source.border)

    def _format_appended_row(self, ws: Worksheet, row: int) -> None:
        for column in (9, 10, 20):
            ws.cell(row, column).number_format = "0.00"

    def _build_diagnostic(self, item: ExtractedRow, reason: str) -> Dict[str, Any]:
        return {
            "source_file": item.source_file,
            "source_sheet": item.source_sheet,
            "source_row": item.source_row,
            "reason": reason,
            "key": {
                "remark": item.key[0],
                "style": item.key[1],
                "order": item.key[2],
                "article": item.key[3],
            },
        }

    def _map_vendor(self, vendor_code: Any, vendor_name: Any) -> Tuple[str, str]:
        code = self._clean_text(vendor_code)
        name = self._clean_text(vendor_name)
        for candidate in (code, name):
            normalized = self._normalize_vendor_key(candidate)
            if normalized in self.VENDOR_ALIASES:
                return self.VENDOR_ALIASES[normalized], ""
        fallback = name or code
        return fallback, f"未知工厂映射：{fallback}" if fallback else "缺少工厂信息"

    def _normalize_vendor_key(self, value: str) -> str:
        return value.strip().upper() if value.isascii() else value.strip()

    def _clean_placeholder(self, value: Any) -> str:
        text = self._clean_text(value)
        return "" if text.lower() in {"(blank)", "(空白)", "none"} else text

    def _clean_text(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value).strip()

    def _normalize_style(self, value: Any) -> str:
        text = self._clean_text(value).upper()
        while text.endswith("."):
            text = text[:-1]
        return text

    def _normalize_order(self, value: Any) -> str:
        text = self._clean_text(value)
        if text.endswith(".0") and text[:-2].isdigit():
            return text[:-2]
        return text

    def _money_or_blank(self, value: Any) -> Any:
        amount = self._parse_decimal(value)
        return "" if amount is None else self._money_for_response(amount)

    def _number_for_cell(self, value: Any) -> Any:
        number = self._parse_decimal(value)
        if number is None:
            return value
        return self._number_for_response(number)

    def _parse_decimal(self, value: Any) -> Optional[Decimal]:
        if value in (None, ""):
            return None
        try:
            return Decimal(str(value).replace(",", "").strip())
        except (InvalidOperation, AttributeError):
            return None

    def _decimal_or_zero(self, value: Any) -> Decimal:
        return self._parse_decimal(value) or Decimal("0")

    def _round_money(self, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _money_for_response(self, value: Decimal) -> float:
        return float(self._round_money(value))

    def _number_for_response(self, value: Decimal) -> int | float:
        if value == value.to_integral_value():
            return int(value)
        return float(value)
