<template>
  <div class="ai-chat-page">
    <div class="chat-container">
      <div class="page-header">
        <div class="left">
          <el-button text size="small" class="header-btn" @click="showHistory = true">
            <el-icon><Clock /></el-icon>
            <span>历史记录</span>
          </el-button>
        </div>
        <div class="right">
          <el-button text size="small" class="header-btn" @click="handleViewBalance">
            <span>查看余额</span>
          </el-button>
          <el-button text size="small" class="header-btn" @click="handleNewChat">
            <el-icon><Plus /></el-icon>
            <span>新对话</span>
          </el-button>
        </div>
      </div>

      <WelcomePage
        v-if="showWelcome"
        :userName="userInfo.realName"
        :prompts="suggestedPrompts"
        :featureCards="featureCards"
        @feature-click="handleFeatureClick"
        @prompt-click="handlePromptClick"
        @refresh-prompts="refreshPrompts"
        class="welcome-wrapper"
      />

      <div v-else class="chat-content custom-scrollbar" ref="chatContentRef">
        <ChatMessage
          v-if="messages.length > 0"
          :messages="messages"
          :userAvatarConfig="{ color: '#007AFF' }"
          :userAvatar="userInfo.avatar"
          logoUrl=""
          @copy-message="handleCopyMessage"
          @regenerate-message="handleRegenerateMessage"
        />
      </div>

      <div class="input-area">
        <ChatInput
          v-model="userInput"
          v-model:selectedModel="selectedModel"
          :availableModels="availableModels"
          :disabled="isLoading"
          :is-generating="isLoading"
          :uploadedFiles="uploadedFiles"
          @update:uploadedFiles="uploadedFiles = $event"
          @send="handleSendMessage"
          @stop="handleStopGenerate"
          @remove-file="handleRemoveFile"
          @show-history="showHistory = true"
          @new-chat="handleNewChat"
        />
      </div>
    </div>

    <ChatHistory
      v-model="showHistory"
      :historyList="sessionList"
      :currentId="currentSessionId"
      :loading="historyLoading"
      @select="handleLoadSession"
      @delete="handleDeleteSession"
      @clear-all="handleClearAllSessions"
      @new-chat="handleNewChat"
    />

    <el-dialog v-model="balanceDialogVisible" title="大模型账户余额 (DeepSeek)" width="520px" class="balance-custom-dialog" destroy-on-close>
      <div v-loading="balanceLoading" class="balance-dialog-content">
        <div class="balance-header" :class="[balanceAvailable ? 'status-ok' : 'status-err']">
          <el-icon class="status-icon"><component :is="balanceAvailable ? 'CircleCheckFilled' : 'Warning'" /></el-icon>
          <div class="status-text">
            <h4>{{ balanceAvailable ? '账户服务正常' : '账户不可用或已欠费' }}</h4>
            <p>{{ balanceAvailable ? '当前 API 接口可正常调用生成内容' : '请联系相关管理员充值或检查 API 配置' }}</p>
          </div>
        </div>
        
        <el-divider border-style="dashed" />

        <el-empty v-if="balanceInfo.length === 0" description="暂无余额明细数据" :image-size="60" />
        
        <div v-else class="balance-list">
          <div v-for="(item, index) in balanceInfo" :key="index" class="balance-card">
            <div class="card-title">
              <el-icon><Wallet /></el-icon>
              <span>资产账户 {{ index + 1 }}</span>
            </div>
            <div class="card-grid">
              <div v-for="(value, key) in item" :key="key" class="grid-item">
                <div class="item-label">{{ translateBalanceKey(key) }}</div>
                <div class="item-value" :class="{'is-currency': key === 'currency', 'is-amount': key !== 'currency'}">
                  {{ value }} <span v-if="key !== 'currency'" class="unit"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="balanceDialogVisible = false">关闭窗口</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, markRaw } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useClipboard } from '@vueuse/core'
