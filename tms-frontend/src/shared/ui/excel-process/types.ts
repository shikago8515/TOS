import type { FileGroupState } from '../../files/fileGroups'

export type ExcelProcessTone = 'blue' | 'teal' | 'green' | 'orange' | 'slate'

export type ExcelNoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface ExcelPageStat {
  id: string
  label: string
  value: string | number
  icon?: string
  iconText?: string
  tone?: ExcelProcessTone
}

export interface ExcelToolbarAction {
  id: string
  label: string
  icon?: string
  primary?: boolean
  disabled?: boolean
  visible?: boolean
  onClick: () => void | Promise<void>
}

export interface ExcelFileField {
  id: string
  label: string
  files: File[]
  hint?: string
  multiple?: boolean
  required?: boolean
  accept?: string
  acceptLabel?: string
  expectedCount?: number
}

export function buildExcelFileGroups(fields: readonly ExcelFileField[]): FileGroupState[] {
  return fields.map((field) => ({
    label: field.label,
    files: field.files,
    required: field.required ?? true,
    multiple: field.multiple ?? false,
    expectedCount: field.expectedCount,
  }))
}
