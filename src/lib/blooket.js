import { masksIn, plainText } from './masks.js'

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
const clean = (value) => plainText(value)
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*`#>|~-]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

export function blooketRows(cards) {
  const answers = [...new Set(cards.flatMap((card) =>
    masksIn(card.body).map((mask) => clean(mask.text)),
  ).filter(Boolean))]
  const rows = []
  for (const card of cards) {
    const masks = masksIn(card.body)
    for (const target of masks) {
      const questionBody = clean(
        card.body.slice(0, target.start) + '____' + card.body.slice(target.end),
      )
      const correct = clean(target.text)
      const distractors = answers.filter((answer) => answer !== correct).slice(0, 3)
      if (!distractors.length) distractors.push('해당 없음')
      rows.push({
        question: clean(`${card.title}: ${questionBody}`),
        answers: [correct, ...distractors, ...Array(3).fill('')].slice(0, 4),
      })
    }
  }
  return rows
}

export function exportBlooketCsv(cards) {
  const header = [
    'Question #', 'Question Text', 'Answer 1', 'Answer 2', 'Answer 3',
    'Answer 4', 'Time Limit (sec)', 'Correct Answer(s)',
  ]
  const lines = blooketRows(cards).map((row, index) => [
    index + 1, row.question, ...row.answers, 30, 1,
  ].map(csvCell).join(','))
  return '\uFEFF' + [header.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n'
}
