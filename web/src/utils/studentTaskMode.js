export const STUDENT_TASK_CASE_MODE = {
  FULL_PRACTICE: 'FULL_PRACTICE',
  PURE_CODING: 'PURE_CODING'
}

export function isPureCodingSubmissionType(submissionType) {
  const type = String(submissionType || '').trim().toLowerCase()
  return type.startsWith('code') || type === 'source' || type === 'project'
}

export function resolveStudentTaskCaseMode(taskOrTasks) {
  if (Array.isArray(taskOrTasks)) {
    const explicitMode = taskOrTasks.find(item => item?.caseMode)?.caseMode
    if (explicitMode) {
      return explicitMode
    }
    const hasNonCode = taskOrTasks.some(item => !isPureCodingSubmissionType(item?.submissionType))
    return hasNonCode ? STUDENT_TASK_CASE_MODE.FULL_PRACTICE : STUDENT_TASK_CASE_MODE.PURE_CODING
  }

  const task = taskOrTasks || {}
  if (task.caseMode) {
    return task.caseMode
  }
  return isPureCodingSubmissionType(task.submissionType)
    ? STUDENT_TASK_CASE_MODE.PURE_CODING
    : STUDENT_TASK_CASE_MODE.FULL_PRACTICE
}

export function getStudentTaskCaseModeLabel(taskOrTasks) {
  return resolveStudentTaskCaseMode(taskOrTasks) === STUDENT_TASK_CASE_MODE.PURE_CODING
    ? '纯编码实战'
    : '完整实训案例'
}

export function getStudentTaskCaseModeTagType(taskOrTasks) {
  return resolveStudentTaskCaseMode(taskOrTasks) === STUDENT_TASK_CASE_MODE.PURE_CODING
    ? 'success'
    : 'warning'
}

export function isPureCodingCase(taskOrTasks) {
  return resolveStudentTaskCaseMode(taskOrTasks) === STUDENT_TASK_CASE_MODE.PURE_CODING
}

export function isFullPracticeCase(taskOrTasks) {
  return resolveStudentTaskCaseMode(taskOrTasks) === STUDENT_TASK_CASE_MODE.FULL_PRACTICE
}
