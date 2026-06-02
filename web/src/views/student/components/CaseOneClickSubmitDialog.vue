<template>
  <el-dialog
    v-model="visible"
    :title="`一键提交 · ${caseName || 'CASE-' + caseId}`"
    width="560px"
    :teleported="false"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    destroy-on-close
    class="one-click-dialog"
    @close="handleClose"
  >
    <!-- 说明区 -->
    <div class="intro-block" v-if="phase === 'idle'">
      <div class="intro-icon">
        <el-icon><Cpu /></el-icon>
      </div>
      <div class="intro-text">
        <h4>一键自动评测所有子任务</h4>
        <p>系统将自动连接本地 MCP 探针，抓取完整项目源码，依据各子任务要求智能拆分后分别触发 AI 评分，无需对每个子任务单独提交。</p>
        <ul class="task-list">
          <li v-for="t in tasks" :key="t.id">
            <el-icon><Document /></el-icon>
            <span>{{ t.taskDescription }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- 进度区 -->
    <div class="progress-block" v-else>
      <!-- 步骤条 -->
      <div class="step-list">
        <div
          v-for="step in steps"
          :key="step.key"
          class="step-item"
          :class="[step.status]"
        >
          <div class="step-icon">
            <el-icon v-if="step.status === 'done'" class="done"><CircleCheckFilled /></el-icon>
            <el-icon v-else-if="step.status === 'error'" class="error"><CircleCloseFilled /></el-icon>
            <el-icon v-else-if="step.status === 'active'" class="active is-loading"><Loading /></el-icon>
            <el-icon v-else class="pending"><MoreFilled /></el-icon>
          </div>
          <div class="step-body">
            <span class="step-label">{{ step.label }}</span>
            <span class="step-msg" v-if="step.msg">{{ step.msg }}</span>
          </div>
        </div>
      </div>

      <!-- 结果区 -->
      <div class="result-section" v-if="phase === 'done' && results.length">
        <div class="result-title">子任务提交结果</div>
        <el-table :data="results" size="small" border class="result-table">
          <el-table-column prop="taskName" label="子任务" min-width="160" show-overflow-tooltip />
          <el-table-column prop="statusText" label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.statusType" size="small" round>{{ row.statusText }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="得分" width="90" align="center">
            <template #default="{ row }">
              <span v-if="row.score != null" :class="row.score >= 60 ? 'score-pass' : 'score-fail'">{{ row.score }}</span>
              <span v-else class="score-pending">—</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="result-tips">
          <el-icon><InfoFilled /></el-icon>
          <span v-if="sseActive">AI 正在实时评分，各任务结果将逐步更新...</span>
          <span v-else>AI 评分已完成，可前往各子任务详情页查看详细反馈。</span>
        </div>
      </div>

      <div class="error-msg" v-if="phase === 'error'">
        <el-icon><WarningFilled /></el-icon>
        {{ errorMsg }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose" :disabled="submitting">关闭</el-button>
        <el-button
          v-if="phase === 'idle'"
          type="primary"
          :loading="submitting"
          icon="VideoPlay"
          @click="startSubmit"
        >
          开始一键评测
        </el-button>
        <el-button
          v-if="phase === 'error'"
          type="warning"
          icon="RefreshLeft"
          @click="resetAndRetry"
        >
          重试
        </el-button>
        <el-button
          v-if="phase === 'done'"
          type="primary"
          icon="Check"
          @click="handleClose"
        >
          完成
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'
// @ts-ignore
import { submitProjectSnapshot, getProjectSnapshotMatrixByBundle } from '@/api/student/task'

const userStore = useUserStore()

// ================================================================
// Props & Emits
// ================================================================
const props = defineProps<{
  modelValue: boolean
  caseId: number | null
  caseName?: string
  tasks: Array<{ id: number; taskDescription: string }>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'submitted'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

// ================================================================
// State
// ================================================================
type Phase = 'idle' | 'running' | 'done' | 'error'
const phase = ref<Phase>('idle')
const submitting = ref(false)
const errorMsg = ref('')
const results = ref<Array<{ taskId?: number; taskName: string; statusText: string; statusType: string; score?: number | null }>>([])
const currentBundleId = ref<number | null>(null)
const polling = ref(false)
let pollingTimer: number | null = null
let sseConn: EventSource | null = null
const sseActive = ref(false)
// SSE 活跃时降频轮询（仅作兜底），无 SSE 时保持 2s 快轮询
const POLL_INTERVAL_MS = 2000
const POLL_INTERVAL_SSE_FALLBACK_MS = 10000
const POLL_TIMEOUT_MS = 5 * 60 * 1000

interface Step {
  key: string
  label: string
  msg: string
  status: 'pending' | 'active' | 'done' | 'error'
}

const steps = reactive<Step[]>([
  { key: 'probe',    label: '检测 MCP 探针',       msg: '', status: 'pending' },
  { key: 'source',   label: '抓取项目源码',         msg: '', status: 'pending' },
  { key: 'run',      label: '执行运行测试（可选）', msg: '', status: 'pending' },
  { key: 'submit',   label: '提交至平台并触发评分', msg: '', status: 'pending' },
])

const MCP_BASE_URL_KEY = 'mcpProbeBaseUrl'
const ONE_CLICK_BUNDLE_KEY_PREFIX = 'oneClickBundle:'

// ================================================================
// Helpers
// ================================================================
const resetSteps = () => {
  steps.forEach(s => { s.status = 'pending'; s.msg = '' })
  results.value = []
  errorMsg.value = ''
  polling.value = false
  currentBundleId.value = null
}

const getBundleStorageKey = () => `${ONE_CLICK_BUNDLE_KEY_PREFIX}${props.caseId ?? 'unknown'}`

const saveBundleCache = (bundleId: number) => {
  try {
    sessionStorage.setItem(getBundleStorageKey(), JSON.stringify({
      bundleId,
      caseId: props.caseId,
      savedAt: Date.now()
    }))
  } catch {
    // ignore storage errors
  }
}

const loadBundleCache = (): number | null => {
  try {
    const raw = sessionStorage.getItem(getBundleStorageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const id = Number(parsed?.bundleId)
    return Number.isNaN(id) || id <= 0 ? null : id
  } catch {
    return null
  }
}

const clearBundleCache = () => {
  try {
    sessionStorage.removeItem(getBundleStorageKey())
  } catch {
    // ignore storage errors
  }
}

const setStep = (key: string, status: Step['status'], msg = '') => {
  const s = steps.find(s => s.key === key)
  if (s) { s.status = status; s.msg = msg }
}

const stopPolling = () => {
  polling.value = false
  if (pollingTimer !== null) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
}

// ================================================================
// Bundle SSE
// ================================================================

const stopBundleSse = () => {
  sseActive.value = false
  if (sseConn) {
    sseConn.close()
    sseConn = null
  }
}

const stopAll = () => {
  stopPolling()
  stopBundleSse()
}

const handleSseTaskUpdate = (taskId: number, evaluationStatus: string, score: number | null, passed: boolean | null) => {
  const mapped = mapEvalStatus(evaluationStatus)
  const idx = results.value.findIndex(r => r.taskId === taskId)
  if (idx !== -1) {
    results.value[idx] = {
      ...results.value[idx],
      statusText: mapped.text,
      statusType: mapped.tag,
      score: score ?? results.value[idx].score
    }
  }
}

const startBundleSse = (bundleId: number) => {
  stopBundleSse()
  const token = userStore.token
  const url = `/api/training/submissions/project-snapshot/bundle/${bundleId}/progress?token=${encodeURIComponent(token)}`
  const es = new EventSource(url)
  sseConn = es
  sseActive.value = true

  es.onopen = () => {
    console.debug(`[BundleSSE] 连接建立 bundleId=${bundleId}`)
  }

  es.addEventListener('task_start', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data)
      handleSseTaskUpdate(data.taskId, 'processing', null, null)
    } catch {}
  })

  es.addEventListener('task_update', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data)
      handleSseTaskUpdate(data.taskId, data.evaluationStatus, data.score, data.passed)
    } catch {}
  })

  es.addEventListener('bundle_done', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data)
      console.debug(`[BundleSSE] bundle_done - passed: ${data.passedTasks}/${data.totalTasks}`)
    } catch {}
    // bundle_done 代表全部评分完成，停止 SSE 和轮询，主动刷新最终矩阵状态
    stopBundleSse()
    stopPolling()
    setStep('submit', 'done', '全部任务评分完成')
    clearBundleCache()
    // 主动拉取一次最新 matrix 刷新分数等数据
    getProjectSnapshotMatrixByBundle(bundleId).then((res: any) => {
      if (res?.code === 200 && res?.data) applyMatrixToResults(res.data)
    }).catch(() => {})
    ElMessage.success('一键评测已全部完成')
  })

  es.onerror = () => {
    console.warn(`[BundleSSE] 连接断开 bundleId=${bundleId}，轮询接管`)
    stopBundleSse()
    // SSE 断开后恢复快轮询接管
  }
}

