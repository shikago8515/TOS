<template>
  <div class="welcome-container">
    <!-- 动态背景装饰 -->
    <div class="bg-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
    </div>

    <div class="content-wrapper animate-entry">
      <!-- 头部区域 -->
      <div class="welcome-header">
        <div class="logo-wrapper pulse-anim">
          <el-icon class="logo-icon"><Service /></el-icon>
        </div>
        <h1 class="title">
          Hi，<span class="highlight">{{ userName }}</span> 
        </h1>
        <p class="subtitle">我是您的实训教学智能助手，随时准备为您提供专业支持</p>
      </div>
      
      <!-- 核心功能卡片 -->
      <div class="features-section">
        <div class="section-label">核心能力</div>
        <div class="features-grid">
          <div 
            v-for="(card, index) in featureCards" 
            :key="index"
            class="feature-card glass-effect"
            @click="$emit('feature-click', card)"
          >
            <div class="card-icon-wrapper" :class="`color-${index % 4}`">
              <el-icon class="card-icon"><component :is="card.icon" /></el-icon>
            </div>
            <div class="card-content">
              <h3 class="card-title">{{ card.title }}</h3>
              <p class="card-desc">{{ card.desc }}</p>
            </div>
            <div class="card-action">
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷指令/猜你想问 -->
      <div class="suggestions-section">
        <div class="section-header">
          <div class="header-left">
            <el-icon class="header-icon"><ChatDotRound /></el-icon>
            <span>猜你想问</span>
          </div>
          <el-button 
            class="refresh-btn" 
            text 
            @click="handleRefresh"
            :loading="isRefreshing"
          >
            <template #icon>
              <el-icon :class="{ 'rotate-anim': isRefreshing }"><Refresh /></el-icon>
            </template>
            换一批
          </el-button>
        </div>
        <div class="suggestions-list">
          <div 
            v-for="(prompt, index) in prompts" 
            :key="index"
            class="suggestion-pill"
            :style="{ animationDelay: `${index * 0.05}s` }"
            @click="$emit('prompt-click', prompt)"
          >
            {{ prompt.label }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Service, ArrowRight, ChatDotRound, Refresh } from '@element-plus/icons-vue'

const props = defineProps({
  userName: {
    type: String,
    default: '教师'
  },
  prompts: {
    type: Array,
    default: () => []
  },
  featureCards: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['feature-click', 'prompt-click', 'refresh-prompts'])

const isRefreshing = ref(false)

const handleRefresh = () => {
  isRefreshing.value = true
  emit('refresh-prompts')
  setTimeout(() => {
    isRefreshing.value = false
  }, 1000)
}
</script>

<style scoped lang="scss">
// 变量定义
$primary-color: #007AFF; // 清新蓝，替代原来的紫色或深色
$bg-gradient-start: #F5F9FF;
$bg-gradient-end: #FFFFFF;
$text-primary: #1D1D1F;
$text-secondary: #86868B;
$card-bg: rgba(255, 255, 255, 0.8);
$card-border: rgba(255, 255, 255, 0.6);
$shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.04);
$shadow-hover: 0 12px 24px rgba(0, 122, 255, 0.12);

.welcome-container {
    position: relative;
    width: 100%;
    height: 100%; // 强制高度为100%
    display: flex;
    justify-content: center;
    align-items: center; // 垂直居中
    padding: 0; // 移除所有 Padding
    overflow: hidden; // 禁止内部滚动
    background: transparent;
  }

// 动态背景
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;

  .circle {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.6;
    animation: float 20s infinite ease-in-out;
  }

  .circle-1 {
    width: 400px;
    height: 400px;
    background: #E0F2FF;
    top: -100px;
    left: -100px;
    animation-delay: 0s;
  }

  .circle-2 {
    width: 300px;
    height: 300px;
    background: #E6FFFA; // 清新绿意
    bottom: -50px;
    right: -50px;
    animation-delay: -5s;
  }
}

.content-wrapper {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transform: scale(0.85) translateY(-20px); // 整体微缩并上移一点，视觉平衡
  transform-origin: center center; // 从中心缩放
  margin: 0 auto; // 水平居中
}

