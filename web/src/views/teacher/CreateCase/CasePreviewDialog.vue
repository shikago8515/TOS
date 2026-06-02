<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    fullscreen
    :teleported="false"
    destroy-on-close
    :show-close="false"
    class="preview-dialog full-screen-dialog"
  >
    <template #header>
      <div class="custom-dialog-header">
        <div class="header-left">
          <div class="header-title-wrap">
            <el-icon class="header-icon"><Document /></el-icon>
            <h2>{{ previewCase?.caseName || '案例预览' }}</h2>
          </div>
          <div class="preview-meta" v-if="previewCase">
            <el-tag size="small" effect="light" type="info" round>{{ getDifficultyLabel(previewCase.difficultyLevel) }}</el-tag>
            <span class="meta-text"><el-icon><Clock /></el-icon> {{ previewCase.estimatedHours }} 课时</span>
            <span class="meta-text"><el-icon><Calendar /></el-icon> {{ formatDateTime(previewCase.createdAt) || '-' }}</span>
          </div>
        </div>
        <div class="header-actions">
          <el-button @click="emit('update:modelValue', false)" plain round icon="Close">关闭预览</el-button>
          <el-button type="success" @click="handleApprove(false)" round icon="Check">通过审核</el-button>
          <el-button type="primary" @click="handleApprove(true)" round icon="Position">通过并发布</el-button>
        </div>
      </div>
    </template>

    <div v-if="previewCase" class="preview-content animate-fade-in-up">
      <div class="preview-body-layout">
        <div class="left-panel" :class="{ 'full-width': !previewCase.mockData }">
          <div class="panel-card">
            <div class="scrollable-content">
              <!-- 统一案例内容展示 -->
              <CaseSummaryView
                :background-story="previewCase.backgroundStory"
                :task-list="previewCase.taskList"
                :expected-output="previewCase.analysisQuestions || previewCase.expectedOutput"
              />

              <!-- 接口示例（供学生自测） -->
              <TaskApiExamples 
                v-if="allApiExamples.length > 0" 
                :task="{ apiExamples: allApiExamples }" 
              />
            </div>
          </div>
        </div>

        <div class="right-panel" v-if="previewCase.mockData">
          <div class="panel-card preview-section">
            <div class="section-header-sticky">
              <h3><el-icon><DataLine /></el-icon> 模拟数据</h3>
              <div class="section-actions">
                <el-radio-group v-model="dataViewMode" size="small">
                  <el-radio-button label="table">表格视图</el-radio-button>
                  <el-radio-button label="json">JSON</el-radio-button>
                  <el-radio-button v-if="hasSqlScript" label="sql">SQL</el-radio-button>
                </el-radio-group>
                <div class="action-buttons">
                  <el-button size="small" type="primary" plain :disabled="!normalizedTables.length" @click="downloadSql" icon="Download">下载 SQL</el-button>
                  <el-button size="small" plain @click="downloadTextFile(formatJson(parsedMockData), `${previewCase.caseName || 'case'}-mock-data.json`)" icon="Download">下载 JSON</el-button>
                </div>
              </div>
            </div>

            <div class="scrollable-view-container">
              <div v-if="dataViewMode === 'table'" class="view-container">
                <div v-if="normalizedTables.length > 0" class="mock-table-wrap">
                  <div v-for="(table, tableIndex) in normalizedTables" :key="`table-${tableIndex}`" class="mock-table-card">
                    <div class="mock-table-header">
                      <span class="table-name">{{ table.name || `表 ${Number(tableIndex) + 1}` }}</span>
                      <el-tag size="small" effect="plain" round>{{ table.rows.length }} 行</el-tag>
                    </div>

                    <el-table :data="table.rows" border size="small" max-height="400" style="width: 100%;" :flexible="true">
                      <el-table-column
                        v-for="col in table.columnDefs"
                        :key="`${tableIndex}-${col.name}`"
                        :prop="col.name"
                        min-width="120"
                        show-overflow-tooltip
                      >
                        <template #header>
                          <div class="custom-header">
                            <span class="header-name">{{ col.name }}</span>
                            <span v-if="col.type" class="header-type">{{ col.type }}</span>
                          </div>
                        </template>
                      </el-table-column>
                      <template #empty>
                        <el-empty description="暂无数据" :image-size="60"></el-empty>
                      </template>
                    </el-table>
                  </div>
                </div>
                <el-empty v-else description="无法解析为表格格式，请切换至 JSON 视图查看" :image-size="60"></el-empty>
              </div>

              <div v-else-if="dataViewMode === 'sql'" class="view-container">
                <div class="sql-preview-wrap">
                  <pre class="preview-code">{{ sqlScript }}</pre>
                </div>
              </div>

              <div v-else class="view-container">
                <pre class="preview-code">{{ formatJson(previewCase.mockData) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { DataLine, Document, Clock, Calendar, Close, Check, Position, Download } from '@element-plus/icons-vue'
import CaseSummaryView from '@/components/CaseSummaryView.vue'
import TaskApiExamples from '@/views/student/task-detail/components/TaskApiExamples.vue'

const props = defineProps({
  modelValue: Boolean,
  previewCase: Object,
  difficultyOptions: Array
})

const dataViewMode = ref('table')

const emit = defineEmits(['update:modelValue', 'approve'])

const parseToObject = (value) => {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

const parseTaskListForReview = (taskListJson) => {
  if (Array.isArray(taskListJson)) return taskListJson
  try {
    const parsed = JSON.parse(taskListJson)
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed?.tasks)) return parsed.tasks
    if (Array.isArray(parsed?.taskList)) return parsed.taskList
    if (Array.isArray(parsed?.items)) return parsed.items
    return []
  } catch {
    return []
  }
}

// parsedTaskList retained for API-spec rendering (code cases)
const parsedTaskList = computed(() => {
  return parseTaskListForReview(props.previewCase?.taskList)
})

const getRequiredSections = (task) => {
  const schema = task?.validation_schema || task?.validationSchema
  const sections = schema?.requiredSections || schema?.required_sections
  return Array.isArray(sections) ? sections : []
}

const parsedAnalysisQuestions = computed(() => {
  // TrainingCase 返回 expectedOutput 字段；CaseGenerationResponse 返回 analysisQuestions
  const raw = props.previewCase?.analysisQuestions || props.previewCase?.expectedOutput
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Array.isArray(parsed.analysisQuestions) ? parsed.analysisQuestions : []
    }
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})

