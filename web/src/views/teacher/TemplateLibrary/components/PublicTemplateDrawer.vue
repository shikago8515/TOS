<template>
  <el-drawer
    v-model="drawerVisible"
    size="540px"
    :with-header="false"
    :teleported="false"
    class="public-template-drawer"
    destroy-on-close
  >
    <div class="drawer-header">
      <div>
        <div class="drawer-kicker">公共参考模板</div>
        <h3>教学参考，不进入你的模板列表</h3>
        <p>这里展示系统内置的参考模板，主要用于帮助教师理解模板应如何组织。可查看参考内容，但不能直接修改。</p>
      </div>
      <el-tag effect="plain" type="info" round>共 {{ templates.length }} 个</el-tag>
    </div>

    <div class="drawer-tip">
      <span>建议用法：</span>
      <p>先查看参考模板的结构，再回到“我的模板”中新建一份更贴合本课程的私有模板。</p>
    </div>

    <div v-loading="loading" class="drawer-body">
      <template v-if="templates.length">
        <article v-for="item in templates" :key="item.id" class="reference-card">
          <div class="reference-top">
            <div class="reference-main">
              <h4>{{ item.templateName }}</h4>
              <p>{{ item.description || '该模板用于展示案例背景、任务拆解和提交物组织方式。' }}</p>
            </div>
            <div class="reference-tags">
              <el-tag type="primary" effect="plain" size="small">{{ formatTemplateType(item.templateType) }}</el-tag>
              <el-tag :type="difficultyTagType(item.difficultyLevel)" effect="plain" size="small" round>
                {{ difficultyLabel(item.difficultyLevel) }}
              </el-tag>
            </div>
          </div>

          <div class="reference-meta">
            <span>创建时间：{{ formatDateTime(item.createdAt) }}</span>
            <span>仅供参考：不可直接编辑</span>
          </div>

          <div class="reference-footer">
            <el-button type="primary" plain @click="$emit('preview', item)">
              查看参考内容
            </el-button>
          </div>
        </article>
      </template>

      <el-empty
        v-else
        description="当前暂无公共参考模板"
        :image-size="72"
      />
    </div>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: Boolean,
  loading: Boolean,
  templates: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:visible', 'preview'])

const drawerVisible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const difficultyLabel = value => {
  if (Number(value) === 1) return '初级'
  if (Number(value) === 3) return '高级'
  return '中级'
}

const difficultyTagType = value => {
  if (Number(value) === 1) return 'success'
  if (Number(value) === 3) return 'danger'
  return 'warning'
}

const formatTemplateType = value => {
  const map = {
    LIBRARY: '图书管理',
    ECOMMERCE: '电商订单',
    COURSE_SELECTION: '选课管理',
    MEETING: '会议室预订',
    BLOG: '博客平台'
  }
  const raw = String(value || '').trim()
  return map[raw.toUpperCase()] || raw || '通用模板'
}

const formatDateTime = value => {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}
</script>

<style scoped lang="scss">
.public-template-drawer {
  :deep(.el-drawer__body) {
    padding: 22px 20px;
    background: #f8fafc;
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;

  h3 {
    margin: 6px 0 8px;
    font-size: 22px;
    color: #0f172a;
  }

  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
    color: #64748b;
  }
}

.drawer-kicker {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}

.drawer-tip {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid #dbeafe;
  background: #eff6ff;

  span {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: #1d4ed8;
  }

  p {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.7;
    color: #475569;
  }
}

.drawer-body {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reference-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.03);
}

.reference-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.reference-main {
  min-width: 0;

  h4 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
  }

  p {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.7;
    color: #64748b;
  }
}

.reference-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.reference-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  font-size: 12px;
  color: #94a3b8;
}

.reference-footer {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}
</style>
