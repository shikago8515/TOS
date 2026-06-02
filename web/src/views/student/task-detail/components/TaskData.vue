<template>
  <div class="task-data-container" v-if="parsedInstanceData">
    <div class="section-block">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon><DataLine /></el-icon> 实训数据集
        </h3>
        <div class="header-actions">
          <el-tag size="small" type="warning" effect="plain" class="data-tag">统一数据集</el-tag>
          <el-button-group size="small">
            <el-button type="primary" plain @click="exportToSQL">
              <el-icon><Download /></el-icon> SQL
            </el-button>
            <el-button type="success" plain @click="exportToCSV">
              <el-icon><Download /></el-icon> CSV
            </el-button>
          </el-button-group>
        </div>
      </div>

        <div class="data-content">
          <div class="data-notice">
          <el-alert 
            :title="datasetNoticeText" 
            type="info" 
            :closable="false"
            show-icon
          />
        </div>

        <!-- 数据使用说明 -->
        <div v-if="dataUsageHint" class="data-usage-hint">
          <div class="hint-title"><el-icon><InfoFilled /></el-icon> 数据使用说明</div>
          <div class="hint-content">{{ dataUsageHint }}</div>
        </div>

        <!-- 多表展示（可折叠） -->
        <div v-if="parsedInstanceData.tables && parsedInstanceData.tables.length > 0" class="tables-container">
          <el-collapse v-model="activeNames">
            <el-collapse-item v-for="(table, index) in parsedInstanceData.tables" :key="index" :name="String(index)">
              <template #title>
                <div class="table-collapse-header">
                  <el-icon class="table-icon"><List /></el-icon>
                  <span class="table-name">{{ table.tableName }}</span>
                  <span class="table-comment" v-if="table.tableComment">{{ table.tableComment }}</span>
                  <el-tag size="small" effect="plain" class="row-count">{{ table.rows.length }} 行数据</el-tag>
                </div>
              </template>

              <div class="table-content-wrapper">
                <!-- 合并后的表格视图：表头包含类型信息 -->
                <div v-if="table.rows && table.rows.length > 0" class="data-table-wrapper">
                  <el-table 
                    :data="table.rows" 
                    border 
                    size="small"
                    max-height="600"
                    stripe
                    class="db-like-table"
                  >
                    <el-table-column 
                      v-for="col in table.columnDefs" 
                      :key="col.name" 
                      :prop="col.name" 
                      min-width="140"
                      :show-overflow-tooltip="{ teleported: false }"
                    >
                      <template #header>
                        <div class="custom-header-cell">
                          <div class="header-top">
                            <span class="header-name">{{ col.name }}</span>
                            <el-tooltip v-if="col.primaryKey" content="主键" placement="top" :teleported="false">
                              <el-icon class="pk-icon"><Key /></el-icon>
                            </el-tooltip>
                          </div>
                          <div class="header-bottom">
                            <span class="type-icon">{{ getTypeIcon(col.type) }}</span>
                            <span class="header-type">{{ col.type }}</span>
                          </div>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
                <el-empty v-else description="暂无数据" :image-size="60"></el-empty>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
        <el-empty v-else description="暂无可展示的实训数据" :image-size="72"></el-empty>
        
        <!-- JSON 原始数据（可折叠） -->
        <el-collapse class="data-collapse">
          <el-collapse-item title="查看原始 JSON 数据" name="json">
            <pre class="json-preview">{{ formatJson(parsedInstanceData) }}</pre>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { DataLine, Download, InfoFilled, List, Key } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { isFullPracticeCase } from '@/utils/studentTaskMode'

const props = defineProps<{
  task: any
}>()

const emit = defineEmits<{
  (e: 'dataset-exported', payload: { format: 'sql' | 'csv' }): void
}>()

const activeNames = ref(['0'])

  const getTypeIcon = (type: string) => {
    if (!type) return 'T'
    const t = type.toLowerCase()
    if (t.includes('int') || t.includes('decimal') || t.includes('float') || t.includes('double') || t.includes('numeric')) {
      return '#'
    }
    if (t.includes('char') || t.includes('text') || t.includes('string')) {
      return 'ABC'
    }
    if (t.includes('date') || t.includes('time')) {
      return '🕒'
    }
    if (t.includes('bool')) {
      return '☑'
    }
    return 'T'
  }

