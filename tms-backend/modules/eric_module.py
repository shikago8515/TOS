# -*- coding: utf-8 -*-
"""
Eric Excel data processing integration module.

Flow:
1. Insert PO Number1 / Article Number1 helper columns.
2. Split repeated PO header blocks into separate sheets.
3. Unpivot size columns into a normalized Final_Data sheet.
"""

import copy
import os
from contextlib import redirect_stdout
from datetime import date, datetime, timedelta
from io import StringIO
from typing import Any, Dict, Optional

from openpyxl import Workbook, load_workbook
from openpyxl.styles import numbers
from openpyxl.utils import get_column_letter


DATE_FORMAT = "MM/DD/YYYY"
EXCEL_DATE_FORMAT = numbers.FORMAT_DATE_XLSX14
SIZE_COL_START = 10
SIZE_NAME_ALIASES = {
    "A2XL": "A/2XL",
}
FINAL_DATA_MIN_WIDTHS = {
    1: 13,
    2: 18,
    3: 16,
    4: 12,
    5: 15,
    6: 21,
    7: 24,
    8: 13,
    9: 17,
    10: 10,
    11: 11,
}
FINAL_DATA_MAX_WIDTH = 36


def ensure_dir(dir_path: str):
    os.makedirs(dir_path, exist_ok=True)


