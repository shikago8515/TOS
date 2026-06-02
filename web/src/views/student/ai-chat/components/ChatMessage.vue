<template>
  <div class="chat-messages">
    <div
      v-for="(msg, index) in messages"
      :key="index"
      class="message-item"
      :class="msg.role"
    >
      <div v-if="msg.role === 'user'" class="message-content user">
        <div class="bubble user-bubble">
          <div class="markdown-body" v-html="renderAiMarkdown(msg.content)"></div>
        </div>
        <el-avatar :size="36" class="avatar" :style="{ background: userAvatarConfig.color || '#409eff' }">
          <el-icon><UserFilled /></el-icon>
        </el-avatar>
      </div>

      <div v-else class="message-content ai">
        <div class="avatar-wrapper">
          <img v-if="logoUrl" :src="logoUrl" class="ai-avatar-img" alt="AI" />
          <div v-else class="default-ai-avatar">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"
              />
            </svg>
          </div>
        </div>

        <div class="ai-content-wrapper">
          <div v-if="msg.reasoningContent" class="ai-reasoning-section">
            <div class="reasoning-header" @click="toggleReasoning(msg)">
              <div class="reasoning-title">
                <el-icon class="reasoning-icon"><Lightning /></el-icon>
                <span>深度思考过程</span>
                <span v-if="msg.reasoningDuration" class="reasoning-duration">
                  ({{ msg.reasoningDuration }}s)
                </span>
              </div>
              <el-icon class="collapse-icon" :class="{ collapsed: msg.isReasoningCollapsed }">
                <ArrowDown />
              </el-icon>
            </div>

            <el-collapse-transition>
              <div v-show="!msg.isReasoningCollapsed" class="reasoning-content">
                <div class="markdown-body" v-html="renderAiMarkdown(msg.reasoningContent)"></div>
              </div>
            </el-collapse-transition>
          </div>

          <div class="ai-markdown-card">
            <div v-if="msg.loading && !msg.content" class="ai-thinking-container">
              <div class="thinking-animation">
                <div class="thinking-orb"></div>
                <div class="thinking-orb-ring"></div>
              </div>
              <div class="thinking-status">
                <span class="status-text">正在深度思考...</span>
                <span class="status-timer" v-if="msg.timer">{{ msg.timer }}s</span>
              </div>
            </div>

            <div v-else class="markdown-body" v-html="renderAiMarkdown(msg.content)"></div>
            <span v-if="msg.streaming" class="streaming-cursor">|</span>

            <div v-if="!msg.loading && !msg.streaming" class="message-actions">
              <el-button link size="small" @click="$emit('copy-message', msg.content)">
                <el-icon><CopyDocument /></el-icon> 复制
              </el-button>
              <el-button link size="small" @click="$emit('regenerate-message', index)">
                <el-icon><Refresh /></el-icon> 重新生成
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { UserFilled, CopyDocument, Refresh, Lightning, ArrowDown } from '@element-plus/icons-vue'
import { renderAiMarkdown } from '@/utils/aiMarkdown'

defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  userAvatarConfig: {
    type: Object,
    default: () => ({})
  },
  logoUrl: {
    type: String,
    default: 'https://matechat.gitcode.com/logo.svg'
  }
})

defineEmits(['copy-message', 'regenerate-message'])

const toggleReasoning = (msg) => {
  msg.isReasoningCollapsed = !msg.isReasoningCollapsed
}
</script>

<style scoped lang="scss">
.chat-messages {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding-bottom: 28px;
}

.message-item {
  display: flex;
  width: 100%;
  margin-bottom: 32px;
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &.user {
    justify-content: flex-end;
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

.message-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;

  &.user {
    width: auto;
    max-width: min(78%, 860px);
    margin-left: auto;

    .bubble {
      background: linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%);
      color: #1f2937;
      border: 1px solid #e5e7eb;
      border-radius: 22px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
      padding: 14px 20px;

      :deep(.markdown-body) {
        color: #1f2937;
        font-size: 15px;

        p:last-child {
          margin-bottom: 0;
        }
      }
    }

    .avatar {
      margin-top: 0;
      margin-left: 8px;
    }
  }

  &.ai {
    width: 100%;
    max-width: 100%;

    .avatar-wrapper {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      overflow: hidden;
      background: transparent;
      border: 1px solid #e5e7eb;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .default-ai-avatar {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }
    }
  }
}

.ai-content-wrapper {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 52px);
  margin-top: -2px;
}

.ai-markdown-card {
  background: transparent;
  width: 100%;
  padding: 0;
  border: none;
  box-shadow: none;
}

.ai-reasoning-section {
  margin-bottom: 18px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.reasoning-header {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
  border-radius: 999px;
  background: #f6f8fb;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;

  &:hover {
    background: #edf2f7;
    border-color: #dbe4ef;
  }
}

.reasoning-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #4b5563;
}

.reasoning-icon {
  font-size: 14px;
  color: #8b5cf6;
}

