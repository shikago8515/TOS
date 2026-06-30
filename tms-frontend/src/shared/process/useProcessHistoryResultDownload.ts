import { computed, type ComputedRef, type Ref } from 'vue'

import { readErrorMessage } from '../api/backendClient'
import {
  downloadProcessHistoryResult,
  findLatestDownloadableHistoryRecord,
  type ProcessHistoryRecord,
} from './processHistory'

interface ProcessHistoryResultDownloadOptions {
  historyRecords: Ref<ProcessHistoryRecord[]>
  processing: Ref<boolean>
  onError: (message: string) => void
}

interface ProcessHistoryResultDownloadState {
  hasProcessHistoryRecords: ComputedRef<boolean>
  latestHistoryResultRecord: ComputedRef<ProcessHistoryRecord | null>
  historyResultToolbarTitle: ComputedRef<string>
  downloadLatestHistoryResult: () => Promise<void>
}

export function useProcessHistoryResultDownload(
  options: ProcessHistoryResultDownloadOptions,
): ProcessHistoryResultDownloadState {
  const latestHistoryResultRecord = computed(() =>
    findLatestDownloadableHistoryRecord(options.historyRecords.value),
  )
  const hasProcessHistoryRecords = computed(() => options.historyRecords.value.length > 0)
  const historyResultToolbarTitle = computed(() => {
    if (latestHistoryResultRecord.value) {
      return '下载最近一次已归档的历史结果。'
    }
    return readLatestHistoryWarning(options.historyRecords.value)
      || '历史结果未归档；请确认服务器归档配置后重新处理。'
  })

  async function downloadLatestHistoryResult(): Promise<void> {
    if (options.processing.value || !latestHistoryResultRecord.value) {
      return
    }
    try {
      await downloadProcessHistoryResult(latestHistoryResultRecord.value)
    } catch (error) {
      options.onError(readErrorMessage(error, '历史结果文件下载失败，请稍后重试。'))
    }
  }

  return {
    hasProcessHistoryRecords,
    latestHistoryResultRecord,
    historyResultToolbarTitle,
    downloadLatestHistoryResult,
  }
}

function readLatestHistoryWarning(records: readonly ProcessHistoryRecord[]): string {
  for (const record of records) {
    const warning = record.historyWarnings?.find((item) => item.trim().length > 0)
    if (warning) {
      return warning
    }
  }
  return ''
}