const mapEvalStatus = (evaluationStatus?: string) => {
  const status = String(evaluationStatus || '').toLowerCase()
  if (["completed", "skipped_frozen", "skipped_not_eligible"].includes(status)) {
    return { key: 'passed', text: '已完成', tag: 'success' }
  }
  if (status === 'pending_evidence_review') {
    // 兜底：历史记录可能仍为此状态，显示为待教师评阅
    return { key: 'review', text: '待教师评阅', tag: 'warning' }
  }
  if (status === 'failed') {
    return { key: 'rejected', text: '失败', tag: 'danger' }
  }
  if (status === 'processing') {
    return { key: 'processing', text: '评分中', tag: 'warning' }
  }
  return { key: 'queued', text: '排队中', tag: 'info' }
}

const applyMatrixToResults = (matrix: any) => {
  const evalList = Array.isArray(matrix?.taskEvaluations) ? matrix.taskEvaluations : []
  const evalMap = new Map<number, any>()
  evalList.forEach((it: any) => {
    if (typeof it?.taskId === 'number') {
      evalMap.set(it.taskId, it)
    }
  })

  const SCORE_VISIBLE_STATUSES = new Set(['completed', 'skipped_frozen', 'skipped_not_eligible', 'pending_evidence_review'])
  results.value = props.tasks.map(task => {
    const item = evalMap.get(task.id)
    const evalStatus = String(item?.evaluationStatus || '').toLowerCase()
    const taskStatus = item?.taskStatus  // task.status：3=待教师确认，5=已打回

    // 根据 evalStatus + taskStatus 生成更精准的状态标签
    let mapped = mapEvalStatus(evalStatus)
    if (evalStatus === 'completed' && taskStatus === 3) {
      // AI 评分通过（>=60分），等待教师最终确认
      mapped = { key: 'waiting_teacher', text: 'AI已评，待教师确认', tag: 'primary' }
    } else if (evalStatus === 'completed' && taskStatus === 5) {
      // AI 评分未通过（<60分），已自动打回
      mapped = { key: 'ai_rejected', text: 'AI已打回', tag: 'danger' }
    }

    const scoreRaw = (SCORE_VISIBLE_STATUSES.has(evalStatus) && item?.totalScore != null)
      ? Number(item.totalScore)
      : null
    return {
      taskId: task.id,
      taskName: task.taskDescription,
      statusText: mapped.text,
      statusType: mapped.tag,
      score: scoreRaw != null && Number.isNaN(scoreRaw) ? null : scoreRaw
    }
  })
}

