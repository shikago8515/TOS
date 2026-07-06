from __future__ import annotations

import re
from copy import copy
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from uuid import uuid4

import openpyxl


@dataclass(frozen=True)
class ResultSetRow:
    working_number: str
    article_number: str
    po_number: str
    market_po_number: str
    gps_customer_number: str
    assigned_factory: str
    podd: datetime | None
    price_per_unit: float
    total_adjustments: float
    ordered_quantity: float
    shipped_quantity: float
    shipped_status: str
    order_type: str


@dataclass
class ResultSetGroup:
    working_number: str
    article_number: str
    po_number: str
    market_po_number: str
    gps_customer_number: str
    assigned_factory: str
    podd: datetime | None
    price_per_unit: float
    total_adjustments: float
    ordered_quantity: float = 0
    shipped_quantity: float = 0
    statuses: set[str] | None = None

    def __post_init__(self) -> None:
        if self.statuses is None:
            self.statuses = set()


@dataclass(frozen=True)
class TemplateLookupRow:
    pack: Any
    season: Any
    description: Any
    bulk_handover_date: Any
    factory_price: Any
    tms_merchandiser: Any
    factory_merchandiser: Any


@dataclass(frozen=True)
class TargetRow:
    pack: Any
    season: Any
    working_number: str
    article_number: str
    description: Any
    po_number: str
    market_po_number: str
    gps_customer_number: str
    customer_warehouse: str
    bulk_handover_date: Any
    ordered_quantity: float
    factory_price: Any
    tms_price: float
    total_adjustments: float
    factory_code: str
    factory_name: str
    tms_merchandiser: Any
    factory_merchandiser: Any


