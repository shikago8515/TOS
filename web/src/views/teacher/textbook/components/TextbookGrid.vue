<template>
  <main class="manager-content custom-scroll" v-loading="loading">
    <transition-group name="staggered-fade" tag="div" class="book-grid" v-if="textbooks.length > 0">
      <div v-for="(book, index) in textbooks" :key="book.id" class="book-card-item" :style="{ '--delay': index * 0.05 + 's' }">
        <div class="book-card-inner">
          <!-- 书籍封面区域 -->
          <div class="book-cover-wrapper" :class="getBookCoverClass(index)">
            <div class="book-spine"></div>
            <div class="cover-content">
              <div class="book-type-badge">{{ book.fileType ? book.fileType.toUpperCase() : 'PDF' }}</div>
              <div class="book-title-visual">{{ book.name.substring(0, 2) }}</div>
            </div>
            
            <!-- 悬浮操作遮罩 -->
            <div class="cover-overlay">
               <div class="action-circle-btn" @click.stop="$emit('download', book)" title="下载源文件">
                 <el-icon><Download /></el-icon>
               </div>
               <div class="action-circle-btn" @click.stop="$emit('view-chapters', book)" v-if="book.parseStatus === 2" title="查看章节">
                 <el-icon><View /></el-icon>
               </div>
               <div class="action-circle-btn danger" @click.stop="$emit('delete', book.id)" title="删除">
                 <el-icon><Delete /></el-icon>
               </div>
            </div>
          </div>

          <!-- 书籍信息区域 -->
          <div class="book-info">
            <div class="info-header">
              <h3 class="book-title" :title="book.name">{{ book.name }}</h3>
              <p class="course-name">
                <el-icon class="course-icon"><Collection /></el-icon>
                {{ book.courseName }}
              </p>
            </div>
            
            <div class="info-footer">
              <div class="status-badge" :class="getStatusClass(book.parseStatus)">
                <span class="status-dot"></span>
                {{ book.parseStatusText }}
              </div>
              
              <div class="action-area">
                <el-button
                  type="info"
                  link
                  size="small"
                  class="download-btn"
                  @click="$emit('download', book)"
                >
                  下载源文件
                </el-button>
                <el-button 
                  v-if="book.parseStatus === 2"
                  type="primary" 
                  link
                  class="enter-btn"
                  @click="$emit('view-chapters', book)"
                >
                  进入学习 <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                </el-button>
                 <el-button 
                  v-else-if="book.parseStatus === 3" 
                  type="danger" 
                  link
                  size="small"
                  @click="$emit('reparse', book.id)"
                >
                  重试解析 <el-icon class="el-icon--right"><Refresh /></el-icon>
                </el-button>
                 <span v-else class="processing-text">处理中...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition-group>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-illustration">
        <el-icon class="empty-icon"><DocumentAdd /></el-icon>
      </div>
      <h3>暂无教材数据</h3>
      <p>选择课程并点击右上角按钮上传新的教材</p>
    </div>
  </main>
</template>

<script setup>
import { View, Refresh, Delete, Download, ArrowRight, Collection, DocumentAdd } from '@element-plus/icons-vue'

defineProps({
  textbooks: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['view-chapters', 'reparse', 'delete', 'download'])

const getBookCoverClass = (index) => {
  // 移除紫色相关，使用清新主题色
  const styles = ['gradient-ocean', 'gradient-emerald', 'gradient-sky', 'gradient-mint', 'gradient-teal']
  return styles[index % styles.length]
}

const getStatusClass = (status) => {
  const map = {
    0: 'status-pending', // 待解析
    1: 'status-processing', // 解析中
    2: 'status-success', // 解析完成
    3: 'status-error' // 解析失败
  }
  return map[status] || 'status-pending'
}
</script>

<style lang="scss" scoped>
.manager-content {
  flex: 1;
  width: 100%;
  padding: 24px 32px;
  box-sizing: border-box;
  overflow-y: auto;
  scroll-behavior: smooth;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(144, 147, 153, 0.3);
    border-radius: 4px;
    &:hover { background: rgba(144, 147, 153, 0.5); }
  }
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  width: 100%;
  padding-bottom: 40px;
}