const isMatrixTerminal = (matrix: any, elapsedMs = 0) => {
  const bundleStatus = String(matrix?.bundleStatus || '').toLowerCase()
  // bundle 级别失败（编排层失败）：立即停止
  if (bundleStatus === 'failed') {
    return true
  }
  // bundle 状态为 "completed" 只代表任务已派发完毕，AI 评分仍在异步进行；
  // 必须等所有 taskEvaluation 都到达终态才算真正完成。
  const evalList = Array.isArray(matrix?.taskEvaluations) ? matrix.taskEvaluations : []
  if (evalList.length === 0) {
    // processing 状态超过 90s 仍无评测记录，说明 Outbox 处理卡死，中止轮询
    if (bundleStatus === 'processing' && elapsedMs > 90_000) {
      return true
    }
    return false
  }
  const TERMINAL = new Set(['completed', 'failed', 'skipped_frozen', 'skipped_not_eligible', 'pending_evidence_review'])
  return evalList.every((it: any) => TERMINAL.has(String(it?.evaluationStatus || '').toLowerCase()))
}

const startMatrixPolling = async (bundleId: number) => {
  currentBundleId.value = bundleId
  saveBundleCache(bundleId)
  polling.value = true

  // 同时建立 SSE 连接，获取每个任务的实时评分进度
  startBundleSse(bundleId)

  const startTs = Date.now()

  const tick = async () => {
    try {
      const res = await getProjectSnapshotMatrixByBundle(bundleId)
      if (res?.code !== 200 || !res?.data) {
        return
      }
      const matrix = res.data
      applyMatrixToResults(matrix)

      const elapsed = Date.now() - startTs
      if (isMatrixTerminal(matrix, elapsed)) {
        stopPolling()
        stopBundleSse()
        const evalList = Array.isArray(matrix?.taskEvaluations) ? matrix.taskEvaluations : []
        if (evalList.length === 0) {
          // Outbox 卡死兜底：清缓存，提示重新提交
          clearBundleCache()
          setStep('submit', 'error', '后台处理异常（0条评测记录），请重新点击「一键评测」')
          phase.value = 'error'
          errorMsg.value = '提交处理异常，请重新提交'
        } else {
          setStep('submit', 'done', '全部任务评分完成')
          clearBundleCache()
          ElMessage.success('一键评测已全部完成')
        }
        return
      }

      if (Date.now() - startTs > POLL_TIMEOUT_MS) {
        stopPolling()
        stopBundleSse()
        setStep('submit', 'done', '仍在后台处理中，可稍后刷新查看')
        return
      }
    } catch (e) {
      // 轮询失败不打断，等待下一次
    }
  }

  await tick()
  if (!polling.value) {
    return
  }
  // 同时有 SSE 推送时，轮询仅作兜底（5s 拉一次）；SSE 断开后轮询密度不变，保证状态不遗漏
  pollingTimer = window.setInterval(tick, sseActive.value ? POLL_INTERVAL_SSE_FALLBACK_MS : POLL_INTERVAL_MS)
}

