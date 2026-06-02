<template>
  <div class="toolbox" :style="{ width: width + 'px' }">
    <div class="section-title">AI 生成流程</div>
    
    <!-- 流程说明 -->
    <div class="flow-intro">
      <p>案例通过 <strong>5 个 AI 步骤</strong>自动生成，点击步骤可编辑其 Prompt 和模型配置。</p>
    </div>

    <!-- 固定的5步流程 -->
    <div class="step-list">
      <div 
        v-for="(step, index) in flowSteps" 
        :key="step.key"
        class="step-item"
        :class="{ active: activeStepKey === step.key }"
        @click="$emit('selectStep', step.key)"
      >
        <div class="step-number">{{ index + 1 }}</div>
        <div class="step-info">
          <div class="step-name">
            <el-icon><component :is="step.icon" /></el-icon>
            {{ step.label }}
          </div>
          <div class="step-desc">{{ step.desc }}</div>
        </div>
        <!-- 步骤间的连线 -->
        <div v-if="index < flowSteps.length - 1" class="step-connector"></div>
      </div>
    </div>

    <!-- 使用提示 -->
    <div class="usage-tip">
      <el-icon><InfoFilled /></el-icon>
      <span>点击步骤 → 右侧面板调整 Prompt 和模型</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { 
  EditPen, Collection, List, DataLine, CircleCheck, InfoFilled
} from '@element-plus/icons-vue'

const props = defineProps({
  width: Number,
  agentDefinitions: Object,
  nodes: Array,
  activeStepKey: String // 当前选中的步骤key
})

defineEmits(['selectStep'])

// 固定的5步流程定义
const flowSteps = computed(() => {
  const defs = props.agentDefinitions || {}
  const agentNodes = Array.isArray(props.nodes)
    ? props.nodes
        .filter(node => node?.type === 'agent-node')
        .slice()
        .sort((first, second) => {
          const firstX = Number(first?.x || 0)
          const secondX = Number(second?.x || 0)
          if (firstX !== secondX) {
            return firstX - secondX
          }

          return Number(first?.y || 0) - Number(second?.y || 0)
        })
    : []

  if (agentNodes.length > 0) {
    return agentNodes.map((node, index) => {
      const subType = node.subType
      const definition = subType ? defs[subType] : null
      const icon = node.icon || definition?.icon || ['EditPen', 'Collection', 'List', 'DataLine', 'CircleCheck'][index] || 'EditPen'

      return {
        key: node.id || subType || `agent-${index + 1}`,
        icon,
        label: node.label || definition?.label || `步骤 ${index + 1}`,
        desc: node.desc || definition?.desc || node.meta || '点击查看并编辑该步骤的 Prompt 与模型配置'
      }
    })
  }

  return [
    { key: 'agent-design', icon: 'EditPen', label: defs['agent-design']?.label || '案例生成 Agent', desc: '根据关键词和需求生成案例草案' },
    { key: 'agent-knowledge', icon: 'Collection', label: defs['agent-knowledge']?.label || '结构化规范 Agent', desc: '将草案规范为标准JSON结构' },
    { key: 'agent-question', icon: 'List', label: defs['agent-question']?.label || '质量校验 Agent', desc: '校验逻辑一致性和完整性' },
    { key: 'agent-data', icon: 'DataLine', label: defs['agent-data']?.label || '数据生成 Agent', desc: '生成数据库模拟数据' },
    { key: 'agent-review', icon: 'CircleCheck', label: defs['agent-review']?.label || '教学审核 Agent', desc: '教学匹配度评估和质量评分' }
  ]
})
</script>

<style scoped lang="scss">
$primary: #2563eb;
$border-color: #e2e8f0;

.toolbox {
  background: #ffffff;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  user-select: none;
  z-index: 10;
  flex-shrink: 0;
  border-right: 1px solid $border-color;
  overflow-y: auto;
  font-size: 17px;

  .section-title {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    color: #94a3b8;
    letter-spacing: 0.05em;
  }

  .flow-intro {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 10px;
    font-size: 14px;
    color: #1e40af;
    line-height: 1.5;
    
    p { margin: 0; }
  }

  .step-list {
    display: flex;
    flex-direction: column;
    gap: 0;

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      border: 1px solid transparent;

      &:hover {
        background: #f1f5f9;
        border-color: $border-color;
      }
      
      &.active {
        background: #eff6ff;
        border-color: $primary;
        
        .step-number {
          background: $primary;
          color: #fff;
          border-color: $primary;
        }
        .step-name { color: $primary; }
      }

      .step-number {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #f1f5f9;
        border: 2px solid $border-color;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: #64748b;
        flex-shrink: 0;
        transition: all 0.2s;
      }

      .step-info {
        flex: 1;
        min-width: 0;

        .step-name {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 4px;
          
          .el-icon { font-size: 18px; }
        }

        .step-desc {
          font-size: 14px;
          color: #94a3b8;
          line-height: 1.4;
        }
      }

      .step-connector {
        position: absolute;
        left: 25px;
        bottom: -2px;
        width: 2px;
        height: 4px;
        background: $border-color;
      }
    }
  }

  .usage-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #fefce8;
    border: 1px solid #fef08a;
    border-radius: 8px;
    font-size: 14px;
    color: #854d0e;
    
    .el-icon { font-size: 18px; flex-shrink: 0; }
  }
}
</style>
