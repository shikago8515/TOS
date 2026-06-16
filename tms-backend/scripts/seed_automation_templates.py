from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from utils.minio_storage import build_object_key, get_minio_bucket, put_object_bytes, sanitize_object_segment
from utils.mysql_store import ensure_schema, list_excel_templates, upsert_excel_template


CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
XLS_CONTENT_TYPE = "application/vnd.ms-excel"


AUTOMATION_TEMPLATES: list[dict[str, Any]] = [
    {
        "module_id": "shipping-automation",
        "template_key": "default",
        "display_name": "Shipping Automation Excel Template",
        "filename": "shipping-automation-template.xlsx",
        "headers": ["PO No", "Change Equipment ID", "Issue Date", "Invoice Number"],
        "sample": ["4500000000", "CONT1234567", "2026-06-30", "INV-0001"],
        "notes": [
            "PO No is required.",
            "Change Equipment ID, Issue Date, and Invoice Number are applied by the automation flow.",
        ],
    },
    {
        "module_id": "xinlongtai-shipping-automation",
        "template_key": "default",
        "display_name": "新龙泰 Shipping 自动化 Excel 模板",
        "filename": "新龙泰-shipping-自动化模板.XLS",
        "source_path": "templates/automation/xinlongtai-shipping-automation-template.xls",
        "content_type": XLS_CONTENT_TYPE,
    },
    {
        "module_id": "infornexus-auto-add",
        "template_key": "default",
        "display_name": "Infornexus Auto Add Excel Template",
        "filename": "infornexus-auto-add-template.xlsx",
        "headers": ["No", "ID"],
        "sample": [1, "1234567890"],
        "notes": ["The parser reads the second column ID. Use 10-character IDs."],
    },
    {
        "module_id": "microsoft-login-n8n",
        "template_key": "default",
        "display_name": "Microsoft Login Excel Template",
        "filename": "microsoft-login-template.xlsx",
        "headers": ["Case Number", "PO", "Decision"],
        "sample": ["CASE-0001", "4500000000", "Approve"],
        "notes": ["Case Number, PO, and Decision are used by the task automation and failure export flow."],
    },
    {
        "module_id": "shipping-automation-2",
        "template_key": "released",
        "display_name": "Shipping Automation 2 Released Bulk Template",
        "filename": "shipping-automation-2-released-template.xlsx",
        "headers": ["PO No", "Delay - PO PSDD Update (M)", "Delay - PO PD Update (M)", "Supplier Confirmed"],
        "sample": ["4500000000", "2026-06-30", "2026-06-30", "true"],
        "notes": ["Released Bulk matches rows by PO No. Other columns are treated as editable page fields."],
    },
    {
        "module_id": "shipping-automation-2",
        "template_key": "unreleased",
        "display_name": "Shipping Automation 2 Unreleased Bulk Template",
        "filename": "shipping-automation-2-unreleased-template.xlsx",
        "headers": ["PO No", "Delay/Early - Confirmation CRD (M)", "Delay/Early- Confirmation PD (M)", "Supplier Confirmed"],
        "sample": ["4500000000", "2026-06-30", "2026-06-30", "true"],
        "notes": ["Unreleased Bulk matches rows by PO No. Other columns are treated as editable page fields."],
    },
]


def seed_templates() -> dict[str, Any]:
    ensure_schema()
    bucket = get_minio_bucket("templates")
    uploaded = []

    for template in AUTOMATION_TEMPLATES:
        filename = sanitize_object_segment(template["filename"])
        content = read_template_content(template)
        content_type = template.get("content_type", CONTENT_TYPE)
        object_key = build_object_key("templates", template["module_id"], template["template_key"], filename)
        storage_record = put_object_bytes(
            bucket=bucket,
            object_key=object_key,
            content=content,
            content_type=content_type,
        )
        row = upsert_excel_template({
            "module_id": template["module_id"],
            "template_key": template["template_key"],
            "display_name": template["display_name"],
            "bucket": storage_record["bucket"],
            "object_key": storage_record["object_key"],
            "original_filename": filename,
            "content_type": content_type,
            "file_size": storage_record["file_size"],
            "sha256": storage_record["sha256"],
        })
        uploaded.append({
            "id": row["id"],
            "moduleId": row["module_id"],
            "templateKey": row["template_key"],
            "filename": row["original_filename"],
            "fileSize": row["file_size"],
        })

    module_ids = sorted({template["module_id"] for template in AUTOMATION_TEMPLATES})
    return {
        "uploaded": uploaded,
        "summary": {
            module_id: [
                {
                    "id": row["id"],
                    "templateKey": row["template_key"],
                    "filename": row["original_filename"],
                    "fileSize": row["file_size"],
                }
                for row in list_excel_templates(module_id)
            ]
            for module_id in module_ids
        },
    }


