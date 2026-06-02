<template>
  <div class="workflow-designer">
    <WorkflowHeader
      :title="pageTitle"
      v-model:caseType="selectedCaseType"
      v-model:difficulty="selectedDifficulty"
      :status-text="loadStatus.text"
      :status-type="loadStatus.type"
      @back="$router.back()"
      @change="loadWorkflowConfig"
      @save="handleSaveWorkflow"
      @run="handleRunTest"
      @autoFill="handleAutoFillPrompts"
      @restore="handleRestoreDefault"
    />

    <div class="designer-body" ref="containerRef">
      <!-- Left: Flow Steps Guide -->
      <WorkflowToolbox
        :width="leftPanelWidth"
        :agent-definitions="agentDefinitions"
        :nodes="nodes"
        :active-step-key="selectedNode?.id || selectedNode?.subType || ''"
        @selectStep="handleSelectStep"
      />
      
      <!-- Left Resize Handle -->
      <div class="resize-handle left-handle" @mousedown="startResize($event, 'left')"></div>

      <!-- Canvas (Locked: no drop, no node drag, no draw connection) -->
      <WorkflowCanvas
        ref="canvasRef"
        :nodes="nodes"
        :connections="connections"
        :selected-node="selectedNode"
      :selected-connection="selectedConnection"
      :zoom="zoom"
      :pan="pan"
      :drawing-path="''"
      :is-drawing-connection="false"
      :validation-results="validationResult"
      @panStart="startPan"
      @mouseMove="onMouseMove"
        @mouseUp="onMouseUp"
        @mouseLeave="onMouseLeave"
        @wheel="onWheel"
        @selectNode="selectNode"
        @zoomIn="zoomIn"
        @zoomOut="zoomOut"
        @fitView="fitView"
      />

      <!-- Right Resize Handle -->
      <div class="resize-handle right-handle" @mousedown="startResize($event, 'right')"></div>

      <!-- Right Properties Panel -->
      <WorkflowPropertiesPanel
        :width="rightPanelWidth"
        v-model:selectedNode="selectedNode"
        :selected-connection="selectedConnection"
        @openAiPromptHelper="openAiPromptHelper"
        @showPromptGuide="showPromptGuide = true"
      />
    </div>

    <!-- Dialogs -->
    <WorkflowDialogs
      v-model:aiPromptVisible="showAiPromptDialog"
      v-model:guideVisible="showPromptGuide"
      v-model:validationVisible="validationVisible"
      v-model:batchGenVisible="batchGenVisible"
      :validation-result="validationResult"
      :batch-gen-state="batchGenState"
      :nodes="nodes"
      :ai-generating="aiGenerating"
      :initial-task="aiPromptTask"
      :initial-input="aiPromptInput"
      @generate="handleGeneratePrompt"
    />

    <WorkflowTestRunDialog
      v-model="testRunVisible"
      :execution-state="testRunState"
      :nodes="nodes"
      :connections="connections"
      :test-input="testRunInput"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

// API
import { 
  getWorkflowByCaseDifficulty,
  getPredefinedTemplate,
  saveWorkflowForCaseDifficulty,
  generatePromptByAi as apiGeneratePromptByAi,
  testRunWorkflow,
  getWorkflowExecutionStatus
} from '@/api/teacher/case'

// 组件
import WorkflowHeader from './components/WorkflowHeader.vue'
import WorkflowToolbox from './components/WorkflowToolbox.vue'
import WorkflowCanvas from './components/WorkflowCanvas.vue'
import WorkflowPropertiesPanel from './components/WorkflowPropertiesPanel.vue'
import WorkflowDialogs from './components/WorkflowDialogs.vue'
import WorkflowTestRunDialog from './components/WorkflowTestRunDialog.vue'
import {
  getRecommendedWorkflowTemplateType,
  getWorkflowModeLabel
} from './workflowModes'

// 逻辑需要的图标（非模板，用于节点数据）
import { 
  VideoPlay, SwitchButton, Cpu, View, DataLine, Operation, 
  Search, EditPen, Collection, List, CircleCheck
} from '@element-plus/icons-vue'

const route = useRoute()
const initialTemplateType = route.query.loadTemplate || null

// --- 状态 ---

// 布局
const leftPanelWidth = ref(240)
const rightPanelWidth = ref(300)
const isResizing = ref(null)
const containerRef = ref(null)

// 状态提示
const loadStatus = reactive({ text: '', type: '' })

// 工作流数据
const nodes = ref([])
const connections = ref([])

// 选中项
const selectedNode = ref(null)
const selectedConnection = ref(null)

// 画布视图
const canvasRef = ref(null)
const pan = reactive({ x: 0, y: 0 })
const zoom = ref(1)
const isPanning = ref(false)
const lastMousePos = reactive({ x: 0, y: 0 })

// 拖拽
const isDraggingNode = ref(false)
const draggedNode = ref(null)

// 连线绘制
const isDrawingConnection = ref(false)
const drawingPath = ref('')
const connectionStartNode = ref(null)
const connectionStartType = ref(null)

// 配置
const selectedCaseType = ref(route.query.caseType || 'FULL_PRACTICE')
const selectedDifficulty = ref(route.query.difficulty || 'MEDIUM')

// AI Prompt 助手
const showAiPromptDialog = ref(false)
const aiPromptTask = ref('')
const aiPromptInput = ref('')
const aiGenerating = ref(false)
const currentEditingNode = ref(null)
const showPromptGuide = ref(false)
const validationVisible = ref(false)
const validationResult = ref(null)
const batchGenVisible = ref(false)
const isBatchGenCancelled = ref(false)
const batchGenState = reactive({
  total: 0,
  currentIndex: 0,
  currentNodeName: '',
  successCount: 0,
  failCount: 0,
  timeElapsed: '0秒',
  isComplete: false,
  currentResult: null,
  history: [], // 存储所有节点的生成记录 { id, name, status, result, timestamp }
  currentAgentId: null, // 当前正在生成的节点ID
  results: [] // 所有节点的生成结果
})
const testRunVisible = ref(false)
const testRunInput = ref('')
const testRunState = ref(createEmptyTestRunState())
let testRunPollTimer = null

