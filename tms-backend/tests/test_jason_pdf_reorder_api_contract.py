from __future__ import annotations

import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from typing import Callable

from fastapi.testclient import TestClient

import main
from api import it_invoice_pdf_reorder_api as api
from modules.it_invoice_pdf_reorder_module import InvoiceEntry, ParseResult


class JasonPdfReorderApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(main.app)
        self.temp_dir = tempfile.TemporaryDirectory()
        self.runtime_dir = Path(self.temp_dir.name)
        self._restore_callbacks: list[Callable[[], None]] = []
        self.build_calls: list[dict[str, object]] = []

        self._patch("JOBS_DIR", self.runtime_dir / "jobs")
        self._patch("PREVIEWS_DIR", self.runtime_dir / "previews")
        self._patch("EXTRACTS_DIR", self.runtime_dir / "extracts")
        self._patch("parse_invoice_pdf", self._fake_parse_invoice_pdf)
        self._patch("parse_po_pdf_pages", lambda _path: {"4501749160": [1, 2]})
        self._patch("extract_pdf_pages_text", lambda _path: ["Invoice 090123 and PO 4501749160"])
        self._patch("build_reordered_pdf", self._fake_build_reordered_pdf)
        main.app.openapi_schema = None

    def tearDown(self) -> None:
        for restore in reversed(self._restore_callbacks):
            restore()
        self.temp_dir.cleanup()
        main.app.openapi_schema = None

    def _patch(self, name: str, value: object) -> None:
        original = getattr(api, name)
        setattr(api, name, value)
        self._restore_callbacks.append(lambda: setattr(api, name, original))

    def _fake_parse_invoice_pdf(self, _path: Path) -> tuple[list[InvoiceEntry], dict[str, Decimal]]:
        return (
            [
                InvoiceEntry(
                    po="4501749160",
                    working_no="WK-1",
                    article_no="ART-1",
                    description="Test product",
                    quantity=Decimal("2"),
                    unit_price=Decimal("3.5"),
                    total_amount=Decimal("7"),
                    net_amount=Decimal("7"),
                    invoice_pages=[1],
                ),
            ],
            {"total_quantity": Decimal("2"), "invoice_total": Decimal("7")},
        )

    def _fake_build_reordered_pdf(
        self,
        _invoice_path: Path | None,
        _po_path: Path,
        output_path: Path,
        **_kwargs: object,
    ) -> ParseResult:
        self.build_calls.append({"invoice_path": _invoice_path, "po_path": _po_path, **_kwargs})
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"%PDF-1.4\n")
        entries, totals = self._fake_parse_invoice_pdf(output_path)
        return ParseResult(
            invoice_entries=entries,
            invoice_totals=totals,
            po_pages={"4501749160": [1, 2]},
            extra_po_numbers=["4501749225"],
            missing_po_numbers=[],
        )

    def test_canonical_preview_and_extract_routes_return_stable_shapes(self) -> None:
        invoice = self.client.post(
            "/api/jason/pdf-reorder/preview-invoice",
            files={"invoice_pdf": ("invoice.pdf", b"fake", "application/pdf")},
        )
        po = self.client.post(
            "/api/jason/pdf-reorder/preview-po",
            files={"po_pdf": ("po.pdf", b"fake", "application/pdf")},
        )
        extracted = self.client.post(
            "/api/jason/pdf-reorder/extract-numbers",
            files=[("files", ("extract.pdf", b"fake", "application/pdf"))],
            data={"pattern": "090|45", "search_type": "startsWith"},
        )

        self.assertEqual(invoice.status_code, 200)
        self.assertEqual(po.status_code, 200)
        self.assertEqual(extracted.status_code, 200)

        invoice_payload = invoice.json()
        self.assertEqual(invoice_payload["entries"][0]["po"], "4501749160")
        self.assertEqual(invoice_payload["summary"]["invoicePoCount"], 1)
        self.assertIn("logs", invoice_payload)

        po_payload = po.json()
        self.assertEqual(po_payload["poPages"], [{"po": "4501749160", "pages": [1, 2]}])
        self.assertEqual(po_payload["poCount"], 1)
        self.assertEqual(po_payload["pageCount"], 2)

        extracted_payload = extracted.json()
        self.assertEqual(extracted_payload["numbers"], ["090123", "4501749160"])
        self.assertEqual(extracted_payload["count"], 2)
        self.assertEqual(extracted_payload["files"][0]["pages"][0]["pageNum"], 1)

    def test_process_download_url_uses_request_family_without_breaking_legacy(self) -> None:
        canonical = self._post_process("/api/jason/pdf-reorder/process")
        compat = self._post_process("/api/it-invoice-pdf-reorder/process")
        legacy = self._post_process("/api/process")

        self.assertEqual(canonical.status_code, 200)
        self.assertEqual(compat.status_code, 200)
        self.assertEqual(legacy.status_code, 200)

        self.assertRegex(
            canonical.json()["downloadUrl"],
            r"^/api/jason/pdf-reorder/download/[0-9a-f]+$",
        )
        self.assertRegex(
            compat.json()["downloadUrl"],
            r"^/api/it-invoice-pdf-reorder/download/[0-9a-f]+$",
        )
        self.assertRegex(
            legacy.json()["downloadUrl"],
            r"^/api/it-invoice-pdf-reorder/download/[0-9a-f]+$",
        )

    def test_process_accepts_manual_po_order_without_invoice_pdf(self) -> None:
        response = self.client.post(
            "/api/jason/pdf-reorder/process",
            files={"po_pdf": ("po.pdf", b"fake", "application/pdf")},
            data={
                "po_order_text": "4501749160\n4501749225",
                "print_current_only": "true",
                "print_next_page": "false",
                "include_not_found": "true",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(self.build_calls[-1]["invoice_path"])
        self.assertEqual(self.build_calls[-1]["po_order"], ["4501749160", "4501749225"])

    def test_process_requires_manual_po_order_when_invoice_pdf_is_missing(self) -> None:
        response = self.client.post(
            "/api/jason/pdf-reorder/process",
            files={"po_pdf": ("po.pdf", b"fake", "application/pdf")},
            data={
                "po_order_text": "",
                "print_current_only": "true",
                "print_next_page": "false",
                "include_not_found": "true",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("PO", response.text)

    def test_openapi_exposes_canonical_and_compat_response_schemas(self) -> None:
        paths = main.app.openapi()["paths"]
        expected_paths = [
            "/api/jason/pdf-reorder/health",
            "/api/jason/pdf-reorder/preview-invoice",
            "/api/jason/pdf-reorder/preview-po",
            "/api/jason/pdf-reorder/extract-numbers",
            "/api/jason/pdf-reorder/process",
            "/api/it-invoice-pdf-reorder/preview-invoice",
            "/api/it-invoice-pdf-reorder/process",
            "/api/preview-invoice",
            "/api/process",
        ]

        for route_path in expected_paths:
            self.assertIn(route_path, paths)
            method = "get" if route_path.endswith("/health") else "post"
            schema = paths[route_path][method]["responses"]["200"]["content"]["application/json"]["schema"]
            self.assertIn("$ref", schema)

    def _post_process(self, path: str):
        return self.client.post(
            path,
            files={
                "invoice_pdf": ("invoice.pdf", b"fake", "application/pdf"),
                "po_pdf": ("po.pdf", b"fake", "application/pdf"),
            },
            data={
                "po_order_text": "4501749160",
                "print_current_only": "true",
                "print_next_page": "false",
                "include_not_found": "true",
            },
        )


if __name__ == "__main__":
    unittest.main()
