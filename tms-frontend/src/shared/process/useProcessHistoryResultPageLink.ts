import { computed, type ComputedRef, type Ref } from 'vue'
import { useRouter } from 'vue-router'

import { buildProcessHistoryPersonRoute } from './processHistoryPeople'

type ModuleIdSource = string | Ref<string> | ComputedRef<string>

interface ProcessHistoryResultPageLinkOptions {
  moduleId: ModuleIdSource
  processing: Ref<boolean>
}

interface ProcessHistoryResultPageLinkState {
  historyResultToolbarTitle: ComputedRef<string>
  openHistoryResultPage: () => Promise<void>
}

export function useProcessHistoryResultPageLink(
  options: ProcessHistoryResultPageLinkOptions,
): ProcessHistoryResultPageLinkState {
  const router = useRouter()
  const currentModuleId = computed(() =>
    typeof options.moduleId === 'string' ? options.moduleId : options.moduleId.value,
  )
  const historyResultToolbarTitle = computed(() => {
    if (buildProcessHistoryPersonRoute(currentModuleId.value)) {
      return '查看近30天已归档的历史结果'
    }
    return '当前模块未配置历史结果页'
  })

  async function openHistoryResultPage(): Promise<void> {
    if (options.processing.value) return
    const target = buildProcessHistoryPersonRoute(currentModuleId.value)
    if (!target) return
    await router.push(target)
  }

  return {
    historyResultToolbarTitle,
    openHistoryResultPage,
  }
}
