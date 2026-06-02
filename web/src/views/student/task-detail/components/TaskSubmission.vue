<template>
  <div class="submission-card-wrapper animate__animated animate__fadeIn">
    <el-card shadow="never" class="upload-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <div class="icon-box">
              <el-icon><Monitor /></el-icon>
            </div>
            <span class="title">{{ panelTitle }}</span>
          </div>
          <el-tag effect="plain" :type="panelTagType" size="small" round>{{ panelTagText }}</el-tag>
        </div>
      </template>

      <!-- 纯编码实战：智能评测引导 -->
      <div class="smart-submission-hint" v-if="!isOnlineSubmission && !isTaskPassed && !gradingInProgress && !mcpAssessing">
        <div class="hint-content">
          <div class="hint-icon">
            <el-icon><Connection /></el-icon>
          </div>
          <div class="hint-text">
            <h4>纯编码实战自动评测</h4>
            <p>请确保本地项目已启动，系统将通过 MCP 探针抓取源码、运行项目并生成评分结果</p>
          </div>
        </div>
        <div class="mcp-info">
          <span class="label">探针地址</span>
          <code class="address">localhost:8080~8083</code>
        </div>
      </div>

      <!-- 在线提交引导 -->
      <div class="smart-submission-hint" v-if="isOnlineSubmission && !isTaskPassed && !gradingInProgress && !mcpAssessing">
        <div class="hint-content">
          <div class="hint-icon">
            <el-icon><Monitor /></el-icon>
          </div>
          <div class="hint-text">
            <h4>{{ submissionHintTitle }}</h4>
            <p>{{ submissionHintDesc }}</p>
          </div>
        </div>
        <div class="doc-requirement-list" v-if="isFullPracticeMode">
          <div class="req-title">最终成果提交要求：</div>
          <ul>
            <li><strong>必交 1：</strong>实验报告，支持上传 <strong>PDF / DOCX / Markdown</strong>，也可在下方直接填写报告正文</li>
            <li><strong>必交 2：</strong>项目源码压缩包，支持 <strong>ZIP / RAR / 7Z</strong></li>
            <li>系统会自动从提交的实验报告文档中提取 ER 图、流程图、运行截图等内容进行分析</li>
          </ul>
          <div class="req-note">请在完成全部实验后一次性提交最终成果包。</div>
        </div>
        <!-- SQL脚本任务 -->
        <div class="doc-requirement-list" v-else-if="submissionCategory === 'sql'">
          <div class="req-title">SQL脚本提交要求：</div>
          <ul>
            <li>必须包含 <strong>CREATE TABLE</strong> 语句</li>
            <li>每张表必须定义 <strong>PRIMARY KEY</strong> 主键</li>
            <li>包含必要的 <strong>FOREIGN KEY</strong> 外键约束</li>
            <li>表名、字段名使用小写+下划线命名规范</li>
          </ul>
          <div class="req-note">可在下方直接粘贴SQL脚本文本，或上传 .sql 文件附件</div>
        </div>
        <!-- ER图/UML类图任务 -->
        <div class="doc-requirement-list" v-else-if="submissionCategory === 'diagram'">
          <div class="req-title">设计图提交要求：</div>
          <ul>
            <li><strong>ER图</strong>：至少 3 个实体，标注关系类型（一对多/多对多），标注主键</li>
            <li><strong>UML类图</strong>：至少 3 个类，包含类间关系（继承/关联），标注属性与方法</li>
            <li>提交清晰截图（PNG/JPG），并在下方填写实体名称/类名辅助结构化校验</li>
          </ul>
          <div class="req-note">上传设计图截图，同时在「结构化校验补充」框填写ER实体或UML文本，提升评分准确率</div>
        </div>
        <!-- ECharts图表任务 -->
        <div class="doc-requirement-list" v-else-if="submissionCategory === 'chart'">
          <div class="req-title">ECharts图表提交要求：</div>
          <ul>
            <li>图表类型必须符合任务要求：<strong>柱状图 / 折线图 / 饼图</strong>之一</li>
            <li>必须包含完整的<strong>数据标签</strong></li>
            <li><strong>坐标轴标签</strong>完整（X轴/Y轴标题）</li>
            <li>提交图表截图并在下方「图表结构化校验信息」填写类型和标签</li>
          </ul>
          <div class="req-note">上传图表截图后，务必在下方填写图表类型、数据标签、坐标轴标签以支持自动校验</div>
        </div>
        <!-- 实训总结报告 -->
        <div class="doc-requirement-list" v-else-if="submissionCategory === 'report'">
          <div class="req-title">实训报告撰写要求：</div>
          <ul>
            <li>实验目的与项目背景</li>
            <li>技术方案与实现思路（含关键代码片段截图）</li>
            <li>各阶段成果运行效果截图</li>
            <li>实验结论：收获、问题与改进建议</li>
          </ul>
          <div class="req-note">可在线填写报告正文，或上传Word/PDF文档附件</div>
        </div>
        <!-- 通用提交 -->
        <div class="doc-requirement-list" v-else>
          <div class="req-title">提交内容建议：</div>
          <ul>
            <li>实验目的</li>
            <li>实验要求与实现思路</li>
            <li>运行截图 + 核心说明</li>
            <li>实验结果分析与结论</li>
          </ul>
          <div class="req-note">支持提交：仅文档、仅图表、压缩包、混合附件</div>
        </div>
      </div>

      <!-- 状态提示区域 -->
      <transition name="el-fade-in-linear" mode="out-in">
        <!-- 已通过 -->
        <div v-if="isTaskPassed" class="status-state success">
          <div class="state-icon">
            <el-icon><CircleCheckFilled /></el-icon>
          </div>
          <h3>任务已完成</h3>
          <p>恭喜！该任务已通过验收</p>
        </div>

        <!-- 评测中/提交面板/已打回 (合并在一个块中，根据状态显示不同内容) -->
        <div v-else class="action-area-wrapper">
          <!-- 打回提示 (如果存在) -->
          <div v-if="task.status === 5 && latestSubmission" class="status-state reject">
            <div class="state-icon">
              <el-icon><CircleCloseFilled /></el-icon>
            </div>
            <h3>作业已被打回</h3>
            <div class="reason-box" v-if="latestSubmission.rejectReason">
              <span class="label">打回原因：</span>
              <span class="value">{{ latestSubmission.rejectReason }}</span>
            </div>
            <p v-else>请根据教师反馈修改后重新提交</p>
          </div>

          <div v-if="isOnlineSubmission" class="online-submit-form">
            <div class="mode-callout" v-if="isFullPracticeMode">
              <div class="mode-callout-title">最终成果一次提交</div>
              <div class="mode-callout-desc">完整实训案例只保留一次最终提交。请在完成整个项目后，统一提交实验报告和源码压缩包；系统会自动从报告文档中提取图示与运行截图进行分析。</div>
            </div>

            <el-input
              v-model="onlineContent"
              type="textarea"
              :rows="6"
              :placeholder="onlineTextPlaceholder"
            />

            <div class="attachment-section">
              <div class="attachment-title">{{ isFullPracticeMode ? '最终成果附件（报告 + 源码为必交）' : '附件清单（可选）' }}</div>
              <el-upload
                class="upload-box"
                :show-file-list="false"
                :multiple="true"
                :http-request="uploadAttachmentFile"
                :before-upload="beforeAttachmentUpload"
                drag
                :accept="uploadAccept"
              >
                <el-icon class="upload-drag-icon"><Files /></el-icon>
                <div class="upload-drag-text">将文件拖拽到此处，或点击上传</div>
                <div class="upload-drag-tip">{{ isFullPracticeMode ? '仅支持上传实验报告与源码压缩包，系统会从报告文档中自动提取图片内容，单文件不超过 100MB' : '支持 zip/rar/7z/pdf/docx/md/txt/sql/xlsx/xls/png/jpg/jpeg，单文件不超过 100MB' }}</div>
              </el-upload>
              <div class="upload-status" v-if="uploadProgressText">{{ uploadProgressText }}</div>

              <div
                class="attachment-item"
                v-for="(item, index) in visibleAttachmentItems"
                :key="`attachment-${item.filePath || item.fileName || index}`"
              >
                <div class="attachment-icon">
                  <el-icon><component :is="getAttachmentIconComponent(item.fileName, item.fileType)" /></el-icon>
                </div>
                <div class="attachment-name" :title="item.fileName">{{ item.fileName }}</div>
                <div class="attachment-path" :title="item.filePath">{{ item.filePath }}</div>
                <div class="attachment-type">{{ item.fileType || '-' }}</div>
                <div class="attachment-size">{{ formatFileSize(item.fileSize) }}</div>
                <el-button text type="danger" @click="removeAttachment(item)">删除</el-button>
              </div>

              <div class="deliverable-checklist" v-if="isFullPracticeMode">
                <div class="deliverable-item" :class="{ ready: hasReportContent }">
                  <span class="deliverable-name">实验报告</span>
                  <el-tag size="small" :type="hasReportContent ? 'success' : 'warning'" effect="light">
                    {{ hasReportContent ? '已准备' : '待补充' }}
                  </el-tag>
                </div>
                <div class="deliverable-item" :class="{ ready: hasSourceArchiveAttachment }">
                  <span class="deliverable-name">源码压缩包</span>
                  <el-tag size="small" :type="hasSourceArchiveAttachment ? 'success' : 'warning'" effect="light">
                    {{ hasSourceArchiveAttachment ? '已上传' : '待上传' }}
                  </el-tag>
                </div>
              </div>
            </div>

            <template v-if="!isFullPracticeMode">
              <div class="attachment-section" v-if="hasImageAttachment">
                <div class="attachment-title">图表结构化校验信息（用于OCR/图元对齐）</div>
                <el-row :gutter="10" class="chart-meta-row">
                  <el-col :span="12">
                    <el-select v-model="chartType" placeholder="选择图表类型" clearable style="width: 100%">
                      <el-option label="柱状图" value="bar" />
                      <el-option label="折线图" value="line" />
                      <el-option label="饼图" value="pie" />
                    </el-select>
                  </el-col>
                  <el-col :span="12">
                    <el-input v-model="chartTitle" placeholder="图表标题（可选）" />
                  </el-col>
                </el-row>
                <el-input v-model="dataLabelsText" placeholder="数据标签（逗号分隔，如：销售额,利润）" />
                <el-input v-model="xAxisLabelsText" placeholder="X轴标签（逗号分隔）" style="margin-top: 8px" />
                <el-input v-model="yAxisLabelsText" placeholder="Y轴标签（逗号分隔）" style="margin-top: 8px" />
                <el-input v-model="legendLabelsText" placeholder="图例标签（逗号分隔）" style="margin-top: 8px" />
              </div>

              <div class="attachment-section">
                <div class="attachment-title">结构化校验补充（可选）</div>
                <el-input
                  v-model="sqlScriptText"
                  type="textarea"
                  :rows="3"
                  resize="none"
                  placeholder="可选：粘贴SQL脚本，用于表结构/主外键规则校验"
                />
                <el-input
                  v-model="umlDescriptionText"
                  type="textarea"
                  :rows="3"
                  resize="none"
                  style="margin-top: 8px"
                  placeholder="可选：粘贴UML类图文本描述（如 class/extends/implements）"
                />
                <el-input
                  v-model="erEntitiesText"
                  style="margin-top: 8px"
                  placeholder="可选：ER实体名（逗号分隔，如 用户,订单,商品）"
                />
                <el-input
                  v-model="erRelationshipsText"
                  style="margin-top: 8px"
                  placeholder="可选：ER关系（逗号分隔，如 用户-订单:一对多）"
                />
                <el-switch
                  v-model="erHasPrimaryKeys"
                  style="margin-top: 8px"
                  active-text="ER图已标注主键"
                  inactive-text="ER图未标注主键"
                />
              </div>
            </template>

            <div class="action-area">
              <div class="draft-actions">
                <el-button text type="primary" size="small" @click="saveDraftNow">保存草稿</el-button>
                <el-button text type="info" size="small" @click="restoreDraft">恢复草稿</el-button>
                <el-button text type="danger" size="small" @click="clearDraft">清空草稿</el-button>
                <span v-if="draftSavedAt" class="draft-tip">最近保存：{{ draftSavedAt }}</span>
              </div>
              <button
                class="start-btn"
                :class="{ 'is-loading': mcpAssessing }"
                @click="submitOnline"
                :disabled="mcpAssessing || (isFullPracticeMode && !fullPracticeCanSubmit)"
              >
                  <span class="btn-content" v-if="!mcpAssessing">
                    <el-icon><VideoPlay /></el-icon>
                  <span>{{ submitActionText }}</span>
                </span>
                <span class="btn-loading" v-else>
                  <el-icon class="is-loading"><Loading /></el-icon>
                  <span>{{ isFullPracticeMode ? '正在校验并评分...' : '正在解析与评分...' }}</span>
                </span>
                <div class="btn-bg"></div>
              </button>
              <div class="status-text" v-if="mcpStatusText">
                <el-icon class="is-loading" v-if="mcpAssessing"><Loading /></el-icon>
                {{ mcpStatusText }}
              </div>
              <div class="status-text warning-text" v-else-if="isFullPracticeMode && !fullPracticeCanSubmit">
                请至少准备实验报告与源码压缩包后再提交最终成果
              </div>
            </div>
          </div>

          <!-- 评测按钮（纯编码实战） -->
          <div v-else class="action-area">
            <button 
              class="start-btn" 
              :class="{ 'is-loading': mcpAssessing }"
              @click="$emit('start-assessment')"
              :disabled="mcpAssessing"
            >
              <span class="btn-content" v-if="!mcpAssessing">
                <el-icon><VideoPlay /></el-icon>
                <span>{{ needResubmit ? '重新发起评测' : '开始纯编码评测' }}</span>
              </span>
              <span class="btn-loading" v-else>
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>正在连接探针...</span>
              </span>
              <div class="btn-bg"></div>
            </button>
            
            <div class="status-text" v-if="mcpStatusText">
              <el-icon class="is-loading" v-if="mcpAssessing"><Loading /></el-icon>
              {{ mcpStatusText }}
            </div>

            <el-divider content-position="left">手动ZIP提交（备用）</el-divider>
            <div class="manual-zip-area">
              <el-upload
                class="upload-box"
                :show-file-list="false"
                :multiple="false"
                :http-request="uploadManualZip"
                :before-upload="beforeManualZipUpload"
                drag
                accept=".zip"
              >
                <el-icon class="upload-drag-icon"><Files /></el-icon>
                <div class="upload-drag-text">拖拽 ZIP 到此处，或点击上传</div>
                <div class="upload-drag-tip">当本地MCP不可用时，可改用 ZIP 手动提交通道</div>
              </el-upload>

              <div class="attachment-item" v-if="manualZipAttachment">
                <div class="attachment-icon"><el-icon><Files /></el-icon></div>
                <div class="attachment-name" :title="manualZipAttachment.fileName">{{ manualZipAttachment.fileName }}</div>
                <div class="attachment-path" :title="manualZipAttachment.filePath">{{ manualZipAttachment.filePath }}</div>
                <div class="attachment-size">{{ formatFileSize(manualZipAttachment.fileSize) }}</div>
                <el-button text type="danger" @click="manualZipAttachment = null">移除</el-button>
              </div>

              <el-input
                v-model="manualZipComment"
                type="textarea"
                :rows="2"
                resize="none"
                placeholder="可选：补充说明本次ZIP提交内容"
              />

              <el-button
                type="warning"
                plain
                :disabled="!manualZipAttachment || mcpAssessing"
                @click="submitManualZip"
              >
                提交ZIP并触发评分
              </el-button>
            </div>
          </div>
        </div>
      </transition>

      <!-- 实时进度面板 -->
      <transition name="expand">
        <div v-if="gradingInProgress" class="progress-section">
          <div class="progress-header" @click="toggleProgress">
            <span class="label">
              <el-icon class="is-loading"><Loading /></el-icon>
              AI 评分进行中
            </span>
            <el-icon :class="{ 'is-active': progressPanelVisible }"><ArrowDown /></el-icon>
          </div>
          
          <div v-show="progressPanelVisible" class="progress-body">
            <div class="progress-bar-wrapper">
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: `${gradingProgressPercent}%` }"></div>
              </div>
              <span class="progress-val">{{ gradingProgressPercent }}%</span>
            </div>
            <div class="progress-message" v-if="gradingProgressMessage">
              {{ gradingProgressMessage }}
            </div>
            
            <div class="step-timeline">
              <transition-group name="list">
                <div
                  v-for="step in reversedSteps"
                  :key="`${step.stepNo}-${step.agentName}`"
                  class="step-item"
                  :class="step.status"
                >
                  <div class="step-left">
                    <div class="step-dot">
                      <el-icon v-if="step.status === 'success'"><Check /></el-icon>
                      <el-icon v-else-if="step.status === 'running'"><Loading /></el-icon>
                      <div v-else class="dot-inner"></div>
                    </div>
                    <div class="step-line"></div>
                  </div>
                  <div class="step-content">
                    <div class="step-head">
                      <span class="name">{{ step.stepName || step.agentName }}</span>
                      <span class="status-tag" :class="step.status">
                        {{ getStepStatusText(step.status) }}
                      </span>
                    </div>
                    <div class="step-msg" v-if="step.message">{{ step.message }}</div>
                  </div>
                </div>
              </transition-group>
            </div>
          </div>
        </div>
      </transition>

      <div class="footer-links">
        <el-button v-if="!isOnlineSubmission" link type="info" size="small" @click="$emit('dependency-guide')">
          <el-icon><QuestionFilled /></el-icon> 依赖接入指南
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { 
  Monitor, Connection, VideoPlay, Loading, 
  CircleCheckFilled, CircleCloseFilled, ArrowDown,
  Check, QuestionFilled, Files, Document, Picture
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
// @ts-ignore
import { uploadNonCodeAttachment, saveOnlineSubmissionDraft, getOnlineSubmissionDraft, deleteOnlineSubmissionDraft, recordLearningProcess } from '@/api/student/task'

const props = defineProps<{
  task: any
  caseMode?: string
  caseModeLabel?: string
  isTaskPassed: boolean
  latestSubmission: any
  needResubmit: boolean
  mcpAssessing: boolean
  mcpStatusText: string
  gradingInProgress: boolean
  gradingProgressPercent: number
  gradingProgressMessage: string
  gradingProgressStatus?: '' | 'success' | 'exception' | 'warning'
  gradingProgressSteps?: any[]
  progressPanelVisible: boolean
}>()

const emit = defineEmits(['start-assessment', 'dependency-guide', 'close-progress', 'open-progress'])

const onlineContent = ref('')
const attachmentItems = ref<any[]>([])
const chartType = ref('')
const chartTitle = ref('')
const dataLabelsText = ref('')
const xAxisLabelsText = ref('')
const yAxisLabelsText = ref('')
const legendLabelsText = ref('')
const sqlScriptText = ref('')
const umlDescriptionText = ref('')
const erEntitiesText = ref('')
const erRelationshipsText = ref('')
const erHasPrimaryKeys = ref(false)
const attachmentUploading = ref(false)
const uploadProgressText = ref('')
const uploadingCount = ref(0)
const manualZipAttachment = ref<any>(null)
const manualZipComment = ref('')
const sourceArchiveAttachmentCache = ref<any | null>(null)
const draftSavedAt = ref('')
let draftTimer: number | null = null
const MAX_SINGLE_FILE_SIZE = 100 * 1024 * 1024
const attachmentExtSet = new Set([
  'zip', 'rar', '7z', 'pdf', 'docx', 'md', 'txt', 'sql', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'
])
const fullPracticeAttachmentExtSet = new Set(['zip', 'rar', '7z', 'pdf', 'docx', 'md'])
const reportExtSet = new Set(['pdf', 'docx', 'md'])
const archiveExtSet = new Set(['zip', 'rar', '7z'])
const knownAttachmentExtSet = new Set([
  ...attachmentExtSet,
  ...fullPracticeAttachmentExtSet,
  ...reportExtSet,
  ...archiveExtSet
])

const getFileExt = (fileName: string) => {
  const name = String(fileName || '').split(/[?#]/)[0]
  const idx = name.lastIndexOf('.')
  if (idx < 0) return ''
  return name.substring(idx + 1).toLowerCase()
}

const resolveAttachmentExt = (itemOrFileName: any, fileType?: string) => {
  const isNameArg = typeof itemOrFileName === 'string'
  const fileName = isNameArg ? itemOrFileName : String(itemOrFileName?.fileName || '')
  const filePath = isNameArg ? '' : String(itemOrFileName?.filePath || '')
  const rawType = String(isNameArg ? fileType || '' : itemOrFileName?.fileType || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '')
  if (knownAttachmentExtSet.has(rawType)) return rawType
  return getFileExt(fileName) || getFileExt(filePath) || rawType
}

const normalizeAttachmentItem = (item: any) => {
  const fileName = String(item?.fileName || '').trim()
  const filePath = String(item?.filePath || '').trim()
  const fileType = resolveAttachmentExt(item)
  return {
    fileName,
    filePath,
    fileType,
    fileSize: Number(item?.fileSize || 0)
  }
}

const attachmentIdentity = (item: any) => {
  const normalized = normalizeAttachmentItem(item)
  return `${normalized.filePath}|${normalized.fileName}`
}

const mergeAttachmentList = (items: any[] = []) => {
  const merged = new Map<string, any>()
  items.forEach(item => {
    const normalized = normalizeAttachmentItem(item)
    if (!normalized.filePath) return
    merged.set(attachmentIdentity(normalized), normalized)
  })
  return Array.from(merged.values())
}

const isSourceArchiveAttachmentItem = (item: any) => {
  return archiveExtSet.has(resolveAttachmentExt(item))
}

const isReportAttachmentItem = (item: any) => {
  return reportExtSet.has(resolveAttachmentExt(item))
}

const syncSourceArchiveCache = (items: any[], keepExisting = false) => {
  const candidates = keepExisting && sourceArchiveAttachmentCache.value
    ? [...items, sourceArchiveAttachmentCache.value]
    : items
  sourceArchiveAttachmentCache.value = mergeAttachmentList(candidates).find(isSourceArchiveAttachmentItem) || null
}

const getAttachmentIconComponent = (fileName: string, fileType: string) => {
  const ext = resolveAttachmentExt(fileName, fileType)
  if (['png', 'jpg', 'jpeg'].includes(ext)) return Picture
  if (['zip', 'rar', '7z'].includes(ext)) return Files
  return Document
}

const beforeAttachmentUpload = (file: File) => {
  const ext = getFileExt(file?.name || '')
  const allowSet = isFullPracticeMode.value ? fullPracticeAttachmentExtSet : attachmentExtSet
  if (!allowSet.has(ext)) {
    ElMessage.warning(isFullPracticeMode.value ? '完整实训仅支持上传实验报告文档和源码压缩包' : '文件类型不支持，请上传报告文档、图表或压缩包')
    return false
  }
  if (file.size > MAX_SINGLE_FILE_SIZE) {
    ElMessage.warning('单个文件不能超过 100MB')
    return false
  }
  return true
}

const removeAttachment = (target: any) => {
  const targetKey = attachmentIdentity(target)
  attachmentItems.value = attachmentItems.value.filter(item => attachmentIdentity(item) !== targetKey)
  if (sourceArchiveAttachmentCache.value && attachmentIdentity(sourceArchiveAttachmentCache.value) === targetKey) {
    sourceArchiveAttachmentCache.value = null
  }
}

const uploadAttachmentFile = async (options: any) => {
  const file = options?.file
  if (!file) return

  try {
    uploadingCount.value += 1
    attachmentUploading.value = true
    uploadProgressText.value = `正在上传：${file.name}`

    const res = await uploadNonCodeAttachment(file, (event: any) => {
      const percent = event?.total ? Math.round((event.loaded / event.total) * 100) : 0
      uploadProgressText.value = `正在上传：${file.name} (${percent}%)`
      if (typeof options?.onProgress === 'function') {
        options.onProgress({ percent })
      }
    })

    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || '上传失败')
    }

    const uploadedAttachment = normalizeAttachmentItem({
      fileName: res.data.fileName,
      filePath: res.data.filePath,
      fileType: res.data.fileType,
      fileSize: res.data.fileSize
    })
    attachmentItems.value = mergeAttachmentList([...attachmentItems.value, uploadedAttachment])
    syncSourceArchiveCache(attachmentItems.value, true)
    if (currentTaskId.value) {
      void recordLearningProcess({
        caseId: props.task?.caseId,
        taskId: currentTaskId.value,
        actionType: 'attachment_upload',
        actionLabel: '上传提交附件',
        sourcePage: 'student-task-detail',
        attachmentCount: 1,
        detail: {
          fileName: uploadedAttachment.fileName,
          fileType: uploadedAttachment.fileType
        }
      }).catch(() => {})
    }

    uploadProgressText.value = `上传成功：${res.data.fileName}`
    if (typeof options?.onSuccess === 'function') {
      options.onSuccess(res.data)
    }
  } catch (error: any) {
    uploadProgressText.value = `上传失败：${file?.name || ''}`
    if (typeof options?.onError === 'function') {
      options.onError(error)
    }
  } finally {
    uploadingCount.value = Math.max(0, uploadingCount.value - 1)
    attachmentUploading.value = uploadingCount.value > 0
    if (!attachmentUploading.value) {
      window.setTimeout(() => {
        uploadProgressText.value = ''
      }, 1200)
    }
  }
}

const formatFileSize = (size: number) => {
  const bytes = Number(size || 0)
  if (bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const visibleAttachmentItems = computed(() => {
  return mergeAttachmentList([
    ...attachmentItems.value,
    sourceArchiveAttachmentCache.value
  ].filter(Boolean))
})

const buildAttachments = () => {
  return visibleAttachmentItems.value
}

const hasImageAttachment = computed(() => {
  return buildAttachments().some(item => ['png', 'jpg', 'jpeg'].includes(resolveAttachmentExt(item)))
})

const hasSourceArchiveAttachment = computed(() => {
  return buildAttachments().some(isSourceArchiveAttachmentItem)
})

const hasReportAttachment = computed(() => {
  return buildAttachments().some(isReportAttachmentItem)
})

const hasReportContent = computed(() => {
  return hasReportAttachment.value || !!String(onlineContent.value || '').trim()
})

const fullPracticeCanSubmit = computed(() => {
  if (!isFullPracticeMode.value) return true
  return hasReportContent.value && hasSourceArchiveAttachment.value
})

const uploadAccept = computed(() => {
  return isFullPracticeMode.value
    ? '.zip,.rar,.7z,.pdf,.docx,.md'
    : '.zip,.rar,.7z,.pdf,.docx,.md,.txt,.sql,.xlsx,.xls,.png,.jpg,.jpeg'
})

const parseCsvLabels = (text: string) => {
  return String(text || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
}

const buildChartMeta = () => {
  const meta = {
    chartType: String(chartType.value || '').trim() || undefined,
    chartTitle: String(chartTitle.value || '').trim() || undefined,
    dataLabels: parseCsvLabels(dataLabelsText.value),
    xAxisLabels: parseCsvLabels(xAxisLabelsText.value),
    yAxisLabels: parseCsvLabels(yAxisLabelsText.value),
    legendLabels: parseCsvLabels(legendLabelsText.value)
  }
  const hasMeta = !!(meta.chartType || meta.chartTitle || meta.dataLabels.length || meta.xAxisLabels.length || meta.yAxisLabels.length || meta.legendLabels.length)
  return hasMeta ? meta : null
}

const buildErMeta = () => {
  const entities = parseCsvLabels(erEntitiesText.value)
  const relationships = parseCsvLabels(erRelationshipsText.value)
  if (!entities.length && !relationships.length && !erHasPrimaryKeys.value) {
    return null
  }
  return {
    entities,
    relationships,
    hasPrimaryKeys: !!erHasPrimaryKeys.value
  }
}

const buildStructuredChecks = () => {
  const sqlContent = String(sqlScriptText.value || '').trim()
  const umlContent = String(umlDescriptionText.value || '').trim()
  const erMeta = buildErMeta()
  if (!sqlContent && !umlContent && !erMeta) {
    return null
  }
  return {
    sqlContent: sqlContent || undefined,
    umlContent: umlContent || undefined,
    erMeta: erMeta || undefined
  }
}

const NON_CODE_SUBMISSION_TYPES = ['document', 'excel', 'image', 'any', 'online', 'report', 'non_code', 'sql']
const isFullPracticeMode = computed(() => props.caseMode === 'FULL_PRACTICE')
const isOnlineSubmission = computed(() => {
  if (isFullPracticeMode.value) {
    return true
  }
  const type = String(props.task?.submissionType || '').toLowerCase()
  return NON_CODE_SUBMISSION_TYPES.some(k => type.includes(k)) || (!!type && !type.startsWith('code'))
})

const panelTitle = computed(() => {
  return isFullPracticeMode.value ? '完整实训案例提交台' : '纯编码实战评测台'
})

const panelTagText = computed(() => {
  return isFullPracticeMode.value ? (props.caseModeLabel || '完整实训案例') : 'MCP 智能探针'
})

const panelTagType = computed(() => {
  return isFullPracticeMode.value ? 'warning' : 'success'
})

/** 根据任务 submissionType 及描述推断交付物类型 */
const submissionCategory = computed(() => {
  const type = String(props.task?.submissionType || '').toLowerCase()
  const desc = (String(props.task?.taskDescription || '') + ' ' + String(props.task?.taskRequirements || '')).toLowerCase()
  if (type.includes('sql') || (type.includes('code_file') && desc.includes('.sql'))) return 'sql'
  if (type.includes('report')) return 'report'
  if (type.includes('image') || type.includes('document')) {
    if (desc.includes('图表') || desc.includes('echarts') || desc.includes('柱状') || desc.includes('折线') || desc.includes('饼图')) return 'chart'
    if (desc.includes('er图') || desc.includes('er ') || desc.includes('实体关系') || desc.includes('uml') || desc.includes('类图')) return 'diagram'
    return 'diagram'
  }
  return 'generic'
})

const submissionHintTitle = computed(() => {
  if (isFullPracticeMode.value) {
    return '完整实训案例最终成果提交'
  }
  switch (submissionCategory.value) {
    case 'sql': return 'SQL脚本任务'
    case 'diagram': return '设计图任务'
    case 'chart': return 'ECharts图表任务'
    case 'report': return '实训总结报告'
    default: return '在线提交模式'
  }
})

const submissionHintDesc = computed(() => {
  if (isFullPracticeMode.value) {
    return '本任务不再按子任务拆分提交。完成整个实训后，一次性提交实验报告和源码压缩包；系统会自动从报告文档中提取图示和运行截图进行分析。'
  }
  switch (submissionCategory.value) {
    case 'sql': return '请提交SQL建表脚本，系统将自动校验表结构、主键与外键约束'
    case 'diagram': return '请提交设计图截图并填写结构化信息，Diagram Agent 将自动识别与评分'
    case 'chart': return '请提交ECharts图表截图并填写图表元数据，系统将验证类型与标签完整性'
    case 'report': return '请撰写实训总结报告，汇总各阶段成果与收获'
    default: return '请提交实验成果，系统将用 Diagram Agent 自动解析评分'
  }
})

const onlineTextPlaceholder = computed(() => {
  if (isFullPracticeMode.value) {
    return '请填写最终提交说明。若未单独上传实验报告附件，可在此直接填写完整报告正文；建议包含项目目标、实现过程、运行结果、问题总结与改进建议。'
  }
  return '请填写实验报告正文（可包含实验目的、要求、运行说明、核心代码说明、结果分析等）'
})

const submitActionText = computed(() => {
  if (isFullPracticeMode.value) {
    return props.needResubmit ? '重新提交最终成果并评分' : '提交最终成果并启动评分'
  }
  return props.needResubmit ? '重新提交并评分' : '提交并启动Diagram Agent评分'
})

const currentTaskId = computed(() => Number(props.task?.id || 0))

const draftStorageKey = computed(() => {
  return currentTaskId.value ? `online_submission_draft_${currentTaskId.value}` : ''
})

const formatSavedAt = (value: any) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

const persistLocalDraft = () => {
  if (!draftStorageKey.value) return
  const draft = {
    contentText: onlineContent.value,
    attachments: buildAttachments(),
    chartMeta: buildChartMeta(),
    structuredChecks: buildStructuredChecks(),
    savedAt: new Date().toISOString()
  }
  localStorage.setItem(draftStorageKey.value, JSON.stringify(draft))
  draftSavedAt.value = formatSavedAt(draft.savedAt)
}

const readLocalDraft = () => {
  if (!draftStorageKey.value) return null
  const raw = localStorage.getItem(draftStorageKey.value)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const applyDraftData = (draft: any, options: { mergeAttachments?: boolean } = {}) => {
  onlineContent.value = String(draft?.contentText || '')
  const draftAttachments = mergeAttachmentList(Array.isArray(draft?.attachments) ? draft.attachments : [])
  attachmentItems.value = options.mergeAttachments
    ? mergeAttachmentList([...attachmentItems.value, ...draftAttachments])
    : draftAttachments
  syncSourceArchiveCache(attachmentItems.value, !!options.mergeAttachments)
  chartType.value = String(draft?.chartMeta?.chartType || '')
  chartTitle.value = String(draft?.chartMeta?.chartTitle || '')
  dataLabelsText.value = Array.isArray(draft?.chartMeta?.dataLabels) ? draft.chartMeta.dataLabels.join(',') : ''
  xAxisLabelsText.value = Array.isArray(draft?.chartMeta?.xAxisLabels) ? draft.chartMeta.xAxisLabels.join(',') : ''
  yAxisLabelsText.value = Array.isArray(draft?.chartMeta?.yAxisLabels) ? draft.chartMeta.yAxisLabels.join(',') : ''
  legendLabelsText.value = Array.isArray(draft?.chartMeta?.legendLabels) ? draft.chartMeta.legendLabels.join(',') : ''
  sqlScriptText.value = String(draft?.structuredChecks?.sqlContent || '')
  umlDescriptionText.value = String(draft?.structuredChecks?.umlContent || '')
  erEntitiesText.value = Array.isArray(draft?.structuredChecks?.erMeta?.entities) ? draft.structuredChecks.erMeta.entities.join(',') : ''
  erRelationshipsText.value = Array.isArray(draft?.structuredChecks?.erMeta?.relationships) ? draft.structuredChecks.erMeta.relationships.join(',') : ''
  erHasPrimaryKeys.value = !!draft?.structuredChecks?.erMeta?.hasPrimaryKeys
  draftSavedAt.value = formatSavedAt(draft?.savedAt)
}

const saveDraftToServer = async (silent = false) => {
  if (!isOnlineSubmission.value || !currentTaskId.value) return false
  const payload = {
    taskId: currentTaskId.value,
    contentText: onlineContent.value,
    attachments: buildAttachments(),
    chartMeta: buildChartMeta(),
    structuredChecks: buildStructuredChecks()
  }

  try {
    const res = await saveOnlineSubmissionDraft(payload)
    if (res.code !== 200) {
      throw new Error(res.message || '草稿保存失败')
    }
    draftSavedAt.value = formatSavedAt(res?.data?.savedAt || new Date().toISOString())
    return true
  } catch (error: any) {
    if (!silent) {
      ElMessage.warning(error?.message || '服务端草稿保存失败，已转为本地保存')
    }
    return false
  }
}

const saveDraftNow = async () => {
  if (!isOnlineSubmission.value || !draftStorageKey.value) return
  const saved = await saveDraftToServer()
  persistLocalDraft()
  if (saved) {
    ElMessage.success('草稿已保存到云端')
  } else {
    ElMessage.success('草稿已保存到本地')
  }
}

const restoreDraft = async () => {
  if (!isOnlineSubmission.value || !draftStorageKey.value) return

  if (currentTaskId.value) {
    try {
      const res = await getOnlineSubmissionDraft(currentTaskId.value)
      if (res.code === 200 && res.data) {
        applyDraftData(res.data)
        persistLocalDraft()
        ElMessage.success('已从云端恢复草稿')
        return
      }
    } catch {
      // fallback to local draft
    }
  }

  const localDraft = readLocalDraft()
  if (!localDraft) {
    ElMessage.info('当前任务暂无草稿')
    return
  }

  applyDraftData(localDraft)
  ElMessage.success('已从本地恢复草稿')
}

const clearDraft = async () => {
  if (!draftStorageKey.value) return
  if (currentTaskId.value) {
    try {
      await deleteOnlineSubmissionDraft(currentTaskId.value)
    } catch {
      // ignore server delete error and continue clearing local draft
    }
  }
  localStorage.removeItem(draftStorageKey.value)
  draftSavedAt.value = ''
  ElMessage.success('草稿已清空')
}

const queueAutoSaveDraft = () => {
  if (!isOnlineSubmission.value) return
  if (draftTimer) {
    window.clearTimeout(draftTimer)
  }

  draftTimer = window.setTimeout(() => {
    persistLocalDraft()
    void saveDraftToServer(true)
  }, 500)
}

const submitOnline = () => {
  if (isFullPracticeMode.value) {
    if (!hasReportContent.value) {
      ElMessage.warning('请上传实验报告附件，或在提交说明中填写完整实验报告内容')
      return
    }
    if (!hasSourceArchiveAttachment.value) {
      ElMessage.warning('请至少上传一份源码压缩包（ZIP / RAR / 7Z）')
      return
    }
  }
  if (currentTaskId.value) {
    void deleteOnlineSubmissionDraft(currentTaskId.value)
  }
  if (draftStorageKey.value) {
    localStorage.removeItem(draftStorageKey.value)
    draftSavedAt.value = ''
  }
  emit('start-assessment', {
    contentText: onlineContent.value,
    attachments: buildAttachments(),
    chartMeta: buildChartMeta(),
    structuredChecks: buildStructuredChecks()
  })
}

const beforeManualZipUpload = (file: File) => {
  const ext = getFileExt(file?.name || '')
  if (ext !== 'zip') {
    ElMessage.warning('仅支持上传 ZIP 文件')
    return false
  }
  if (file.size > MAX_SINGLE_FILE_SIZE) {
    ElMessage.warning('ZIP 文件不能超过 100MB')
    return false
  }
  return true
}

const uploadManualZip = async (options: any) => {
  const file = options?.file
  if (!file) return
  try {
    const res = await uploadNonCodeAttachment(file, (event: any) => {
      const percent = event?.total ? Math.round((event.loaded / event.total) * 100) : 0
      if (typeof options?.onProgress === 'function') {
        options.onProgress({ percent })
      }
    })

    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || '上传失败')
    }

    manualZipAttachment.value = {
      fileName: res.data.fileName,
      filePath: res.data.filePath,
      fileType: res.data.fileType,
      fileSize: res.data.fileSize
    }
    if (currentTaskId.value) {
      void recordLearningProcess({
        caseId: props.task?.caseId,
        taskId: currentTaskId.value,
        actionType: 'attachment_upload',
        actionLabel: '上传源码压缩包',
        sourcePage: 'student-task-detail',
        attachmentCount: 1,
        detail: {
          fileName: res.data.fileName,
          fileType: res.data.fileType
        }
      }).catch(() => {})
    }
    if (typeof options?.onSuccess === 'function') {
      options.onSuccess(res.data)
    }
    ElMessage.success('ZIP 上传成功')
  } catch (error: any) {
    if (typeof options?.onError === 'function') {
      options.onError(error)
    }
    ElMessage.error(error?.message || 'ZIP 上传失败')
  }
}

const submitManualZip = () => {
  if (!manualZipAttachment.value) {
    ElMessage.warning('请先上传 ZIP 文件')
    return
  }
  emit('start-assessment', {
    manualZip: true,
    contentText: manualZipComment.value || '纯编码实战手动ZIP提交',
    attachments: [manualZipAttachment.value]
  })
}

watch([onlineContent, attachmentItems, sourceArchiveAttachmentCache], () => {
  queueAutoSaveDraft()
}, { deep: true })

watch([chartType, chartTitle, dataLabelsText, xAxisLabelsText, yAxisLabelsText, legendLabelsText], () => {
  queueAutoSaveDraft()
})

watch([sqlScriptText, umlDescriptionText, erEntitiesText, erRelationshipsText, erHasPrimaryKeys], () => {
  queueAutoSaveDraft()
})

onMounted(() => {
  if (!isOnlineSubmission.value || !draftStorageKey.value) return

  const loadDraft = async () => {
    if (currentTaskId.value) {
      try {
        const res = await getOnlineSubmissionDraft(currentTaskId.value)
        if (res.code === 200 && res.data) {
          applyDraftData(res.data, { mergeAttachments: visibleAttachmentItems.value.length > 0 })
          persistLocalDraft()
          return
        }
      } catch {
        // fallback to local draft
      }
    }

    const localDraft = readLocalDraft()
    if (localDraft) {
      applyDraftData(localDraft, { mergeAttachments: visibleAttachmentItems.value.length > 0 })
    }
  }

  void loadDraft()
})

const reversedSteps = computed(() => {
  if (!props.gradingProgressSteps) return []
  return [...props.gradingProgressSteps].reverse()
})

const toggleProgress = () => {
  if (props.progressPanelVisible) {
    emit('close-progress')
  } else {
    emit('open-progress')
  }
}

const getStepStatusText = (status: string) => {
  const map: Record<string, string> = {
    'success': '完成',
    'running': '执行中',
    'failed': '失败',
    'pending': '等待'
  }
  return map[status] || status
}
</script>

<style scoped lang="scss">
$primary: #00b96b;
$success: #00b96b;
$warning: #ff9800;
$danger: #ff4d4f;
$bg-light: #f0fdf4;
$text-main: #2c3e50;
$text-sub: #8c959f;

.submission-card-wrapper {
  margin-bottom: 24px;
}

.upload-card {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-shadow: none; /* Removed shadow */
  background: #ffffff;
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    border-color: #dcdfe6;
  }

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #f0f2f5;
    background: #fff;
  }

  :deep(.el-card__body) {
    padding: 24px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .icon-box {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: transparent; /* Removed background */
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333; /* Dark color */
      font-size: 20px;
    }

    .title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
    }
  }
}

