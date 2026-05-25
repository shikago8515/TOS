
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
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from typing import List, Dict, Any, Optional, Tuple

# 导入工具模块
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.excel_utils import safe_float
from utils.file_utils import ensure_dir, create_thin_border


class SophiaTinaModule:
    """Sophia & Tina 报表生成业务逻辑"""

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

    def save_st_result(self, results: List[Dict[str, Any]], output_path: str) -> None:
        """保存 Sophia & Tina 结果报表"""

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Result"

        thin_border = create_thin_border()

        headers = ['Pack', 'Season', 'Working Number', 'Factory', 'PODD', 'Quantity', 'Factory Amount (USD)', 'TMS Amount (USD)']
        ws.row_dimensions[1].height = 30
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = Font(bold=True, color='FFFFFFFF', size=11)
            cell.fill = PatternFill(start_color='FF4472C4', end_color='FF4472C4', fill_type='solid')
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = thin_border

        for row_idx, result in enumerate(results, 2):
            ws.row_dimensions[row_idx].height = 20
            is_odd_row = ((row_idx - 2) % 2 == 0)
            row_fill = PatternFill(start_color='FFF2F2F2', end_color='FFF2F2F2', fill_type='solid') if is_odd_row else None

            ws.cell(row=row_idx, column=1, value=result['Pack'])
            ws.cell(row=row_idx, column=2, value=result['Season'])
            ws.cell(row=row_idx, column=3, value=result['Working Number'])
            ws.cell(row=row_idx, column=4, value=result['Factory'])
            ws.cell(row=row_idx, column=5, value=result['PODD'])
            ws.cell(row=row_idx, column=6, value=result['Quantity'])
            ws.cell(row=row_idx, column=7, value=result['Factory Amount (USD)'])
            ws.cell(row=row_idx, column=8, value=result['TMS Amount (USD)'])

            for col_idx in range(1, 9):
                cell = ws.cell(row=row_idx, column=col_idx)
                cell.border = thin_border
                cell.alignment = Alignment(horizontal='center', vertical='center')
                if row_fill:
                    cell.fill = row_fill

        # 自动调整列宽
        self._adjust_column_widths(ws, min_widths={
            1: 14,
            2: 12,
            3: 18,
            4: 18,
            5: 13,
            6: 12,
            7: 22,
            8: 20,
        })

        wb.save(output_path)

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

    def process_reports(self, tms_paths: List[str], article_paths: List[str],
                       price_paths: List[str], pack_paths: List[str],
                       output_dir: str = None) -> Dict[str, Any]:
        """主处理流程"""

        result = {
            'success': False,
            'message': '',
            'logs': [],
            'output_path': None,
            'working_count': 0
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

            missing_cols: List[str] = []
            if 'Working Number' not in tms_cols:
                missing_cols.append("TMS 缺少: Working Number")
            if 'Article Number' not in tms_cols:
                missing_cols.append("TMS 缺少: Article Number")
            if 'Factory' not in tms_cols:
                missing_cols.append("TMS 缺少: Factory")
            if 'PODD' not in tms_cols:
                missing_cols.append("TMS 缺少: PODD")
            if 'Ordered Quantity' not in tms_cols:
                missing_cols.append("TMS 缺少: Ordered Quantity")

            if 'Working Number (M)' not in article_cols:
                missing_cols.append("Article 缺少: Working Number (M)")
            if 'Article Number (A)' not in article_cols:
                missing_cols.append("Article 缺少: Article Number (A)")
            if 'Season (M)' not in article_cols:
                missing_cols.append("Article 缺少: Season (M)")
            if 'Base FOB (C)' not in article_cols:
                missing_cols.append("Article 缺少: Base FOB (C)")

            if 'Working Number' not in price_cols:
                missing_cols.append("Price 缺少: Working Number")
            if 'Article Number' not in price_cols:
                missing_cols.append("Price 缺少: Article Number")
            if 'TMS Price' not in price_cols:
                missing_cols.append("Price 缺少: TMS Price")

            if 'Working Number' not in pack_cols:
                missing_cols.append("Pack 缺少: Working Number")
            if 'Pack' not in pack_cols:
                missing_cols.append("Pack 缺少: Pack")

            if missing_cols:
                msg = "缺少必要的列：\n" + "\n".join(missing_cols)
                log(f"❌ {msg}")
                result['message'] = msg
                return result

            log("✅ 所有必要列检查通过")

            log(f"\n🔄 正在按 Working Number + Article Number 分组处理 TMS 数据...")
            log(f"📊 TMS 文件共 {len(tms_df)} 行数据")

            # 构建查找字典
            working_groups: Dict[str, Dict[str, Any]] = {}
            for _, row in tms_df.iterrows():
                working_num = self._clean_key(row['Working Number'])
                article_num = self._clean_key(row['Article Number'])
                if not working_num or not article_num:
                    continue

                if working_num not in working_groups:
                    working_groups[working_num] = {
                        'factory': "",
                        'podd': "",
                        'articles': {}
                    }

                group = working_groups[working_num]
                if not group['factory'] and pd.notna(row['Factory']):
                    group['factory'] = str(row['Factory'])
                if not group['podd'] and pd.notna(row['PODD']):
                    podd_val = row['PODD']
                    if isinstance(podd_val, datetime):
                        group['podd'] = podd_val.strftime('%Y-%m-%d')
                    else:
                        group['podd'] = str(podd_val)

                qty = safe_float(row['Ordered Quantity'])
                if qty != 0.0 or pd.notna(row['Ordered Quantity']):
                    group['articles'][article_num] = group['articles'].get(article_num, 0.0) + qty

            log("📊 正在构建数据查找字典...")

            article_lookup: Dict[Tuple[str, str], Dict[str, Any]] = {}
            for _, row in article_df.iterrows():
                key = self._make_article_key(row['Working Number (M)'], row['Article Number (A)'])
                if not key[0] or not key[1]:
                    continue
                if key not in article_lookup:
                    article_lookup[key] = {
                        'season': row['Season (M)'] if pd.notna(row['Season (M)']) else "",
                        'base_fob': None
                    }
                base_fob = safe_float(row['Base FOB (C)'])
                if base_fob != 0.0 or pd.notna(row['Base FOB (C)']):
                    article_lookup[key]['base_fob'] = base_fob

            has_factory_price = 'Factory Price' in price_cols
            if not has_factory_price:
                log("  ⚠️ Price 文件未找到 Factory Price 列，Factory Amount 将使用 Article 文件 Base FOB (C) 计算")

            price_lookup: Dict[Tuple[str, str], Dict[str, Any]] = {}
            for _, row in price_df.iterrows():
                key = self._make_article_key(row['Working Number'], row['Article Number'])
                if not key[0] or not key[1]:
                    continue
                if key not in price_lookup:
                    price_lookup[key] = {
                        'factory_price': None,
                        'tms_price': None
                    }
                if has_factory_price:
                    factory_price = safe_float(row['Factory Price'])
                    if factory_price != 0.0 or pd.notna(row['Factory Price']):
                        price_lookup[key]['factory_price'] = factory_price
                tms_price = safe_float(row['TMS Price'])
                if tms_price != 0.0 or pd.notna(row['TMS Price']):
                    price_lookup[key]['tms_price'] = tms_price

            pack_lookup: Dict[str, Any] = {}
            for _, row in pack_df.iterrows():
                working_num = self._clean_key(row['Working Number']).upper()
                if working_num and working_num not in pack_lookup:
                    pack_lookup[working_num] = row['Pack']

            log(f"✅ 共找到 {len(working_groups)} 个不同的 Working Number")
            log(f"📋 Working Number 列表：{list(working_groups.keys())}")

            log(f"\n📊 正在生成结果数据...")
            results: List[Dict[str, Any]] = []
            missing_article_prices = 0
            missing_tms_prices = 0
            missing_factory_prices = 0

            for working_num, group in working_groups.items():
                working_num_upper = working_num.upper()

                # 使用查找字典
                pack_value = pack_lookup.get(working_num_upper, "")
                season_value = ""
                factory_value = group['factory']
                podd_value = group['podd']
                total_quantity = 0.0
                factory_amount = 0.0
                tms_amount = 0.0

                for article_num, article_qty in group['articles'].items():
                    total_quantity += article_qty
                    key = self._make_article_key(working_num, article_num)
                    article_data = article_lookup.get(key, {})
                    price_data = price_lookup.get(key, {})

                    if not season_value and article_data.get('season'):
                        season_value = article_data.get('season', "")

                    base_fob = article_data.get('base_fob')
                    if base_fob is None:
                        missing_article_prices += 1

                    factory_price = price_data.get('factory_price')
                    if factory_price is None:
                        factory_price = base_fob
                    if factory_price is None:
                        missing_factory_prices += 1
                    else:
                        factory_amount += factory_price * article_qty

                    tms_price = price_data.get('tms_price')
                    if tms_price is None:
                        missing_tms_prices += 1
                    else:
                        tms_amount += tms_price * article_qty

                results.append({
                    'Pack': pack_value,
                    'Season': season_value,
                    'Working Number': working_num,
                    'Factory': factory_value,
                    'PODD': podd_value,
                    'Quantity': total_quantity,
                    'Factory Amount (USD)': factory_amount,
                    'TMS Amount (USD)': tms_amount
                })

                log(f"  - {working_num}: Articles={len(group['articles'])}, Qty={total_quantity}, Factory=${factory_amount:.2f}, TMS=${tms_amount:.2f}")

            log(f"\n✅ 共生成 {len(results)} 条结果记录")
            if missing_article_prices:
                log(f"  ⚠️ {missing_article_prices} 个 Article 未匹配到 Article Base FOB (C)")
            if missing_factory_prices:
                log(f"  ⚠️ {missing_factory_prices} 个 Article 未匹配到 Factory Price / Base FOB (C)")
            if missing_tms_prices:
                log(f"  ⚠️ {missing_tms_prices} 个 Article 未匹配到 TMS Price")
            result['working_count'] = len(working_groups)

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

            self.save_st_result(results, output_path)

            result['output_path'] = output_path

            log(f"\n{'='*80}")
            log(f"✅ 报表生成完成！")
            log(f"{'='*80}")
            log(f"结果文件：{output_path}")

            result['success'] = True
            result['message'] = f"Sophia & Tina 报表生成完成，共处理 {len(working_groups)} 个 Working Number"

        except Exception as e:
            log(f"\n❌ 错误：{str(e)}")
            import traceback
            log(traceback.format_exc())
            result['message'] = f'处理出错：{str(e)}'

        return result

