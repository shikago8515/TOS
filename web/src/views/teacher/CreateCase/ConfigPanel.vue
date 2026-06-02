<template>
  <aside class="config-panel">
    <div class="panel-header">
      <div class="brand-area">
        <div class="logo-icon">
          <el-icon><MagicStick /></el-icon>
        </div>
        <div class="brand-text">
          <h1>AI 案例生成</h1>
          <span>智能实训案例生成引擎</span>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <el-scrollbar>
        <div class="config-form">
          <div class="wizard-shell">
            <div class="quick-preset-area">
              <div class="preset-label">
                <el-icon><Reading /></el-icon> 案例模板库
              </div>
              <div class="preset-helper">
                选择一个案例模板后，系统会自动回填主题、难度、技术栈，并把模板说明补充到提示词增强中。
              </div>
              <div class="preset-controls">
                <el-select
                  v-model="selectedCaseTemplateId"
                  placeholder="请选择案例模板"
                  class="preset-select"
                  clearable
                  filterable
                  :loading="loadingCaseTemplates"
                  :teleported="false"
                  @change="handleCaseTemplateSelect"
                >
                  <el-option
                    v-for="tpl in caseTemplates"
                    :key="tpl.id"
                    :label="tpl.templateName"
                    :value="tpl.id"
                  >
                    <div class="template-option">
                      <span class="name">{{ tpl.templateName }}</span>
                      <span class="meta">{{ formatTemplateType(tpl.templateType) }} · {{ getDifficultyLabel(tpl.difficultyLevel) }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>

              <div v-if="selectedCaseTemplateDetail" class="library-template-preview">
                <div class="preview-header">
                  <div>
                    <div class="preview-name">{{ selectedCaseTemplateDetail.templateName }}</div>
                    <div class="preview-subtitle">
                      <span>{{ formatTemplateType(selectedCaseTemplateDetail.templateType) }}</span>
                      <span v-if="selectedCaseTemplateSummary?.createdAt">
                        创建于 {{ formatDisplayDate(selectedCaseTemplateSummary.createdAt) }}
                      </span>
                    </div>
                  </div>
                  <div class="preview-badges">
                    <el-tag effect="plain" size="small" :type="getDifficultyType(selectedCaseTemplateDetail.difficultyLevel)">
                      {{ getDifficultyLabel(selectedCaseTemplateDetail.difficultyLevel) }}
                    </el-tag>
                    <el-tag
                      v-if="selectedCaseTemplateSummary?.isPublic === 1"
                      effect="plain"
                      size="small"
                      type="info"
                    >
                      公共模板
                    </el-tag>
                  </div>
                </div>

                <div class="preview-desc">
                  {{ selectedCaseTemplateDetail.description || '该模板已提供完整的案例生成参考，可以直接套用。' }}
                </div>

                <div v-if="selectedCaseTemplateTechStacks.length" class="preview-chip-row">
                  <span class="chip-title">技术栈</span>
                  <div class="chip-list">
                    <el-tag
                      v-for="stack in selectedCaseTemplateTechStacks.slice(0, 5)"
                      :key="stack"
                      effect="plain"
                      size="small"
                      type="success"
                    >
                      {{ stack }}
                    </el-tag>
                  </div>
                </div>

                <div v-if="selectedCaseTemplateTasks.length" class="preview-chip-row">
                  <span class="chip-title">参考任务</span>
                  <span class="chip-text">{{ selectedCaseTemplateTasks.slice(0, 3).join('，') }}</span>
                </div>
              </div>
            </div>

            <!-- 模块 A：核心案例参数 -->
            <div class="core-blueprint-card accordion-card">
              <div class="card-header">
                <div class="card-title">
                  <el-icon><Document /></el-icon> 核心案例参数
                </div>
                <div class="card-extra">
                  <el-segmented
                    :model-value="form.deliverableMode"
                    @update:model-value="setDeliverableMode"
                    :options="[{ label: '纯编码', value: 'CODE' }, { label: '完整实训', value: 'NON_CODE' }]"
                    size="small"
                  />
                </div>
              </div>
              <div class="card-body">
                <div class="parameter-grid">
                  <div class="form-item full">
                    <span class="item-label">
                      实训主题与业务背景
                      <el-tooltip
                        content="把案例主题和业务场景写在一起，AI 更容易生成稳定、贴合教学的案例。"
                        placement="top"
                        :teleported="false"
                      >
                        <el-icon class="hint-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                    <el-input
                      v-model="unifiedTopicInput"
                      type="textarea"
                      :autosize="{ minRows: 2, maxRows: 4 }"
                      placeholder="例如：校园图书管理系统，面向高校借阅与库存管理场景"
                      clearable
                    />
                  </div>

                  <div class="form-item full">
                    <span class="item-label">技术栈要求</span>
                    <el-select
                      v-model="form.techStackRequirements"
                      multiple
                      filterable
                      allow-create
                      default-first-option
                      collapse-tags
                      collapse-tags-tooltip
                      class="w-full"
                      placeholder="例如：Spring Boot、Vue3、MySQL"
                      :teleported="false"
                    >
                      <el-option
                        v-for="stack in techStackPresetOptions"
                        :key="stack"
                        :label="stack"
                        :value="stack"
                      />
                    </el-select>
                  </div>

                  <div class="form-item full">
                    <span class="item-label">难度等级</span>
                    <el-radio-group v-model="form.difficultyLevel" size="small" class="w-full custom-radio-group">
                      <el-radio-button v-for="opt in displayedDifficultyOptions" :key="opt.value" :label="opt.value">
                        {{ opt.label }}
                      </el-radio-button>
                    </el-radio-group>
                  </div>
                </div>
              </div>
            </div>
            <!-- 模块 B：教学与分发 -->
            <div class="teaching-dispatch-card accordion-card" :class="{ 'is-collapsed': !teachingExpanded }">
              <div class="card-header" @click="teachingExpanded = !teachingExpanded">
                <div class="card-title">
                  <el-icon><User /></el-icon> 教学与分发
                </div>
                <div class="card-extra">
                  <span class="preview-text" v-show="!teachingExpanded">
                    {{ generationMode === 'batch' ? '一人一案' : ('单次 ' + form.numVersions + ' 份') }} | {{ form.datasetScale }} 张表
                  </span>
                  <el-icon class="arrow-icon"><ArrowDown /></el-icon>
                </div>
              </div>
              
              <el-collapse-transition>
                <div v-show="teachingExpanded" class="card-body">
                  <div class="dispatch-mode-wrapper">
                    <span class="item-label">生成模式</span>
                    <el-radio-group :model-value="generationMode" @update:model-value="$emit('update:generationMode', $event)" size="small">
                      <el-radio-button label="single">单次生成</el-radio-button>
                      <el-radio-button label="batch">一人一案（按班级）</el-radio-button>
                    </el-radio-group>
                  </div>

                  <div class="params-grid">
                    <div class="form-item">
                      <span class="item-label">关联课程</span>
                      <el-select v-model="form.courseId" placeholder="请选择所属课程" class="w-full" :loading="loadingCourses" @change="handleCourseChange" :teleported="false">
                        <el-option v-for="c in courseList" :key="c.id" :label="c.courseName" :value="c.id" />
                      </el-select>
                    </div>
                    <div class="form-item">
                      <span class="item-label">预计课时</span>
                      <el-input-number v-model="form.estimatedHours" :min="1" :max="20" controls-position="right" class="w-full" />
                    </div>

                    <div class="form-item">
                      <span class="item-label">数据集规模</span>
                      <el-input-number v-model="form.datasetScale" :min="5" :max="20" :step="1" controls-position="right" class="w-full" />
                      <div class="field-hint">用于控制生成案例中的数据表数量建议值，每张表至少会生成 5 条以上示例数据。</div>
                    </div>
                    <div class="form-item" v-if="generationMode === 'single'">
                      <span class="item-label">生成数量</span>
                      <el-input-number v-model="form.numVersions" :min="1" :max="50" controls-position="right" class="w-full" />
                    </div>
                  </div>

                  <!-- 批量模式下的学生选择 -->
                  <div v-if="generationMode === 'batch'" class="batch-panel">
                    <div class="form-item">
                      <span class="item-label">目标班级</span>
                      <el-select v-model="batchForm.classId" placeholder="请选择目标班级" class="w-full" @change="$emit('classChange', $event)" :loading="loadingClasses" :teleported="false">
                        <el-option v-for="c in classList" :key="c.id" :label="c.name" :value="c.id" />
                      </el-select>
                    </div>

                    <div class="form-item" v-if="batchForm.classId">
                      <div class="item-label-row">
                        <span class="item-label">选择学生</span>
                        <div class="student-selector-actions">
                          <el-tag type="info" effect="plain" round size="small">
                            已选 {{ selectedStudents.length }} 人
                          </el-tag>
                          <el-button type="primary" plain size="small" :disabled="loadingStudents" @click="openStudentSelector">
                            添加学生
                          </el-button>
                          <el-button
                            link
                            type="danger"
                            size="small"
                            :disabled="selectedStudents.length === 0"
                            @click="$emit('update:selectedStudents', [])"
                          >
                            清空
                          </el-button>
                        </div>
                      </div>
                      <div class="student-selector-box" v-loading="loadingStudents">
                        <div class="selector-tip">
                          <span>当前班级：{{ selectedClassName || '未命名班级' }}</span>
                          <span>学生范围仅限当前目标班级</span>
                        </div>

                        <el-empty
                          v-if="selectedStudentRecords.length === 0"
                          description="点击“添加学生”后，从当前班级中选择需要参与本次生成的学生。"
                          :image-size="72"
                        />

                        <div v-else class="selected-student-preview">
                          <div
                            v-for="student in previewStudents"
                            :key="student.userId || student.studentId"
                            class="preview-student-card"
                          >
                            <el-avatar :size="34" :src="student.avatar">
                              {{ student.studentName?.charAt(0) || '?' }}
                            </el-avatar>
                            <div class="student-meta">
                              <div class="name">{{ student.studentName }}</div>
                              <div class="sub">{{ student.studentId }}</div>
                            </div>
                          </div>
                        </div>

                        <div v-if="selectedStudentRecords.length > previewStudents.length" class="selected-student-more">
                          另外还有 {{ selectedStudentRecords.length - previewStudents.length }} 名学生已加入本次一人一案生成。
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </el-collapse-transition>
            </div>

          <div class="ai-enhance-card accordion-card" :class="{ 'is-collapsed': !advancedExpanded }">
            <div class="card-header" @click="advancedExpanded = !advancedExpanded">
              <div class="card-title">
                <el-icon><MagicStick /></el-icon> AI 增强与知识约束
              </div>
              <div class="card-extra">
                <span class="preview-text" v-show="!advancedExpanded">
                  {{ selectedTextbookId ? '已开启教材知识约束' : '仅使用教师输入与模板生成' }}
                </span>
                <el-icon class="arrow-icon"><ArrowDown /></el-icon>
              </div>
            </div>
            
            <el-collapse-transition>
              <div v-show="advancedExpanded" class="card-body">
                <div class="form-group core-highlight">
                  <div class="section-head compact">
                    <div>
                      <div class="section-title">提示词增强</div>
                    </div>
                  </div>
                  <div class="input-area">
                    <el-input
                      v-model="form.keywords"
                      type="textarea"
                      :autosize="{ minRows: 3, maxRows: 6 }"
                      placeholder="补充业务背景、教学重点、评分要求或特殊限制条件（非必填）。"
                      class="fancy-textarea"
                    />
                    <div class="keywords-actions">
                      <el-button link type="info" size="small" @click="formatKeywordsText">整理排版</el-button>
                      <el-button link type="primary" size="small" @click="showPopularKeywordTags = !showPopularKeywordTags">
                        {{ showPopularKeywordTags ? '隐藏推荐标签' : '显示推荐标签' }}
                      </el-button>
                      <span class="keywords-meta">{{ keywordLength }} 字</span>
                    </div>
                    <div class="quick-tags" v-if="showPopularKeywordTags">
                      <span v-for="t in popularKeywords" :key="t" @click="addKeyword(t)">{{ t }}</span>
                    </div>
                  </div>
                </div>

                <div class="rag-section supporting-block" style="margin-top: 8px;">
                  <div class="rag-header">
                    <div class="rag-title" @click="ragExpanded = !ragExpanded">
                      <el-icon><Reading /></el-icon>
                      <span>教材知识对齐（RAG）</span>
                    </div>
                    <el-button link type="primary" size="small" @click="ragExpanded = !ragExpanded">
                      {{ ragExpanded ? '收起' : '展开' }}
                      <el-icon :class="['rag-arrow', { active: ragExpanded }]"><ArrowDown /></el-icon>
                    </el-button>
                  </div>

                  <el-collapse-transition>
                    <div class="rag-content" v-show="ragExpanded">
                      <el-select v-model="selectedTextbookId" placeholder="选择对齐教材" class="w-full mb-2" clearable @change="handleTextbookChange" :teleported="false">
                        <el-option v-for="tb in textbooks" :key="tb.id" :label="tb.name" :value="tb.id" :disabled="tb.parseStatus !== 2" />
                      </el-select>
                      <el-select v-if="selectedTextbookId" v-model="selectedChapterId" placeholder="选择覆盖章节" class="w-full" clearable @change="handleChapterChange" :teleported="false">
                        <el-option :value="0" label="整本教材（综合考察）" />
                        <el-option v-for="ch in chapters" :key="ch.id" :label="`第${ch.chapterNo}章 ${ch.title}`" :value="ch.id" />
                      </el-select>
                      <div v-if="currentKnowledgePoints.length" class="kp-box">
                        <div class="kp-title">知识点约束</div>
                        <el-checkbox-group v-model="selectedKnowledgePoints">
                          <el-checkbox v-for="p in currentKnowledgePoints" :key="p" :label="p" size="small">{{ p }}</el-checkbox>
                        </el-checkbox-group>
                      </div>
                    </div>
                  </el-collapse-transition>
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </div>
      </div>
      </el-scrollbar>
    </div>
    <div class="panel-footer">
      <el-button @click="$emit('reset')" plain :icon="RefreshLeft">重置</el-button>
      <el-button type="primary" @click="handleGenerate" :loading="loading" :icon="Promotion" class="btn-submit">
        {{ loading ? '正在生成…' : generateBtnText }}
      </el-button>
    </div>

    <StudentSelector
      v-model:visible="studentSelectorVisible"
      :class-list="selectedClassList"
      :all-students="normalizedStudentOptions"
      :initial-selected="selectedStudentRecords"
      :loading="loadingStudents"
      @confirm="handleConfirmStudents"
    />
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, Document, User, RefreshLeft, Promotion, Reading, QuestionFilled, ArrowDown } from '@element-plus/icons-vue'
import StudentSelector from '@/views/teacher/TaskManagement/components/StudentSelector.vue'
import { getTextbooksByCourse, getTextbookChapters } from '@/api/teacher/textbook'
import { getCaseTemplateList, getCaseTemplateReference } from '@/api/teacher/template'

