import { describe, expect, it } from 'vitest'

import {
  buildTmsFinanceProcessErrorSummary,
  getTmsFinanceProcessByRoute,
  getTmsFinanceResultMetricValue,
} from './tmsFinancePageModel'

describe('tmsFinancePageModel', () => {
  it('uses append wording and metrics for the internal reconciliation route', () => {
    const process = getTmsFinanceProcessByRoute('tms-finance-internal-reconciliation')

    expect(process.id).toBe('internal-reconciliation')
    expect(process.label).toBe('内销对账单数据写入')
    expect('subtitle' in process).toBe(false)
    expect(process.badge).toBe('2 组必传')
    expect(process.requiredGroups).toBe(2)
    expect(process.progressLabel).toBe('追加进度')
    expect(process.idleActionLabel).toBe('开始追加')
    expect(process.resultMetricLabel).toBe('追加行')
  })

  it('uses fill wording and metrics for the Work Sales route', () => {
    const process = getTmsFinanceProcessByRoute('tms-finance-work-sales')

    expect(process.id).toBe('work-sales')
    expect(process.label).toBe('Turnover数据写入')
    expect('subtitle' in process).toBe(false)
    expect(process.requiredGroups).toBe(2)
    expect(process.progressLabel).toBe('写入进度')
    expect(process.idleActionLabel).toBe('开始写入')
    expect(process.resultMetricLabel).toBe('写入行')
  })

  it('reads the active process result metric from summary items', () => {
    const process = getTmsFinanceProcessByRoute('tms-finance-work-sales')

    expect(
      getTmsFinanceResultMetricValue(
        [
          { label: '回填行', value: '12' },
          { label: '写入行', value: '56' },
          { label: '提取行', value: '34' },
        ],
        process,
      ),
    ).toBe('56')
  })

  it('prioritizes stale backend version details in failure summaries', () => {
    const message = '当前后端版本未更新：后端为 0.9.8-beta.3.17，前端为 0.9.8-beta.3.18，请重启本地后端。'

    expect(buildTmsFinanceProcessErrorSummary(message)).toEqual([
      {
        label: '后端版本',
        value: '未更新',
        note: message,
      },
    ])
  })

  it('keeps the generic diagnostic summary for normal processing errors', () => {
    expect(buildTmsFinanceProcessErrorSummary('处理失败，请稍后重试')).toEqual([
      {
        label: '处理状态',
        value: '失败',
        note: '可导出诊断包发给开发排查',
      },
    ])
  })
})
