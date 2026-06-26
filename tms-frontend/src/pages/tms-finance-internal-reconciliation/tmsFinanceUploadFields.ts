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
        label: 'iPLEX 导出表',
        files: files.workSalesBulkSalesFiles,
        accept: '.xls,.xlsx,.xlsm',
        acceptLabel: '支持 .xls / .xlsx / .xlsm',
        expectedCount: 1,
      },
      {
        id: 'work-sales-turnover',
        label: 'Turnover Excel',
        files: files.workSalesTurnoverFiles,
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
      multiple: true,
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
    },
    {
      id: 'target',
      label: '内销对账单',
      files: files.reconciliationTargetFiles,
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
      expectedCount: 1,
    },
  ]
}