const props = defineProps({
  form: Object,
  batchForm: Object,
  generationMode: String,
  loading: Boolean,
  loadingClasses: Boolean,
  loadingStudents: Boolean,
  loadingCourses: Boolean,
  classList: Array,
  studentList: Array,
  courseList: Array,
  selectedStudents: Array,
  selectAll: Boolean,
  isIndeterminate: Boolean,
  popularKeywords: Array,
  difficultyOptions: Array
})

const emit = defineEmits([
  'update:generationMode',
  'update:selectedStudents',
  'classChange',
  'selectAll',
  'reset',
  'generate'
])

// 教材与模板相关状态
const textbooks = ref([])
const chapters = ref([])
const selectedTextbookId = ref(null)
const selectedChapterId = ref(null)
const selectedKnowledgePoints = ref([])
const ragExpanded = ref(false)
const teachingExpanded = ref(true)
const advancedExpanded = ref(false)
const showPopularKeywordTags = ref(false)
const caseTemplates = ref([])
const selectedCaseTemplateId = ref(null)
const selectedCaseTemplateDetail = ref(null)
const loadingCaseTemplates = ref(false)
const loadingCaseTemplateDetail = ref(false)
const studentSelectorVisible = ref(false)
const CASE_TEMPLATE_MARKER = '【案例模板参考】'

