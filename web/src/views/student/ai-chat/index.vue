<template>
  <div class="ai-chat-container">
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
        <el-button text size="small" class="header-btn" @click="startNewChat">
          <el-icon><Plus /></el-icon>
          <span>新对话</span>
        </el-button>
      </div>
    </div>

    <div class="chat-content" ref="chatContentRef">
      <div class="content-inner">
        <WelcomePage
          v-if="messages.length === 0"
          @select-suggestion="handleSuggestion"
        />

        <div v-else class="message-list">
          <ChatMessage
            :messages="messages"
            @copy-message="handleCopyMessage"
            @regenerate-message="handleRegenerateMessage"
          />
        </div>
      </div>
    </div>

    <div class="input-area-wrapper">
      <ChatInput
        v-model="inputMessage"
        v-model:selectedModel="selectedModel"
        :availableModels="availableModels"
        v-model:uploadedFiles="uploadedFiles"
        :disabled="loading"
        :is-generating="loading"
        @send="sendMessage"
        @stop="handleStopGenerate"
        @show-history="showHistory = true"
        @new-chat="startNewChat"
        @remove-file="removeFile"
      />
      <div class="footer-tip">AI 生成内容仅供参考，请结合课程要求自行判断。</div>
    </div>

    <ChatHistory
      v-model:visible="showHistory"
      :sessions="sessions"
      :current-session-id="currentSessionId"
      :loading="historyLoading"
      @select="switchSession"
      @delete="deleteSession"
      @new-chat="startNewChat"
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
import { ref, onMounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Clock, CircleCheckFilled, Warning, Wallet } from '@element-plus/icons-vue'
import ChatInput from './components/ChatInput.vue'
import ChatMessage from './components/ChatMessage.vue'
import WelcomePage from './components/WelcomePage.vue'
import ChatHistory from './components/ChatHistory.vue'
import {
  getChatSessions,
  getChatSessionDetail,
  sendChatMessageStream,
  deleteChatSession,
  getAiChatConfig,
  getAiBalance
} from '@/api/training/ai'

const inputMessage = ref('')
const messages = ref([])
const loading = ref(false)
const showHistory = ref(false)
const sessions = ref([])
const currentSessionId = ref(null)
const historyLoading = ref(false)
const uploadedFiles = ref([])
const chatContentRef = ref(null)
const abortController = ref(null)
const isManualStop = ref(false)
const streamingMessageIndex = ref(-1)
const timerInterval = ref(null)
const sessionMessagesCache = ref(new Map())
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

const scrollToBottom = async (force = false) => {
  await nextTick()
  if (!chatContentRef.value) return
  const el = chatContentRef.value
  if (force || el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
    el.scrollTop = el.scrollHeight
  }
}

watch(() => messages.value.length, () => scrollToBottom(true))

const loadChatRuntimeConfig = async () => {
  try {
    const res = await getAiChatConfig()
    const data = res?.data || {}
    availableModels.value = Array.isArray(data.availableModels) && data.availableModels.length > 0
      ? data.availableModels
      : ['deepseek-v4-flash', 'deepseek-v4-pro']
    if (availableModels.value.includes(data.defaultModel)) {
      selectedModel.value = data.defaultModel
    }
  } catch (error) {
    console.error('加载聊天配置失败:', error)
  }
}

const loadSessions = async () => {
  historyLoading.value = true
  try {
    const res = await getChatSessions()
    if (res.code === 200) {
      sessions.value = res.data || []
    }
  } catch (error) {
    console.error('加载会话列表失败:', error)
  } finally {
    historyLoading.value = false
  }
}

