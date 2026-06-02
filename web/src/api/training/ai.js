import { request } from '@/utils/request'
import { getAuthRole, getAuthToken, getAuthUserId } from '@/utils/authStorage'

/**
 * AI 智能助手 API
 * 对应后端: com.canteen.cloud.ai.controller.AiChatController & RagKnowledgeController
 */

const BASE_URL = '/ai'
const RAG_BASE_URL = '/ai/rag'

// ============ AI 聊天接口 ============

/**
 * 发送聊天消息 (流式)
 * @param {Object} params - 请求参数
 * @param {string} params.prompt - 用户问题
 * @param {number} [params.sessionId] - 会话ID
 * @param {string} [params.sessionType] - 会话类型
 * @param {Object} [params.contextData] - 上下文数据
 * @param {Function} onMessage - 收到消息回调 (text, isReasoning)
 * @param {Function} onComplete - 完成回调
 * @param {Function} onError - 错误回调
 * @returns {Function} abort - 取消请求函数
 */
export function sendChatMessageStream(params, onMessage, onComplete, onError) {
  const controller = new AbortController()
  const signal = controller.signal

  const token = getAuthToken()
  const userId = getAuthUserId()
  const userType = localStorage.getItem('userType') || getAuthRole() || localStorage.getItem('roleName') || 'STUDENT' // 默认为学生

  // 使用 fetch 处理 SSE 流式响应
  fetch(`${BASE_URL}/admin-assistant/chat`, {
    method: 'POST',
    headers: {
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'userId': userId || '',
      'userType': userType
    },
    body: JSON.stringify({
      prompt: params.prompt,
      sessionId: params.sessionId,
      sessionType: params.sessionType || 'general',
      contextData: params.contextData ? JSON.stringify(params.contextData) : null,
      modelName: params.modelName || null
    }),
    signal
  }).then(async response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop()

      for (const block of blocks) {
        // SSE 规范：以换行符分隔的块
        const eventLines = block.split('\n')
        if (eventLines.length === 0) continue

        let eventName = ''
        const dataLines = []

        for (const l of eventLines) {
           // 处理 event 字段
          if (l.startsWith('event:')) {
            eventName = l.substring(6).trim()
          } 
          // 处理 data 字段
          else if (l.startsWith('data:')) {
            let dataContent = l.substring(5)
            // 根据 SSE 规范，如果 data: 后紧跟一个空格，则移除该空格
            if (dataContent.startsWith(' ')) {
              dataContent = dataContent.substring(1)
            }
            dataLines.push(dataContent)
          }
        }
        
        // 如果没有数据行且没有事件名，跳过（可能是空行）
        if (dataLines.length === 0 && !eventName) continue

        // 合并数据行（SSE规范：多行data使用换行符连接）
        // 注意：这里绝不能使用 trim()，否则会丢失 markdown 格式中的缩进和换行
        const dataStr = dataLines.join('\n')
        
        // 特殊处理 done 事件
        if (eventName === 'done' || dataStr === '[DONE]') {
          onComplete && onComplete()
          return
        }

        if (eventName === 'sessionId') {
          const sid = Number(dataStr)
          onMessage && onMessage({ sessionId: Number.isNaN(sid) ? dataStr : sid })
          continue
        }

        if (eventName === 'reasoning') {
          onMessage && onMessage({ reasoning: dataStr })
          continue
        }

        if (eventName === 'reasoning_end') {
          onMessage && onMessage({ reasoningDone: true })
          continue
        }

        if (eventName === 'message') {
          onMessage && onMessage({ content: dataStr })
          continue
        }

        if (eventName === 'error') {
          onError && onError(new Error(dataStr))
          return
        }

        if (dataStr.startsWith('{') || dataStr.startsWith('[')) {
          try {
            const json = JSON.parse(dataStr)
            onMessage && onMessage(json)
            continue
          } catch (e) {
            console.warn('解析SSE JSON失败:', e)
          }
        }

        onMessage && onMessage({ content: dataStr })
      }
    }

    onComplete && onComplete()
  }).catch(error => {
    if (error.name === 'AbortError') {
      console.log('请求已取消')
    } else {
      onError && onError(error)
    }
  })

  return () => controller.abort()
}

/**
 * 创建新的聊天会话
 */
export function createChatSession(title) {
  // 假设后端有创建会话接口，如果没有，可以移除此方法，在前端生成临时ID或由后端在第一条消息时返回ID
  const userType = localStorage.getItem('userType') || getAuthRole() || localStorage.getItem('roleName') || 'STUDENT'
  return request.post(
    `${BASE_URL}/sessions/create`,
    {
      userType,
      sessionTitle: title,
      sessionType: 'general'
    },
    {
      baseURL: '',
      headers: {
        userType
      }
    }
  )
}

/**
 * 获取聊天会话列表
 */
export function getChatSessions() {
  const userType = localStorage.getItem('userType') || getAuthRole() || localStorage.getItem('roleName') || 'STUDENT'
  return request.get(`${BASE_URL}/sessions/list`, {
    baseURL: '',
    params: {
      userType
    }
  })
}

export function getAiChatConfig() {
  return request.get(`${BASE_URL}/config`, { baseURL: '' })
}