const normalizeId = (value) => {
  if (value === '' || value === null || value === undefined) {
    return ''
  }
  return String(value)
}

const selectedClassList = computed(() => {
  const currentClass = (props.classList || []).find((item) => normalizeId(item.id) === normalizeId(props.batchForm?.classId))
  return currentClass ? [currentClass] : []
})

const selectedClassName = computed(() => {
  const currentClass = selectedClassList.value[0]
  return currentClass?.className || currentClass?.name || ''
})

const toSelectedStudentRecord = (student) => ({
  studentId: student.studentId || student.username || `#${student.id ?? student.userId}`,
  userId: student.userId || student.id,
  studentName: student.name || student.realName || student.studentName || student.username || '未命名学生',
  classId: student.classId || props.batchForm?.classId || null,
  className: student.className || selectedClassName.value || '',
  avatar: student.avatar || ''
})

const selectedStudentRecords = computed(() => {
  const selectedIdSet = new Set((props.selectedStudents || []).map((id) => normalizeId(id)))
  return (props.studentList || [])
    .filter((student) => selectedIdSet.has(normalizeId(student.userId || student.id)))
    .map((student) => toSelectedStudentRecord(student))
})

const normalizedStudentOptions = computed(() => {
  return (props.studentList || []).map((student) => toSelectedStudentRecord(student))
})

