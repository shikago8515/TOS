import { ElMessage } from 'element-plus'
import {
  getPendingCases,
  getAllPendingCases,
  approveCase,
  batchApproveCases,
  regenerateCase
} from '@/api/teacher/case'

export function useCreateCaseReview(options) {
  const {
    currentBatchTaskId,
    batchGenerationProgress,
    pendingCases,
    selectedCaseIds,
    studentList,
    showReviewPanel,
    loadingPendingCases,
    regeneratingCaseId
  } = options

  const normalizeId = (value) => {
    if (value === null || value === undefined) {
      return ''
    }
    return String(value)
  }

  const removePendingCaseLocally = (caseId) => {
    const normalizedCaseId = normalizeId(caseId)
    pendingCases.value = pendingCases.value.filter((item) => normalizeId(item.id) !== normalizedCaseId)
  }

  const syncApprovedCaseInProgress = (caseId) => {
    const progress = batchGenerationProgress?.value
    if (!progress || !Array.isArray(progress.studentProgress)) {
      return
    }

    const normalizedCaseId = normalizeId(caseId)
    let updated = false

    const nextRows = progress.studentProgress.map((row) => {
      if (normalizeId(row.caseId) !== normalizedCaseId) {
        return row
      }

      updated = true
      return {
        ...row,
        needsReview: false,
        status: row.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
        currentState: 'COMPLETED',
        progressPercentage: Math.max(Number(row.progressPercentage || 0), 100)
      }
    })

    if (!updated) {
      return
    }

    const reviewingCount = nextRows.filter((row) => !!row.needsReview).length
    const generatedCount = nextRows.filter((row) => String(row.status).toUpperCase() === 'SUCCESS').length
    const failedCount = nextRows.filter((row) => String(row.status).toUpperCase() === 'FAILED').length
    const runningCount = nextRows.filter((row) => String(row.status).toUpperCase() === 'RUNNING' && !row.needsReview).length

    batchGenerationProgress.value = {
      ...progress,
      studentProgress: nextRows,
      reviewingCount,
      generatedCount: Math.max(Number(progress.generatedCount || 0), generatedCount),
      completedCount: Math.max(Number(progress.completedCount || 0), generatedCount),
      failedCount,
      runningCount
    }
  }

  const finalizeApprovedCase = (caseId) => {
    removePendingCaseLocally(caseId)
    syncApprovedCaseInProgress(caseId)

    if (pendingCases.value.length === 0) {
      showReviewPanel.value = false
      ElMessage.success('所有案例审核完成！')
    }
  }

  const loadPendingCases = async (batchTaskId) => {
    const taskId = batchTaskId || currentBatchTaskId.value
    if (!taskId) {
      return
    }

    loadingPendingCases.value = true
    try {
      const res = await getPendingCases(taskId)
      pendingCases.value = res.data || []

      const studentMap = new Map(studentList.value.map(s => [String(s.id), s]))
      pendingCases.value = pendingCases.value.map(c => {
        const backendInfo = c.studentInfo || null
        if (backendInfo && (backendInfo.realName || backendInfo.studentName || backendInfo.studentId || backendInfo.studentNo || backendInfo.avatar)) {
          return c
        }

        const student = studentMap.get(String(c.targetStudentId))
        return {
          ...c,
          studentInfo: student
            ? {
                realName: student.realName || student.nickname || student.username,
                studentId: student.username || '-',
                avatar: student.avatar || ''
              }
            : { realName: '未知学生', studentId: '-', avatar: '' }
        }
      })
    } catch (e) {
      console.error('加载待审核案例失败', e)
      ElMessage.error('加载待审核案例失败')
    } finally {
      loadingPendingCases.value = false
    }
  }

  const refreshPendingCases = async () => {
    loadingPendingCases.value = true
    try {
      const res = await getAllPendingCases()
      if (res.data && res.data.length > 0) {
        pendingCases.value = res.data
      } else {
        pendingCases.value = []
        showReviewPanel.value = false
      }
    } catch (e) {
      console.error('刷新待审核案例失败', e)
    } finally {
      loadingPendingCases.value = false
    }
  }

  const handleSelectionChange = (rows) => {
    selectedCaseIds.value = rows.map(item => item.id)
  }

  const handleApproveCase = async (caseId, publish = false) => {
    try {
      await approveCase(caseId, publish)
      ElMessage.success(publish ? '案例已发布' : '案例已通过审核')
      finalizeApprovedCase(caseId)
      return true
    } catch (e) {
      if (String(e?.message || '').includes('不是待审核状态')) {
        ElMessage.success('案例审核状态已同步')
        finalizeApprovedCase(caseId)
        return true
      }
      console.error('审核案例失败', e)
      ElMessage.error(e?.message || '审核案例失败')
      return false
    }
  }

  const handleApproveBatch = async (publish = false) => {
    if (selectedCaseIds.value.length === 0) {
      ElMessage.warning('请先选择待审核案例')
      return
    }

    try {
      await batchApproveCases(selectedCaseIds.value, publish)
      ElMessage.success(publish ? '批量发布成功' : '批量审核通过')
      const selectedIdSet = new Set(selectedCaseIds.value.map((id) => normalizeId(id)))
      pendingCases.value = pendingCases.value.filter((item) => !selectedIdSet.has(normalizeId(item.id)))
      selectedCaseIds.value.forEach((caseId) => syncApprovedCaseInProgress(caseId))
      selectedCaseIds.value = []
      if (pendingCases.value.length === 0) {
        showReviewPanel.value = false
        ElMessage.success('所有案例审核完成！')
      }
    } catch (e) {
      console.error('批量审核失败', e)
      ElMessage.error(e?.message || '批量审核失败')
    }
  }

  const handleApproveAll = async (publish = false) => {
    if (!pendingCases.value.length) {
      ElMessage.warning('当前没有待审核案例')
      return
    }

    try {
      const allIds = pendingCases.value.map(c => c.id)
      await batchApproveCases(allIds, publish)
      ElMessage.success(publish ? '全部发布成功' : '全部审核通过')
      allIds.forEach((caseId) => syncApprovedCaseInProgress(caseId))
      pendingCases.value = []
      showReviewPanel.value = false
    } catch (e) {
      console.error('全部审核失败', e)
      ElMessage.error(e?.message || '批量审核失败')
    }
  }

  const handleRegenerateCase = async (caseId) => {
    regeneratingCaseId.value = caseId
    try {
      await regenerateCase(caseId)
      ElMessage.success('案例重新生成成功！')
      await loadPendingCases()
    } catch (e) {
      if (e.code === 'ECONNABORTED') {
        ElMessage.warning('生成时间较长，请稍后刷新页面查看')
        await refreshPendingCases()
      } else {
        console.error('重新生成失败', e)
        ElMessage.error(e.message || '重新生成失败')
      }
    } finally {
      regeneratingCaseId.value = null
    }
  }

  return {
    loadPendingCases,
    refreshPendingCases,
    handleSelectionChange,
    handleApproveCase,
    handleApproveBatch,
    handleApproveAll,
    handleRegenerateCase
  }
}
