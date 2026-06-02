<template>
  <div class="case-edit-page dense-mode" v-loading="loading">
    <div class="bg-orb orb-a"></div>
    <div class="bg-orb orb-b"></div>
    <div class="bg-grid"></div>

    <div class="scroll-content">
      <header class="hero">
      <div class="hero-main">
        <el-button circle class="ghost-btn" @click="handleGoBack">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>

        <div class="hero-title-group">
          <h2>编辑案例</h2>
          <p>完善教学案例配置，兼顾课堂演示、实训任务与数据驱动评分场景</p>
          <div class="hero-tags">
            <el-tag size="small" effect="light" round type="info">
              <div class="tag-inner">
                <el-icon><component :is="form.type === 0 ? Collection : User" /></el-icon>
                <span>{{ form.type === 0 ? '公共案例' : '个性化案例' }}</span>
              </div>
            </el-tag>
            <el-tag size="small" effect="light" round :type="getDifficultyType(form.difficultyLevel)">
              <div class="tag-inner">
                <el-icon><component :is="getDifficultyIcon(form.difficultyLevel)" /></el-icon>
                <span>{{ getDifficultyLabel(form.difficultyLevel) }}</span>
              </div>
            </el-tag>
            <el-tag size="small" effect="light" round :type="sqlState === 'valid' ? 'success' : sqlState === 'invalid' ? 'danger' : 'info'">
              <div class="tag-inner">
                <el-icon><Document /></el-icon>
                <span>{{ sqlStateLabel }}</span>
              </div>
            </el-tag>
          </div>
        </div>
      </div>

      <div class="hero-stats">
        <div class="stat-card">
          <span class="stat-label">任务数量</span>
          <span class="stat-value">{{ taskList.length }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">任务完成度</span>
          <span class="stat-value">{{ taskCompletionRate }}%</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">编辑状态</span>
          <span class="stat-value" :class="{ active: hasChanges }">{{ hasChanges ? '已修改' : '未改动' }}</span>
        </div>
      </div>
    </header>

    <div class="edit-tabs-bar">
      <el-tabs v-model="activeEditTab" class="edit-page-tabs">
        <el-tab-pane name="edit">
          <template #label><span class="tab-label"><el-icon><Edit /></el-icon> 编辑</span></template>
        </el-tab-pane>
        <el-tab-pane name="preview">
          <template #label><span class="tab-label"><el-icon><View /></el-icon> 预览</span></template>
        </el-tab-pane>
      </el-tabs>
    </div>

    <main v-show="activeEditTab === 'edit'" class="content-grid">
      <section class="left-column">
        <el-card class="glass-card" shadow="never">
          <template #header>
            <div class="section-head">
              <div class="head-left">
                <div class="icon-wrap blue"><el-icon><Document /></el-icon></div>
                <div>
                  <h3>基础信息</h3>
                  <p>配置标题、标签、分类与教学时长</p>
                </div>
              </div>
            </div>
          </template>

          <el-form :model="form" label-position="top" class="edit-form" size="default">
            <el-form-item label="案例名称" required>
              <el-input v-model="form.caseName" placeholder="请输入清晰的案例名称" />
            </el-form-item>

            <el-form-item label="核心关键词">
              <el-input v-model="form.keywords" placeholder="例如：Spring Boot, Redis, 高并发" />
            </el-form-item>

            <div class="triple-row">
              <el-form-item label="案例类型">
                <el-select v-model="form.type" :teleported="false">
                  <el-option :value="0" label="公共案例 (通用)">
                    <div class="option-line"><el-icon><Collection /></el-icon><span>公共案例 (通用)</span></div>
                  </el-option>
                  <el-option :value="1" label="个性化案例 (指定学生)">
                    <div class="option-line"><el-icon><User /></el-icon><span>个性化案例 (指定学生)</span></div>
                  </el-option>
                </el-select>
              </el-form-item>

              <el-form-item label="难度等级">
                <el-select v-model="form.difficultyLevel" :teleported="false">
                  <el-option :value="1" label="入门">
                    <div class="option-line"><el-icon><Star /></el-icon><span>入门</span></div>
                  </el-option>
                  <el-option :value="2" label="进阶">
                    <div class="option-line"><el-icon><Connection /></el-icon><span>进阶</span></div>
                  </el-option>
                  <el-option :value="3" label="挑战">
                    <div class="option-line"><el-icon><Trophy /></el-icon><span>挑战</span></div>
                  </el-option>
                </el-select>
              </el-form-item>

              <el-form-item label="预计课时">
                <el-input-number v-model="form.estimatedHours" :min="1" :max="20" controls-position="right" />
              </el-form-item>
            </div>

            <el-form-item label="案例描述">
              <RichTextMarkdownEditor
                v-model="form.description"
                :rows="6"
                placeholder="简要描述案例的教学目标、知识点与课堂产出"
              />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="glass-card" shadow="never">
          <template #header>
            <div class="section-head">
              <div class="head-left">
                <div class="icon-wrap green"><el-icon><Reading /></el-icon></div>
                <div>
                  <h3>背景故事</h3>
                  <p>面向真实业务情境，提升学生代入感</p>
                </div>
              </div>
            </div>
          </template>
          <RichTextMarkdownEditor
            v-model="form.backgroundStory"
            :rows="12"
            placeholder="输入案例背景、业务冲突、角色目标与关键约束"
          />
        </el-card>
      </section>

      <section class="right-column">
        <el-card class="glass-card" shadow="never">
          <template #header>
            <div class="section-head">
              <div class="head-left">
                <div class="icon-wrap amber"><el-icon><List /></el-icon></div>
                <div>
                  <h3>任务清单</h3>
                  <p>覆盖基础练习、进阶拓展与验收闭环</p>
                </div>
              </div>
              <el-button type="primary" plain class="add-btn" @click="addTask">
                <el-icon><Plus /></el-icon>
                添加任务
              </el-button>
            </div>
          </template>

          <div class="task-scroll">
            <transition-group name="card-float" tag="div">
              <article v-for="(task, index) in taskList" :key="task.sequence || index" class="task-card-item">
                <div class="task-top">
                  <div class="task-index">{{ index + 1 }}</div>
                  <el-button type="danger" link @click="removeTask(index)">
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-button>
                </div>

                <el-input v-model="task.title" placeholder="任务标题（建议动词开头）" class="task-title" />
                <el-input v-model="task.description" type="textarea" :rows="2" resize="none" placeholder="任务说明" />
                <el-input v-model="task.requirements" type="textarea" :rows="2" resize="none" placeholder="验收标准（可量化）" />
              </article>
            </transition-group>

            <div v-if="taskList.length === 0" class="empty-wrap">
              <el-empty description="暂无任务，点击右上角添加任务" :image-size="80">
                <template #image>
                  <el-icon class="empty-icon"><List /></el-icon>
                </template>
              </el-empty>
            </div>
          </div>
        </el-card>

        <el-card class="glass-card" shadow="never">
          <template #header>
            <div class="section-head">
              <div class="head-left">
                <div class="icon-wrap slate"><el-icon><DataLine /></el-icon></div>
                <div>
                  <h3>模拟数据集</h3>
                  <p>用于任务输入与自动化评分验证</p>
                </div>
              </div>
              <div class="data-actions">
                <el-button @click="insertSqlTemplate" class="tool-btn" type="primary" plain>
                  <el-icon><MagicStick /></el-icon>
                  插入示例
                </el-button>
                <el-button @click="clearSql" class="tool-btn" type="danger" plain>
                  <el-icon><Delete /></el-icon>
                  清空
                </el-button>
              </div>
            </div>
          </template>

          <div class="sql-editor-container">
            <div class="sql-toolbar">
              <span class="sql-label">SQL Dataset</span>
              <el-tag size="small" :type="sqlState === 'valid' ? 'success' : sqlState === 'invalid' ? 'danger' : 'info'" effect="light">
                {{ sqlStateLabel }}
              </el-tag>
            </div>
            <vue-monaco-editor
              v-model:value="form.mockData"
              theme="vs"
              language="sql"
              :options="{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                formatOnPaste: true,
                formatOnType: true
              }"
              height="280px"
              class="monaco-editor-wrap"
            />
          </div>
        </el-card>
      </section>
    </main>

    <!-- 预览板块 -->
    <div v-show="activeEditTab === 'preview'" class="preview-pane">
      <div class="preview-pane-inner">
        <div class="preview-pane-header">
          <h3>{{ form.caseName || '未命名案例' }}</h3>
          <div class="preview-meta-row">
            <el-tag size="small" effect="plain">{{ getDifficultyLabel(form.difficultyLevel) }}</el-tag>
            <span class="meta-text">{{ form.estimatedHours }} 课时</span>
          </div>
        </div>
        <CaseSummaryView
          :background-story="form.backgroundStory"
          :task-list="taskList"
          :expected-output="form.expectedOutput"
        />
      </div>
    </div>

    <footer class="floating-action-bar">
      <div class="action-hint">
        <el-icon><EditPen /></el-icon>
        <span>{{ hasChanges ? '你有未保存的修改' : '所有更改已同步到当前表单' }}</span>
      </div>
      <div class="action-buttons">
        <el-button @click="handleReset" :disabled="!hasChanges">
          <el-icon><RefreshLeft /></el-icon>
          重置
        </el-button>
        <el-button type="primary" @click="handleSave" :loading="saving" :disabled="!hasChanges">
          <el-icon><Check /></el-icon>
          保存案例
        </el-button>
      </div>
    </footer>
    </div><!-- /scroll-content -->
  </div><!-- /case-edit-page -->
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus, Delete, Check, RefreshLeft, MagicStick, Document, Reading, List, DataLine, Star, Connection, Trophy, Collection, User, EditPen, CircleCheck, Edit, View } from '@element-plus/icons-vue'
import { getCaseDetail, updateCase } from '@/api/teacher/case'
import CaseSummaryView from '@/components/CaseSummaryView.vue'
import RichTextMarkdownEditor from '@/components/RichTextMarkdownEditor.vue'
import VueMonacoEditor from '@guolao/vue-monaco-editor'