const previewStudents = computed(() => selectedStudentRecords.value.slice(0, 8))

const openStudentSelector = () => {
  if (!props.batchForm?.classId) {
    ElMessage.warning('请先选择目标班级')
    return
  }
  studentSelectorVisible.value = true
}

const handleConfirmStudents = (students) => {
  const ids = (students || [])
    .map((student) => student.userId || student.id)
    .filter((id) => id !== '' && id !== null && id !== undefined)

  emit('update:selectedStudents', ids)
}

const techStackPresetOptions = [
  'Spring MVC',
  'Spring Boot',
  'MyBatis',
  'MyBatis-Plus',
  'JSP',
  'Vue3',
  'Element Plus',
  'Redis',
  'RabbitMQ',
  'MySQL'
]

const templateTypeLabels = {
  LIBRARY: '图书管理',
  ECOMMERCE: '电商业务',
  COURSE_SELECTION: '选课管理',
  MEETING: '会议预约',
  BLOG: '博客平台'
}

const unifiedTopicInput = computed({
  get: () => {
    const topic = String(props.form?.trainingTopic || '').trim()
    const style = String(props.form?.storyStyle || '').trim()
    return topic || style
  },
  set: (value) => {
    const normalized = String(value || '').trim()
    props.form.trainingTopic = normalized
    props.form.storyStyle = normalized
  }
})

const syncTopicFields = () => {
  const topic = String(props.form?.trainingTopic || '').trim()
  const style = String(props.form?.storyStyle || '').trim()
  const unified = topic || style
  props.form.trainingTopic = unified
  props.form.storyStyle = unified
}

const keywordLength = computed(() => {
  return String(props.form?.keywords || '').length
})

const displayedDifficultyOptions = computed(() => {
  return props.difficultyOptions?.length
    ? props.difficultyOptions
    : [
        { label: '初级', value: 1 },
        { label: '中级', value: 2 },
        { label: '高级', value: 3 }
      ]
})

const selectedCaseTemplateSummary = computed(() => {
  return (caseTemplates.value || []).find((item) => normalizeId(item.id) === normalizeId(selectedCaseTemplateId.value)) || null
})

const selectedCaseTemplateTechStacks = computed(() => extractTemplateTechStacks(selectedCaseTemplateDetail.value))
const selectedCaseTemplateTasks = computed(() => extractTemplateTasks(selectedCaseTemplateDetail.value))

const isAnalysisMode = computed(() => props.form?.deliverableMode === 'NON_CODE')
const generateBtnText = computed(() => {
  if (props.generationMode === 'batch') {
    return isAnalysisMode.value ? '立即批量生成工程流程案例' : '立即批量生成代码案例'
  }
  return isAnalysisMode.value ? '立即生成工程流程案例' : '立即生成代码案例'
})

