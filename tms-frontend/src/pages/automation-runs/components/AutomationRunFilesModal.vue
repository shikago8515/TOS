<template>
  <Teleport to="body">
    <transition name="arf-fade">
      <div v-if="open" class="arf-overlay" @click.self="closeModal">
        <transition name="arf-pop" appear>
          <section class="arf-modal" role="dialog" aria-modal="true" :aria-label="text('归档文件')">
            <header class="arf-modal__head">
              <div class="arf-modal__title">
                <span><AppIcon name="files" /></span>
                <div>
                  <h3>{{ text('归档文件') }}</h3>
                  <p>{{ subtitle }}</p>
                </div>
              </div>
              <button class="arf-icon-btn arf-icon-btn--close" type="button" :aria-label="text('关闭')" @click="closeModal">
                <AppIcon name="x" />
              </button>
            </header>

            <div class="arf-toolbar">
              <button class="arf-btn" type="button" :disabled="loading || !files.length || downloading" @click="toggleAll">
                <AppIcon name="check-circle" />
                {{ allSelected ? text('取消全选') : text('全选') }}
              </button>
              <button class="arf-btn arf-btn--primary" type="button" :disabled="loading || !selectedFiles.length || downloading" @click="downloadSelected">
                <AppIcon :name="downloading ? 'loader' : 'download'" :class="{ 'arf-spin': downloading }" />
                {{ selectedFiles.length ? `${text('下载已选')} ${selectedFiles.length}` : text('下载已选') }}
              </button>
              <button class="arf-btn" type="button" :disabled="loading || !files.length || downloading" @click="downloadAll">
                <AppIcon name="download" />
                {{ text('全量下载') }}
              </button>
            </div>

            <div v-if="loading" class="arf-empty arf-empty--loading">
              <AppIcon name="loader" class="arf-spin" />
              <strong>{{ text('正在读取归档文件') }}</strong>
              <p>{{ text('请稍候，文件列表会在这里更新。') }}</p>
            </div>

            <div v-else-if="!files.length" class="arf-empty">
              <AppIcon name="info" />
              <strong>{{ text('暂无归档文件') }}</strong>
              <p>{{ text('该执行记录还没有上传文件或结果文件。') }}</p>
            </div>

            <div v-else class="arf-list">
              <label v-for="file in files" :key="file.id" class="arf-file">
                <input v-model="selectedIds" type="checkbox" :value="file.id" :disabled="downloading" />
                <span class="arf-file__icon"><AppIcon name="files" /></span>
                <span class="arf-file__main">
                  <strong>{{ file.originalFilename || file.fileRole }}</strong>
                  <small>{{ fileRoleLabel(file.fileRole) }} · {{ formatSize(file.fileSize) }}</small>
                </span>
                <button class="arf-file__download" type="button" :disabled="downloading" :aria-label="text('下载')" @click.prevent="downloadOne(file)">
                  <AppIcon name="download" />
                </button>
              </label>
            </div>
          </section>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { showAppAlert } from '../../../shared/ui/appAlert'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import type { BackendTarget } from '../../../shared/api/backendClient'
import { downloadAutomationRunFile, type AutomationRunFileRecord } from '../../web-automation/webAutomationApi'

const props = withDefaults(defineProps<{
  open: boolean
  files: AutomationRunFileRecord[]
  loading?: boolean
  backendTarget?: BackendTarget
}>(), {
  backendTarget: 'default',
  loading: false,
})

const emit = defineEmits<{
  close: []
}>()

const { isEnglish, text } = useAppLanguage()
const selectedIds = ref<number[]>([])
const downloading = ref(false)

const selectedFiles = computed(() => props.files.filter((file) => selectedIds.value.includes(file.id)))
const allSelected = computed(() => props.files.length > 0 && selectedIds.value.length === props.files.length)
const subtitle = computed(() => {
  if (props.loading) return text('正在读取文件列表')
  if (!props.files.length) return text('暂无可下载文件')
  if (isEnglish.value) return `${props.files.length} archived files`
  return `${props.files.length} ${text('个文件可下载')}`
})

watch(
  () => props.open,
  (open) => {
    if (open) selectedIds.value = props.files.map((file) => file.id)
  },
)

watch(
  () => props.files,
  (files) => {
    if (props.open) {
      selectedIds.value = files.map((file) => file.id)
    } else {
      selectedIds.value = selectedIds.value.filter((id) => files.some((file) => file.id === id))
    }
  },
)

function closeModal(): void {
  if (downloading.value) return
  emit('close')
}

function toggleAll(): void {
  if (props.loading) return
  selectedIds.value = allSelected.value ? [] : props.files.map((file) => file.id)
}

async function downloadOne(file: AutomationRunFileRecord): Promise<void> {
  await downloadFiles([file])
}

async function downloadSelected(): Promise<void> {
  await downloadFiles(selectedFiles.value)
}

async function downloadAll(): Promise<void> {
  selectedIds.value = props.files.map((file) => file.id)
  await downloadFiles(props.files)
}

async function downloadFiles(files: AutomationRunFileRecord[]): Promise<void> {
  if (props.loading || downloading.value || !files.length) return
  downloading.value = true
  let downloaded = 0
  try {
    for (const file of files) {
      await downloadAutomationRunFile(file, props.backendTarget)
      downloaded += 1
      await new Promise((resolve) => window.setTimeout(resolve, 140))
    }
    void showAppAlert(isEnglish.value ? `Started downloading ${downloaded} files.` : `已开始下载 ${downloaded} 个文件。`, {
      tone: 'success',
      compact: true,
      autoCloseMs: 1200,
    })
  } catch (error) {
    void showAppAlert(readErrorMessage(error, text('执行文件下载失败。')), { tone: 'warning' })
  } finally {
    downloading.value = false
  }
}

