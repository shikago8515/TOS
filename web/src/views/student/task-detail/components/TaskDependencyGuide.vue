<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="MCP 探针手动引入教程"
    width="680px"
    :teleported="false"
    destroy-on-close
    class="dependency-guide-dialog"
  >
    <div class="dependency-guide-content">
      <ol>
        <li>打开本地项目的 <code>pom.xml</code>。</li>
        <li>在 <code>&lt;project&gt;</code> 内添加私服仓库地址（若已有可跳过）。</li>
        <li>在 <code>&lt;dependencies&gt;</code> 中添加 <code>mcp-core</code> 依赖。</li>
        <li>执行 Maven 刷新并重启项目后，再点击“开始自动评测”。</li>
        <li>若你本地端口不是常见端口（8080~8083），可在下方填写一次探针地址。</li>
      </ol>

      <div class="probe-url-block">
        <div class="probe-title">可选：自定义探针地址</div>
        <el-input
          v-model="probeBaseUrl"
          clearable
          placeholder="例如：http://localhost:9527"
        />
        <div class="probe-actions">
          <el-button size="small" type="primary" @click="saveProbeBaseUrl">保存地址</el-button>
          <el-button size="small" @click="clearProbeBaseUrl">清空</el-button>
        </div>
        <div class="probe-tip">保存后提交按钮会优先使用该地址探测 MCP。</div>
      </div>

      <div class="maven-snippet-block">
        <div class="snippet-header">
          <span>1) 仓库地址</span>
          <el-button size="small" text type="primary" @click="copyMavenSnippet(mavenRepoSnippet)">复制</el-button>
        </div>
        <pre>{{ mavenRepoSnippet }}</pre>
      </div>

      <div class="maven-snippet-block">
        <div class="snippet-header">
          <span>2) 依赖配置</span>
          <el-button size="small" text type="primary" @click="copyMavenSnippet(mavenDependencySnippet)">复制</el-button>
        </div>
        <pre>{{ mavenDependencySnippet }}</pre>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">我已完成配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

defineProps<{
  visible: boolean
}>()

defineEmits(['update:visible'])

const MCP_BASE_URL_KEY = 'mcpProbeBaseUrl'
const probeBaseUrl = ref(localStorage.getItem(MCP_BASE_URL_KEY) || '')

const mavenRepoSnippet = `<repositories>
  <repository>
    <id>mcp-core</id>
    <url>http://8.148.144.119:8081/repository/mcp-core/</url>
  </repository>
</repositories>`

const mavenDependencySnippet = `<dependency>
  <groupId>com.training</groupId>
  <artifactId>mcp-core</artifactId>
  <version>1.0.0</version>
</dependency>`

const copyMavenSnippet = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败，请手动复制')
  }
}

const saveProbeBaseUrl = () => {
  const value = (probeBaseUrl.value || '').trim().replace(/\/$/, '')
  if (!value) {
    ElMessage.warning('请输入地址后再保存')
    return
  }
  if (!/^https?:\/\//i.test(value)) {
    ElMessage.error('地址需以 http:// 或 https:// 开头')
    return
  }
  localStorage.setItem(MCP_BASE_URL_KEY, value)
  ElMessage.success('探针地址已保存')
}

const clearProbeBaseUrl = () => {
  probeBaseUrl.value = ''
  localStorage.removeItem(MCP_BASE_URL_KEY)
  ElMessage.success('已清空探针地址')
}
</script>

<style scoped lang="scss">
.dependency-guide-dialog {
  .dependency-guide-content {
    color: #606266;
    line-height: 1.8;

    ol {
      margin: 0 0 16px;
      padding-left: 20px;
      
      li {
        margin-bottom: 8px;
        font-size: 14px;
      }
    }

    code {
      background: #f5f7fa;
      padding: 2px 6px;
      border-radius: 4px;
      color: #409eff;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
    }

    .maven-snippet-block {
      margin-top: 16px;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);

      .snippet-header {
        height: 40px;
        padding: 0 16px;
        background: #f5f7fa;
        border-bottom: 1px solid #ebeef5;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 14px;
        font-weight: 500;
        color: #606266;
      }

      pre {
        margin: 0;
        padding: 16px;
        background: #fff;
        color: #303133;
        font-size: 13px;
        overflow-x: auto;
        line-height: 1.6;
        font-family: 'Monaco', 'Menlo', monospace;
      }
    }

    .probe-url-block {
      margin: 6px 0 16px;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      padding: 12px;
      background: #fafcff;

      .probe-title {
        font-size: 14px;
        font-weight: 500;
        color: #606266;
        margin-bottom: 10px;
      }

      .probe-actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
      }

      .probe-tip {
        margin-top: 8px;
        font-size: 12px;
        color: #909399;
      }
    }

  }
}
</style>
