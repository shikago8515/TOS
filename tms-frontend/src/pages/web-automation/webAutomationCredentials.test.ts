import { describe, expect, it } from 'vitest'

import {
  DEFAULT_INFOR_NEXUS_USERNAME,
  buildCredentialAccountKey,
  canRunWithCredentials,
  filterCredentialOptions,
  findCredentialOptionByUsername,
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

  it('uses the normalized user id as the saved credential account key', () => {
    expect(buildCredentialAccountKey(' user3@tmsfashion ')).toBe(DEFAULT_INFOR_NEXUS_USERNAME)
    expect(buildCredentialAccountKey('  ')).toBe('default')
  })

  it('filters saved credentials by account key or username without case sensitivity', () => {
    const options = [
      { accountKey: 'domestic', username: 'user3@@tmsfashion', hasStoredCredentials: true },
      { accountKey: 'foreign', username: 'jessica@example.com', hasStoredCredentials: true },
      { accountKey: 'backup', username: 'backup-user', hasStoredCredentials: true },
    ]

    expect(filterCredentialOptions(options, 'JES')).toEqual([options[1]])
    expect(filterCredentialOptions(options, 'for')).toEqual([options[1]])
    expect(filterCredentialOptions(options, '')).toEqual(options)
  })

  it('finds a saved credential when the typed username matches after normalization', () => {
    const options = [
      { accountKey: DEFAULT_INFOR_NEXUS_USERNAME, username: DEFAULT_INFOR_NEXUS_USERNAME, hasStoredCredentials: true },
      { accountKey: 'foreign', username: 'jessica@example.com', hasStoredCredentials: true },
    ]

    expect(findCredentialOptionByUsername(options, 'user3@tmsfashion')).toBe(options[0])
    expect(findCredentialOptionByUsername(options, ' missing ')).toBeNull()
  })

  it('keeps single-at saved usernames searchable after double-at display normalization', () => {
    const options = [
      { accountKey: 'default', username: 'user3@tmsfashion', hasStoredCredentials: true },
    ]

    expect(filterCredentialOptions(options, 'user3@@')).toEqual(options)
    expect(filterCredentialOptions(options, DEFAULT_INFOR_NEXUS_USERNAME)).toEqual(options)
  })
})
