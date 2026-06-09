export interface FileGroupState {
  label: string
  files: File[]
  required: boolean
  multiple: boolean
  expectedCount?: number
}

export type FileGroupStatus = 'ready' | 'warning' | 'error' | 'empty'

export interface FileGroupPrecheck {
  label: string
  files: File[]
  status: FileGroupStatus
  message: string
  issues: string[]
}

export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function buildFilePrechecks(groups: readonly FileGroupState[]): FileGroupPrecheck[] {
  return groups.map((group) => {
    const issues: string[] = []

    if (group.required && group.files.length === 0) {
      issues.push('必传文件未上传')
    }

    if (!group.multiple && group.files.length > 1) {
      issues.push('该位置只允许上传 1 个文件')
    }

    if (group.expectedCount && group.files.length > 0 && group.files.length !== group.expectedCount) {
      issues.push(`应上传 ${group.expectedCount} 个文件`)
    }

    if (issues.length > 0) {
      return {
        label: group.label,
        files: group.files,
        status: group.files.length === 0 ? 'empty' : 'error',
        message: issues[0],
        issues,
      }
    }

    if (group.files.length === 0) {
      return {
        label: group.label,
        files: group.files,
        status: 'warning',
        message: '暂未上传文件',
        issues,
      }
    }

    return {
      label: group.label,
      files: group.files,
      status: 'ready',
      message: `${group.files.length} 个文件已就绪`,
      issues,
    }
  })
}

export function areRequiredFilesReady(groups: readonly FileGroupState[]): boolean {
  const prechecks = buildFilePrechecks(groups)

  return prechecks.every((precheck, index) => {
    const group = groups[index]

    return group.required ? precheck.status === 'ready' : precheck.status !== 'error'
  })
}

export function serializeInputFiles(groups: readonly FileGroupState[]): string[] {
  return groups.flatMap((group) =>
    group.files.map((file) => `${group.label}: ${file.name}`),
  )
}