def read_template_content(template: dict[str, Any]) -> bytes:
    source_path = template.get("source_path")
    if not source_path:
        return build_template_workbook(template)

    path = Path(str(source_path))
    if not path.is_absolute():
        path = BACKEND_ROOT / path
    return path.read_bytes()


def build_template_workbook(template: dict[str, Any]) -> bytes:
    shared = SharedStrings()
    workbook = BytesIO()
    with ZipFile(workbook, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml())
        archive.writestr("_rels/.rels", root_relationships_xml())
        archive.writestr("xl/workbook.xml", workbook_xml())
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_relationships_xml())
        archive.writestr("xl/worksheets/sheet1.xml", worksheet_xml([template["headers"]], shared, freeze_header=True))
        archive.writestr("xl/worksheets/sheet2.xml", worksheet_xml(instruction_rows(template), shared, freeze_header=False))
        archive.writestr("xl/sharedStrings.xml", shared.xml())
    return workbook.getvalue()


def instruction_rows(template: dict[str, Any]) -> list[list[Any]]:
    rows = [
        ["Item", "Value"],
        ["Template", template["display_name"]],
        ["Required headers", ", ".join(template["headers"])],
        ["Example row", ", ".join(str(value) for value in template["sample"])],
    ]
    rows.extend(["Note", note] for note in template["notes"])
    return rows


def worksheet_xml(rows: list[list[Any]], shared: "SharedStrings", *, freeze_header: bool) -> str:
    max_cols = max((len(row) for row in rows), default=1)
    views = (
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" '
        'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        if freeze_header
        else ""
    )
    cols = "".join(
        f'<col min="{index}" max="{index}" width="{column_width(rows, index - 1)}" customWidth="1"/>'
        for index in range(1, max_cols + 1)
    )
    sheet_rows = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for col_index, value in enumerate(row, start=1):
            if value is None or value == "":
                continue
            cell_ref = f"{column_name(col_index)}{row_index}"
            cells.append(f'<c r="{cell_ref}" t="s"><v>{shared.add(str(value))}</v></c>')
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"{views}<cols>{cols}</cols><sheetData>{''.join(sheet_rows)}</sheetData>"
        "</worksheet>"
    )


def column_width(rows: list[list[Any]], col_index: int) -> int:
    values = [str(row[col_index]) for row in rows if col_index < len(row) and row[col_index] not in (None, "")]
    longest = max((len(value) for value in values), default=12)
    return max(14, min(60, longest + 4))


def column_name(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


class SharedStrings:
    def __init__(self) -> None:
        self._values: list[str] = []
        self._lookup: dict[str, int] = {}

    def add(self, value: str) -> int:
        if value not in self._lookup:
            self._lookup[value] = len(self._values)
            self._values.append(value)
        return self._lookup[value]

    def xml(self) -> str:
        items = "".join(f"<si><t>{escape(value)}</t></si>" for value in self._values)
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            f'count="{len(self._values)}" uniqueCount="{len(self._values)}">{items}</sst>'
        )


def content_types_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/worksheets/sheet2.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/sharedStrings.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        "</Types>"
    )


def root_relationships_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )


def workbook_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets>'
        '<sheet name="Template" sheetId="1" r:id="rId1"/>'
        '<sheet name="Instructions" sheetId="2" r:id="rId2"/>'
        '</sheets>'
        '</workbook>'
    )


def workbook_relationships_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet2.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" '
        'Target="sharedStrings.xml"/>'
        "</Relationships>"
    )


if __name__ == "__main__":
    print(json.dumps(seed_templates(), ensure_ascii=False, indent=2))