.smart-submission-hint {
  background: #fff; /* White background */
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  border: 1px solid #ebeef5; /* Light border */

  .hint-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;

    .hint-icon {
      color: #606266; /* Grey icon */
      font-size: 20px;
      margin-top: 2px;
    }

    .hint-text {
      h4 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #1a1a1a;
      }
      p {
        margin: 0;
        font-size: 13px;
        color: #606266;
        line-height: 1.4;
      }
    }
  }

  .mcp-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #909399;
    padding-top: 12px;
    border-top: 1px solid #ebeef5;

    .address {
      background: #f5f7fa;
      padding: 2px 6px;
      border-radius: 4px;
      color: #606266;
      font-family: 'JetBrains Mono', monospace;
    }
  }

  .doc-requirement-list {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #ebeef5;

    .req-title {
      font-size: 12px;
      color: #606266;
      margin-bottom: 6px;
      font-weight: 600;
    }

    ul {
      margin: 0;
      padding-left: 18px;
      color: #606266;
      font-size: 12px;
      line-height: 1.6;
    }

    .req-note {
      margin-top: 6px;
      font-size: 12px;
      color: #909399;
    }
  }
}

.status-state {
  text-align: center;
  padding: 20px 0;

  .state-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }

  h3 {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
  }

  p {
    margin: 0;
    color: #606266;
    font-size: 14px;
  }

  &.success {
    .state-icon { color: #67c23a; }
  }

  &.reject {
    .state-icon { color: #f56c6c; }
    
    .reason-box {
      background: #fef0f0;
      padding: 8px 12px;
      border-radius: 6px;
      display: inline-block;
      margin-top: 8px;
      font-size: 13px;
      color: #f56c6c;
      text-align: left;
    }
  }

  .action-area {
    margin-top: 16px;
  }
}

.action-area {
  margin-bottom: 20px;

  .draft-actions {
    width: 100%;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
    margin-bottom: 8px;

    .draft-tip {
      font-size: 12px;
      color: #8c959f;
    }
  }

  .start-btn {
    width: 100%;
    height: 48px;
    border: 1px solid #00b96b;
    border-radius: 8px;
    background: #00b96b; /* Primary Green */
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 185, 107, 0.2);

    .btn-content, .btn-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 2;
    }

    .btn-bg {
      display: none;
    }

    &:hover:not(:disabled) {
      background: #00a05c;
      border-color: #00a05c;
      box-shadow: 0 6px 16px rgba(0, 185, 107, 0.3);
      transform: translateY(-1px);
    }
    
    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(0, 185, 107, 0.2);
    }
    
    &:disabled {
      background: #a0dcc2;
      border-color: #a0dcc2;
      box-shadow: none;
      cursor: not-allowed;
    }
  }

  .status-text {
    margin-top: 12px;
    text-align: center;
    font-size: 13px;
    color: $text-sub;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .warning-text {
    color: #d97706;
  }
}