const route = useRoute()
const router = useRouter()

const caseId = ref(route.params.id)
const loading = ref(false)
const saving = ref(false)
const originalData = ref(null)
const activeEditTab = ref('edit')

const form = ref({
  caseName: '',
  description: '',
  keywords: '',
  backgroundStory: '',
  mockData: '',
  expectedOutput: '',
  difficultyLevel: 2,
  estimatedHours: 3,
  courseId: null,
  type: 0 // 0-公共, 1-个性化
})

const taskList = ref([])

const hasChanges = computed(() => {
  if (!originalData.value) return false
  return JSON.stringify({ form: form.value, taskList: taskList.value }) !== JSON.stringify(originalData.value)
})

const sqlState = computed(() => {
  const content = form.value.mockData?.trim()?.toUpperCase()
  if (!content) return 'empty'
  if (content.includes('CREATE TABLE') || content.includes('INSERT INTO') || content.includes('SELECT')) {
    return 'valid'
  }
  return 'invalid'
})

const sqlStateLabel = computed(() => {
  if (sqlState.value === 'valid') return '包含 DDL/DML'
  if (sqlState.value === 'invalid') return '未检测到标准 SQL'
  return '暂无数据'
})

const taskCompletionRate = computed(() => {
  if (taskList.value.length === 0) return 0
  const completed = taskList.value.filter(task => task.title?.trim() && task.description?.trim() && task.requirements?.trim()).length
  return Math.round((completed / taskList.value.length) * 100)
})