export function getAiBalance() {
  return request.get(`${BASE_URL}/balance`, { baseURL: '' })
}

/**
 * 获取会话详情
 */
export function getChatSessionDetail(sessionId) {
  return request.get(`${BASE_URL}/sessions/${sessionId}`, { baseURL: '' })
}

/**
 * 删除聊天会话
 */
export function deleteChatSession(sessionId) {
  return request.delete(`${BASE_URL}/sessions/${sessionId}`, { baseURL: '' })
}

/**
 * 清空所有会话
 */
export function clearAllSessions() {
  return getChatSessions().then(async (res) => {
    const sessions = res?.data || []
    await Promise.all(
      sessions.map((s) => deleteChatSession(s.id).catch(() => null))
    )
    return { code: 200, message: '操作成功', data: null }
  })
}

// ============ RAG 知识库接口 (仅教师端使用) ============

/**
 * 获取知识库列表
 */
export function getKnowledgeList(params) {
  const query = {
    knowledgeType: params?.knowledgeType || params?.type,
    sourceType: params?.sourceType
  }
  return request.get(`${RAG_BASE_URL}/knowledge/list`, { baseURL: '', params: query })
}

/**
 * 分页获取知识库列表
 */
export function getKnowledgePage(params) {
  return request.get(`${RAG_BASE_URL}/knowledge/page`, { 
    baseURL: '', 
    params: {
      pageNum: params?.pageNum || 1,
      pageSize: params?.pageSize || 20,
      knowledgeType: params?.knowledgeType,
      sourceType: params?.sourceType,
      keyword: params?.keyword
    }
  })
}

/**
 * 批量删除知识
 */
export function batchDeleteKnowledge(ids) {
  return request.delete(`${RAG_BASE_URL}/knowledge/batch`, { baseURL: '', data: ids })
}

export function getKnowledgeDetail(knowledgeId) {
  return request.get(`${RAG_BASE_URL}/knowledge/${knowledgeId}`, { baseURL: '' })
}

export function updateKnowledge(knowledgeId, data) {
  return request.put(`${RAG_BASE_URL}/knowledge/${knowledgeId}`, data, { baseURL: '' })
}

/**
 * 上传知识库文档
 */
export function uploadKnowledge(formData, config) {
  return request.upload(`${RAG_BASE_URL}/document/upload`, formData, { baseURL: '', ...(config || {}) })
}

export function getDocumentProgress(documentId) {
  return request.get(`${RAG_BASE_URL}/document/${documentId}/progress`, { baseURL: '' })
}

export function getDocumentList(params) {
  const query = {
    parseStatus: params?.parseStatus
  }
  return request.get(`${RAG_BASE_URL}/document/list`, { baseURL: '', params: query })
}

export function getRagStatistics() {
  return request.get(`${RAG_BASE_URL}/statistics`, { baseURL: '' })
}

export function syncFromDatabase(syncType) {
  return request.post(`${RAG_BASE_URL}/sync/${syncType}`, null, { baseURL: '' })
}

export function indexPendingKnowledge() {
  return request.post(`${RAG_BASE_URL}/index/pending`, null, { baseURL: '' })
}

export function rebuildKnowledgeIndex() {
  return request.post(`${RAG_BASE_URL}/index/rebuild`, null, { baseURL: '' })
}

/**
 * 添加手动知识
 */
export function addManualKnowledge(data) {
  return request.post(`${RAG_BASE_URL}/knowledge/add`, {
    title: data?.title,
    content: data?.content,
    knowledgeType: data?.knowledgeType || data?.type,
    metadata: data?.metadata
  }, { baseURL: '' })
}

/**
 * 删除知识库文档
 */
export function deleteKnowledge(knowledgeId) {
  return request.delete(`${RAG_BASE_URL}/knowledge/${knowledgeId}`)
}

/**
 * 恢复知识库文档
 */
export function restoreKnowledge(knowledgeId) {
  const ids = Array.isArray(knowledgeId) ? knowledgeId : [knowledgeId]
  return request.post(`${RAG_BASE_URL}/recycle/restore`, ids, { baseURL: '' })
}

/**
 * 彻底删除知识库文档
 */
export function hardDeleteKnowledge(knowledgeId) {
  return request.delete(`${RAG_BASE_URL}/knowledge/${knowledgeId}`, { baseURL: '' })
}

export function getRecycleList() {
  return request.get(`${RAG_BASE_URL}/recycle/list`, { baseURL: '' })
}

export function restoreAllKnowledge() {
  return request.post(`${RAG_BASE_URL}/recycle/restore-all`, null, { baseURL: '' })
}

// ============ 工作流 Prompt 智能优化接口 ============

/**
 * AI智能优化教师自定义Prompt
 * 将教师自然语言Prompt转换为包含正确JSON格式约束的标准化Prompt
 * @param {string} agentType - Agent类型（如 GenerationAgent, StructuringAgent 等）
 * @param {string} userPrompt - 教师输入的自然语言Prompt
 * @returns {Promise} 包含 optimizedPrompt 和 tokensUsed
 */
export function optimizePrompt(agentType, userPrompt, options = {}) {
  return request.post('/workflow/prompt/optimize', {
    agentType,
    userPrompt
  }, { timeout: 120000 }) // AI生成需要较长时间，超时设为120秒
}