// --- 常量 ---

const agentDefinitions = {
  'agent-design': {
    label: '案例生成 Agent',
    icon: 'EditPen',
    agentType: 'GenerationAgent', // 🆕 后端Agent类型映射
    defaultModel: 'DeepSeek V4 Pro',
    defaultPrompt: `## 角色设定
你是一个富有创造力的实训案例设计师，擅长编写贴合真实企业场景的实训案例。

## 任务目标
基于输入的关键词和需求，生成完整的实训案例草案。

## 输入数据
关键词：{{keywords}}
需求描述：{{input}}

## 生成内容
1. **案例名称**：简洁明确的案例标题
2. **案例背景**：贴合真实企业场景的故事背景
3. **实训任务**：3-5个递进式任务描述
4. **数据库设计要求**：表结构和字段说明

## 输出格式
请以结构化的 JSON 格式输出完整案例。`,
    desc: '生成案例草案（包含名称、背景、任务、数据库设计）'
  },
  'agent-knowledge': {
    label: '结构化规范 Agent',
    icon: 'Collection',
    agentType: 'StructuringAgent', // 🆕 后端Agent类型映射
    defaultModel: 'DeepSeek V4 Pro',
    defaultPrompt: `## 角色设定
你是一个严谨的数据规范专家，擅长将非结构化内容转换为标准化格式。

## 任务目标
将生成的案例草案规范到固定的 Schema 结构。

## 输入数据
{{node_generation_output}}

## 规范要求
1. 确保所有必填字段完整
2. 统一数据格式和命名规范
3. 验证字段类型和取值范围
4. 补充缺失的默认值

## 输出格式
请返回符合系统 Schema 的标准 JSON 格式。`,
    desc: '将案例草案规范到固定Schema结构'
  },
  'agent-question': {
    label: '质量校验 Agent',
    icon: 'List',
    agentType: 'ValidationAgent', // 🆕 后端Agent类型映射
    defaultModel: 'DeepSeek V4 Pro',
    defaultPrompt: `## 角色设定
你是一个严谨的质量审查专家，擅长发现案例中的逻辑问题和质量缺陷。

## 任务目标
对结构化后的案例进行全面质量校验。

## 输入数据
{{node_structuring_output}}

## 校验维度
1. **逻辑一致性**：任务描述与技术要求是否匹配
2. **完整性**：必要信息是否完整
3. **可行性**：技术方案是否可实施
4. **难度适配**：难度设定是否合理
5. **语言规范**：表述是否清晰准确

## 输出格式
请返回 JSON 格式的校验报告，包含问题列表和质量评分（0-100）。`,
    desc: '质量校验和逻辑一致性检查'
  },
  'agent-data': {
    label: '数据生成 Agent',
    icon: 'DataLine',
    agentType: 'DataGenerationAgent', // 🆕 后端Agent类型映射
    defaultModel: 'DeepSeek V4 Pro',
    defaultPrompt: `## 角色设定
你是一个数据库设计和数据生成专家，擅长生成真实合理的模拟数据。

## 任务目标
基于案例的数据库设计，生成结构化的模拟数据。

## 输入数据
{{node_structuring_output}}

## 生成要求
1. **真实性**：数据符合真实业务场景
2. **完整性**：覆盖所有表和字段
3. **关联性**：外键关联关系正确
4. **多样性**：提供足够的测试数据量

## 输出格式
请返回 SQL INSERT 语句或 JSON 格式的测试数据。`,
    desc: '生成结构化的数据库模拟数据'
  },
  'agent-review': {
    label: '教学审核 Agent',
    icon: 'CircleCheck',
    agentType: 'ReviewAgent', // 🆕 后端Agent类型映射
    defaultModel: 'DeepSeek V4 Pro',
    defaultPrompt: `## 角色设定
你是一个教学专家，擅长评估实训案例的教学效果和知识覆盖度。

## 任务目标
对完整案例进行教学匹配度评估和知识点覆盖分析。

## 输入数据
{{input}}

## 评审维度
1. **知识点覆盖度**：是否充分覆盖课程相关技术知识点
2. **教学适配性**：案例难度和内容是否适合目标学生群体
3. **实践价值**：是否贴近真实企业项目场景
4. **教学完整性**：案例是否形成完整的教学闭环
5. **可操作性**：任务是否可执行，评分标准是否清晰

## 输出格式
请返回 JSON 格式的评审报告，包含教学匹配度评分（0-100）、知识点覆盖清单和改进建议。`,
    desc: '教学匹配度评估和知识点覆盖分析'
  }
}