import { DataAnalysis, EditPen, Reading, Collection, Clock, Plus, CircleCheckFilled, Warning, Wallet } from '@element-plus/icons-vue'
import {
  sendChatMessageStream,
  getChatSessions,
  getChatSessionDetail,
  deleteChatSession,
  clearAllSessions,
  getAiChatConfig,
  getAiBalance
} from '@/api/training/ai'
import { getAuthSession } from '@/utils/authStorage'

import WelcomePage from './components/WelcomePage.vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import ChatHistory from './components/ChatHistory.vue'

const teacherSession = getAuthSession('TEACHER') || {}
const userInfo = ref({
  realName: localStorage.getItem('realName') || '教师',
  avatar: teacherSession.avatar || ''
})

const featureCards = [
  {
    title: '教学分析',
    desc: '多维度分析学生实训数据',
    icon: markRaw(DataAnalysis),
    color: '#e1f3d8'
  },
  {
    title: '作业批改',
    desc: '智能辅助批改代码作业',
    icon: markRaw(EditPen),
    color: '#d9ecff'
  },
  {
    title: '案例设计',
    desc: '生成实训案例与教学资源',
    icon: markRaw(Reading),
    color: '#fde2e2'
  },
  {
    title: '知识库',
    desc: '管理课程资料与文档',
    icon: markRaw(Collection),
    color: '#faecd8'
  }
]

const showWelcome = ref(true)
const messages = ref([])
const userInput = ref('')
const isLoading = ref(false)
const showHistory = ref(false)
const uploadedFiles = ref([])
const chatContentRef = ref(null)
const abortController = ref(null)
const streamingMessageIndex = ref(-1)
const isManualStop = ref(false)

const currentSessionId = ref(null)
const sessionList = ref([])
const historyLoading = ref(false)
const timerInterval = ref(null)
const suggestedPrompts = ref([])

const availableModels = ref(['deepseek-v4-flash', 'deepseek-v4-pro'])
const selectedModel = ref('deepseek-v4-flash')
const balanceDialogVisible = ref(false)
const balanceLoading = ref(false)
const balanceAvailable = ref(false)
const balanceInfo = ref([])

const translateBalanceKey = (key) => {
  const dict = {
    'currency': '结算货币',
    'total_balance': '总余额',
    'granted_balance': '赠送余额',
    'topped_up_balance': '充值余额'
  }
  return dict[key] || key
}

const allPrompts = [
  {
    label: '生成物理教案+试讲稿',
    content: '我需要生成高中物理教案和10分钟试讲逐字稿。请告诉我你想设计哪一章节哪一小节的教案？（例如：第四章 牛顿运动定律 第2节）',
    sessionType: 'physics_lesson'
  },
  { label: '设计Java多线程案例', content: '请帮我设计一个关于Java多线程的实训案例，包含需求分析、任务分解、核心代码片段和考核点。' },
  { label: '分析班级成绩分布', content: '请分析最近一次实训任务的学生成绩分布情况，指出高频错误点，并给出针对性的教学补救建议。' },
  { label: '生成Spring Boot面试题', content: '请生成5道关于Spring Boot核心原理的面试题，包含参考答案和解析，用于课堂测验。' },
  { label: '代码评审与优化', content: '我将上传一段学生提交的Java代码，请帮我进行代码评审，重点检查异常处理、并发安全和代码规范，并给出优化建议。' },
  { label: '设计电商数据库', content: '请帮我生成一个B2C电商系统的数据库设计方案，包含用户、商品、订单模块的ER图描述和关键建表语句。' },
  { label: '解释Vue3响应式原理', content: '请用通俗易懂的语言解释Vue 3的响应式原理（Proxy），并对比Vue 2的Object.defineProperty，适合给学生讲解。' },
  { label: '生成SQL练习题', content: '请生成3道中等难度的SQL查询练习题，基于学生选课系统（学生、课程、成绩表），并提供参考SQL。' },
  { label: 'Docker部署方案', content: '请给出一个基于Docker Compose的微服务部署方案，包含Spring Boot后端、Vue前端和MySQL数据库的配置示例。' },
  { label: '微服务架构讲解', content: '请设计一个关于微服务架构（Spring Cloud）的教学大纲，涵盖服务注册发现、配置中心、网关和熔断降级。' },
  { label: 'Git分支管理规范', content: '请制定一套适合20人团队的Git分支管理规范（Git Flow），包含分支命名规则、合并流程和Code Review标准。' },
  { label: 'Redis缓存穿透解决方案', content: '请详细解释Redis缓存穿透、击穿和雪崩的概念，并给出相应的解决方案和代码示例。' },
  { label: 'Linux常用运维命令', content: '请列出10个后端开发人员必须掌握的Linux运维命令，并给出实际使用场景和示例。' }
]

