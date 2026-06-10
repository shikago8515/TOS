import { describe, expect, it } from 'vitest'

import {
  buildExecutorCredentialsPayload,
  canRunWithCredentials,
} from './webAutomationCredentials'

describe('webAutomationCredentials', () => {
  it('allows one-click execution when local credentials are stored', () => {
    expect(canRunWithCredentials({
      username: '',
      password: '',
      hasStoredCredentials: true,
      hasSelectedFile: true,
      sending: false,
    })).toBe(true)
  })

  it('requires a password when no local credentials are stored', () => {
    expect(canRunWithCredentials({
      username: 'user@example.com',
      password: '',
      hasStoredCredentials: false,
      hasSelectedFile: true,
      sending: false,
    })).toBe(false)
  })

  it('omits username and password from payload when stored credentials should be used', () => {
    expect(buildExecutorCredentialsPayload({
      username: 'saved-user',
      password: '',
      hasStoredCredentials: true,
    })).toEqual({})
  })

  it('includes typed credentials when the user enters a password', () => {
    expect(buildExecutorCredentialsPayload({
      username: 'typed-user',
      password: 'typed-password',
      hasStoredCredentials: true,
    })).toEqual({
      username: 'typed-user',
      password: 'typed-password',
    })
  })
})