const getDifficultyLabel = (level) => {
  const map = { 1: '入门', 2: '进阶', 3: '挑战' }
  return map[level] || '未知'
}

const getDifficultyIcon = (level) => {
  const map = { 1: Star, 2: Connection, 3: Trophy }
  return map[level] || Star
}

const getDifficultyType = (level) => {
  const map = { 1: 'success', 2: 'warning', 3: 'danger' }
  return map[level] || 'info'
}

const loadCase = async () => {
  loading.value = true
  try {
    const res = await getCaseDetail(caseId.value)
    const data = res.data
    
    form.value = {
      caseName: data.caseName || '',
      description: data.description || '',
      keywords: data.keywords || '',
      backgroundStory: data.backgroundStory || '',
      mockData: data.mockData || '',
      expectedOutput: data.expectedOutput || '',
      difficultyLevel: data.difficultyLevel || 2,
      estimatedHours: data.estimatedHours || 3,
      courseId: data.courseId,
      type: data.type || 0
    }
    
    try {
      taskList.value = JSON.parse(data.taskList || '[]')
    } catch {
      taskList.value = []
    }
    
    originalData.value = JSON.parse(JSON.stringify({ form: form.value, taskList: taskList.value }))
  } catch (e) {
    ElMessage.error('加载案例失败')
  } finally {
    loading.value = false
  }
}