const tryResumePolling = async () => {
  const cachedBundleId = loadBundleCache()
  if (!cachedBundleId) {
    return
  }

  // 先进入结果视图，避免用户误以为需要重新提交
  phase.value = 'done'
  results.value = props.tasks.map(t => ({
    taskId: t.id,
    taskName: t.taskDescription,
    statusText: '排队中',
    statusType: 'info',
    score: null
  }))
  setStep('submit', 'active', `检测到未完成提交（bundleId=${cachedBundleId}），正在恢复进度...`)

  try {
    // ── 恢复前先快检：bundle 卡死（processing 且 0 条评测记录）则放弃 ──
    const preCheck = await getProjectSnapshotMatrixByBundle(cachedBundleId)
    if (preCheck?.code === 200 && preCheck?.data) {
      const matrix = preCheck.data
      const bundleStatus = String(matrix?.bundleStatus || '').toLowerCase()
      const evalCount = Array.isArray(matrix?.taskEvaluations) ? matrix.taskEvaluations.length : 0

      if (bundleStatus === 'processing' && evalCount === 0) {
        // 旧 bundle 卡死（Outbox 处理异常），清除缓存，允许重新提交
        clearBundleCache()
        setStep('submit', 'error', '检测到历史提交异常（0条评测记录），请重新点击「一键评测」')
        phase.value = 'error'
        errorMsg.value = '上次提交异常，请重新提交'
        return
      }

      if (bundleStatus === 'failed') {
        clearBundleCache()
        setStep('submit', 'error', '历史提交失败，请重新点击「一键评测」')
        phase.value = 'error'
        errorMsg.value = '上次提交失败，请重新提交'
        return
      }
    }

    await startMatrixPolling(cachedBundleId)
  } catch {
    // 若恢复失败，保留已显示状态并允许用户重新提交
    setStep('submit', 'done', '恢复进度失败，可重试或重新提交')
  }
}