/**
 * 解析实验步骤正文，过滤掉空内容项（留空由学生完成）
 */
const parsedSectionContents = computed(() => {
  const raw = props.previewCase?.analysisQuestions || props.previewCase?.expectedOutput
  if (!raw) return {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.sectionContents) {
      const result = {}
      for (const [k, v] of Object.entries(parsed.sectionContents)) {
        if (v && v.trim()) result[k] = v
      }
      return result
    }
  } catch {}
  return {}
})

/**
 * 解析实验报告格式提示语（仅 IMPLEMENTATION_LAB 案例有值）
 */
const parsedReportHint = computed(() => {
  const raw = props.previewCase?.analysisQuestions || props.previewCase?.expectedOutput
  if (!raw || typeof raw !== 'string') return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed.reportHint || ''
    }
  } catch {}
  return ''
})

const parsedMockData = computed(() => {
  return parseToObject(props.previewCase?.mockData)
})

const extractSqlScript = (mockData) => {
  if (!mockData || typeof mockData !== 'object') return ''
  const script = mockData.sqlScript
    || mockData.sql_script
    || mockData.sql
    || mockData.script
    || mockData.createSql
    || mockData.create_sql
    || mockData.sqlScripts
    || mockData.sql_scripts
  if (typeof script === 'string') return script
  if (Array.isArray(script)) return script.join('\n')

  const tableScripts = Array.isArray(mockData.tables)
    ? mockData.tables
        .map((table) => table?.sqlScript || table?.sql_script || table?.sql)
        .filter((item) => typeof item === 'string' && item.trim())
    : []

  if (tableScripts.length > 0) {
    return tableScripts.join('\n\n')
  }

  return ''
}