const addTask = () => {
  taskList.value.push({
    sequence: taskList.value.length + 1,
    title: '',
    description: '',
    requirements: ''
  })
}

const removeTask = (index) => {
  taskList.value.splice(index, 1)
  taskList.value.forEach((t, i) => {
    t.sequence = i + 1
  })
}

const insertSqlTemplate = () => {
  const template = `-- 创建示例表
CREATE TABLE users (
  id INT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入测试数据
INSERT INTO users (id, username, email) VALUES
(1, 'admin', 'admin@example.com'),
(2, 'test_user', 'test@example.com');
`
  if (form.value.mockData?.trim()) {
    ElMessageBox.confirm('当前已有数据，插入模板将覆盖现有内容，是否继续？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      form.value.mockData = template
    }).catch(() => {})
  } else {
    form.value.mockData = template
  }
}

const clearSql = () => {
  if (!form.value.mockData?.trim()) return
  ElMessageBox.confirm('确定要清空所有 SQL 数据吗？', '警告', {
    confirmButtonText: '清空',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    form.value.mockData = ''
  }).catch(() => {})
}

const handleSave = async () => {
  if (!form.value.caseName.trim()) {
    ElMessage.warning('案例名称不能为空')
    return
  }
  
  saving.value = true
  try {
    taskList.value.forEach((t, i) => {
      t.sequence = i + 1
    })
    
    const payload = {
      ...form.value,
      taskList: JSON.stringify(taskList.value)
    }
    
    await updateCase(caseId.value, payload)
    ElMessage.success('保存成功')
    
    originalData.value = JSON.parse(JSON.stringify({ form: form.value, taskList: taskList.value }))
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleReset = () => {
  if (originalData.value) {
    form.value = JSON.parse(JSON.stringify(originalData.value.form))
    taskList.value = JSON.parse(JSON.stringify(originalData.value.taskList))
    ElMessage.info('已重置为原始数据')
  }
}

const handleGoBack = () => {
  router.replace({ name: 'CaseList' })
}

onMounted(() => {
  loadCase()
})
</script>

<style scoped lang="scss">
.case-edit-page {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  background: linear-gradient(180deg, #f6fbff 0%, #f8fafc 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-size: 13px; /* 整体字体缩小 */
}

.scroll-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px 24px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 999px;
  }
}

.bg-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(48px);
  pointer-events: none;
  z-index: 0;
}

.orb-a {
  width: 320px;
  height: 320px;
  top: -90px;
  left: -60px;
  background: rgba(14, 165, 233, 0.2);
  animation: floatA 10s ease-in-out infinite;
}

.orb-b {
  width: 300px;
  height: 300px;
  right: -80px;
  top: 90px;
  background: rgba(16, 185, 129, 0.16);
  animation: floatB 12s ease-in-out infinite;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(148, 163, 184, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.09) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(circle at 50% 40%, black 35%, transparent 85%);
  pointer-events: none;
  z-index: 0;
}

.hero,
.edit-tabs-bar,
.content-grid,
.preview-pane,
.floating-action-bar {
  position: relative;
  z-index: 1;
}

/* ---- Tab bar ---- */
.edit-tabs-bar {
  padding: 0 4px 0 0;
  margin-bottom: -4px;

  :deep(.el-tabs__header) { margin: 0; }
  :deep(.el-tabs__nav-wrap::after) { height: 1px; background: #e2e8f0; }

  .tab-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
  }
}

/* ---- Preview pane ---- */
.preview-pane {
  padding: 16px;
  flex: 1;
  overflow-y: auto;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
}

.preview-pane-inner {
  max-width: 800px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 28px 32px;
}

.preview-pane-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;

  h3 {
    font-size: 20px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 8px;
  }
}

.preview-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;

  .meta-text {
    font-size: 12px;
    color: #64748b;
  }
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
  margin-bottom: 12px;
  animation: enterY 0.5s ease;
}

.hero-main {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  flex: 1;
}

.ghost-btn {
  border-color: #dbeafe;
  color: #0369a1;
  background: #f0f9ff;
}

.hero-title-group {
  h2 {
    margin: 0;
    color: #0f172a;
    font-size: 18px;
    font-weight: 700;
  }

  p {
    margin: 4px 0 8px;
    color: #475569;
    font-size: 11px;
  }
}