const fetchMcpJson = async (url: string, options?: RequestInit, timeoutMs = 8000) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...(options || {}), signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    window.clearTimeout(timer)
  }
}

const resolveMcpBaseUrl = async (): Promise<string> => {
  const saved = (localStorage.getItem(MCP_BASE_URL_KEY) || '').trim().replace(/\/$/, '')
  if (saved) {
    try {
      const h = await fetchMcpJson(`${saved}/mcp/health`, undefined, 2000)
      if (h?.code === 200 || h?.data || h?.msg) return saved
    } catch { /* ignore */ }
  }
  const ports = [8080, 8081, 8082, 8083]
  for (const port of ports) {
    const base = `http://localhost:${port}`
    try {
      const h = await fetchMcpJson(`${base}/mcp/health`, undefined, 2000)
      if (h?.code === 200 || h?.data || h?.msg) {
        localStorage.setItem(MCP_BASE_URL_KEY, base)
        return base
      }
    } catch { /* ignore */ }
  }
  throw new Error('未检测到本地 MCP 探针，请确认项目已启动后重试')
}

// ================================================================
// Core Logic
// ================================================================
const startSubmit = async () => {
  resetSteps()
  submitting.value = true
  phase.value = 'running'

  let baseUrl = ''
  let sourceCode: Record<string, string> = {}
  let runResult: any = null

  // ── Step 1: 探针检测 ─────────────────────────────────────────
  setStep('probe', 'active')
  try {
    baseUrl = await resolveMcpBaseUrl()
    setStep('probe', 'done', baseUrl)
  } catch (e: any) {
    setStep('probe', 'error', e.message)
    errorMsg.value = e.message
    phase.value = 'error'
    submitting.value = false
    return
  }

  // ── Step 2: 抓取源码 ─────────────────────────────────────────
  setStep('source', 'active')
  try {
    const sourceRes = await fetchMcpJson(`${baseUrl}/mcp/source`, undefined, 15000)
    sourceCode = sourceRes?.data ?? sourceRes
    if (!sourceCode || typeof sourceCode !== 'object' || Object.keys(sourceCode).length === 0) {
      throw new Error('MCP 未返回有效源码数据')
    }
    setStep('source', 'done', `共 ${Object.keys(sourceCode).length} 个文件`)
  } catch (e: any) {
    setStep('source', 'error', e.message)
    errorMsg.value = e.message
    phase.value = 'error'
    submitting.value = false
    return
  }

  // ── Step 3: 运行测试（失败不阻断） ───────────────────────────
  setStep('run', 'active')
  try {
    const taskNames = props.tasks.map(t => t.taskDescription).join('；')
    runResult = await fetchMcpJson(`${baseUrl}/mcp/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: props.caseId, taskNames })
    }, 12000)
    setStep('run', 'done', '运行结果已获取')
  } catch (e: any) {
    runResult = { error: String(e) }
    setStep('run', 'done', '运行测试跳过（不影响评分）')
  }

  // ── Step 4: 提交平台 ─────────────────────────────────────────
  setStep('submit', 'active')
  try {
    const targetTaskIds = props.tasks.map(t => t.id)
    const res = await submitProjectSnapshot({
      sourceCode,
      runResult,
      targetTaskIds,
      probeInfo: {
        baseUrl,
        userAgent: navigator.userAgent,
        submittedAt: new Date().toISOString(),
        caseId: props.caseId
      }
    })

    if (res.code === 200) {
      const data = res.data || {}

      // 初始状态统一显示为"排队中"，随后通过 SSE 实时更新 / matrix 轮询更新真实状态。
      results.value = props.tasks.map(t => ({
        taskId: t.id,
        taskName: t.taskDescription,
        statusText: '排队中',
        statusType: 'info',
        score: null
      }))

      setStep('submit', 'active', data.message || '提交成功，正在获取后台进度...')
      phase.value = 'done'
      ElMessage.success('一键评测已提交，AI 正在后台评分')
      emit('submitted')

      const bundleId = Number(data.bundleId)
      if (!Number.isNaN(bundleId) && bundleId > 0) {
        await startMatrixPolling(bundleId)
      } else {
        clearBundleCache()
        setStep('submit', 'done', '已提交成功，未获取到 bundleId，请稍后刷新任务页')
      }
    } else {
      throw new Error(res.message || '提交失败')
    }
  } catch (e: any) {
    setStep('submit', 'error', e.message)
    errorMsg.value = e.message
    phase.value = 'error'
  } finally {
    submitting.value = false
  }
}

const resetAndRetry = () => {
  stopAll()
  clearBundleCache()
  phase.value = 'idle'
  resetSteps()
}

const handleClose = () => {
  if (submitting.value) return
  stopAll()
  visible.value = false
}

// 对话框关闭时重置状态
watch(visible, (v) => {
  if (!v) {
    stopAll()
    setTimeout(() => {
      phase.value = 'idle'
      resetSteps()
    }, 300)
    return
  }

  // 重新打开弹窗时尝试恢复未完成的一键提交进度
  tryResumePolling()
})
</script>

<style scoped lang="scss">
.one-click-dialog {
  :deep(.el-dialog__header) {
    padding: 20px 24px 16px;
    border-bottom: 1px solid #f0f2f5;
  }
  :deep(.el-dialog__body) {
    padding: 20px 24px;
  }
  :deep(.el-dialog__footer) {
    border-top: 1px solid #f0f2f5;
    padding: 12px 24px;
  }
}

/* ── 说明区 ────────────────────────────────────── */
.intro-block {
  display: flex;
  gap: 18px;
  align-items: flex-start;

  .intro-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    background: #ecf5ff;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: #409eff;
  }

  .intro-text {
    flex: 1;

    h4 {
      margin: 0 0 8px 0;
      font-size: 15px;
      color: #303133;
    }

    p {
      font-size: 13px;
      color: #606266;
      line-height: 1.7;
      margin: 0 0 12px 0;
    }

    .task-list {
      margin: 0;
      padding-left: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;

      li {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 13px;
        color: #909399;
        background: #f8fafc;
        border-radius: 6px;
        padding: 6px 10px;

        .el-icon {
          flex-shrink: 0;
          font-size: 14px;
          color: #409eff;
          margin-top: 1px;
        }
      }
    }
  }
}

/* ── 进度步骤 ────────────────────────────────────── */
.progress-block {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed #f0f2f5;
  transition: all 0.2s;

  &:last-child {
    border-bottom: none;
  }

  .step-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;

    .done   { color: #67c23a; }
    .error  { color: #f56c6c; }
    .active { color: #409eff; }
    .pending { color: #c0c4cc; font-size: 16px; }
  }

  .step-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .step-label {
      font-size: 14px;
      font-weight: 500;
      color: #303133;
    }

    .step-msg {
      font-size: 12px;
      color: #909399;
    }
  }

  &.active .step-label { color: #409eff; }
  &.done   .step-label { color: #67c23a; }
  &.error  .step-label { color: #f56c6c; }
}

/* ── 结果区 ────────────────────────────────────── */
.result-section {
  .result-title {
    font-size: 13px;
    font-weight: 600;
    color: #606266;
    margin-bottom: 8px;
  }

  .result-table {
    border-radius: 6px;
    overflow: hidden;
  }

  .result-tips {
    margin-top: 10px;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12px;
    color: #909399;
    line-height: 1.6;

    .el-icon {
      flex-shrink: 0;
      margin-top: 2px;
      color: #409eff;
    }
  }
}

.error-msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #f56c6c;
  font-size: 13px;
  background: #fef0f0;
  border-radius: 8px;
  padding: 12px 16px;
  line-height: 1.6;

  .el-icon { flex-shrink: 0; margin-top: 2px; }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.score-pass  { color: #67c23a; font-weight: 600; }
.score-fail  { color: #f56c6c; font-weight: 600; }
.score-pending { color: #c0c4cc; }
</style>
