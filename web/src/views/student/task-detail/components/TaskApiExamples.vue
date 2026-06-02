<template>
  <div class="task-api-examples section-block">
    <div class="section-header">
      <h3 class="section-title">接口示例（供学生自测）</h3>
    
    </div>

    <el-empty
      v-if="apiExamples.length === 0"
      description="当前任务暂未提供结构化接口示例，教师端补齐后可在此直接复制请求/响应 JSON。"
      :image-size="72"
    />

    <el-collapse v-else>
      <el-collapse-item
        v-for="(api, idx) in apiExamples"
        :key="`${api.path || 'api'}-${idx}`"
        :name="String(idx)"
      >
        <template #title>
          <div class="api-title-row">
            <el-tag size="small" :type="methodTagType(api.method)">{{ (api.method || 'GET').toUpperCase() }}</el-tag>
            <span class="api-path">{{ api.path || '-' }}</span>
            <span class="api-name">{{ api.name || `接口${idx + 1}` }}</span>
          </div>
        </template>

        <div class="example-block">
          <div class="example-header">
            <span>请求 JSON</span>
            <el-button size="small" text type="primary" @click="copyText(formatJson(api.request))">复制</el-button>
          </div>
          <pre class="json-preview">{{ formatJson(api.request) }}</pre>
        </div>

        <div class="example-block">
          <div class="example-header">
            <span>响应 JSON</span>
            <el-button size="small" text type="primary" @click="copyText(formatJson(api.response))">复制</el-button>
          </div>
          <pre class="json-preview">{{ formatJson(api.response) }}</pre>
        </div>

        <div class="inference-note" v-if="api.inferenceNote">
          <el-icon><InfoFilled /></el-icon>
          <span>{{ api.inferenceNote }}</span>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'

const props = defineProps<{
  task: any
}>()

type ApiExample = {
  name?: string
  method?: string
  path?: string
  request?: any
  response?: any
  inferenceNote?: string
}

const isNonEmptyPayload = (value: any) => {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

const pickApiPayload = (...candidates: any[]) => {
  const firstNonEmpty = candidates.find((item) => isNonEmptyPayload(item))
  if (firstNonEmpty !== undefined) return firstNonEmpty

  const firstDefined = candidates.find((item) => item !== undefined && item !== null)
  if (firstDefined !== undefined) return firstDefined

  return {}
}

const apiExamples = computed<ApiExample[]>(() => {
  const raw = props.task?.apiExamples
  if (!raw) return []

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const list = Array.isArray(parsed)
      ? parsed
      : parsed?.examples || parsed?.apis || parsed?.items || []

    if (!Array.isArray(list)) return []

    return list.map((item: any) => ({
      name: item?.name || item?.title || item?.apiName,
      method: item?.method || item?.httpMethod || 'GET',
      path: item?.path || item?.url || item?.endpoint,
      request: pickApiPayload(
        item?.request,
        item?.requestExample,
        item?.request_example,
        item?.requestBody,
        item?.request_body,
        item?.requestJson,
        item?.request_json,
        item?.requestData,
        item?.request_data,
        item?.req,
        item?.example?.request,
        item?.examples?.request,
        item?.sample?.request,
        item?.sampleRequest
      ),
      response: pickApiPayload(
        item?.response,
        item?.responseExample,
        item?.response_example,
        item?.responseBody,
        item?.response_body,
        item?.responseJson,
        item?.response_json,
        item?.responseData,
        item?.response_data,
        item?.resp,
        item?.example?.response,
        item?.examples?.response,
        item?.sample?.response,
        item?.sampleResponse
      ),
      inferenceNote: item?.inferenceNote || item?.note || ''
    }))
  } catch {
    return []
  }
})

const methodTagType = (method?: string) => {
  const m = (method || 'GET').toUpperCase()
  if (m === 'GET') return 'success'
  if (m === 'POST') return 'primary'
  if (m === 'PUT' || m === 'PATCH') return 'warning'
  if (m === 'DELETE') return 'danger'
  return 'info'
}

const formatJson = (obj: any) => {
  try {
    if (typeof obj === 'string') {
      // 如果已经是字符串，尝试解析再格式化，如果解析失败直接返回原字符串
      try {
        return JSON.stringify(JSON.parse(obj), null, 2)
      } catch {
        return obj
      }
    }
    return JSON.stringify(obj ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}
</script>

<style scoped lang="scss">
.task-api-examples {
  margin-top: 24px;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .api-title-row {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .api-path {
    color: #606266;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 13px;
  }

  .api-name {
    color: #909399;
    font-size: 13px;
  }

  .example-block {
    margin-bottom: 12px;
  }

  .example-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 14px;
    color: #334155;
    font-weight: 500;
  }

  .json-preview {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    background: #f8f9fa;
    font-size: 13px;
    line-height: 1.6;
    max-height: 220px;
    overflow: auto;
    color: #606266;
  }

  .inference-note {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    color: #64748b;
    line-height: 1.6;
    background: #fafafa;
    border: 1px dashed #e4e7ed;
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 12px;
  }
}
</style>
