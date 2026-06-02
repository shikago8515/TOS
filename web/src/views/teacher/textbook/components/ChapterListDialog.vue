<template>
  <el-dialog 
    :model-value="visible" 
    @update:model-value="(val) => $emit('update:visible', val)" 
    :title="textbook?.name" 
    width="1200px" 
    :teleported="false"
    class="chapter-dialog"
    modal-class="chapter-dialog-overlay"
    top="0"
    :lock-scroll="true"
    destroy-on-close
    :append-to-body="false"
  >
    <template #header>
      <div class="dialog-header-content">
        <div class="book-info">
          <h3 class="book-name" :title="textbook?.name">{{ textbook?.name }}</h3>
          <el-tag size="small" type="info" effect="plain" class="chapter-badge">共 {{ chapters.length }} 章</el-tag>
        </div>
        <el-button type="primary" icon="Plus" @click="$emit('add')" class="add-btn">
          添加章节
        </el-button>
      </div>
    </template>

    <div class="chapter-workbench" v-loading="loading">
      <div v-if="chapters.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无章节数据">
          <template #image>
            <el-icon class="empty-icon"><Notebook /></el-icon>
          </template>
          <p class="empty-sub-text">AI 正在分析教材结构，或者您可以手动添加章节信息</p>
        </el-empty>
      </div>

      <template v-else>
        <aside class="chapter-nav-panel">
          <div class="panel-title">章节导航</div>
          <div class="chapter-nav-list custom-scroll">
            <div
              v-for="(chapter, index) in chapters"
              :key="chapter.id"
              class="chapter-nav-item"
              :class="{ 'is-active': chapter.id === activeChapterId }"
              @click="activeChapterId = chapter.id"
            >
              <div class="chapter-nav-main">
                <span class="chapter-no">{{ chapter.chapterNo || (index + 1) }}</span>
                <span class="chapter-name" :title="chapter.title">{{ chapter.title }}</span>
              </div>
              <el-tag
                v-if="chapter.suggestedDifficulty"
                :type="getDifficultyType(chapter.suggestedDifficulty)"
                size="small"
                effect="plain"
              >
                {{ getDifficultyLabel(chapter.suggestedDifficulty) }}
              </el-tag>
            </div>
          </div>
        </aside>

        <section class="chapter-content-panel">
          <div class="content-header">
            <div class="content-title-wrap">
              <span class="content-no">第 {{ activeChapter?.chapterNo || '-' }} 章</span>
              <h4 class="content-title">{{ activeChapter?.title || '未选择章节' }}</h4>
            </div>
            <div class="content-actions" v-if="activeChapter">
              <el-button type="primary" link icon="Edit" @click="$emit('edit', activeChapter)">编辑</el-button>
              <el-button type="danger" link icon="Delete" @click="$emit('delete', activeChapter.id)">删除</el-button>
            </div>
          </div>

          <div class="content-body custom-scroll" v-if="activeChapter">
            <div class="detail-section">
              <div class="section-title">
                <el-icon><Document /></el-icon> 内容概述
              </div>
              <div class="section-content summary-text" v-if="activeChapter.summary">
                {{ activeChapter.summary }}
              </div>
              <el-empty v-else description="暂无内容概述" :image-size="48" />
            </div>

            <div class="detail-section">
              <div class="section-title">
                <el-icon><CollectionTag /></el-icon> 核心知识点
              </div>
              <div class="section-content" v-if="activeChapter.keyPoints && activeChapter.keyPoints.length > 0">
                <el-table :data="activeChapter.keyPoints" border size="small" style="width: 100%">
                  <el-table-column prop="name" label="知识点名称" width="220" />
                  <el-table-column prop="description" label="描述说明" />
                </el-table>
              </div>
              <el-empty v-else description="暂无知识点数据" :image-size="48" />
            </div>

            <div class="detail-section">
              <div class="section-title">
                <el-icon><Connection /></el-icon> 关联标签
              </div>
              <div class="section-content tags-container" v-if="activeChapter.knowledgePoints && activeChapter.knowledgePoints.length > 0">
                <el-tag 
                  v-for="tag in activeChapter.knowledgePoints" 
                  :key="tag" 
                  size="small" 
                  type="info" 
                  class="knowledge-tag"
                >
                  {{ tag }}
                </el-tag>
              </div>
              <el-empty v-else description="暂无关联标签" :image-size="48" />
            </div>
          </div>

          <div v-else class="no-selection">
            <el-empty description="请选择左侧章节查看详情" />
          </div>
        </section>
      </template>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Plus, Edit, Delete, Notebook, Document, CollectionTag, Connection } from '@element-plus/icons-vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  textbook: { type: Object, default: () => ({}) },
  chapters: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

