<template>
  <div class="prompt-guide-container animate__animated animate__fadeIn">
    <el-alert
      title="Prompt 编写最佳实践"
      type="info"
      :closable="false"
      show-icon
      class="guide-alert"
      effect="light"
    >
      <template #default>
        <div class="guide-content">
          <div class="guide-section">
            <h4 class="text-success"><el-icon><CircleCheckFilled /></el-icon> 推荐做法</h4>
            <ul>
              <li>要求 LLM 返回<strong>标准 JSON 格式</strong></li>
              <li>明确说明需要<strong>转义特殊字符</strong>（如双引号 <code>"</code> 转义为 <code>\"</code>）</li>
              <li>提供清晰的 JSON 结构示例（Few-Shot Prompting）</li>
              <li>使用结构化语言描述复杂需求</li>
            </ul>
          </div>

          <div class="guide-section">
            <h4 class="text-danger"><el-icon><CircleCloseFilled /></el-icon> 避免做法</h4>
            <ul>
              <li>不要在 JSON 字符串值中使用未转义的双引号</li>
              <li>避免在 Prompt 中使用容易混淆的嵌套 Markdown 格式</li>
              <li>不要要求 LLM 返回代码注释或额外的说明文字（Keep it clean）</li>
            </ul>
          </div>

          <div class="guide-section">
            <h4><el-icon><DocumentCopy /></el-icon> 模板工具</h4>
            <div class="template-actions">
              <el-button 
                type="primary" 
                size="small" 
                @click="showTemplate = !showTemplate"
                :icon="showTemplate ? 'Hide' : 'View'"
                plain
              >
                {{ showTemplate ? '隐藏模板' : '查看模板示例' }}
              </el-button>
            </div>

            <transition name="el-zoom-in-top">
              <div v-if="showTemplate" class="template-example">
                <div class="example-header">
                  <span>Java Web 实训案例生成模板</span>
                  <el-button size="small" type="primary" link @click="copyTemplate">复制</el-button>
                </div>
                <pre class="custom-scrollbar"><code>{{ templateExample }}</code></pre>
              </div>
            </transition>
          </div>

          <div class="guide-section">
            <h4><el-icon><WarningFilled /></el-icon> JSON 格式速查</h4>
            <div class="json-rules">
              <el-tag type="success" size="small" effect="plain">必须转义双引号 \"</el-tag>
              <el-tag type="success" size="small" effect="plain">换行使用 \n</el-tag>
              <el-tag type="success" size="small" effect="plain">制表符使用 \t</el-tag>
              <el-tag type="warning" size="small" effect="plain">避免深层嵌套</el-tag>
            </div>
          </div>
        </div>
      </template>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheckFilled, CircleCloseFilled, DocumentCopy, WarningFilled } from '@element-plus/icons-vue'
import 'animate.css'

const showTemplate = ref(false)

const templateExample = `请生成一个 Java Web 实训案例，要求：

1. 案例名称要简洁有吸引力
2. 背景故事要真实可信
3. 任务列表要循序渐进

## 输出格式（严格 JSON）：
{
  "case_name": "案例名称",
  "background_story": "背景故事（注意：如果包含引号请转义）",
  "knowledge_points": ["知识点1", "知识点2"],
  "task_list": [
    {
      "sequence": 1,
      "title": "任务标题",
      "description": "任务描述",
      "requirements": "任务要求"
    }
  ]
}

**重要**：返回的内容必须是有效的 JSON 格式，字符串值中的双引号必须转义为 \\"，换行使用 \\n。`

const copyTemplate = () => {
  navigator.clipboard.writeText(templateExample)
    .then(() => {
      ElMessage.success('模板已复制到剪贴板')
    })
    .catch(() => {
      ElMessage.error('复制失败，请手动复制')
    })
}
</script>

<style scoped lang="scss">
.prompt-guide-container {
  width: 100%;
}

.guide-alert {
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  background-color: #fdfdfd;
  
  :deep(.el-alert__content) {
    width: 100%;
  }
}

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
  
  .guide-section {
    h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    ul {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      color: #606266;
      li { margin-bottom: 4px; }
    }
  }
}

.template-example {
  margin-top: 12px;
  background: #282c34;
  border-radius: 6px;
  overflow: hidden;
  
  .example-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #21252b;
    color: #abb2bf;
    font-size: 12px;
    border-bottom: 1px solid #3e4451;
  }
  
  pre {
    margin: 0;
    padding: 12px;
    color: #abb2bf;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    white-space: pre-wrap;
    max-height: 200px;
    overflow-y: auto;
  }
}

.json-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.text-success { color: #67c23a; }
.text-danger { color: #f56c6c; }
</style>