const { copy } = useClipboard()

const scrollToBottom = async (force = false) => {
  await nextTick()
  if (!chatContentRef.value) return
  const el = chatContentRef.value
  if (force || el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
    el.scrollTop = el.scrollHeight
  }
}

const startTimer = (msgIndex) => {
  if (timerInterval.value) clearInterval(timerInterval.value)
  messages.value[msgIndex].timer = 0.0
  const startTime = Date.now()

  timerInterval.value = setInterval(() => {
    const now = Date.now()
    messages.value[msgIndex].timer = ((now - startTime) / 1000).toFixed(1)
  }, 100)
}

const clearTimer = () => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
}

const finalizeStreamingState = (stopped = false) => {
  const msgIndex = streamingMessageIndex.value
  if (msgIndex >= 0 && messages.value[msgIndex]) {
    const aiMsg = messages.value[msgIndex]
    aiMsg.loading = false
    aiMsg.streaming = false
    if (aiMsg.timer) {
      aiMsg.reasoningDuration = aiMsg.timer
    }
    if (stopped && !aiMsg.content) {
      aiMsg.content = '[已中断生成]'
    }
  }

  clearTimer()
  isLoading.value = false
  abortController.value = null
  streamingMessageIndex.value = -1
  isManualStop.value = false
}

const applySessionContext = (contextData) => {
  if (!contextData) return
  try {
    const parsed = typeof contextData === 'string' ? JSON.parse(contextData) : contextData
    if (parsed?.selectedModel && availableModels.value.includes(parsed.selectedModel)) {
      selectedModel.value = parsed.selectedModel
    }
  } catch (error) {
    console.warn('解析会话上下文失败:', error)
  }
}

const loadChatRuntimeConfig = async () => {
  try {
    const res = await getAiChatConfig()
    const data = res?.data || {}
    availableModels.value = Array.isArray(data.availableModels) && data.availableModels.length > 0
      ? data.availableModels
      : ['deepseek-v4-flash', 'deepseek-v4-pro']

    if (availableModels.value.includes(data.defaultModel)) {
      selectedModel.value = data.defaultModel
    } else if (!availableModels.value.includes(selectedModel.value)) {
      selectedModel.value = availableModels.value[0]
    }
  } catch (error) {
    console.error('加载聊天配置失败:', error)
  }
}

const handleViewBalance = async () => {
  balanceDialogVisible.value = true
  balanceLoading.value = true
  try {
    const res = await getAiBalance()
    balanceAvailable.value = !!res?.data?.is_available
    balanceInfo.value = Array.isArray(res?.data?.balance_infos) ? res.data.balance_infos : []
  } catch (error) {
    balanceAvailable.value = false
    balanceInfo.value = []
    ElMessage.error('查询余额失败')
  } finally {
    balanceLoading.value = false
  }
}

const handleStopGenerate = () => {
  if (!isLoading.value || !abortController.value) return
  isManualStop.value = true
  abortController.value()
  finalizeStreamingState(true)
}

