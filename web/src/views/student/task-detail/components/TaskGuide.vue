<template>
  <el-card shadow="never" class="guide-card">
    <template #header>
      <div class="card-header">
        <span class="title"><el-icon><Guide /></el-icon> 操作指南</span>
        <el-button link type="primary" size="small" @click="expanded = !expanded">
          {{ expanded ? '收起详情' : '展开详情' }}
        </el-button>
      </div>
    </template>

    <div class="step-hint" v-if="currentHint">
      <span class="step-label">当前步骤：</span>
      {{ currentHint }}
    </div>

    <div class="compact-track" v-if="guideItems?.length">
      <div
        class="track-item"
        v-for="(item, idx) in guideItems"
        :key="`${item.title}-track-${idx}`"
        :class="{ done: item.done, active: idx === safeCurrentStep }"
      >
        <span class="dot"></span>
        <span class="name">{{ idx + 1 }}. {{ item.title }}</span>
      </div>
    </div>

    <transition name="el-fade-in-linear">
      <div class="guide-list" v-if="expanded && guideItems?.length">
      <div class="guide-item" v-for="(item, idx) in guideItems" :key="`${item.title}-${idx}`">
        <div class="guide-item-left">
          <el-icon class="status-icon" :class="{ done: item.done }">
            <CircleCheckFilled v-if="item.done" />
            <Clock v-else />
          </el-icon>
          <div class="guide-item-content">
            <div class="guide-item-title">{{ idx + 1 }}. {{ item.title }}</div>
            <div class="guide-item-desc">{{ item.desc }}</div>
          </div>
        </div>
        <el-tag size="small" :type="item.done ? 'success' : 'info'" effect="plain">
          {{ item.done ? '已完成' : '进行中' }}
        </el-tag>
      </div>
      </div>
    </transition>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Guide, CircleCheckFilled, Clock } from '@element-plus/icons-vue'

type GuideItem = {
  title: string
  desc: string
  done: boolean
}

const props = defineProps<{
  currentStep: number
  stepHints: string[]
  guideItems: GuideItem[]
}>()

const expanded = ref(false)

const safeCurrentStep = computed(() => {
  const max = (props.guideItems?.length || 1) - 1
  if (props.currentStep < 0) return 0
  if (props.currentStep > max) return max
  return props.currentStep
})

const currentHint = computed(() => {
  if (!props.stepHints?.length) return ''
  return props.stepHints[safeCurrentStep.value] || props.stepHints[props.stepHints.length - 1] || ''
})
</script>

<style scoped lang="scss">
.guide-card {
  width: 100%;
  box-sizing: border-box;
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  margin-bottom: 0;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  }
  
  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;
    background: linear-gradient(to right, #ffffff, #f9fafc);
  }
  
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #303133;
      font-size: 15px;
      
      .el-icon {
        color: #409eff;
      }
    }
  }
  
  .step-hint {
    background: #f8fafc;
    color: #334155;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.6;
    font-weight: 400;
    border: 1px solid #e5e7eb;

    .step-label {
      color: #475569;
      font-weight: 600;
      margin-right: 6px;
    }
  }

  .compact-track {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
    margin-top: 10px;
  }

  .track-item {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: #64748b;
    font-size: 12px;

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #cbd5e1;
      flex-shrink: 0;
    }

    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.done {
      color: #0f766e;
      .dot { background: #10b981; }
    }

    &.active {
      color: #1d4ed8;
      font-weight: 600;
      .dot { background: #3b82f6; }
    }
  }

  .guide-list {
    margin-top: 12px;
    border-top: 1px dashed #e5e7eb;
    padding-top: 12px;
  }

  .guide-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
  }

  .guide-item-left {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }

  .status-icon {
    color: #94a3b8;
    margin-top: 2px;

    &.done {
      color: #10b981;
    }
  }

  .guide-item-content {
    min-width: 0;
  }

  .guide-item-title {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.5;
  }

  .guide-item-desc {
    margin-top: 2px;
    font-size: 13px;
    color: #64748b;
    line-height: 1.6;
  }
}
</style>