const defaultWorkflowPresets = {
  FULL_PRACTICE: [
    {
      label: '教学需求解析Agent',
      icon: 'Search',
      agentType: 'GenerationAgent',
      defaultModel: 'DeepSeek V4 Pro',
      defaultPrompt: '解析教学目标、业务边界、交付物类型与评分重点，只输出需求分析结果，不生成数据库设计、模拟数据和复杂评分细则。',
      desc: '解析教学目标、业务边界、交付物类型与评分重点'
    },
    {
      label: '案例骨架生成Agent',
      icon: 'EditPen',
      agentType: 'StructuringAgent',
      defaultModel: 'DeepSeek V4 Flash',
      defaultPrompt: '生成完整实训案例骨架，补全背景故事、六阶段任务链和交付物要求，不生成 mock data 和复杂验证规则。',
      desc: '生成背景故事、任务链路、参数配置和案例骨架'
    },
    {
      label: '结构化验证设计Agent',
      icon: 'List',
      agentType: 'ValidationAgent',
      defaultModel: 'DeepSeek V4 Pro',
      defaultPrompt: '设计 ER 图、UML、SQL、ECharts 的结构化验证规则和即时反馈文案，并给出质量评分。',
      desc: '设计 ER 图、UML、ECharts、SQL等结构化验证规则'
    },
    {
      label: '模拟数据与模板库Agent',
      icon: 'DataLine',
      agentType: 'DataGenerationAgent',
      defaultModel: 'DeepSeek V4 Flash',
      defaultPrompt: '补全数据库设计摘要、模拟数据集和模板库定位，输出 JSON/SQL/CSV 示例数据与复用说明。',
      desc: '补全模拟数据集，并说明模板库定位与复用方式'
    },
    {
      label: '考核方案设计Agent',
      icon: 'CircleCheck',
      agentType: 'ReviewAgent',
      defaultModel: 'DeepSeek V4 Pro',
      defaultPrompt: '生成自动评分、教师评分、学生报告和班级分析方案。',
      desc: '生成自动评分、教师评分、学生报告和班级分析方案'
    }
  ],
  PURE_CODING: [
    {
      label: '编码需求解析Agent',
      icon: 'Search',
      agentType: 'GenerationAgent',
      defaultModel: 'DeepSeek V4 Pro',
      defaultPrompt: '提取接口、实体、约束与验收标准等编码需求。',
      desc: '提取接口、实体、约束与验收标准等编码需求'
    },
    {
      label: '编码任务生成Agent',
      icon: 'EditPen',
      agentType: 'StructuringAgent',
      defaultModel: 'DeepSeek V4 Flash',
      defaultPrompt: '生成聚焦接口开发与代码实现的纯编码任务骨架。',
      desc: '生成聚焦接口开发与代码实现的纯编码任务骨架'
    },
    {
      label: 'MCP协作设计Agent',
      icon: 'Operation',
      agentType: 'ValidationAgent',
      defaultModel: 'DeepSeek V4 Pro',
      defaultPrompt: '设计多 Agent / MCP 协作、执行链和验收约束。',
      desc: '设计多 Agent / MCP 协作、执行链和验收约束'
    },
    {
      label: '代码验收与评分Agent',
      icon: 'CircleCheck',
      agentType: 'ReviewAgent',
      defaultModel: 'DeepSeek V4 Pro',
      defaultPrompt: '生成代码验收规则、评分标准和反馈建议。',
      desc: '生成代码验收规则、评分标准和反馈建议'
    }
  ]
}

// --- 计算属性 ---

const pageTitle = computed(() => {
  const difficultyLabelMap = {
    EASY: '初级',
    MEDIUM: '中级',
    HARD: '高级'
  }
  return `${getWorkflowModeLabel(selectedCaseType.value)} - ${difficultyLabelMap[selectedDifficulty.value] || '中级'}`
})

const MIN_NODE_GAP = 60

const getNodeWidth = (node) => {
  if (!node) return 240
  return node.type === 'start-node' || node.type === 'end-node' ? 140 : 240
}

const normalizeNodeSpacing = (nodeList) => {
  if (!Array.isArray(nodeList) || nodeList.length <= 1) {
    return nodeList
  }

  const sorted = [...nodeList].sort((a, b) => (a?.x || 0) - (b?.x || 0))
  let previousRight = null

  sorted.forEach((node) => {
    if (previousRight !== null) {
      const minLeft = previousRight + MIN_NODE_GAP
      if ((node.x || 0) < minLeft) {
        node.x = minLeft
      }
    }
    previousRight = (node.x || 0) + getNodeWidth(node)
  })

  return nodeList
}

const normalizeWorkflowModelLabel = (model) => {
  if (!model) return model
  if (model === 'DeepSeek Chat' || model === 'deepseek-chat' || model === 'deepseek-v4-flash') {
    return 'DeepSeek V4 Flash'
  }
  if (model === 'DeepSeek Reasoner' || model === 'deepseek-reasoner' || model === 'deepseek-v4-pro') {
    return 'DeepSeek V4 Pro'
  }
  return model
}

const normalizeWorkflowNodes = (nodeList) => {
  if (!Array.isArray(nodeList)) {
    return []
  }
  return nodeList.map((node) => {
    if (!node) return node
    if (node.type !== 'agent-node') {
      return { ...node }
    }
    return {
      ...node,
      meta: normalizeWorkflowModelLabel(node.meta)
    }
  })
}

// --- Methods ---

// Initialization
onMounted(() => {
  initializeDesigner()
  centerCanvas()
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
  window.removeEventListener('keydown', handleKeyDown)
  stopTestRunPolling()
})

const loadDefault = () => {
  const startX = 200
  const gap = 300
  const preset = defaultWorkflowPresets[selectedCaseType.value] || defaultWorkflowPresets.FULL_PRACTICE
  
  const defaultNodes = [
    { id: 'n1', type: 'start-node', label: '开始', icon: 'VideoPlay', x: startX, y: 250 }
  ]
  
  preset.forEach((def, index) => {
    defaultNodes.push({
      id: `n${index + 2}`,
      type: 'agent-node',
      subType: `default-${selectedCaseType.value}-${index + 1}`,
      agentType: def.agentType,
      label: def.label,
      icon: def.icon,
      meta: def.defaultModel,
      prompt: def.defaultPrompt,
      desc: def.desc,
      temperature: 0.7,
      x: startX + gap * (index + 1),
      y: 250
    })
  })
  
  defaultNodes.push({ 
    id: `n${preset.length + 2}`, 
    type: 'end-node', 
    label: '结束', 
    icon: 'SwitchButton', 
    x: startX + gap * (preset.length + 1), 
    y: 250 
  })
  
  normalizeNodeSpacing(defaultNodes)
  nodes.value = defaultNodes
  
  // 生成顺序连线
  const defaultConnections = []
  for (let i = 0; i < defaultNodes.length - 1; i++) {
    defaultConnections.push({
      source: defaultNodes[i].id,
      target: defaultNodes[i+1].id
    })
  }
  connections.value = defaultConnections
}

