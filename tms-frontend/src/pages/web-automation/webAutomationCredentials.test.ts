import { describe, expect, it } from 'vitest'

import {
  DEFAULT_INFOR_NEXUS_USERNAME,
  canRunWithCredentials,
  normalizeInforNexusUsername,
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

  it('uses the double-at Infor Nexus default username for the TMS Fashion account', () => {
    expect(DEFAULT_INFOR_NEXUS_USERNAME).toBe('user3@@tmsfashion')
    expect(normalizeInforNexusUsername('user3@tmsfashion')).toBe(DEFAULT_INFOR_NEXUS_USERNAME)
    expect(normalizeInforNexusUsername(' user3@@tmsfashion ')).toBe(DEFAULT_INFOR_NEXUS_USERNAME)
  })

  it('trims other Infor Nexus usernames without rewriting them', () => {
    expect(normalizeInforNexusUsername(' other-user ')).toBe('other-user')
    expect(normalizeInforNexusUsername('user@example.com')).toBe('user@example.com')
  })
})