const sqlScript = computed(() => {
  return extractSqlScript(parsedMockData.value)
})

const hasSqlScript = computed(() => {
  return !!sqlScript.value
})

const normalizeColumnDefs = (columns) => {
  if (!Array.isArray(columns)) return []
  return columns.map((col, index) => {
    if (typeof col === 'string') {
      return {
        name: col,
        type: '',
        comment: '',
        nullable: true,
        primaryKey: false
      }
    }
    // 兼容LLM常见的各种字段名格式
    const name = col?.name
      || col?.columnName
      || col?.column_name
      || col?.col_name
      || col?.colName
      || col?.fieldName
      || col?.field_name
      || col?.field
      || col?.key
      || col?.Field          // MySQL DESCRIBE 格式
      || col?.COLUMN_NAME    // INFORMATION_SCHEMA 格式
      || `col_${index + 1}`
    const type = col?.type
      || col?.columnType
      || col?.column_type
      || col?.dataType
      || col?.data_type
      || col?.jdbcType
      || col?.Type           // MySQL DESCRIBE 格式
      || col?.DATA_TYPE      // INFORMATION_SCHEMA 格式
      || ''
    return {
      name,
      type,
      comment: col?.comment || col?.description || col?.Comment || col?.COLUMN_COMMENT || '',
      nullable: col?.nullable !== false,
      primaryKey: col?.primary_key || col?.primaryKey || col?.Key === 'PRI' || false
    }
  })
}

const reorderToClientConvention = (columns, columnDefs) => {
  const defsByName = new Map()
  columnDefs.forEach((def) => {
    if (def?.name) defsByName.set(def.name, def)
  })

  const orderMap = new Map()
  columns.forEach((name, idx) => {
    if (!orderMap.has(name)) {
      orderMap.set(name, idx)
    }
  })

  const getPriority = (name) => {
    const lower = name.toLowerCase()
    const def = defsByName.get(name)
    if (def?.primaryKey) return 0
    if (lower === 'id' || lower.endsWith('_id')) return 1
    if (lower === 'name' || lower.endsWith('_name')) return 2
    return 10
  }

  const orderedColumns = [...columns].sort((a, b) => {
    const p = getPriority(a) - getPriority(b)
    if (p !== 0) return p
    return (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0)
  })

  const orderedDefs = orderedColumns.map((name) => {
    return defsByName.get(name) || {
      name,
      type: 'VARCHAR(255)',
      comment: '',
      nullable: true,
      primaryKey: false
    }
  })

  return {
    columns: orderedColumns,
    columnDefs: orderedDefs
  }
}

const getTableRows = (table) => {
  if (!table) return []
  if (Array.isArray(table.rows)) return table.rows
  if (Array.isArray(table.data)) return table.data
  if (Array.isArray(table.records)) return table.records
  if (Array.isArray(table.list)) return table.list
  if (Array.isArray(table.values)) return table.values
  // 尝试下划线命名
  if (Array.isArray(table.row_data)) return table.row_data
  if (Array.isArray(table.table_data)) return table.table_data
  return []
}

const cleanSqlValue = (val) => {
  val = val.trim()
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1)
  }
  return val
}

