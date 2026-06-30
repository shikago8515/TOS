import { describe, expect, it } from 'vitest'

import {
  findHomeModuleByActivityId,
  findHomePersonByModuleId,
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
})