const applySessionContext = (session) => {
  const contextData = session?.contextData
  if (!contextData) return
  try {
    const parsed = JSON.parse(contextData)
    if (parsed?.selectedModel && availableModels.value.includes(parsed.selectedModel)) {
      selectedModel.value = parsed.selectedModel
    }
  } catch (error) {
    console.warn('解析会话上下文失败:', error)
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

const switchSession = async (session) => {
  if (currentSessionId.value) {
    sessionMessagesCache.value.set(currentSessionId.value, [...messages.value])
  }

  if (abortController.value) {
    isManualStop.value = true
    abortController.value()
    finalizeStreamingState(false)
  }

  currentSessionId.value = session.id
  applySessionContext(session)

  if (sessionMessagesCache.value.has(session.id)) {
    messages.value = sessionMessagesCache.value.get(session.id)
    scrollToBottom(true)
  } else {
    await loadMessages(session.id)
  }
}

const loadMessages = async (sessionId) => {
  loading.value = true
  try {
    const res = await getChatSessionDetail(sessionId)
    if (res.code === 200) {
      const loadedMessages = (res.data.messages || []).map((msg) => ({
        role: msg.role,
        content: msg.content,
        createTime: msg.createTime,
        reasoningContent: msg.reasoning,
        reasoningDuration: msg.reasoningDuration,
        citations: msg.citations ? JSON.parse(msg.citations) : []
      }))
      messages.value = loadedMessages
      applySessionContext(res.data.session)
      sessionMessagesCache.value.set(sessionId, [...loadedMessages])
      scrollToBottom(true)
    }
  } catch (error) {
    ElMessage.error('加载消息失败')
  } finally {
    loading.value = false
  }
}

const startNewChat = () => {
  if (currentSessionId.value) {
    sessionMessagesCache.value.set(currentSessionId.value, [...messages.value])
  }
  if (abortController.value) {
    isManualStop.value = true
    abortController.value()
    finalizeStreamingState(false)
  }
  currentSessionId.value = null
  messages.value = []
  inputMessage.value = ''
  uploadedFiles.value = []
}

const handleSuggestion = (prompt) => {
  inputMessage.value = prompt
  sendMessage()
}

const removeFile = (index) => {
  uploadedFiles.value.splice(index, 1)
}

const handleCopyMessage = async (content) => {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('复制成功')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const handleRegenerateMessage = async (index) => {
  let userMsgIndex = -1
  for (let i = index - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      userMsgIndex = i
      break
    }
  }
  if (userMsgIndex === -1) return

  const userMsg = messages.value[userMsgIndex].content
  messages.value.splice(index)
  inputMessage.value = userMsg
  messages.value.splice(userMsgIndex, 1)
  await sendMessage()
}

const finalizeStreamingState = (stopped = false) => {
  const msgIndex = streamingMessageIndex.value
  if (msgIndex >= 0 && messages.value[msgIndex]) {
    const aiMsg = messages.value[msgIndex]
    aiMsg.loading = false
    aiMsg.streaming = false
    if (!aiMsg.reasoningDuration && aiMsg.reasoningContent) {
      aiMsg.reasoningDuration = aiMsg.timer
    }
    if (stopped && !aiMsg.content) {
      aiMsg.content = '[已中断生成]'
    }
  }

  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
  loading.value = false
  abortController.value = null
  streamingMessageIndex.value = -1
  isManualStop.value = false

  if (currentSessionId.value) {
    sessionMessagesCache.value.set(currentSessionId.value, [...messages.value])
  }
}

const handleStopGenerate = () => {
  if (!loading.value || !abortController.value) return
  isManualStop.value = true
  abortController.value()
  finalizeStreamingState(true)
}

const sendMessage = async () => {
  if (!inputMessage.value.trim() && uploadedFiles.value.length === 0) return

  const userMsg = inputMessage.value
  messages.value.push({
    role: 'user',
    content: userMsg,
    createTime: new Date()
  })

  inputMessage.value = ''
  uploadedFiles.value = []
  loading.value = true
  scrollToBottom(true)

  messages.value.push({
    role: 'assistant',
    content: '',
    reasoningContent: '',
    createTime: new Date(),
    loading: true,
    streaming: false,
    timer: 0,
    reasoningDuration: 0,
    isReasoningCollapsed: false
  })
  const aiMsgIndex = messages.value.length - 1
  const aiMsg = messages.value[aiMsgIndex]
  streamingMessageIndex.value = aiMsgIndex
  isManualStop.value = false

  if (timerInterval.value) clearInterval(timerInterval.value)
  const startTime = Date.now()
  timerInterval.value = setInterval(() => {
    aiMsg.timer = ((Date.now() - startTime) / 1000).toFixed(1)
  }, 100)

  try {
    const params = {
      prompt: userMsg,
      sessionId: currentSessionId.value,
      sessionType: 'education',
      contextData: null,
      modelName: selectedModel.value
    }

    abortController.value = sendChatMessageStream(
      params,
      (data) => {
        if (!aiMsg.streaming) {
          aiMsg.streaming = true
        }

        if (data.reasoning) {
          aiMsg.reasoningContent = (aiMsg.reasoningContent || '') + data.reasoning
        }
        if (data.content) {
          aiMsg.content += data.content
        }
        if (data.reasoningDone && !aiMsg.reasoningDuration) {
          aiMsg.reasoningDuration = aiMsg.timer
        }
        if (data.sessionId && !currentSessionId.value) {
          currentSessionId.value = data.sessionId
          sessionMessagesCache.value.set(data.sessionId, [...messages.value])
          loadSessions()
        }
        if (currentSessionId.value) {
          sessionMessagesCache.value.set(currentSessionId.value, [...messages.value])
        }
        scrollToBottom()
      },
      () => {
        finalizeStreamingState(false)
      },
      (error) => {
        if (isManualStop.value) {
          finalizeStreamingState(true)
          return
        }
        console.error('发送失败:', error)
        aiMsg.content += '\n[发送失败，请重试]'
        finalizeStreamingState(false)
      }
    )
  } catch (error) {
    console.error('发送请求异常:', error)
    aiMsg.content = '发送请求异常'
    finalizeStreamingState(false)
  }
}

const deleteSession = async (id) => {
  try {
    const res = await deleteChatSession(id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      sessionMessagesCache.value.delete(id)
      if (currentSessionId.value === id) {
        startNewChat()
      }
      loadSessions()
    }
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

onMounted(() => {
  loadChatRuntimeConfig()
  loadSessions()
})
</script>

<style scoped lang="scss">
.ai-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #ffffff;
  position: relative;

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

    .left, .right {
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

  .chat-content {
    flex: 1;
    overflow-y: auto;
    padding: 60px 20px 20px;
    scroll-behavior: smooth;

    .content-inner {
      max-width: 1120px;
      margin: 0 auto;
      height: 100%;
    }

    .message-list {
      padding-bottom: 20px;
    }
  }

  .input-area-wrapper {
    background: linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 20%);
    padding: 0 20px 20px;

    .footer-tip {
      text-align: center;
      font-size: 12px;
      color: #909399;
      margin-top: 8px;
    }
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