const applyStructure = (structure) => {
  if (!structure || !Array.isArray(structure.nodes) || structure.nodes.length === 0) {
    return false
  }

  const normalizedNodes = normalizeWorkflowNodes(structure.nodes)
  normalizeNodeSpacing(normalizedNodes)

  nodes.value = normalizedNodes
  connections.value = Array.isArray(structure.connections) ? structure.connections : []
  return true
}

const loadRecommendedTemplate = async (templateType) => {
  try {
    const res = await getPredefinedTemplate(templateType)
    const template = res?.data?.template || res?.template
    if (!template?.structureJson) {
      return false
    }

    const parsed = JSON.parse(template.structureJson)
    const applied = applyStructure(parsed)
    if (applied) {
      loadStatus.text = `已加载${template.name || '推荐模板'}`
      loadStatus.type = 'success'
    }
    return applied
  } catch (error) {
    console.error('加载推荐模板失败:', error)
    return false
  }
}

const initializeDesigner = async () => {
  const loadTemplateType = initialTemplateType || getRecommendedWorkflowTemplateType(selectedCaseType.value)
  await loadWorkflowConfig(loadTemplateType)
}

const loadWorkflowConfig = async (fallbackTemplateType = null) => {
  if (selectedCaseType.value && selectedDifficulty.value) {
    loadStatus.text = '加载中...'
    loadStatus.type = 'info'
    const recommendedTemplateType = fallbackTemplateType || getRecommendedWorkflowTemplateType(selectedCaseType.value)

    try {
      const res = await getWorkflowByCaseDifficulty(
        selectedCaseType.value,
        selectedDifficulty.value
      )
      
      // 兼容直接返回数据或标准响应结构
      const data = res.data || res
      
      let hasContent = false
      // 检查 data.exists (业务字段) 
      if (data && (data.exists || data.template) && data.template && data.template.structure) {
        const structure = data.template.structure
        if (structure.nodes && structure.nodes.length > 0) {
          nodes.value = normalizeWorkflowNodes(structure.nodes)
          connections.value = structure.connections || []
          hasContent = true
          
          loadStatus.text = '已加载配置'
          loadStatus.type = 'success'
        }
      }

      if (!hasContent) {
        if (data && data.exists) {
           loadStatus.text = '配置为空 (使用默认)'
           loadStatus.type = 'warning'
        } else {
           loadStatus.text = '暂无配置 (使用默认)'
           loadStatus.type = 'info'
        }
        const loaded = await loadRecommendedTemplate(
          recommendedTemplateType
        )
        if (!loaded) {
          loadDefault()
        }
      }
      
      nextTick(() => fitView())
    } catch (e) {
      console.error('Failed to load workflow for case mode and difficulty:', e)
      loadStatus.text = '加载失败 (使用默认)'
      loadStatus.type = 'warning'
      loadDefault()
      nextTick(() => fitView())
    }
  }
}

// Layout Resizing
const startResize = (e, direction) => {
  isResizing.value = direction
  document.body.style.cursor = 'col-resize'
  e.preventDefault()
}

const handleGlobalMouseMove = (event) => {
  // 调整大小
  if (isResizing.value) {
    const containerRect = containerRef.value.getBoundingClientRect()
    if (isResizing.value === 'left') {
      const newWidth = event.clientX - containerRect.left
      if (newWidth > 150 && newWidth < 500) leftPanelWidth.value = newWidth
    } else {
      throw new Error(response?.message || 'AI 生成失败，请重试')
      const newWidth = containerRect.right - event.clientX
      if (newWidth > 200 && newWidth < 600) rightPanelWidth.value = newWidth
    }
    return
  }

  // 节点拖拽
  if (isDraggingNode.value && draggedNode.value) {
    const dx = (event.clientX - lastMousePos.x) / zoom.value
    const dy = (event.clientY - lastMousePos.y) / zoom.value
    draggedNode.value.x += dx
    draggedNode.value.y += dy
  } 
  
  // 画布平移
  if (isPanning.value) {
    const dx = event.clientX - lastMousePos.x
    const dy = event.clientY - lastMousePos.y
    pan.x += dx
    pan.y += dy
  }
  
  // Connection Drawing
  if (isDrawingConnection.value) {
    // We need to access canvasRef to get bounding rect, but it's in child component.
    // However, we passed canvasRef down or we can expose it.
    // Actually, WorkflowCanvas handles mouseMove event emitting, but global mouse move is here.
    // Let's rely on event.clientX/Y.
    // We need the rect of the canvas container.
    // Accessing component ref exposed value:
    const canvasEl = canvasRef.value?.canvasRef // WorkflowCanvas exposes canvasRef
    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect()
      const mouseX = (event.clientX - rect.left - pan.x) / zoom.value
      const mouseY = (event.clientY - rect.top - pan.y) / zoom.value
      
      const startPos = getPortPosition(connectionStartNode.value, connectionStartType.value)
      drawingPath.value = `M ${startPos.x} ${startPos.y} C ${startPos.x + 50} ${startPos.y}, ${mouseX - 50} ${mouseY}, ${mouseX} ${mouseY}`
    }
  }

  lastMousePos.x = event.clientX
  lastMousePos.y = event.clientY
}

const handleGlobalMouseUp = () => {
  isPanning.value = false
  isDraggingNode.value = false
  draggedNode.value = null
  isResizing.value = null
  document.body.style.cursor = ''
  
  if (isDrawingConnection.value) {
    resetDrawing()
  }
}

