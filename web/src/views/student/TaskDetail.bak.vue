<template>
  <div class="task-detail-container">
    <div class="page-header">
      <el-button @click="handleGoBack" icon="ArrowLeft" circle class="back-btn" />
      <div class="header-content">
        <h2 class="page-title">{{ task?.taskDescription || '任务详情' }}</h2>
        <div class="status-badge" v-if="task">
          <el-tag :type="getStatusType(task.status)" effect="dark" round>
            {{ getStatusText(task.status) }}
          </el-tag>
        </div>
      </div>
    </div>

    <div class="content-layout" v-if="task">
      <!-- 左侧：任务信息 -->
      <div class="left-panel">
        <el-card shadow="never" class="info-card">
          <template #header>
            <div class="card-header">
              <span class="title"><el-icon><InfoFilled /></el-icon> 任务信息</span>
            </div>
          </template>
          
          <div class="info-list">
            <div class="info-item">
              <span class="label">任务描述</span>
              <div class="value description">{{ task.taskDescription }}</div>
            </div>
            <div class="info-item">
              <span class="label">任务要求</span>
              <div class="value requirements">{{ task.taskRequirements }}</div>
            </div>
            <div class="info-item">
              <span class="label">截止时间</span>
              <div class="value time">
                <el-icon><Timer /></el-icon> {{ task.deadline }}
              </div>
            </div>
          </div>
        </el-card>

        <!-- 模拟数据展示 -->
        <el-card shadow="never" class="data-card" v-if="parsedInstanceData">
          <template #header>
            <div class="card-header">
              <span class="title"><el-icon><DataLine /></el-icon> 实训数据集</span>
              <div class="header-actions">
                <el-tag size="small" type="warning" effect="plain">专属数据</el-tag>
                <el-button-group size="small">
                  <el-button type="primary" plain @click="exportToSQL">
                    <el-icon><Download /></el-icon> SQL
                  </el-button>
                  <el-button type="success" plain @click="exportToCSV">
                    <el-icon><Download /></el-icon> CSV
                  </el-button>
                </el-button-group>
              </div>
            </div>
          </template>
          
          <div class="data-notice">
            <el-alert 
              title="这是为你生成的专属模拟数据，请根据此数据完成任务" 
              type="info" 
              :closable="false"
              show-icon
            />
          </div>

          <!-- 数据使用说明 -->
          <div v-if="dataUsageHint" class="data-usage-hint">
            <div class="hint-title"><el-icon><InfoFilled /></el-icon> 数据使用说明</div>
            <div class="hint-content">{{ dataUsageHint }}</div>
          </div>

          <!-- 表结构信息 -->
          <div v-if="tableStructure" class="table-structure">
            <div class="structure-header">
              <span class="table-name">{{ tableStructure.tableName }}</span>
              <span class="table-comment" v-if="tableStructure.tableComment">{{ tableStructure.tableComment }}</span>
            </div>
            <el-table :data="tableStructure.columns" size="small" border class="structure-table">
              <el-table-column prop="name" label="列名" width="120" />
              <el-table-column prop="type" label="类型" width="120" />
              <el-table-column prop="comment" label="说明" />
              <el-table-column label="约束" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.primaryKey" size="small" type="danger">主键</el-tag>
                  <el-tag v-else-if="!row.nullable" size="small" type="warning">非空</el-tag>
                  <span v-else class="nullable-text">可空</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
          
          <!-- 表格形式展示数据 -->
          <div v-if="parsedInstanceData.columns && parsedInstanceData.rows" class="data-table-wrapper">
            <div class="data-table-title">数据预览（{{ parsedInstanceData.rows.length }} 行）</div>
            <el-table 
              :data="parsedInstanceData.rows" 
              border 
              size="small"
              max-height="300"
              stripe
            >
              <el-table-column 
                v-for="col in parsedInstanceData.columns" 
                :key="col" 
                :prop="col" 
                :label="col"
                min-width="100"
              />
            </el-table>
          </div>
          
          <!-- JSON 原始数据（可折叠） -->
          <el-collapse class="data-collapse">
            <el-collapse-item title="查看原始 JSON 数据" name="json">
              <pre class="json-preview">{{ formatJson(parsedInstanceData) }}</pre>
            </el-collapse-item>
          </el-collapse>
        </el-card>

        <!-- 任务操作步骤引导 -->
        <el-card shadow="never" class="guide-card">
          <template #header>
            <div class="card-header">
              <span class="title"><el-icon><Guide /></el-icon> 操作步骤</span>
            </div>
          </template>
          <el-steps :active="currentStep" finish-status="success" simple class="task-steps">
            <el-step title="阅读任务" :icon="Reading" />
            <el-step title="下载数据" :icon="Download" />
            <el-step title="本地开发" :icon="Monitor" />
            <el-step title="自动提交" :icon="Upload" />
          </el-steps>
          <div class="step-hint">
            {{ stepHints[currentStep] }}
          </div>
        </el-card>

        <el-card shadow="never" class="upload-card">
          <template #header>
            <div class="card-header">
              <span class="title"><el-icon><Upload /></el-icon> 自动提交评测</span>
            </div>
          </template>

          <div class="smart-submission-hint">
            <el-alert type="info" :closable="false" show-icon>
              <template #title>
                <span class="hint-title">MCP 自动评测</span>
              </template>
              <div class="hint-body">
                <p>启动本地项目后，点击下方按钮即可自动采集源码并完成评测。</p>
                <p>默认探针地址：<code>http://localhost:8080/mcp</code>（支持自动端口探测）</p>
              </div>
            </el-alert>

            <div class="mcp-guide-actions">
              <el-button type="primary" plain size="small" @click="dependencyGuideVisible = true">
                手动引入依赖（弹窗教程）
              </el-button>
            </div>
          </div>

          <!-- 已通过验收提示 -->
          <div v-if="isTaskPassed" class="passed-notice">
            <el-result icon="success" title="任务已验收通过" sub-title="恭喜！该任务已完成验收，无需再次提交。">
            </el-result>
          </div>

          <!-- 被打回提示 -->
          <div v-else-if="task.status === 5 && latestSubmission" class="reject-notice">
            <el-result icon="warning" title="作业已被打回" sub-title="请根据教师反馈修改后重新提交">
              <template #extra>
                <el-alert 
                  :title="`打回原因：${latestSubmission.rejectReason || '暂无'}`" 
                  type="error" 
                  :closable="false"
                  show-icon
                />
              </template>
            </el-result>
          </div>

          <!-- 验收失败提示 -->
          <div v-else-if="task.status === 4 && latestSubmission" class="fail-notice">
            <el-alert 
              title="验收未通过，请修改后重新提交" 
              type="warning" 
              :closable="false"
              show-icon
            />
          </div>

          <div v-if="!isTaskPassed" class="mcp-submit-panel">
            <el-button type="primary" :loading="mcpAssessing" @click="startMcpAssessment">
              {{ mcpAssessing ? '自动评测中...' : (needResubmit ? '重新发起自动评测' : '开始自动评测') }}
            </el-button>
            <div class="mcp-status" v-if="mcpStatusText">{{ mcpStatusText }}</div>
          </div>
        </el-card>
      </div>

      <!-- 右侧：提交记录 -->
      <div class="right-panel">
        <el-card shadow="never" class="history-card">
          <template #header>
            <div class="card-header">
              <span class="title"><el-icon><List /></el-icon> 提交历史</span>
            </div>
          </template>

          <div class="timeline-container">
            <el-timeline v-if="submissions.length > 0">
              <el-timeline-item
                v-for="(sub, index) in submissions"
                :key="index"
                :timestamp="sub.submissionTime"
                :type="index === 0 ? 'primary' : ''"
                :hollow="index !== 0"
              >
                <div class="submission-card">
                  <div class="file-info">
                    <el-icon class="file-icon"><Document /></el-icon>
                    <span class="file-name" :title="sub.fileName">{{ sub.fileName }}</span>
                  </div>
                  <div class="submission-status">
                    <el-tag size="small" :type="getSubmissionStatusType(sub)">
                      {{ getSubmissionStatusText(sub) }}
                    </el-tag>
                    <div class="action-btns">
                      <el-button 
                        type="primary" 
                        link 
                        size="small" 
                        @click="handleViewValidation(sub)"
                      >
                        查看报告
                      </el-button>
                      <el-popconfirm
                        title="确定删除这条提交记录吗？"
                        confirm-button-text="删除"
                        cancel-button-text="取消"
                        @confirm="handleDeleteSubmission(sub)"
                      >
                        <template #reference>
                          <el-button 
                            type="danger" 
                            link 
                            size="small"
                          >
                            删除
                          </el-button>
                        </template>
                      </el-popconfirm>
                    </div>
                  </div>
                </div>
              </el-timeline-item>
            </el-timeline>
            <el-empty v-else description="暂无提交记录" :image-size="80" />
          </div>
        </el-card>
      </div>
    </div>
    
    <el-skeleton v-else :rows="10" animated />

    <el-dialog
      v-model="dependencyGuideVisible"
      title="MCP 探针手动引入教程"
      width="680px"
      destroy-on-close
      class="dependency-guide-dialog"
    >
      <div class="dependency-guide-content">
        <ol>
          <li>打开本地项目的 <code>pom.xml</code>。</li>
          <li>在 <code>&lt;project&gt;</code> 内添加私服仓库地址（若已有可跳过）。</li>
          <li>在 <code>&lt;dependencies&gt;</code> 中添加 <code>mcp-core</code> 依赖。</li>
          <li>执行 Maven 刷新并重启项目后，再点击“开始自动评测”。</li>
        </ol>

        <div class="maven-snippet-block">
          <div class="snippet-header">
            <span>1) 仓库地址</span>
            <el-button size="small" text type="primary" @click="copyMavenSnippet(mavenRepoSnippet)">复制</el-button>
          </div>
          <pre>{{ mavenRepoSnippet }}</pre>
        </div>

        <div class="maven-snippet-block">
          <div class="snippet-header">
            <span>2) 依赖配置</span>
            <el-button size="small" text type="primary" @click="copyMavenSnippet(mavenDependencySnippet)">复制</el-button>
          </div>
          <pre>{{ mavenDependencySnippet }}</pre>
        </div>
      </div>

      <template #footer>
        <el-button @click="dependencyGuideVisible = false">我已完成配置</el-button>
      </template>
    </el-dialog>

    <!-- 结果弹窗 -->
    <el-dialog 
      v-model="resultDialogVisible" 
      title="实训验收报告" 
      width="800px"
      destroy-on-close
      class="result-dialog"
    >
      <div v-loading="resultLoading" class="result-content">
        <div v-if="resultError" class="error-state">
          <el-empty description="获取结果失败" :image-size="100">
            <template #description>
              <p>{{ resultError }}</p>
            </template>
          </el-empty>
        </div>

        <div v-else-if="isGrading(currentSubmission)" class="grading-state">
          <el-result icon="info" title="AI智能评分中" :sub-title="gradingProgressMessage || '系统正在对您的作业进行智能分析，请稍候...'">
            <template #extra>
              <el-progress :percentage="100" :indeterminate="true" :duration="3" status="" />
              <div class="progress-hint" style="margin-top: 16px; color: #909399; font-size: 14px;">
                <el-icon><Loading /></el-icon>
                {{ gradingProgressMessage || '正在评分中...' }}
              </div>
            </template>
          </el-result>
        </div>

        <template v-else-if="validation">
          <div class="score-card">
            <div class="score-circle" :class="{ pass: displayScore >= 60, fail: displayScore < 60 }">
              <span class="score">{{ displayScore }}</span>
              <span class="label">总分</span>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">任务名称</span>
                <span class="value">{{ task?.taskDescription }}</span>
              </div>
              <div class="info-item">
                <span class="label">提交文件</span>
                <span class="value">{{ currentSubmission?.fileName || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">验收状态</span>
                <el-tag size="small" :type="displayScore >= 60 ? 'success' : 'danger'">
                  {{ displayScore >= 60 ? '通过' : '未通过' }}
                </el-tag>
              </div>
              <div class="info-item" v-if="dialogGradingResult?.gradingDurationMs">
                <span class="label">AI评分耗时</span>
                <span class="value duration">
                  <el-icon><Timer /></el-icon>
                  {{ formatDuration(dialogGradingResult.gradingDurationMs) }}
                </span>
              </div>
            </div>
          </div>

          <div class="feedback-section" v-if="dialogGradingResult?.overallFeedback || dialogGradingResult?.teacherFeedback || validation.feedback">
            <div class="section-title">
              <el-icon><ChatLineSquare /></el-icon>
              反馈评价
            </div>
            <div class="feedback-content">
               <div v-if="dialogGradingResult?.overallFeedback" class="feedback-item ai">
                  <div class="feedback-label"><el-icon><MagicStick /></el-icon> AI 评价</div>
                  <div class="feedback-text">{{ dialogGradingResult.overallFeedback }}</div>
               </div>
               <div v-if="dialogGradingResult?.teacherFeedback" class="feedback-item teacher">
                  <div class="feedback-label"><el-icon><User /></el-icon> 教师评语</div>
                  <div class="feedback-text">{{ dialogGradingResult.teacherFeedback }}</div>
               </div>
               <div v-if="!dialogGradingResult && validation.feedback" class="feedback-item auto">
                  <div class="feedback-label">自动反馈</div>
                  <div class="feedback-text">{{ validation.feedback }}</div>
               </div>
            </div>
          </div>

          <!-- 改进建议区域 -->
          <div class="improvement-section" v-if="displayScore < 60 && dialogGradingResult?.details">
            <div class="section-title">
              <el-icon><TrendCharts /></el-icon>
              改进建议
            </div>
            <div class="improvement-list">
              <div v-for="item in lowScoreItems" :key="item.criterionName" class="improvement-item">
                <div class="item-header">
                  <el-icon class="warning-icon"><Warning /></el-icon>
                  <span class="criterion-name">{{ item.criterionName }}</span>
                  <span class="score-badge">{{ item.finalScore }}/{{ item.maxScore }}</span>
                </div>
                <div class="item-reason">{{ item.aiReason }}</div>
              </div>
            </div>
          </div>

          <div class="details-section">
            <div class="section-title">
              <el-icon><List /></el-icon>
              评分细则
            </div>
            <!-- 教师评分细则 -->
            <div v-if="dialogGradingResult && dialogGradingResult.details" class="rubric-list">
               <div v-for="item in dialogGradingResult.details" :key="item.id" class="rubric-item">
                  <div class="rubric-header">
                    <span class="rubric-name">{{ item.criterionName }}</span>
                    <div class="rubric-score">
                       <span class="score-val">{{ item.finalScore }}</span>
                       <span class="score-max">/ {{ item.maxScore }}</span>
                    </div>
                  </div>
                  <div class="rubric-desc">{{ item.criterionDescription }}</div>
                  <div class="rubric-feedback">
                     <div v-if="item.aiReason" class="ai-reason">
                        <span class="tag">AI</span> {{ item.aiReason }}
                     </div>
                     <div v-if="item.teacherComment" class="teacher-comment">
                        <span class="tag teacher">教师</span> {{ item.teacherComment }}
                     </div>
                  </div>
               </div>
            </div>

            <!-- 自动验收细则 -->
            <el-table
              v-else-if="(validation.validationItems || []).length"
              :data="validation.validationItems"
              size="small"
              border
              style="width: 100%"
            >
              <el-table-column prop="validationType" label="检查项" width="140">
                <template #default="{ row }">
                  {{ getValidationTypeText(row.validationType) }}
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" show-overflow-tooltip />
              <el-table-column prop="isPassed" label="通过" width="80" align="center">
                <template #default="{ row }">
                  <el-icon v-if="row.isPassed" color="#67c23a"><Select /></el-icon>
                  <el-icon v-else color="#f56c6c"><CloseBold /></el-icon>
                </template>
              </el-table-column>
              <el-table-column label="得分" width="100" align="center">
                <template #default="{ row }">
                  <span :class="{ 'score-gain': row.score > 0 }">{{ row.score }} / {{ row.maxScore }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="errorMessage" label="错误信息" show-overflow-tooltip>
                <template #default="{ row }">
                  <span class="error-text">{{ row.errorMessage || '-' }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <el-empty v-else description="暂无验收数据" />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="resultDialogVisible = false">关闭</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { InfoFilled, Timer, Upload, List, Document, ChatLineSquare, MagicStick, User, Select, CloseBold, DataLine, Download, Monitor, Guide, Reading, TrendCharts, Warning } from '@element-plus/icons-vue'
// @ts-ignore
import { getTaskSubmissions, getTaskDetail, getValidationResult, deleteSubmission, submitMcpAssessment } from '@/api/student/task'
// @ts-ignore
import { getAiGradingResult, getAiGradingResultBySubmission } from '@/api/teacher/grading'

const router = useRouter()
const route = useRoute()
const task = ref<any>(null)
const submissions = ref<any[]>([])
const taskId = ref(route.params.id)
const mcpAssessing = ref(false)
const mcpStatusText = ref('')
const dependencyGuideVisible = ref(false)

// 结果弹窗相关
const resultDialogVisible = ref(false)
const resultLoading = ref(false)
const resultError = ref('')
const currentSubmission = ref<any>(null)
const validation = ref<any>(null)
const gradingResult = ref<any>(null)
const dialogGradingResult = ref<any>(null)

// SSE评分进度监听
let gradingProgressEventSource: EventSource | null = null
const gradingProgressMessage = ref('')

const displayScore = computed(() => {
  // 优先级：细则累加的最终分数 > dialogGradingResult.totalScore > submission.score > validation.totalScore
  
  // 1. 如果有评分细则，手动累加细则分数（最准确的方式）
  if (dialogGradingResult.value?.details?.length > 0) {
    const total = dialogGradingResult.value.details.reduce((sum: number, item: any) => {
      return sum + (item.finalScore || item.aiScore || 0)
    }, 0)
    return Math.round(total) // 四舍五入到整数
  }
  
  // 2. 使用dialogGradingResult的totalScore
  if (dialogGradingResult.value?.totalScore != null) {
    return Math.round(dialogGradingResult.value.totalScore)
  }
  
  // 3. 使用submission的score
  if (currentSubmission.value?.score != null) {
    return Math.round(currentSubmission.value.score)
  }
  
  // 4. 最后使用validation的totalScore
  return Math.round(validation.value?.totalScore || 0)
})

// 获取低分项目（用于改进建议）
const lowScoreItems = computed(() => {
  if (!dialogGradingResult.value?.details) return []
  return dialogGradingResult.value.details
    .filter((item: any) => {
      const ratio = item.finalScore / item.maxScore
      return ratio < 0.6 // 得分率低于60%的项目
    })
    .sort((a: any, b: any) => (a.finalScore / a.maxScore) - (b.finalScore / b.maxScore))
})

// 判断任务是否已通过验收（基于任务状态判断）
const isTaskPassed = computed(() => {
  // 只有任务状态为3（已通过）时才算通过
  // 不能基于历史提交记录判断，因为可能有旧的通过记录但用户重新提交了
  const passed = task.value?.status === 3
  console.log('🔍 任务状态检查 - taskId:', task.value?.id, 'status:', task.value?.status, 'isTaskPassed:', passed)
  return passed
})

// 判断任务是否需要重新提交（验收失败或被打回）
const needResubmit = computed(() => {
  if (!task.value) return false
  // status=4（未通过）或 status=5（已打回）时需要重新提交
  return task.value.status === 4 || task.value.status === 5
})

// 获取最新的提交记录
const latestSubmission = computed(() => {
  if (submissions.value.length === 0) return null
  // 按提交时间倒序排序，返回第一个
  return submissions.value[0]
})

// 任务步骤引导
const stepHints = [
  '仔细阅读任务描述和要求，理解需要完成的内容',
  '如果有模拟数据，点击"导出SQL"或"导出CSV"下载到本地',
  '在本地 IDE 中完成开发，将数据导入数据库进行测试',
  '启动本地项目并点击“MCP评测”，系统会自动抓取源码并评分'
]

const mavenRepoSnippet = `<repositories>
  <repository>
    <id>mcp-core</id>
    <url>http://8.148.144.119:8081/repository/mcp-core/</url>
  </repository>
</repositories>`

const mavenDependencySnippet = `<dependency>
  <groupId>com.training</groupId>
  <artifactId>mcp-core</artifactId>
  <version>1.0.0</version>
</dependency>`

const copyMavenSnippet = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败，请手动复制')
  }
}

// 计算当前步骤
const currentStep = computed(() => {
  if (isTaskPassed.value) return 4 // 已完成
  if (submissions.value.length > 0) return 3 // 已提交过
  if (parsedInstanceData.value) return 1 // 有数据，提示下载
  return 0 // 初始状态
})

// 解析实例数据（模拟数据）
const parsedInstanceData = computed(() => {
  if (!task.value?.instanceData) return null
  try {
    const data = JSON.parse(task.value.instanceData)
    
    // instanceData 结构: { seed, caseId, studentId, taskSequence, data: { columns, rows } }
    if (data.data) {
      let rawColumns = data.data.columns || []
      const rawRows = data.data.rows || []
      
      // 如果 rows 是二维数组，需要确保 columns 顺序正确
      if (rawRows.length > 0 && Array.isArray(rawRows[0])) {
        // 二维数组格式：rows = [["val1", "val2"], ["val3", "val4"]]
        
        let columns: string[] = []
        if (rawColumns.length > 0) {
          if (typeof rawColumns[0] === 'object') {
            // columns 是对象数组，按 index 字段排序后提取 name
            const sortedCols = [...rawColumns].sort((a: any, b: any) => {
              // 优先按 index 排序
              if (a.index !== undefined && b.index !== undefined) {
                return a.index - b.index
              }
              return 0
            })
            columns = sortedCols.map((col: any) => col.name || col.prop || col.field || 'unknown')
          } else {
            // columns 是字符串数组
            columns = rawColumns
          }
        }
        
        // 将二维数组转换为对象数组
        const rows = rawRows.map((row: any[]) => {
          const obj: Record<string, any> = {}
          columns.forEach((col: string, idx: number) => {
            obj[col] = row[idx] !== undefined ? row[idx] : ''
          })
          return obj
        })
        
        return { columns: [...columns], rows, raw: data }
      } else if (rawRows.length > 0 && typeof rawRows[0] === 'object') {
        // 对象数组格式：rows = [{col1: "val1", col2: "val2"}]
        let columns: string[] = []
        
        if (rawColumns.length > 0) {
          if (typeof rawColumns[0] === 'object') {
            // 按 index 排序
            const sortedCols = [...rawColumns].sort((a: any, b: any) => {
              if (a.index !== undefined && b.index !== undefined) {
                return a.index - b.index
              }
              return 0
            })
            columns = sortedCols.map((col: any) => col.name || col.prop || col.field || 'unknown')
          } else {
            columns = rawColumns
          }
        } else {
          // 如果没有 columns，从第一行数据的 keys 中提取
          columns = Object.keys(rawRows[0])
        }
        
        // 深拷贝 rows
        const rows = rawRows.map((row: Record<string, any>) => ({ ...row }))
        
        return { columns: [...columns], rows, raw: data }
      }
      
      return data
    }
    return data
  } catch (e) {
    console.error('解析实例数据失败', e)
    return null
  }
})

// 获取数据使用说明
const dataUsageHint = computed(() => {
  if (!task.value?.instanceData) return null
  try {
    const data = JSON.parse(task.value.instanceData)
    return data.data_usage || data.dataUsage || null
  } catch {
    return null
  }
})

// 获取表结构信息
const tableStructure = computed(() => {
  if (!task.value?.instanceData) return null
  try {
    const data = JSON.parse(task.value.instanceData)
    const mockData = data.data
    if (!mockData) return null
    
    // 检查是否有表结构信息
    if (mockData.table_name || mockData.tableName) {
      return {
        tableName: mockData.table_name || mockData.tableName,
        tableComment: mockData.table_comment || mockData.tableComment,
        columns: (mockData.columns || []).map((col: any) => {
          // 如果 columns 是字符串数组（旧格式），转换为对象
          if (typeof col === 'string') {
            return { name: col, type: 'VARCHAR(255)', comment: '', nullable: true, primaryKey: false }
          }
          return {
            name: col.name,
            type: col.type || 'VARCHAR(255)',
            comment: col.comment || '',
            nullable: col.nullable !== false,
            primaryKey: col.primary_key || col.primaryKey || false
          }
        })
      }
    }
    return null
  } catch {
    return null
  }
})

// 导出为 SQL
const exportToSQL = () => {
  if (!parsedInstanceData.value) return
  
  const data = parsedInstanceData.value
  const tableName = tableStructure.value?.tableName || 'mock_data'
  const columns = data.columns || []
  const rows = data.rows || []
  
  let sql = `-- 实训数据导出\n-- 生成时间: ${new Date().toLocaleString()}\n\n`
  
  // 生成建表语句
  if (tableStructure.value?.columns?.length) {
    sql += `-- 建表语句\nCREATE TABLE IF NOT EXISTS \`${tableName}\` (\n`
    const colDefs = tableStructure.value.columns.map((col: any) => {
      let def = `  \`${col.name}\` ${col.type}`
      if (col.primaryKey) def += ' PRIMARY KEY'
      else if (!col.nullable) def += ' NOT NULL'
      if (col.comment) def += ` COMMENT '${col.comment}'`
      return def
    })
    sql += colDefs.join(',\n')
    sql += `\n);\n\n`
  }
  
  // 生成插入语句
  if (rows.length > 0) {
    sql += `-- 插入数据\nINSERT INTO \`${tableName}\` (${columns.map((c: string) => `\`${c}\``).join(', ')}) VALUES\n`
    const valueRows = rows.map((row: any) => {
      const values = columns.map((col: string) => {
        const val = row[col]
        if (val === null || val === undefined) return 'NULL'
        if (typeof val === 'number') return val
        return `'${String(val).replace(/'/g, "''")}'`
      })
      return `(${values.join(', ')})`
    })
    sql += valueRows.join(',\n') + ';\n'
  }
  
  downloadFile(sql, `${tableName}_data.sql`, 'text/sql')
  ElMessage.success('SQL 文件已导出')
}