// 当前可选的知识点
const currentKnowledgePoints = computed(() => {
  if (selectedChapterId.value === 0) {
    // 整本教材：合并全部章节知识点
    const allPoints = new Set()
    chapters.value.forEach(ch => {
      (ch.knowledgePoints || []).forEach(p => allPoints.add(p))
    })
    return Array.from(allPoints)
  } else if (selectedChapterId.value) {
    const chapter = chapters.value.find(c => c.id === selectedChapterId.value)
    return chapter?.knowledgePoints || []
  }
  return []
})

const setDeliverableMode = (mode) => {
  props.form.deliverableMode = mode
}

// 课程变化时加载教材
const handleCourseChange = async (courseId) => {
  selectedTextbookId.value = null
  selectedChapterId.value = null
  chapters.value = []
  selectedKnowledgePoints.value = []
  
  if (courseId) {
    await loadTextbooks(courseId)
  }
}

// 加载教材列表
const loadTextbooks = async (courseId) => {
  try {
    const res = await getTextbooksByCourse(courseId)
    textbooks.value = res.data || []
  } catch (e) {
    console.error('加载教材失败', e)
  }
}

// 教材变化时加载章节
const handleTextbookChange = async (textbookId) => {
  selectedChapterId.value = null
  chapters.value = []
  selectedKnowledgePoints.value = []
  
  if (textbookId) {
    try {
      const res = await getTextbookChapters(textbookId)
      chapters.value = res.data || []
    } catch (e) {
      console.error('加载章节失败', e)
    }
  }
}

// 章节变化
const handleChapterChange = (chapterId) => {
  selectedKnowledgePoints.value = []
  
  if (chapterId && chapterId !== 0) {
    const chapter = chapters.value.find(c => c.id === chapterId)
    if (chapter) {
      // 自动使用章节建议难度
      props.form.difficultyLevel = chapter.suggestedDifficulty || 2
    }
  }
}

// 难度标签
const getDifficultyLabel = (level) => {
  const labels = { 1: '初级', 2: '中级', 3: '高级' }
  return labels[level] || '中级'
}

// 难度标签样式
const getDifficultyType = (level) => {
  const types = { 1: 'success', 2: 'warning', 3: 'danger' }
  return types[level] || 'warning'
}

const addKeyword = (tag) => {
  if (props.form.keywords) {
    props.form.keywords += `, ${tag}`
  } else {
    props.form.keywords = tag
  }
}

const formatKeywordsText = () => {
  const text = String(props.form?.keywords || '')
  if (!text.trim()) return
  props.form.keywords = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

const safeText = (value) => String(value || '').trim()

const formatTemplateType = (type) => {
  const normalized = safeText(type).toUpperCase()
  return templateTypeLabels[normalized] || safeText(type) || '通用模板'
}

const formatDisplayDate = (value) => {
  const text = safeText(value)
  if (!text) {
    return ''
  }
  return text.replace('T', ' ').slice(0, 16)
}

const normalizeTemplateList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => safeText(item)).filter(Boolean)
  }

  const text = safeText(value)
  if (!text) {
    return []
  }

  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => safeText(item)).filter(Boolean)
      }
    } catch (e) {
      // ignore parse failure and fallback to delimiter split
    }
  }

  return text
    .split(/[\n,，;；、]+/)
    .map((item) => safeText(item))
    .filter(Boolean)
}

const extractTemplateTechStacks = (detail) => {
  const directStacks = normalizeTemplateList(detail?.inputSample?.techStackRequirements)
  if (directStacks.length) {
    return directStacks
  }

  const textPool = [
    detail?.promptExample,
    detail?.description,
    detail?.generatedCaseSample?.backgroundStory,
    detail?.taskListExample
  ]
    .map((item) => safeText(item))
    .filter(Boolean)
    .join(' ')

  return techStackPresetOptions.filter((stack) => textPool.toLowerCase().includes(stack.toLowerCase()))
}

const extractTemplateTasks = (detail) => {
  const generatedTasks = normalizeTemplateList(detail?.generatedCaseSample?.taskList)
  if (generatedTasks.length) {
    return generatedTasks
  }

  const exampleTasks = normalizeTemplateList(detail?.taskListExample)
  if (exampleTasks.length) {
    return exampleTasks
  }

  return normalizeTemplateList(detail?.inputSample?.deliverables)
}

const stripTemplateReference = (value) => {
  const text = safeText(value)
  if (!text) {
    return ''
  }

  const markerIndex = text.indexOf(CASE_TEMPLATE_MARKER)
  return markerIndex >= 0 ? text.slice(0, markerIndex).trim() : text
}

const buildCaseTemplateReference = (detail) => {
  if (!detail) {
    return ''
  }

  const tasks = extractTemplateTasks(detail).slice(0, 4)
  const deliverables = normalizeTemplateList(detail?.inputSample?.deliverables).slice(0, 4)
  const sections = [
    detail?.description ? `业务场景：${safeText(detail.description)}` : '',
    detail?.promptExample ? `生成要求：${safeText(detail.promptExample)}` : '',
    detail?.generatedCaseSample?.backgroundStory ? `背景参考：${safeText(detail.generatedCaseSample.backgroundStory)}` : '',
    tasks.length ? `参考任务：${tasks.join('；')}` : '',
    deliverables.length ? `预期成果：${deliverables.join('、')}` : ''
  ].filter(Boolean)

  return sections.join('\n')
}

