<template>
  <div class="welcome-container">
    <div class="welcome-content">
      <div class="logo-area">
        <div class="logo-circle">
          <el-icon class="logo-icon"><Service /></el-icon>
        </div>
      </div>
      <h1 class="title">你好，我是你的 AI 助教</h1>
      
      <div class="suggestion-cards">
        <div 
          v-for="(card, index) in suggestionCards" 
          :key="index" 
          class="card"
          @click="$emit('select-suggestion', card.prompt)"
        >
          <div class="card-header">
            <el-icon><component :is="card.icon" /></el-icon>
            <h3>{{ card.title }}</h3>
          </div>
          <p class="card-desc">{{ card.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Service, Reading, EditPen, DataAnalysis, ChatDotRound } from '@element-plus/icons-vue'

const suggestionCards = [
  {
    title: '课程辅导',
    desc: '帮我解释一下这个知识点...',
    prompt: '请帮我解释一下最近学习的课程知识点，我有些地方不太理解。',
    icon: Reading
  },
  {
    title: '作业批改',
    desc: '帮我看看这道题做得对不对...',
    prompt: '请帮我检查一下我最近完成的作业，看看解答是否正确，并给出建议。',
    icon: EditPen
  },
  {
    title: '案例分析',
    desc: '分析一下这个实训案例...',
    prompt: '请帮我分析一下当前的实训案例，指出其中的关键点和难点。',
    icon: DataAnalysis
  },
  {
    title: '自由对话',
    desc: '随便聊聊...',
    prompt: '你好，我是你的学生，我想和你随便聊聊关于学习和技术的话题。',
    icon: ChatDotRound
  }
]

defineEmits(['select-suggestion'])
</script>

<style scoped lang="scss">
.welcome-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  
  .welcome-content {
    text-align: center;
    max-width: 720px;
    width: 100%;
    
    .logo-area {
      margin-bottom: 24px;
      display: flex;
      justify-content: center;
      
      .logo-circle {
        width: 64px;
        height: 64px;
        background: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        
        .logo-icon {
          font-size: 32px;
          color: #409eff;
        }
      }
    }
    
    .title {
      font-size: 24px;
      color: #303133;
      margin-bottom: 40px;
      font-weight: 600;
    }
    
    .suggestion-cards {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      
      .card {
        background: #fff;
        border: 1px solid #e4e7ed;
        border-radius: 12px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
        
        &:hover {
          border-color: #c0c4cc;
          background-color: #f9fafc;
        }
        
        .card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: #303133;
          
          .el-icon {
            font-size: 18px;
          }
          
          h3 {
            font-size: 14px;
            margin: 0;
            font-weight: 500;
          }
        }
        
        .card-desc {
          font-size: 13px;
          color: #909399;
          margin: 0;
          line-height: 1.4;
        }
      }
    }
  }
}
</style>