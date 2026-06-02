import { marked } from 'marked'
import DOMPurify from 'dompurify'

let markedConfigured = false

const CODE_BLOCK_TOKEN = '__AI_CODE_BLOCK__'
const STRUCTURAL_LINE_PATTERN = /^(#{1,6}\s|- |\d+\.\s|\||>)/
const INLINE_LABEL_PATTERN = /^([A-Za-z0-9\u4e00-\u9fa5《》【】（）()“”"'、/\-]{2,24})([:：])\s*(.+)$/
const STANDALONE_LABEL_PATTERN = /^([A-Za-z0-9\u4e00-\u9fa5《》【】（）()“”"'、/\-]{2,24})([:：])\s*$/
const LEADING_EMOJI_PATTERN = /^(\s*[-*]?\s*)(?:[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\uFE0F|\u200D)+\s*/g
const SECTION_BREAK_KEYWORDS =
  '(本学期|当前|目前|学生|教学|案例|考核|高峰|风险|建议|重点|平均|参与|结论|问题|优化|资源|指标)'

const lastItem = (list) => (list.length ? list[list.length - 1] : undefined)

const ensureMarkedConfigured = () => {
  if (markedConfigured) return

  marked.use({
    breaks: true,
    gfm: true
  })

  markedConfigured = true
}

const protectCodeBlocks = (text) => {
  const codeBlocks = []
  const protectedText = text.replace(/```[\s\S]*?```/g, (match) => {
    const token = `${CODE_BLOCK_TOKEN}${codeBlocks.length}__`
    codeBlocks.push(match)
    return token
  })

  return { protectedText, codeBlocks }
}

const restoreCodeBlocks = (text, codeBlocks) => {
  return text.replace(/__AI_CODE_BLOCK__(\d+)__/g, (_, index) => {
    return codeBlocks[Number(index)] || ''
  })
}

const normalizeInlineEmphasis = (line) => {
  let normalized = line
    .replace(/\*{3}([^*\n]+?)\*{1,3}/g, '**$1**')
    .replace(/\*{2}([^*\n]+?)\*(?!\*)/g, '**$1**')
    .replace(/(^|[^\*])\*([^*\n]+?)\*{2}/g, '$1**$2**')

  const wrappedMatch = normalized.match(/^(\*{1,3})([^*\n].*?)(\*{0,3})$/u)
  if (
    wrappedMatch &&
    !/^(\* |- )/.test(normalized) &&
    !wrappedMatch[2].includes('**') &&
    wrappedMatch[2].length <= 36 &&
    (wrappedMatch[1].length !== wrappedMatch[3].length || wrappedMatch[1].length === 1)
  ) {
    normalized = `**${wrappedMatch[2].trim()}**`
  }

  return normalized
}

const normalizeLine = (line) => {
  let normalized = line
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+$/g, '')
    .replace(LEADING_EMOJI_PATTERN, '$1')
    .replace(/^[•·▪◦]\s*/u, '- ')
    .replace(/^\*(?![\s*])\s*/u, '- ')
    .replace(/^-(\*\*)/u, '- $1')
    .replace(/^(\d+)\.(\S)/u, '$1. $2')

  if (/^[-*_]{3,}$/u.test(normalized.trim())) {
    return '---'
  }

  if (/^\*{3}\s*([^\s*].+)$/u.test(normalized)) {
    normalized = normalized.replace(/^\*{3}\s*([^\s*].+)$/u, '- $1')
  }

  normalized = normalizeInlineEmphasis(normalized)

  return normalized
}

const splitOverloadedHeading = (line) => {
  if (!/^\s*#{1,6}\s/u.test(line)) {
    return [line]
  }

  const headingWithSectionParagraph = line.match(
    new RegExp(`^(\\s*#{1,6}\\s*[一二三四五六七八九十0-9]+[、.．][^\\n]{2,18}?)(?=${SECTION_BREAK_KEYWORDS})`, 'u')
  )
  if (headingWithSectionParagraph) {
    return [headingWithSectionParagraph[1], '', line.slice(headingWithSectionParagraph[1].length).trim()]
  }

  const headingWithParagraph = line.match(/^(\s*#{1,6}\s*)([^：:\n]{2,28})[：:]\s*(.+)$/u)
  if (headingWithParagraph && headingWithParagraph[3].length > 18) {
    return [`${headingWithParagraph[1]}${headingWithParagraph[2]}`, '', headingWithParagraph[3]]
  }

  const headingWithList = line.match(/^(\s*#{1,6}\s*[^\n]{2,42}?)(\d+\.\s+.+)$/u)
  if (headingWithList) {
    return [headingWithList[1], '', headingWithList[2]]
  }

  const headingWithTable = line.match(/^(\s*#{1,6}\s*[^\n]{2,42}?)(\|.+\|)$/u)
  if (headingWithTable) {
    return [headingWithTable[1], '', headingWithTable[2]]
  }

  return [line]
}

const formatLabelLine = (line) => {
  const standaloneLabel = line.match(STANDALONE_LABEL_PATTERN)
  if (standaloneLabel) {
    return `### ${standaloneLabel[1]}`
  }

  const inlineLabel = line.match(INLINE_LABEL_PATTERN)
  if (!inlineLabel) {
    return line
  }

  const [, label, colon, content] = inlineLabel
  if (label.length > 24 || /[。！？!?]$/.test(label)) {
    return line
  }

  return `**${label}${colon}** ${content.trim()}`
}

const splitTableColumns = (line) => {
  const trimmed = line.trim()
  if (!trimmed || STRUCTURAL_LINE_PATTERN.test(trimmed) || /^(\* |- )/.test(trimmed)) {
    return null
  }

  const delimiter = trimmed.includes('\t') ? /\t+/ : /\s{2,}/
  const columns = trimmed.split(delimiter).map((cell) => cell.trim())

  if (columns.length < 3 || columns.some((cell) => !cell)) {
    return null
  }

  return columns
}

const toMarkdownTable = (rows) => {
  const escapeCell = (cell) => cell.replace(/\|/g, '\\|')
  const header = `| ${rows[0].map(escapeCell).join(' | ')} |`
  const divider = `| ${rows[0].map(() => '---').join(' | ')} |`
  const body = rows.slice(1).map((row) => `| ${row.map(escapeCell).join(' | ')} |`)
  return [header, divider, ...body]
}

const normalizeTableLikeBlocks = (lines) => {
  const normalized = []

  for (let index = 0; index < lines.length; ) {
    const firstRow = splitTableColumns(lines[index])
    if (!firstRow) {
      normalized.push(lines[index])
      index += 1
      continue
    }

    const rows = [firstRow]
    let cursor = index + 1

    while (cursor < lines.length) {
      const nextRow = splitTableColumns(lines[cursor])
      if (!nextRow || nextRow.length !== firstRow.length) {
        break
      }
      rows.push(nextRow)
      cursor += 1
    }

    if (rows.length >= 2) {
      if (lastItem(normalized) && lastItem(normalized) !== '') {
        normalized.push('')
      }
      normalized.push(...toMarkdownTable(rows))
      if (cursor < lines.length && lines[cursor] !== '') {
        normalized.push('')
      }
      index = cursor
      continue
    }

    normalized.push(lines[index])
    index += 1
  }

  return normalized
}

export const normalizeAiMarkdown = (text) => {
  if (!text) return ''

  const { protectedText, codeBlocks } = protectCodeBlocks(
    String(text)
      .replace(/\r\n?/g, '\n')
      .replace(/\u200B/g, '')
      .trim()
  )

  const normalizedText = protectedText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/([^\n])\s*(#{2,6})(?=\S)/g, '$1\n$2')
    .replace(/(^|\n)(#{1,6})([^\s#])/g, '$1$2 $3')

  const formattedLines = []

  for (const rawLine of normalizedText.split('\n')) {
    const normalizedLine = normalizeLine(rawLine)

    if (!normalizedLine.trim()) {
      if (lastItem(formattedLines) !== '') {
        formattedLines.push('')
      }
      continue
    }

    const segments = splitOverloadedHeading(normalizedLine)

    for (const rawSegment of segments) {
      if (rawSegment === '') {
        if (lastItem(formattedLines) !== '') {
          formattedLines.push('')
        }
        continue
      }

      const rawTrimmedSegment = rawSegment.trim()
      const labelLikeSegment =
        STANDALONE_LABEL_PATTERN.test(rawTrimmedSegment) ||
        INLINE_LABEL_PATTERN.test(rawTrimmedSegment)
      const segment = formatLabelLine(rawSegment)
      const trimmedSegment = segment.trim()
      const previousLine = (lastItem(formattedLines) || '').trim()
      const looksStructural =
        STRUCTURAL_LINE_PATTERN.test(trimmedSegment) || labelLikeSegment

      if (looksStructural && previousLine && !STRUCTURAL_LINE_PATTERN.test(previousLine)) {
        formattedLines.push('')
      }

      formattedLines.push(segment)
    }
  }

  return restoreCodeBlocks(
    normalizeTableLikeBlocks(formattedLines)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n'),
    codeBlocks
  )
}

export const renderAiMarkdown = (text) => {
  if (!text) return ''

  ensureMarkedConfigured()
  const rawHtml = marked.parse(normalizeAiMarkdown(text))
  return DOMPurify.sanitize(rawHtml)
}