class JasonResultSetExcelModule:
    """Generate Jason target Excel rows from an adidas Result Set export."""

    REQUIRED_COLUMNS = [
        "Working Number",
        "Article Number",
        "PO Number",
        "Market PO Number",
        "Gps Customer Number",
        "Assigned Factory",
        "PODD",
        "Price Per Unit",
        "Total Adjustments",
        "Ordered Quantity",
        "Shipped Qty",
        "Shipped Status",
        "Order Type",
    ]
    ALLOWED_ORDER_TYPES = {"ZGPS", "ZREG"}

    def __init__(self, template_path: str | Path | None = None) -> None:
        self.template_path = Path(template_path) if template_path is not None else self._default_template_path()

    def process_result_set(
        self,
        *,
        result_set_path: str | Path,
        target_month: str,
        output_dir: str | Path,
    ) -> dict[str, Any]:
        year, month = self._parse_target_month(target_month)
        template_context = self._load_template_context()
        rows = self._read_result_set_rows(result_set_path)
        target_rows, warnings, counts = self._build_target_rows(
            rows,
            target_year=year,
            target_month=month,
            template_context=template_context,
        )

        output_path = Path(output_dir) / f"jason_result_set_excel_{uuid4().hex}.xlsx"
        self._write_output_workbook(template_context["workbook"], target_rows, output_path)

        return {
            "success": True,
            "message": f"Jason Result Set Excel 生成完成，共写入 {len(target_rows)} 行",
            "output_path": str(output_path),
            "written_row_count": len(target_rows),
            "not_shipped_row_count": counts["not_shipped"],
            "partial_row_count": counts["partial"],
            "unknown_lookup_count": counts["unknown_lookup"],
            "warnings": warnings,
        }

    @classmethod
    def _default_template_path(cls) -> Path:
        return Path(__file__).resolve().parent.parent / "templates" / "jason_result_set_excel_template.xlsx"

    def _load_template_context(self) -> dict[str, Any]:
        if not self.template_path.exists():
            raise ValueError("Jason Result Set Excel 模板不存在")

        workbook = openpyxl.load_workbook(self.template_path, data_only=False, keep_links=False)
        if "目标表" not in workbook.sheetnames:
            workbook.close()
            raise ValueError("Jason Result Set Excel 模板缺少目标表")

        target_sheet = workbook["目标表"]
        warehouse_lookup = self._read_two_column_lookup(workbook, "Sheet2")
        factory_lookup = self._read_two_column_lookup(workbook, "Sheet3")
        row_lookup, article_lookup = self._read_target_lookup(target_sheet)
        style_templates = [
            self._capture_cell_style(target_sheet.cell(row=3, column=column_index))
            for column_index in range(1, 24)
        ]

        return {
            "workbook": workbook,
            "target_sheet": target_sheet,
            "warehouse_lookup": warehouse_lookup,
            "factory_lookup": factory_lookup,
            "row_lookup": row_lookup,
            "article_lookup": article_lookup,
            "style_templates": style_templates,
        }

    def _read_two_column_lookup(
        self,
        workbook: openpyxl.Workbook,
        sheet_name: str,
    ) -> dict[str, str]:
        if sheet_name not in workbook.sheetnames:
            return {}

        sheet = workbook[sheet_name]
        lookup: dict[str, str] = {}
        for row in sheet.iter_rows(min_row=2, values_only=True):
            key = self._normalize_identifier(row[0] if len(row) > 0 else None)
            value = self._normalize_text(row[1] if len(row) > 1 else None)
            if key:
                lookup[key] = value
        return lookup

    def _read_target_lookup(
        self,
        target_sheet: openpyxl.worksheet.worksheet.Worksheet,
    ) -> tuple[dict[tuple[str, str], TemplateLookupRow], dict[str, TemplateLookupRow]]:
        row_lookup: dict[tuple[str, str], TemplateLookupRow] = {}
        article_lookup: dict[str, TemplateLookupRow] = {}

        for row_index in range(3, target_sheet.max_row + 1):
            working_number = self._normalize_identifier(target_sheet.cell(row=row_index, column=3).value)
            article_number = self._normalize_identifier(target_sheet.cell(row=row_index, column=4).value)
            po_number = self._normalize_identifier(target_sheet.cell(row=row_index, column=6).value)
            if not working_number and not article_number and not po_number:
                continue
            if not working_number or not article_number:
                continue
            if str(po_number).startswith("="):
                continue

            lookup_row = TemplateLookupRow(
                pack=target_sheet.cell(row=row_index, column=1).value,
                season=target_sheet.cell(row=row_index, column=2).value,
                description=target_sheet.cell(row=row_index, column=5).value,
                bulk_handover_date=target_sheet.cell(row=row_index, column=10).value,
                factory_price=target_sheet.cell(row=row_index, column=12).value,
                tms_merchandiser=target_sheet.cell(row=row_index, column=22).value,
                factory_merchandiser=target_sheet.cell(row=row_index, column=23).value,
            )
            row_lookup[(working_number, article_number)] = lookup_row
            article_lookup.setdefault(article_number, lookup_row)

        return row_lookup, article_lookup

    def _read_result_set_rows(self, result_set_path: str | Path) -> list[ResultSetRow]:
        workbook = openpyxl.load_workbook(result_set_path, data_only=True, read_only=True, keep_links=False)
        try:
            sheet = workbook["Result Set"] if "Result Set" in workbook.sheetnames else workbook.worksheets[0]
            header_values = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), None)
            if not header_values:
                raise ValueError("Result Set 表头为空")
            headers = {
                self._normalize_header(value): index
                for index, value in enumerate(header_values)
                if self._normalize_header(value)
            }
            missing_columns = [
                column_name
                for column_name in self.REQUIRED_COLUMNS
                if self._normalize_header(column_name) not in headers
            ]
            if missing_columns:
                raise ValueError(f"Result Set 缺少必需列：{', '.join(missing_columns)}")

            rows: list[ResultSetRow] = []
            for values in sheet.iter_rows(min_row=2, values_only=True):
                if not any(value not in (None, "") for value in values):
                    continue
                rows.append(self._parse_result_set_row(values, headers))
            return rows
        finally:
            workbook.close()

    def _parse_result_set_row(
        self,
        values: tuple[Any, ...],
        headers: dict[str, int],
    ) -> ResultSetRow:
        def read(column_name: str) -> Any:
            index = headers[self._normalize_header(column_name)]
            return values[index] if index < len(values) else None

        return ResultSetRow(
            working_number=self._normalize_identifier(read("Working Number")),
            article_number=self._normalize_identifier(read("Article Number")),
            po_number=self._normalize_identifier(read("PO Number")),
            market_po_number=self._normalize_identifier(read("Market PO Number")),
            gps_customer_number=self._normalize_identifier(read("Gps Customer Number")),
            assigned_factory=self._normalize_identifier(read("Assigned Factory")),
            podd=self._coerce_datetime(read("PODD")),
            price_per_unit=self._coerce_float(read("Price Per Unit")),
            total_adjustments=self._coerce_float(read("Total Adjustments")),
            ordered_quantity=self._coerce_float(read("Ordered Quantity")),
            shipped_quantity=self._coerce_float(read("Shipped Qty")),
            shipped_status=self._normalize_text(read("Shipped Status")),
            order_type=self._normalize_identifier(read("Order Type")),
        )

    def _build_target_rows(
        self,
        rows: Iterable[ResultSetRow],
        *,
        target_year: int,
        target_month: int,
        template_context: dict[str, Any],
    ) -> tuple[list[TargetRow], list[str], dict[str, int]]:
        warehouse_lookup: dict[str, str] = template_context["warehouse_lookup"]
        factory_lookup: dict[str, str] = template_context["factory_lookup"]
        row_lookup: dict[tuple[str, str], TemplateLookupRow] = template_context["row_lookup"]
        article_lookup: dict[str, TemplateLookupRow] = template_context["article_lookup"]
        allowed_gps = set(warehouse_lookup)
        groups: dict[tuple[Any, ...], ResultSetGroup] = {}

        for row in rows:
            if row.order_type not in self.ALLOWED_ORDER_TYPES:
                continue
            if allowed_gps and row.gps_customer_number not in allowed_gps:
                continue
            if row.shipped_status == "Fully Shipped":
                continue
            if row.shipped_status != "Partially Shipped" and not self._is_target_month(row.podd, target_year, target_month):
                continue

            group_key = (
                row.working_number,
                row.article_number,
                row.po_number,
                row.market_po_number,
                row.gps_customer_number,
                row.assigned_factory,
                row.podd,
                row.price_per_unit,
                row.total_adjustments,
            )
            group = groups.get(group_key)
            if group is None:
                group = ResultSetGroup(
                    working_number=row.working_number,
                    article_number=row.article_number,
                    po_number=row.po_number,
                    market_po_number=row.market_po_number,
                    gps_customer_number=row.gps_customer_number,
                    assigned_factory=row.assigned_factory,
                    podd=row.podd,
                    price_per_unit=row.price_per_unit,
                    total_adjustments=row.total_adjustments,
                )
                groups[group_key] = group

            group.ordered_quantity += row.ordered_quantity
            group.shipped_quantity += row.shipped_quantity
            group.statuses.add(row.shipped_status)

        warnings: list[str] = []
        target_rows: list[TargetRow] = []
        counts = {"not_shipped": 0, "partial": 0, "unknown_lookup": 0}

        for group in sorted(groups.values(), key=self._group_sort_key):
            is_partial = "Partially Shipped" in group.statuses
            quantity = group.ordered_quantity - group.shipped_quantity if is_partial else group.ordered_quantity
            if quantity <= 0:
                continue

            lookup = row_lookup.get((group.working_number, group.article_number)) or article_lookup.get(group.article_number)
            if lookup is None:
                lookup = TemplateLookupRow("", "", "", group.podd, "", "", "")
                counts["unknown_lookup"] += 1
                warnings.append(
                    f"未找到模板 lookup：Working Number={group.working_number}, Article={group.article_number}"
                )

            adjustment = (
                round(group.total_adjustments * group.shipped_quantity / group.ordered_quantity, 2)
                if is_partial and group.ordered_quantity
                else group.total_adjustments
            )
            target_rows.append(
                TargetRow(
                    pack=lookup.pack,
                    season=lookup.season,
                    working_number=group.working_number,
                    article_number=group.article_number,
                    description=lookup.description,
                    po_number=group.po_number,
                    market_po_number=group.market_po_number,
                    gps_customer_number=group.gps_customer_number,
                    customer_warehouse=warehouse_lookup.get(group.gps_customer_number, ""),
                    bulk_handover_date=lookup.bulk_handover_date or group.podd,
                    ordered_quantity=self._format_quantity(quantity),
                    factory_price=lookup.factory_price,
                    tms_price=group.price_per_unit,
                    total_adjustments=adjustment,
                    factory_code=group.assigned_factory,
                    factory_name=factory_lookup.get(group.assigned_factory, ""),
                    tms_merchandiser=lookup.tms_merchandiser,
                    factory_merchandiser=lookup.factory_merchandiser,
                )
            )
            counts["partial" if is_partial else "not_shipped"] += 1

        return target_rows, warnings, counts

    def _write_output_workbook(
        self,
        workbook: openpyxl.Workbook,
        target_rows: list[TargetRow],
        output_path: Path,
    ) -> None:
        target_sheet = workbook["目标表"]
        style_templates = [
            self._capture_cell_style(target_sheet.cell(row=3, column=column_index))
            for column_index in range(1, 24)
        ]

        if target_sheet.max_row >= 3:
            target_sheet.delete_rows(3, target_sheet.max_row - 2)

        for row_offset, target_row in enumerate(target_rows, start=3):
            self._apply_row_style(target_sheet, row_offset, style_templates)
            values = [
                target_row.pack,
                target_row.season,
                target_row.working_number,
                target_row.article_number,
                target_row.description,
                target_row.po_number,
                target_row.market_po_number,
                target_row.gps_customer_number,
                target_row.customer_warehouse,
                target_row.bulk_handover_date,
                target_row.ordered_quantity,
                target_row.factory_price,
                f"=ROUND(0.13*L{row_offset}*K{row_offset},2)",
                f"=ROUND(L{row_offset}*K{row_offset}+M{row_offset},2)",
                target_row.tms_price,
                f"=ROUND(0.13*(K{row_offset}*O{row_offset}+Q{row_offset}),2)",
                target_row.total_adjustments,
                f"=ROUND(O{row_offset}*K{row_offset}+P{row_offset}+Q{row_offset},2)",
                target_row.factory_code,
                target_row.factory_name,
                None,
                target_row.tms_merchandiser,
                target_row.factory_merchandiser,
            ]
            for column_index, value in enumerate(values, start=1):
                target_sheet.cell(row=row_offset, column=column_index).value = value

        total_row = 3 + len(target_rows)
        self._apply_row_style(target_sheet, total_row, style_templates)
        last_data_row = total_row - 1
        if target_rows:
            target_sheet.cell(row=total_row, column=6).value = f"=COUNTA(F3:F{last_data_row})"
            target_sheet.cell(row=total_row, column=11).value = f"=SUM(K3:K{last_data_row})"
            target_sheet.cell(row=total_row, column=13).value = f"=SUM(M3:M{last_data_row})"
            target_sheet.cell(row=total_row, column=14).value = f"=SUM(N3:N{last_data_row})"
            target_sheet.cell(row=total_row, column=16).value = f"=SUM(P3:P{last_data_row})"
            target_sheet.cell(row=total_row, column=17).value = f"=SUM(Q3:Q{last_data_row})"
            target_sheet.cell(row=total_row, column=18).value = f"=SUM(R3:R{last_data_row})"

        output_path.parent.mkdir(parents=True, exist_ok=True)
        workbook.save(output_path)
        workbook.close()

    def _capture_cell_style(self, cell: openpyxl.cell.cell.Cell) -> dict[str, Any]:
        return {
            "style": copy(cell._style),
            "number_format": cell.number_format,
            "font": copy(cell.font),
            "fill": copy(cell.fill),
            "border": copy(cell.border),
            "alignment": copy(cell.alignment),
            "protection": copy(cell.protection),
        }

    def _apply_row_style(
        self,
        sheet: openpyxl.worksheet.worksheet.Worksheet,
        row_index: int,
        style_templates: list[dict[str, Any]],
    ) -> None:
        for column_index, style in enumerate(style_templates, start=1):
            cell = sheet.cell(row=row_index, column=column_index)
            cell._style = copy(style["style"])
            cell.number_format = style["number_format"]
            cell.font = copy(style["font"])
            cell.fill = copy(style["fill"])
            cell.border = copy(style["border"])
            cell.alignment = copy(style["alignment"])
            cell.protection = copy(style["protection"])

    def _group_sort_key(self, group: ResultSetGroup) -> tuple[str, str, str]:
        return (group.working_number, group.article_number, group.po_number)

    @staticmethod
    def _parse_target_month(target_month: str) -> tuple[int, int]:
        if not re.fullmatch(r"\d{4}-\d{2}", str(target_month or "")):
            raise ValueError("target_month 必须是 YYYY-MM")
        year_text, month_text = target_month.split("-", 1)
        year = int(year_text)
        month = int(month_text)
        if month < 1 or month > 12:
            raise ValueError("target_month 月份无效")
        return year, month

    @staticmethod
    def _is_target_month(value: datetime | None, year: int, month: int) -> bool:
        return value is not None and value.year == year and value.month == month

    @staticmethod
    def _coerce_datetime(value: Any) -> datetime | None:
        if isinstance(value, datetime):
            return value
        return None

    @staticmethod
    def _coerce_float(value: Any) -> float:
        if value in (None, ""):
            return 0.0
        try:
            return float(str(value).replace(",", ""))
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _format_quantity(value: float) -> int | float:
        return int(value) if float(value).is_integer() else value

    @staticmethod
    def _normalize_header(value: Any) -> str:
        return str(value or "").strip().lower()

    @staticmethod
    def _normalize_text(value: Any) -> str:
        if value is None:
            return ""
        text = str(value).strip()
        return "" if text.lower() in {"none", "nan"} else text

    @classmethod
    def _normalize_identifier(cls, value: Any) -> str:
        text = cls._normalize_text(value)
        if text.endswith(".0") and text[:-2].isdigit():
            return text[:-2]
        return text
