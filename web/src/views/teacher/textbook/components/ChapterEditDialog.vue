<template>
  <el-dialog 
    :model-value="visible" 
    @update:model-value="(val) => $emit('update:visible', val)"
    :title="form.id ? '编辑章节' : '新建章节'" 
    width="650px" 
    :teleported="false"
    align-center
    class="custom-edit-dialog"
    :close-on-click-modal="false"
    :append-to-body="false"
  >
    <el-form :model="form" label-width="90px" label-position="top" class="edit-chapter-form">
      <div class="form-row-2">
        <el-form-item label="章节序号" class="compact-item">
          <el-input v-model="form.chapterNo" placeholder="例如: 1.1" size="large">
            <template #prefix>#</template>
          </el-input>
        </el-form-item>
        <el-form-item label="章节标题" class="flex-item">
          <el-input v-model="form.title" placeholder="请输入章节标题" size="large" />
        </el-form-item>
      </div>
      
      <el-form-item label="难度等级">
         <div class="difficulty-selector">
           <div 
             v-for="level in [1, 2, 3]" 
             :key="level"
             class="level-item"
             :class="[{ active: form.suggestedDifficulty === level }, 'level-' + level]"
             @click="form.suggestedDifficulty = level"
           >
             <span class="level-label">{{ getDifficultyLabel(level) }}</span>
             <div class="level-dots">
               <span v-for="i in level" :key="i" class="dot"></span>
             </div>
           </div>
         </div>
      </el-form-item>

      <el-form-item label="内容概述">
        <el-input 
          v-model="form.summary" 
          type="textarea" 
          :rows="3" 
          placeholder="简要概括本章节的核心内容和学习目标..." 
          resize="none"
        />
      </el-form-item>
      
      <el-form-item label="重难点分析">
        <el-input 
          v-model="form.difficulties" 
          type="textarea" 
          :rows="3" 
          placeholder="列出本章的重点、难点以及相应的攻克建议..."
          resize="none"
        />
      </el-form-item>
      
      <el-form-item label="知识点标签">
        <el-select 
          v-model="form.knowledgePoints" 
          multiple 
          filterable 
          allow-create 
          default-first-option 
          placeholder="输入标签并回车" 
          style="width: 100%"
          size="large"
          :teleported="false"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" size="large">取消</el-button>
        <el-button type="primary" @click="$emit('save', form)" :loading="saving" size="large" class="save-btn">
          保存修改
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  chapter: {
    type: Object,
    default: () => ({})
  },
  saving: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:visible', 'save'])

const form = ref({})

// Initialize form when prop changes or dialog opens
watch(() => props.chapter, (newVal) => {
  form.value = JSON.parse(JSON.stringify(newVal))
}, { immediate: true, deep: true })

const getDifficultyLabel = (level) => {
  const map = { 1: '简单', 2: '中等', 3: '困难' }
  return map[level] || '未知'
}
</script>

<style lang="scss">
.custom-edit-dialog {
  border-radius: 8px;
  overflow: hidden;
  
  .el-dialog__header {
    margin: 0;
    padding: 20px 24px;
    border-bottom: 1px solid #ebeef5;
    background: #ffffff;
    
    .el-dialog__title {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }
  
  .el-dialog__body {
    padding: 24px;
    background: #ffffff;
  }
  
  .el-dialog__footer {
    padding: 16px 24px;
    border-top: 1px solid #ebeef5;
    background: #ffffff;
  }
}
</style>

<style lang="scss" scoped>
.edit-chapter-form {
  .form-row-2 {
    display: flex;
    gap: 20px;
    
    .compact-item { width: 140px; flex-shrink: 0; }
    .flex-item { flex: 1; }
  }

  .difficulty-selector {
    display: flex;
    gap: 12px;
    
    .level-item {
      flex: 1;
      border: 1px solid #dcdfe6;
      border-radius: 4px;
      padding: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #ffffff;
      
      &:hover { background: #f5f7fa; border-color: #c0c4cc; }
      
      &.active {
        &.level-1 { background: #f0f9eb; border-color: #67c23a; color: #67c23a; }
        &.level-2 { background: #fdf6ec; border-color: #e6a23c; color: #e6a23c; }
        &.level-3 { background: #fef0f0; border-color: #f56c6c; color: #f56c6c; }
      }
      
      .level-label { font-size: 13px; font-weight: 500; }
      .level-dots { 
        display: flex; 
        gap: 4px; 
        .dot { 
          width: 6px; 
          height: 6px; 
          border-radius: 50%; 
          background: currentColor; 
          opacity: 0.3; 
        } 
      }
      &.active .level-dots .dot { opacity: 1; }
    }
  }
}
</style>
