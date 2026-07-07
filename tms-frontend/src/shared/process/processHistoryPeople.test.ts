import { describe, expect, it } from 'vitest'

import {
  buildProcessHistoryPersonRoute,
  findProcessHistoryModuleByModuleId,
  findProcessHistoryPersonByModuleId,
  getProcessHistoryModuleIdsForQuery,
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

  it('maps Jason Result Set Excel to the Jason history page', () => {
    const modules = getProcessHistoryModulesForPerson('jason').map((module) => module.id)
    const person = findProcessHistoryPersonByModuleId('jason-result-set-excel')

    expect(person?.id).toBe('jason')
    expect(modules).toContain('jason-result-set-excel')
    expect(modules).not.toContain('jason-pdf-reorder')
    expect(buildProcessHistoryPersonRoute('jason-result-set-excel')).toEqual({
      path: '/process-history/jason',
      query: { moduleId: 'jason-result-set-excel' },
    })
    expect(getProcessHistoryModuleIdsForQuery('jason-result-set-excel')).toEqual([
      'jason-result-set-excel',
    ])
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

  it('queries mapped result history by canonical ids and legacy archive ids', () => {
    const cases = [
      ['excel-jessca', 'jessca'],
      ['pdf-draft-packing-compare', 'draft-packing-compare'],
      ['excel-jane', 'jane'],
      ['excel-jane-bom-summary', 'jane-bom-summary'],
      ['excel-jane-bom-compare', 'jane-bom-compare'],
      ['excel-jane-outbound-compare', 'jane-outbound-compare'],
      ['excel-sophia-tina', 'sophia-tina'],
      ['excel-tms-finance-internal-reconciliation', 'tms-finance-internal-reconciliation'],
      ['excel-tms-finance-work-sales', 'tms-finance-work-sales'],
    ] as const

    for (const [historyModuleId, legacyModuleId] of cases) {
      expect(findProcessHistoryModuleByModuleId(legacyModuleId)?.id).toBe(historyModuleId)
      expect(getProcessHistoryModuleIdsForQuery(historyModuleId)).toEqual([historyModuleId, legacyModuleId])
      expect(getProcessHistoryModuleIdsForQuery(legacyModuleId)).toEqual([historyModuleId, legacyModuleId])
    }
  })

  it('does not duplicate query ids for modules that already use their history id', () => {
    expect(getProcessHistoryModuleIdsForQuery('eric')).toEqual(['eric'])
    expect(getProcessHistoryModuleIdsForQuery('iplex-dual-table-compare')).toEqual(['iplex-dual-table-compare'])
    expect(getProcessHistoryModuleIdsForQuery('excel-template-mapper-test')).toEqual(['excel-template-mapper-test'])
    expect(getProcessHistoryModuleIdsForQuery('jason-result-set-excel')).toEqual(['jason-result-set-excel'])
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
      ['jason-result-set-excel', '/jason/result-set-excel'],
      ['excel-template-mapper-test', '/excel-template-mapper-test'],
      ['pdf-draft-packing-compare', '/draft-packing-compare'],
    ] as const

    for (const [historyModuleId, path] of cases) {
      expect(findProcessHistoryModuleByModuleId(historyModuleId)?.path).toBe(path)
    }
  })
})
