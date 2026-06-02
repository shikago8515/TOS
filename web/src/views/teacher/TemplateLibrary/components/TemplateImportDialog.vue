<template>
  <el-dialog
    v-model="dialogVisible"
    width="560px"
    :teleported="false"
    class="import-dialog"
    destroy-on-close
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-main-box">
          <div class="dialog-kicker">模板协作</div>
          <h3>导入分享模板</h3>
          <p>输入其他教师发送给你的分享编号，将其导入为你的私有模板副本。</p>
        </div>
      </div>
    </template>

    <div class="import-layout">
      <el-form label-position="top" class="import-form">
        <el-form-item label="分享编号">
          <el-input
            :model-value="shareCode"
            placeholder="例如：TPL-1A-8F3C7B"
            clearable
            @update:model-value="$emit('update:shareCode', $event)"
          />
        </el-form-item>
      </el-form>

      <div class="hint-card">
        <div class="hint-title">导入后会发生什么</div>
        <ul class="hint-list">
          <li>系统会把对方的模板复制到你的“我的模板”列表中。</li>
          <li>复制后的模板默认属于你的私有模板，不会影响原作者内容。</li>
          <li>导入成功后，你可以继续编辑、分享或用于 AI 案例生成。</li>
        </ul>
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="$emit('submit')">
        导入模板
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: Boolean,
  shareCode: {
    type: String,
    default: ''
  },
  loading: Boolean
})

const emit = defineEmits(['update:visible', 'update:shareCode', 'submit'])

const dialogVisible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})
</script>

<style scoped lang="scss">
.import-dialog {
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

  :deep(.el-dialog__footer) {
    padding: 14px 22px 18px;
    border-top: 1px solid #eef2f7;
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

.import-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.import-form {
  margin: 0;
}

.hint-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.03);
}

.hint-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.hint-list {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #475569;
  line-height: 1.8;
  font-size: 12px;
}
</style>
