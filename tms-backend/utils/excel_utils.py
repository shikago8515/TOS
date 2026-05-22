
# -*- coding: utf-8 -*-
"""
TMS 工具 - Excel 工具模块
创建时间: 2026-05-18
"""
import openpyxl
import xlrd
import pandas as pd
from abc import ABC, abstractmethod


def safe_float(value):
    """
    安全转换为float，处理None、字符串等各种类型
    如果转换失败，返回0.0
    """
    if value is None:
        return 0.0
    try:
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                return 0.0
            return float(cleaned)
        return float(value)
    except (ValueError, TypeError):
        return 0.0


class ExcelRowAdapter(ABC):
    """Excel行数据适配器基类，统一不同Excel库的数据访问接口"""

    @abstractmethod
    def get_row_count(self):
        """获取总行数"""
        pass

    @abstractmethod
    def get_cell_value(self, row_idx, col_idx):
        """获取指定单元格的值"""
        pass

    @abstractmethod
    def get_col_count(self, row_idx):
        """获取指定行的列数"""
        pass

    @abstractmethod
    def close(self):
        """关闭工作簿（如果需要）"""
        pass


class XlrdAdapter(ExcelRowAdapter):
    """xlrd库适配器，用于处理.xls格式"""

    def __init__(self, workbook, sheet):
        self.workbook = workbook
        self.sheet = sheet

    def get_row_count(self):
        return self.sheet.nrows

    def get_cell_value(self, row_idx, col_idx):
        if col_idx < self.sheet.ncols:
            return self.sheet.cell_value(row_idx, col_idx)
        return None

    def get_col_count(self, row_idx):
        return self.sheet.ncols

    def close(self):
        pass


class OpenpyxlAdapter(ExcelRowAdapter):
    """openpyxl库适配器，用于处理.xlsx格式"""

    def __init__(self, workbook, sheet):
        self.workbook = workbook
        self.sheet = sheet
        self._rows = list(sheet.iter_rows(values_only=True))

    def get_row_count(self):
        return len(self._rows)

    def get_cell_value(self, row_idx, col_idx):
        if row_idx < len(self._rows):
            row = self._rows[row_idx]
            if col_idx < len(row):
                return row[col_idx]
        return None

    def get_col_count(self, row_idx):
        if row_idx < len(self._rows):
            return len(self._rows[row_idx])
        return 0

    def close(self):
        self.workbook.close()