.online-submit-form {
  margin-bottom: 20px;

  :deep(.el-textarea__inner) {
    border-radius: 8px;
  }

  .mode-callout {
    margin-bottom: 12px;
    padding: 12px 14px;
    border-radius: 8px;
    background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%);
    border: 1px solid #fde7c7;

    .mode-callout-title {
      font-size: 13px;
      font-weight: 700;
      color: #9a3412;
      margin-bottom: 4px;
    }

    .mode-callout-desc {
      font-size: 12px;
      line-height: 1.6;
      color: #7c5a28;
    }
  }

  .attachment-section {
    margin-top: 12px;
    margin-bottom: 14px;
    padding: 10px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    background: #fafbfc;

    .attachment-title {
      font-size: 13px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 8px;
    }

    .upload-box {
      margin-bottom: 8px;

      :deep(.el-upload-dragger) {
        width: 100%;
        border-radius: 8px;
        border: 1px dashed #dcdfe6;
        background: #ffffff;
        padding: 16px 12px;
      }

      :deep(.el-upload-dragger:hover) {
        border-color: #409eff;
      }

      .upload-drag-icon {
        font-size: 24px;
        color: #409eff;
        margin-bottom: 6px;
      }

      .upload-drag-text {
        font-size: 13px;
        color: #303133;
        margin-bottom: 4px;
      }

      .upload-drag-tip {
        font-size: 12px;
        color: #909399;
      }
    }

    .upload-status {
      font-size: 12px;
      color: #606266;
      margin-bottom: 8px;
    }

    .attachment-item {
      display: grid;
      grid-template-columns: 28px 1.2fr 1.8fr 0.9fr 0.9fr auto;
      gap: 8px;
      margin-bottom: 8px;
      align-items: center;

      .attachment-icon {
        color: #606266;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .attachment-name,
      .attachment-path,
      .attachment-type,
      .attachment-size {
        font-size: 12px;
        color: #606266;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .attachment-name {
        color: #303133;
        font-weight: 500;
      }
    }

    .deliverable-checklist {
      margin-top: 12px;
      display: grid;
      gap: 8px;

      .deliverable-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 8px;
        background: #fff;
        border: 1px solid #e5e7eb;

        &.ready {
          border-color: #b7ebc6;
          background: #f6ffed;
        }

      }

      .deliverable-name {
        font-size: 13px;
        font-weight: 600;
        color: #303133;
      }
    }
  }
}

