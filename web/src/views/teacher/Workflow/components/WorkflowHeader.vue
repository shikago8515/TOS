<template>
  <div class="designer-header">
    <div class="header-left">
      <el-button @click="$emit('back')" icon="ArrowLeft" circle plain class="back-btn" />
      <div class="title-area">
        <h3>{{ title }}</h3>
        <el-tag type="primary" effect="light" size="small" class="mode-tag">Workflow Mode</el-tag>
      </div>
    </div>

    <div class="header-center">
      <el-select
        :model-value="caseType"
        @update:model-value="$emit('update:caseType', $event)"
        placeholder="选择案例模式"
        class="template-select"
        @change="$emit('change')"
        :prefix-icon="Operation"
        :teleported="false"
      >
        <el-option label="完整实训案例" value="FULL_PRACTICE" />
        <el-option label="纯编码任务" value="PURE_CODING" />
      </el-select>

      <el-select
        :model-value="difficulty"
        @update:model-value="$emit('update:difficulty', $event)"
        placeholder="选择难度等级"
        class="template-select"
        @change="$emit('change')"
        :prefix-icon="Trophy"
        :teleported="false"
      >
        <el-option label="初级" value="EASY" />
        <el-option label="中级" value="MEDIUM" />
        <el-option label="高级" value="HARD" />
      </el-select>

      <div v-if="statusText" class="status-indicator" :class="statusType">
        <el-icon>
          <InfoFilled v-if="statusType === 'info'" />
          <CircleCheckFilled v-else-if="statusType === 'success'" />
          <WarningFilled v-else-if="statusType === 'warning'" />
        </el-icon>
        <span>{{ statusText }}</span>
      </div>
    </div>

    <div class="header-actions">
      <el-button type="info" plain icon="Refresh" @click="$emit('restore')">恢复默认</el-button>
      <el-button type="success" plain icon="MagicStick" @click="$emit('autoFill')">AI 一键生成提示词</el-button>
      <el-button type="primary" icon="Check" @click="$emit('save')">保存配置</el-button>
      <el-button icon="VideoPlay" plain @click="$emit('run')">测试运行</el-button>
    </div>
  </div>
</template>

<script setup>
import {
  ArrowLeft,
  Check,
  VideoPlay,
  MagicStick,
  Refresh,
  InfoFilled,
  CircleCheckFilled,
  WarningFilled,
  Operation,
  Trophy
} from '@element-plus/icons-vue'

defineProps({
  title: String,
  caseType: String,
  difficulty: String,
  statusText: String,
  statusType: {
    type: String,
    default: 'info'
  }
})

defineEmits(['back', 'update:caseType', 'update:difficulty', 'change', 'save', 'run', 'autoFill', 'restore'])
</script>

<style scoped lang="scss">
$primary: #2563eb;
$border-color: #e2e8f0;
$text-main: #1e293b;

.designer-header {
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  z-index: 50;
  font-size: 17px;

  :deep(.el-button),
  :deep(.el-input__inner),
  :deep(.el-select__placeholder),
  :deep(.el-tag) {
    font-size: 17px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .back-btn {
      border-color: #e2e8f0;
      color: #64748b;

      &:hover {
        color: $primary;
        border-color: $primary;
        background: #eff6ff;
      }
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 10px;

      h3 {
        margin: 0;
        font-size: 19px;
        font-weight: 600;
        color: $text-main;
      }

      .mode-tag {
        font-weight: 500;
        letter-spacing: 0.5px;
      }
    }
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 12px;

    .template-select {
      width: 180px;

      :deep(.el-input__wrapper) {
        box-shadow: 0 0 0 1px $border-color inset;

        &:hover {
          box-shadow: 0 0 0 1px $primary inset;
        }
      }
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 15px;
      transition: all 0.3s ease;

      &.info {
        background: #f1f5f9;
        color: #64748b;
        border: 1px solid #e2e8f0;
      }

      &.success {
        background: #f0fdf4;
        color: #16a34a;
        border: 1px solid #bbf7d0;
      }

      &.warning {
        background: #fffbeb;
        color: #d97706;
        border: 1px solid #fde68a;
      }
    }
  }
}
</style>
