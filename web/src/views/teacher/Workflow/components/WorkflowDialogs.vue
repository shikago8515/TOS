<template>
  <div class="workflow-dialogs-container">
    <!-- AI 生成 Prompt 对话框 -->
    <el-dialog
      :model-value="aiPromptVisible"
      @update:model-value="$emit('update:aiPromptVisible', $event)"
      title="AI 智能 Prompt 助手"
      width="500px"
      :teleported="false"
      align-center
      class="modern-dialog ai-prompt-dialog"
    >
      <div class="ai-prompt-content">
        <div class="input-group">
          <label>任务描述</label>
          <el-input 
            v-model="localTask" 
            type="textarea" 
            :rows="3" 
            placeholder="例如：为这个节点生成一个角色设定，要求严谨专业..."
          />
        </div>
        <div class="input-group">
          <label>输入数据上下文 (可选)</label>
          <el-input 
            v-model="localInput" 
            placeholder="例如：{{input}} 或 {{node_n1_output}}"
          />
        </div>
        <div class="input-group">
          <label>输出格式</label>
          <el-radio-group v-model="localFormat">
            <el-radio label="json">JSON</el-radio>
            <el-radio label="markdown">Markdown</el-radio>
            <el-radio label="text">纯文本</el-radio>
          </el-radio-group>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="$emit('update:aiPromptVisible', false)">取消</el-button>
          <el-button type="primary" :loading="aiGenerating" @click="handleGenerate">
            {{ aiGenerating ? '生成中...' : '开始生成' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Prompt 编写指南对话框 -->
    <el-dialog
      :model-value="guideVisible"
      @update:model-value="$emit('update:guideVisible', $event)"
      title="Agent Prompt 编写指南"
      width="800px"
      :teleported="false"
      align-center
      class="modern-dialog guide-dialog"
    >
      <div class="guide-layout">
        <div class="guide-sidebar">
          <div 
            v-for="guide in agentGuides" 
            :key="guide.id"
            class="guide-menu-item"
            :class="{ active: activeGuideId === guide.id }"
            @click="activeGuideId = guide.id"
          >
            <el-icon><component :is="guide.icon" /></el-icon>
            <span>{{ guide.name }}</span>
          </div>
        </div>
        <div class="guide-content custom-scrollbar">
          <div class="guide-header">
            <h3>{{ activeGuide.name }}</h3>
            <p>{{ activeGuide.desc }}</p>
          </div>
          <div class="guide-example">
            <div class="example-label">Prompt 示例：</div>
            <pre class="example-code">{{ activeGuide.example }}</pre>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 校验结果对话框 -->
    <el-dialog
      :model-value="validationVisible"
      @update:model-value="$emit('update:validationVisible', $event)"
      title="工作流智能校验报告"
      width="640px"
      :teleported="false"
      align-center
      class="modern-dialog validation-dialog"
      :show-close="false"
    >
      <template #header="{ close, titleId, titleClass }">
        <div class="dialog-header">
          <div class="header-left">
            <el-icon class="header-icon error" v-if="!validationResult?.valid"><WarningFilled /></el-icon>
            <el-icon class="header-icon success" v-else><CircleCheckFilled /></el-icon>
            <span :id="titleId" :class="titleClass">工作流校验报告</span>
          </div>
          <el-button circle text @click="close">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </template>

      <div v-if="validationResult" class="validation-content custom-scrollbar">
         <!-- 概览卡片 -->
         <div class="summary-card" :class="{ 'is-error': !validationResult.valid }">
            <div class="score-section">
               <div class="score-ring">
                  <span class="score-value">{{ validationResult.score || 0 }}</span>
                  <span class="score-label">分</span>
               </div>
            </div>
            <div class="info-section">
               <h3 class="status-title">{{ validationResult.valid ? '校验通过' : '存在待修复问题' }}</h3>
               <p class="status-desc">
                 检测到 {{ validationResult.errors?.length || 0 }} 个阻断性错误，
                 {{ Object.keys(validationResult.nodeResults || {}).filter(k => !validationResult.nodeResults[k].valid).length }} 个节点需要关注
               </p>
            </div>
         </div>

         <div class="issue-list">
            <!-- 全局错误 -->
            <transition-group name="list" tag="div">
              <div v-if="validationResult.errors?.length" class="issue-group global-errors" key="global-errors">
                 <div class="group-header">
                   <el-icon class="icon"><CircleCloseFilled /></el-icon>
                   <span>全局阻断性错误</span>
                 </div>
                 <div class="group-body">
                    <div v-for="(err, i) in validationResult.errors" :key="'g-err-'+i" class="issue-item error">
                      <div class="dot"></div>
                      <span>{{ err }}</span>
                    </div>
                 </div>
              </div>

              <!-- 全局警告 -->
              <div v-if="validationResult.warnings?.length" class="issue-group global-warnings" key="global-warnings">
                 <div class="group-header">
                   <el-icon class="icon"><WarningFilled /></el-icon>
                   <span>优化建议</span>
                 </div>
                 <div class="group-body">
                    <div v-for="(warn, i) in validationResult.warnings" :key="'g-warn-'+i" class="issue-item warning">
                      <div class="dot"></div>
                      <span>{{ warn }}</span>
                    </div>
                 </div>
              </div>

              <!-- 节点问题 -->
              <template v-if="validationResult.nodeResults">
                 <div 
                   v-for="(res, nodeId) in validationResult.nodeResults" 
                   :key="nodeId" 
                   class="issue-group node-issues"
                   v-show="!res.valid || (res.warnings && res.warnings.length)"
                 >
                    <div class="group-header node-header">
                      <div class="node-badge">
                        <el-icon><LocationInformation /></el-icon> 
                        <span>{{ getNodeName(nodeId) }}</span>
                      </div>
                      <el-tag v-if="!res.valid" type="danger" size="small" effect="dark" round>错误</el-tag>
                      <el-tag v-else type="warning" size="small" effect="light" round>建议</el-tag>
                    </div>
                    
                    <div class="group-body">
                      <div v-for="(err, i) in res.errors" :key="nodeId+'-err-'+i" class="issue-item error">
                         <div class="dot"></div>
                         <span>{{ err }}</span>
                      </div>
                      <div v-for="(warn, i) in res.warnings" :key="nodeId+'-warn-'+i" class="issue-item warning">
                         <div class="dot"></div>
                         <span>{{ warn }}</span>
                      </div>
                    </div>
                 </div>
              </template>
            </transition-group>
         </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="$emit('update:validationVisible', false)" class="close-btn">关闭报告</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 批量生成进度对话框 (旗舰版重构) -->
    <BatchGenDialog 
      :visible="batchGenVisible"
      @update:visible="$emit('update:batchGenVisible', $event)"
      :batchGenState="batchGenState"
    />
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { 
  Close, WarningFilled, CircleCheckFilled, CircleCloseFilled, LocationInformation,
  Search, EditPen, Collection, List, CircleCheck, DataLine
} from '@element-plus/icons-vue'
import BatchGenDialog from './BatchGenDialog.vue'

const props = defineProps({
  aiPromptVisible: Boolean,
  guideVisible: Boolean,
  validationVisible: Boolean,
  batchGenVisible: Boolean,
  validationResult: Object,
  batchGenState: Object,
  nodes: Array,
  aiGenerating: Boolean,
  initialTask: String,
  initialInput: String
})

const emit = defineEmits([
  'update:aiPromptVisible', 
  'update:guideVisible', 
  'update:validationVisible',
  'update:batchGenVisible',
  'generate'
])

// 获取节点名称
const getNodeName = (nodeId) => {
  if (!props.nodes) return nodeId
  const node = props.nodes.find(n => n.id === nodeId)
  return node ? (node.label || node.id) : nodeId
}

// AI Prompt Dialog State
const localTask = ref('')
const localInput = ref('')
const localFormat = ref('json')

// Watch for prop changes to update local state when dialog opens
watch(() => props.aiPromptVisible, (val) => {
  if (val) {
    localTask.value = props.initialTask || ''
    localInput.value = props.initialInput || '{{input}}'
    localFormat.value = 'json'
  }
})

const handleGenerate = () => {
  emit('generate', {
    task: localTask.value,
    input: localInput.value,
    format: localFormat.value
  })
}

// Guide Dialog State
const activeGuideId = ref('generation')

const agentGuides = [
  {
    id: 'generation',
    name: '案例生成 Agent',
    icon: EditPen,
    desc: '根据关键词和需求生成案例草案',
    example: `## 角色设定
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
请以结构化的 JSON 格式输出完整案例。`
  },
  {
    id: 'structuring',
    name: '结构化规范 Agent',
    icon: Collection,
    desc: '将草案规范为标准JSON结构',
    example: `## 角色设定
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
请返回符合系统 Schema 的标准 JSON 格式。`
  },
  {
    id: 'validation',
    name: '质量校验 Agent',
    icon: List,
    desc: '校验逻辑一致性和完整性',
    example: `## 角色设定
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
请返回 JSON 格式的校验报告，包含问题列表和质量评分（0-100）。`
  },
  {
    id: 'data',
    name: '数据生成 Agent',
    icon: DataLine,
    desc: '生成数据库模拟数据',
    example: `## 角色设定
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
请返回 SQL INSERT 语句或 JSON 格式的测试数据。`
  },
  {
    id: 'review',
    name: '教学审核 Agent',
    icon: CircleCheck,
    desc: '教学匹配度评估和质量评分',
    example: `## 角色设定
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
请返回 JSON 格式的评审报告，包含教学匹配度评分（0-100）、知识点覆盖清单和改进建议。`
  }
]

const activeGuide = computed(() => {
  return agentGuides.find(g => g.id === activeGuideId.value) || agentGuides[0]
})
</script>

<style scoped lang="scss">
/* 
  Design System Variables 
  Theme: Modern Blue/Slate (No Purple)
*/
$primary: #0ea5e9; /* Sky 500 */
$success: #10b981; /* Emerald 500 */
$warning: #f59e0b; /* Amber 500 */
$danger: #ef4444; /* Red 500 */
$text-main: #0f172a; /* Slate 900 */
$text-secondary: #475569; /* Slate 600 */
$bg-body: #f8fafc; /* Slate 50 */
$border: #e2e8f0; /* Slate 200 */
$radius-lg: 16px;
$radius-md: 12px;
$shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* Common Utils */
.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
    &:hover { background: #94a3b8; }
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

/* Modern Dialog Base Styles */
.modern-dialog {
  :deep(.el-dialog__header) {
    padding: 0;
    margin: 0;
  }
  :deep(.el-dialog__body) {
    padding: 0;
  }
  :deep(.el-dialog__footer) {
    padding: 0;
    margin: 0;
  }
  
  border-radius: $radius-lg;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid $border;
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .header-icon {
      font-size: 24px;
      &.success { color: $success; }
      &.error { color: $danger; }
    }
    
    span {
      font-size: 16px;
      font-weight: 600;
      color: $text-main;
    }
  }
}

.dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid $border;
  background: #fff;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* AI Prompt Dialog Styles */
.ai-prompt-dialog {
  .ai-prompt-content {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    
    .input-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      
      label {
        font-size: 14px;
        font-weight: 600;
        color: $text-main;
      }
    }
  }
}

/* Guide Dialog Styles */
.guide-dialog {
  .guide-layout {
    display: flex;
    height: 500px;
    
    .guide-sidebar {
      width: 200px;
      background: #f8fafc;
      border-right: 1px solid $border;
      padding: 12px 0;
      
      .guide-menu-item {
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        color: $text-secondary;
        transition: all 0.2s;
        font-size: 14px;
        border-left: 3px solid transparent;
        
        &:hover {
          background: #e0f2fe;
          color: $primary;
        }
        
        &.active {
          background: #e0f2fe;
          color: $primary;
          border-left-color: $primary;
          font-weight: 600;
        }
        
        .el-icon { font-size: 16px; }
      }
    }
    
    .guide-content {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      
      .guide-header {
        margin-bottom: 20px;
        h3 { margin: 0 0 8px; font-size: 18px; color: $text-main; }
        p { margin: 0; color: $text-secondary; font-size: 14px; }
      }
      
      .guide-example {
        background: #1e293b;
        border-radius: 8px;
        padding: 16px;
        color: #e2e8f0;
        
        .example-label {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        
        .example-code {
          margin: 0;
          font-family: 'JetBrains Mono', monospace;
          white-space: pre-wrap;
          font-size: 13px;
          line-height: 1.6;
        }
      }
    }
  }
}

/* Validation Dialog Styles */
.validation-content {
  padding: 24px;
  max-height: 60vh;
  overflow-y: auto;
  background: $bg-body;
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  .summary-card {
    background: #fff;
    border-radius: $radius-md;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 24px;
    box-shadow: $shadow-sm;
    border: 1px solid $border;
    
    &.is-error {
      border-left: 4px solid $danger;
      .score-ring { border-color: $danger; color: $danger; }
      .status-title { color: $danger; }
    }
    
    &:not(.is-error) {
      border-left: 4px solid $success;
      .score-ring { border-color: $success; color: $success; }
      .status-title { color: $success; }
    }
    
    .score-ring {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 6px solid;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #fff;
      
      .score-value { font-size: 28px; font-weight: 800; line-height: 1; }
      .score-label { font-size: 12px; font-weight: 500; margin-top: 2px; opacity: 0.8; }
    }
    
    .info-section {
      flex: 1;
      .status-title { margin: 0 0 8px; font-size: 18px; font-weight: 700; }
      .status-desc { margin: 0; color: $text-secondary; font-size: 14px; line-height: 1.5; }
    }
  }
  
  .issue-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    
    .issue-group {
      background: #fff;
      border-radius: $radius-md;
      border: 1px solid $border;
      overflow: hidden;
      box-shadow: $shadow-sm;
      
      .group-header {
        padding: 12px 16px;
        background: $bg-body;
        border-bottom: 1px solid $border;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 14px;
        color: $text-main;
        
        .icon { font-size: 16px; }
        
        &.node-header {
          justify-content: space-between;
          
          .node-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            color: $text-secondary;
          }
        }
      }
      
      &.global-errors .group-header { color: $danger; .icon { color: $danger; } background: #fef2f2; }
      &.global-warnings .group-header { color: $warning; .icon { color: $warning; } background: #fffbeb; }
      
      .group-body {
        padding: 12px 16px;
        
        .issue-item {
          display: flex;
          gap: 10px;
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 8px;
          &:last-child { margin-bottom: 0; }
          
          .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            margin-top: 8px;
            flex-shrink: 0;
          }
          
          &.error { color: $text-secondary; .dot { background: $danger; } }
          &.warning { color: $text-secondary; .dot { background: $warning; } }
        }
      }
    }
  }
}

/* Transitions */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
.list-leave-active {
  position: absolute;
}
</style>