// 画布交互
const startPan = (event) => {
  // 检查目标是背景还是画布本身（此逻辑可能需要根据子组件中的 DOM 结构进行调整）
  // WorkflowCanvas 在容器上按下鼠标时发出 'panStart'。
  isPanning.value = true
  lastMousePos.x = event.clientX
  lastMousePos.y = event.clientY
}

const onMouseMove = (event) => {
  // This is handled by global mouse move for drag/pan consistency
}

const onMouseUp = () => {}
const onMouseLeave = () => {}

const zoomIn = () => zoom.value = Math.min(zoom.value + 0.1, 2)
const zoomOut = () => zoom.value = Math.max(zoom.value - 0.1, 0.2)

const onWheel = (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    zoom.value = Math.max(0.2, Math.min(2, zoom.value + delta))
  }
}

const fitView = () => {
  if (nodes.value.length === 0) return centerCanvas()
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.value.forEach(n => {
    const nodeWidth = getNodeWidth(n)
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + nodeWidth)
    maxY = Math.max(maxY, n.y + 150)
  })
  
  const padding = 50
  const width = maxX - minX + padding * 2
  const height = maxY - minY + padding * 2
  
  const canvasEl = canvasRef.value?.canvasRef
  if (!canvasEl) return

  const containerW = canvasEl.clientWidth
  const containerH = canvasEl.clientHeight
  
  const scale = Math.min(containerW / width, containerH / height, 1)
  
  zoom.value = scale
  pan.x = (containerW - width * scale) / 2 - minX * scale + padding * scale
  pan.y = (containerH - height * scale) / 2 - minY * scale + padding * scale
}

const centerCanvas = () => {
  pan.x = 50
  pan.y = 50
  zoom.value = 1
}

// 节点逻辑
const onDragStart = (event, type) => {
  // 已禁用拖拽添加
}

const onDrop = (event) => {
  // 已禁用拖拽添加
}

// 左侧流程步骤点击 → 选中对应画布节点
const handleSelectStep = (stepKey) => {
  const node = nodes.value.find(n => n.id === stepKey || n.subType === stepKey)
  if (node) {
    selectNode(node)
  }
}

const startDragNode = (event, node) => {
  isDraggingNode.value = true
  draggedNode.value = node
  lastMousePos.x = event.clientX
  lastMousePos.y = event.clientY
  selectNode(node)
}

const selectNode = (node) => {
  selectedNode.value = node
  selectedConnection.value = null
}

const deleteNode = (node) => {
  nodes.value = nodes.value.filter(n => n.id !== node.id)
  connections.value = connections.value.filter(c => c.source !== node.id && c.target !== node.id)
  selectedNode.value = null
}

// 连线逻辑
const selectConnection = (conn) => {
  selectedConnection.value = conn
  selectedNode.value = null
}

const deleteConnection = (conn) => {
  connections.value = connections.value.filter(c => c !== conn)
  selectedConnection.value = null
}

const startDrawConnection = (event, node, type) => {
  isDrawingConnection.value = true
  connectionStartNode.value = node
  connectionStartType.value = type
  
  const startPos = getPortPosition(node, type)
  drawingPath.value = `M ${startPos.x} ${startPos.y} L ${startPos.x} ${startPos.y}`
}

const finishDrawConnection = (event, node, type) => {
  if (!isDrawingConnection.value) return
  
  if (connectionStartNode.value.id !== node.id && connectionStartType.value !== type) {
    const sourceId = connectionStartType.value === 'out' ? connectionStartNode.value.id : node.id
    const targetId = connectionStartType.value === 'in' ? connectionStartNode.value.id : node.id
    
    const exists = connections.value.find(c => c.source === sourceId && c.target === targetId)
    if (!exists) {
      connections.value.push({ source: sourceId, target: targetId })
    }
  }
  
  resetDrawing()
}

const resetDrawing = () => {
  isDrawingConnection.value = false
  connectionStartNode.value = null
  drawingPath.value = ''
}

// Helpers
const getNodeLabel = (type) => {
  const map = {
    'start': '开始', 'end': '结束', 
    'agent-llm': '生成 Agent', 'agent-review': '审核 Agent', 'agent-data': '数据 Agent',
    'condition': '条件判断'
  }
  return map[type] || '新节点'
}

const getNodeIcon = (type) => {
  const map = {
    'start': 'VideoPlay', 'end': 'SwitchButton',
    'agent-llm': 'Cpu', 'agent-review': 'View', 'agent-data': 'DataLine',
    'condition': 'Operation'
  }
  return map[type] || 'Cpu'
}

const getPortPosition = (node, type) => {
  const isStartOrEnd = node.type === 'start-node' || node.type === 'end-node'
  const width = getNodeWidth(node)
  const portYOffset = isStartOrEnd ? 24 : 55 
  
  return {
    x: type === 'in' ? node.x : node.x + width,
    y: node.y + portYOffset
  }
}

const handleKeyDown = (e) => {
  // 已禁用键盘删除节点和连线
}

// Actions
const handleSaveWorkflow = async () => {
  try {
    if (selectedCaseType.value && selectedDifficulty.value) {
      const typeLabel = getWorkflowModeLabel(selectedCaseType.value)
      const difficultyLabelMap = {
        EASY: '初级',
        MEDIUM: '中级',
        HARD: '高级'
      }
      const difficultyLabel = difficultyLabelMap[selectedDifficulty.value] || '中级'
      const defaultName = `${typeLabel}-${difficultyLabel}工作流`
      
      const { value } = await ElMessageBox.prompt('请输入模板名称', '保存工作流模板', {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: defaultName,
        inputPattern: /.+/,
        inputErrorMessage: '模板名称不能为空'
      })
      
      const res = await saveWorkflowForCaseDifficulty(
        selectedCaseType.value,
        selectedDifficulty.value,
        value,
        `${typeLabel}${difficultyLabel}难度工作流配置`,
        {
          nodes: nodes.value,
          connections: connections.value
        }
      )
      
      if (res) {
        ElMessage.success('工作流配置保存成功')
      }
    } else {
      ElMessage.warning('请先选择案例模式和难度')
    }
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Save failed:', e)
      
      // 处理后端返回的校验错误
      if (e.rawResponse && e.rawResponse.data) {
        const data = e.rawResponse.data
        // 如果包含 validation details
        if (data.nodeResults || (data.errors && data.errors.length)) {
          validationResult.value = data
          validationVisible.value = true
          ElMessage.error('工作流验证未通过，请查看详细报告')
          return
        }
      }

      ElMessage.error(e.message || '保存失败')
    }
  }
}