.reasoning-duration {
  color: #9ca3af;
  font-size: 12px;
  font-family: monospace;
}

.collapse-icon {
  font-size: 12px;
  color: #9ca3af;
  transition: transform 0.2s ease;

  &.collapsed {
    transform: rotate(-90deg);
  }
}

.reasoning-content {
  margin-top: 10px;
  padding: 14px 18px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 14px;

  :deep(.markdown-body) {
    font-size: 13px;
    line-height: 1.75;
    color: #6b7280;
  }
}

.ai-thinking-container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  margin-bottom: 8px;
}

.thinking-animation {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thinking-orb {
  width: 8px;
  height: 8px;
  background-color: #000;
  border-radius: 50%;
  animation: pulse 1.5s infinite ease-in-out;
  box-shadow: none;
}

.thinking-orb-ring {
  display: none;
}

.thinking-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
  background: none;
  -webkit-text-fill-color: initial;
  animation: none;
}

.status-timer {
  font-family: monospace;
  color: #9ca3af;
  font-size: 12px;
  background: none;
  border: none;
  padding: 0;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.8);
  }

  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.message-actions {
  display: flex;
  gap: 14px;
  margin-top: 14px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-item:hover .message-actions {
  opacity: 1;
}

.streaming-cursor {
  display: inline-block;
  width: 6px;
  height: 16px;
  background: #000;
  margin-left: 4px;
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

:deep(.markdown-body) {
  font-size: 15px;
  line-height: 1.85;
  color: #1f2937;
  word-break: break-word;
  overflow-wrap: anywhere;
}

:deep(.markdown-body p) {
  margin: 0 0 14px;
}

:deep(.markdown-body p:last-child),
:deep(.markdown-body li:last-child),
:deep(.markdown-body blockquote > *:last-child) {
  margin-bottom: 0;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4),
:deep(.markdown-body h5),
:deep(.markdown-body h6) {
  margin-top: 26px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #111827;
  line-height: 1.35;
}

:deep(.markdown-body h1) {
  font-size: 28px;
}

:deep(.markdown-body h2) {
  font-size: 22px;
  padding-bottom: 6px;
  border-bottom: 1px solid #eef2f7;
}

:deep(.markdown-body h3) {
  font-size: 18px;
}

:deep(.markdown-body h4) {
  font-size: 16px;
}

:deep(.markdown-body h5),
:deep(.markdown-body h6) {
  font-size: 15px;
}

:deep(.markdown-body hr) {
  height: 1px;
  margin: 22px 0;
  border: none;
  background: #e5e7eb;
}

:deep(.markdown-body pre) {
  background-color: #0f172a;
  color: #e2e8f0;
  padding: 16px 18px;
  border-radius: 14px;
  overflow-x: auto;
  margin: 18px 0;
}

:deep(.markdown-body code) {
  background-color: #f3f4f6;
  padding: 0.18em 0.5em;
  border-radius: 6px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  color: #be123c;
}

:deep(.markdown-body pre code) {
  background-color: transparent;
  color: inherit;
  padding: 0;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  padding-left: 22px;
  margin: 14px 0;
}

:deep(.markdown-body li) {
  margin: 8px 0;
  padding-left: 2px;
}

:deep(.markdown-body table) {
  width: 100%;
  margin: 18px 0;
  border-collapse: collapse;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  table-layout: fixed;
}

:deep(.markdown-body thead tr) {
  background: #f8fafc;
}

:deep(.markdown-body th),
:deep(.markdown-body td) {
  padding: 10px 12px;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: top;
  word-break: break-word;
}

:deep(.markdown-body th:last-child),
:deep(.markdown-body td:last-child) {
  border-right: none;
}

:deep(.markdown-body tbody tr:last-child td) {
  border-bottom: none;
}

:deep(.markdown-body blockquote) {
  border-left: 4px solid #cbd5e1;
  background: #f8fafc;
  padding: 12px 16px;
  color: #475569;
  margin: 18px 0;
  border-radius: 0 12px 12px 0;
  font-style: normal;
}

:deep(.markdown-body strong) {
  color: #111827;
  font-weight: 600;
}

:deep(.markdown-body a) {
  color: #2563eb;
  text-decoration: none;
  text-underline-offset: 3px;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .chat-messages {
    max-width: 100%;
  }

  .message-item {
    margin-bottom: 24px;
  }

  .message-content {
    gap: 12px;

    &.user {
      max-width: 92%;
    }

    &.ai {
      .avatar-wrapper {
        width: 32px;
        height: 32px;
      }
    }
  }

  .ai-content-wrapper {
    max-width: calc(100% - 44px);
  }

  .reasoning-content {
    padding: 12px 14px;
  }

  :deep(.markdown-body) {
    font-size: 14px;
    line-height: 1.8;
  }

  :deep(.markdown-body h1) {
    font-size: 24px;
  }

  :deep(.markdown-body h2) {
    font-size: 20px;
  }

  :deep(.markdown-body h3) {
    font-size: 17px;
  }

  :deep(.markdown-body table) {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
