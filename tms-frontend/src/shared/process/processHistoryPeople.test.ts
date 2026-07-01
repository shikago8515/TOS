import { describe, expect, it } from 'vitest'

import {
  buildProcessHistoryPersonRoute,
  findProcessHistoryModuleByModuleId,
  findProcessHistoryPersonByModuleId,
  getProcessHistoryModulesForPerson,
} from './processHistoryPeople'

describe('processHistoryPeople', () => {
  it('maps finance Excel modules to Lucia history pages', () => {
    const person = findProcessHistoryPersonByModuleId('tms-finance-work-sales')

    expect(person?.id).toBe('lucia')
    expect(buildProcessHistoryPersonRoute('tms-finance-work-sales')).toEqual({
      path: '/process-history/lucia',
      query: { moduleId: 'excel-tms-finance-work-sales' },
    })
  })

  it('returns history module ids for the selected person', () => {
    const modules = getProcessHistoryModulesForPerson('jane').map((module) => module.id)

    expect(modules).toContain('excel-jane')
    expect(modules).toContain('excel-jane-bom-compare')
    expect(modules).toContain('excel-jane-outbound-compare')
    expect(modules).not.toContain('jane-infornexus')
    expect(modules).not.toContain('jason-pdf-reorder')
  })

  it('supports route catalog ids as aliases for history page lookup', () => {
    const person = findProcessHistoryPersonByModuleId('jane-bom-compare')

    expect(person?.id).toBe('jane')
    expect(buildProcessHistoryPersonRoute('jane-bom-compare')).toEqual({
      path: '/process-history/jane',
      query: { moduleId: 'excel-jane-bom-compare' },
    })
    expect(buildProcessHistoryPersonRoute('excel-jane-bom-compare')).toEqual({
      path: '/process-history/jane',
      query: { moduleId: 'excel-jane-bom-compare' },
    })
  })

  it('resolves all Excel history ids back to their catalog route metadata', () => {
    const cases = [
      ['excel-jessca', '/jessca'],
      ['excel-sophia-tina', '/sophia-tina'],
      ['excel-jane', '/jane'],
      ['excel-jane-bom-summary', '/jane-bom-summary'],
      ['excel-jane-bom-compare', '/jane-bom-compare'],
      ['excel-jane-outbound-compare', '/jane-outbound-compare'],
      ['eric', '/eric'],
      ['iplex-dual-table-compare', '/iplex/dual-table-compare'],
      ['excel-tms-finance-internal-reconciliation', '/tms-finance-internal-reconciliation'],
      ['excel-tms-finance-work-sales', '/tms-finance-work-sales'],
      ['excel-template-mapper-test', '/excel-template-mapper-test'],
      ['pdf-draft-packing-compare', '/draft-packing-compare'],
    ] as const

    for (const [historyModuleId, path] of cases) {
      expect(findProcessHistoryModuleByModuleId(historyModuleId)?.path).toBe(path)
    }
  })
})
