
# -*- coding: utf-8 -*-
"""
Sophia & Tina 报表生成模块
从 TMS工具_20260518_2100.pyw 提取的核心逻辑
创建时间: 2026-05-18
"""

import os
import openpyxl
import pandas as pd
from datetime import datetime
from openpyxl.styles import Font, PatternFill, Alignment, Border
from typing import List, Dict, Any, Optional, Tuple, Set

# 导入工具模块
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.file_utils import ensure_dir, create_thin_border


class SophiaTinaModule:
    """Sophia & Tina 报表生成业务逻辑"""

    RESULT_HEADERS = [
        'Pack',
        'Season',
        'Factory',
        'Working Number',
        'Article Number',
        'Article Name',
        'CRD',
        'PODD',
        'Gps Customer Number',
        'Country/Region',
        'Marketing Forecast(M)',
        'Quantity',
        'Factory Price(USD)',
        'Factory Amount(USD)',
        'TMS Price(USD)',
        'TMS Amount(USD)',
    ]

    ARTICLE_PRIORITY = {
        'FINAL': 0,
        'P2': 1,
        'P1': 2,
        'PREC': 3,
    }

    def __init__(self):
        pass

    def read_excel_files(self, file_list: List[str]) -> Optional[pd.DataFrame]:
        """读取多个Excel文件并合并数据"""
        dfs: List[pd.DataFrame] = []
        logs: List[str] = []

        for file_path in file_list:
            try:
                df = pd.read_excel(file_path)
                dfs.append(df)
                logs.append(f"  - 读取成功：{os.path.basename(file_path)}，共 {len(df)} 行")
            except Exception as e:
                logs.append(f"  ⚠️ 读取失败：{os.path.basename(file_path)}，错误：{str(e)}")

        if len(dfs) == 0:
            return None, logs

        if len(dfs) == 1:
            return dfs[0], logs

        # 合并多个DataFrame
        result = pd.concat(dfs, axis=0, ignore_index=True)
        logs.append(f"  ✅ 合并成功，总计 {len(result)} 行")

        return result, logs

    def save_st_result(self, results: List[Dict[str, Any]], output_path: str,
                       diagnostics: Optional[List[Dict[str, Any]]] = None) -> None:
        """保存 Sophia & Tina 结果报表"""

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Result"

        thin_border = create_thin_border()
        header_fill = PatternFill(start_color='FF4472C4', end_color='FF4472C4', fill_type='solid')
        odd_row_fill = PatternFill(start_color='FFF2F2F2', end_color='FFF2F2F2', fill_type='solid')
        conflict_fill = PatternFill(start_color='FFFFF2CC', end_color='FFFFF2CC', fill_type='solid')
        missing_fill = PatternFill(start_color='FFFFE5E5', end_color='FFFFE5E5', fill_type='solid')

        ws.row_dimensions[1].height = 30
        for col_idx, header in enumerate(self.RESULT_HEADERS, 1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = Font(bold=True, color='FFFFFFFF', size=11)
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = thin_border

        for row_idx, result in enumerate(results, 2):
            ws.row_dimensions[row_idx].height = 20
            is_odd_row = ((row_idx - 2) % 2 == 0)
            row_fill = odd_row_fill if is_odd_row else None

            for col_idx, header in enumerate(self.RESULT_HEADERS, 1):
                ws.cell(row=row_idx, column=col_idx, value=result.get(header))

            for col_idx in range(1, len(self.RESULT_HEADERS) + 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                cell.border = thin_border
                cell.alignment = Alignment(horizontal='center', vertical='center')
                if row_fill:
                    cell.fill = row_fill

            if result.get('_factory_price_conflict'):
                ws.cell(row=row_idx, column=13).fill = conflict_fill
                ws.cell(row=row_idx, column=14).fill = conflict_fill
            if result.get('_missing_factory_price'):
                ws.cell(row=row_idx, column=13).fill = missing_fill
                ws.cell(row=row_idx, column=14).fill = missing_fill
            if result.get('_missing_tms_price'):
                ws.cell(row=row_idx, column=15).fill = missing_fill
                ws.cell(row=row_idx, column=16).fill = missing_fill
            if result.get('_missing_article'):
                for col_idx in (2, 11, 15, 16):
                    ws.cell(row=row_idx, column=col_idx).fill = missing_fill
            if result.get('_missing_pack') or result.get('_ambiguous_pack'):
                ws.cell(row=row_idx, column=1).fill = missing_fill if result.get('_missing_pack') else conflict_fill

        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

        for row_idx in range(2, ws.max_row + 1):
            for col_idx in (7, 8):
                ws.cell(row=row_idx, column=col_idx).number_format = 'yyyy-mm-dd'
            ws.cell(row=row_idx, column=12).number_format = '#,##0'
            for col_idx in (13, 14, 15, 16):
                ws.cell(row=row_idx, column=col_idx).number_format = '#,##0.00'

        # 自动调整列宽，避免业务侧打开后需要手动拉宽。
        self._adjust_column_widths(ws, min_widths={
            1: 14,
            2: 12,
            3: 12,
            4: 18,
            5: 14,
            6: 30,
            7: 13,
            8: 13,
            9: 18,
            10: 18,
            11: 22,
            12: 12,
            13: 18,
            14: 20,
            15: 16,
            16: 18,
        })

        self._write_rules_sheet(wb, thin_border)
        self._write_diagnostics_sheet(wb, diagnostics or [], thin_border)

        wb.save(output_path)

    def _write_rules_sheet(self, wb: openpyxl.Workbook, thin_border: Border) -> None:
        """写入字段来源和取值规则，避免说明行污染 Result 数据区。"""
        ws = wb.create_sheet("Rules")
        rows = [
            ["Field", "Source / Rule"],
            ["Pack", "Pack 表：按 Working Number + Season 匹配 Pack；唯一 Working Number 时允许兜底。"],
            ["Season", "Article 表 I 列 Season (M)，按 Working Number (M) + Article Number (A) 匹配。"],
            ["Factory", "Released / Unreleased 表 F 列 Factory。"],
            ["Working Number", "Released / Unreleased 表 P 列 Working Number。"],
            ["Article Number", "Released / Unreleased 表 S 列 Article Number。"],
            ["Article Name", "Released / Unreleased 表 T 列 Article Description。"],
            ["CRD", "Released / Unreleased 表 U 列 Customer Request Date (CRD)。"],
            ["PODD", "Released / Unreleased 表 W 列 PODD。"],
            ["Gps Customer Number", "Released / Unreleased 表 AB 列 Gps Customer Number。"],
            ["Country/Region", "Released / Unreleased 表 AC 列 Country/Region。"],
            ["Marketing Forecast(M)", "Article 表 T 列 Marketing Forecast (M)。"],
            ["Quantity", "按 Result 明细维度汇总 Released / Unreleased 表 AF 列 Ordered Quantity。"],
            ["Factory Price(USD)", "Factory Price 表 G 列，按 Season + Working Number + Factory + Article Number 精确匹配。"],
            ["Factory Amount(USD)", "Factory Price(USD) * Quantity。"],
            ["TMS Price(USD)", "Article 表 AC 列 Intl. FOB (C)，优先级 Final > P2 > P1 > PREC。"],
            ["TMS Amount(USD)", "TMS Price(USD) * Quantity。"],
        ]
        for row in rows:
            ws.append(row)

        header_fill = PatternFill(start_color='FF4472C4', end_color='FF4472C4', fill_type='solid')
        for cell in ws[1]:
            cell.font = Font(bold=True, color='FFFFFFFF')
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = Alignment(horizontal='center', vertical='center')
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.border = thin_border
                cell.alignment = Alignment(vertical='top', wrap_text=True)
        ws.freeze_panes = "A2"
        ws.column_dimensions['A'].width = 24
        ws.column_dimensions['B'].width = 96

    def _write_diagnostics_sheet(self, wb: openpyxl.Workbook,
                                 diagnostics: List[Dict[str, Any]],
                                 thin_border: Border) -> None:
        """写入可追踪的异常信息，方便业务核对缺失和高亮原因。"""
        ws = wb.create_sheet("Diagnostics")
        ws.append(["Level", "Type", "Key", "Message"])
        if diagnostics:
            for item in diagnostics:
                ws.append([
                    item.get("level", "WARN"),
                    item.get("type", ""),
                    item.get("key", ""),
                    item.get("message", ""),
                ])
        else:
            ws.append(["INFO", "OK", "", "No diagnostics."])

        header_fill = PatternFill(start_color='FF4472C4', end_color='FF4472C4', fill_type='solid')
        for cell in ws[1]:
            cell.font = Font(bold=True, color='FFFFFFFF')
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = Alignment(horizontal='center', vertical='center')
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.border = thin_border
                cell.alignment = Alignment(vertical='top', wrap_text=True)
        ws.freeze_panes = "A2"
        ws.column_dimensions['A'].width = 12
        ws.column_dimensions['B'].width = 24
        ws.column_dimensions['C'].width = 42
        ws.column_dimensions['D'].width = 90

    @staticmethod
    def _estimate_text_width(value: Any) -> int:
        if value is None:
            return 0
        return sum(2 if ord(char) > 255 else 1 for char in str(value))

    def _adjust_column_widths(self, ws: openpyxl.worksheet.worksheet.Worksheet,
                             max_widths: Optional[Dict[int, int]] = None,
                             min_widths: Optional[Dict[int, int]] = None) -> None:
        """自动调整Excel列宽"""
        if max_widths is None:
            max_widths = {}
        if min_widths is None:
            min_widths = {}

        for col_idx in range(1, ws.max_column + 1):
            max_length = 0
            column_letter = openpyxl.utils.get_column_letter(col_idx)
            for row in range(1, ws.max_row + 1):
                cell = ws.cell(row=row, column=col_idx)
                try:
                    max_length = max(max_length, self._estimate_text_width(cell.value))
                except Exception:
                    pass
            min_width = min_widths.get(col_idx, 9)
            max_width = max_widths.get(col_idx, 34)
            adjusted_width = min(max(max_length + 2, min_width), max_width)
            ws.column_dimensions[column_letter].width = adjusted_width

    @staticmethod
    def _clean_key(value: Any) -> str:
        """Normalize Excel key values and avoid treating blank/NaN as real keys."""
        if pd.isna(value):
            return ""
        text = str(value).strip()
        if text.lower() in {"nan", "none"}:
            return ""
        return text

    @classmethod
    def _make_article_key(cls, working_num: Any, article_num: Any) -> Tuple[str, str]:
        return (cls._clean_key(working_num).upper(), cls._clean_key(article_num).upper())

    @staticmethod
    def _is_blank(value: Any) -> bool:
        if value is None:
            return True
        try:
            if pd.isna(value):
                return True
        except (TypeError, ValueError):
            pass
        return str(value).strip().lower() in {"", "nan", "none", "nat"}

    @classmethod
    def _clean_text(cls, value: Any) -> str:
        if cls._is_blank(value):
            return ""
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        if isinstance(value, int) and not isinstance(value, bool):
            return str(value)
        return str(value).strip()

    @classmethod
    def _clean_output_value(cls, value: Any) -> Any:
        if cls._is_blank(value):
            return ""
        if isinstance(value, pd.Timestamp):
            return value.to_pydatetime().replace(tzinfo=None)
        if isinstance(value, datetime):
            return value.replace(tzinfo=None)
        return value

    @classmethod
    def _group_key_value(cls, value: Any) -> str:
        if cls._is_blank(value):
            return ""
        if isinstance(value, pd.Timestamp):
            return value.strftime('%Y-%m-%d')
        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d')
        return str(value).strip().upper()

    @classmethod
    def _optional_float(cls, value: Any) -> Optional[float]:
        if cls._is_blank(value):
            return None
        try:
            if isinstance(value, str):
                return float(value.strip().replace(",", ""))
            return float(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _article_priority_rank(cls, milestone: Any) -> int:
        key = cls._clean_key(milestone).upper().replace(" ", "")
        return cls.ARTICLE_PRIORITY.get(key, 99)

    @staticmethod
    def _select_article_candidate(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """严格按 Milestone 顺序取值：Final > P2 > P1 > PREC。"""
        for milestone in ("FINAL", "P2", "P1", "PREC"):
            for item in candidates:
                if item['milestone'].upper().replace(" ", "") == milestone:
                    return item

        return candidates[0]


    @classmethod
    def _make_factory_group_key(cls, season: Any, working_num: Any, factory: Any) -> Tuple[str, str, str]:
        return (
            cls._clean_key(season).upper(),
            cls._clean_key(working_num).upper(),
            cls._clean_key(factory).upper(),
        )

    @classmethod
    def _make_factory_article_key(cls, season: Any, working_num: Any,
                                  factory: Any, article_num: Any) -> Tuple[str, str, str, str]:
        return cls._make_factory_group_key(season, working_num, factory) + (
            cls._clean_key(article_num).upper(),
        )

    def process_reports(self, tms_paths: List[str], article_paths: List[str],
                       price_paths: List[str], pack_paths: List[str],
                       output_dir: str = None) -> Dict[str, Any]:
        """主处理流程"""

        result = {
            'success': False,
            'message': '',
            'logs': [],
            'output_path': None,
            'working_count': 0,
            'result_count': 0,
            'diagnostics_count': 0
        }

        def log(msg: str):
            result['logs'].append(msg)

        try:
            log("=" * 80)
            log("开始生成 Sophia & Tina 报表")
            log("=" * 80)

            # 读取各类文件
            log("\n📖 正在读取 TMS 文件...")
            tms_df, tms_logs = self.read_excel_files(tms_paths)
            result['logs'].extend(tms_logs)

            if tms_df is None:
                result['message'] = 'TMS 文件读取失败'
                return result

            log(f"✅ TMS 文件读取完成，共 {len(tms_df)} 行数据")

            log("\n📖 正在读取 Article 文件...")
            article_df, article_logs = self.read_excel_files(article_paths)
            result['logs'].extend(article_logs)

            if article_df is None:
                result['message'] = 'Article 文件读取失败'
                return result

            log(f"✅ Article 文件读取完成，共 {len(article_df)} 行数据")

            log("\n📖 正在读取 Factory Price 文件...")
            price_df, price_logs = self.read_excel_files(price_paths)
            result['logs'].extend(price_logs)

            if price_df is None:
                result['message'] = 'Factory Price 文件读取失败'
                return result

            log(f"✅ Factory Price 文件读取完成，共 {len(price_df)} 行数据")

            log("\n📖 正在读取 Pack 文件...")
            pack_df, pack_logs = self.read_excel_files(pack_paths)
            result['logs'].extend(pack_logs)

            if pack_df is None:
                result['message'] = 'Pack 文件读取失败'
                return result

            log(f"✅ Pack 文件读取完成，共 {len(pack_df)} 行数据")

            # 检查必要列
            log(f"\n🔍 正在检查必要的列...")
            tms_cols = tms_df.columns.tolist()
            article_cols = article_df.columns.tolist()
            price_cols = price_df.columns.tolist()
            pack_cols = pack_df.columns.tolist()

            required_columns = {
                "TMS": [
                    'Factory',
                    'Working Number',
                    'Article Number',
                    'Article Description',
                    'Customer Request Date (CRD)',
                    'PODD',
                    'Gps Customer Number',
                    'Country/Region',
                    'Ordered Quantity',
                ],
                "Article": [
                    'Working Number (M)',
                    'Article Number (A)',
                    'Season (M)',
                    'Marketing Forecast (M)',
                    'Milestone (C)',
                    'Intl. FOB (C)',
                ],
                "Factory Price": [
                    'Season',
                    'Working Number',
                    'Article Number',
                    'Factory',
                    'Factory Price',
                ],
                "Pack": [
                    'Pack',
                    'Season',
                    'Working Number',
                ],
            }
            column_sources = {
                "TMS": tms_cols,
                "Article": article_cols,
                "Factory Price": price_cols,
                "Pack": pack_cols,
            }
            missing_cols: List[str] = []
            for source_name, required in required_columns.items():
                existing = column_sources[source_name]
                for col_name in required:
                    if col_name not in existing:
                        missing_cols.append(f"{source_name} 缺少: {col_name}")

            if missing_cols:
                msg = "缺少必要的列：\n" + "\n".join(missing_cols)
                log(f"❌ {msg}")
                result['message'] = msg
                return result

            log("✅ 所有必要列检查通过")

            log(f"\n🔄 正在按 TMS 明细维度汇总 Ordered Quantity...")
            log(f"📊 TMS 文件共 {len(tms_df)} 行数据")

            diagnostics: List[Dict[str, Any]] = []
            seen_diagnostics: Set[Tuple[str, str, str]] = set()

            def add_diagnostic(level: str, diag_type: str, key: str, message: str) -> None:
                # 同一个问题只写一次，避免 Diagnostics 被明细行重复撑大。
                dedupe_key = (diag_type, key, message)
                if dedupe_key in seen_diagnostics:
                    return
                seen_diagnostics.add(dedupe_key)
                diagnostics.append({
                    "level": level,
                    "type": diag_type,
                    "key": key,
                    "message": message,
                })

            working_numbers: Set[str] = set()
            used_article_keys: Set[Tuple[str, str]] = set()
            tms_groups: Dict[Tuple[str, ...], Dict[str, Any]] = {}

            for _, row in tms_df.iterrows():
                working_num = self._clean_text(row['Working Number'])
                article_num = self._clean_text(row['Article Number'])
                if not working_num or not article_num:
                    continue

                working_numbers.add(working_num.upper())
                used_article_keys.add((working_num.upper(), article_num.upper()))
                group_values = {
                    'Factory': self._clean_text(row['Factory']),
                    'Working Number': working_num,
                    'Article Number': article_num,
                    'Article Name': self._clean_text(row['Article Description']),
                    'CRD': self._clean_output_value(row['Customer Request Date (CRD)']),
                    'PODD': self._clean_output_value(row['PODD']),
                    'Gps Customer Number': self._clean_text(row['Gps Customer Number']),
                    'Country/Region': self._clean_text(row['Country/Region']),
                }
                key = tuple([
                    self._group_key_value(row['Factory']),
                    self._group_key_value(row['Working Number']),
                    self._group_key_value(row['Article Number']),
                    self._group_key_value(row['Article Description']),
                    self._group_key_value(row['Customer Request Date (CRD)']),
                    self._group_key_value(row['PODD']),
                    self._group_key_value(row['Gps Customer Number']),
                    self._group_key_value(row['Country/Region']),
                ])
                if key not in tms_groups:
                    tms_groups[key] = {
                        **group_values,
                        'Quantity': 0.0,
                    }
                qty = self._optional_float(row['Ordered Quantity']) or 0.0
                tms_groups[key]['Quantity'] += qty

            log(f"✅ TMS 明细汇总完成：{len(tms_groups)} 行，{len(working_numbers)} 个 Working Number")

            log("📊 正在构建 Article / Factory Price / Pack 查找字典...")

            article_candidates: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
            for _, row in article_df.iterrows():
                key = self._make_article_key(row['Working Number (M)'], row['Article Number (A)'])
                if not key[0] or not key[1]:
                    continue
                article_candidates.setdefault(key, []).append({
                    'season': self._clean_text(row['Season (M)']),
                    'marketing_forecast': self._clean_output_value(row['Marketing Forecast (M)']),
                    'tms_price': self._optional_float(row['Intl. FOB (C)']),
                    'milestone': self._clean_text(row['Milestone (C)']),
                    'rank': self._article_priority_rank(row['Milestone (C)']),
                })

            article_lookup: Dict[Tuple[str, str], Dict[str, Any]] = {}
            for key, candidates in article_candidates.items():
                selected = self._select_article_candidate(candidates)
                article_lookup[key] = selected
                if len(candidates) > 1 and key in used_article_keys:
                    milestones = sorted({item['milestone'] for item in candidates if item['milestone']})
                    add_diagnostic(
                        "INFO",
                        "ARTICLE_PRIORITY",
                        " / ".join(key),
                        f"Article 存在 {len(candidates)} 条成本记录，已按 Final > P2 > P1 > PREC 选择 {selected['milestone']}；候选 Milestone：{milestones}。",
                    )

            pack_lookup: Dict[Tuple[str, str], Any] = {}
            pack_by_working: Dict[str, Set[Any]] = {}
            for _, row in pack_df.iterrows():
                working_key = self._clean_key(row['Working Number']).upper()
                season_key = self._clean_key(row['Season']).upper()
                pack_value = self._clean_output_value(row['Pack'])
                if not working_key:
                    continue
                pack_by_working.setdefault(working_key, set()).add(pack_value)
                if season_key and (working_key, season_key) not in pack_lookup:
                    pack_lookup[(working_key, season_key)] = pack_value

            factory_price_lookup: Dict[Tuple[str, str, str, str], float] = {}
            factory_price_by_working_factory_article: Dict[Tuple[str, str, str], Set[float]] = {}
            factory_group_prices: Dict[Tuple[str, str, str], Set[float]] = {}
            for _, row in price_df.iterrows():
                factory_price = self._optional_float(row['Factory Price'])
                if factory_price is None:
                    continue
                group_key = self._make_factory_group_key(row['Season'], row['Working Number'], row['Factory'])
                article_key = self._make_factory_article_key(
                    row['Season'],
                    row['Working Number'],
                    row['Factory'],
                    row['Article Number'],
                )
                if not all(group_key) or not article_key[3]:
                    continue
                factory_group_prices.setdefault(group_key, set()).add(factory_price)
                factory_price_by_working_factory_article.setdefault(
                    (group_key[1], group_key[2], article_key[3]),
                    set(),
                ).add(factory_price)
                if article_key not in factory_price_lookup:
                    factory_price_lookup[article_key] = factory_price

            factory_conflict_groups = {
                key: prices
                for key, prices in factory_group_prices.items()
                if len(prices) > 1
            }

            log(f"✅ Article 匹配键：{len(article_lookup)}；Factory Price 匹配键：{len(factory_price_lookup)}；Pack 匹配键：{len(pack_lookup)}")

            log(f"\n📊 正在生成 16 列 Result 数据...")
            results: List[Dict[str, Any]] = []
            missing_article_count = 0
            missing_pack_count = 0
            ambiguous_pack_count = 0
            missing_factory_prices = 0
            missing_tms_prices = 0
            highlighted_factory_conflicts = 0

            for group in tms_groups.values():
                working_key = self._clean_key(group['Working Number']).upper()
                article_key = self._clean_key(group['Article Number']).upper()
                factory_key = self._clean_key(group['Factory']).upper()
                article_data = article_lookup.get((working_key, article_key))

                season_value = article_data.get('season') if article_data else ""
                marketing_forecast = article_data.get('marketing_forecast') if article_data else ""
                tms_price = article_data.get('tms_price') if article_data else None
                missing_article = article_data is None
                if missing_article:
                    missing_article_count += 1
                    add_diagnostic(
                        "WARN",
                        "ARTICLE_MISSING",
                        f"{working_key} / {article_key}",
                        "TMS 明细未在 Article 表匹配到 Working Number (M) + Article Number (A)。",
                    )

                season_key = self._clean_key(season_value).upper()
                pack_value = pack_lookup.get((working_key, season_key))
                missing_pack = False
                ambiguous_pack = False
                if not pack_value:
                    fallback_packs = {pack for pack in pack_by_working.get(working_key, set()) if pack}
                    if len(fallback_packs) == 1:
                        pack_value = next(iter(fallback_packs))
                    elif len(fallback_packs) > 1:
                        ambiguous_pack = True
                        ambiguous_pack_count += 1
                        add_diagnostic(
                            "WARN",
                            "PACK_AMBIGUOUS",
                            f"{working_key} / {season_key or 'NO_SEASON'}",
                            f"Pack 表同一个 Working Number 有多个 Pack，无法在缺少 Season 精确匹配时兜底：{sorted(fallback_packs)}。",
                        )
                    else:
                        missing_pack = True
                        missing_pack_count += 1
                        add_diagnostic(
                            "WARN",
                            "PACK_MISSING",
                            f"{working_key} / {season_key or 'NO_SEASON'}",
                            "Pack 表未匹配到 Working Number + Season，也没有唯一 Working Number 兜底值。",
                        )

                factory_lookup_key = self._make_factory_article_key(season_value, working_key, factory_key, article_key)
                factory_price = factory_price_lookup.get(factory_lookup_key)
                factory_group_key = self._make_factory_group_key(season_value, working_key, factory_key)
                factory_price_conflict = factory_group_key in factory_conflict_groups
                if factory_price_conflict:
                    highlighted_factory_conflicts += 1
                    add_diagnostic(
                        "WARN",
                        "FACTORY_PRICE_CONFLICT",
                        " / ".join(factory_group_key),
                        f"同一个 Season + Working Number + Factory 存在多个 Factory Price：{sorted(factory_conflict_groups[factory_group_key])}；Result 已高亮对应价格单元格。",
                    )
                if factory_price is None:
                    fallback_factory_prices = factory_price_by_working_factory_article.get(
                        (working_key, factory_key, article_key),
                        set(),
                    )
                    if len(fallback_factory_prices) == 1:
                        factory_price = next(iter(fallback_factory_prices))
                        add_diagnostic(
                            "INFO",
                            "FACTORY_PRICE_FALLBACK",
                            f"{working_key} / {factory_key} / {article_key}",
                            "Article 缺少 Season 时，Factory Price 已按 Working Number + Factory + Article Number 唯一值兜底。",
                        )
                missing_factory_price = factory_price is None
                if missing_factory_price:
                    missing_factory_prices += 1
                    add_diagnostic(
                        "WARN",
                        "FACTORY_PRICE_MISSING",
                        " / ".join(factory_lookup_key),
                        "Factory Price 表未按 Season + Working Number + Factory + Article Number 匹配到价格。",
                    )

                if tms_price is None:
                    missing_tms_prices += 1
                    add_diagnostic(
                        "WARN",
                        "TMS_PRICE_MISSING",
                        f"{working_key} / {article_key}",
                        "Article 表未匹配到可用 Intl. FOB (C)，TMS Price 与 TMS Amount 留空。",
                    )

                quantity = group['Quantity']
                factory_amount = factory_price * quantity if factory_price is not None else None
                tms_amount = tms_price * quantity if tms_price is not None else None

                results.append({
                    'Pack': pack_value or "",
                    'Season': season_value or "",
                    'Factory': group['Factory'],
                    'Working Number': group['Working Number'],
                    'Article Number': group['Article Number'],
                    'Article Name': group['Article Name'],
                    'CRD': group['CRD'],
                    'PODD': group['PODD'],
                    'Gps Customer Number': group['Gps Customer Number'],
                    'Country/Region': group['Country/Region'],
                    'Marketing Forecast(M)': marketing_forecast,
                    'Quantity': quantity,
                    'Factory Price(USD)': factory_price,
                    'Factory Amount(USD)': factory_amount,
                    'TMS Price(USD)': tms_price,
                    'TMS Amount(USD)': tms_amount,
                    '_factory_price_conflict': factory_price_conflict,
                    '_missing_factory_price': missing_factory_price,
                    '_missing_tms_price': tms_price is None,
                    '_missing_article': missing_article,
                    '_missing_pack': missing_pack,
                    '_ambiguous_pack': ambiguous_pack,
                })

            log(f"\n✅ 共生成 {len(results)} 条 Result 明细记录")
            if missing_article_count:
                log(f"  ⚠️ {missing_article_count} 条 Result 明细未匹配到 Article 记录")
            if missing_pack_count:
                log(f"  ⚠️ {missing_pack_count} 条 Result 明细未匹配到 Pack")
            if ambiguous_pack_count:
                log(f"  ⚠️ {ambiguous_pack_count} 条 Result 明细 Pack 存在多值歧义")
            if missing_factory_prices:
                log(f"  ⚠️ {missing_factory_prices} 条 Result 明细未匹配到 Factory Price")
            if missing_tms_prices:
                log(f"  ⚠️ {missing_tms_prices} 条 Result 明细未匹配到 Article Intl. FOB (C)")
            if highlighted_factory_conflicts:
                log(f"  ⚠️ {highlighted_factory_conflicts} 条 Result 明细因同 Season/Working/Factory 多 Factory Price 已高亮")

            result['working_count'] = len(working_numbers)
            result['result_count'] = len(results)
            result['diagnostics_count'] = len(diagnostics)

            log(f"\n💾 正在保存结果报表...")

            if output_dir is None:
                output_dir = os.path.dirname(tms_paths[0])

            ensure_dir(output_dir)

            default_name = (
                "Sophia_Tina_Result_" +
                datetime.now().strftime('%Y%m%d_%H%M%S') +
                ".xlsx"
            )

            output_path = os.path.join(output_dir, default_name)

            self.save_st_result(results, output_path, diagnostics)

            result['output_path'] = output_path

            log(f"\n{'='*80}")
            log(f"✅ 报表生成完成！")
            log(f"{'='*80}")
            log(f"结果文件：{output_path}")

            result['success'] = True
            result['message'] = f"Sophia & Tina 报表生成完成，共生成 {len(results)} 条 Result 明细记录"

        except Exception as e:
            log(f"\n❌ 错误：{str(e)}")
            import traceback
            log(traceback.format_exc())
            result['message'] = f'处理出错：{str(e)}'

        return result
