import { parseBody } from './masks.js'

// Tables live in the card body as a fenced block holding one line of JSON:
//
//   ```table
//   {"rows":[ ["항목","내용"], ["",""] ],"merge":[ [0,0,1,2] ],"head":1}
//   ```
//
// Markdown tables cannot merge cells, so the editor writes this block instead.
// Cells are Markdown with [[covers]]; covers inside the JSON are found by the
// normal body parser, so studying, grading and wrong marks work unchanged.
// `merge` lists [row, column, rowSpan, colSpan], `head`/`side` mark the first
// row/column as headers and `align` maps "row,column" to left/center/right.

export const TABLE_LANG = 'table'
const BLOCK = /^```table[ \t]*\n(.*)\n```[ \t]*$/gm

export const emptyTable = (rows = 3, columns = 3) => ({
  rows: Array.from({ length: rows }, () => Array(columns).fill('')),
  merge: [],
  head: 1,
  side: 0,
  align: {},
})

// Repairs anything a hand edit could break: ragged rows, overlapping or
// out-of-range merges and alignment of cells that no longer exist.
export function normalizeTable(input) {
  if (!input || !Array.isArray(input.rows)) return null
  const rows = input.rows.filter(Array.isArray).map((row) => row.map((cell) => typeof cell === 'string' ? cell : cell == null ? '' : String(cell)))
  if (!rows.length) return null
  const columns = Math.max(1, ...rows.map((row) => row.length))
  for (const row of rows) while (row.length < columns) row.push('')
  const taken = rows.map(() => Array(columns).fill(false))
  const merge = []
  for (const item of Array.isArray(input.merge) ? input.merge : []) {
    if (!Array.isArray(item)) continue
    const [r, c] = item.map((value) => Math.trunc(Number(value)))
    if (!(r >= 0 && c >= 0 && r < rows.length && c < columns)) continue
    const rs = Math.min(Math.max(1, Math.trunc(Number(item[2])) || 1), rows.length - r)
    const cs = Math.min(Math.max(1, Math.trunc(Number(item[3])) || 1), columns - c)
    if (rs * cs < 2) continue
    let free = true
    for (let i = r; i < r + rs; i++) for (let j = c; j < c + cs; j++) if (taken[i][j]) free = false
    if (!free) continue
    for (let i = r; i < r + rs; i++) for (let j = c; j < c + cs; j++) taken[i][j] = true
    merge.push([r, c, rs, cs])
  }
  const align = {}
  for (const [key, value] of Object.entries(input.align && typeof input.align === 'object' ? input.align : {})) {
    const [r, c] = key.split(',').map(Number)
    if (r >= 0 && c >= 0 && r < rows.length && c < columns && ['left', 'center', 'right'].includes(value)) align[`${r},${c}`] = value
  }
  return { rows, merge, head: input.head ? 1 : 0, side: input.side ? 1 : 0, align }
}

// Nested arrays are written as `[ [` … `] ]` so the JSON never contains the
// `[[`/`]]` cover marks; only covers inside cell text do.
export function serializeTable(table) {
  const { rows, merge, head, side, align } = normalizeTable(table)
  const list = (items) => `[ ${items.join(', ')} ]`
  const fields = [`"rows":${list(rows.map((row) => `[${row.map((cell) => JSON.stringify(cell)).join(',')}]`))}`]
  if (merge.length) fields.push(`"merge":${list(merge.map((item) => `[${item.join(',')}]`))}`)
  if (head) fields.push('"head":1')
  if (side) fields.push('"side":1')
  if (Object.keys(align).length) fields.push(`"align":${JSON.stringify(align)}`)
  return `\`\`\`${TABLE_LANG}\n{${fields.join(',')}}\n\`\`\``
}

export function parseTableData(text) {
  try {
    return normalizeTable(JSON.parse(text))
  } catch {
    return null
  }
}

export function tableBlocks(body) {
  const blocks = []
  for (const match of body.matchAll(BLOCK)) {
    const table = parseTableData(match[1])
    if (table) blocks.push({ start: match.index, end: match.index + match[0].length, table })
  }
  return blocks
}