const getColumnName = (col: any) => {
  if (typeof col === 'string') return col
  return col?.name || col?.columnName || col?.field || col?.prop || 'unknown'
}

const normalizeColumnDef = (raw: any, fallbackName?: string) => {
  if (typeof raw === 'string') {
    return {
      name: raw,
      type: 'VARCHAR(255)',
      comment: '',
      nullable: true,
      primaryKey: false
    }
  }

  return {
    name: getColumnName(raw) || fallbackName || 'unknown',
    type: raw?.type || raw?.dataType || raw?.columnType || 'VARCHAR(255)',
    comment: raw?.comment || raw?.description || '',
    nullable: raw?.nullable !== false,
    primaryKey: raw?.primary_key || raw?.primaryKey || false
  }
}

const reorderToClientConvention = (columns: string[], columnDefs: any[]) => {
  const defsByName = new Map<string, any>()
  columnDefs.forEach((def: any) => {
    if (def?.name) defsByName.set(def.name, def)
  })

  const orderMap = new Map<string, number>()
  columns.forEach((name: string, idx: number) => {
    if (!orderMap.has(name)) {
      orderMap.set(name, idx)
    }
  })

  const getPriority = (name: string) => {
    const lower = name.toLowerCase()
    const def = defsByName.get(name)
    if (def?.primaryKey) return 0
    if (lower === 'id' || lower.endsWith('_id')) return 1
    if (lower === 'name' || lower.endsWith('_name')) return 2
    return 10
  }

  const orderedColumns = [...columns].sort((a: string, b: string) => {
    const p = getPriority(a) - getPriority(b)
    if (p !== 0) return p
    return (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0)
  })

  const orderedDefs = orderedColumns.map((name: string) => {
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

const cleanSqlValue = (val: string) => {
  val = val.trim()
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1)
  }
  return val
}

const extractRowsFromSql = (sql: string, tableName: string) => {
  if (!sql || !tableName) return []
  const rows: any[] = []

  try {
    const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = 'INSERT\\s+INTO\\s+[\\`"\']?' + escaped + '[\\`"\']?\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\\S]*?);'
    const insertPattern = new RegExp(pattern, 'gi')
    let match: RegExpExecArray | null

    while ((match = insertPattern.exec(sql)) !== null) {
      const columnsStr = match[1]
      const valuesStr = match[2]
      const columns = columnsStr.split(',').map((s: string) => s.trim().replace(/[`"']/g, ''))

      const tupleRegex = /\(([^()]*)\)/g
      let tupleMatch: RegExpExecArray | null
      while ((tupleMatch = tupleRegex.exec(valuesStr)) !== null) {
        const tuple = tupleMatch[1]
        const values: any[] = []
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
          const row: any = {}
          columns.forEach((col: string, idx: number) => {
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

const extractInsertColumnsFromSql = (sql: string, tableName: string) => {
  if (!sql || !tableName) return []
  try {
    const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = 'INSERT\\s+INTO\\s+[\\`"\']?' + escaped + '[\\`"\']?\\s*\\(([^)]+)\\)\\s*VALUES'
    const reg = new RegExp(pattern, 'i')
    const match = sql.match(reg)
    if (!match || !match[1]) return []
    return match[1].split(',').map((name: string) => name.trim().replace(/[`"']/g, '')).filter(Boolean)
  } catch (e) {
    console.error('Error parsing SQL insert columns:', e)
    return []
  }
}

const extractColumnDefsFromCreateSql = (sql: string, tableName: string) => {
  if (!sql || !tableName) return []

  try {
    const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const tablePattern = 'CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[\\`"\']?' + escaped + '[\\`"\']?\\s*\\(([^;]*?)\\)\\s*;'
    const createReg = new RegExp(tablePattern, 'i')
    const match = sql.match(createReg)
    if (!match || !match[1]) return []

    const body = match[1]
    const lines = body.split('\n').map((line: string) => line.trim()).filter(Boolean)
    const defs: any[] = []
    const primaryKeyColumns = new Set<string>()

    lines.forEach((line: string) => {
      const normalized = line.replace(/,$/, '').trim()
      if (!normalized) return

      if (/PRIMARY\s+KEY/i.test(normalized)) {
        const pkMatch = normalized.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i)
        if (pkMatch && pkMatch[1]) {
          pkMatch[1]
            .split(',')
            .map((item: string) => item.trim().replace(/[`"']/g, ''))
            .filter(Boolean)
            .forEach((name: string) => primaryKeyColumns.add(name))
        }
      }
    })

    lines.forEach((line: string) => {
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

const normalizeRows = (rows: any[], columns: string[]) => {
  if (!Array.isArray(rows)) return []
  if (rows.length === 0) return []

  if (Array.isArray(rows[0])) {
    return rows.map((row: any[]) => {
      const obj: Record<string, any> = {}
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx] !== undefined ? row[idx] : ''
      })
      return obj
    })
  }

  if (typeof rows[0] === 'object' && rows[0] !== null) {
    return rows.map((row: Record<string, any>) => ({ ...row }))
  }

  return []
}

const normalizeDataset = (raw: any) => {
  if (!raw || typeof raw !== 'object') return null

  const root = raw.data && typeof raw.data === 'object' ? raw.data : raw
  const resultTables: any[] = []

  const processTable = (tableObj: any, defaultName: string) => {
    const tableName = tableObj.tableName || tableObj.table_name || defaultName
    let tableRows = tableObj.records || tableObj.sampleData || tableObj.rows || []
    const sqlScript = extractSqlScript(raw)
    const sqlColumnDefs = sqlScript ? extractColumnDefsFromCreateSql(sqlScript, tableName) : []
    const sqlInsertColumns = sqlScript ? extractInsertColumnsFromSql(sqlScript, tableName) : []
    
    // 如果没有结构化数据但有 SQL 脚本，尝试从 SQL 解析
    if (tableRows.length === 0 && sqlScript) {
      const sqlRows = extractRowsFromSql(sqlScript, tableName)
      if (sqlRows.length > 0) {
        tableRows = sqlRows
      }
    }

    const explicitDefs = Array.isArray(tableObj.columns)
      ? tableObj.columns.map((col: any) => normalizeColumnDef(col))
      : []

    const orderedDefs = sqlColumnDefs.length > 0
      ? sqlColumnDefs
      : explicitDefs

    let columns = sqlInsertColumns.length > 0
      ? sqlInsertColumns
      : (orderedDefs.length > 0 ? orderedDefs.map((d: any) => d.name) : [])

    if (columns.length === 0 && Array.isArray(tableObj.columns)) {
      columns = tableObj.columns.map((col: any) => getColumnName(col))
    }

    if (columns.length === 0 && Array.isArray(tableRows) && tableRows.length > 0 && !Array.isArray(tableRows[0]) && typeof tableRows[0] === 'object') {
      columns = Object.keys(tableRows[0])
    }

    const columnDefsSource = orderedDefs.length > 0
      ? orderedDefs
      : columns.map((name: string) => ({
          name,
          type: 'VARCHAR(255)',
          comment: '',
          nullable: true,
          primaryKey: false
        }))

    const normalizedRows = normalizeRows(tableRows, columns)
    const rawColumnDefs = columns.map((colName: string) => {
      const explicitDef = columnDefsSource.find((d: any) => d.name === colName)
      return explicitDef || {
        name: colName,
        type: 'VARCHAR(255)',
        comment: '',
        nullable: true,
        primaryKey: false
      }
    })

    const clientOrdered = reorderToClientConvention(columns, rawColumnDefs)
    const clientOrderedRows = normalizeRows(tableRows, clientOrdered.columns)

    return {
      tableName,
      tableComment: tableObj.tableDescription || tableObj.table_comment || tableObj.tableComment || '',
      columns: clientOrdered.columns,
      rows: clientOrderedRows.length > 0 ? clientOrderedRows : normalizedRows,
      columnDefs: clientOrdered.columnDefs
    }
  }

  // 提取 SQL 脚本的辅助函数
  const extractSqlScript = (mockData: any) => {
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
    return ''
  }

  // 兼容旧格式：{ data: { columns, rows } }
  if (Array.isArray(root.columns) && Array.isArray(root.rows)) {
    const rootTableName = root.table_name || root.tableName || 'task_dataset'
    const rootSqlScript = extractSqlScript(root)
    const sqlDefs = rootSqlScript ? extractColumnDefsFromCreateSql(rootSqlScript, rootTableName) : []
    const sqlInsertColumns = rootSqlScript ? extractInsertColumnsFromSql(rootSqlScript, rootTableName) : []
    const jsonDefs = root.columns.map((col: any) => normalizeColumnDef(col))
    const defs = sqlDefs.length > 0 ? sqlDefs : jsonDefs
    let columns = sqlInsertColumns.length > 0 ? sqlInsertColumns : defs.map((d: any) => d.name)
    const rawDefs = defs.map((item: any) => ({
      name: item.name,
      type: item.type,
      comment: item.comment,
      nullable: item.nullable,
      primaryKey: item.primaryKey
    }))
    const clientOrdered = reorderToClientConvention(columns, rawDefs)
    resultTables.push({
      columns: clientOrdered.columns,
      rows: normalizeRows(root.rows, clientOrdered.columns),
      tableName: rootTableName,
      tableComment: root.table_comment || root.tableComment || '',
      columnDefs: clientOrdered.columnDefs,
      raw
    })
  }

  // 兼容新格式：{ tables: [{ tableName, columns, records/sampleData/rows }] }
  if (Array.isArray(root.tables) && root.tables.length > 0) {
    root.tables.forEach((t: any, i: number) => {
      resultTables.push(processTable(t, t.tableName || t.table_name || `table_${i + 1}`))
    })
  }

  // 如果 root 包含 sqlScript 但没有 tables，尝试从 SQL 解析
  const rootSql = extractSqlScript(root)
  if (resultTables.length === 0 && rootSql) {
    // 简单的正则匹配 CREATE TABLE
    const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\`"']?(\w+)[\`"']?/gi
    let match
    const tableNames: string[] = []
    while ((match = createTablePattern.exec(rootSql)) !== null) {
      tableNames.push(match[1])
    }
    
    if (tableNames.length > 0) {
      tableNames.forEach(name => {
        resultTables.push(processTable({ tableName: name }, name))
      })
    } else {
      // 尝试直接提取 INSERT 语句中的表名
      const insertPattern = /INSERT\s+INTO\s+[\`"']?(\w+)[\`"']?/gi
      const insertTableNames = new Set<string>()
      while ((match = insertPattern.exec(rootSql)) !== null) {
        insertTableNames.add(match[1])
      }
      insertTableNames.forEach(name => {
        resultTables.push(processTable({ tableName: name }, name))
      })
    }
  }

  if (resultTables.length === 0) return null

  return {
    tables: resultTables,
    raw
  }
}

// 解析实例数据（任务统一数据集）
const parsedInstanceData = computed(() => {
  if (!props.task?.instanceData) return null
  try {
    const data = JSON.parse(props.task.instanceData)
    return normalizeDataset(data)
  } catch (e) {
    console.error('解析实例数据失败', e)
    return null
  }
})

// 获取数据使用说明
const dataUsageHint = computed(() => {
  if (!props.task?.instanceData) return null
  try {
    const data = JSON.parse(props.task.instanceData)
    return data.data_usage || data.dataUsage || null
  } catch {
    return null
  }
})

const datasetNoticeText = computed(() => {
  return isFullPracticeCase(props.task)
    ? '这是当前完整实训案例的统一数据集（适用于整个案例实现与最终成果提交）'
    : '这是当前任务的统一数据集（适用于全部编码子任务）'
})

// 导出为 SQL
const exportToSQL = () => {
  if (!parsedInstanceData.value) return

  const tables = parsedInstanceData.value.tables || []
  if (tables.length === 0) {
    ElMessage.warning('暂无可导出的 SQL 数据')
    return
  }
  
  let sql = `-- 实训数据导出\n-- 生成时间: ${new Date().toLocaleString()}\n\n`

  tables.forEach((table: any, index: number) => {
    const tableName = table.tableName || `table_${index + 1}`
    const columns = table.columns || []
    const rows = table.rows || []
    const defs = table.columnDefs || []

    sql += `-- 表: ${tableName}${table.tableComment ? ` (${table.tableComment})` : ''}\n`

    if (defs.length > 0) {
      sql += `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n`
      const colDefs = defs.map((col: any) => {
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
      sql += `INSERT INTO \`${tableName}\` (${columns.map((c: string) => `\`${c}\``).join(', ')}) VALUES\n`
      const valueRows = rows.map((row: any) => {
        const values = columns.map((col: string) => {
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
  
  const fileName = `${props.task?.title || 'task'}_dataset.sql`
  downloadFile(sql, fileName, 'text/sql')
  ElMessage.success('SQL 文件已导出')
  emit('dataset-exported', { format: 'sql' })
}

// 导出为 CSV
const exportToCSV = () => {
  if (!parsedInstanceData.value) return

  const tables = parsedInstanceData.value.tables || []
  if (tables.length === 0) {
    ElMessage.warning('暂无可导出的 CSV 数据')
    return
  }

  let csv = ''
  tables.forEach((table: any, idx: number) => {
    const tableName = table.tableName || `table_${idx + 1}`
    const columns = table.columns || []
    const rows = table.rows || []

    if (idx > 0) csv += '\n'
    csv += `# ${tableName}\n`
    csv += columns.join(',') + '\n'

    rows.forEach((row: any) => {
      const values = columns.map((col: string) => {
        const val = row[col]
        if (val === null || val === undefined) return ''
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      csv += values.join(',') + '\n'
    })
  })

  const fileName = `${props.task?.title || 'task'}_dataset.csv`
  downloadFile(csv, fileName, 'text/csv')
  ElMessage.success('CSV 文件已导出')
  emit('dataset-exported', { format: 'csv' })
}

// 下载文件工具函数
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob(['\ufeff' + content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 格式化 JSON 显示（排除 raw 属性避免重复）
const formatJson = (obj: any) => {
  try {
    if (obj && Array.isArray(obj.tables)) {
      const jsonTables = obj.tables.map((table: any) => {
        const columns = table.columns || []
        const rows = Array.isArray(table.rows)
          ? table.rows.map((row: any) => {
              const orderedRow: Record<string, any> = {}
              columns.forEach((col: string) => {
                orderedRow[col] = row?.[col]
              })
              return orderedRow
            })
          : []

        return {
          tableName: table.tableName,
          tableComment: table.tableComment,
          columns: table.columnDefs || columns,
          rows
        }
      })

      return JSON.stringify({ tables: jsonTables }, null, 2)
    }
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}
</script>

<style scoped lang="scss">
.task-data-container {
  padding: 8px 0;
  margin-top: 32px;
  border-top: 1px dashed #ebeef5;
  padding-top: 32px;
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      
      .el-icon {
        color: #409eff;
      }
    }
    
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .data-tag {
        font-weight: 500;
      }
    }
  }

  .data-notice {
    margin-bottom: 16px;
  }

  .data-usage-hint {
    background: #f0f9eb;
    border: 1px solid #e1f3d8;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 16px;
    
    .hint-title {
      font-size: 13px;
      font-weight: 600;
      color: #67c23a;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .hint-content {
      font-size: 13px;
      color: #606266;
      line-height: 1.6;
      white-space: pre-wrap;
    }
  }

  .table-collapse-header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    
    .table-icon {
      color: #409eff;
      font-size: 16px;
    }
    
    .table-name {
      font-size: 15px;
      font-weight: 600;
      color: #303133;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    
    .table-comment {
      color: #909399;
      font-size: 13px;
    }
    
    .row-count {
      margin-left: auto;
      margin-right: 12px;
    }
  }
  
  .table-content-wrapper {
    padding: 12px 16px;
    background: #fdfdfd;
  }

  .data-table-wrapper {
    margin-bottom: 16px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .data-collapse {
    margin-top: 12px;
    border-top: none;
    
    :deep(.el-collapse-item__header) {
      font-size: 13px;
      color: #909399;
      background: transparent;
      border-bottom: none;
    }
    
    :deep(.el-collapse-item__wrap) {
      border-bottom: none;
    }
  }
  
  .json-preview {
    background: #f8f9fa;
    padding: 12px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    max-height: 300px;
    margin: 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: #606266;
    border: 1px solid #ebeef5;
  }
}
</style>
