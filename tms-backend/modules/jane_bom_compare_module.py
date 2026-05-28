# -*- coding: utf-8 -*-
"""
Jane BOM 核对模块。

上传 T1 PRODUCTION 和多张 BOM 后，按 Style ID + Recording Facility ID 对应
BOM 的 Article + Factory，核对材料号和供应商，并在原表上用红色标出差异。
"""

import copy
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

import openpyxl
from openpyxl.styles import PatternFill

from utils.file_utils import ensure_dir


@dataclass(frozen=True)
class BomMaterial:
    """BOM 中一条可核对的 MAIN COMPONENT 面料记录。"""

    article: str
    factory: str
    material_ref: str
    group_code_supplier: str
    working: str
    season: str
    source_file: str
    source_row: int


class JaneBomCompareModule:
    """Jane-BOM 核对业务逻辑。"""

    MAIN_COMPONENT_SECTION = "MAIN COMPONENT"
    NO_FILL = PatternFill(fill_type=None)
    RED_FILL = PatternFill("solid", fgColor="FFFFC7CE")
    REQUIRED_PRODUCTION_COLUMNS = [
        "Style ID",
        "Recording Facility ID",
        "Input Material UID/ID",
        "Seller Facility ID",
    ]
    REQUIRED_BOM_COLUMNS = [
        "Part Group #",
        "Material Reference #",
        "Group Code Supplier",
        "Color",
    ]
    DIAGNOSTIC_HEADERS = [
        ("check result", "Check Result"),
        ("mismatch source", "Mismatch Source"),
        ("check detail", "Check Detail"),
        ("bom source file", "BOM Source File"),
        ("bom source row", "BOM Source Row"),
    ]

    @staticmethod
    def _normalize_text(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        text = str(value).strip()
        if text.lower() in {"none", "nan", "nat"}:
            return ""
        return text

    @classmethod
    def _normalize_key(cls, value: Any) -> str:
        return cls._normalize_text(value).upper()

    @classmethod
    def _find_header_row(
        cls,
        ws,
        required_columns: Sequence[str],
        max_scan_rows: int = 30,
    ) -> Tuple[int, Dict[str, int]]:
        required = [column.lower() for column in required_columns]
        for row_index in range(1, min(ws.max_row, max_scan_rows) + 1):
            columns: Dict[str, int] = {}
            for column_index in range(1, ws.max_column + 1):
                value = cls._normalize_text(
                    ws.cell(row=row_index, column=column_index).value,
                ).lower()
                if value:
                    columns[value] = column_index
            if all(column in columns for column in required):
                return row_index, columns
        raise ValueError(f"未找到表头：{', '.join(required_columns)}")

    @classmethod
    def _parse_factory_code(cls, value: Any) -> str:
        text = cls._normalize_text(value)
        if "|" in text:
            return cls._normalize_text(text.split("|", 1)[0])
        return text

    @classmethod
    def _parse_article_from_group(cls, value: Any) -> str:
        parts = [part.strip() for part in cls._normalize_text(value).split("|")]
        if len(parts) >= 2:
            return parts[1]
        return ""

    def _read_bom_materials(self, bom_path: str) -> List[BomMaterial]:
        wb = openpyxl.load_workbook(bom_path, data_only=False)
        ws = wb.active

        working = self._normalize_text(ws["B1"].value)
        season = self._normalize_text(ws["B3"].value)
        factory = self._parse_factory_code(ws["B5"].value)
        if not factory:
            raise ValueError(f"{os.path.basename(bom_path)} 缺少 Factory")

        header_row, header_columns = self._find_header_row(
            ws,
            self.REQUIRED_BOM_COLUMNS,
        )
        article_columns: List[Tuple[int, str]] = []
        for column_index in range(1, ws.max_column + 1):
            header = self._normalize_text(ws.cell(row=header_row, column=column_index).value)
            if header.lower() != "color":
                continue
            article = self._parse_article_from_group(
                ws.cell(row=header_row - 1, column=column_index).value,
            )
            if article:
                article_columns.append((column_index, article))

        if not article_columns:
            raise ValueError(f"{os.path.basename(bom_path)} 未识别到 Article/Color 列")

        rows: List[BomMaterial] = []
        seen: Set[Tuple[str, str, str, str]] = set()
        current_section = ""
        main_component_started = False
        for row_index in range(header_row + 1, ws.max_row + 1):
            part_name = self._normalize_text(ws.cell(row=row_index, column=2).value)
            part_group = self._normalize_text(
                ws.cell(row=row_index, column=header_columns["part group #"]).value,
            )
            material_ref = self._normalize_text(
                ws.cell(row=row_index, column=header_columns["material reference #"]).value,
            )

            # BOM 的分段行通常只有 Part Name，没有 Part Group / Material Reference。
            if part_name and not part_group and not material_ref:
                next_section = part_name.upper()
                if main_component_started and next_section != self.MAIN_COMPONENT_SECTION:
                    break
                current_section = next_section
                if current_section == self.MAIN_COMPONENT_SECTION:
                    main_component_started = True
                continue

            if current_section != self.MAIN_COMPONENT_SECTION or not material_ref:
                continue

            group_code_supplier = self._normalize_text(
                ws.cell(row=row_index, column=header_columns["group code supplier"]).value,
            )
            for color_column, article in article_columns:
                if not self._normalize_text(ws.cell(row=row_index, column=color_column).value):
                    continue

                key = (
                    self._normalize_key(article),
                    self._normalize_key(factory),
                    self._normalize_key(material_ref),
                    self._normalize_key(group_code_supplier),
                )
                if key in seen:
                    continue
                seen.add(key)
                rows.append(
                    BomMaterial(
                        article=article,
                        factory=factory,
                        material_ref=material_ref,
                        group_code_supplier=group_code_supplier,
                        working=working,
                        season=season,
                        source_file=os.path.basename(bom_path),
                        source_row=row_index,
                    ),
                )

        return rows

    def _copy_row(
        self,
        ws,
        source_row: int,
        target_row: int,
        max_column: int,
        copy_values: bool = True,
    ) -> None:
        for column_index in range(1, max_column + 1):
            source = ws.cell(row=source_row, column=column_index)
            target = ws.cell(row=target_row, column=column_index)
            target.value = source.value if copy_values else None
            if source.has_style:
                target._style = copy.copy(source._style)
                if not copy_values:
                    self._clear_fill(target)
            if source.number_format:
                target.number_format = source.number_format
            if source.alignment:
                target.alignment = copy.copy(source.alignment)
            if source.protection:
                target.protection = copy.copy(source.protection)

    def _mark_red(self, cell) -> None:
        cell.fill = copy.copy(self.RED_FILL)

    def _clear_fill(self, cell) -> None:
        cell.fill = copy.copy(self.NO_FILL)

    def _clear_data_fills(self, ws, header_row: int, max_column: int) -> None:
        for row_index in range(header_row + 1, ws.max_row + 1):
            for column_index in range(1, max_column + 1):
                self._clear_fill(ws.cell(row=row_index, column=column_index))

    def _copy_header_style(self, ws, header_row: int, source_col: int, target_col: int) -> None:
        source = ws.cell(row=header_row, column=source_col)
        target = ws.cell(row=header_row, column=target_col)
        if source.has_style:
            target._style = copy.copy(source._style)
        if source.number_format:
            target.number_format = source.number_format
        if source.alignment:
            target.alignment = copy.copy(source.alignment)
        if source.protection:
            target.protection = copy.copy(source.protection)
        ws.column_dimensions[target.column_letter].width = ws.column_dimensions[source.column_letter].width

    def _insert_column_after(
        self,
        ws,
        header_row: int,
        columns: Dict[str, int],
        source_key: str,
        new_key: str,
        header: str,
    ) -> int:
        source_col = columns[source_key]
        insert_at = source_col + 1
        ws.insert_cols(insert_at)
        for column_name, column_index in list(columns.items()):
            if column_index >= insert_at:
                columns[column_name] = column_index + 1
        columns[new_key] = insert_at
        ws.cell(row=header_row, column=insert_at, value=header)
        self._copy_header_style(ws, header_row, source_col, insert_at)
        return insert_at

    def _append_column(
        self,
        ws,
        header_row: int,
        columns: Dict[str, int],
        new_key: str,
        header: str,
    ) -> int:
        append_at = ws.max_column + 1
        columns[new_key] = append_at
        ws.cell(row=header_row, column=append_at, value=header)
        self._copy_header_style(ws, header_row, max(1, append_at - 1), append_at)
        return append_at

    def _prepare_output_columns(self, ws, header_row: int, columns: Dict[str, int]) -> None:
        self._insert_column_after(
            ws,
            header_row,
            columns,
            "input material uid/id",
            "correct material reference #",
            "Correct Material Reference # (BOM)",
        )
        self._insert_column_after(
            ws,
            header_row,
            columns,
            "seller facility id",
            "correct group code supplier",
            "Correct Group Code Supplier (BOM)",
        )
        for key, header in self.DIAGNOSTIC_HEADERS:
            self._append_column(ws, header_row, columns, key, header)

    def _set_row_diagnostic(
        self,
        ws,
        row_index: int,
        columns: Dict[str, int],
        result: str,
        source: str,
        detail: str,
        material: Optional[BomMaterial] = None,
    ) -> None:
        result_cell = ws.cell(row=row_index, column=columns["check result"])
        source_cell = ws.cell(row=row_index, column=columns["mismatch source"])
        if not self._normalize_text(result_cell.value):
            result_cell.value = result
        if not self._normalize_text(source_cell.value):
            source_cell.value = source
        detail_cell = ws.cell(row=row_index, column=columns["check detail"])
        existing_detail = self._normalize_text(detail_cell.value)
        detail_cell.value = f"{existing_detail}；{detail}" if existing_detail else detail
        if material:
            file_cell = ws.cell(row=row_index, column=columns["bom source file"])
            row_cell = ws.cell(row=row_index, column=columns["bom source row"])
            if not self._normalize_text(file_cell.value):
                file_cell.value = material.source_file
            if not self._normalize_text(row_cell.value):
                row_cell.value = material.source_row

    def _join_unique(self, values: Sequence[Any]) -> str:
        unique_values: List[str] = []
        seen: Set[str] = set()
        for value in values:
            text = self._normalize_text(value)
            key = self._normalize_key(text)
            if not text or key in seen:
                continue
            seen.add(key)
            unique_values.append(text)
        return " / ".join(unique_values)

    def _append_missing_row(
        self,
        ws,
        material: BomMaterial,
        template_row: Optional[int],
        columns: Dict[str, int],
        max_column: int,
    ) -> int:
        target_row = ws.max_row + 1
        if template_row:
            self._copy_row(ws, template_row, target_row, max_column, copy_values=False)

        ws.cell(target_row, columns["style id"], material.article)
        ws.cell(target_row, columns["recording facility id"], material.factory)
        ws.cell(target_row, columns["input material uid/id"], material.material_ref)
        ws.cell(target_row, columns["seller facility id"], material.group_code_supplier)

        optional_values = {
            "working": material.working,
            "season": material.season,
        }
        for column_name, value in optional_values.items():
            if column_name in columns and value:
                ws.cell(target_row, columns[column_name], value)

        for column_name in [
            "style id",
            "recording facility id",
            "input material uid/id",
            "seller facility id",
        ]:
            self._mark_red(ws.cell(row=target_row, column=columns[column_name]))
        self._set_row_diagnostic(
            ws,
            target_row,
            columns,
            "需补入",
            "BOM存在，T1 PRODUCTION缺失",
            "BOM MAIN COMPONENT 存在该 Article/Factory/Material/Supplier，T1 PRODUCTION 缺少对应材料行。",
            material,
        )

        return target_row

    def process_reports(
        self,
        production_path: str,
        bom_paths: Sequence[str],
        output_dir: str,
    ) -> Dict[str, Any]:
        logs: List[str] = []
        try:
            if not bom_paths:
                return {
                    "success": False,
                    "message": "请至少上传 1 个 BOM 文件",
                    "logs": logs,
                }

            ensure_dir(output_dir)
            production_wb = openpyxl.load_workbook(production_path)
            production_ws = (
                production_wb["PRODUCTION"]
                if "PRODUCTION" in production_wb.sheetnames
                else production_wb.active
            )
            header_row, columns = self._find_header_row(
                production_ws,
                self.REQUIRED_PRODUCTION_COLUMNS,
                max_scan_rows=10,
            )
            self._prepare_output_columns(production_ws, header_row, columns)
            max_column = production_ws.max_column
            self._clear_data_fills(production_ws, header_row, max_column)

            expected_by_key: Dict[Tuple[str, str], List[BomMaterial]] = {}
            bom_material_row_count = 0
            for bom_path in bom_paths:
                bom_materials = self._read_bom_materials(bom_path)
                source_row_count = len({material.source_row for material in bom_materials})
                bom_material_row_count += source_row_count
                logs.append(
                    f"{os.path.basename(bom_path)} 读取 MAIN COMPONENT："
                    f"{source_row_count} 个有效源行，{len(bom_materials)} 条 Article 映射",
                )
                for material in bom_materials:
                    key = (self._normalize_key(material.article), self._normalize_key(material.factory))
                    expected_by_key.setdefault(key, []).append(material)

            if not expected_by_key:
                return {
                    "success": False,
                    "message": "未从 BOM 中读取到可核对的 MAIN COMPONENT 面料",
                    "logs": logs,
                }

            production_rows_by_key: Dict[Tuple[str, str], List[int]] = {}
            production_materials_by_key: Dict[Tuple[str, str], Set[str]] = {}
            mismatch_cell_count = 0
            no_bom_key_count = 0

            style_col = columns["style id"]
            recording_col = columns["recording facility id"]
            material_col = columns["input material uid/id"]
            seller_col = columns["seller facility id"]

            for row_index in range(header_row + 1, production_ws.max_row + 1):
                style = self._normalize_key(production_ws.cell(row=row_index, column=style_col).value)
                recording = self._normalize_key(
                    production_ws.cell(row=row_index, column=recording_col).value,
                )
                material_ref = self._normalize_key(
                    production_ws.cell(row=row_index, column=material_col).value,
                )
                seller = self._normalize_key(production_ws.cell(row=row_index, column=seller_col).value)
                if not style and not recording and not material_ref and not seller:
                    continue

                row_key = (style, recording)
                production_rows_by_key.setdefault(row_key, []).append(row_index)
                if material_ref:
                    production_materials_by_key.setdefault(row_key, set()).add(material_ref)

                expected_materials = expected_by_key.get(row_key)
                if not expected_materials:
                    self._mark_red(production_ws.cell(row=row_index, column=style_col))
                    self._mark_red(production_ws.cell(row=row_index, column=recording_col))
                    self._set_row_diagnostic(
                        production_ws,
                        row_index,
                        columns,
                        "需核对",
                        "T1 PRODUCTION存在，BOM缺失",
                        "T1 PRODUCTION 有该 Style ID/Recording Facility ID，但 BOM 未找到对应 Article/Factory。",
                    )
                    mismatch_cell_count += 2
                    no_bom_key_count += 1
                    continue

                materials_by_ref: Dict[str, List[BomMaterial]] = {}
                all_suppliers: Set[str] = set()
                for expected in expected_materials:
                    normalized_material = self._normalize_key(expected.material_ref)
                    normalized_supplier = self._normalize_key(expected.group_code_supplier)
                    materials_by_ref.setdefault(normalized_material, []).append(expected)
                    all_suppliers.add(normalized_supplier)

                expected_material_text = self._join_unique(
                    [expected.material_ref for expected in expected_materials],
                )
                source_material = (materials_by_ref.get(material_ref) or expected_materials)[0]
                if not material_ref or material_ref not in materials_by_ref:
                    self._mark_red(production_ws.cell(row=row_index, column=material_col))
                    production_ws.cell(
                        row=row_index,
                        column=columns["correct material reference #"],
                        value=expected_material_text,
                    )
                    self._set_row_diagnostic(
                        production_ws,
                        row_index,
                        columns,
                        "需核对",
                        "值不一致：以 BOM 为准",
                        "Input Material UID/ID 不在 BOM MAIN COMPONENT Material Reference # 中。",
                        source_material,
                    )
                    mismatch_cell_count += 1

                supplier_materials = materials_by_ref.get(material_ref) or expected_materials
                expected_suppliers = {
                    self._normalize_key(expected.group_code_supplier)
                    for expected in supplier_materials
                } or all_suppliers
                if not seller or seller not in expected_suppliers:
                    self._mark_red(production_ws.cell(row=row_index, column=seller_col))
                    production_ws.cell(
                        row=row_index,
                        column=columns["correct group code supplier"],
                        value=self._join_unique(
                            [expected.group_code_supplier for expected in supplier_materials],
                        ),
                    )
                    self._set_row_diagnostic(
                        production_ws,
                        row_index,
                        columns,
                        "需核对",
                        "值不一致：以 BOM 为准",
                        "Seller Facility ID 与 BOM Group Code Supplier 不一致。",
                        supplier_materials[0] if supplier_materials else source_material,
                    )
                    mismatch_cell_count += 1

            missing_row_count = 0
            for row_key, expected_materials in expected_by_key.items():
                present_materials = production_materials_by_key.get(row_key, set())
                template_row = (production_rows_by_key.get(row_key) or [None])[0]
                appended_pairs: Set[Tuple[str, str]] = set()
                for material in expected_materials:
                    normalized_material = self._normalize_key(material.material_ref)
                    normalized_supplier = self._normalize_key(material.group_code_supplier)
                    if normalized_material in present_materials:
                        continue
                    pair = (normalized_material, normalized_supplier)
                    if pair in appended_pairs:
                        continue
                    if not template_row:
                        continue
                    self._set_row_diagnostic(
                        production_ws,
                        template_row,
                        columns,
                        "需核对",
                        "BOM存在，T1 PRODUCTION缺少材料",
                        (
                            "BOM 还有未在 T1 PRODUCTION 出现的材料："
                            f"{material.material_ref}/{material.group_code_supplier}"
                        ),
                        material,
                    )
                    appended_pairs.add(pair)
                    missing_row_count += 1

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = os.path.join(output_dir, f"jane_bom_compare_{timestamp}.xlsx")
            production_wb.save(output_path)

            return {
                "success": True,
                "message": f"Jane-BOM 核对完成，结果文件：{output_path}",
                "logs": logs,
                "bom_count": len(bom_paths),
                "bom_material_row_count": bom_material_row_count,
                "checked_row_count": sum(len(rows) for rows in production_rows_by_key.values()),
                "mismatch_cell_count": mismatch_cell_count,
                "missing_row_count": missing_row_count,
                "no_bom_key_count": no_bom_key_count,
                "output_path": output_path,
            }
        except Exception as exc:
            logs.append(f"ERROR: {exc}")
            return {
                "success": False,
                "message": str(exc),
                "logs": logs,
            }