const handleSendMessage = async (content, customSessionType = null) => {
  if (!content.trim() || isLoading.value) return

  if (showWelcome.value) {
    showWelcome.value = false
  }

  messages.value.push({
    role: 'user',
    content
  })

  userInput.value = ''
  isLoading.value = true
  scrollToBottom(true)

  const aiMessageIndex = messages.value.length
  messages.value.push({
    role: 'assistant',
    content: '',
    reasoningContent: '',
    isReasoningCollapsed: false,
    reasoningDuration: null,
    loading: true,
    streaming: false,
    timer: 0
  })
  streamingMessageIndex.value = aiMessageIndex
  isManualStop.value = false

  startTimer(aiMessageIndex)

  try {
    const params = {
      prompt: content,
      sessionId: currentSessionId.value,
      sessionType: customSessionType || 'general',
      contextData: null,
      modelName: selectedModel.value
    }

    abortController.value = sendChatMessageStream(
      params,
      (data) => {
        const aiMsg = messages.value[aiMessageIndex]
        if (!aiMsg) return

        if (!aiMsg.streaming) {
          aiMsg.streaming = true
        }

        if (data.content) {
          aiMsg.content += data.content
        }

        if (data.reasoning) {
          aiMsg.reasoningContent = (aiMsg.reasoningContent || '') + data.reasoning
        }

        if (data.reasoningDone && !aiMsg.reasoningDuration) {
          aiMsg.reasoningDuration = aiMsg.timer
        }

        if (data.sessionId && !currentSessionId.value) {
          currentSessionId.value = data.sessionId
          loadSessionList()
        }

        scrollToBottom()
      },
      () => {
        finalizeStreamingState(false)
        if (!currentSessionId.value) {
          loadSessionList()
        }
      },
      (error) => {
        if (isManualStop.value) {
          finalizeStreamingState(true)
          return
        }
        console.error('发送失败:', error)
        const aiMsg = messages.value[aiMessageIndex]
        if (aiMsg) {
          aiMsg.content += '\n[发送失败，请重试]'
        }
        finalizeStreamingState(false)
      }
    )
  } catch (error) {
    const aiMsg = messages.value[aiMessageIndex]
    aiMsg.content = '抱歉，我遇到了一些问题，请稍后再试。'
    aiMsg.loading = false
    aiMsg.error = true
    finalizeStreamingState(false)
  }
}

const handleNewChat = () => {
  if (abortController.value) {
    isManualStop.value = true
    abortController.value()
  }
  finalizeStreamingState(false)
  currentSessionId.value = null
  messages.value = []
  showWelcome.value = true
  userInput.value = ''
}

const loadSessionList = async () => {
  historyLoading.value = true
  try {
    const res = await getChatSessions()
    sessionList.value = res.data || []
  } catch (error) {
    ElMessage.error('加载历史记录失败')
  } finally {
    historyLoading.value = false
  }
}

const handleLoadSession = async (session) => {
  currentSessionId.value = session.id
  showHistory.value = false
  showWelcome.value = false
  isLoading.value = true
  applySessionContext(session.contextData)

  try {
    const res = await getChatSessionDetail(session.id)
    messages.value = (res.data.messages || []).map((msg) => ({
      role: msg.role,
      content: msg.content,
      reasoningContent: msg.reasoningContent || msg.reasoning || '',
      reasoningDuration: msg.reasoningDuration || null,
      isReasoningCollapsed: true,
      createTime: msg.createTime
    }))
    applySessionContext(res?.data?.session?.contextData)
    scrollToBottom(true)
  } catch (error) {
    ElMessage.error('加载会话详情失败')
  } finally {
    isLoading.value = false
  }
}

