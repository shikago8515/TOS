
# -*- coding: utf-8 -*-
"""
TMS 工具 - 文件工具模块
创建时间: 2026-05-18
"""

import os
from typing import List, Optional
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side


def ensure_dir(dir_path):
    """确保目录存在，不存在则创建"""
    if not os.path.exists(dir_path):
        os.makedirs(dir_path, exist_ok=True)


def get_file_extension(file_path):
    """获取文件扩展名（小写）"""
    return os.path.splitext(file_path)[1].lower()


def create_thin_border():
    """创建通用的细边框样式"""
    return Border(
        left=Side(style='thin', color='00000000'),
        right=Side(style='thin', color='00000000'),
        top=Side(style='thin', color='00000000'),
        bottom=Side(style='thin', color='00000000')
    )


def adjust_column_widths(ws, max_widths=None):
    """
    自动调整Excel列宽
    max_widths: 可选，指定列的最大宽度，{列索引: 最大宽度}
    """
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

