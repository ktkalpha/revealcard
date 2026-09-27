import { masksIn, parseBody } from './masks.js'

function tableCells(line) {
  const source = line.trim()
  if (!source.startsWith('|') || !source.endsWith('|')) return null
  const cells = []
  let cell = ''
  let insideMask = false
  for (let index = 1; index < source.length - 1; index++) {
    const char = source[index]
    const pair = source.slice(index, index + 2)
    if (pair === '[[' || (insideMask && pair === ']]')) {
      insideMask = pair === '[['
      cell += pair
      index++
    } else if (!insideMask && char === '\\' && ['\\', '|'].includes(source[index + 1])) {
      cell += source[++index]
    } else if (!insideMask && char === '|') {
      cells.push(cell.trim())
      cell = ''
    } else cell += char
  }
  cells.push(cell.trim())
  return cells
}

export function tableMarkdown(cells) {
  const columns = Math.max(2, cells[0]?.length || 0)
  const escapeCell = (value) => parseBody(String(value || '')).map((part) =>
    part.id === undefined
      ? part.text.replaceAll('\\', '\\\\').replaceAll('|', '\\|')
      : `[[${part.text}]]`,
  ).join('')
  const line = (values) => `| ${Array.from({ length: columns }, (_, index) =>
    escapeCell(values[index]),
  ).join(' | ')} |`
  return [line(cells[0] || []), line(Array(columns).fill('---')),
    ...cells.slice(1).map(line)].join('\n')
}

export function parseOutline(body) {
  if (!body) return [{ id: 1, depth: 0, text: '', collapsed: false }]
  const lines = body.split('\n')
  const rows = []
  let previousDepth = 0
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const match = /^( *)(?:-\s)(.*)$/.exec(line)
    const requestedDepth = match ? Math.floor(match[1].length / 2) : 0
    const depth = rows.length ? Math.min(requestedDepth, previousDepth + 1) : 0
    previousDepth = depth
    const header = match && tableCells(match[2])
    const prefix = match && `${match[1]}  `
    const separator = prefix && lines[index + 1]?.startsWith(prefix)
      ? tableCells(lines[index + 1].slice(prefix.length)) : null
    if (header && separator?.length === header.length &&
      separator.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      const cells = [header]
      index++
      while (lines[index + 1]?.startsWith(prefix)) {
        const next = tableCells(lines[index + 1].slice(prefix.length))
        if (!next) break
        cells.push(Array.from({ length: header.length }, (_, column) => next[column] || ''))
        index++
      }
      if (cells.length === 1) cells.push(header.map(() => ''))
      rows.push({ id: rows.length + 1, depth, type: 'table', cells, collapsed: false })
      continue
    }
    rows.push({
      id: rows.length + 1,
      depth,
      text: match ? match[2] : line,
      collapsed: false,
    })
  }
  return rows
}

export function serializeOutline(rows) {
  return rows.flatMap((row) => {
    const prefix = '  '.repeat(row.depth)
    if (row.type === 'table') {
      const [header, ...rest] = tableMarkdown(row.cells).split('\n')
      return [`${prefix}- ${header}`, ...rest.map((line) => `${prefix}  ${line}`)]
    }
    return row.text.trim() ? [`${prefix}- ${row.text}`] : []
  }).join('\n')
}

export function subtreeEnd(rows, index) {
  let end = index + 1
  while (end < rows.length && rows[end].depth > rows[index].depth) end++
  return end
}

export function moveDepth(rows, index, delta) {
  const row = rows[index]
  if (!row || (delta < 0 && !row.depth) ||
    (delta > 0 && (index === 0 || rows[index - 1].depth < row.depth))) return rows
  const next = rows.map((item) => ({ ...item }))
  for (let i = index; i < subtreeEnd(rows, index); i++) next[i].depth += delta
  return next
}

export function moveBranch(rows, sourceId, targetId, side) {
  const source = rows.findIndex((row) => row.id === sourceId)
  const target = rows.findIndex((row) => row.id === targetId)
  if (source < 0 || target < 0 || !['before', 'after'].includes(side)) return rows
  const end = subtreeEnd(rows, source)
  if (target >= source && target < end) return rows

  const insertAt = side === 'before' ? target : subtreeEnd(rows, target)
  const branch = rows.slice(source, end)
  const depthChange = rows[target].depth - rows[source].depth
  const adjusted = insertAt > source ? insertAt - branch.length : insertAt
  if (adjusted === source && !depthChange) return rows

  const next = [...rows.slice(0, source), ...rows.slice(end)]
  next.splice(adjusted, 0, ...branch.map((row) => ({
    ...row, depth: row.depth + depthChange,
  })))
  return next
}

export function studyOutline(body) {
  const masks = masksIn(body)
  let ordinal = 0
  return parseOutline(body).map((row) => {
    const text = row.type === 'table' ? tableMarkdown(row.cells) : row.text
    const count = masksIn(text).length
    const result = { ...row, text, maskParts: masks.slice(ordinal, ordinal + count), maskOrdinalStart: ordinal }
    ordinal += count
    return result
  })
}
