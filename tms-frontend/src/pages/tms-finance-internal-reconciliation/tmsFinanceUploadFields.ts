import type { ExcelFileField } from '../../shared/ui/excel-process'
import type { TmsFinanceProcessId } from './tmsFinancePageModel'

export interface TmsFinanceUploadFileState {
  internalSourceFiles: File[]
  reconciliationTargetFiles: File[]
  workSalesBulkSalesFiles: File[]
  workSalesTurnoverFiles: File[]
}

export function buildTmsFinanceUploadFields(
  processId: TmsFinanceProcessId,
  files: TmsFinanceUploadFileState,
): ExcelFileField[] {
  if (processId === 'work-sales') {
    return [
      {
        id: 'work-sales-bulk-sales',
        label: 'BULK Sales 导出表',
        files: files.workSalesBulkSalesFiles,
        hint: '上传从 iPlex 导出的 bulk sales 表，系统会读取对应列追加到 TURNOVER',
        accept: '.xls,.xlsx,.xlsm',
        acceptLabel: '支持 .xls / .xlsx / .xlsm',
        expectedCount: 1,
      },
      {
        id: 'work-sales-turnover',
        label: 'TURNOVER 目标表',
        files: files.workSalesTurnoverFiles,
        hint: '上传要追加 Turnover Details 明细的 TURNOVER 工作簿',
        accept: '.xlsx,.xlsm',
        acceptLabel: '支持 .xlsx / .xlsm',
        expectedCount: 1,
      },
    ]
  }

  return [
    {
      id: 'internal-sources',
      label: 'Sample/Bulk 来源文件',
      files: files.internalSourceFiles,
      hint: '可一次上传多个合并Sample、合并BULK工作簿，按上传顺序追加缺失行',
      multiple: true,
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
    },
    {
      id: 'target',
      label: '内销对账单',
      files: files.reconciliationTargetFiles,
      hint: '上传要追加缺失数据的内销对账大表',
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
      expectedCount: 1,
    },
  ]
}
