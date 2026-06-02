<template>
  <div class="document-container animate__animated animate__fadeInUp">
    <div class="a4-paper">
      <div class="paper-header">
        <h1 class="doc-title">{{ generatedCase.caseName }}</h1>
        <div class="doc-meta-row">
          <span class="meta-badge difficulty">{{ getDifficultyLabel(difficultyLevel) }}</span>
          <span class="meta-badge time">{{ estimatedHours }} 课时</span>
          <span class="meta-badge date">{{ formatDateTime(generatedCase.createdAt) }}</span>
        </div>
      </div>

      <!-- 统一案例内容展示 -->
      <CaseSummaryView
        :background-story="generatedCase.backgroundStory"
        :task-list="generatedCase.taskList"
        :expected-output="generatedCase.analysisQuestions"
        class="doc-summary-wrap"
      />

      <div class="paper-content">

        <section class="doc-section" v-if="generatedCase.mockData">
          <h2 class="section-heading">
            <span class="icon-box"><el-icon><DataLine /></el-icon></span> 数据预览
          </h2>
          <div class="code-block">
            <div class="code-header">
              <div class="window-controls">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
              </div>
              <span class="filename">mock_data.json</span>
            </div>
            <pre class="code-content">{{ formatJson(generatedCase.mockData) }}</pre>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { DataLine } from '@element-plus/icons-vue'
import CaseSummaryView from '@/components/CaseSummaryView.vue'

defineProps({
  generatedCase: Object,
  difficultyLevel: Number,
  estimatedHours: Number,
  difficultyOptions: Array
})

const formatJson = (jsonStr) => {
  try {
    if (!jsonStr) return '{}'
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    return JSON.stringify(obj, null, 2)
  } catch {
    return jsonStr
  }
}

const formatDateTime = (val) => {
  if (!val) return new Date().toLocaleDateString()
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const getDifficultyLabel = (level) => {
  const labels = { 1: '入门', 2: '进阶', 3: '挑战' }
  return labels[level] || '未知'
}
</script>

<style scoped lang="scss">
.document-container {
  width: 100%;
  max-width: 760px;
  padding-bottom: 40px;
}

.a4-paper {
  background: white;
  min-height: 900px;
  padding: 50px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  position: relative;

  .paper-header {
    margin-bottom: 40px;
    text-align: center;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 24px;

    .doc-title {
      font-size: 28px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 16px;
      line-height: 1.3;
    }

    .doc-meta-row {
      display: flex;
      justify-content: center;
      gap: 12px;

      .meta-badge {
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        
        &.difficulty { background: #eff6ff; color: #3b82f6; }
        &.time { background: #f0fdf4; color: #16a34a; }
        &.date { background: #f8fafc; color: #64748b; }
      }
    }
  }
}

.doc-summary-wrap {
  margin-bottom: 24px;
}

.paper-content {
    .doc-section {
      margin-bottom: 32px;

      .section-heading {
        font-size: 16px;
        font-weight: 600;
        color: #334155;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;

        .icon-box {
          width: 24px;
          height: 24px;
          background: #f1f5f9;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: #64748b;
        }
      }

      .section-text {
        font-size: 14px;
        line-height: 1.7;
        color: #475569;
        text-align: justify;
      }

      .section-generated-content {
        background: #f8fafc;
        border-left: 3px solid #6366f1;
        padding: 10px 14px;
        border-radius: 0 6px 6px 0;
        white-space: pre-line;
      }

      .task-list {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .task-item {
          display: flex;
          gap: 12px;
          
          .task-index {
            width: 20px;
            height: 20px;
            background: #f1f5f9;
            color: #64748b;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
            flex-shrink: 0;
            margin-top: 3px;
          }

          .task-body {
            font-size: 14px;
            line-height: 1.6;
            color: #475569;
            display: flex;
            flex-direction: column;
            gap: 4px;

            .task-title {
              font-weight: 600;
              color: #334155;
            }

            .task-description {
              color: #475569;
            }

            .task-requirements {
              font-size: 13px;
              color: #64748b;
              background: #f8fafc;
              border-left: 3px solid #94a3b8;
              padding: 4px 8px;
              border-radius: 0 4px 4px 0;
              margin-top: 2px;
            }

            .task-sections {
              font-size: 13px;
              color: #64748b;
              margin-top: 4px;
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 4px;
            }

            .req-label {
              font-weight: 500;
              color: #475569;
            }

            .section-tag {
              display: inline-block;
              background: #eff6ff;
              color: #3b82f6;
              border-radius: 4px;
              padding: 1px 6px;
              font-size: 12px;
            }
          }
        }
      }

      .analysis-questions {
        padding-left: 20px;
        margin: 0;
        li {
          font-size: 14px;
          line-height: 1.7;
          color: #475569;
          padding: 4px 0;
          &::marker {
            color: #3b82f6;
            font-weight: 600;
          }
        }
      }
    }
}

.code-block {
  background: #1e293b;
  border-radius: 6px;
  overflow: hidden;
  margin-top: 16px;

  .code-header {
    background: #0f172a;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;

    .window-controls {
      position: absolute;
      left: 12px;
      display: flex;
      gap: 6px;

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        &.red { background: #ef4444; }
        &.yellow { background: #f59e0b; }
        &.green { background: #22c55e; }
      }
    }

    .filename {
      color: #94a3b8;
      font-size: 11px;
      font-family: monospace;
    }
  }

  .code-content {
    padding: 16px;
    margin: 0;
    color: #e2e8f0;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
  }
}
</style>
