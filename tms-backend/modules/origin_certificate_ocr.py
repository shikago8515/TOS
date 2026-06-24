# -*- coding: utf-8 -*-
"""产地证 OCR 文本识别与字段解析。"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any, Sequence


class OriginCertificateOcrUnavailableError(RuntimeError):
    """OCR 运行时不可用。"""


@dataclass(frozen=True)
class OriginCertificateRecord:
    po_number: str
    working_number: str = ""
    article_number: str = ""
    customer_number: str = ""
    quantity: int | None = None
    cartons: int | None = None
    cartons_in_words: str = ""
    goods_description: str = ""
    hs_code: str = ""


@dataclass(frozen=True)
class CartonInfo:
    cartons: int | None
    cartons_in_words: str
    goods_description: str


class OriginCertificateOcrParser:
    """把 OCR 文本解析成产地证业务记录。"""

    PO_RE = re.compile(r"\bPO\s*#?\s*:?\s*(?P<po>\d{8,12})\b", re.IGNORECASE)
    CARTONS_WORDS_RE = re.compile(
        r"(?P<words>[A-Z][A-Z\s-]+?)\s*\((?P<count>\d+)\)\s*CARTONS?\b",
        re.IGNORECASE,
    )
    CARTONS_NUMBER_RE = re.compile(r"\b(?P<count>\d+)\s*CARTONS?\b", re.IGNORECASE)
    QUANTITY_RE = re.compile(r"\b(?P<quantity>\d{1,6})\s*PIECES?\b", re.IGNORECASE)
    HSCODE_VALUE_RE = re.compile(r"\b(?:\d{2}\.\d{2}(?:\.\d{2})?|\d{4}\.\d{2}|\d{4,8})\b")
    FTA_ITEM_RE = re.compile(
        r"(?m)^(?P<item>\d{1,2})\s+(?P<words>[A-Z][A-Z\s-]+?)\s*"
        r"\((?P<cartons>\d+)\)\s*CARTONS?\s+(?P<tail>.*)$",
        re.IGNORECASE,
    )
    LABEL_START_RE = re.compile(
        r"\b(STYLE|ART(?:ICLE)?|PO|CUST(?:OMER)?|HS|H\.S|QUANTITY|QTY)\s*(?:ORDER)?\s*#?\s*:?",
        re.IGNORECASE,
    )
    DETAIL_VALUE_RE = re.compile(
        r"\b(?P<label>CUST\s*ORDER|STYLE|ARTICLE|ART|PO)\s*"
        r"(?:(?:NO|NUMBER)\.?)?\s*#?\s*:?\s*(?P<value>[A-Z0-9][A-Z0-9\-./]*)",
        re.IGNORECASE,
    )

    def parse_text(self, text: str) -> list[OriginCertificateRecord]:
        return self.parse_pages([text])

    def parse_pages(self, page_texts: Sequence[str]) -> list[OriginCertificateRecord]:
        text = self._normalize_ocr_text("\n".join(page_texts))
        po_matches = list(self.PO_RE.finditer(text))
        if not po_matches:
            return []

        fta_records = self._extract_fta_item_records(text)
        if fta_records:
            return fta_records

        hs_values = self._extract_hs_values(text)
        quantities = self._extract_quantities(text)
        detail_records = self._extract_detail_records(text)
        if detail_records:
            return self._records_from_detail_records(
                detail_records,
                self._extract_carton_infos(text),
                hs_values,
                quantities,
            )

        records: list[OriginCertificateRecord] = []

        previous_po_end = 0
        for index, po_match in enumerate(po_matches):
            next_po_start = po_matches[index + 1].start() if index + 1 < len(po_matches) else len(text)
            before_po = text[previous_po_end : po_match.start()]
            after_po = text[po_match.end() : next_po_start]
            after_record = self._slice_before_next_cartons(after_po)
            previous_po_end = po_match.end()

            hs_code = self._find_first_labeled_value(after_record, (r"HS\s*CODE", r"H\.S\.?\s*CODE"))
            normalized_hs_code = self._normalize_hs_code(hs_code)
            quantity = self._parse_int(self._find_first_quantity(after_record))

            record = OriginCertificateRecord(
                po_number=po_match.group("po"),
                working_number=self._find_first_labeled_value(after_record, (r"STYLE",))
                or self._find_last_labeled_value(before_po, (r"STYLE",)),
                article_number=self._find_first_labeled_value(after_record, (r"ARTICLE", r"ART"))
                or self._find_last_labeled_value(before_po, (r"ARTICLE", r"ART")),
                customer_number=self._find_first_labeled_value(
                    after_record,
                    (
                        r"CUST\s*ORDER",
                        r"CUST(?:OMER)?\s*NO\.?",
                        r"CUST",
                        r"MARKET\s*PO",
                    ),
                ),
                quantity=self._value_by_index(quantities, index) if index < len(quantities) else quantity,
                cartons=self._extract_cartons(before_po)[0],
                cartons_in_words=self._extract_cartons(before_po)[1],
                goods_description=self._extract_goods_description(before_po),
                hs_code=self._value_by_index(hs_values, index) or normalized_hs_code or "",
            )
            records.append(record)

        return records

    def _records_from_detail_records(
        self,
        detail_records: Sequence[dict[str, str]],
        carton_infos: Sequence[CartonInfo],
        hs_values: Sequence[str],
        quantities: Sequence[int],
    ) -> list[OriginCertificateRecord]:
        records: list[OriginCertificateRecord] = []
        row_count = max(len(detail_records), len(carton_infos), len(quantities))
        for index in range(row_count):
            detail = detail_records[index] if index < len(detail_records) else {}
            carton_info = carton_infos[index] if index < len(carton_infos) else CartonInfo(None, "", "")
            records.append(
                OriginCertificateRecord(
                    po_number=detail.get("po_number", ""),
                    working_number=detail.get("working_number", ""),
                    article_number=detail.get("article_number", ""),
                    customer_number=detail.get("customer_number", ""),
                    quantity=self._value_by_index(quantities, index),
                    cartons=carton_info.cartons,
                    cartons_in_words=carton_info.cartons_in_words,
                    goods_description=carton_info.goods_description,
                    hs_code=self._value_by_index(hs_values, index) or "",
                )
            )
        return records

    def _extract_fta_item_records(self, text: str) -> list[OriginCertificateRecord]:
        if not re.search(r"\bChina-Peru\s+FTA\b", text, re.IGNORECASE):
            return []

        matches = list(self.FTA_ITEM_RE.finditer(text))
        records: list[OriginCertificateRecord] = []
        for index, match in enumerate(matches):
            next_start = matches[index + 1].start() if index + 1 < len(matches) else self._find_fta_detail_end(text, match.end())
            block = text[match.start() : next_start]
            hs_code = self._find_fta_hs_code(match.group("tail"))
            records.append(
                OriginCertificateRecord(
                    po_number=self._find_first_labeled_value(block, (r"PO",)),
                    working_number=self._find_first_labeled_value(block, (r"STYLE",)),
                    article_number=self._find_first_labeled_value(block, (r"ARTICLE", r"ART")),
                    quantity=self._parse_int(self._find_first_quantity(block)),
                    cartons=self._parse_int(match.group("cartons")),
                    cartons_in_words=self._normalize_text(match.group("words")).upper(),
                    goods_description=self._extract_fta_goods_description(block, match),
                    hs_code=hs_code,
                )
            )
        return [record for record in records if record.po_number]

    def _find_fta_detail_end(self, text: str, start: int) -> int:
        marker = text.find("***", start)
        return marker if marker != -1 else len(text)

    def _find_fta_hs_code(self, text: str) -> str:
        match = re.search(r"\b(?P<hs>\d{6})\b", text)
        return match.group("hs") if match else ""

    def _extract_fta_goods_description(self, block: str, item_match: re.Match[str]) -> str:
        block_offset = item_match.start()
        description_parts: list[str] = []
        first_line = item_match.group("tail")
        hs_code = self._find_fta_hs_code(first_line)
        if hs_code:
            first_line = first_line.split(hs_code, 1)[0]
        description_parts.append(first_line)

        remaining = block[item_match.end() - block_offset :]
        for raw_line in remaining.splitlines():
            line = self._normalize_text(raw_line)
            if not line:
                continue
            if re.match(r"^(?:PO\s*#|ARTICLE|ART|STYLE|\*\*\*)", line, re.IGNORECASE):
                break
            description_parts.append(line)

        cleaned_parts = [self._clean_fta_description_part(part) for part in description_parts]
        description = self._normalize_text(" ".join(part for part in cleaned_parts if part))
        description = re.sub(r"^OF\s+", "", description, flags=re.IGNORECASE)
        return self._normalize_description(description)

    def _clean_fta_description_part(self, text: str) -> str:
        text = self._normalize_text(text)
        text = re.split(r"\bG\.?\s*WEIGHT\b", text, maxsplit=1, flags=re.IGNORECASE)[0]
        text = re.sub(r"\bPSR\b.*$", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\b\d+(?:\.\d+)?\s*KGS?\b.*$", "", text, flags=re.IGNORECASE)
        return self._normalize_text(text)

    def _extract_detail_records(self, text: str) -> list[dict[str, str]]:
        records: list[dict[str, str]] = []
        current: dict[str, str] = {}

        for match in self.DETAIL_VALUE_RE.finditer(text):
            field_name = self._detail_field_name(match.group("label"))
            value = self._clean_detail_value(field_name, match.group("value"))
            if not field_name or not value:
                continue

            if field_name == "working_number" and current.get("po_number") and current.get("customer_number") and current.get("working_number"):
                self._append_detail_record(records, current)
                current = {}
            elif field_name == "po_number" and current.get("po_number"):
                self._append_detail_record(records, current)
                current = {}
            elif field_name == "article_number" and current.get("po_number") and current.get("customer_number") and current.get("article_number"):
                self._append_detail_record(records, current)
                current = {}

            current[field_name] = value

        self._append_detail_record(records, current)
        return records

    def _append_detail_record(self, records: list[dict[str, str]], current: dict[str, str]) -> None:
        if current.get("po_number"):
            records.append(dict(current))

    def _detail_field_name(self, label: str) -> str:
        normalized = re.sub(r"\s+", " ", label.upper()).strip()
        if normalized == "STYLE":
            return "working_number"
        if normalized in {"ARTICLE", "ART"}:
            return "article_number"
        if normalized == "PO":
            return "po_number"
        if normalized in {"CUST", "CUST ORDER"}:
            return "customer_number"
        return ""

    def _clean_detail_value(self, field_name: str, value: str) -> str:
        token = self._normalize_token(value)
        if field_name in {"po_number", "customer_number"}:
            return re.sub(r"\D+", "", token)
        return token

    def _extract_carton_infos(self, text: str) -> list[CartonInfo]:
        infos: list[CartonInfo] = []
        lines = [self._normalize_text(raw_line) for raw_line in text.splitlines()]
        for index, line in enumerate(lines):
            if not line:
                continue
            match = self.CARTONS_WORDS_RE.search(line)
            if not match:
                continue
            description_parts = [line[match.end() :]]
            for next_line in lines[index + 1 :]:
                if self._is_carton_description_boundary(next_line):
                    break
                description_parts.append(next_line)
            description = self._strip_inline_measurements(" ".join(description_parts))
            infos.append(
                CartonInfo(
                    cartons=self._parse_int(match.group("count")),
                    cartons_in_words=self._normalize_text(match.group("words")).upper(),
                    goods_description=description,
                )
            )
        return infos

    def _is_carton_description_boundary(self, line: str) -> bool:
        if not line:
            return True
        if self.CARTONS_WORDS_RE.search(line):
            return True
        return bool(
            re.search(
                r"^(?:STYLE|ARTICLE|ART|PO|CUST|HS|H\.S|QUANTITY|QTY|MADE IN CHINA|11\.|\d{2}\.\d{2}|\d+\s*PIECES)",
                line,
                re.IGNORECASE,
            )
        )

    def _strip_inline_measurements(self, text: str) -> str:
        text = re.split(r"\b(?:\d{2}\.\d{2}|\d{4}\.\d{2}|\d+\s*PIECES?)\b", text, maxsplit=1, flags=re.IGNORECASE)[0]
        return self._normalize_description(text)

    def _extract_hs_values(self, text: str) -> list[str]:
        values: list[str] = []
        collecting = False
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if self._is_standalone_hs_line(line):
                values.extend(self._extract_hs_values_from_line(line))
                continue
            if re.search(r"\b(H\.?\s*S\.?\s*CODE|HS\s*CODE)\b", line, re.IGNORECASE):
                collecting = True
                values.extend(self._extract_hs_values_from_line(line))
                continue
            if collecting and re.search(r"\b(QUANTITY|QTY|STYLE|ARTICLE|ART|PO|CUST)\b", line, re.IGNORECASE):
                collecting = False
            if collecting:
                values.extend(self._extract_hs_values_from_line(line))
        return values

    def _is_standalone_hs_line(self, line: str) -> bool:
        return bool(re.fullmatch(r"(?:\d{2}\.\d{2}(?:\.\d{2})?|\d{4}\.\d{2}|\d{4,8})", line))

    def _extract_hs_values_from_line(self, line: str) -> list[str]:
        values: list[str] = []
        for match in self.HSCODE_VALUE_RE.finditer(line):
            normalized = self._normalize_hs_code(match.group(0))
            if 4 <= len(normalized) <= 8:
                values.append(normalized)
        return values

    def _extract_quantities(self, text: str) -> list[int]:
        return [int(match.group("quantity")) for match in self.QUANTITY_RE.finditer(text)]

    def _find_last_labeled_value(self, text: str, labels: Sequence[str]) -> str:
        values: list[str] = []
        for label in labels:
            values.extend(self._find_labeled_values(text, label))
        return values[-1] if values else ""

    def _find_first_labeled_value(self, text: str, labels: Sequence[str]) -> str:
        values: list[tuple[int, str]] = []
        for label in labels:
            values.extend(self._find_labeled_values_with_position(text, label))
        if not values:
            return ""
        return sorted(values, key=lambda item: item[0])[0][1]

    def _find_labeled_values(self, text: str, label: str) -> list[str]:
        return [value for _, value in self._find_labeled_values_with_position(text, label)]

    def _find_labeled_values_with_position(self, text: str, label: str) -> list[tuple[int, str]]:
        pattern = re.compile(
            r"\b(?:" + label + r")\b\s*(?:(?:NO|NUMBER)\.?)?\s*#?\s*:?\s*(?P<value>[A-Z0-9][A-Z0-9\-./]*)",
            re.IGNORECASE,
        )
        return [
            (match.start(), self._normalize_token(match.group("value")))
            for match in pattern.finditer(text)
        ]

    def _find_first_quantity(self, text: str) -> str:
        match = self.QUANTITY_RE.search(text)
        return match.group("quantity") if match else ""

    def _slice_before_next_cartons(self, text: str) -> str:
        word_match = self.CARTONS_WORDS_RE.search(text)
        number_match = self.CARTONS_NUMBER_RE.search(text)
        candidates = [match.start() for match in (word_match, number_match) if match]
        if not candidates:
            return text
        return text[: min(candidates)]

    def _extract_cartons(self, text: str) -> tuple[int | None, str]:
        word_matches = list(self.CARTONS_WORDS_RE.finditer(text))
        if word_matches:
            match = word_matches[-1]
            return self._parse_int(match.group("count")), self._normalize_text(match.group("words")).upper()

        number_matches = list(self.CARTONS_NUMBER_RE.finditer(text))
        if number_matches:
            return self._parse_int(number_matches[-1].group("count")), ""

        return None, ""

    def _extract_goods_description(self, text: str) -> str:
        carton_matches = list(self.CARTONS_WORDS_RE.finditer(text)) or list(self.CARTONS_NUMBER_RE.finditer(text))
        if not carton_matches:
            return ""

        description = text[carton_matches[-1].end() :]
        label_match = self.LABEL_START_RE.search(description)
        if label_match:
            description = description[: label_match.start()]
        return self._normalize_description(description)

    def _normalize_ocr_text(self, text: str) -> str:
        normalized = text.replace("\r", "\n").replace("\xa0", " ")
        normalized = normalized.replace("＃", "#").replace("：", ":")
        normalized = re.sub(r"\bP[O0]\s*#", "PO#", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\bCUST\s*[O0]RDER\b", "CUST ORDER", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\bCUST\s*[O0]\s*/\s*N\b", "CUST O/N", normalized, flags=re.IGNORECASE)
        normalized = re.sub(
            r"(?<=[A-Z0-9])(?=(?:STYLE|ARTICLE|ART|PO|CUST\s*ORDER)\s*#)",
            " ",
            normalized,
            flags=re.IGNORECASE,
        )
        normalized = re.sub(r"[ \t]+", " ", normalized)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        return normalized.strip()

    def _normalize_description(self, value: Any) -> str:
        text = self._normalize_text(value)
        text = re.sub(r"\b\d+\s*$", "", text)
        return self._normalize_text(text)

    def _normalize_text(self, value: Any) -> str:
        if value is None:
            return ""
        return re.sub(r"\s+", " ", str(value)).strip()

    def _normalize_token(self, value: str) -> str:
        return self._normalize_text(value).upper().rstrip(".,;:")

    def _normalize_hs_code(self, value: Any) -> str:
        return re.sub(r"\D+", "", self._normalize_text(value))

    def _parse_int(self, value: Any) -> int | None:
        text = self._normalize_text(value).replace(",", "")
        if not text:
            return None
        match = re.search(r"\d+", text)
        return int(match.group(0)) if match else None

    def _value_by_index(self, values: Sequence[Any], index: int) -> Any | None:
        return values[index] if index < len(values) else None


class RapidOriginCertificateOcr:
    """RapidOCR PDF 识别入口，依赖懒加载，避免后端启动被 OCR 环境阻断。"""

    def __init__(self, parser: OriginCertificateOcrParser | None = None, dpi: int = 300) -> None:
        self.parser = parser or OriginCertificateOcrParser()
        self.dpi = dpi
        self._engine: Any | None = None

    def extract_records(self, pdf_path: str | os.PathLike[str]) -> list[OriginCertificateRecord]:
        return self.parser.parse_pages(self.extract_page_texts(pdf_path))

    def extract_page_texts(self, pdf_path: str | os.PathLike[str]) -> list[str]:
        try:
            import fitz  # type: ignore[import-untyped]
            import numpy as np
        except ImportError as exc:
            raise OriginCertificateOcrUnavailableError(
                "产地证 OCR 依赖未安装，请安装 PyMuPDF、rapidocr 和 onnxruntime 后重试。"
            ) from exc

        page_texts: list[str] = []
        matrix = fitz.Matrix(self.dpi / 72, self.dpi / 72)
        with fitz.open(pdf_path) as document:
            for page in document:
                pixmap = page.get_pixmap(matrix=matrix, alpha=False)
                image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
                    pixmap.height,
                    pixmap.width,
                    pixmap.n,
                )
                page_texts.append(self._run_ocr(image))
        return page_texts

    def _run_ocr(self, image: Any) -> str:
        engine = self._get_engine()
        output = engine(image)
        return "\n".join(self._extract_texts_from_output(output))

    def _get_engine(self) -> Any:
        if self._engine is not None:
            return self._engine

        try:
            from rapidocr import RapidOCR
        except ImportError as exc:
            raise OriginCertificateOcrUnavailableError(
                "产地证 OCR 依赖未安装，请安装 rapidocr 和 onnxruntime 后重试。"
            ) from exc

        self._engine = RapidOCR()
        return self._engine

    def _extract_texts_from_output(self, output: Any) -> list[str]:
        if hasattr(output, "txts"):
            return [str(text) for text in output.txts if text]
        if isinstance(output, tuple) and output:
            return self._extract_texts_from_output(output[0])
        if isinstance(output, list):
            texts: list[str] = []
            for item in output:
                if isinstance(item, str):
                    texts.append(item)
                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                    texts.append(str(item[1]))
            return texts
        return []