.hero-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center; /* 确保标签垂直居中对齐 */
}

.tag-inner {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hero-tags :deep(.el-tag) {
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
}

.hero-tags :deep(.el-tag .el-icon) {
  margin-right: 0; /* 移除默认的右边距，使用 gap 控制 */
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(70px, 90px));
  gap: 6px;
}

.stat-card {
  padding: 6px;
  border-radius: 10px;
  background: linear-gradient(145deg, #ffffff, #f8fbff);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: transform 0.3s ease;

  &:hover {
    transform: translateY(-2px);
  }

  .stat-label {
    color: #64748b;
    font-size: 11px;
  }

  .stat-value {
    color: #0f172a;
    font-size: 15px;
    font-weight: 700;

    &.active {
      color: #0891b2;
    }
  }
}

.content-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.glass-card {
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  transition: transform 0.35s ease, box-shadow 0.35s ease;
  animation: enterY 0.6s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  }

  :deep(.el-card__header) {
    border-bottom: 1px solid #eef2f7;
    padding: 10px 12px;
  }

  :deep(.el-card__body) {
    padding: 10px 12px 12px;
  }
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 8px;

  h3 {
    margin: 0;
    font-size: 14px;
    color: #0f172a;
  }

  p {
    margin: 2px 0 0;
    color: #64748b;
    font-size: 11px;
  }
}

.icon-wrap {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-size: 15px;

  &.blue {
    background: #e0f2fe;
    color: #0284c7;
  }

  &.green {
    background: #dcfce7;
    color: #059669;
  }

  &.amber {
    background: #fef3c7;
    color: #d97706;
  }

  &.slate {
    background: #e2e8f0;
    color: #334155;
  }
}

.edit-form {
  :deep(.el-form-item__label) {
    color: #334155;
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 4px;
  }

  :deep(.el-input__wrapper),
  :deep(.el-textarea__inner),
  :deep(.el-select__wrapper) {
    border-radius: 8px;
    background: #f8fafc;
    box-shadow: 0 0 0 1px #dce3ec inset;
    transition: all 0.25s ease;
    font-size: 12px;
  }

  :deep(.el-input__wrapper.is-focus),
  :deep(.el-select__wrapper.is-focused) {
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2), 0 0 0 1px #0ea5e9 inset;
    background: #ffffff;
  }

  :deep(.el-textarea__inner:focus) {
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
    border-color: #0ea5e9;
    background: #ffffff;
  }
}

.triple-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.option-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.add-btn,
.tool-btn {
  border-radius: 8px;
  font-size: 12px;
  padding: 6px 12px;
}

.task-scroll {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 6px;
  padding-left: 16px; /* 为时间轴留出空间 */
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 27px; /* 调整线条位置对齐圆圈中心 */
    top: 10px;
    bottom: 10px;
    width: 2px;
    background: #e2e8f0;
    z-index: 0;
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 999px;
  }
}

.task-card-item {
  position: relative;
  border: 1px solid rgba(226, 232, 240, 0.6);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 12px 16px 16px 36px; /* 左侧留出圆圈空间 */
  margin-bottom: 16px;
  transition: all 0.3s ease;
  z-index: 1;

  &:hover {
    transform: translateX(4px);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    border-color: rgba(14, 165, 233, 0.3);
  }

  .task-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
}

.task-index {
  position: absolute;
  left: -12px;
  top: 14px;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #ffffff;
  border: 2px solid #0ea5e9;
  color: #0ea5e9;
  font-weight: 700;
  font-size: 12px;
  box-shadow: 0 2px 6px rgba(14, 165, 233, 0.2);
  z-index: 2;
}

.task-title {
  margin-bottom: 10px;

  :deep(.el-input__wrapper) {
    background: transparent;
    box-shadow: none;
    border-bottom: 1px solid transparent;
    border-radius: 0;
    padding: 0;
    
    &:hover, &.is-focus {
      background: transparent;
      box-shadow: none;
      border-bottom: 1px solid #0ea5e9;
    }
  }

  :deep(.el-input__inner) {
    font-weight: 600;
    font-size: 14px;
    color: #0f172a;
    
    &::placeholder {
      color: #94a3b8;
      font-weight: 400;
    }
  }
}

