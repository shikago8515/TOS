
# -*- coding: utf-8 -*-
"""
Jessca 数据核对模块
从 TMS工具_20260518_2100.pyw 提取的核心逻辑
创建时间: 2026-05-18
"""

import os
import re
import openpyxl
import xlrd
import pandas as pd
from datetime import datetime
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from typing import List, Dict, Tuple, Any, Optional

# 导入工具模块
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.excel_utils import safe_float, ExcelRowAdapter, XlrdAdapter, OpenpyxlAdapter
from utils.file_utils import ensure_dir, create_thin_border


class JesscaModule:
    """Jessca 数据核对业务逻辑"""
    
    def __init__(self):
        pass
    
    def read_invoice_data(self, invoice_path: str) -> List[Dict[str, Any]]:
        """读取发票数据，统一处理.xls和.xlsx格式"""
        
        # 1. 根据文件格式创建对应的适配器
        if invoice_path.endswith('.xls'):
            wb = xlrd.open_workbook(invoice_path)
            ws = wb.sheet_by_index(0)
            adapter = XlrdAdapter(wb, ws)
        else:
            wb = openpyxl.load_workbook(invoice_path, read_only=True)
            ws = wb.active
            adapter = OpenpyxlAdapter(wb, ws)
        
        try:
            # 2. 调用统一的解析逻辑
            return self._parse_invoice_data(adapter)
        finally:
            adapter.close()
    
    def _parse_invoice_data(self, adapter: ExcelRowAdapter) -> List[Dict[str, Any]]:
        """核心解析逻辑，使用适配器访问数据"""
        data: List[Dict[str, Any]] = []
        pending_items: List[Dict[str, Any]] = []
        
        for row_idx in range(adapter.get_row_count()):
            # 获取第一列值
            col0_val = str(adapter.get_cell_value(row_idx, 0) or "").strip()
            
            # 识别PO行
            if col0_val.upper().startswith("PO") and "NO" not in col0_val.upper():
                price_val = self._extract_price(adapter, row_idx)
                if price_val is not None:
                    pending_items.append({
                        'article': None,
                        'price': price_val
                    })
            
            # 识别ARTICLE行
            elif col0_val.upper().startswith("ARTICLE"):
                if adapter.get_col_count(row_idx) > 1:
                    article_val = str(adapter.get_cell_value(row_idx, 1) or "").strip()
                    if pending_items:
                        pending_items[-1]['article'] = article_val
            
            # 识别STYLE行
            elif col0_val.upper().startswith("STYLE"):
                if adapter.get_col_count(row_idx) > 1:
                    style_val = str(adapter.get_cell_value(row_idx, 1) or "").strip()
                    # 将pending_items转为最终数据
                    for item in pending_items:
                        if item['article'] is not None and item['price'] is not None:
                            data.append({
                                'article': item['article'],
                                'style': style_val,
                                'price': item['price']
                            })
                        elif item['price'] is not None:
                            data.append({
                                'article': '',
                                'style': style_val,
                                'price': item['price']
                            })
                    pending_items = []
        
        return data
    
    def _extract_price(self, adapter: ExcelRowAdapter, row_idx: int) -> Optional[float]:
        """从指定行提取价格"""
        PRICE_MIN, PRICE_MAX = 0.1, 1000  # 价格范围常量
        price_col_candidates = self._find_price_columns(adapter, row_idx)
        for col_idx in price_col_candidates:
            candidate = self._parse_price_value(adapter.get_cell_value(row_idx, col_idx))
            if candidate is not None and PRICE_MIN <= candidate <= PRICE_MAX:
                return candidate

        for col_idx in range(adapter.get_col_count(row_idx)):
            left_text = str(adapter.get_cell_value(row_idx, col_idx - 1) or "").strip().upper() if col_idx > 0 else ""
            right_text = str(adapter.get_cell_value(row_idx, col_idx + 1) or "").strip().upper() if col_idx + 1 < adapter.get_col_count(row_idx) else ""
            if left_text != "USD" or right_text != "USD":
                continue
            candidate = self._parse_price_value(adapter.get_cell_value(row_idx, col_idx))
            if candidate is not None and PRICE_MIN <= candidate <= PRICE_MAX:
                return candidate
        
        return None

    def _find_price_columns(self, adapter: ExcelRowAdapter, row_idx: int) -> List[int]:
        """根据表头定位单价列，避免把 QTY 数量列误当价格。"""
        price_cols: List[int] = []
        search_start = max(0, row_idx - 5)
        for header_row in range(search_start, row_idx):
            for col_idx in range(adapter.get_col_count(header_row)):
                header_text = str(adapter.get_cell_value(header_row, col_idx) or "").strip().upper()
                if not header_text:
                    continue
                if "QTY" in header_text or "QUANTITY" in header_text:
                    continue
                if "UNIT PRICE" in header_text:
                    price_cols.extend([col_idx, col_idx + 1])
                elif header_text == "PRICE":
                    price_cols.append(col_idx)

        seen = set()
        ordered_cols: List[int] = []
        max_cols = adapter.get_col_count(row_idx)
        for col_idx in price_cols + [7]:
            if 0 <= col_idx < max_cols and col_idx not in seen:
                ordered_cols.append(col_idx)
                seen.add(col_idx)
        return ordered_cols
    
    def _parse_price_value(self, cell_val: Any) -> Optional[float]:
        """解析单元格值为价格候选值"""
        if cell_val is None:
            return None
        
        if isinstance(cell_val, (int, float)):
            return float(cell_val)
        
        if isinstance(cell_val, str):
            cell_val_clean = cell_val.strip()
            if not cell_val_clean:
                return None
            
            # 尝试直接转换
            try:
                return float(cell_val_clean)
            except ValueError:
                pass
            
            # 使用正则提取数字
            match = re.search(r'(\d+\.?\d*)', cell_val_clean)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    pass
        
        return None
    
    def update_reference_table(self, ref_df: pd.DataFrame, 
                              all_invoice_data: Dict[Tuple[str, str], Dict[str, float]]) -> Tuple[pd.DataFrame, Dict[str, int]]:
        result_df = ref_df.copy()
        
        statuses: List[str] = []
        invoice_prices: List[Optional[float]] = []
        source_invoices: List[Optional[str]] = []
        
        matches = {'一致': 0, '不一致': 0, '未找到': 0}
        
        for _, row in result_df.iterrows():
            article = str(row.get('article NO.', '')).strip()
            style = str(row.get('style NO.', '')).strip()
            ref_price = float(row.get('price', 0))
            
            key = (article, style)
            
            if key in all_invoice_data:
                invoice_data_for_key = all_invoice_data[key]
                
                found_inconsistent = False
                inconsistent_price = None
                inconsistent_source = None
                
                for invoice_file, invoice_price in invoice_data_for_key.items():
                    if abs(invoice_price - ref_price) >= 0.001:
                        found_inconsistent = True
                        inconsistent_price = invoice_price
                        inconsistent_source = invoice_file
                        break
                
                if found_inconsistent:
                    statuses.append('不一致')
                    invoice_prices.append(inconsistent_price)
                    source_invoices.append(inconsistent_source)
                    matches['不一致'] += 1
                else:
                    statuses.append('一致')
                    invoice_prices.append(None)
                    source_invoices.append(None)
                    matches['一致'] += 1
            else:
                statuses.append('未在发票中找到')
                invoice_prices.append(None)
                source_invoices.append(None)
                matches['未找到'] += 1
        
        result_df['核对状态'] = statuses
        result_df['发票价格'] = invoice_prices
        result_df['来源发票'] = source_invoices
        
        return result_df, matches
    
    def save_excel_with_summary(self, result_df: pd.DataFrame, 
                                all_invoice_data: Dict[Tuple[str, str], Dict[str, float]],
                                invoice_file_names: List[str], 
                                invoice_file_paths: List[str], 
                                ref_df: pd.DataFrame, 
                                output_path: str) -> Dict[str, Any]:
        """保存 Excel 结果，包含汇总表"""
        
        wb = openpyxl.Workbook()
        
        default_sheet = wb.active
        wb.remove(default_sheet)
        
        thin_border = create_thin_border()
        
        # 创建核对结果表
        ws_main = wb.create_sheet("核对结果")
        
        ws_main.row_dimensions[1].height = 30
        headers = list(result_df.columns)
        for col_idx, header in enumerate(headers, 1):
            cell = ws_main.cell(row=1, column=col_idx, value=header)
            cell.font = Font(bold=True, color='FFFFFFFF', size=11)
            cell.fill = PatternFill(start_color='FF4472C4', end_color='FF4472C4', fill_type='solid')
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = thin_border
        
        for row_idx, row in enumerate(result_df.itertuples(index=False), 2):
            ws_main.row_dimensions[row_idx].height = 20
            is_odd_row = ((row_idx - 2) % 2 == 0)
            row_fill = PatternFill(start_color='FFF2F2F2', end_color='FFF2F2F2', fill_type='solid') if is_odd_row else None
            
            for col_idx, value in enumerate(row, 1):
                cell = ws_main.cell(row=row_idx, column=col_idx, value=value)
                cell.border = thin_border
                cell.alignment = Alignment(horizontal='left', vertical='center')
                if row_fill:
                    cell.fill = row_fill
        
        # 创建汇总表：按发票明细纵向展开，避免文件多时横向过宽
        ws_summary = wb.create_sheet("汇总表")
        summary_stats = self._write_compact_summary_sheet(
            ws_summary,
            all_invoice_data,
            invoice_file_names,
            invoice_file_paths,
            ref_df,
            thin_border
        )
        
        # 自动调整列宽
        self._adjust_column_widths(ws_main)
        
        summary_column_widths = {
            1: 18,
            2: 15,
            3: 10,
            4: 20,
            5: 10,
            6: 20,
            7: 42
        }
        self._adjust_column_widths(ws_summary, summary_column_widths)
        for col_idx, width in summary_column_widths.items():
            column_letter = openpyxl.utils.get_column_letter(col_idx)
            ws_summary.column_dimensions[column_letter].width = width
        
        wb.save(output_path)
        
        return {
            'output_path': output_path,
            'sheet_count': len(wb.sheetnames),
            'sheet_names': wb.sheetnames,
            'missing_count': summary_stats['missing_count'],
            'data_count': summary_stats['data_count']
        }

    def _write_compact_summary_sheet(self,
                                     ws_summary: openpyxl.worksheet.worksheet.Worksheet,
                                     all_invoice_data: Dict[Tuple[str, str], Dict[str, float]],
                                     invoice_file_names: List[str],
                                     invoice_file_paths: List[str],
                                     ref_df: pd.DataFrame,
                                     thin_border: Border) -> Dict[str, int]:
        """写入窄版汇总表：每张发票命中的价格用纵向明细行展示。"""
        summary_border = Border(
            left=Side(style='thin', color='FFD9E2EC'),
            right=Side(style='thin', color='FFD9E2EC'),
            top=Side(style='thin', color='FFD9E2EC'),
            bottom=Side(style='thin', color='FFD9E2EC')
        )
        no_fill = PatternFill(fill_type=None)
        row_fill_style = PatternFill(start_color='FFF7F9FC', end_color='FFF7F9FC', fill_type='solid')

        header_cells = [
            '款式号',
            '款号',
            '参考价',
            '来源发票',
            '发票价',
            '状态',
            '异常文件'
        ]

        title_end_col = openpyxl.utils.get_column_letter(len(header_cells))
        ws_summary.merge_cells(f'A1:{title_end_col}1')
        title_cell = ws_summary['A1']
        title_cell.value = f"发票价格核对汇总表 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        title_cell.font = Font(size=14, bold=True, color='FF1F2937')
        title_cell.fill = no_fill
        title_cell.alignment = Alignment(horizontal='left', vertical='center')
        ws_summary.row_dimensions[1].height = 28
        for col_idx in range(1, len(header_cells) + 1):
            cell = ws_summary.cell(row=1, column=col_idx)
            cell.border = summary_border
            cell.fill = no_fill

        header_row = 2
        ws_summary.row_dimensions[header_row].height = 24
        for col_idx, header_text in enumerate(header_cells, 1):
            cell = ws_summary.cell(row=header_row, column=col_idx, value=header_text)
            cell.font = Font(bold=True, color='FF1F2937', size=11)
            cell.fill = no_fill
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=False)
            cell.border = summary_border

        ref_data_lookup: Dict[Tuple[str, str], float] = {}
        for _, ref_row in ref_df.iterrows():
            article = str(ref_row.get('article NO.', '')).strip()
            style = str(ref_row.get('style NO.', '')).strip()
            key = (article, style)
            ref_data_lookup[key] = float(ref_row.get('price', 0))

        missing_from_ref_count = sum(1 for key in all_invoice_data if key not in ref_data_lookup)
        data_start_row = header_row + 1
        if missing_from_ref_count > 0:
            data_start_row = header_row + 2
            ws_summary.row_dimensions[header_row + 1].height = 24
            ws_summary.merge_cells(f'A{header_row+1}:{title_end_col}{header_row+1}')
            tip_cell = ws_summary.cell(row=header_row+1, column=1, value=f"提示：状态为「参考表未找到」的商品需补入参考表，共 {missing_from_ref_count} 个。")
            tip_cell.font = Font(bold=True, color='FFB45309', size=11)
            tip_cell.fill = PatternFill(start_color='FFFFF7D6', end_color='FFFFF7D6', fill_type='solid')
            tip_cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=False)
            for col_idx in range(1, len(header_cells) + 1):
                ws_summary.cell(row=header_row + 1, column=col_idx).border = summary_border

        invoice_path_lookup = dict(zip(invoice_file_names, invoice_file_paths))
        data_row = data_start_row
        data_count = 0

        for (article, style), invoice_prices_dict in all_invoice_data.items():
            ref_price = ref_data_lookup.get((article, style), None)
            rows_to_write = [
                (invoice_name, invoice_prices_dict[invoice_name])
                for invoice_name in invoice_file_names
                if invoice_name in invoice_prices_dict
            ]

            if not rows_to_write:
                rows_to_write = [('-', None)]

            for invoice_name, invoice_price in rows_to_write:
                is_odd_row = (data_count % 2 == 0)
                row_fill = row_fill_style if is_odd_row else None

                ws_summary.row_dimensions[data_row].height = 24
                values = [
                    style,
                    article,
                    ref_price if ref_price is not None else '未找到',
                    invoice_name,
                    invoice_price if invoice_price is not None else '-',
                    '',
                    '-'
                ]

                for col_idx, value in enumerate(values, 1):
                    cell = ws_summary.cell(row=data_row, column=col_idx, value=value)
                    cell.border = summary_border
                    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=False)
                    if col_idx in (3, 5) and isinstance(value, (int, float)):
                        cell.number_format = '0.00'
                    if row_fill:
                        cell.fill = row_fill

                invoice_cell = ws_summary.cell(row=data_row, column=4)
                invoice_cell.fill = no_fill
                invoice_cell.font = Font(color='FF1F2937')

                price_cell = ws_summary.cell(row=data_row, column=5)
                status_cell = ws_summary.cell(row=data_row, column=6)
                file_cell = ws_summary.cell(row=data_row, column=7)

                if ref_price is None:
                    status_cell.value = '参考表未找到'
                    status_cell.fill = PatternFill(start_color='FFFFFFCC', end_color='FFFFFFCC', fill_type='solid')
                    status_cell.font = Font(bold=True, color='FFCC6600')
                    file_cell.value = invoice_path_lookup.get(invoice_name, invoice_name)
                    file_cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
                    file_cell.font = Font(size=9, color='FF374151')
                    ws_summary.row_dimensions[data_row].height = 38
                elif invoice_price is not None and abs(invoice_price - ref_price) >= 0.001:
                    status_cell.value = '不一致'
                    status_cell.fill = PatternFill(start_color='FFFFDDDD', end_color='FFFFDDDD', fill_type='solid')
                    status_cell.font = Font(bold=True, color='FFFF0000')
                    price_cell.font = Font(color='FFFF0000', bold=True)
                    file_cell.value = invoice_path_lookup.get(invoice_name, invoice_name)
                    file_cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
                    file_cell.font = Font(size=9, color='FF374151')
                    ws_summary.row_dimensions[data_row].height = 38
                else:
                    status_cell.value = '一致'
                    status_cell.fill = PatternFill(start_color='FFDDFFDD', end_color='FFDDFFDD', fill_type='solid')
                    status_cell.font = Font(bold=True, color='FF00AA00')
                    file_cell.value = '-'

                data_count += 1
                data_row += 1

        if data_count > 0:
            ws_summary.auto_filter.ref = f"A{header_row}:{title_end_col}{data_row - 1}"
        ws_summary.freeze_panes = ws_summary.cell(row=data_start_row, column=1)

        return {
            'missing_count': missing_from_ref_count,
            'data_count': data_count
        }
    
    def _adjust_column_widths(self, ws: openpyxl.worksheet.worksheet.Worksheet, 
                             max_widths: Optional[Dict[int, int]] = None) -> None:
        """自动调整Excel列宽"""
        if max_widths is None:
            max_widths = {}
        
        for col_idx in range(1, ws.max_column + 1):
            max_length = 0
            column_letter = openpyxl.utils.get_column_letter(col_idx)
            for row in range(1, ws.max_row + 1):
                cell = ws.cell(row=row, column=col_idx)
                try:
                    if cell.value:
                        length = len(str(cell.value))
                        if length > max_length:
                            max_length = length
                except:
                    pass
            default_max = 25
            if col_idx in max_widths:
                adjusted_width = min(max_length + 2, max_widths[col_idx])
            else:
                adjusted_width = min(max_length + 2, default_max)
            ws.column_dimensions[column_letter].width = adjusted_width
    
    def process_invoices(self, invoice_paths: List[str], ref_path: str, output_dir: str = None) -> Dict[str, Any]:
        """主处理流程"""
        
        result = {
            'success': False,
            'message': '',
            'invoice_count': len(invoice_paths),
            'total_items': 0,
            'matches': {'一致': 0, '不一致': 0, '未找到': 0},
            'output_path': None,
            'logs': []
        }
        
        def log(msg: str):
            result['logs'].append(msg)
        
        try:
            log("=" * 80)
            log("开始批量核对")
            log("=" * 80)
            
            # 读取参考表
            log("\n📖 正在读取参考表...")
            ref_df = pd.read_excel(ref_path)
            log(f"✅ 参考表读取完成，共 {len(ref_df)} 行数据")
            
            all_invoice_data: Dict[Tuple[str, str], Dict[str, float]] = {}
            invoice_file_names: List[str] = []
            invoice_file_paths: List[str] = []
            
            log(f"\n{'='*80}")
            log(f"开始处理 {len(invoice_paths)} 张发票...")
            log(f"{'='*80}")
            
            total_items_count = 0
            
            for idx, invoice_path in enumerate(invoice_paths, 1):
                invoice_filename = os.path.basename(invoice_path)
                invoice_file_names.append(invoice_filename)
                invoice_file_paths.append(invoice_path)
                
                log(f"\n[{idx}/{len(invoice_paths)}] 处理发票：{invoice_filename}")
                
                try:
                    invoice_data = self.read_invoice_data(invoice_path)
                    
                    if len(invoice_data) == 0:
                        log(f"⚠️ 未在发票中识别到有效商品数据，跳过")
                        continue
                    
                    log(f"✅ 成功读取 {len(invoice_data)} 个商品")
                    total_items_count += len(invoice_data)
                    
                    for item in invoice_data:
                        key = (item['article'], item['style'])
                        if key not in all_invoice_data:
                            all_invoice_data[key] = {}
                        
                        all_invoice_data[key][invoice_filename] = item['price']
                        
                        if len(invoice_data) <= 10:
                            log(f"  - {item['article']}/{item['style']}: {item['price']:.2f}")
                    
                    if len(invoice_data) > 10:
                        log(f"  ... (还有 {len(invoice_data)-10} 个商品)")
                
                except Exception as e:
                    log(f"❌ 处理发票 {invoice_filename} 时出错：{str(e)}")
                    import traceback
                    log(traceback.format_exc())
            
            log(f"\n{'='*80}")
            log(f"开始合并结果到参考表...")
            log(f"{'='*80}")
            
            result_df, matches = self.update_reference_table(
                ref_df,
                all_invoice_data
            )
            
            result['matches'] = matches
            result['total_items'] = total_items_count
            
            log("\n💾 正在保存结果（含汇总表）...")
            
            if output_dir is None:
                output_dir = os.path.dirname(ref_path)
            
            ensure_dir(output_dir)
            
            default_name = (
                os.path.splitext(os.path.basename(ref_path))[0] +
                "_批量核对结果_" +
                datetime.now().strftime('%Y%m%d_%H%M%S') +
                ".xlsx"
            )
            
            output_path = os.path.join(output_dir, default_name)
            
            save_result = self.save_excel_with_summary(
                result_df,
                all_invoice_data,
                invoice_file_names,
                invoice_file_paths,
                ref_df,
                output_path
            )
            
            result['output_path'] = output_path
            result['save_result'] = save_result
            
            log(f"\n{'='*80}")
            log(f"✅ 批量核对完成！")
            log(f"{'='*80}")
            log(f"处理发票数：{len(invoice_paths)}")
            log(f"商品总数：{total_items_count}")
            log(f"价格一致：{matches['一致']}")
            log(f"价格不一致：{matches['不一致']}")
            log(f"未找到：{matches['未找到']}")
            log(f"{'='*80}")
            log(f"结果文件：{output_path}")
            
            result['success'] = True
            result['message'] = '批量核对完成'
            
        except Exception as e:
            log(f"\n❌ 错误：{str(e)}")
            import traceback
            log(traceback.format_exc())
            result['message'] = f'处理出错：{str(e)}'
        
        return result

