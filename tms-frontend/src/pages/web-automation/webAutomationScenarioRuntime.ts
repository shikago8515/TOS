export type ExecutorReadinessAction =
  | 'sync-active-app-runtime'
  | 'start-active-app'
  | 'refresh-executor-state'

export interface ExecutorReadinessState {
  canSyncRuntime: boolean
  executorOk: boolean
}

export interface ActiveAppRuntimeSyncState {
  activeAppAvailable: boolean
  executorBusy: boolean
  hasEntry: boolean
}

export function canSyncActiveAppRuntime(state: ActiveAppRuntimeSyncState): boolean {
  return state.hasEntry && state.activeAppAvailable && !state.executorBusy
}

export function planExecutorReadinessActions(state: ExecutorReadinessState): ExecutorReadinessAction[] {
  if (!state.executorOk) {
    return ['start-active-app', 'refresh-executor-state']
  }

  return ['refresh-executor-state']
}