function createEmptyTestRunState() {
  return {
    instanceId: null,
    status: 'IDLE',
    currentNodeId: null,
    currentNodeLabel: '',
    completedSteps: 0,
    totalSteps: 0,
    progressPercentage: 0,
    nodeResults: {},
    finalOutput: {},
    executionTimeMs: 0,
    errorMessage: ''
  }
}

const calculateTestRunFallbackProgress = (snapshot) => {
  const totalSteps = Number(snapshot?.totalSteps || snapshot?.finalOutput?.totalSteps || 0)
  const completedSteps = Number(snapshot?.completedSteps || snapshot?.finalOutput?.completedSteps || 0)
  if (totalSteps > 0) {
    return Math.min(100, Math.round((completedSteps / totalSteps) * 100))
  }
  return snapshot?.status === 'SUCCESS' ? 100 : 0
}

const applyTestRunSnapshot = (snapshot = {}) => {
  const nextState = {
    ...createEmptyTestRunState(),
    ...testRunState.value,
    ...snapshot
  }

  nextState.finalOutput = snapshot?.finalOutput || nextState.finalOutput || {}
  nextState.nodeResults = snapshot?.nodeResults || nextState.nodeResults || {}
  nextState.currentNodeId = snapshot?.currentNodeId ?? nextState.finalOutput?.currentNodeId ?? nextState.currentNodeId
  nextState.currentNodeLabel = snapshot?.currentNodeLabel ?? nextState.finalOutput?.currentNodeLabel ?? nextState.currentNodeLabel
  nextState.totalSteps = Number(snapshot?.totalSteps ?? nextState.finalOutput?.totalSteps ?? nextState.totalSteps ?? 0)
  nextState.completedSteps = Number(snapshot?.completedSteps ?? nextState.finalOutput?.completedSteps ?? nextState.completedSteps ?? 0)
  nextState.progressPercentage = Number(snapshot?.progressPercentage ?? calculateTestRunFallbackProgress(nextState))
  nextState.executionTimeMs = Number(snapshot?.executionTimeMs ?? nextState.executionTimeMs ?? 0)
  nextState.status = snapshot?.status || nextState.status || 'RUNNING'
  nextState.errorMessage = snapshot?.errorMessage || nextState.errorMessage || ''

  testRunState.value = nextState
}

const stopTestRunPolling = () => {
  if (testRunPollTimer) {
    clearInterval(testRunPollTimer)
    testRunPollTimer = null
  }
}