const loadCaseTemplates = async () => {
  loadingCaseTemplates.value = true
  try {
    const res = await getCaseTemplateList()
    caseTemplates.value = Array.isArray(res?.data) ? res.data : []
  } catch (e) {
    caseTemplates.value = []
    ElMessage.error('加载案例模板库失败')
  } finally {
    loadingCaseTemplates.value = false
  }
}

const loadCaseTemplateDetail = async (templateId) => {
  if (!templateId) {
    selectedCaseTemplateDetail.value = null
    return null
  }

  loadingCaseTemplateDetail.value = true
  try {
    const res = await getCaseTemplateReference(templateId)
    selectedCaseTemplateDetail.value = res?.data || null
    return selectedCaseTemplateDetail.value
  } catch (e) {
    selectedCaseTemplateDetail.value = null
    ElMessage.error('加载案例模板详情失败')
    return null
  } finally {
    loadingCaseTemplateDetail.value = false
  }
}


const applyCaseTemplateDetail = (detail) => {
  const nextTopic = safeText(detail?.inputSample?.trainingTopic) || safeText(detail?.templateName)
  const nextStory = safeText(detail?.inputSample?.storyStyle)
    || safeText(detail?.description)
    || safeText(detail?.generatedCaseSample?.backgroundStory)
    || safeText(detail?.promptExample)
  const nextDatasetScale = Number(detail?.inputSample?.datasetScale || 0)
  const nextTechStacks = extractTemplateTechStacks(detail)

  if (nextTopic) {
    props.form.trainingTopic = nextTopic
  }
  if (nextStory) {
    props.form.storyStyle = nextStory
  }
  if (detail?.difficultyLevel) {
    props.form.difficultyLevel = Number(detail.difficultyLevel)
  }
  if (nextDatasetScale > 0) {
    props.form.datasetScale = nextDatasetScale
  }
  if (nextTechStacks.length) {
    props.form.techStackRequirements = [...nextTechStacks]
  }

  props.form.keywords = stripTemplateReference(props.form.keywords)
  props.form.caseTemplateReference = buildCaseTemplateReference(detail)
  props.form.caseTemplateId = detail.templateId || selectedCaseTemplateId.value
  syncTopicFields()
  advancedExpanded.value = true
}

const handleCaseTemplateSelect = async (templateId) => {
  if (!templateId) {
    selectedCaseTemplateDetail.value = null
    props.form.keywords = stripTemplateReference(props.form.keywords)
    props.form.caseTemplateReference = ''
    props.form.caseTemplateId = null
    return
  }

  const detail = await loadCaseTemplateDetail(templateId)
  if (!detail) {
    return
  }

  applyCaseTemplateDetail(detail)
  ElMessage.success('已根据案例模板自动填充参数')
}


// 生成时附带教材信息
const handleGenerate = () => {
  syncTopicFields()
  // 闄勫姞鏁欐潗绔犺妭淇℃伅
  if (selectedTextbookId.value) {
    props.form.textbookId = selectedTextbookId.value
    
    if (selectedChapterId.value === 0) {
      // 鏁存湰鏁欐潗
      props.form.chapterIds = chapters.value.map(c => c.id)
      props.form.isFullTextbook = true
    } else if (selectedChapterId.value) {
      props.form.chapterIds = [selectedChapterId.value]
      props.form.isFullTextbook = false
    }
  }
  
  if (selectedKnowledgePoints.value.length > 0) {
    props.form.knowledgePoints = selectedKnowledgePoints.value
  }
  
  emit('generate')
}

// 鐩戝惉璇剧▼鍙樺寲
watch(() => props.form.courseId, (newVal) => {
  if (newVal) {
    loadTextbooks(newVal)
  }
}, { immediate: true })

onMounted(async () => {
  await loadCaseTemplates()
})
</script>

<style scoped lang="scss">
.config-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #f1f5f9;

  .panel-header {
    flex-shrink: 0;
    padding: 12px 14px;
    border-bottom: 1px solid #f8fafc;
    background: #fff;
    
    .brand-area {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .logo-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, var(--el-color-primary-light-8) 0%, var(--el-color-primary-light-9) 100%);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--el-color-primary);
        font-size: 18px;
      }
      
      .brand-text {
        display: flex;
        flex-direction: column;
        
        h1 {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.2;
        }
        
        span {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }
      }
    }
  }

  .panel-content {
    flex: 1;
    overflow: hidden;
    background: #fff;
    
    :deep(.el-scrollbar__view) {
      padding: 0;
    }

    .config-form {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  }

  .panel-footer {
    flex-shrink: 0;
    padding: 10px 12px;
    background: #fff;
    border-top: 1px solid #f1f5f9;
    display: flex;
    gap: 12px;
  }
}

