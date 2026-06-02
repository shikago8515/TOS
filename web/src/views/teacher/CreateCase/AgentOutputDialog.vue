<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="Agent 内容审查"
    width="900px"
    :teleported="false"
    class="agent-review-dialog"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div v-if="agentOutputData" class="agent-output-wrapper">
      <div class="review-header-info">
        <div class="agent-badge">
          <el-icon><Monitor /></el-icon>
          <span>{{ agentOutputData.agentName }}</span>
        </div>

        <div v-if="agentOutputData.reviewMessage" class="review-status-alert">
          <el-icon><WarningFilled /></el-icon>
          <span>{{ agentOutputData.reviewMessage }}</span>
        </div>
      </div>

      <div v-if="parsedContent" class="structured-content-view">
        <div v-if="parsedContent.caseName" class="content-block case-info">
          <h3 class="block-title">
            <div class="title-left">
              <el-icon><Reading /></el-icon> 案例概览
            </div>
          </h3>
          <div class="info-card">
            <h4 class="case-title">{{ parsedContent.caseName }}</h4>
            <div class="case-desc">
              <span class="label">背景描述：</span>
              <p>{{ parsedContent.backgroundStory || '暂无详细描述' }}</p>
            </div>
          </div>
        </div>

        <div v-if="parsedContent.taskList && Array.isArray(parsedContent.taskList)" class="content-block task-list">
          <h3 class="block-title">
            <div class="title-left">
              <el-icon><List /></el-icon> 实训任务清单
            </div>
            <span class="count-badge">{{ parsedContent.taskList.length }} 个任务</span>
          </h3>
          <div class="task-items-container">
            <div v-for="task in parsedContent.taskList" :key="task.sequence" class="task-item-card">
              <div class="task-header">
                <span class="task-seq">Task {{ task.sequence }}</span>
                <span class="task-title">{{ task.title }}</span>
                <el-tag size="small" effect="plain" class="type-tag">{{ task.submission_type }}</el-tag>
              </div>
              <div class="task-body">
                <p class="desc">{{ task.description }}</p>
                <div class="req-box">
                  <span class="label">要求：</span>
                  <span>{{ task.requirements }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="isDataGenerationAgent && hasRenderableMockData" class="content-block mock-data">
          <h3 class="block-title">
            <div class="title-left">
              <el-icon><DataLine /></el-icon> 模拟数据结构
            </div>
          </h3>
          <div class="data-preview-box">
            <template v-if="parsedContent.mockData.table_name">
              <div class="table-meta-header">
                <div class="meta-item">
                  <span class="label">表名</span>
                  <span class="value code-font">{{ parsedContent.mockData.table_name }}</span>
                </div>
                <div class="meta-item" v-if="parsedContent.mockData.table_comment">
                  <span class="label">说明</span>
                  <span class="value">{{ parsedContent.mockData.table_comment }}</span>
                </div>
              </div>

              <el-table
                v-if="parsedContent.mockData.rows && parsedContent.mockData.columns"
                :data="buildMockTableRows(parsedContent.mockData)"
                border
                stripe
                size="small"
                style="width: 100%"
                header-cell-class-name="table-header-cell"
              >
                <el-table-column
                  v-for="col in parsedContent.mockData.columns"
                  :key="col.name"
                  :prop="col.name"
                  :label="col.name"
                  min-width="120"
                >
                  <template #header>
                    <div class="custom-col-header">
                      <span>{{ col.name }}</span>
                      <span class="col-comment" v-if="col.comment">{{ col.comment }}</span>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </template>

            <div v-else class="json-viewer">
              <pre>{{ JSON.stringify(parsedContent.mockData, null, 2) }}</pre>
            </div>
          </div>
        </div>

        <div v-if="shouldShowJsonFallback" class="json-fallback">
          <pre>{{ JSON.stringify(parsedContent, null, 2) }}</pre>
        </div>
      </div>

      <div v-else class="output-content-raw">
        <pre>{{ agentOutputData.content }}</pre>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
      <el-button v-if="isSingleWorkflowReviewing" type="success" @click="emit('approve')">通过审核并继续</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DataLine, List, Monitor, Reading, WarningFilled } from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
  agentOutputData: any
  parsedContent: any
  isSingleWorkflowReviewing: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'approve'): void
}>()

const isDataGenerationAgent = computed(() => props.agentOutputData?.agentName === 'DataGenerationAgent')

