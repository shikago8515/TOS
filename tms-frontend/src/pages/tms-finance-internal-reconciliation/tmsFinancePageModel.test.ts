import { describe, expect, it } from 'vitest'

import {
  getTmsFinanceProcessByRoute,
  getTmsFinanceResultMetricValue,
} from './tmsFinancePageModel'

describe('tmsFinancePageModel', () => {
  it('uses backfill wording and metrics for the internal reconciliation route', () => {
    const process = getTmsFinanceProcessByRoute('tms-finance-internal-reconciliation')

    expect(process.id).toBe('internal-reconciliation')
    expect(process.label).toBe('内销对账表数据提取')
    expect(process.badge).toBe('2 组必传')
    expect(process.requiredGroups).toBe(2)
    expect(process.progressLabel).toBe('回填进度')
    expect(process.idleActionLabel).toBe('开始回填')
    expect(process.resultMetricLabel).toBe('回填行')
  })

  it('uses extraction wording and metrics for the Work Sales route', () => {
    const process = getTmsFinanceProcessByRoute('tms-finance-work-sales')

    expect(process.id).toBe('work-sales')
    expect(process.progressLabel).toBe('提取进度')
    expect(process.idleActionLabel).toBe('开始提取')
    expect(process.resultMetricLabel).toBe('提取行')
  })

  it('reads the active process result metric from summary items', () => {
    const process = getTmsFinanceProcessByRoute('tms-finance-work-sales')

    expect(
      getTmsFinanceResultMetricValue(
        [
          { label: '回填行', value: '12' },
          { label: '提取行', value: '34' },
        ],
        process,
      ),
    ).toBe('34')
  })
})