.progress-section {
  border: 1px solid #eef2f6;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
  background: #fff;

  .progress-header {
    padding: 12px 16px;
    background: #f8fafc;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    font-size: 13px;
    color: $text-main;
    font-weight: 500;
    transition: background 0.2s;

    &:hover {
      background: #f1f5f9;
    }

    .label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: $primary;
    }

    .el-icon {
      transition: transform 0.3s;
      &.is-active {
        transform: rotate(180deg);
      }
    }
  }

  .progress-body {
    padding: 16px;
  }

  .progress-bar-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;

    .progress-track {
      flex: 1;
      height: 6px;
      background: #eef2f6;
      border-radius: 3px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background: $primary;
        border-radius: 3px;
        transition: width 0.3s ease;
      }
    }

    .progress-val {
      font-size: 12px;
      font-weight: 600;
      color: $primary;
      width: 36px;
      text-align: right;
    }
  }

  .progress-message {
    margin: -8px 0 16px;
    font-size: 12px;
    line-height: 1.5;
    color: $text-sub;
  }

  .step-timeline {
    max-height: 300px;
    overflow-y: auto;
    padding-left: 4px;

    .step-item {
      display: flex;
      gap: 12px;
      padding-bottom: 16px;
      position: relative;

      &:last-child {
        padding-bottom: 0;
        
        .step-left .step-line {
          display: none;
        }
      }

      .step-left {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 16px;

        .step-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #eef2f6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #fff;
          z-index: 2;

          .dot-inner {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #cbd5e1;
          }
        }

        .step-line {
          flex: 1;
          width: 2px;
          background: #f1f5f9;
          margin-top: 4px;
        }
      }

      .step-content {
        flex: 1;
        padding-top: -2px;

        .step-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 4px;

          .name {
            font-size: 13px;
            color: $text-main;
            font-weight: 500;
          }

          .status-tag {
            font-size: 11px;
            padding: 1px 6px;
            border-radius: 4px;
            background: #f1f5f9;
            color: $text-sub;

            &.success { color: $success; background: rgba($success, 0.1); }
            &.running { color: $warning; background: rgba($warning, 0.1); }
            &.failed { color: $danger; background: rgba($danger, 0.1); }
          }
        }

        .step-msg {
          font-size: 12px;
          color: $text-sub;
          line-height: 1.4;
        }
      }

      &.success {
        .step-dot { background: $success; }
      }
      &.running {
        .step-dot { background: $warning; }
      }
      &.failed {
        .step-dot { background: $danger; }
      }
    }
  }
}

.footer-links {
  text-align: center;
  
  .el-button {
    color: $text-sub;
    &:hover { color: $primary; }
  }
}

// Transitions
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  opacity: 1;
}
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
}
</style>