// Splits a Markdown table row into cells, keeping `|` inside [[covers]].
export function markdownCells(line) {
  const source = line.trim()
  if (!source.startsWith('|')) return null
  const cells = []
  let cell = ''
  let insideMask = false
  const last = source.endsWith('|') && source.length > 1 ? source.length - 1 : source.length
  for (let index = 1; index < last; index++) {
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

const isSeparator = (cells) => cells?.length && cells.every((cell) => /^:?-{1,}:?$/.test(cell))

// The table under the caret: a table block, or a Markdown table the editor can
// convert. Returns its range and contents, or null.
export function tableAt(body, caret) {
  const block = tableBlocks(body).find((item) => caret >= item.start && caret <= item.end)
  if (block) return block
  const lineStart = (index) => body.lastIndexOf('\n', index - 1) + 1
  const lineEnd = (index) => {
    const next = body.indexOf('\n', index)
    return next < 0 ? body.length : next
  }
  const isRow = (from) => /^\s*\|/.test(body.slice(from, lineEnd(from)))
  let start = lineStart(caret)
  if (!isRow(start)) return null
  while (start > 0 && isRow(lineStart(start - 1))) start = lineStart(start - 1)
  let end = lineEnd(caret)
  while (end < body.length && isRow(end + 1)) end = lineEnd(end + 1)
  const lines = body.slice(start, end).split('\n').map(markdownCells)
  if (lines.length < 2 || !isSeparator(lines[1])) return null
  const alignments = lines[1].map((cell) => cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : '')
  const rows = [lines[0], ...lines.slice(2)]
  const align = {}
  rows.forEach((row, r) => alignments.forEach((value, c) => { if (value) align[`${r},${c}`] = value }))
  return { start, end, table: normalizeTable({ rows, head: 1, align }), markdown: true }
}

// Where every cell sits: the anchor of its merge, and its spans when it is one.
export function tableLayout(table) {
  const owner = table.rows.map((row, r) => row.map((_, c) => ({ r, c, rs: 1, cs: 1 })))
  for (const [r, c, rs, cs] of table.merge) {
    const anchor = { r, c, rs, cs }
    for (let i = r; i < r + rs; i++) for (let j = c; j < c + cs; j++) owner[i][j] = anchor
  }
  return owner
}

const rangeOf = (a, b) => ({
  top: Math.min(a.r, b.r), left: Math.min(a.c, b.c), bottom: Math.max(a.r, b.r), right: Math.max(a.c, b.c),
})

// Grows a selection until no merged cell sticks out of it, like a spreadsheet.
export function expandRange(table, a, b) {
  const range = rangeOf(a, b)
  let changed = true
  while (changed) {
    changed = false
    for (const [r, c, rs, cs] of table.merge) {
      const inside = r <= range.bottom && r + rs - 1 >= range.top && c <= range.right && c + cs - 1 >= range.left
      if (!inside) continue
      const next = {
        top: Math.min(range.top, r), left: Math.min(range.left, c),
        bottom: Math.max(range.bottom, r + rs - 1), right: Math.max(range.right, c + cs - 1),
      }
      if (next.top !== range.top || next.left !== range.left || next.bottom !== range.bottom || next.right !== range.right) {
        Object.assign(range, next)
        changed = true
      }
    }
  }
  return range
}

const copy = (table) => ({
  rows: table.rows.map((row) => [...row]),
  merge: table.merge.map((item) => [...item]),
  head: table.head,
  side: table.side,
  align: { ...table.align },
})

// Merging keeps every cell's text, joined into the top-left cell.
export function mergeRange(table, range) {
  const next = copy(table)
  const { top, left, bottom, right } = range
  if (top === bottom && left === right) return next
  const texts = []
  for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) {
    if (next.rows[r][c].trim()) texts.push(next.rows[r][c].trim())
    next.rows[r][c] = ''
    if (r !== top || c !== left) delete next.align[`${r},${c}`]
  }
  next.rows[top][left] = texts.join(' ')
  next.merge = next.merge.filter(([r, c]) => r < top || r > bottom || c < left || c > right)
  next.merge.push([top, left, bottom - top + 1, right - left + 1])
  return next
}

export function unmergeRange(table, range) {
  const next = copy(table)
  next.merge = next.merge.filter(([r, c]) => r < range.top || r > range.bottom || c < range.left || c > range.right)
  return next
}

export const isMergedIn = (table, range) =>
  table.merge.some(([r, c]) => r >= range.top && r <= range.bottom && c >= range.left && c <= range.right)

const shiftAlign = (align, move) => {
  const next = {}
  for (const [key, value] of Object.entries(align)) {
    const moved = move(...key.split(',').map(Number))
    if (moved) next[moved.join(',')] = value
  }
  return next
}

// Inserts an empty row before `at`. A merge spanning the gap grows with it.
export function insertRow(table, at) {
  const next = copy(table)
  next.rows.splice(at, 0, Array(next.rows[0].length).fill(''))
  next.merge = next.merge.map(([r, c, rs, cs]) => r >= at ? [r + 1, c, rs, cs] : r + rs > at ? [r, c, rs + 1, cs] : [r, c, rs, cs])
  next.align = shiftAlign(next.align, (r, c) => [r >= at ? r + 1 : r, c])
  return next
}

export function insertColumn(table, at) {
  const next = copy(table)
  for (const row of next.rows) row.splice(at, 0, '')
  next.merge = next.merge.map(([r, c, rs, cs]) => c >= at ? [r, c + 1, rs, cs] : c + cs > at ? [r, c, rs, cs + 1] : [r, c, rs, cs])
  next.align = shiftAlign(next.align, (r, c) => [r, c >= at ? c + 1 : c])
  return next
}

// Removes rows from..to. Merges shrink; a merge whose top row goes keeps its
// text by moving to the first remaining row.
export function deleteRows(table, from, to) {
  const count = to - from + 1
  if (count >= table.rows.length) return copy(table)
  const next = copy(table)
  next.merge = next.merge.flatMap(([r, c, rs, cs]) => {
    const end = r + rs - 1
    if (end < from) return [[r, c, rs, cs]]
    if (r > to) return [[r - count, c, rs, cs]]
    const kept = rs - (Math.min(end, to) - Math.max(r, from) + 1)
    if (r >= from && kept > 0) next.rows[to + 1][c] = next.rows[to + 1][c] || next.rows[r][c]
    return kept > 0 ? [[Math.min(r, from), c, kept, cs]] : []
  }).filter(([, , rs, cs]) => rs * cs > 1)
  next.rows.splice(from, count)
  next.align = shiftAlign(next.align, (r, c) => r < from ? [r, c] : r > to ? [r - count, c] : null)
  return next
}

export function deleteColumns(table, from, to) {
  const count = to - from + 1
  if (count >= table.rows[0].length) return copy(table)
  const next = copy(table)
  next.merge = next.merge.flatMap(([r, c, rs, cs]) => {
    const end = c + cs - 1
    if (end < from) return [[r, c, rs, cs]]
    if (c > to) return [[r, c - count, rs, cs]]
    const kept = cs - (Math.min(end, to) - Math.max(c, from) + 1)
    if (c >= from && kept > 0) next.rows[r][to + 1] = next.rows[r][to + 1] || next.rows[r][c]
    return kept > 0 ? [[r, Math.min(c, from), rs, kept]] : []
  }).filter(([, , rs, cs]) => rs * cs > 1)
  for (const row of next.rows) row.splice(from, count)
  next.align = shiftAlign(next.align, (r, c) => c < from ? [r, c] : c > to ? [r, c - count] : null)
  return next
}

// Covers the whole text of each cell, or uncovers them when all are covered.
export function toggleCellCovers(table, cells) {
  const next = copy(table)
  const filled = cells.filter(([r, c]) => next.rows[r][c].trim())
  const covered = (text) => /^\[\[[\s\S]*\]\]$/.test(text.trim()) && parseBody(text.trim()).length === 1
  const uncover = filled.length && filled.every(([r, c]) => covered(next.rows[r][c]))
  for (const [r, c] of filled) {
    const plain = parseBody(next.rows[r][c]).map((part) => part.text).join('').trim()
    next.rows[r][c] = uncover ? plain : `[[${plain}]]`
  }
  return next
}

export const tableText = (table) => table.rows.flat().filter((cell) => cell.trim()).join(' ')
