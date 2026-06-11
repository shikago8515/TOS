import { describe, expect, it } from 'vitest'

import {
  getTmsFinanceProcessByRoute,
  getTmsFinanceResultMetricValue,
} from './tmsFinancePageModel'

describe('tmsFinancePageModel', () => {
  it('uses append wording and metrics for the internal reconciliation route', () => {
    const process = getTmsFinanceProcessByRoute('tms-finance-internal-reconciliation')

    expect(process.id).toBe('internal-reconciliation')
    expect(process.label).toBe('内销对账表数据提取')
    expect(process.badge).toBe('2 组必传')
    expect(process.requiredGroups).toBe(2)
    expect(process.progressLabel).toBe('追加进度')
    expect(process.idleActionLabel).toBe('开始追加')
    expect(process.resultMetricLabel).toBe('追加行')
  })

  it('uses append wording and metrics for the Work Sales route', () => {
    const process = getTmsFinanceProcessByRoute('tms-finance-work-sales')

    expect(process.id).toBe('work-sales')
    expect(process.requiredGroups).toBe(2)
    expect(process.progressLabel).toBe('追加进度')
    expect(process.idleActionLabel).toBe('开始追加')
    expect(process.resultMetricLabel).toBe('追加行')
  })

  it('reads the active process result metric from summary items', () => {
    const process = getTmsFinanceProcessByRoute('tms-finance-work-sales')

    expect(
      getTmsFinanceResultMetricValue(
        [
          { label: '回填行', value: '12' },
          { label: '追加行', value: '56' },
          { label: '提取行', value: '34' },
        ],
        process,
      ),
    ).toBe('56')
  })
})
