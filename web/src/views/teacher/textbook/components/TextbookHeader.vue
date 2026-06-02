<template>
  <header class="textbook-header">
    <div class="header-inner">
      <!-- 品牌/标题 -->
      <div class="brand">
        <div class="icon-box">
          <el-icon><Notebook /></el-icon>
        </div>
        <div class="title-col">
          <h1>教材管理</h1>
          <span class="subtitle">Textbook Center</span>
        </div>
      </div>

      <!-- 中间操作区：筛选与搜索 -->
      <div class="filters">
        <div class="filter-group">
          <span class="filter-label">所属课程</span>
          <el-select 
            :model-value="selectedCourseId" 
            @update:model-value="(val) => $emit('update:selectedCourseId', val)"
            placeholder="选择课程" 
            class="course-select custom-select" 
            @change="$emit('course-change')"
            size="large"
            popper-class="course-select-popper"
            :teleported="false"
          >
            <el-option v-for="course in courseList" :key="course.id" :label="course.courseName" :value="course.id" />
          </el-select>
        </div>
        
        <div class="search-box">
          <el-icon class="search-icon"><Search /></el-icon>
          <input 
            type="text"
            :value="searchQuery"
            @input="(e) => $emit('update:searchQuery', e.target.value)"
            placeholder="搜索教材名称..." 
            class="custom-search-input"
          />
        </div>
      </div>

      <!-- 右侧操作区：上传 -->
      <div class="actions">
        <el-button 
          type="primary" 
          size="large" 
          class="upload-btn linear-gradient-btn" 
          @click="$emit('upload')" 
          :disabled="!selectedCourseId"
          round
        >
          <el-icon class="el-icon--left"><Upload /></el-icon>
          上传教材
        </el-button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { Notebook, Upload, Search } from '@element-plus/icons-vue'

defineProps({
  courseList: {
    type: Array,
    default: () => []
  },
  selectedCourseId: {
    type: [String, Number],
    default: null
  },
  searchQuery: {
    type: String,
    default: ''
  }
})

defineEmits(['update:selectedCourseId', 'update:searchQuery', 'upload', 'course-change'])
</script>

<style lang="scss" scoped>
.textbook-header {
  width: 100%;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ebeef5;
  border-radius: 16px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  padding: 16px 32px;
  box-sizing: border-box;
  z-index: 100;
  transition: all 0.3s ease;
  margin-bottom: 24px;
  
  &:hover {
    box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.08);
    background: #ffffff;
  }
  
  .header-inner {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;

  .icon-box {
    width: 48px;
    height: 48px;
    background: #ecf5ff;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #409EFF;
    font-size: 24px;
    transition: transform 0.3s ease;
    
    &:hover {
      transform: scale(1.05) rotate(-5deg);
    }
  }

  .title-col {
    display: flex;
    flex-direction: column;
    
    h1 {
      font-size: 22px;
      font-weight: 600;
      color: #303133;
      margin: 0;
      line-height: 1.2;
    }
    
    .subtitle {
      font-size: 12px;
      color: #909399;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
  }
}

.filters {
  display: flex;
  align-items: center;
  gap: 24px;
  flex: 1;
  justify-content: center;
  padding: 0 40px;

  .filter-group {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .filter-label {
      font-size: 14px;
      color: #606266;
      font-weight: 600;
    }
  }
}

.custom-select {
  width: 220px;
  
  :deep(.el-input__wrapper) {
    background-color: #f5f7fa;
    border: 1px solid transparent;
    box-shadow: none !important;
    border-radius: 8px;
    transition: all 0.3s ease;
    height: 40px;
    
    &:hover, &.is-focus {
      background-color: #ffffff;
      border-color: #409EFF;
      box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.2) !important;
    }
  }
}

.search-box {
  position: relative;
  width: 340px;
  
  .search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #909399;
    font-size: 16px;
    transition: color 0.3s ease;
  }
  
  .custom-search-input {
    width: 100%;
    height: 40px;
    background: #f5f7fa;
    border: 1px solid transparent;
    border-radius: 20px;
    padding: 0 20px 0 44px;
    font-size: 14px;
    color: #303133;
    outline: none;
    transition: all 0.3s ease;
    box-sizing: border-box;
    
    &::placeholder {
      color: #c0c4cc;
    }
    
    &:hover {
      background: #ffffff;
      border-color: #dcdfe6;
    }
    
    &:focus {
      background: white;
      border-color: #409EFF;
      box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
    }
    
    &:focus + .search-icon {
      color: #409EFF;
    }
  }
}

.actions {
  .upload-btn {
    padding: 0 24px;
    font-weight: 600;
    font-size: 14px;
    height: 40px;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
    transition: all 0.3s ease;
    
    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(64, 158, 255, 0.3);
    }
    
    &:active {
      transform: translateY(1px);
      box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
    }
    
    &:disabled {
      background: #a0cfff;
      border-color: #a0cfff;
      box-shadow: none;
      transform: none;
    }
  }
}
</style>
 