class EricModule:
    """Excel\u6570\u636e\u5904\u7406\u6574\u5408\u5de5\u5177-Eric."""

    @staticmethod
    def get_actual_data_rows(ws):
        actual_rows = 0
        for row in range(2, ws.max_row + 1):
            b_value = ws.cell(row=row, column=2).value
            if b_value is not None and b_value != "":
                actual_rows = row
        if actual_rows == 0:
            for col in range(1, ws.max_column + 1):
                for row in range(2, ws.max_row + 1):
                    cell_value = ws.cell(row=row, column=col).value
                    if cell_value is not None and cell_value != "":
                        actual_rows = max(row, actual_rows)
        return max(actual_rows, 2)

    @staticmethod
    def is_header_row(ws, row: int) -> bool:
        val = ws.cell(row=row, column=1).value
        return bool(val and 'PO Number' in str(val))

    @staticmethod
    def is_empty_row(ws, row: int, max_col: Optional[int] = None) -> bool:
        max_col = max_col or ws.max_column
        return all(ws.cell(row=row, column=col).value is None for col in range(1, max_col + 1))

    @staticmethod
    def copy_cell_style(source, target):
        if not source.has_style:
            return
        try:
            target.font = copy.copy(source.font)
            target.border = copy.copy(source.border)
            target.fill = copy.copy(source.fill)
            target.number_format = source.number_format
            target.alignment = copy.copy(source.alignment)
        except Exception:
            pass

    @staticmethod
    def copy_column_widths(source_ws, target_ws, col_count: int):
        for col in range(1, col_count + 1):
            col_letter = get_column_letter(col)
            if source_ws.column_dimensions[col_letter].width:
                target_ws.column_dimensions[col_letter].width = source_ws.column_dimensions[col_letter].width

    @staticmethod
    def estimate_text_width(value) -> int:
        if value is None:
            return 0
        return sum(2 if ord(char) > 255 else 1 for char in str(value))

    @staticmethod
    def autofit_columns(ws, min_width=8, max_width=50):
        for column in ws.columns:
            max_length = 0
            column_letter = get_column_letter(column[0].column)
            for cell in column:
                try:
                    max_length = max(max_length, EricModule.estimate_text_width(cell.value))
                except Exception:
                    pass
            adjusted_width = min(max(max_length + 2, min_width), max_width)
            ws.column_dimensions[column_letter].width = adjusted_width

    @staticmethod
    def apply_final_data_column_widths(ws):
        EricModule.autofit_columns(ws, min_width=8, max_width=FINAL_DATA_MAX_WIDTH)
        for col_index, min_width in FINAL_DATA_MIN_WIDTHS.items():
            col_letter = get_column_letter(col_index)
            current_width = ws.column_dimensions[col_letter].width or 0
            ws.column_dimensions[col_letter].width = max(current_width, min_width)

    @staticmethod
    def add_auto_filter(ws):
        if ws.max_column == 0:
            return
        max_col_letter = get_column_letter(ws.max_column)
        ws.auto_filter.ref = f"A1:{max_col_letter}{ws.max_row}"

    @staticmethod
    def format_date_value(value):
        if value is None or value == "":
            return ""
        if isinstance(value, str):
            date_formats = ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%y", "%m/%d/%Y", "%d/%m/%y", "%d/%m/%Y"]
            for fmt in date_formats:
                try:
                    return datetime.strptime(value.strip(), fmt).strftime("%m/%d/%Y")
                except ValueError:
                    continue
            return value
        if isinstance(value, (datetime, date)):
            return value.strftime("%m/%d/%Y")
        if isinstance(value, (int, float)):
            try:
                excel_epoch = datetime(1899, 12, 30)
                return (excel_epoch + timedelta(days=int(value))).strftime("%m/%d/%Y")
            except Exception:
                return str(value)
        return str(value)

    @staticmethod
    def convert_text_to_number(value):
        if value is None or value == "":
            return value
        try:
            return int(value)
        except (ValueError, TypeError):
            try:
                return float(value)
            except (ValueError, TypeError):
                return value

    @staticmethod
    def normalize_size_name(value):
        if value is None:
            return ""
        size_name = str(value).strip()
        return SIZE_NAME_ALIASES.get(size_name, size_name)

    @staticmethod
    def normalize_output_value(value):
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value

    def add_and_fill_columns(self, input_file: str, output_file: str) -> str:
        print("[1/3] \u6dfb\u52a0 PO Number1 / Article Number1\uff0c\u5e76\u5411\u4e0b\u586b\u5145 PO Number1")
        wb = load_workbook(input_file)

        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            actual_rows = self.get_actual_data_rows(ws)
            print(f"  \u5904\u7406 Sheet: {sheet_name}\uff0c\u5b9e\u9645\u6570\u636e\u884c: {actual_rows}")

            ws.insert_cols(8)
            ws.cell(row=1, column=8).value = "PO Number1"
            for row in range(2, actual_rows + 1):
                ws.cell(row=row, column=8).value = ws.cell(row=row, column=1).value

            ws.insert_cols(9)
            ws.cell(row=1, column=9).value = "Article Number1"
            for row in range(2, actual_rows + 1):
                ws.cell(row=row, column=9).value = ws.cell(row=row, column=3).value

            last_value = None
            filled_count = 0
            for row in range(2, actual_rows + 1):
                cell = ws.cell(row=row, column=8)
                current_val = cell.value
                if current_val is None or current_val == "":
                    if last_value is not None:
                        cell.value = last_value
                        filled_count += 1
                else:
                    last_value = current_val
            print(f"    PO Number1 \u7a7a\u503c\u586b\u5145: {filled_count}")

        wb.save(output_file)
        print(f"  \u8f93\u51fa step1: {output_file}")
        return output_file

    def process_split(self, input_file: str, output_file: str) -> str:
        print("[2/3] \u6309 PO \u6807\u9898\u884c\u62c6\u5206 Sheet")
        wb = load_workbook(input_file, data_only=True)
        new_wb = Workbook()
        new_wb.remove(new_wb.active)
        sheet_counter = 1

        for ws_name in wb.sheetnames:
            ws = wb[ws_name]
            header_rows = [r for r in range(1, ws.max_row + 1) if self.is_header_row(ws, r)]
            print(f"  \u539f Sheet: {ws_name}\uff0c\u627e\u5230\u6570\u636e\u5757: {len(header_rows)}")

            for idx, header_row in enumerate(header_rows):
                data_end = header_rows[idx + 1] - 1 if idx + 1 < len(header_rows) else ws.max_row
                if idx + 1 == len(header_rows):
                    data_end = max(
                        (r for r in range(ws.max_row, header_row, -1) if not self.is_empty_row(ws, r)),
                        default=ws.max_row
                    )

                new_ws = new_wb.create_sheet(title=str(sheet_counter))
                self.copy_column_widths(ws, new_ws, ws.max_column)
                target_row = 1

                for source_row in range(header_row, data_end + 1):
                    if self.is_empty_row(ws, source_row):
                        continue
                    for col in range(1, ws.max_column + 1):
                        src = ws.cell(row=source_row, column=col)
                        tgt = new_ws.cell(row=target_row, column=col)
                        tgt.value = src.value
                        self.copy_cell_style(src, tgt)
                    target_row += 1

                first_po = ws.cell(row=header_row + 1, column=1).value if header_row + 1 <= data_end else "N/A"
                print(f"    \u62c6\u5206 Sheet {sheet_counter}\uff0cPO: {first_po}")
                sheet_counter += 1

        if not new_wb.sheetnames:
            raise ValueError("\u672a\u627e\u5230\u5305\u542b 'PO Number' \u7684\u6807\u9898\u884c\uff0c\u65e0\u6cd5\u62c6\u5206\u6570\u636e\u5757")

        new_wb.save(output_file)
        print(f"  \u8f93\u51fa split: {output_file}")
        return output_file

    def process_unpivot(self, input_file: str, output_file: str) -> str:
        print("[3/3] \u9006\u900f\u89c6\u5c3a\u7801\u5217\u5e76\u751f\u6210 Final_Data")
        wb = load_workbook(input_file, data_only=True)
        new_wb = Workbook()
        new_wb.remove(new_wb.active)

        new_headers = [
            "PO Number", "Working Number", "Article Number", "PODD", "Shipment Mode",
            "Gps Customer Number", "Country", "PO Number1", "Article Number1", "Size", "Quantity"
        ]

        all_data = []
        emitted_po_keys = set()

        def append_final_row(fixed_values, size_name, quantity):
            row_values = list(fixed_values)
            po_key = row_values[7] or row_values[0]
            if po_key:
                if po_key in emitted_po_keys:
                    row_values[0] = None
                else:
                    emitted_po_keys.add(po_key)
            all_data.append(row_values + [self.normalize_size_name(size_name), quantity])

        for ws_name in wb.sheetnames:
            ws = wb[ws_name]
            headers = [ws.cell(row=1, column=col).value for col in range(1, ws.max_column + 1)]
            size_cols = [(c, headers[c - 1]) for c in range(SIZE_COL_START, ws.max_column + 1) if headers[c - 1]]
            print(f"  \u5904\u7406 Sheet: {ws_name}\uff0c\u5c3a\u7801\u5217: {len(size_cols)}")

            for row in range(2, ws.max_row + 1):
                if self.is_empty_row(ws, row, 9):
                    continue
                fixed = [ws.cell(row=row, column=c).value or "" for c in range(1, 10)]
                fixed[3] = self.format_date_value(fixed[3])
                fixed[7] = self.convert_text_to_number(fixed[7])

                has_qty = False
                for col, size_name in size_cols:
                    val = ws.cell(row=row, column=col).value
                    if val is None or not str(val).strip():
                        continue
                    try:
                        qty = float(val)
                    except (TypeError, ValueError):
                        continue
                    if qty > 0:
                        append_final_row(fixed, size_name, int(qty))
                        has_qty = True
                if not has_qty:
                    append_final_row(fixed, "", "")

        ws_out = new_wb.create_sheet("Final_Data")
        for c, header in enumerate(new_headers, 1):
            ws_out.cell(row=1, column=c, value=header)

        for r, row_data in enumerate(all_data, 2):
            for c, val in enumerate(row_data, 1):
                output_value = self.normalize_output_value(val)
                if output_value is None:
                    continue

                cell = ws_out.cell(row=r, column=c, value=output_value)
                if c == 4:
                    cell.number_format = EXCEL_DATE_FORMAT
                elif c == 8:
                    cell.number_format = numbers.FORMAT_GENERAL
                elif c in (6, 10):
                    cell.number_format = "@"

        self.apply_final_data_column_widths(ws_out)
        self.add_auto_filter(ws_out)
        new_wb.save(output_file)
        print(f"  \u8f93\u51fa final: {output_file}")
        print(f"  Final_Data \u884c\u6570: {len(all_data)}")
        return output_file

    def process_file(self, input_file: str, output_dir: str) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "success": False,
            "message": "",
            "logs": [],
            "output_path": None,
            "row_count": 0,
        }

        ensure_dir(output_dir)
        base_name = os.path.splitext(os.path.basename(input_file))[0]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_prefix = os.path.join(output_dir, f"{base_name}_eric_{timestamp}")
        step1 = f"{output_prefix}_step1.xlsx"
        step2 = f"{output_prefix}_split.xlsx"
        final = f"{output_prefix}_final.xlsx"

        buffer = StringIO()
        try:
            with redirect_stdout(buffer):
                self.add_and_fill_columns(input_file, step1)
                self.process_split(step1, step2)
                self.process_unpivot(step2, final)

            row_count = 0
            wb = load_workbook(final, read_only=True, data_only=True)
            if "Final_Data" in wb.sheetnames:
                row_count = max(wb["Final_Data"].max_row - 1, 0)
            wb.close()

            result.update({
                "success": True,
                "message": "Eric Excel \u6570\u636e\u5904\u7406\u5b8c\u6210",
                "logs": [line for line in buffer.getvalue().splitlines() if line.strip()],
                "output_path": final,
                "row_count": row_count,
            })
        except Exception as exc:
            result.update({
                "success": False,
                "message": f"Eric Excel \u6570\u636e\u5904\u7406\u5931\u8d25\uff1a{exc}",
                "logs": [line for line in buffer.getvalue().splitlines() if line.strip()] + [str(exc)],
            })

        return result