.book-card-item {
  animation: fade-slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--delay);
  opacity: 0;
  transform: translateY(20px);
}

.book-card-inner {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 16px;
  height: 140px;
  position: relative;
  transition: all 0.3s ease;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #ebeef5;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.08);
    border-color: #c6e2ff;

    .book-cover-wrapper {
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .cover-overlay {
      opacity: 1;
    }
  }
}

/* 封面设计 */
.book-cover-wrapper {
  width: 96px;
  height: 100%;
  border-radius: 8px;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  /* 清新渐变样式库 */
  &.gradient-ocean { background: linear-gradient(135deg, #409EFF 0%, #337ecc 100%); }
  &.gradient-emerald { background: linear-gradient(135deg, #67C23A 0%, #529b2e 100%); }
  &.gradient-sky { background: linear-gradient(135deg, #79bbff 0%, #409EFF 100%); }
  &.gradient-mint { background: linear-gradient(135deg, #95d475 0%, #67C23A 100%); }
  &.gradient-teal { background: linear-gradient(135deg, #73c9e5 0%, #337ecc 100%); }

  .book-spine {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    background: linear-gradient(to right, rgba(255,255,255,0.3), rgba(255,255,255,0.05));
    z-index: 2;
    border-right: 1px solid rgba(0,0,0,0.05);
  }

  .cover-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 12px;
    color: white;
    position: relative;
    z-index: 1;
    
    .book-type-badge {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      width: fit-content;
      backdrop-filter: blur(2px);
    }

    .book-title-visual {
      font-size: 32px;
      font-weight: 800;
      opacity: 0.3;
      line-height: 1;
      letter-spacing: -1px;
    }
  }

  .cover-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    opacity: 0;
    transition: all 0.3s ease;
    z-index: 5;
    
    .action-circle-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.9);
      color: #303133;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 16px;
      
      &:hover { 
        transform: scale(1.1); 
        background: #ffffff;
        color: #409EFF;
      }
      &.danger { 
        color: #F56C6C; 
        &:hover { 
          background: #fef0f0; 
        } 
      }
    }
  }
}

/* 信息区域 */
.book-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2px 0;
  min-width: 0;

  .info-header {
    .book-title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 6px 0;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      transition: color 0.3s ease;
    }

    .course-name {
      font-size: 12px;
      color: #909399;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 4px;
      
      .course-icon {
        font-size: 13px;
      }
    }
  }

  .info-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      &.status-pending { background: #f4f4f5; color: #909399; .status-dot{ background: #c0c4cc; } }
      &.status-processing { background: #ecf5ff; color: #409EFF; .status-dot{ background: #409EFF; animation: pulse 2s infinite; } }
      &.status-success { background: #f0f9eb; color: #67C23A; .status-dot{ background: #67C23A; } }
      &.status-error { background: #fef0f0; color: #F56C6C; .status-dot{ background: #F56C6C; } }
    }
  }
  
  .enter-btn {
    font-weight: 500;
    font-size: 13px;
    padding: 0;
    
    &:hover { 
      transform: translateX(2px); 
    }
  }
  
  .processing-text {
    font-size: 12px;
    color: #909399;
  }

  .download-btn {
    font-size: 12px;
    padding: 0;
    margin-right: 10px;
    color: #606266;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
  color: #909399;
  
  .empty-illustration {
    width: 80px;
    height: 80px;
    background: #f5f7fa;
    border-radius: 50%;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .empty-icon {
      font-size: 40px;
      color: #c0c4cc;
    }
  }
  
  h3 {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin: 0 0 8px 0;
  }
  
  p {
    font-size: 13px;
    margin: 0;
  }
}

@keyframes fade-slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}
</style>     
