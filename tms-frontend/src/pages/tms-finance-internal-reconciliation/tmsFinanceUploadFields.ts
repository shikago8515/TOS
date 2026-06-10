import type { ExcelFileField } from '../../shared/ui/excel-process'
import type { TmsFinanceProcessId } from './tmsFinancePageModel'

export interface TmsFinanceUploadFileState {
  internalSourceFiles: File[]
  reconciliationTargetFiles: File[]
  iplixFiles: File[]
  workSalesReferenceFiles: File[]
}

export function buildTmsFinanceUploadFields(
  processId: TmsFinanceProcessId,
  files: TmsFinanceUploadFileState,
): ExcelFileField[] {
  if (processId === 'work-sales') {
    return [
      {
        id: 'iplix',
        label: 'iPlix 导出 Excel',
        files: files.iplixFiles,
        hint: '上传包含 Turnover Details Sheet 的 iPlix 导出文件',
        accept: '.xls,.xlsx,.xlsm',
        acceptLabel: '支持 .xls / .xlsx / .xlsm',
        expectedCount: 1,
      },
      {
        id: 'work-sales-reference',
        label: '补充参考表',
        files: files.workSalesReferenceFiles,
        hint: '选填；上传含 Buyer、Factory、Customer 及 SAS/Promo/Upcharge 的匹配表',
        accept: '.xls,.xlsx,.xlsm',
        acceptLabel: '支持 .xls / .xlsx / .xlsm',
        expectedCount: 1,
        required: false,
      },
    ]
  }

  return [
    {
      id: 'internal-sources',
      label: 'Sample/Bulk 来源文件',
      files: files.internalSourceFiles,
      hint: '可一次上传多个合并Sample、合并BULK工作簿，按上传顺序回填',
      multiple: true,
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
    },
    {
      id: 'target',
      label: '内销对账单',
      files: files.reconciliationTargetFiles,
      hint: '上传要回填未清账尾部已有行的内销对账大表',
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
      expectedCount: 1,
    },
  ]
}
