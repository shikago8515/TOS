<template>
  <div class="case-summary-view">
    <!-- 实验报告格式提示（IMPLEMENTATION_LAB 专有） -->
    <el-alert
      v-if="reportHint"
      :title="reportHint"
      type="warning"
      show-icon
      :closable="false"
      class="cs-report-hint"
    />

    <!-- 项目背景 -->
    <div class="cs-section" v-if="backgroundStory">
      <h3 class="cs-section-title">
        <el-icon><Notebook /></el-icon>
        <span>项目背景</span>
      </h3>
      <p class="cs-section-text">{{ backgroundStory }}</p>
    </div>

    <!-- 任务清单 -->
    <div class="cs-section" v-if="parsedTaskList.length">
      <h3 class="cs-section-title">
        <el-icon><Aim /></el-icon>
        <span>任务清单</span>
      </h3>
      <div class="cs-task-list">
        <div v-for="(task, i) in parsedTaskList" :key="i" class="cs-task-item">
          <span class="cs-task-num">{{ i + 1 }}</span>
          <div class="cs-task-body">
            <p class="cs-task-title">{{ task.title || task.description || `任务 ${i + 1}` }}</p>
            <p
              v-if="task.description && task.description !== task.title"
              class="cs-task-desc"
            >{{ task.description }}</p>
            <div v-if="task.requirements" class="cs-task-req">
              <span class="cs-req-label">实验要求：</span>{{ formatRequirements(task.requirements) }}
            </div>
            <div v-if="getRequiredSections(task).length" class="cs-task-sections">
              <span class="cs-req-label">实验步骤：</span>
              <el-tag
                v-for="(sec, si) in getRequiredSections(task)"
                :key="si"
                size="small"
                effect="plain"
                type="info"
                style="margin: 2px 4px 2px 0;"
              >{{ sec }}</el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分析问题 -->
    <div class="cs-section" v-if="analysisQuestions.length">
      <h3 class="cs-section-title">
        <el-icon><QuestionFilled /></el-icon>
        <span>分析问题</span>
      </h3>
      <ol class="cs-questions">
        <li v-for="(q, qi) in analysisQuestions" :key="qi">{{ q }}</li>
      </ol>
    </div>

    <!-- 实验步骤正文（仅展示 LLM 已填写的项） -->
    <template v-if="Object.keys(sectionContents).length">
      <div
        v-for="(content, name) in sectionContents"
        :key="name"
        class="cs-section"
      >
        <h3 class="cs-section-title">
          <el-icon><Document /></el-icon>
          <span>{{ name }}</span>
        </h3>
        <p class="cs-section-content">{{ content }}</p>
      </div>
    </template>

    <!-- 空状态 -->
    <div
      v-if="!backgroundStory && !parsedTaskList.length && !analysisQuestions.length && !Object.keys(sectionContents).length"
      class="cs-empty"
    >
      <el-empty description="暂无案例内容" :image-size="64" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Notebook, Aim, QuestionFilled, Document } from '@element-plus/icons-vue'

const props = defineProps({
  backgroundStory: String,
  taskList: [String, Array],
  expectedOutput: String
})

/* -------- 任务清单解析 -------- */
const parsedTaskList = computed(() => {
  const raw = props.taskList
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) || [] } catch { return [] }
})

/* -------- expectedOutput 解析 -------- */
const parsedExpected = computed(() => {
  const str = props.expectedOutput
  if (!str) return null
  try {
    const p = typeof str === 'string' ? JSON.parse(str) : str
    if (p && typeof p === 'object' && !Array.isArray(p)) return p
  } catch {}
  return null
})

/** 实验报告格式提示 */
const reportHint = computed(() => {
  return parsedExpected.value?.reportHint || ''
})

/** 分析问题列表 */
const analysisQuestions = computed(() => {
  const p = parsedExpected.value
  if (p) return Array.isArray(p.analysisQuestions) ? p.analysisQuestions : []
  try {
    const arr = JSON.parse(props.expectedOutput || '')
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
})

/** 实验步骤正文（过滤空值） */
const sectionContents = computed(() => {
  const sc = parsedExpected.value?.sectionContents
  if (!sc || typeof sc !== 'object') return {}
  const result = {}
  for (const [k, v] of Object.entries(sc)) {
    if (v && v.trim()) result[k] = v
  }
  return result
})

/* -------- 工具函数 -------- */
const getRequiredSections = (task) => {
  const schema = task?.validation_schema || task?.validationSchema
  if (!schema) return []
  const s = typeof schema === 'string'
    ? (() => { try { return JSON.parse(schema) } catch { return {} } })()
    : schema
  return Array.isArray(s?.requiredSections) ? s.requiredSections : []
}

const formatRequirements = (requirements) => {
  if (requirements == null) return ''
  let text = String(requirements)
  // Decode double-escaped newlines first, then single-escaped newlines.
  text = text.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
  return text
}
</script>

<style scoped lang="scss">
.case-summary-view {
  font-size: 13px;
  color: #1f2937;
}

.cs-report-hint {
  margin-bottom: 16px;
}

.cs-section {
  margin-bottom: 24px;

  &:last-child { margin-bottom: 0; }
}

.cs-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 12px;

  .el-icon {
    font-size: 16px;
    color: #6366f1;
  }
}

.cs-section-text {
  font-size: 13px;
  line-height: 1.8;
  color: #475569;
  margin: 0;
  white-space: pre-wrap;
}

/* ---- task list ---- */
.cs-task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cs-task-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
}

.cs-task-num {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #6366f1;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cs-task-body {
  flex: 1;
  min-width: 0;
}

.cs-task-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px;
}

.cs-task-desc {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 6px;
  line-height: 1.6;
}

.cs-task-req {
  font-size: 12px;
  color: #475569;
  line-height: 1.6;
  background: #fff;
  border-left: 3px solid #94a3b8;
  padding: 6px 10px;
  border-radius: 0 4px 4px 0;
  margin-top: 6px;
}

.cs-task-sections {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

.cs-req-label {
  font-weight: 600;
  color: #64748b;
  margin-right: 4px;
}

/* ---- analysis questions ---- */
.cs-questions {
  margin: 0;
  padding-left: 20px;

  li {
    font-size: 13px;
    color: #374151;
    line-height: 1.9;

    & + li { margin-top: 4px; }
  }
}

/* ---- section content ---- */
.cs-section-content {
  font-size: 13px;
  line-height: 1.8;
  color: #475569;
  background: #f8fafc;
  border-left: 3px solid #6366f1;
  padding: 10px 14px;
  border-radius: 0 6px 6px 0;
  white-space: pre-line;
  margin: 0;
}

.cs-empty {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}
</style>
