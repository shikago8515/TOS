export interface ExecutorCredentialInput {
  username: string
  password: string
  hasStoredCredentials: boolean
}

export interface ExecutorRunCredentialState extends ExecutorCredentialInput {
  hasSelectedFile: boolean
  sending: boolean
}

export function canRunWithCredentials(state: ExecutorRunCredentialState): boolean {
  if (state.sending || !state.hasSelectedFile) {
    return false
  }

  if (state.password.trim()) {
    return Boolean(state.username.trim())
  }

  return state.hasStoredCredentials
}