// 入场动画
.animate-entry {
  animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

// 头部区域
.welcome-header {
  text-align: center;
  
  .logo-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px; // 再次缩小
    height: 48px; // 再次缩小
    border-radius: 14px;
    background: linear-gradient(135deg, #007AFF 0%, #00C6FF 100%);
    box-shadow: 0 8px 16px rgba(0, 122, 255, 0.2);
    margin-bottom: 12px; // 再次减小间距
    
    .logo-icon {
      font-size: 24px; // 再次缩小
      color: #fff;
    }
  }

  .title {
    font-size: 28px; // 再次缩小
    font-weight: 700;
    color: $text-primary;
    margin-bottom: 6px; // 再次减小间距
    letter-spacing: -0.5px;
    
    .highlight {
      background: linear-gradient(120deg, #007AFF, #00C6FF);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }

  .subtitle {
    font-size: 14px; // 再次缩小
    color: $text-secondary;
    font-weight: 400;
  }
}

// 功能区域
.features-section {
  .section-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #999;
    letter-spacing: 1px;
    margin-bottom: 10px; // 再次减小间距
    padding-left: 4px;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px; // 再次减小间距
    
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  .feature-card {
    display: flex;
    align-items: center;
    padding: 16px; // 再次减小内边距
    background: $card-bg;
    backdrop-filter: blur(20px);
    border: 1px solid $card-border;
    border-radius: 14px; // 再次减小圆角
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: $shadow-sm;
    position: relative;
    overflow: hidden;

    &:hover {
      transform: translateY(-2px); // 减小悬浮距离
      box-shadow: $shadow-hover;
      border-color: rgba(0, 122, 255, 0.3);

      .card-action {
        opacity: 1;
        transform: translateX(0);
      }
      
      .card-icon-wrapper {
        transform: scale(1.1);
      }
    }

    .card-icon-wrapper {
      width: 42px; // 再次缩小
      height: 42px; // 再次缩小
      border-radius: 10px; // 再次缩小
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 14px; // 再次减小间距
      font-size: 18px; // 再次缩小
      transition: transform 0.3s ease;
      
      &.color-0 { background: rgba(0, 122, 255, 0.1); color: #007AFF; }
      &.color-1 { background: rgba(52, 199, 89, 0.1); color: #34C759; }
      &.color-2 { background: rgba(255, 149, 0, 0.1); color: #FF9500; }
      &.color-3 { background: rgba(88, 86, 214, 0.1); color: #5856D6; } // 虽然叫 D6，但这里可以改为青色
    }
    // 覆盖 color-3 为青色，避免紫色
    .card-icon-wrapper.color-3 {
        background: rgba(0, 199, 190, 0.1); 
        color: #00C7BE;
    }

    .card-content {
      flex: 1;
      
      .card-title {
        font-size: 17px;
        font-weight: 600;
        color: $text-primary;
        margin-bottom: 6px;
      }
      
      .card-desc {
        font-size: 13px;
        color: $text-secondary;
        line-height: 1.4;
      }
    }

    .card-action {
      opacity: 0;
      transform: translateX(-10px);
      transition: all 0.3s ease;
      color: $text-secondary;
    }
  }
}

// 建议区域
.suggestions-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 0 4px;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: $text-primary;
      
      .header-icon {
        color: #007AFF;
      }
    }

    .refresh-btn {
      color: $text-secondary;
      font-weight: 500;
      
      &:hover {
        color: #007AFF;
      }
    }
  }

  .suggestions-list {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    
    .suggestion-pill {
      padding: 10px 20px;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 100px;
      font-size: 13px;
      color: #555;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      animation: fadeInUp 0.5s backwards;
      
      &:hover {
        background: #007AFF;
        color: #fff;
        border-color: #007AFF;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
      }
      
      &:active {
        transform: scale(0.95);
      }
    }
  }
}

// 动画定义
@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: scale(0.85) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(0.85) translateY(-20px);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(20px, -20px);
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(0, 122, 255, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(0, 122, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(0, 122, 255, 0);
  }
}

.pulse-anim {
  animation: pulse 2s infinite;
}

.rotate-anim {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>