const hasRenderableMockData = computed(() => {
  const mockData = props.parsedContent?.mockData
  if (!mockData || typeof mockData !== 'object') return false

  const tables = Array.isArray(mockData.tables) ? mockData.tables : []
  if (tables.length > 0) return true

  const rows = Array.isArray(mockData.rows) ? mockData.rows : []
  const columns = Array.isArray(mockData.columns) ? mockData.columns : []
  if (rows.length > 0 || columns.length > 0) return true

  return Object.keys(mockData).length > 0
})

const shouldShowJsonFallback = computed(() => {
  const parsed = props.parsedContent || {}
  if (isDataGenerationAgent.value) {
    return !hasRenderableMockData.value
  }
  return !parsed.caseName && !parsed.taskList && !parsed.mockData
})

const buildMockTableRows = (mockData: any) => {
  const rows = mockData?.rows || []
  const columns = mockData?.columns || []
  if (!Array.isArray(rows) || !Array.isArray(columns)) {
    return []
  }

  return rows.map((row: any[]) => {
    const item: Record<string, any> = {}
    columns.forEach((col: any, index: number) => {
      const key = col?.name || `col_${index}`
      item[key] = row?.[index]
    })
    return item
  })
}
</script>

<style scoped lang="scss">
.agent-output-wrapper {
  color: #334155;

  .review-header-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    background: #f8fafc;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;

    .agent-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;

      .el-icon {
        font-size: 20px;
        color: #3b82f6;
      }
    }

    .review-status-alert {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #d97706;
      background: #fffbeb;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      border: 1px solid #fcd34d;

      .el-icon { font-size: 15px; }
    }
  }

  .structured-content-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 65vh;
    overflow-y: auto;
    padding-right: 8px;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 3px;
    }
    &::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
      &:hover { background: #94a3b8; }
    }

    .content-block {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);

      .block-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 0 0 12px 0;
        padding-bottom: 10px;
        border-bottom: 1px dashed #e2e8f0;

        .title-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;

          .el-icon { color: #3b82f6; font-size: 18px; }
        }

        .count-badge {
          font-size: 12px;
          background: #eff6ff;
          color: #3b82f6;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 600;
        }
      }
    }

    .case-info {
      .case-title {
        margin: 0 0 12px 0;
        font-size: 18px;
        color: #0f172a;
      }
      .case-desc {
        background: #f8fafc;
        padding: 12px;
        border-radius: 8px;

        .label {
          display: block;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
          font-weight: 600;
        }
        p {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: #334155;
        }
      }
    }

    .task-list {
      .task-items-container {
        display: flex;
        flex-direction: column;
        gap: 16px;

        .task-item-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.2s;

          &:hover {
            border-color: #cbd5e1;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }

          .task-header {
            background: #f8fafc;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid #f1f5f9;

            .task-seq {
              font-family: 'Monaco', monospace;
              font-size: 12px;
              color: #64748b;
              font-weight: 700;
              background: #e2e8f0;
              padding: 2px 6px;
              border-radius: 4px;
            }
            .task-title {
              font-weight: 600;
              color: #1e293b;
              flex: 1;
            }
          }

          .task-body {
            padding: 12px 16px;

            .desc {
              margin: 0 0 12px 0;
              font-size: 14px;
              color: #475569;
              line-height: 1.5;
            }

            .req-box {
              background: #fff7ed;
              border: 1px solid #ffedd5;
              padding: 8px 12px;
              border-radius: 6px;
              font-size: 13px;
              color: #9a3412;

              .label { font-weight: 600; margin-right: 4px; }
            }
          }
        }
      }
    }

    .mock-data {
      .table-meta-header {
        display: flex;
        gap: 24px;
        margin-bottom: 16px;
        background: #f8fafc;
        padding: 12px;
        border-radius: 8px;

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 4px;

          .label { font-size: 12px; color: #64748b; }
          .value { font-size: 14px; font-weight: 600; color: #0f172a; }
          .code-font { font-family: monospace; color: #3b82f6; }
        }
      }

      .custom-col-header {
        display: flex;
        flex-direction: column;
        line-height: 1.2;

        .col-comment {
          font-size: 11px;
          color: #94a3b8;
          font-weight: normal;
          margin-top: 2px;
        }
      }
    }

    .output-content-raw, .json-fallback, .json-viewer {
      background: #1e293b;
      border-radius: 8px;
      padding: 16px;
      color: #e2e8f0;

      pre {
        margin: 0;
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 13px;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    }
  }
}
</style>
