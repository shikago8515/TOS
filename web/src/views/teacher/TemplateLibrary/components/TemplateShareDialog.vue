<template>
  <el-dialog
    v-model="dialogVisible"
    width="560px"
    :teleported="false"
    class="share-dialog"
    destroy-on-close
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-main-box">
          <div class="dialog-kicker">模板分享</div>
          <h3>{{ templateName || '分享编号' }}</h3>
          <p>把这串编号发送给其他教师，对方在“导入分享模板”中输入后，会生成一份独立的私有模板副本。</p>
        </div>
      </div>
    </template>

    <div class="share-card">
      <div class="share-code-box">
        <span class="share-code">{{ shareCode }}</span>
        <el-button type="primary" @click="$emit('copy')">
          <el-icon><CopyDocument /></el-icon>
          复制编号
        </el-button>
      </div>

      <div class="share-meta">
        <div class="meta-item">
          <span>导入结果</span>
          <strong>对方获得一份可继续维护的私有模板</strong>
        </div>
        <div class="meta-item">
          <span>对原模板影响</span>
          <strong>不会修改你当前维护的模板内容</strong>
        </div>
        <div class="meta-item">
          <span>后续协作方式</span>
          <strong>如需同步新版，可重新生成并发送分享编号</strong>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'

const props = defineProps({
  visible: Boolean,
  templateName: {
    type: String,
    default: ''
  },
  shareCode: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:visible', 'copy'])

const dialogVisible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})
</script>

<style scoped lang="scss">
.share-dialog {
  :deep(.el-dialog) {
    border-radius: 18px;
    overflow: hidden;
  }

  :deep(.el-dialog__header) {
    padding: 18px 22px 14px;
    border-bottom: 1px solid #eef2f7;
  }

  :deep(.el-dialog__body) {
    padding: 18px 22px 20px;
  }
}

.dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;

    .header-main-box {
      min-width: 0;

      .dialog-kicker {
        font-size: 12px;
        font-weight: 700;
        color: #2563eb;
        letter-spacing: 0.04em;
        margin-bottom: 6px;
      }

      h3 {
        margin: 0 0 6px 0;
        font-size: 20px;
        color: #0f172a;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: #64748b;
        line-height: 1.6;
      }
    }

    .header-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
  }
}

.share-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.03);
}

.share-code-box {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.share-code {
  flex: 1;
  min-width: 220px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px dashed #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-align: center;
}

.share-meta {
  margin-top: 16px;
  display: grid;
  gap: 10px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;

  span {
    font-size: 12px;
    color: #64748b;
  }

  strong {
    font-size: 13px;
    color: #0f172a;
    text-align: right;
  }
}
</style>
