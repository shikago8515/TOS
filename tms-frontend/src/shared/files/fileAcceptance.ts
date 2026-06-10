export interface AcceptedFileResult<TFile extends { name: string }> {
  accepted: TFile[]
  rejectedNames: string[]
}

export function filterAcceptedFiles<TFile extends { name: string }>(
  files: readonly TFile[],
  accept: string | undefined,
): AcceptedFileResult<TFile> {
  const rules = parseAcceptRules(accept)
  if (rules.length === 0) {
    return {
      accepted: [...files],
      rejectedNames: [],
    }
  }

  const accepted: TFile[] = []
  const rejectedNames: string[] = []

  files.forEach((file) => {
    if (isAcceptedFile(file, rules)) {
      accepted.push(file)
    } else {
      rejectedNames.push(file.name)
    }
  })

  return { accepted, rejectedNames }
}

function parseAcceptRules(accept: string | undefined): string[] {
  return (accept ?? '')
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
}

function isAcceptedFile(file: { name: string }, rules: readonly string[]): boolean {
  const fileName = file.name.toLowerCase()

  return rules.some((rule) => {
    if (rule.startsWith('.')) {
      return fileName.endsWith(rule)
    }

    return true
  })
}
