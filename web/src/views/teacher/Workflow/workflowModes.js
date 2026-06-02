export const WORKFLOW_MODES = [
  {
    label: '完整实训案例',
    value: 'FULL_PRACTICE',
    icon: 'Operation',
    description: '围绕背景故事、任务清单、数据集、结构化验证和综合评价生成完整实训链路',
    templateType: 'FULL_PRACTICE'
  },
  {
    label: '纯编码任务',
    value: 'PURE_CODING',
    icon: 'EditPen',
    description: '保留原项目的 Workflow + MCP + 多 Agent 编码实战链路，聚焦接口与代码交付',
    templateType: 'PURE_CODING'
  }
]

const WORKFLOW_MODE_MAP = WORKFLOW_MODES.reduce((accumulator, mode) => {
  accumulator[mode.value] = mode
  return accumulator
}, {})

export function getWorkflowModeMeta(mode) {
  return WORKFLOW_MODE_MAP[mode] || WORKFLOW_MODE_MAP.FULL_PRACTICE
}

export function getWorkflowModeLabel(mode) {
  return getWorkflowModeMeta(mode).label
}

export function getRecommendedWorkflowTemplateType(mode) {
  return getWorkflowModeMeta(mode).templateType
}

export function mapDeliverableModeToWorkflowMode(deliverableMode) {
  return deliverableMode === 'NON_CODE' ? 'FULL_PRACTICE' : 'PURE_CODING'
}

export function mapNumericDifficultyToWorkflowLevel(level) {
  const difficultyMap = {
    1: 'EASY',
    2: 'MEDIUM',
    3: 'HARD'
  }

  return difficultyMap[Number(level)] || 'MEDIUM'
}
