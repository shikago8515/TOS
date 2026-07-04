import { describe, expect, it } from 'vitest'

import {
  canSyncActiveAppRuntime,
  planExecutorReadinessActions,
} from './webAutomationScenarioRuntime'

describe('webAutomationScenarioRuntime', () => {
  it('starts the active app without forced runtime sync before checking executor health', () => {
    expect(planExecutorReadinessActions({
      canSyncRuntime: true,
      executorOk: false,
    })).toEqual([
      'start-active-app',
      'refresh-executor-state',
    ])
  })

  it('starts the active app before checking executor health when no runtime sync is possible', () => {
    expect(planExecutorReadinessActions({
      canSyncRuntime: false,
      executorOk: false,
    })).toEqual([
      'start-active-app',
      'refresh-executor-state',
    ])
  })

  it('only refreshes executor health when the executor is already connected', () => {
    expect(planExecutorReadinessActions({
      canSyncRuntime: false,
      executorOk: true,
    })).toEqual(['refresh-executor-state'])
  })

  it('allows runtime sync only when an entry exists, the app is available, and the executor is idle', () => {
    expect(canSyncActiveAppRuntime({
      hasEntry: true,
      activeAppAvailable: true,
      executorBusy: false,
    })).toBe(true)

    expect(canSyncActiveAppRuntime({
      hasEntry: false,
      activeAppAvailable: true,
      executorBusy: false,
    })).toBe(false)
    expect(canSyncActiveAppRuntime({
      hasEntry: true,
      activeAppAvailable: false,
      executorBusy: false,
    })).toBe(false)
    expect(canSyncActiveAppRuntime({
      hasEntry: true,
      activeAppAvailable: true,
      executorBusy: true,
    })).toBe(false)
  })
})
