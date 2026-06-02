<template>
  <div class="properties-panel" :style="{ width: width + 'px' }">
    <div class="panel-header-sticky">
      <div class="header-content">
        <el-icon class="header-icon"><Setting /></el-icon>
        <span>属性配置</span>
      </div>
    </div>
    
    <div class="scroll-container custom-scrollbar">
      <transition name="slide-fade" mode="out-in">
        <div v-if="selectedNode" :key="selectedNode.id" class="node-config-wrapper">
          <el-form label-position="top" size="small" class="config-form">
            
            <!-- Card 1: Basic Info -->
            <div class="config-card">
              <div class="card-header">
                <span class="title">基础信息</span>
              </div>
              <div class="card-body">
                <el-row :gutter="10">
                  <el-col :span="14">
                    <el-form-item label="节点名称" class="compact-form-item">
                      <el-input v-model="localSelectedNode.label" placeholder="输入节点名称" @input="updateNode" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="10">
                    <el-form-item label="节点类型" class="compact-form-item">
                      <el-tag effect="light" type="primary" class="type-tag">{{ localSelectedNode.type }}</el-tag>
                    </el-form-item>
                  </el-col>
                </el-row>
              </div>
            </div>
            
            <!-- Agent Specific Config -->
            <template v-if="localSelectedNode.type === 'agent-node'">
              <!-- Card 2: Model Selection -->
              <div class="config-card">
                <div class="card-header">
                  <span class="title">模型配置</span>
                </div>
                <div class="card-body">
                  <el-form-item label="AI 模型选择" class="mb-0 compact-form-item">
                    <el-select v-model="localSelectedNode.meta" placeholder="请选择模型" @change="updateNode" class="w-full" clearable>
                      <el-option value="DeepSeek V4 Flash" label="V4 Flash">
                        <div class="option-item">
                          <span class="font-medium">V4 Flash</span>
                          <span class="tag-speed">Fast</span>
                        </div>
                      </el-option>
                      <el-option value="DeepSeek V4 Pro" label="V4 Pro">
                        <div class="option-item">
                          <span class="font-medium">V4 Pro</span>
                          <span class="tag-brain">Pro</span>
                        </div>
                      </el-option>
                    </el-select>
                    <div class="model-hint" v-if="localSelectedNode.meta">
                      <el-icon><InfoFilled /></el-icon>
                      <span v-if="isFlashModel(localSelectedNode.meta)">响应速度快，适用于常规生成与校验任务</span>
                      <span v-else>推理能力强，适用于复杂逻辑分析与综合评审任务</span>
                    </div>
                  </el-form-item>
                </div>
              </div>

              <!-- Card 3: Prompt Engineering -->
              <div class="config-card prompt-card">
                <div class="card-header flex-between">
                  <span class="title">Prompt 编排</span>
                  <div class="header-actions">
                    <el-tooltip content="恢复默认 Prompt" placement="top" :teleported="false">
                      <el-button size="small" circle text @click="confirmReset">
                        <el-icon><RefreshLeft /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="查看编写指南" placement="top" :teleported="false">
                      <el-button size="small" circle text @click="$emit('showPromptGuide')">
                        <el-icon><QuestionFilled /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>
                
                <div class="card-body p-0">
                  <!-- Natural Language Input -->
                  <div class="prompt-section natural">
                    <div class="section-label">
                      <el-icon><EditPen /></el-icon> 教师自然语言描述
                    </div>
                    <el-input
                      v-model="naturalLanguagePrompt"
                      type="textarea"
                      :rows="3"
                      resize="none"
                      class="custom-textarea"
                      placeholder="请描述该节点需要完成的任务..."
                    />
                  </div>

                  <!-- Conversion Action -->
                  <div class="action-divider">
                    <el-button
                      type="primary"
                      class="convert-btn"
                      :loading="isOptimizing"
                      :disabled="!naturalLanguagePrompt?.trim()"
                      @click="handleConvertPrompt"
                      size="small"
                      round
                    >
                      <el-icon v-if="!isOptimizing" class="mr-1"><MagicStick /></el-icon>
                      {{ isOptimizing ? 'AI 智能转换中...' : '生成结构化 Prompt' }}
                    </el-button>
                  </div>

                  <!-- Structured Prompt (ReadOnly) -->
                  <div class="prompt-section structured">
                    <div class="section-label">
                      <div class="flex-center">
                        <el-icon><Cpu /></el-icon> 结构化 Prompt
                      </div>
                      <el-tag size="small" type="success" effect="dark" v-if="localSelectedNode.prompt">已就绪</el-tag>
                      <el-tag size="small" type="info" v-else>待生成</el-tag>
                    </div>
                    <div class="editor-wrapper">
                      <el-input
                        v-model="localSelectedNode.prompt"
                        type="textarea"
                        :rows="6"
                        resize="none"
                        readonly
                        class="code-editor"
                        placeholder="点击上方按钮生成标准化 Prompt..."
                      />
                    </div>
                    <div class="section-footer">
                      <el-icon><InfoFilled /></el-icon> 系统将使用此 Prompt 执行任务
                    </div>
                  </div>
                  
                  <!-- Validator Component -->
                  <div class="validator-wrapper">
                    <PromptValidator
                      :prompt="localSelectedNode.prompt || ''"
                      :agent-type="localSelectedNode.agentType || ''"
                    />
                  </div>
                </div>
              </div>
            </template>

            <!-- Fallback for other node types -->
            <div class="config-card" v-else>
              <div class="card-header">
                <span class="title">其他配置</span>
              </div>
              <div class="card-body">
                <el-form-item label="备注信息" class="compact-form-item">
                  <el-input v-model="localSelectedNode.meta" type="textarea" :rows="3" placeholder="添加备注..." @input="updateNode" />
                </el-form-item>
              </div>
            </div>

          </el-form>
        </div>
        
        <!-- Empty State -->
        <div v-else class="empty-state-wrapper" key="empty">
          <div class="empty-content">
            <div class="illustration-box">
              <el-icon><Pointer /></el-icon>
              <div class="pulse-ring"></div>
            </div>
            <h3>未选择节点</h3>
            <p>请点击画布中的节点进行配置</p>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { 
  Setting, EditPen, MagicStick, Cpu, RefreshLeft, QuestionFilled, 
  InfoFilled, Pointer 
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PromptValidator from './PromptValidator.vue'
import { optimizePrompt } from '@/api/training/ai'

const props = defineProps({
  width: {
    type: Number,
    default: 340
  },
  selectedNode: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'update:selectedNode', 
  'showPromptGuide'
])

const localSelectedNode = computed({
  get: () => props.selectedNode,
  set: (val) => emit('update:selectedNode', val)
})

const isOptimizing = ref(false)
const naturalLanguagePrompt = ref('')

const normalizeModelMeta = (value) => {
  if (!value) return value
  if (value === 'DeepSeek Chat' || value === 'deepseek-chat' || value === 'deepseek-v4-flash') {
    return 'DeepSeek V4 Flash'
  }
  if (value === 'DeepSeek Reasoner' || value === 'deepseek-reasoner' || value === 'deepseek-v4-pro') {
    return 'DeepSeek V4 Pro'
  }
  return value
}

const isFlashModel = (value) => normalizeModelMeta(value) === 'DeepSeek V4 Flash'

watch(
  () => props.selectedNode,
  (node) => {
    if (!node || node.type !== 'agent-node') return
    const normalizedMeta = normalizeModelMeta(node.meta)
    if (normalizedMeta && normalizedMeta !== node.meta) {
      node.meta = normalizedMeta
    }
  },
  { immediate: true }
)

const updateNode = () => {
  const node = localSelectedNode.value
  if (node?.type === 'agent-node') {
    node.meta = normalizeModelMeta(node.meta)
  }
}

const handleConvertPrompt = async () => {
  const node = localSelectedNode.value
  if (!node) return
  
  const agentType = node.agentType
  const userInput = naturalLanguagePrompt.value
  
  if (!agentType) {
    ElMessage.warning('无法确定当前节点的Agent类型')
    return
  }
  
  if (!userInput || !userInput.trim()) {
    ElMessage.warning('请先输入您的需求描述')
    return
  }
  
  isOptimizing.value = true
  
  try {
    const res = await optimizePrompt(agentType, userInput)
    
    if (res.data && res.data.optimizedPrompt) {
      localSelectedNode.value.prompt = res.data.optimizedPrompt
      ElMessage.success('Prompt 转换成功')
    } else {
      ElMessage.error('转换未返回有效结果')
    }
  } catch (err) {
    console.error('Prompt转换失败:', err)
    ElMessage.error('转换服务暂时不可用')
  } finally {
    isOptimizing.value = false
  }
}

const defaultPrompts = {
  'GenerationAgent': `## 角色设定\n你是一个实训案例生成专家。\n\n## 任务目标\n根据关键词和需求生成高质量的实训案例。\n\n## 输入数据\n关键词：{{keywords}}\n需求描述：{{input}}\n\n## 生成内容\n1. 案例名称\n2. 案例背景\n3. 实训任务\n4. 数据库要求\n\n以 JSON 格式输出。`,
  'StructuringAgent': `## 角色设定\n你是一个数据规范专家。\n\n## 任务目标\n将案例草案规范到 Schema 结构。\n\n## 输入数据\n{{node_generation_output}}\n\n返回标准 JSON。`,
  'ValidationAgent': `## 角色设定\n你是一个质量审查专家。\n\n## 任务目标\n对案例进行质量校验。\n\n## 输入数据\n{{node_structuring_output}}\n\n返回 JSON 校验报告。`,
  'DataGenerationAgent': `## 角色设定\n你是一个数据库专家。\n\n## 任务目标\n生成模拟数据。\n\n## 输入数据\n{{node_structuring_output}}\n\n返回 SQL INSERT 语句。`,
  'ReviewAgent': `## 角色设定\n你是一个教学专家。\n\n## 任务目标\n评估案例教学价值。\n\n## 输入数据\n{{input}}\n\n返回 JSON 评审报告。`
}

const confirmReset = () => {
  ElMessageBox.confirm(
    '确定要恢复默认 Prompt 吗？当前编辑的内容将丢失。',
    '恢复默认',
    {
      confirmButtonText: '确定恢复',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    resetToDefault()
  }).catch(() => {})
}

const resetToDefault = () => {
  const agentType = localSelectedNode.value?.agentType
  if (!agentType) return
  
  const defaultPrompt = defaultPrompts[agentType]
  if (defaultPrompt) {
    naturalLanguagePrompt.value = ''
    localSelectedNode.value.prompt = defaultPrompt
    ElMessage.success('已恢复默认配置')
  }
}
</script>

<style scoped lang="scss">
// Theme Palette - Fresh Blue/Slate
$primary: #0ea5e9;
$primary-light: #e0f2fe;
$slate-900: #0f172a;
$slate-700: #334155;
$slate-500: #64748b;
$slate-200: #e2e8f0;
$slate-50: #f8fafc;
$white: #ffffff;
$success: #10b981;

.properties-panel {
  height: 100%;
  background: $slate-50;
  border-left: 1px solid $slate-200;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.03);
  position: relative;
  z-index: 20;
  font-size: 17px;

  :deep(.el-button),
  :deep(.el-input__inner),
  :deep(.el-textarea__inner),
  :deep(.el-select__placeholder),
  :deep(.el-form-item__label),
  :deep(.el-tag) {
    font-size: 16px;
  }

  .panel-header-sticky {
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid $slate-200;
    flex-shrink: 0;

    .header-content {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 700;
      color: $slate-900;
      letter-spacing: 0.5px;
      
      .header-icon {
        font-size: 16px;
        color: $primary;
      }
    }
  }

  .scroll-container {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .node-config-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .config-card {
    background: $white;
    border-radius: 10px;
    border: 1px solid $slate-200;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    overflow: hidden;
    transition: all 0.2s ease;

    &:hover {
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.03);
      border-color: #cbd5e1;
    }

    .card-header {
      padding: 8px 12px;
      background: $white;
      border-bottom: 1px solid $slate-50;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .title {
        font-size: 14px;
        font-weight: 700;
        color: $slate-700;
        position: relative;
        padding-left: 8px;
        
        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 10px;
          background: $primary;
          border-radius: 2px;
        }
      }
    }

    .card-body {
      padding: 12px;
      
      &.p-0 { padding: 0; }
    }
  }
  
  .compact-form-item {
    margin-bottom: 0;
    
    :deep(.el-form-item__label) {
      margin-bottom: 4px;
      font-size: 14px;
      line-height: 1.2;
    }
  }

  .type-tag {
    width: 100%;
    text-align: center;
    font-weight: 600;
    letter-spacing: 0.5px;
    height: 28px;
    line-height: 26px;
  }

  .option-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    
    .tag-speed { font-size: 12px; background: #e0f2fe; color: $primary; padding: 1px 5px; border-radius: 4px; }
    .tag-brain { font-size: 12px; background: #e0f2fe; color: #0ea5e9; padding: 1px 5px; border-radius: 4px; } 
  }

  .model-hint {
    margin-top: 6px;
    font-size: 13px;
    color: $slate-500;
    display: flex;
    align-items: flex-start;
    gap: 4px;
    line-height: 1.3;
    padding: 6px;
    background: $slate-50;
    border-radius: 4px;
  }

  /* Prompt Card Styling */
  .prompt-card {
    .prompt-section {
      padding: 12px;

      .section-label {
        font-size: 13px;
        font-weight: 600;
        color: $slate-500;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;

        .flex-center { display: flex; align-items: center; gap: 4px; }
      }

      &.natural {
        background: #ffffff;
      }

      &.structured {
        background: #f8fafc;
        border-top: 1px solid $slate-200;

        .section-footer {
          margin-top: 6px;
          font-size: 12px;
          color: $success;
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }
    }

    .custom-textarea {
      :deep(.el-textarea__inner) {
        box-shadow: none;
        background: $slate-50;
        border: 1px solid $slate-200;
        padding: 8px;
        font-size: 14px;
        transition: all 0.2s;

        &:focus {
          background: #fff;
          border-color: $primary;
          box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.1);
        }
      }
    }

    .code-editor {
      :deep(.el-textarea__inner) {
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        line-height: 1.5;
        background: #f1f5f9;
        color: $slate-700;
        border: 1px solid $slate-200;
        padding: 8px;
        
        &:focus { border-color: $slate-200; box-shadow: none; }
      }
    }

    .action-divider {
      position: relative;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: $slate-50;
      border-top: 1px dashed $slate-200;

      .convert-btn {
        position: relative;
        z-index: 2;
        padding: 6px 16px;
        font-size: 14px;
        box-shadow: 0 2px 6px rgba(14, 165, 233, 0.2);
        transition: all 0.2s;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(14, 165, 233, 0.3);
        }
        
        &:active { transform: translateY(0); }
      }
    }
    
    .validator-wrapper {
      padding: 0 12px 12px;
      background: #f8fafc;
    }
  }

  /* Empty State */
  .empty-state-wrapper {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .empty-content {
      text-align: center;
      
      .illustration-box {
        width: 64px;
        height: 64px;
        background: #f0f9ff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        position: relative;
        color: $primary;
        font-size: 28px;
        
        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid $primary;
          opacity: 0;
          animation: pulse-ring 2s infinite;
        }
      }
      
      h3 { font-size: 18px; font-weight: 700; color: $slate-900; margin-bottom: 6px; }
      p { font-size: 14px; color: $slate-500; }
    }
  }
}

/* Animations */
@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(1.5); opacity: 0; }
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }

.flex-between { display: flex; justify-content: space-between; align-items: center; }
.w-full { width: 100%; }
.mb-0 { margin-bottom: 0 !important; }
.mr-1 { margin-right: 4px; }
.font-medium { font-weight: 500; }
</style>
