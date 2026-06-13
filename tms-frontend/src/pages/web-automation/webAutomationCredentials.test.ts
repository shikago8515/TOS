import { describe, expect, it } from 'vitest'

import {
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
  it('allows execution with newly typed credentials before they are saved', () => {
    expect(canRunWithCredentials({
      username: 'typed-user',
      password: 'typed-password',
      hasStoredCredentials: false,
      hasSelectedFile: true,
      sending: false,
    })).toBe(true)
  })
})