// 导出为 CSV
const exportToCSV = () => {
  if (!parsedInstanceData.value) return
  
  const data = parsedInstanceData.value
  const columns = data.columns || []
  const rows = data.rows || []
  
  // CSV 头部
  let csv = columns.join(',') + '\n'
  
  // CSV 数据行
  rows.forEach((row: any) => {
    const values = columns.map((col: string) => {
      const val = row[col]
      if (val === null || val === undefined) return ''
      const str = String(val)
      // 如果包含逗号、引号或换行，需要用引号包裹
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    csv += values.join(',') + '\n'
  })
  
  const tableName = tableStructure.value?.tableName || 'mock_data'
  downloadFile(csv, `${tableName}_data.csv`, 'text/csv')
  ElMessage.success('CSV 文件已导出')
}

// 下载文件工具函数
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob(['\ufeff' + content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 格式化 JSON 显示（排除 raw 属性避免重复）
const formatJson = (obj: any) => {
  try {
    if (obj && obj.raw) {
      // 只显示 columns 和 rows，不显示 raw（避免重复）
      const { columns, rows } = obj
      return JSON.stringify({ columns, rows }, null, 2)
    }
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

const getValidationTypeText = (type: string) => {
  const map: Record<string, string> = {
    'FILE_EXISTENCE': '文件检查',
    'COMPILE': '编译检查',
    'UNIT_TEST': '单元测试',
    'CHECKSTYLE': '代码规范',
    'KEYWORD': '关键词检查'
  }
  return map[type] || type
}

const getStatusText = (status: number) => {
  const map: Record<number, string> = { 
    1: '待开始', 
    2: '评分中', 
    3: '已通过', 
    4: '未通过',
    5: '已打回' 
  }
  return map[status] || '未知'
}

const getStatusType = (status: number) => {
  const map: Record<number, string> = { 
    1: 'info', 
    2: 'primary', 
    3: 'success',
    4: 'danger',
    5: 'warning'
  }
  return map[status] || ''
}

const formatDuration = (ms: number) => {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}分${remainingSeconds}秒`
}

const isGrading = (sub: any) => {
  // 如果还没加载评分数据，不显示"评分中"（等加载完再判断）
  if (!gradingResult.value) return false
  
  // 只有最新的一次提交才可能是"评分中"状态
  if (submissions.value.length > 0 && sub.id !== submissions.value[0].id) {
    return false
  }
  
  const status = gradingResult.value.gradingStatus
  // pending 或 processing 状态表示正在评分
  return status === 'pending' || status === 'processing'
}

const getSubmissionStatusText = (sub: any) => {
  // 如果正在评分中
  if (isGrading(sub)) {
    return 'AI评分中'
  }

  // 如果状态是5（已打回），优先显示已打回
  if (sub.status === 5) {
    return '已打回'
  }

  // 优先使用分数判断状态（后端已填充）
  if (sub.score != null) {
    return sub.score >= 60 ? '验收通过' : '验收未通过'
  }

  const map: Record<number, string> = {
    2: '已提交',
    3: '验收通过',
    4: '验收未通过',
    5: '已打回'
  }
  return map[sub.status] || '未知'
}

const getSubmissionStatusType = (sub: any) => {
  // 如果正在评分中
  if (isGrading(sub)) {
    return 'warning'
  }

  // 如果状态是5（已打回），显示warning样式
  if (sub.status === 5) {
    return 'warning'
  }

  // 优先使用分数判断状态颜色（后端已填充）
  if (sub.score != null) {
    return sub.score >= 60 ? 'success' : 'danger'
  }

  const map: Record<number, string> = {
    2: 'primary',
    3: 'success',
    4: 'danger',
    5: 'warning'
  }
  return map[sub.status] || 'info'
}

const loadTaskDetail = async () => {
  try {
    console.log('🔄 开始加载任务详情 - taskId:', taskId.value)
    const res = await getTaskDetail(Number(taskId.value))
    console.log('📡 收到API响应 - code:', res.code, 'data.status:', res.data?.status, '完整data:', res.data)
    if (res.code === 200) {
      task.value = res.data
      console.log('📥 任务详情已加载 - taskId:', task.value.id, 'status:', task.value.status, 'statusText:', getStatusText(task.value.status))
      console.log('✅ isTaskPassed计算结果:', task.value?.status === 3, '(status === 3)')
    } else {
      ElMessage.error(res.message || '加载任务详情失败')
    }
  } catch (e) {
    console.error('❌ 加载任务详情失败:', e)
    ElMessage.error('加载任务详情失败')
  }
}

const loadSubmissions = async () => {
  try {
    const res = await getTaskSubmissions(Number(taskId.value))
    submissions.value = res.data || []
  } catch (e) {
    // ElMessage.error('加载提交记录失败')
  }
}

const deduplicateDetails = (details: any[]) => {
  if (!details) return []
  const map = new Map()
  details.forEach(item => {
    map.set(item.criterionName, item)
  })
  return Array.from(map.values())
}

const loadGradingResult = async () => {
  try {
    const res = await getAiGradingResult(Number(taskId.value))
    if (res.code === 200) {
      if (res.data && res.data.details) {
        res.data.details = deduplicateDetails(res.data.details)
      }
      gradingResult.value = res.data
    }
  } catch (e) {
    console.error('加载评分结果失败', e)
  }
}

const handleSubmissionCreated = (response: any, successMessage: string) => {
  if (response.code === 200) {
    ElMessage.success(successMessage)
    
    // 清空当前评分结果，触发"评分中"状态
    gradingResult.value = null
    gradingProgressMessage.value = '正在初始化AI评分...'
    
    // 重新加载任务详情以更新状态
    loadTaskDetail()
    
    // 重新加载提交列表
    loadSubmissions()
    
    // 如果有返回的提交ID，建立SSE连接监听评分进度
    if (response.data && response.data.submissionId) {
      startGradingProgressListener(response.data.submissionId)
    }
    
    // 延迟重新加载评分结果
    setTimeout(() => loadGradingResult(), 2000)
  } else {
    ElMessage.error(response.message || '提交失败')
  }
}

const fetchMcpJson = async (url: string, options?: RequestInit, timeoutMs = 5000) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...(options || {}), signal: controller.signal })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.json()
  } finally {
    window.clearTimeout(timer)
  }
}

const resolveMcpBaseUrl = async () => {
  const ports = [8080, 8081, 8082, 8083]
  for (const port of ports) {
    const base = `http://localhost:${port}`
    try {
      const health = await fetchMcpJson(`${base}/mcp/health`, undefined, 2000)
      if ((health && health.code === 200) || health?.data || health?.msg || health === 'MCP探针正常运行') {
        return base
      }
    } catch (e) {
      // ignore and continue
    }
  }
  throw new Error('未检测到本地MCP探针。请先按页面中的“探针配置教程”完成安装并启动 SpringBoot，再确认 /mcp/health 可访问')
}

const startMcpAssessment = async () => {
  if (mcpAssessing.value) return

  mcpAssessing.value = true
  mcpStatusText.value = '正在检测本地MCP探针...'

  try {
    const baseUrl = await resolveMcpBaseUrl()
    mcpStatusText.value = `已连接探针：${baseUrl}，正在抓取源码...`

    const sourceRes = await fetchMcpJson(`${baseUrl}/mcp/source`, undefined, 10000)
    const sourceCode = sourceRes?.data ?? sourceRes
    if (!sourceCode || typeof sourceCode !== 'object' || Object.keys(sourceCode).length === 0) {
      throw new Error('MCP未返回有效源码数据')
    }

    mcpStatusText.value = '正在执行本地运行测试...'
    let runResult: any = null
    try {
      runResult = await fetchMcpJson(`${baseUrl}/mcp/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: Number(taskId.value),
          taskDescription: task.value?.taskDescription,
          taskRequirements: task.value?.taskRequirements
        })
      }, 10000)
    } catch (e) {
      runResult = { error: String(e) }
    }

    mcpStatusText.value = '正在提交平台并触发AI评分...'
    const response = await submitMcpAssessment({
      taskId: Number(taskId.value),
      sourceCode,
      runResult,
      probeInfo: {
        baseUrl,
        userAgent: navigator.userAgent,
        submittedAt: new Date().toISOString()
      }
    })

    handleSubmissionCreated(response, 'MCP评测提交成功，AI智能评分即将开始')
    mcpStatusText.value = '已提交，等待评分进度...'
  } catch (error: any) {
    console.error('MCP评测失败:', error)
    const msg = error?.message || 'MCP评测失败'
    mcpStatusText.value = msg
    ElMessage.error(msg)
    if (msg.includes('未检测到本地MCP探针')) {
      mcpStatusText.value = `${msg}。请展开上方“未安装探针？查看4步配置教程”按步骤排查后重试。`
    }
  } finally {
    mcpAssessing.value = false
  }
}

// 启动SSE评分进度监听
const startGradingProgressListener = (submissionId: number) => {
  // 关闭旧连接
  if (gradingProgressEventSource) {
    gradingProgressEventSource.close()
    gradingProgressEventSource = null
  }
  
  const backendURL = 'http://localhost:8080/training-system'
  const token = localStorage.getItem('token')
  const sseUrl = `${backendURL}/api/grading/submission/${submissionId}/progress?token=${token}`
  console.log('建立AI评分进度SSE连接:', sseUrl.replace(token || '', '***'))
  
  gradingProgressEventSource = new EventSource(sseUrl)
  
  gradingProgressEventSource.addEventListener('connected', (event) => {
    console.log('评分SSE已连接:', event.data)
    gradingProgressMessage.value = '评分连接已建立'
  })
  
  gradingProgressEventSource.addEventListener('start', (event) => {
    const data = JSON.parse(event.data)
    console.log('评分开始:', data)
    gradingProgressMessage.value = data.message || 'AI评分已开始'
  })
  
  gradingProgressEventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data)
    console.log('评分进度:', data)
    gradingProgressMessage.value = data.message || '评分中...'
  })
  
  gradingProgressEventSource.addEventListener('complete', (event) => {
    const data = JSON.parse(event.data)
    console.log('评分完成:', data)
    gradingProgressMessage.value = data.message || '评分已完成'
    
    // 评分完成，关闭SSE连接
    if (gradingProgressEventSource) {
      gradingProgressEventSource.close()
      gradingProgressEventSource = null
    }
    
    // 自动刷新任务状态、提交列表和评分结果
    ElMessage.success(`AI评分完成！总分：${data.score}`)
    loadTaskDetail()
    loadSubmissions()
    loadGradingResult()
  })
  
  gradingProgressEventSource.addEventListener('error', (event: any) => {
    try {
      const data = JSON.parse(event.data)
      console.error('评分错误:', data)
      gradingProgressMessage.value = data.message || '评分失败'
      ElMessage.error(data.message || '评分失败')
    } catch (e) {
      console.error('评分SSE错误')
    }
    
    // 关闭连接
    if (gradingProgressEventSource) {
      gradingProgressEventSource.close()
      gradingProgressEventSource = null
    }
  })
  
  gradingProgressEventSource.onerror = (event) => {
    console.error('评分SSE连接错误:', event)
    if (gradingProgressEventSource?.readyState === EventSource.CLOSED) {
      gradingProgressMessage.value = '评分连接已关闭'
    }
  }
}

const handleViewValidation = async (sub: any) => {
  currentSubmission.value = sub
  resultDialogVisible.value = true
  resultLoading.value = true
  resultError.value = ''
  validation.value = null
  dialogGradingResult.value = null
  
  try {
    // 1. 获取验收结果
    const valRes = await getValidationResult(sub.id)
    validation.value = valRes.data

    // 2. 获取该提交的独立评分细则（按 submissionId）
    try {
      const gradeRes = await getAiGradingResultBySubmission(sub.id)
      if (gradeRes.code === 200) {
        if (gradeRes.data && gradeRes.data.details) {
          gradeRes.data.details = deduplicateDetails(gradeRes.data.details)
        }
        dialogGradingResult.value = gradeRes.data
      }
    } catch (e) {
      console.error('获取评分细则失败', e)
    }
  } catch (e) {
    resultError.value = '获取数据失败'
  } finally {
    resultLoading.value = false
  }
}

const handleDeleteSubmission = async (sub: any) => {
  console.log('🗑️ 开始删除提交记录 - submissionId:', sub.id)
  
  try {
    const res = await deleteSubmission(sub.id)
    console.log('📥 删除接口响应:', res)
    
    if (res.code === 200) {
      ElMessage.success('删除成功')
      
      // 立即从本地列表中移除该记录（优化用户体验）
      const index = submissions.value.findIndex(s => s.id === sub.id)
      if (index > -1) {
        submissions.value.splice(index, 1)
        console.log('✅ 已从本地列表移除，当前列表长度:', submissions.value.length)
      }
      
      // 重新加载提交列表（确保数据同步）
      console.log('🔄 重新加载提交列表...')
      await loadSubmissions()
      console.log('✅ 提交列表已刷新，新列表长度:', submissions.value.length)
      
      // 重新加载任务信息（更新任务状态）
      console.log('🔄 重新加载任务信息...')
      await loadTaskDetail()
      
      // 重新加载评分结果
      gradingResult.value = null
      await loadGradingResult()
    } else {
      console.error('❌ 删除失败:', res.message)
      ElMessage.error(res.message || '删除失败')
    }
  } catch (e: any) {
    console.error('❌ 删除异常:', e)
    ElMessage.error(e.message || '删除失败')
  }
}

const handleGoBack = () => {
  router.back()
}

onMounted(() => {
  loadTaskDetail()
  loadSubmissions()
  loadGradingResult()
})

onUnmounted(() => {
  // 清理SSE连接
  if (gradingProgressEventSource) {
    gradingProgressEventSource.close()
    gradingProgressEventSource = null
  }
})
</script>

<style scoped lang="scss">
.task-detail-container {
  max-width: 1200px;
  margin: 0 auto;
  
  .page-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    
    .back-btn {
      border: none;
      background: transparent;
      font-size: 18px;
      &:hover {
        background: #f0f2f5;
      }
    }
    
    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .page-title {
        font-size: 20px;
        font-weight: 600;
        color: #303133;
        margin: 0;
      }
    }
  }
}

.passed-notice {
  padding: 20px;
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  border-radius: 8px;
  
  :deep(.el-result__title) {
    color: #67c23a;
  }
}

.content-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  align-items: start;
}

.result-dialog {
  :deep(.el-dialog__body) {
    padding: 20px;
    max-height: 70vh;
    overflow-y: auto;
  }
}

.score-card {
  display: flex;
  align-items: center;
  gap: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 24px;

  .score-circle {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border: 4px solid #ebeef5;
    background: #fff;

    &.pass {
      border-color: #67c23a;
      color: #67c23a;
      background: #f0f9eb;
    }

    &.fail {
      border-color: #f56c6c;
      color: #f56c6c;
      background: #fef0f0;
    }

    .score {
      font-size: 32px;
      font-weight: bold;
      line-height: 1;
    }

    .label {
      font-size: 12px;
      margin-top: 4px;
      color: #909399;
    }
  }

  .info-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .label {
        font-size: 12px;
        color: #909399;
      }

      .value {
        font-size: 14px;
        color: #303133;
        font-weight: 500;
      }
    }
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.feedback-section {
  margin-bottom: 24px;

  .feedback-content {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .feedback-item {
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #ebeef5;
      background: #fff;

      &.ai {
        background: #f0f9eb;
        border-color: #e1f3d8;
        .feedback-label { color: #67c23a; }
      }

      &.teacher {
        background: #fdf6ec;
        border-color: #faecd8;
        .feedback-label { color: #e6a23c; }
      }

      &.auto {
        background: #f4f4f5;
        border-color: #e9e9eb;
        .feedback-label { color: #909399; }
      }

      .feedback-label {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .feedback-text {
        font-size: 14px;
        color: #606266;
        line-height: 1.6;
      }
    }
  }
}

// 改进建议区域
.improvement-section {
  margin-bottom: 24px;
  
  .improvement-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .improvement-item {
    background: #fef0f0;
    border: 1px solid #fde2e2;
    border-radius: 6px;
    padding: 12px 16px;
    
    .item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      
      .warning-icon {
        color: #f56c6c;
        font-size: 16px;
      }
      
      .criterion-name {
        font-weight: 600;
        color: #303133;
        flex: 1;
      }
      
      .score-badge {
        background: #f56c6c;
        color: #fff;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 500;
      }
    }
    
    .item-reason {
      font-size: 13px;
      color: #606266;
      line-height: 1.6;
      padding-left: 24px;
    }
  }
}

.rubric-list {
  .rubric-item {
    border: 1px solid #ebeef5;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 12px;
    
    .rubric-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      .rubric-name { font-weight: 600; color: #303133; }
      .rubric-score {
        .score-val { font-weight: bold; color: #409eff; font-size: 16px; }
        .score-max { color: #909399; font-size: 12px; }
      }
    }
    
    .rubric-desc {
      font-size: 13px;
      color: #909399;
      margin-bottom: 12px;
    }
    
    .rubric-feedback {
      background: #f9fafc;
      padding: 10px;
      border-radius: 4px;
      font-size: 13px;
      
      .ai-reason, .teacher-comment {
        margin-bottom: 6px;
        &:last-child { margin-bottom: 0; }
        
        .tag {
          display: inline-block;
          padding: 0 4px;
          border-radius: 2px;
          font-size: 12px;
          margin-right: 6px;
          
          &.teacher { background: #fdf6ec; color: #e6a23c; }
          &:not(.teacher) { background: #e6f7ff; color: #409eff; }
        }
      }
    }
  }
}

.score-gain {
  color: #67c23a;
  font-weight: bold;
}
.error-text {
  color: #f56c6c;
  font-size: 12px;
}

.info-card, .upload-card, .history-card, .data-card, .guide-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  margin-bottom: 24px;
  
  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .card-header {
    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #303133;
      font-size: 15px;
    }
  }
}

// 步骤引导卡片
.guide-card {
  .task-steps {
    margin-bottom: 16px;
  }
  
  .step-hint {
    background: #f0f9eb;
    border: 1px solid #e1f3d8;
    border-radius: 6px;
    padding: 12px 16px;
    font-size: 13px;
    color: #67c23a;
    line-height: 1.6;
  }
}

// 智能提交提示
.smart-submission-hint {
  margin-bottom: 20px;
  
  .hint-title {
    font-weight: 600;
  }
  
  .hint-body {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.8;
    
    p {
      margin: 0 0 4px 0;
    }
    
    code {
      background: #fff5e6;
      padding: 2px 6px;
      border-radius: 3px;
      color: #e6a23c;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    
    .hint-tip {
      margin-top: 8px;
      color: #909399;
    }
  }
}

.mcp-guide-actions {
  margin-top: 10px;
}

.dependency-guide-dialog {
  .dependency-guide-content {
    color: #606266;
    line-height: 1.8;

    ol {
      margin: 0 0 10px;
      padding-left: 18px;
    }

    code {
      background: #f5f7fa;
      padding: 2px 6px;
      border-radius: 3px;
      color: #409eff;
      font-family: 'Monaco', 'Menlo', monospace;
    }

    .maven-snippet-block {
      margin-top: 10px;
      border: 1px solid #ebeef5;
      border-radius: 6px;
      overflow: hidden;

      .snippet-header {
        height: 36px;
        padding: 0 10px;
        background: #f5f7fa;
        border-bottom: 1px solid #ebeef5;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        color: #606266;
      }

      pre {
        margin: 0;
        padding: 10px;
        background: #fff;
        color: #303133;
        font-size: 12px;
        overflow-x: auto;
        line-height: 1.6;
      }
    }
  }
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  .info-item {
    .label {
      font-size: 13px;
      color: #909399;
      margin-bottom: 8px;
      display: block;
    }
    
    .value {
      font-size: 14px;
      color: #303133;
      line-height: 1.6;
      
      &.description {
        font-weight: 500;
      }
      
      &.requirements {
        white-space: pre-wrap;
        background: #f8fafc;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #ebeef5;
      }
      
      &.time {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #f56c6c;
        font-weight: 500;
      }
    }
  }
}

.mcp-submit-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;

  .mcp-status {
    font-size: 13px;
    color: #606266;
    background: #f5f7fa;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    padding: 8px 10px;
    width: 100%;
    word-break: break-all;
  }
}

.timeline-container {
  padding: 10px 0;
}

.submission-card {
  background: #f9fafc;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px;
  
  .file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    
    .file-icon {
      color: #409eff;
    }
    
    .file-name {
      font-size: 13px;
      color: #303133;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }
  }
  
  .submission-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .action-btns {
      display: flex;
      gap: 8px;
    }
  }
}

// 数据卡片样式
.data-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }
  
  .data-notice {
    margin-bottom: 16px;
  }

  .data-usage-hint {
    background: #f0f9eb;
    border: 1px solid #e1f3d8;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 16px;
    
    .hint-title {
      font-size: 13px;
      font-weight: 600;
      color: #67c23a;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .hint-content {
      font-size: 13px;
      color: #606266;
      line-height: 1.6;
      white-space: pre-wrap;
    }
  }

  .table-structure {
    margin-bottom: 16px;
    
    .structure-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      
      .table-name {
        font-size: 14px;
        font-weight: 600;
        color: #409eff;
        font-family: 'Monaco', 'Menlo', monospace;
        background: #ecf5ff;
        padding: 4px 8px;
        border-radius: 4px;
      }
      
      .table-comment {
        font-size: 13px;
        color: #909399;
      }
    }
    
    .structure-table {
      margin-bottom: 8px;
      
      .nullable-text {
        color: #c0c4cc;
        font-size: 12px;
      }
    }
  }
  
  .data-table-wrapper {
    margin-bottom: 16px;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    overflow: hidden;
    
    .data-table-title {
      background: #f5f7fa;
      padding: 8px 12px;
      font-size: 13px;
      color: #606266;
      border-bottom: 1px solid #ebeef5;
    }
  }
  
  .data-collapse {
    margin-top: 12px;
    
    :deep(.el-collapse-item__header) {
      font-size: 13px;
      color: #909399;
    }
  }
  
  .json-preview {
    background: #f8f9fa;
    padding: 12px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    max-height: 300px;
    margin: 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: #606266;
  }
}
</style>
