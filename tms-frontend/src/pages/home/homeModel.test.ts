import { describe, expect, it } from 'vitest'

import {
  findHomeModuleByActivityId,
  findHomePersonByModuleId,
  homeDashboardHistoryModules,
  homeDashboardHistoryModuleIds,
  homePeople,
} from './homeModel'

describe('homeModel', () => {
  it('keeps people groups aligned with the left navigation owner model', () => {
    const labels = homePeople.map((entry) => entry.label)

    expect(labels).toEqual(['Jessica', 'Sophia', 'Jane', 'Eric', 'Jason', 'Lucia'])
  })

  it('resolves Jason PDF reorder to the Jason owner and canonical route', () => {
    const module = findHomeModuleByActivityId('jason-pdf-reorder')
    const person = findHomePersonByModuleId('jason-pdf-reorder')

    expect(module?.path).toBe('/jason/pdf-reorder')
    expect(module?.routeName).toBe('jason-pdf-reorder')
    expect(person?.label).toBe('Jason')
  })

  it('uses the Eric Infornexus canonical owner instead of legacy Jessica routes', () => {
    const module = findHomeModuleByActivityId('eric-infornexus')
    const person = findHomePersonByModuleId('eric-infornexus')
    const legacyModule = findHomeModuleByActivityId('jessica-infornexus')

    expect(module?.path).toBe('/eric-infornexus')
    expect(module?.routeName).toBe('eric-infornexus')
    expect(person?.label).toBe('Eric')
    expect(legacyModule).toBeUndefined()
  })

  it('resolves process history module ids to the owning home person and catalog route', () => {
    const cases = [
      ['pdf-draft-packing-compare', '/draft-packing-compare', 'Jessica'],
      ['excel-jane-bom-compare', '/jane-bom-compare', 'Jane'],
      ['excel-sophia-tina', '/sophia-tina', 'Sophia'],
      ['excel-tms-finance-work-sales', '/tms-finance-work-sales', 'Lucia'],
    ] as const

    for (const [historyModuleId, path, personLabel] of cases) {
      expect(findHomeModuleByActivityId(historyModuleId)?.path).toBe(path)
      expect(findHomePersonByModuleId(historyModuleId)?.label).toBe(personLabel)
    }
  })

  it('uses canonical history module ids when building the dashboard module list', () => {
    const historyModuleIds = homeDashboardHistoryModules.map((module) => module.id)

    expect(historyModuleIds).toContain('pdf-draft-packing-compare')
    expect(historyModuleIds).toContain('excel-jane-bom-compare')
    expect(historyModuleIds).toContain('excel-sophia-tina')
    expect(historyModuleIds).toContain('excel-tms-finance-work-sales')
    expect(historyModuleIds).not.toContain('draft-packing-compare')
    expect(historyModuleIds).not.toContain('jane-bom-compare')
    expect(historyModuleIds).not.toContain('sophia-tina')
    expect(historyModuleIds).not.toContain('tms-finance-work-sales')
  })

  it('queries process-history usage with canonical ids and legacy archive ids', () => {
    expect(homeDashboardHistoryModuleIds).toEqual(expect.arrayContaining([
      'excel-jessca',
      'jessca',
      'pdf-draft-packing-compare',
      'draft-packing-compare',
      'excel-jane',
      'jane',
      'excel-jane-bom-summary',
      'jane-bom-summary',
      'excel-sophia-tina',
      'sophia-tina',
      'excel-tms-finance-work-sales',
      'tms-finance-work-sales',
    ]))
  })
})
