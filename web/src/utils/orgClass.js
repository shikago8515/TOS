export function splitDepartmentAndClass(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    return { department: '', className: '' }
  }

  const separators = [' / ', '／', '/', '｜', '|']
  for (const separator of separators) {
    if (!raw.includes(separator)) {
      continue
    }
    const parts = raw.split(separator).map(item => item.trim()).filter(Boolean)
    if (parts.length >= 2) {
      return {
        department: parts[0],
        className: parts.slice(1).join(' / ')
      }
    }
  }

  return { department: raw, className: '' }
}

export function getDepartmentText(value, fallback = '-') {
  const parsed = splitDepartmentAndClass(value)
  return parsed.department || (typeof value === 'string' ? value.trim() : '') || fallback
}

export function getClassText(rowOrClassName, fallback = '-') {
  if (rowOrClassName && typeof rowOrClassName === 'object') {
    if (rowOrClassName.className) {
      return rowOrClassName.className
    }
    const parsed = splitDepartmentAndClass(rowOrClassName.department)
    return parsed.className || fallback
  }

  const parsed = splitDepartmentAndClass(rowOrClassName)
  return parsed.className || fallback
}
