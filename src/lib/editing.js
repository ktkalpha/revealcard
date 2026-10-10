import { parseBody } from './masks.js'

// Text-editing helpers for the card editor. They work on the raw Markdown body
// and return { body, start, end } so the caller can restore the caret.

const MARKUP = /^(?:[*_`~#>|\-+:]+|\d+[.)])$/

// Splits the body into tappable words, masks and untouchable gaps.
export function tapTokens(body) {
  const tokens = []
  let cursor = 0
  for (const part of parseBody(body)) {
    if (part.id !== undefined) {
      tokens.push({ type: 'mask', text: part.text, start: part.start, end: part.end })
      cursor = part.end
      continue
    }
    const offset = cursor
    cursor += part.text.length
    for (const match of part.text.matchAll(/\s+|[^\s]+/g)) {
      const start = offset + match.index
      const text = match[0]
      if (/^\s+$/.test(text) || MARKUP.test(text) || /^!\[.*\]\(.*\)$/.test(text)) {
        tokens.push({ type: 'gap', text, start, end: start + text.length })
        continue
      }
      // Leave Markdown and punctuation around a word outside the cover.
      const lead = /^[*_`~"'“‘(<[]+/.exec(text)?.[0].length || 0
      const trail = /[*_`~"'”’)>\],.!?:;^]+$/.exec(text.slice(lead))?.[0].length || 0
      const core = text.slice(lead, text.length - trail)
      if (!core) {
        tokens.push({ type: 'gap', text, start, end: start + text.length })
        continue
      }
      if (lead) tokens.push({ type: 'gap', text: text.slice(0, lead), start, end: start + lead })
      tokens.push({ type: 'word', text: core, start: start + lead, end: start + lead + core.length })
      if (trail) tokens.push({ type: 'gap', text: text.slice(text.length - trail), start: start + text.length - trail, end: start + text.length })
    }
  }
  return tokens
}

// Tapping a word covers it; tapping a word right next to a cover (only spaces
// between) grows that cover; tapping a cover uncovers it.
export function toggleTap(body, token) {
  if (token.type === 'mask')
    return body.slice(0, token.start) + token.text + body.slice(token.end)
  if (token.type !== 'word') return body
  const before = body.slice(0, token.start)
  const after = body.slice(token.end)
  const left = /\]\]([ \t]*)$/.exec(before)
  if (left && !before.slice(0, left.index).endsWith('[')) {
    const open = before.lastIndexOf('[[', left.index)
    if (open >= 0) {
      const inner = before.slice(open + 2, left.index)
      return before.slice(0, open) + `[[${inner}${left[1]}${token.text}]]` + after
    }
  }
  const right = /^([ \t]*)\[\[/.exec(after)
  if (right) {
    const close = after.indexOf(']]', right[0].length)
    if (close >= 0) {
      const inner = after.slice(right[0].length, close)
      return before + `[[${token.text}${right[1]}${inner}]]` + after.slice(close + 2)
    }
  }
  return `${before}[[${token.text}]]${after}`
}

// With no selection, the word under the caret is used.
export function wordRange(body, start, end) {
  if (start !== end) return [start, end]
  const isWord = (char) => char && !/[\s*_`~#>|[\](),.!?:;"'“”‘’]/.test(char)
  let from = start, to = end
  while (from > 0 && isWord(body[from - 1])) from--
  while (to < body.length && isWord(body[to])) to++
  return [from, to]
}

const lineStart = (body, index) => body.lastIndexOf('\n', index - 1) + 1
const lineEnd = (body, index) => {
  const next = body.indexOf('\n', index)
  return next < 0 ? body.length : next
}

// Enter inside a list continues it; Enter on an empty item ends the list.
export function continueList(body, caret) {
  const from = lineStart(body, caret)
  const line = body.slice(from, caret)
  const match = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
  if (!match) return null
  const [, indent, marker, text] = match
  if (!text.trim()) {
    const next = body.slice(0, from) + body.slice(caret)
    return { body: next, start: from, end: from }
  }
  const nextMarker = /^\d+/.test(marker) ? `${Number.parseInt(marker, 10) + 1}${marker.slice(-1)}` : marker
  const insert = `\n${indent}${nextMarker} `
  return { body: body.slice(0, caret) + insert + body.slice(caret), start: caret + insert.length, end: caret + insert.length }
}

// Turns the selected lines into list items, or removes the bullets if all are items.
export function toggleList(body, start, end) {
  const from = lineStart(body, start)
  const to = lineEnd(body, Math.max(start, end - (end > start && body[end - 1] === '\n' ? 1 : 0)))
  const lines = body.slice(from, to).split('\n')
  const listed = lines.every((line) => /^\s*[-*+]\s/.test(line) || !line.trim())
  const next = lines.map((line) => {
    if (!line.trim()) return line
    return listed ? line.replace(/^(\s*)[-*+]\s/, '$1') : line.replace(/^(\s*)/, '$1- ')
  }).join('\n')
  return { body: body.slice(0, from) + next + body.slice(to), start: from, end: from + next.length }
}

// Indents or outdents every selected line by two spaces.
export function shiftLines(body, start, end, direction) {
  const from = lineStart(body, start)
  const to = lineEnd(body, Math.max(start, end - (end > start && body[end - 1] === '\n' ? 1 : 0)))
  const lines = body.slice(from, to).split('\n')
  let first = 0
  const next = lines.map((line, index) => {
    if (direction > 0) {
      if (index === 0) first = 2
      return `  ${line}`
    }
    const removed = line.startsWith('  ') ? 2 : line.startsWith(' ') ? 1 : 0
    if (index === 0) first = -removed
    return line.slice(removed)
  }).join('\n')
  const caret = Math.max(from, start + first)
  return { body: body.slice(0, from) + next + body.slice(to), start: caret, end: start === end ? caret : from + next.length }
}

export const TABLE_TEMPLATE = '| 항목 | 내용 |\n| --- | --- |\n|  |  |'

// Inserts a block (table, image) on its own lines at the caret.
export function insertBlock(body, start, end, block) {
  const before = body.slice(0, start)
  const after = body.slice(end)
  const text = `${before && !before.endsWith('\n') ? '\n\n' : before.endsWith('\n') && before && !before.endsWith('\n\n') ? '\n' : ''}${block}${after && !after.startsWith('\n') ? '\n\n' : ''}`
  return { body: before + text + after, start: start + text.length, end: start + text.length }
}

// Cards with lists, tables, headings or several paragraphs read better left-aligned.
export const isStructured = (body) =>
  /^\s*([-*+]|\d+[.)])\s|^\s*\||^#{1,6}\s/m.test(body) || body.split(/\n\s*\n/).filter((block) => block.trim()).length > 2
