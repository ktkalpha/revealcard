import { bodyError } from './masks.js'

export const BULK_DRAFT_KEY = 'revealcard.bulk.v1'
export const bulkDraftKey = (deckId) => `${BULK_DRAFT_KEY}.${deckId}`
export const emptyRow = () => ({ title: '', body: '' })

export function parseTable(text) {
  const rows = [[]]
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (quoted || !cell) quoted = !quoted
      else cell += char
    } else if (!quoted && char === '\t') {
      rows.at(-1).push(cell)
      cell = ''
    } else if (!quoted && (char === '\n' || char === '\r')) {
      rows.at(-1).push(cell)
      rows.push([])
      cell = ''
      if (char === '\r' && text[i + 1] === '\n') i++
    } else cell += char
  }
  rows.at(-1).push(cell)
  if (rows.length > 1 && rows.at(-1).length === 1 && !rows.at(-1)[0])
    rows.pop()
  return rows
}

export function rowError(row) {
  if (!row.title.trim() && !row.body.trim()) return ''
  if (!row.title.trim()) return '제목을 입력해 주세요.'
  if (!row.body.trim()) return '내용을 입력해 주세요.'
  if (row.title.length > 200) return '제목은 200자 이하여야 해요.'
  if (row.body.length > 20000) return '내용은 20,000자 이하여야 해요.'
  return bodyError(row.body)
}

export function loadBulkDraft(storage, deckId) {
  try {
    const saved = JSON.parse(storage.getItem(bulkDraftKey(deckId)))
    if (
      saved?.deckId === deckId &&
      Array.isArray(saved.rows) &&
      saved.rows.length <= 1000 &&
      saved.rows.every(
        (row) =>
          typeof row.title === 'string' && typeof row.body === 'string',
      )
    )
      return saved.rows
  } catch {
    // A malformed draft should not prevent creating cards.
  }
  return null
}