.form-group {
  margin-bottom: 8px;
  
  .group-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;

  &.compact {
    margin-bottom: 8px;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}

.section-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.quick-preset-area {
  margin-bottom: 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  padding: 10px;
  border: 1px dashed #e2e8f0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);


  .preset-label {
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 4px;

    .el-icon {
      color: #eab308;
    }
  }

  .preset-helper {
    margin-bottom: 8px;
    font-size: 12px;
    line-height: 1.6;
    color: #64748b;
  }

  .preset-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;

    .preset-select {
      flex: 1;
      min-width: 220px;
    }
  }

  .template-option {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .name {
      font-size: 13px;
      color: #0f172a;
    }

    .meta {
      font-size: 12px;
      color: #64748b;
    }
  }

  .library-template-preview {
    margin-top: 10px;
    padding: 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);

    .preview-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .preview-name {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }

    .preview-subtitle {
      margin-top: 4px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
      color: #64748b;
    }

    .preview-badges {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
    }

    .preview-desc {
      margin-top: 8px;
      font-size: 12px;
      line-height: 1.7;
      color: #475569;
    }

    .preview-chip-row {
      margin-top: 10px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .chip-title {
      flex-shrink: 0;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      line-height: 1.8;
    }

    .chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip-text {
      font-size: 12px;
      line-height: 1.7;
      color: #64748b;
    }
  }
}

.accordion-card {
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);

  &.is-collapsed {
    border-color: #f1f5f9;
    box-shadow: none;
    
    .card-header {
      border-bottom-color: transparent;
      border-radius: 12px;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #f8fafc;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid transparent;
    border-radius: 11px 11px 0 0;

    .card-title {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 6px;
      
      .el-icon {
        color: var(--el-color-primary);
        font-size: 15px;
      }
    }

    .card-extra {
      display: flex;
      align-items: center;
      gap: 8px;

      .preview-text {
        font-size: 11px;
        color: #94a3b8;
      }
      
      .arrow-icon {
        color: #94a3b8;
        transition: transform 0.3s;
      }
    }
  }

  &:not(.is-collapsed) .card-header {
    border-bottom-color: #e2e8f0;
    
    .arrow-icon {
      transform: rotate(180deg);
    }
  }

  .card-body {
    padding: 12px;
  }
}

.custom-radio-group {
  display: flex !important;
  :deep(.el-radio-button) {
    flex: 1;
    .el-radio-button__inner {
      width: 100%;
    }
  }
}

.dispatch-mode-wrapper {
  margin-bottom: 12px;
  .item-label {
    display: block;
    font-size: 12px;
    color: #64748b;
    margin-bottom: 4px;
  }
  .el-radio-group {
    display: flex;
    .el-radio-button {
      flex: 1;
      :deep(.el-radio-button__inner) {
        width: 100%;
      }
    }
  }
}

  .summary-label {
    font-size: 12px;
    color: #475569;
    font-weight: 600;
    margin-right: 2px;
  }

.compact-radio {
  :deep(.el-radio-button__inner) {
    padding: 6px 0;
    font-size: 12px;
    width: 100%;
    text-align: center;
  }
  :deep(.el-radio-button) {
    flex: 1;
    display: flex;
  }
}

.mode-mini-hint {
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
  line-height: 1.4;

  &.code {
    background: #eff6ff;
    border: 1px solid #dbeafe;
    color: #1d4ed8;
  }

  &.analysis {
    background: #f0fdf4;
    border: 1px solid #dcfce7;
    color: #166534;
  }
}

.core-highlight {
  margin-bottom: 8px;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  padding: 10px;
  background: #f8fbff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);
}

.parameterized-config {
  margin-bottom: 8px;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  padding: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);

  .subsection-title {
    margin: 10px 0 8px;
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .parameter-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    .form-item {
      .item-label {
        display: block;
        font-size: 12px;
        color: #64748b;
        margin-bottom: 4px;
      }

      &.full {
        grid-column: span 2;
      }
    }
  }

  .blueprint-guide-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    margin-bottom: 10px;

    .guide-card-item {
      padding: 10px 12px;
      border: 1px dashed #e2e8f0;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);
    }

    .guide-card-title {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 4px;
    }

    .guide-card-desc {
      font-size: 12px;
      line-height: 1.6;
      color: #64748b;
    }
  }

  .tiny-hint {
    margin-top: 4px;
    font-size: 11px;
    color: #94a3b8;
  }

  .parameter-preview {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;

    .preview-title {
      font-size: 12px;
      color: #475569;
      font-weight: 600;
      margin-right: 2px;
    }
  }
}

.params-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 4px;
  background: #fcfdff;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);

    .form-item {
      .item-label {
        display: block;
        font-size: 12px;
        color: #64748b;
        margin-bottom: 4px;
      }

      .field-hint {
        margin-top: 4px;
        font-size: 11px;
        line-height: 1.5;
        color: #94a3b8;
      }

      &.full {
        grid-column: span 2;
      }

  }
}

.teaching-plan-panel {
  margin-bottom: 8px;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  padding: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);
}

.template-actions {
  .template-save-row,
  .template-use-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin-bottom: 8px;
  }

  .template-use-row {
    grid-template-columns: 1fr auto auto;
  }

  .template-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .template-chip {
      font-size: 12px;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      padding: 3px 10px;
    }
  }
}

.advanced-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .advanced-guide {
    display: grid;
    gap: 6px;
    padding: 10px 12px;
    border: 1px dashed #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);
    font-size: 12px;
    line-height: 1.6;
    color: #64748b;
  }
}

