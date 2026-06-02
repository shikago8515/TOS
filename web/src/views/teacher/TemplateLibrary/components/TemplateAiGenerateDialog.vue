<template>
  <aside class="ai-assistant-panel">
    <div class="panel-header">
      <div class="panel-kicker">AI 辅助</div>
      <h3>参考优秀案例生成模板草稿</h3>
      <p>输入模板大概内容，系统会参考优秀案例库生成草稿，并直接回填左侧新增模板表单。</p>
    </div>

    <el-scrollbar class="panel-scrollbar">
      <div class="panel-body">
        <el-card shadow="never" class="assistant-card">
          <template #header>
            <div class="section-header">
              <el-icon><MagicStick /></el-icon>
              <span>模板方向描述</span>
            </div>
          </template>

          <el-form label-position="top" class="assistant-form">
            <el-form-item label="告诉 AI 你想生成什么模板">
              <el-input
                :model-value="idea"
                type="textarea"
                resize="vertical"
                :autosize="{ minRows: 7, maxRows: 10 }"
                maxlength="400"
                show-word-limit
                placeholder="例如：我想做一个适合数据库课程的图书借阅管理模板，包含多表设计、借阅流程、库存变更、统计分析和学生交付物要求。"
                @update:model-value="$emit('update:idea', $event)"
              />
            </el-form-item>
          </el-form>

          <div class="assistant-actions">
            <el-button type="primary" :loading="loading" @click="$emit('submit')">
              {{ loading ? '正在生成...' : '生成并回填' }}
            </el-button>
            <el-button :disabled="loading || !String(idea || '').trim()" @click="$emit('update:idea', '')">
              清空
            </el-button>
          </div>

          <el-alert
            title="生成后不会自动保存，教师确认无误后仍需手动点击“保存模板”。"
            type="info"
            :closable="false"
            show-icon
          />
        </el-card>

        <el-card shadow="never" class="assistant-card">
          <template #header>
            <div class="section-header">
              <el-icon><CircleCheck /></el-icon>
              <span>当前回填进度</span>
            </div>
          </template>

          <div class="status-list">
            <div
              v-for="item in fieldStatusList"
              :key="item.label"
              class="status-item"
            >
              <div class="status-left">
                <el-icon :class="{ ready: item.ready }"><CircleCheck /></el-icon>
                <span>{{ item.label }}</span>
              </div>
              <span :class="['status-text', { ready: item.ready }]">
                {{ item.ready ? '已就绪' : '待补充' }}
              </span>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="assistant-card">
          <template #header>
            <div class="section-header">
              <el-icon><CollectionTag /></el-icon>
              <span>参考案例</span>
            </div>
          </template>

          <div class="reference-summary">
            <strong>{{ referenceCount || 0 }}</strong>
            <span>个优秀案例参与本次模板草稿生成</span>
          </div>

          <div v-if="referenceCaseNames.length" class="reference-tags">
            <el-tag
              v-for="item in referenceCaseNames"
              :key="item"
              size="small"
              effect="plain"
              round
            >
              {{ item }}
            </el-tag>
          </div>
          <div v-else class="reference-empty">
            生成完成后，这里会显示本次参考的案例名称。
          </div>
        </el-card>

        <el-card shadow="never" class="assistant-card">
          <template #header>
            <div class="section-header">
              <el-icon><InfoFilled /></el-icon>
              <span>使用建议</span>
            </div>
          </template>

          <ul class="tips-list">
            <li>先写清课程名称、业务背景和训练目标，AI 生成的方向会更准。</li>
            <li>如果你已经明确难度、交付物或统计分析重点，也建议直接写进描述里。</li>
            <li>生成后优先检查模板说明和任务清单，再根据课程需要补充细节。</li>
          </ul>
        </el-card>
      </div>
    </el-scrollbar>
  </aside>
</template>

<script setup>
import {
  CircleCheck,
  CollectionTag,
  InfoFilled,
  MagicStick
} from '@element-plus/icons-vue'

defineProps({
  idea: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  referenceCount: {
    type: Number,
    default: 0
  },
  referenceCaseNames: {
    type: Array,
    default: () => []
  },
  fieldStatusList: {
    type: Array,
    default: () => []
  }
})

defineEmits(['update:idea', 'submit'])
</script>

<style scoped lang="scss">
.ai-assistant-panel {
  position: relative;
  width: 360px;
  flex-shrink: 0;
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-left: 1px solid #e2e8f0;
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.04);
  overflow: hidden;
  z-index: 10;
}

.panel-header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid #eef2f7;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  flex-shrink: 0; // 防止头部被挤压

  .panel-kicker {
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #2563eb;
    letter-spacing: 0.04em;
  }

  h3 {
    margin: 0 0 6px;
    font-size: 18px;
    color: #0f172a;
  }

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: #64748b;
  }
}

.panel-scrollbar {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.panel-body {
  padding: 16px;
}

.assistant-card + .assistant-card {
  margin-top: 14px;
}

.assistant-card {
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.03);

  :deep(.el-card__header) {
    padding: 14px 16px;
    border-bottom: 1px solid #eef2f7;
  }
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;

  .el-icon {
    color: #2563eb;
  }
}

.assistant-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 1680px) {
  .ai-assistant-panel {
    position: relative;
    top: auto;
    left: auto;
    width: 100%;
    margin-top: 16px;
    height: 480px;
    flex-shrink: 0;
  }
}

.status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #334155;

  .el-icon {
    color: #c0c4cc;
  }

  .el-icon.ready {
    color: #16a34a;
  }
}

.status-text {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  font-size: 12px;
  color: #64748b;
}

.status-text.ready {
  background: #ecfdf3;
  color: #16a34a;
}

.reference-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;

  strong {
    font-size: 28px;
    font-weight: 800;
    color: #2563eb;
  }

  span {
    font-size: 13px;
    color: #64748b;
  }
}

.reference-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.reference-empty {
  font-size: 13px;
  line-height: 1.7;
  color: #94a3b8;
}

.tips-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: #475569;
}

@media (max-width: 1680px) {
  .ai-assistant-panel {
    position: static;
    width: auto;
    height: auto;
    margin: 16px 20px 20px;
  }
}
</style>
