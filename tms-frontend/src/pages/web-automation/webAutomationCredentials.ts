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

export function buildExecutorCredentialsPayload(
  state: ExecutorCredentialInput,
): Record<string, string> {
  const password = state.password.trim()
  if (password) {
    return {
      username: state.username.trim(),
      password,
    }
  }

  if (state.hasStoredCredentials) {
    return {}
  }

  return {
    username: state.username.trim(),
    password: '',
  }
}