.advanced-drawer {
  padding: 0;
  overflow: hidden;

  &.expanded {
    border-color: #dbeafe;
    background: #f8fbff;
  }
}

.advanced-drawer-toggle {
  width: 100%;
  border: none;
  background: transparent;
  appearance: none;
  font: inherit;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
}

.advanced-drawer-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.advanced-drawer-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.advanced-drawer-desc {
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.advanced-drawer-arrow {
  color: #94a3b8;
  transition: transform 0.2s ease;

  &.active {
    transform: rotate(180deg);
  }
}

.advanced-drawer-body {
  padding: 0 8px 8px;
}

.workflow-mini-card {
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  padding: 8px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);
  
  .workflow-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .wf-title-group {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;

      .el-icon {
        color: var(--el-color-primary);
      }

      .info-icon {
        color: #94a3b8;
        font-size: 14px;
        cursor: help;
      }
    }

    .wf-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
  
  // 妫€鏌ョ偣鎺у埗鍖哄煙
  .checkpoint-control {
    margin-top: 8px;
    padding: 6px 8px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 8px;
    border: 1px dashed #e2e8f0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);
    
    .checkpoint-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .checkpoint-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        color: #475569;
        
        .el-icon {
          font-size: 14px;
          color: var(--el-color-primary);
        }
      }
    }
  }

  &.workflow-disabled {
    border-color: #dbeafe;
    background: linear-gradient(145deg, #f8fbff 0%, #f1f7ff 100%);
  }
}

.supporting-block {
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  padding: 8px;
  background: #fcfdff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);
}

.batch-panel {
  background: #f8fafc;
  border-radius: 12px;
  padding: 10px;
  border: 1px dashed #e2e8f0;
  margin-bottom: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);
  
  .form-item {
    margin-bottom: 8px;
    &:last-child { margin-bottom: 0; }
  }
  
  .item-label {
    display: block;
    font-size: 12px;
    color: #64748b;
    margin-bottom: 4px;
  }
  
  .item-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .student-selector-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .student-selector-box {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px;
    min-height: 118px;

    .selector-tip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      font-size: 12px;
      color: #64748b;
    }

    .selected-student-preview {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .preview-student-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
      border: 1px solid #e2e8f0;

      .student-meta {
        min-width: 0;
      }

      .name {
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .sub {
        margin-top: 2px;
        font-size: 12px;
        color: #64748b;
      }
    }

    .selected-student-more {
      margin-top: 10px;
      font-size: 12px;
      color: #64748b;
      text-align: right;
    }
  }

  @media (max-width: 1100px) {
    .student-selector-box {
      .selector-tip {
        flex-direction: column;
        align-items: flex-start;
      }

      .selected-student-preview {
        grid-template-columns: 1fr;
      }
    }
  }
}

.input-area {
  .fancy-textarea {
    :deep(.el-textarea__inner) {
      padding: 12px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      transition: all 0.2s;
      
      &:focus {
        background: #fff;
        box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
      }
    }
  }

  .keywords-diff-card {
    margin-bottom: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
    border: 1px dashed #e2e8f0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);

    .diff-title {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }

    .diff-desc,
    .diff-example {
      font-size: 12px;
      line-height: 1.6;
      color: #64748b;
    }

    .diff-example {
      margin-top: 6px;
      color: #475569;
    }
  }

  .keywords-actions {
    margin-top: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .keywords-meta {
    font-size: 12px;
    color: #94a3b8;
  }
  
  .quick-tags {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    
    span {
      font-size: 12px;
      color: #64748b;
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 100px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
      }
    }
  }

  .intent-box {
    margin-top: 6px;
    padding: 6px 8px;
    border: 1px dashed #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);

    .intent-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .intent-label {
      font-size: 12px;
      color: #475569;
      font-weight: 600;
    }

    .intent-meta {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }

    .intent-action {
      margin-top: 2px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }
}

.rag-section {
  margin-top: 8px;
  border-top: 1px dashed #e2e8f0;
  padding-top: 10px;
  
  .rag-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #475569;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;

    .rag-title {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }

    .rag-arrow {
      margin-left: 4px;
      transition: transform 0.2s ease;

      &.active {
        transform: rotate(180deg);
      }
    }
    
    .el-icon { font-size: 16px; color: var(--el-color-primary); }
  }
  
  .rag-content {
    background: #fdfdfd;
    border: 1px dashed #e2e8f0;
    padding: 10px;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.01);
  }
  
  .kp-box {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f1f5f9;
    
    .kp-title {
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    
    .el-checkbox-group {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }
  }
}

.section-divider {
  margin: 0;
  border-color: #f1f5f9;
}

.btn-submit {
  flex: 1;
}

.simple-tip {
  margin-top: 8px;
  padding: 6px 8px;
  font-size: 11px;
  line-height: 1.4;
  color: #64748b;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px dashed #e2e8f0;
  display: flex;
  align-items: flex-start;
  gap: 6px;

  .el-icon {
    font-size: 13px;
    color: #94a3b8;
    margin-top: 1px;
  }
}

// Global utility
.w-full { width: 100%; }
.mb-2 { margin-bottom: 8px; }
</style>

