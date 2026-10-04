import { bodyError, masksIn } from './masks.js'
export function passageError(card) {
  const highlights = card.highlights || []
  if (!Array.isArray(highlights) || highlights.length > 100) return '하이라이트는 최대 100개까지 만들 수 있어요.'
  let end = 0
  const ids = new Set()
  for (const h of [...highlights].sort((a,b) => (a?.start ?? -1)-(b?.start ?? -1))) {
    if (!h || typeof h.id !== 'string' || h.id.length > 100 || ids.has(h.id) || !Number.isInteger(h.start) || !Number.isInteger(h.end) || h.start < end || h.start < 0 || h.end <= h.start || h.end > card.body.length) return '하이라이트 범위를 확인해 주세요.'
    ids.add(h.id); end = h.end
    if (masksIn(card.body).some(m => (h.start > m.start && h.start < m.end) || (h.end > m.start && h.end < m.end))) return '가리개 전체를 포함해 하이라이트해 주세요.'
    if (!Array.isArray(h.cards) || !h.cards.length || h.cards.length > 20) return '하이라이트마다 카드를 1~20장 넣어 주세요.'
    for (const c of h.cards) {
      if (!c || typeof c.title !== 'string' || !c.title.trim() || c.title.length > 200 || typeof c.body !== 'string' || !c.body.trim() || c.body.length > 20000 || bodyError(c.body)) return '연결 카드의 제목, 내용과 가리개를 확인해 주세요.'
    }
  }
  return ''
}
export function passageData(card) {
  return { highlights: (card.highlights || []).map(h => ({ id:h.id, start:h.start, end:h.end, cards:h.cards.map(c => ({title:c.title,body:c.body})) })) }
}
// Rebase unaffected annotations, keep annotations spanning an edit, remove partial overlaps.
export function rebaseHighlights(highlights, before, after) {
  let start=0, tail=0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  while (tail < before.length-start && tail < after.length-start && before[before.length-1-tail] === after[after.length-1-tail]) tail++
  const end=before.length-tail, delta=after.length-before.length
  return highlights.flatMap(h => {
    if (h.end <= start) return [h]
    if (h.start >= end) return [{...h,start:h.start+delta,end:h.end+delta}]
    if (h.start <= start && h.end >= end && h.end+delta > h.start) return [{...h,end:h.end+delta}]
    return []
  })
}
