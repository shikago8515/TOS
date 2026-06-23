export interface ExecutorCredentialInput {
  username: string
  password: string
  hasStoredCredentials: boolean
}

export interface ExecutorRunCredentialState extends ExecutorCredentialInput {
  hasSelectedFile: boolean
  sending: boolean
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
