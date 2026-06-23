export interface ExecutorCredentialInput {
  username: string
  password: string
  hasStoredCredentials: boolean
}

export interface ExecutorRunCredentialState extends ExecutorCredentialInput {
  hasSelectedFile: boolean
  sending: boolean
}

export interface CredentialOptionLike {
  accountKey: string
  username: string
}

export const DEFAULT_INFOR_NEXUS_USERNAME = 'user3@@tmsfashion'

export function canRunWithCredentials(state: ExecutorRunCredentialState): boolean {
  if (state.sending || !state.hasSelectedFile) {
    return false
  }

  if (state.password.trim()) {
    return Boolean(state.username.trim())
  }

  return state.hasStoredCredentials
}

export function normalizeInforNexusUsername(value: string): string {
  const username = String(value || '').trim()
  return username === 'user3@tmsfashion' ? DEFAULT_INFOR_NEXUS_USERNAME : username
}

export function buildCredentialAccountKey(value: string): string {
  return normalizeInforNexusUsername(value) || 'default'
}

export function filterCredentialOptions<T extends CredentialOptionLike>(
  options: T[],
  query: string,
): T[] {
  const queryTerms = credentialSearchTerms(query)
  if (queryTerms.length === 0) {
    return options
  }

  return options.filter((option) => {
    const optionTerms = [
      ...credentialSearchTerms(option.accountKey),
      ...credentialSearchTerms(option.username),
    ]
    return queryTerms.some((queryTerm) => optionTerms.some((optionTerm) => optionTerm.includes(queryTerm)))
  })
}

export function findCredentialOptionByUsername<T extends CredentialOptionLike>(
  options: T[],
  value: string,
): T | null {
  const username = normalizeInforNexusUsername(value).toLowerCase()
  if (!username) {
    return null
  }

  return options.find((option) => {
    const optionUsername = normalizeInforNexusUsername(option.username).toLowerCase()
    const optionAccountKey = buildCredentialAccountKey(option.accountKey).toLowerCase()
    return optionUsername === username || optionAccountKey === username
  }) || null
}

function credentialSearchTerms(value: string): string[] {
  const raw = String(value || '').trim()
  if (!raw) {
    return []
  }

  return Array.from(new Set([
    raw,
    normalizeInforNexusUsername(raw),
  ].map((term) => term.toLowerCase()).filter(Boolean)))
}