function fileRoleLabel(role: string): string {
  const map: Record<string, string> = {
    source_excel: '上传 Excel',
    result_excel: '结果 Excel',
    result_json: '结果 JSON',
    failed_rows_excel: '失败明细',
    packing_list_pdf: '箱单 PDF',
    screenshot: '截图',
    log: '日志',
  }
  return map[role] ? text(map[role]) : role
}

function formatSize(size: number): string {
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return fallback
}
</script>

<style scoped>
.arf-overlay {
  position: fixed;
  inset: 0;
  z-index: 2002;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: transparent;
  pointer-events: none;
}

.arf-modal {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(640px, calc(100vw - 40px));
  height: min(560px, calc(100vh - 48px));
  min-height: min(440px, calc(100vh - 48px));
  padding: 20px;
  border-radius: var(--soft-radius, 16px);
  background: var(--soft-surface, #fff);
  box-shadow: 0 24px 70px rgba(15, 23, 42, .24);
}

.arf-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.arf-modal__title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  > span {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 13px;
    background: var(--soft-accent-light, #f0fdfa);
    color: var(--el-color-primary, #0f766e);
  }

  h3 {
    margin: 0;
    color: var(--soft-text, #1e293b);
    font-size: 17px;
  }

  p {
    margin: 3px 0 0;
    color: var(--soft-text-secondary, #64748b);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
}

.arf-icon-btn {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 11px;
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text-secondary, #64748b);
  cursor: pointer;
  transition: background .18s ease;

  &:hover {
    color: var(--soft-text, #1e293b);
    background: var(--border-color, #dcdfe6);
  }
}

.arf-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.arf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius-xs, 10px);
  background: var(--soft-surface, #fff);
  color: var(--soft-text, #1e293b);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease;

  &:hover:not(:disabled) {
    border-color: var(--el-color-primary, #0f766e);
    background: var(--soft-accent-light, #f0fdfa);
    color: var(--el-color-primary, #0f766e);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: .45;
  }

  :deep(.app-icon) {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
  }
}

.arf-btn--primary {
  border-color: var(--el-color-primary, #0f766e);
  background: var(--el-color-primary, #0f766e);
  color: #fff;

  &:hover:not(:disabled) {
    background: var(--el-color-primary-dark-2, #0b5f59);
    border-color: var(--el-color-primary-dark-2, #0b5f59);
    color: #fff;
  }
}

.arf-empty {
  display: grid;
  flex: 1;
  justify-items: center;
  align-content: center;
  gap: 7px;
  min-height: 0;
  padding: 34px 18px;
  border: 1px dashed var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius-sm, 12px);
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text-secondary, #64748b);
  text-align: center;

  :deep(.app-icon) {
    color: var(--soft-text-muted, #94a3b8);
    font-size: 24px;
  }

  strong {
    color: var(--soft-text, #1e293b);
    font-size: 13px;
  }

  p {
    margin: 0;
    font-size: 12px;
  }
}

.arf-empty--loading {
  background:
    radial-gradient(circle at 50% 38%, rgba(20, 184, 166, .13), transparent 34%),
    var(--soft-bg, #f0f4f8);
}

.arf-list {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 3px 2px 0;
}

.arf-file {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius-xs, 10px);
  background: var(--soft-surface, #fff);
  color: var(--soft-text, #1e293b);
  text-align: left;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease;

  &:hover {
    border-color: var(--el-color-primary, #0f766e);
    background: var(--soft-accent-light, #f0fdfa);
  }
}

.arf-file input {
  width: 16px;
  height: 16px;
  accent-color: var(--el-color-primary, #0f766e);
}

.arf-file__icon,
.arf-file__download {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 11px;
}

.arf-file__icon {
  display: grid;
  place-items: center;
  background: var(--soft-accent-light, #f0fdfa);
  color: var(--el-color-primary, #0f766e);
}

.arf-file__main {
  display: grid;
  gap: 3px;
  min-width: 0;
  flex: 1;

  strong,
  small {
    overflow-wrap: anywhere;
  }

  strong {
    color: var(--soft-text, #1e293b);
    font-size: 12px;
  }

  small {
    color: var(--soft-text-secondary, #64748b);
    font-size: 11px;
  }
}

.arf-file__download {
  display: grid;
  place-items: center;
  margin-left: auto;
  background: var(--soft-accent-light, #f0fdfa);
  color: var(--el-color-primary, #0f766e);
  border: 0;
  cursor: pointer;

  &:disabled {
    cursor: wait;
    opacity: .55;
  }
}

/* ── Transitions ── */
.arf-fade-enter-active,
.arf-fade-leave-active {
  transition: opacity .22s ease;
}

.arf-fade-enter-from,
.arf-fade-leave-to {
  opacity: 0;
}

.arf-pop-enter-active,
.arf-pop-leave-active {
  transition: opacity .22s ease, transform .22s cubic-bezier(.22, 1, .36, 1);
}

.arf-pop-enter-from,
.arf-pop-leave-to {
  opacity: 0;
  transform: scale(.97) translateY(-6px);
}

.arf-spin {
  animation: arf-spin .85s linear infinite;
}

@keyframes arf-spin {
  to { transform: rotate(360deg); }
}
</style>