const extractRowsFromSql = (sql, tableName) => {
  if (!sql || !tableName) return []
  const rows = []

  try {
    const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = 'INSERT\\s+INTO\\s+[\\`"\']?' + escaped + '[\\`"\']?\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\\S]*?);'
    const insertPattern = new RegExp(pattern, 'gi')
    let match

    while ((match = insertPattern.exec(sql)) !== null) {
      const columnsStr = match[1]
      const valuesStr = match[2]
      const columns = columnsStr.split(',').map((s) => s.trim().replace(/[`"']/g, ''))

      const tupleRegex = /\(([^()]*)\)/g
      let tupleMatch
      while ((tupleMatch = tupleRegex.exec(valuesStr)) !== null) {
        const tuple = tupleMatch[1]
        const values = []
        let inQuote = false
        let currentVal = ''

        for (let i = 0; i < tuple.length; i++) {
          const char = tuple[i]
          if (char === "'" || char === '"') {
            inQuote = !inQuote
            currentVal += char
          } else if (char === ',' && !inQuote) {
            values.push(cleanSqlValue(currentVal))
            currentVal = ''
          } else {
            currentVal += char
          }
        }
        values.push(cleanSqlValue(currentVal))

        if (columns.length === values.length) {
          const row = {}
          columns.forEach((col, idx) => {
            row[col] = values[idx]
          })
          rows.push(row)
        }
      }
    }
  } catch (e) {
    console.error('Error parsing SQL rows:', e)
  }
  return rows
}

const extractInsertColumnsFromSql = (sql, tableName) => {
  if (!sql || !tableName) return []
  try {
    const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = 'INSERT\\s+INTO\\s+[\\`"\']?' + escaped + '[\\`"\']?\\s*\\(([^)]+)\\)\\s*VALUES'
    const reg = new RegExp(pattern, 'i')
    const match = sql.match(reg)
    if (!match || !match[1]) return []
    return match[1].split(',').map((name) => name.trim().replace(/[`"']/g, '')).filter(Boolean)
  } catch (e) {
    console.error('Error parsing SQL insert columns:', e)
    return []
  }
}

const extractColumnDefsFromCreateSql = (sql, tableName) => {
  if (!sql || !tableName) return []

  try {
    const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const tablePattern = 'CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[\\`"\']?' + escaped + '[\\`"\']?\\s*\\(([^;]*?)\\)\\s*;'
    const createReg = new RegExp(tablePattern, 'i')
    const match = sql.match(createReg)
    if (!match || !match[1]) return []

    const body = match[1]
    const lines = body.split('\n').map((line) => line.trim()).filter(Boolean)
    const defs = []
    const primaryKeyColumns = new Set()

    lines.forEach((line) => {
      const normalized = line.replace(/,$/, '').trim()
      if (!normalized) return
      if (/PRIMARY\s+KEY/i.test(normalized)) {
        const pkMatch = normalized.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i)
        if (pkMatch && pkMatch[1]) {
          pkMatch[1]
            .split(',')
            .map((item) => item.trim().replace(/[`"']/g, ''))
            .filter(Boolean)
            .forEach((name) => primaryKeyColumns.add(name))
        }
      }
    })

    lines.forEach((line) => {
      const normalized = line.replace(/,$/, '').trim()
      if (!normalized) return
      if (/^(PRIMARY|UNIQUE|KEY|INDEX|CONSTRAINT|FOREIGN)\b/i.test(normalized)) return

      const colMatch = normalized.match(/^[`"']?([a-zA-Z0-9_]+)[`"']?\s+([a-zA-Z]+(?:\([^)]*\))?)/)
      if (!colMatch) return

      const colName = colMatch[1]
      const colType = colMatch[2]
      defs.push({
        name: colName,
        type: colType,
        comment: (normalized.match(/COMMENT\s+'([^']*)'/i) || [])[1] || '',
        nullable: !/NOT\s+NULL/i.test(normalized),
        primaryKey: /PRIMARY\s+KEY/i.test(normalized) || primaryKeyColumns.has(colName)
      })
    })

    return defs
  } catch (e) {
    console.error('Error parsing SQL create columns:', e)
    return []
  }
}

const normalizeRows = (rows, columns) => {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const obj = {}
      // 尝试匹配列名，忽略大小写
      columns.forEach((col) => {
        // 精确匹配
        if (row[col] !== undefined) {
          obj[col] = row[col]
          return
        }
        // 忽略大小写匹配
        const lowerCol = col.toLowerCase()
        const key = Object.keys(row).find(k => k.toLowerCase() === lowerCol)
        if (key) {
          obj[col] = row[key]
        }
      })
      // 如果还没找到，保留原对象以便至少能显示点什么（配合 el-table 默认行为）
      if (Object.keys(obj).length === 0) {
        return { ...row, ...obj }
      }
      return obj
    }

    if (Array.isArray(row)) {
      const obj = {}
      columns.forEach((col, idx) => {
        obj[col] = row[idx]
      })
      return obj
    }

    return {}
  })
}

const normalizedTables = computed(() => {
  const mockData = parsedMockData.value
  if (!mockData || typeof mockData !== 'object') return []

  const tables = Array.isArray(mockData.tables) ? mockData.tables : []
  const normalizedFromTables = tables
    .map((table, idx) => {
      let rawRows = getTableRows(table)
      const tableName = table?.tableName || table?.table_name || table?.name || `table_${idx + 1}`
      const sqlColumnDefs = hasSqlScript.value ? extractColumnDefsFromCreateSql(sqlScript.value, tableName) : []
      const sqlInsertColumns = hasSqlScript.value ? extractInsertColumnsFromSql(sqlScript.value, tableName) : []
      const baseDefs = normalizeColumnDefs(table?.columns || [])

      // 如果没有结构化数据，尝试从 SQL 解析
      if (rawRows.length === 0 && hasSqlScript.value) {
        const sqlRows = extractRowsFromSql(sqlScript.value, tableName)
        if (sqlRows.length > 0) {
          rawRows = sqlRows
        }
      }

      let columns = sqlInsertColumns.length > 0
        ? sqlInsertColumns
        : (sqlColumnDefs.length > 0 ? sqlColumnDefs.map((d) => d.name) : baseDefs.map((d) => d.name))

      if (columns.length === 0 && Array.isArray(rawRows) && rawRows.length > 0 && rawRows[0] && typeof rawRows[0] === 'object' && !Array.isArray(rawRows[0])) {
        columns = Object.keys(rawRows[0])
      }

      const columnDefsSource = sqlColumnDefs.length > 0
        ? sqlColumnDefs
        : (baseDefs.length > 0
            ? baseDefs
            : columns.map((name) => ({ name, type: 'VARCHAR(255)', comment: '', nullable: true, primaryKey: false })))

      const rawColumnDefs = columns.map((colName) => {
        const explicitDef = columnDefsSource.find((d) => d.name === colName)
        return explicitDef || {
          name: colName,
          type: 'VARCHAR(255)',
          comment: '',
          nullable: true,
          primaryKey: false
        }
      })

      // 兜底：若所有列名均为 col_N 且行是对象，直接用行第一条的key推导列名
      const ordered = reorderToClientConvention(columns, rawColumnDefs)
      let finalColumns = ordered.columns
      let finalDefs = ordered.columnDefs
      const allFallback = finalColumns.length > 0 && finalColumns.every((c, i) => c === `col_${i + 1}`)
      if (allFallback && rawRows.length > 0 && rawRows[0] && typeof rawRows[0] === 'object' && !Array.isArray(rawRows[0])) {
        const rowKeys = Object.keys(rawRows[0])
        if (rowKeys.length > 0) {
          // 用行数据key重建列定义，保留原有type信息
          const typeMap = new Map(rawColumnDefs.map((d, i) => [i, d.type]))
          finalDefs = rowKeys.map((k, i) => ({
            name: k,
            type: typeMap.get(i) || '',
            comment: '',
            nullable: true,
            primaryKey: false
          }))
          finalColumns = rowKeys
        }
      }
      const rows = normalizeRows(rawRows, finalColumns)
      return {
        name: tableName,
        columns: finalColumns,
        columnDefs: finalDefs,
        rows
      }
    })
    .filter((table) => table.columns.length > 0)

  if (normalizedFromTables.length > 0) {
    return normalizedFromTables
  }

  const rootColumnDefs = normalizeColumnDefs(mockData.columns || [])
  const rootTableName = mockData.tableName || mockData.table_name || 'mock_data'
  const rootSqlDefs = hasSqlScript.value ? extractColumnDefsFromCreateSql(sqlScript.value, rootTableName) : []
  const rootSqlInsertColumns = hasSqlScript.value ? extractInsertColumnsFromSql(sqlScript.value, rootTableName) : []
  const rootColumns = rootSqlInsertColumns.length > 0
    ? rootSqlInsertColumns
    : (rootSqlDefs.length > 0 ? rootSqlDefs.map((d) => d.name) : rootColumnDefs.map((col) => col.name))
  const rootRawDefs = rootColumns.map((name) => {
    const explicit = (rootSqlDefs.length > 0 ? rootSqlDefs : rootColumnDefs).find((d) => d.name === name)
    return explicit || {
      name,
      type: 'VARCHAR(255)',
      comment: '',
      nullable: true,
      primaryKey: false
    }
  })
  const rootOrdered = reorderToClientConvention(rootColumns, rootRawDefs)
  const rootRows = normalizeRows(getTableRows(mockData), rootOrdered.columns)
  if (rootOrdered.columns.length > 0) {
    // 兜底：若所有列名均为 col_N 且行是对象，用行key推导列名
    let finalCols = rootOrdered.columns
    let finalDefs = rootOrdered.columnDefs
    const allFallback = finalCols.length > 0 && finalCols.every((c, i) => c === `col_${i + 1}`)
    if (allFallback) {
      const rootRowsRaw = getTableRows(mockData)
      if (rootRowsRaw.length > 0 && rootRowsRaw[0] && typeof rootRowsRaw[0] === 'object' && !Array.isArray(rootRowsRaw[0])) {
        const rowKeys = Object.keys(rootRowsRaw[0])
        if (rowKeys.length > 0) {
          const typeMap = new Map(rootOrdered.columnDefs.map((d, i) => [i, d.type]))
          finalDefs = rowKeys.map((k, i) => ({
            name: k,
            type: typeMap.get(i) || '',
            comment: '',
            nullable: true,
            primaryKey: false
          }))
          finalCols = rowKeys
        }
      }
    }
    return [{
      name: rootTableName,
      columns: finalCols,
      columnDefs: finalDefs,
      rows: normalizeRows(getTableRows(mockData), finalCols)
    }]
  }

  return []
})

const getTaskApis = (task) => {
  const apiSpec = task?.api_spec || task?.apiSpec || task?.apiSpecs || task?.apiExamples || []
  if (Array.isArray(apiSpec)) return apiSpec
  if (typeof apiSpec === 'string') {
    try {
      const parsed = JSON.parse(apiSpec)
      if (Array.isArray(parsed)) return parsed
      if (Array.isArray(parsed?.examples)) return parsed.examples
      if (Array.isArray(parsed?.apis)) return parsed.apis
      if (Array.isArray(parsed?.items)) return parsed.items
      if (Array.isArray(parsed?.apiExamples)) return parsed.apiExamples
      return []
    } catch {
      return []
    }
  }
  if (apiSpec && typeof apiSpec === 'object') {
    if (Array.isArray(apiSpec.examples)) return apiSpec.examples
    if (Array.isArray(apiSpec.apis)) return apiSpec.apis
    if (Array.isArray(apiSpec.items)) return apiSpec.items
    if (Array.isArray(apiSpec.apiExamples)) return apiSpec.apiExamples
  }
  return []
}

const isNonEmptyPayload = (value) => {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

const pickApiPayload = (...candidates) => {
  const firstNonEmpty = candidates.find((item) => isNonEmptyPayload(item))
  if (firstNonEmpty !== undefined) return firstNonEmpty

  const firstDefined = candidates.find((item) => item !== undefined && item !== null)
  if (firstDefined !== undefined) return firstDefined

  return {}
}

const allApiExamples = computed(() => {
  const apis = []
  parsedTaskList.value.forEach(task => {
    const taskApis = getTaskApis(task)
    if (taskApis && taskApis.length > 0) {
      taskApis.forEach(api => {
        apis.push({
          name: api.name || api.description || api.title || '',
          method: api.method || 'GET',
          path: api.path || api.url || api.endpoint || '',
          request: pickApiPayload(
            api.request,
            api.requestExample,
            api.request_example,
            api.requestBody,
            api.request_body,
            api.requestJson,
            api.request_json,
            api.requestData,
            api.request_data,
            api.req,
            api.example?.request,
            api.examples?.request,
            api.sample?.request,
            api.sampleRequest
          ),
          response: pickApiPayload(
            api.response,
            api.responseExample,
            api.response_example,
            api.responseBody,
            api.response_body,
            api.responseJson,
            api.response_json,
            api.responseData,
            api.response_data,
            api.resp,
            api.example?.response,
            api.examples?.response,
            api.sample?.response,
            api.sampleResponse
          )
        })
      })
    }
  })
  return apis
})

const methodTagType = (method) => {
  const m = (method || 'GET').toUpperCase()
  if (m === 'GET') return 'success'
  if (m === 'POST') return 'primary'
  if (m === 'PUT' || m === 'PATCH') return 'warning'
  if (m === 'DELETE') return 'danger'
  return 'info'
}

const formatJson = (jsonStr) => {
  try {
    if (!jsonStr) return '{}'
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    if (obj && Array.isArray(obj.tables)) {
      const jsonTables = normalizedTables.value.map((table) => {
        const rows = Array.isArray(table.rows)
          ? table.rows.map((row) => {
              const orderedRow = {}
              table.columns.forEach((col) => {
                orderedRow[col] = row?.[col]
              })
              return orderedRow
            })
          : []

        return {
          tableName: table.name,
          columns: table.columnDefs,
          rows
        }
      })
      return JSON.stringify({ tables: jsonTables }, null, 2)
    }
    return JSON.stringify(obj, null, 2)
  } catch {
    return jsonStr
  }
}

const buildOrderedSqlForDownload = () => {
  const tables = normalizedTables.value || []
  if (!tables.length) {
    return sqlScript.value || ''
  }

  let sql = `-- 实训数据导出\n-- 生成时间: ${new Date().toLocaleString()}\n\n`
  tables.forEach((table, idx) => {
    const tableName = table.name || `table_${idx + 1}`
    const columns = table.columns || []
    const columnDefs = table.columnDefs || []
    const rows = table.rows || []

    sql += `-- 表: ${tableName}\n`
    if (columnDefs.length > 0) {
      sql += `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n`
      const colDefs = columnDefs.map((col) => {
        let def = `  \`${col.name}\` ${col.type || 'VARCHAR(255)'}`
        if (col.primaryKey) def += ' PRIMARY KEY'
        else if (!col.nullable) def += ' NOT NULL'
        if (col.comment) def += ` COMMENT '${col.comment}'`
        return def
      })
      sql += colDefs.join(',\n')
      sql += `\n);\n`
    }

    if (rows.length > 0 && columns.length > 0) {
      sql += `INSERT INTO \`${tableName}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES\n`
      const valueRows = rows.map((row) => {
        const values = columns.map((col) => {
          const val = row[col]
          if (val === null || val === undefined) return 'NULL'
          if (typeof val === 'number') return val
          if (typeof val === 'boolean') return val ? 1 : 0
          return `'${String(val).replace(/'/g, "''")}'`
        })
        return `(${values.join(', ')})`
      })
      sql += valueRows.join(',\n') + ';\n'
    }

    sql += '\n'
  })

  return sql
}

const getDifficultyLabel = (level) => {
  const option = props.difficultyOptions?.find(opt => opt.value === level)
  return option ? option.label : '未知'
}

const formatDateTime = (val) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const sanitizeFilename = (name) => {
  return name.replace(/[\\/:*?"<>|]/g, '_')
}

const downloadTextFile = (content, fileName) => {
  const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = sanitizeFilename(fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const downloadSql = () => {
  const orderedSql = buildOrderedSqlForDownload()
  if (!orderedSql.trim()) return
  downloadTextFile(orderedSql, `${props.previewCase?.caseName || 'case'}-dataset.sql`)
}

const handleApprove = (publish) => {
  if (!props.previewCase?.id) return
  emit('approve', { caseId: props.previewCase.id, publish })
}
</script>

<style scoped>
.preview-dialog.full-screen-dialog {
  :deep(.el-dialog__header) {
    padding: 0;
    margin: 0;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
  }
  :deep(.el-dialog__body) {
    padding: 0;
    height: calc(100vh - 65px);
    background-color: #f8fafc;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
}

.custom-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  height: 65px;
  box-sizing: border-box;

  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;

    .header-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;

      .header-icon {
        font-size: 22px;
        color: #6366f1;
      }

      h2 {
        font-size: 18px;
        font-weight: 700;
        color: #1e293b;
        margin: 0;
      }
    }

    .preview-meta {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-left: 24px;
      border-left: 1px solid #e2e8f0;

      .meta-text {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: #64748b;
      }
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.preview-content {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

.animate-fade-in-up {
  animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.preview-body-layout {
  display: flex;
  flex: 1;
  gap: 20px;
  min-height: 0;

  .left-panel {
    flex: 1.2; /* 增加左侧比例，让左侧信息更宽 */
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .right-panel {
    flex: 1; /* 右侧保持相对较小 */
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0; /* 防止右侧内容撑破 flex 容器 */
  }

  .left-panel.full-width {
    flex: none;
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
  }

  .panel-card {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;

    .scrollable-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      
      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
    }
  }
}

/* Make CaseSummaryView scrollable inside its card */
:deep(.panel-card > .case-summary-view) {
  overflow-y: auto;
  padding: 20px;
  height: 100%;
  box-sizing: border-box;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
}

.preview-section {
  display: flex;
  flex-direction: column;
  height: 100%;

  .section-header-sticky {
    flex-shrink: 0;
    padding: 16px 20px;
    border-bottom: 1px solid #f1f5f9;
    background: #ffffff;
    z-index: 10;

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #334155;
      margin: 0 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;

      .action-buttons {
        display: flex;
        gap: 8px;
      }
    }
  }

  .scrollable-view-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background: #f8fafc;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }
  }
}

.mock-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .mock-table-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px; /* 减小内边距 */
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    overflow: hidden; /* 防止表格溢出卡片 */
  }

  .mock-table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px; /* 减小下边距 */

    .table-name {
      font-size: 14px; /* 稍微减小字号 */
      color: #1e293b;
      font-weight: 700;
    }
  }

  /* 确保表格在容器内可以水平滚动，不会撑破屏幕 */
  :deep(.el-table) {
    width: 100% !important;
    
    .el-table__inner-wrapper {
      width: 100%;
    }
    
    .cell {
      white-space: nowrap; /* 防止内容换行导致行高增加 */
    }
  }

  .custom-header {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    
    .header-name {
      font-weight: 600;
      color: #334155;
      font-size: 12px; /* 减小表头字号 */
    }
    
    .header-type {
      font-size: 10px; /* 减小类型字号 */
      color: #94a3b8;
      font-weight: normal;
      margin-top: 2px;
    }
  }
}

.sql-preview-wrap {
  .preview-code {
    margin: 0;
  }
}

.preview-code {
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  margin: 0;
}
</style>