const fetchTestRunStatus = async (instanceId) => {
  if (!instanceId) return
  try {
    const res = await getWorkflowExecutionStatus(instanceId)
    if (res?.code === 200 && res.data) {
      applyTestRunSnapshot(res.data)

      if (['SUCCESS', 'FAILED'].includes(res.data.status)) {
        stopTestRunPolling()
        if (res.data.status === 'SUCCESS') {
          ElMessage.success('测试运行完成')
        } else if (res.data.errorMessage) {
          ElMessage.error(`测试运行失败：${res.data.errorMessage}`)
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch test run status:', error)
    if (testRunState.value.status === 'RUNNING') {
      testRunState.value = {
        ...testRunState.value,
        errorMessage: error.message || '获取测试运行状态失败'
      }
    }
  }
}

const startTestRunPolling = (instanceId) => {
  stopTestRunPolling()
  fetchTestRunStatus(instanceId)
  testRunPollTimer = setInterval(() => {
    fetchTestRunStatus(instanceId)
  }, 1500)
}

watch(testRunVisible, (visible) => {
  if (!visible) {
    stopTestRunPolling()
  }
})

const handleRunTest = async () => {
  if (nodes.value.length === 0) {
    ElMessage.warning('工作流为空，无法运行')
    return
  }

  try {
    const { value } = await ElMessageBox.prompt('请输入测试用的初始输入内容', '测试运行', {
      confirmButtonText: '运行',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValue: '生成一个关于Java Spring Boot的电商项目实训案例'
    })
    stopTestRunPolling()
    testRunInput.value = value
    testRunVisible.value = true
    testRunState.value = {
      ...createEmptyTestRunState(),
      status: 'RUNNING',
      currentNodeLabel: '正在提交测试运行请求...',
      finalOutput: {
        result: '',
        context: {}
      }
    }

    try {
      const res = await testRunWorkflow({
        nodes: nodes.value,
        connections: connections.value
      }, value)

      if (res?.code === 200 && res.data) {
        applyTestRunSnapshot(res.data)

        if (res.data.instanceId) {
          startTestRunPolling(res.data.instanceId)
        } else if (['SUCCESS', 'FAILED'].includes(res.data.status)) {
          stopTestRunPolling()
        }
      } else {
        throw new Error(res?.message || '测试运行失败')
      }
    } catch (e) {
      console.error('Test run error:', e)
      testRunState.value = {
        ...testRunState.value,
        status: 'FAILED',
        errorMessage: e.message || '测试运行请求出错'
      }
      ElMessage.error(e.message || '测试运行请求出错')
    }
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

// AI 助手
const buildExistingNodesInfo = (excludeNodeId = null) => {
  return nodes.value
    .filter((node) => node.type === 'agent-node' && node.id !== excludeNodeId)
    .map((node) => ({
      id: node.id,
      name: node.label || node.id,
      type: node.type,
      agentType: node.agentType || 'Agent'
    }))
}

const buildPromptGenerationTask = (baseTask, node) => {
  const parts = [
    baseTask?.trim(),
    node?.desc ? `节点职责：${node.desc}` : '',
    node?.agentType ? `节点类型：${node.agentType}` : '',
    '请输出一份完整、可直接用于工作流节点的 Prompt。',
    'Prompt 至少包含角色定义、任务目标、输入说明、输出要求、质量标准和约束条件。',
    '不要返回空数组、空对象、占位符或解释说明。'
  ]
  return parts.filter(Boolean).join('\n')
}

const normalizePromptText = (value) => {
  if (value == null) return ''

  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  text = text.trim()
  if (!text) return ''

  text = text
    .replace(/^```[a-zA-Z0-9_-]*\s*/, '')
    .replace(/\s*```$/, '')
    .replace(/^(markdown|md)\s*\n/i, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .trim()

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.length === 0 ? '' : JSON.stringify(parsed, null, 2)
    }
    if (parsed && typeof parsed === 'object') {
      const nestedPrompt = parsed.prompt || parsed.finalPrompt || parsed.data?.prompt
      if (nestedPrompt != null) {
        return normalizePromptText(nestedPrompt)
      }
    }
  } catch (error) {
    // ignore parse failure and keep plain text
  }

  return text
}

const isMeaningfulPrompt = (value) => {
  const prompt = normalizePromptText(value)
  if (!prompt) return false
  const invalidValues = new Set(['[]', '{}', 'null', 'undefined', '""'])
  return !invalidValues.has(prompt) && prompt.length >= 24
}

const extractAiPromptPayload = (response) => {
  const payload = response?.data && typeof response.data === 'object' ? response.data : (response || {})
  const prompt = normalizePromptText(
    payload.prompt ??
    payload.generatedPrompt ??
    payload.finalPrompt ??
    response?.prompt ??
    response?.generatedPrompt
  )
  const suggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions
    : (Array.isArray(response?.suggestions) ? response.suggestions : [])
  const recommendedTemperature = payload.recommendedTemperature ?? response?.recommendedTemperature

  return {
    payload,
    prompt,
    suggestions,
    recommendedTemperature
  }
}

const createPromptResultData = (payload, prompt, suggestions, recommendedTemperature, fallbackMessage = '') => {
  const mergedSuggestions = fallbackMessage
    ? [fallbackMessage, ...suggestions]
    : [...suggestions]

  return {
    ...(payload && typeof payload === 'object' ? payload : {}),
    finalPrompt: prompt,
    prompt,
    suggestions: mergedSuggestions,
    recommendedTemperature,
    usedFallback: Boolean(fallbackMessage)
  }
}

const resolvePromptForNode = (node, extracted) => {
  if (isMeaningfulPrompt(extracted.prompt)) {
    return createPromptResultData(
      extracted.payload,
      extracted.prompt,
      extracted.suggestions,
      extracted.recommendedTemperature
    )
  }

  const fallbackPrompt = normalizePromptText(node?.prompt)
  if (isMeaningfulPrompt(fallbackPrompt)) {
    return createPromptResultData(
      extracted.payload,
      fallbackPrompt,
      extracted.suggestions,
      extracted.recommendedTemperature ?? node?.temperature,
      'AI 未返回有效提示词，已保留当前节点原有提示词。'
    )
  }

  throw new Error('AI 未返回有效提示词')
}

const openAiPromptHelper = (node) => {
  currentEditingNode.value = node
  aiPromptTask.value = `为节点“${node.label}”生成可直接用于工作流设计器的高质量 Prompt`
  aiPromptInput.value = '{{input}}'
  showAiPromptDialog.value = true
}

const handleGeneratePrompt = async ({ task, input, format }) => {
  if (!task.trim()) {
    ElMessage.warning('请描述节点任务')
    return
  }
  
  aiGenerating.value = true
  
  try {
    const targetNode = currentEditingNode.value

    const response = await apiGeneratePromptByAi(
      buildPromptGenerationTask(task, targetNode),
      input,
      format,
      targetNode?.agentType || 'Agent',
      buildExistingNodesInfo(targetNode?.id)
    )
    
    if (response?.success || (response?.code === 200 && response?.data)) {
      const extracted = extractAiPromptPayload(response)
      const resultData = resolvePromptForNode(targetNode, extracted)
      if (currentEditingNode.value) {
        currentEditingNode.value.prompt = resultData.finalPrompt
        if (resultData.recommendedTemperature !== undefined) {
          currentEditingNode.value.temperature = resultData.recommendedTemperature
        }
        ElMessage.success(resultData.usedFallback ? 'AI 结果无效，已保留当前节点原有提示词' : 'Prompt 已生成，可继续修改完善')
        if (resultData.suggestions && resultData.suggestions.length > 0) {
          setTimeout(() => {
            ElMessage.info({
              message: `建议：${resultData.suggestions[0]}`,
              duration: 5000
            })
          }, 500)
        }
        showAiPromptDialog.value = false
        return
      }
    } else {
      throw new Error(response?.message || 'AI生成失败，请重试')
    }
  } catch (error) {
    console.error('AI生成失败:', error)
    ElMessage.error(error?.message || '生成失败，请检查网络连接或稍后重试')
  } finally {
    aiGenerating.value = false
  }
}

const handleAutoFillPrompts = async () => {
  const agentNodes = nodes.value.filter(n => n.type === 'agent-node')
  if (agentNodes.length === 0) {
    ElMessage.warning('画布中暂无 Agent 节点')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `AI 将依次为 ${agentNodes.length} 个 Agent 节点生成 Prompt，每个节点约需 10-30 秒。\n这可能会覆盖已有内容，确定继续吗？`,
      'AI 一键生成提示词',
      {
        confirmButtonText: '开始生成',
        cancelButtonText: '取消',
        type: 'warning',
        icon: 'MagicStick'
      }
    )
    
    // 初始化状态
    batchGenState.total = agentNodes.length
    batchGenState.currentIndex = 0
    batchGenState.successCount = 0
    batchGenState.failCount = 0
    batchGenState.timeElapsed = '0秒'
    batchGenState.isComplete = false
    batchGenState.currentNodeName = '准备中...'
    batchGenState.currentResult = null
    batchGenState.results = []
    batchGenState.history = agentNodes.map(n => ({
      id: n.id,
      name: n.label,
      status: 'pending', // pending, generating, success, fail
      result: null
    }))
    
    isBatchGenCancelled.value = false
    batchGenVisible.value = true
    
    const startTime = Date.now()
    let failedNodes = []
    let timer = null

    // 计时器
    timer = setInterval(() => {
      if (isBatchGenCancelled.value || batchGenState.isComplete) {
         clearInterval(timer)
         return
      }
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      const minutes = Math.floor(elapsed / 60)
      const seconds = elapsed % 60
      batchGenState.timeElapsed = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`
    }, 1000)
    
    // 串行生成
    for (const node of agentNodes) {
      if (isBatchGenCancelled.value) {
         console.log('Batch generation cancelled by user')
         break
      }

      batchGenState.currentIndex++
      batchGenState.currentNodeName = node.label
      batchGenState.currentAgentId = node.id
      
      // 更新历史状态为进行中
      const historyItem = batchGenState.history.find(h => h.id === node.id)
      if (historyItem) historyItem.status = 'generating'
      
      const task = buildPromptGenerationTask(
        `请为节点“${node.label}”生成工作流 Prompt。`,
        node
      )
      
      try {
        const prevNodes = connections.value
          .filter(c => c.target === node.id)
          .map(c => nodes.value.find(n => n.id === c.source))
          .filter(Boolean)
          
        const inputContext = prevNodes.length > 0 
          ? prevNodes.map(n => `{{node_${n.id}_output}}`).join(', ') 
          : '{{input}}'
          
        const response = await apiGeneratePromptByAi(
          task,
          inputContext,
          'markdown',
          node.agentType || 'Agent',
          buildExistingNodesInfo(node.id)
        )
        
        if (response.success || (response.code === 200 && response.data)) {
          const extracted = extractAiPromptPayload(response)
          const resultData = resolvePromptForNode(node, extracted)
          batchGenState.currentResult = resultData

          node.prompt = resultData.finalPrompt
          if (resultData.recommendedTemperature !== undefined) {
            node.temperature = resultData.recommendedTemperature
          }

          batchGenState.successCount++

          if (historyItem) {
            historyItem.status = 'success'
            historyItem.result = resultData
          }

          batchGenState.results.push({
            nodeName: node.label,
            status: 'success',
            prompt: resultData.finalPrompt,
            temperature: resultData.recommendedTemperature,
            suggestions: resultData.suggestions,
            usedFallback: resultData.usedFallback
          })
        } else {
          throw new Error(response.message || 'API返回失败')
        }
      } catch (e) {
        console.error(`Failed to generate prompt for node ${node.id}`, e)
        batchGenState.failCount++
        failedNodes.push(node.label)
        
        if (historyItem) {
           historyItem.status = 'fail'
           historyItem.error = e.message || '生成失败'
           historyItem.result = createPromptResultData(
             {},
             normalizePromptText(node.prompt),
             [],
             node.temperature,
             'AI 未能生成有效结果，当前展示的是该节点原有提示词。'
           )
        }

        // 记录失败到结果列表
        batchGenState.results.push({
          nodeName: node.label,
          status: 'fail',
          error: e.message || '生成失败',
          prompt: normalizePromptText(node.prompt),
          suggestions: []
        })
      }
    }
    
    // 监听弹窗关闭，触发取消
    const stopWatch = watch(batchGenVisible, (val) => {
      if (!val && !batchGenState.isComplete) {
         isBatchGenCancelled.value = true
      }
    })

    clearInterval(timer)
    if (stopWatch) stopWatch() // 清理监听

    batchGenState.isComplete = true
    batchGenState.currentNodeName = '全部完成'
    
    // 延迟关闭
    setTimeout(() => {
      if (batchGenState.successCount > 0) {
        const msg = failedNodes.length > 0
          ? `生成完成：成功 ${batchGenState.successCount} 个，失败 ${batchGenState.failCount} 个`
          : `成功为 ${batchGenState.successCount} 个 Agent 生成了 Prompt`
        ElMessage.success(msg)
      } else {
        ElMessage.warning('未能生成 Prompt，请稍后重试')
      }
      // batchGenVisible.value = false // 可以选择手动关闭或自动关闭
    }, 1000)
    
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const handleRestoreDefault = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要恢复默认工作流设置吗？当前未保存的更改将丢失。',
      '恢复默认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    loadDefault()
    ElMessage.success('已恢复默认设置')
    nextTick(() => fitView())
  } catch (e) {
    // Cancelled
  }
}
</script>

<style scoped lang="scss">
.workflow-designer {
  height: 125vh;
  width: 125vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1e293b;
  font-size: 17px;
  
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2000;
  background: #ffffff;

  :deep(.el-button),
  :deep(.el-input__inner),
  :deep(.el-select__placeholder),
  :deep(.el-form-item__label),
  :deep(.el-tag),
  :deep(.el-dialog__title) {
    font-size: 17px;
  }

  .designer-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .resize-handle {
    width: 4px;
    background: transparent;
    cursor: col-resize;
    position: relative;
    z-index: 20;
    transition: background 0.2s;
    flex-shrink: 0;

    &:hover, &.active {
      background: #2563eb;
    }
  }
}
</style>