const handleDeleteSession = async (id) => {
  try {
    await deleteChatSession(id)
    ElMessage.success('删除成功')
    if (currentSessionId.value === id) {
      handleNewChat()
    }
    loadSessionList()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

const handleClearAllSessions = () => {
  ElMessageBox.confirm('确定要清空所有历史记录吗？', '提示', {
    type: 'warning'
  }).then(async () => {
    try {
      await clearAllSessions()
      ElMessage.success('清空成功')
      handleNewChat()
      loadSessionList()
    } catch (error) {
      ElMessage.error('清空失败')
    }
  })
}

const handleCopyMessage = (content) => {
  copy(content)
  ElMessage.success('已复制到剪贴板')
}

const handleRegenerateMessage = (index) => {
  const lastUserMessage = messages.value[index - 1]
  if (lastUserMessage && lastUserMessage.role === 'user') {
    messages.value.splice(index, 1)
    handleSendMessage(lastUserMessage.content)
  }
}

const handleFeatureClick = (feature) => {
  handleSendMessage(`请帮我进行${feature.title}，${feature.desc}`)
}

const handlePromptClick = (prompt) => {
  handleSendMessage(prompt.content, prompt.sessionType)
}

const refreshPrompts = () => {
  const shuffled = [...allPrompts].sort(() => 0.5 - Math.random())
  suggestedPrompts.value = shuffled.slice(0, 4)
}

const handleRemoveFile = (index) => {
  uploadedFiles.value.splice(index, 1)
}

onMounted(() => {
  loadChatRuntimeConfig()
  refreshPrompts()
  loadSessionList()
})
</script>

<style scoped lang="scss">
.ai-chat-page {
  height: 100%;
  display: flex;
  background: #fcfcfc;
  position: relative;
  overflow: hidden;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background: linear-gradient(180deg, #F5F9FF 0%, #FFFFFF 100%);
}

.page-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  pointer-events: none;

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .model-select {
    pointer-events: auto;
    width: 190px;
  }

  .header-btn {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #606266;
    height: 28px;
    padding: 0 8px;
    border-radius: 6px;

    &:hover {
      color: #409eff;
      background: rgba(64, 158, 255, 0.08);
    }

    :deep(.el-icon) {
      font-size: 14px;
      margin: 0;
    }
  }
}

.welcome-wrapper {
  flex: 1;
  overflow: hidden;
  padding-bottom: 0;
  display: flex;
  flex-direction: column;
}

.chat-content {
  flex: 1;
  overflow-y: auto;
  padding: 60px 20px 140px;
}

.input-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: linear-gradient(180deg, rgba(255,255,255,0) 0%, #FFFFFF 40%);
  padding-bottom: 30px;

  :deep(.chat-input-container) {
    pointer-events: auto;
  }
}

:deep(.balance-custom-dialog) {
  border-radius: 12px;
  overflow: hidden;
  
  .el-dialog__header {
    background: #f8fafc;
    margin-right: 0;
    border-bottom: 1px solid #f1f5f9;
    padding: 16px 20px;
    
    .el-dialog__title {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }
  }
  
  .el-dialog__body {
    padding: 20px;
  }
}

.balance-dialog-content {
  .balance-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    border-radius: 8px;
    
    &.status-ok {
      background: #f0fdf4;
      border: 1px solid #dcfce7;
      .status-icon { color: #22c55e; }
    }
    
    &.status-err {
      background: #fef2f2;
      border: 1px solid #fee2e2;
      .status-icon { color: #ef4444; }
    }
    
    .status-icon {
      font-size: 24px;
      margin-top: 2px;
    }
    
    .status-text {
      h4 {
        margin: 0 0 6px 0;
        font-size: 15px;
        font-weight: 600;
        color: #1e293b;
      }
      p {
        margin: 0;
        font-size: 13px;
        color: #64748b;
        line-height: 1.5;
      }
    }
  }
  
  .balance-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 16px;
    
    .balance-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      
      .card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
        margin-bottom: 16px;
        
        .el-icon {
          color: #3b82f6;
          font-size: 16px;
        }
      }
      
      .card-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        background: #f8fafc;
        padding: 16px;
        border-radius: 8px;
        
        .grid-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          
          .item-label {
            font-size: 12px;
            color: #64748b;
          }
          
          .item-value {
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
            
            &.is-currency {
              color: #3b82f6;
              font-size: 15px;
            }
            
            &.is-amount {
              font-family: Monaco, monospace;
              letter-spacing: -0.5px;
            }
            
            .unit {
              font-size: 12px;
              color: #94a3b8;
              font-weight: normal;
              margin-left: 2px;
            }
          }
        }
      }
    }
  }
}
</style>
