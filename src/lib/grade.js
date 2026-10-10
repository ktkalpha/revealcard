// Grades a typed answer against a blank's text for Hard (서술형) mode.
// Everything runs locally, so it works offline and costs nothing. It forgives
// spacing, punctuation, word order, particles and small typos, and the learner
// can always overrule the verdict.

export const CORRECT = 0.85
export const CLOSE = 0.5

const PUNCTUATION = /[\s.,·・‧:;!?'"“”‘’`~()[\]{}<>〈〉《》「」『』【】\-–—_=+*/\\|→←↔⇒…①-⑳]/g

export const normalize = (text) => String(text || '').normalize('NFC').toLowerCase().replace(PUNCTUATION, '')

// Hangul syllables split into jamo so 무상깜 is one step from 무상감, not a whole syllable.
const jamo = (text) => [...text].flatMap((char) => {
  const code = char.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return [char]
  const parts = [0x1100 + Math.floor(code / 588), 0x1161 + Math.floor((code % 588) / 28)]
  if (code % 28) parts.push(0x11a7 + (code % 28))
  return parts.map((part) => String.fromCharCode(part))
})

function editRatio(a, b) {
  const x = jamo(a), y = jamo(b)
  if (!x.length && !y.length) return 1
  let row = Array.from({ length: y.length + 1 }, (_, index) => index)
  for (let i = 1; i <= x.length; i++) {
    const next = [i]
    for (let j = 1; j <= y.length; j++)
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
    row = next
  }
  return 1 - row[y.length] / Math.max(x.length, y.length)
}

const bigrams = (text) => {
  const list = []
  for (let i = 0; i < text.length - 1; i++) list.push(text.slice(i, i + 2))
  return list.length ? list : [text]
}

// How much of the answer's wording shows up in the input, in any order.
// Weighted toward recall: writing a little more than the answer is fine.
function overlap(answer, input) {
  const want = bigrams(answer), have = bigrams(input)
  const pool = new Map()
  for (const gram of have) pool.set(gram, (pool.get(gram) || 0) + 1)
  let hits = 0
  for (const gram of want) {
    if (pool.get(gram)) {
      hits++
      pool.set(gram, pool.get(gram) - 1)
    }
  }
  const recall = hits / want.length, precision = hits / have.length
  return recall && (5 * precision * recall) / (4 * precision + recall)
}

// The best match for one answer part anywhere inside the input.
function bestWithin(part, input) {
  if (input.includes(part)) return 1
  let best = editRatio(part, input)
  for (let size = Math.max(1, part.length - 1); size <= part.length + 1; size++)
    for (let start = 0; start + size <= input.length; start++)
      best = Math.max(best, editRatio(part, input.slice(start, start + size)))
  return best
}

const numbers = (text) => String(text).replace(/\D/g, '')

export function grade(answer, input) {
  const raw = String(answer || '')
  const typed = normalize(input)
  if (!typed) return { verdict: 'wrong', score: 0 }
  // "같은 부모(혈육)" also accepts "같은 부모"; the bracketed part is extra detail.
  const variants = [...new Set([raw, raw.replace(/\([^)]*\)/g, '')].map(normalize))].filter(Boolean)
  // Numbers carry meaning (4-4-2, 9행), so a different number is never close enough.
  if (numbers(raw) && numbers(raw) !== numbers(input) && numbers(raw.replace(/\([^)]*\)/g, '')) !== numbers(input))
    return { verdict: 'wrong', score: 0 }
  let score = 0
  for (const target of variants) {
    if (target === typed) return { verdict: 'correct', score: 1 }
    // One- or two-letter answers (음, 뜻, 은유) must be exact: a near miss is another word.
    // A unit after a short answer is fine (9 → 9행).
    if (target.length <= 2) {
      if (typed.startsWith(target) && typed.length <= target.length + 1) return { verdict: 'correct', score: 1 }
      continue
    }
    score = Math.max(score, editRatio(target, typed), overlap(target, typed))
  }
  // Answers listing several items (시련, 소멸 / ① 요절 ② 원인) are graded item by item.
  const parts = raw.replace(/\([^)]*\)/g, '').split(/[,/·、]|[①-⑳]|\s+(?:및|과|와|그리고)\s+/).map(normalize).filter(Boolean)
  if (parts.length > 1)
    score = Math.max(score, parts.reduce((sum, part) => sum + (part.length <= 2 ? (typed.includes(part) ? 1 : 0) : bestWithin(part, typed)), 0) / parts.length)
  score = Math.round(score * 100) / 100
  return { verdict: score >= CORRECT ? 'correct' : score >= CLOSE ? 'close' : 'wrong', score }
}