.task-card-item {
  :deep(.el-textarea__inner) {
    background: rgba(248, 250, 252, 0.5);
    border: 1px solid transparent;
    box-shadow: none;
    margin-bottom: 8px;
    
    &:hover {
      background: rgba(241, 245, 249, 0.8);
    }
    
    &:focus {
      background: #ffffff;
      border-color: #bae6fd;
      box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.1);
    }
  }
}

.empty-wrap {
  padding: 20px 0;
  position: relative;
  z-index: 1;
  background: #ffffff;

  .empty-icon {
    font-size: 56px;
    color: #94a3b8;
  }
}

.data-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sql-editor-container {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #dbe7f2;
  background: #ffffff; /* Monaco 默认浅色背景 */
  box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.02);
}

.sql-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.sql-label {
  color: #475569;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.monaco-editor-wrap {
  width: 100%;
}

.floating-action-bar {
  flex-shrink: 0;
  margin: 0 16px 16px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.06), 0 10px 30px rgba(15, 23, 42, 0.12);
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  animation: enterY 0.7s ease;
  z-index: 10;
}

.dense-mode {
  .hero {
    padding: 12px 16px;
    border-radius: 12px;
    margin-bottom: 16px;
    background: rgba(255, 255, 255, 0.65); /* 创新设计：更通透的玻璃态 */
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  .hero-title-group {
    h2 {
      font-size: 18px; /* 缩小字体 */
      letter-spacing: -0.5px;
    }

    p {
      margin: 4px 0 8px;
      font-size: 12px;
    }
  }

  .hero-stats {
    grid-template-columns: repeat(4, minmax(70px, 90px)); /* 缩小统计卡片 */
    gap: 8px;
  }

  .stat-card {
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);

    .stat-label {
      font-size: 11px;
    }

    .stat-value {
      font-size: 16px;
    }
  }

  .content-grid {
    grid-template-columns: 340px minmax(0, 1fr); /* 缩小左侧栏宽度 */
    gap: 16px;
  }

  .left-column,
  .right-column {
    gap: 16px;
  }

  .glass-card {
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.75); /* 创新设计：更轻盈的卡片 */
    border: 1px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.03);

    :deep(.el-card__header) {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.04);
    }

    :deep(.el-card__body) {
      padding: 16px;
    }
  }

  .head-left {
    h3 {
      font-size: 14px;
      font-weight: 600;
    }

    p {
      font-size: 11px;
      opacity: 0.8;
    }
  }

  .icon-wrap {
    width: 28px;
    height: 28px;
    font-size: 14px;
    border-radius: 8px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5); /* 创新设计：内发光图标 */
  }

  .triple-row {
    gap: 12px;
  }

  .task-scroll {
    max-height: 480px; /* 缩小滚动区域 */
  }

  .task-card-item {
    padding: 12px 16px 16px 36px;
    margin-bottom: 16px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.02);
  }

  .floating-action-bar {
    padding: 10px 16px;
    margin: 0 16px 16px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.06), 0 1px 0 rgba(255, 255, 255, 1) inset; /* 创新设计：悬浮光影 */
  }

  .action-hint {
    font-size: 12px;
  }
  
  /* 创新设计：表单输入框优化 */
  .edit-form {
    :deep(.el-form-item__label) {
      font-size: 13px;
      margin-bottom: 6px;
    }
    :deep(.el-input__wrapper),
    :deep(.el-textarea__inner),
    :deep(.el-select__wrapper) {
      background: rgba(255, 255, 255, 0.5);
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: none;
      &:hover {
        background: rgba(255, 255, 255, 0.8);
      }
    }
  }
}

.action-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.card-float-enter-active,
.card-float-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-float-enter-from,
.card-float-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.97);
}

@keyframes enterY {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes floatA {
  0%,
  100% { transform: translate(0, 0); }
  50% { transform: translate(18px, 14px); }
}

@keyframes floatB {
  0%,
  100% { transform: translate(0, 0); }
  50% { transform: translate(-12px, -20px); }
}

@media (max-width: 1280px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    flex-direction: column;
  }

  .hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .scroll-content {
    padding: 10px 10px 24px;
  }

  .triple-row {
    grid-template-columns: 1fr;
  }

  .hero-stats {
    grid-template-columns: 1fr;
  }

  .floating-action-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .action-buttons {
    width: 100%;

    :deep(.el-button) {
      flex: 1;
    }
  }
}
</style>