defineEmits(['update:visible', 'add', 'edit', 'delete'])

const activeChapterId = ref(null)

const activeChapter = computed(() => {
  if (!activeChapterId.value) return props.chapters?.[0] || null
  return props.chapters.find(item => item.id === activeChapterId.value) || props.chapters?.[0] || null
})

watch(
  () => props.chapters,
  (newChapters) => {
    if (!newChapters || newChapters.length === 0) {
      activeChapterId.value = null
      return
    }
    const exists = newChapters.some(item => item.id === activeChapterId.value)
    if (!exists) {
      activeChapterId.value = newChapters[0].id
    }
  },
  { immediate: true }
)

const getDifficultyLabel = (level) => {
  const map = { 1: '入门', 2: '进阶', 3: '高阶' }
  return map[level] || '未知'
}
const getDifficultyType = (level) => {
  const map = { 1: 'success', 2: 'warning', 3: 'danger' }
  return map[level] || 'info'
}
</script>

<style lang="scss">
/* 全局覆盖 Dialog 样式 */
.chapter-dialog {
  border-radius: 10px;
  width: min(1200px, calc(100vw - 32px)) !important;
  max-width: calc(100vw - 32px);
  height: 100% !important;
  max-height: 100% !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0 auto !important;

  .el-dialog__header {
    margin-bottom: 0;
    padding: 20px 24px;
    border-bottom: 1px solid #ebeef5;
    background: #ffffff;
  }
  .el-dialog__body {
    padding: 0;
    background: #f5f7fa;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}

.chapter-dialog-overlay {
  padding: 12px 16px !important;
  box-sizing: border-box;

  .el-overlay-dialog {
    height: 100%;
    display: flex;
    align-items: stretch;
    justify-content: center;
    overflow: hidden;
  }
}
</style>

<style lang="scss" scoped>
.chapter-workbench {
  height: 100%;
  display: flex;
  min-height: 0;
}

.dialog-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  
  .book-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    overflow: hidden;
    
    .book-name {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .chapter-badge {
      font-weight: normal;
    }
  }
}

.empty-state {
  width: 100%;
  padding: 60px 0;
  background: #ffffff;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .empty-icon {
    font-size: 64px;
    color: #c0c4cc;
  }
  
  .empty-sub-text {
    color: #909399;
    font-size: 13px;
    margin-top: 8px;
  }
}

.chapter-nav-panel {
  width: 320px;
  border-right: 1px solid #ebeef5;
  background: #ffffff;
  display: flex;
  flex-direction: column;

  .panel-title {
    height: 48px;
    line-height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid #ebeef5;
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .chapter-nav-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 10px;
  }
}

.chapter-nav-item {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  &:hover {
    background: #f5f7fa;
    border-color: #e4e7ed;
  }

  &.is-active {
    background: #ecf5ff;
    border-color: #b3d8ff;
  }

  .chapter-nav-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chapter-no {
    font-size: 12px;
    color: #909399;
  }

  .chapter-name {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.chapter-content-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #ffffff;
  border-bottom: 1px solid #ebeef5;

  .content-title-wrap {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .content-no {
      font-size: 12px;
      color: #909399;
    }

    .content-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .content-actions {
    display: flex;
    gap: 8px;
  }
}

.content-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.no-selection {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-section {
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px;

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    
    .el-icon {
      color: #409EFF;
    }
  }

  .section-content {
    &.summary-text {
      font-size: 14px;
      color: #606266;
      line-height: 1.6;
      background: #f5f7fa;
      padding: 12px 16px;
      border-radius: 4px;
      border-left: 4px solid #409EFF;
    }
    
    &.tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      
      .knowledge-tag {
        border-radius: 4px;
      }
    }
  }
}
</style>
