export function getNextUploadFiles(
  currentFiles: readonly File[],
  incomingFiles: readonly File[],
  multiple: boolean,
): File[] {
  if (incomingFiles.length === 0) {
    return [...currentFiles]
  }

  return multiple ? [...incomingFiles] : incomingFiles.slice(0, 1)
}

export function hasDraggedFiles(types: DOMStringList | readonly string[] | null | undefined): boolean {
  if (!types) {
    return false
  }

  return Array.from(types).includes('Files')
}
