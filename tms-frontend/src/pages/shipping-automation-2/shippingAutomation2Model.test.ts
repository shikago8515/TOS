import { describe, expect, it } from 'vitest'

import {
  releasedBulkDefaultUsername,
  resolveReleasedBulkCredentialUsername,
} from './shippingAutomation2Model'

describe('shippingAutomation2Model', () => {
  it('uses the Jane released Bulk account as the default User ID', () => {
    expect(releasedBulkDefaultUsername).toBe('user7@@tmsfashion')
    expect(resolveReleasedBulkCredentialUsername('')).toBe(releasedBulkDefaultUsername)
    expect(resolveReleasedBulkCredentialUsername('  saved-user  ')).toBe('saved-user')
  })
})
