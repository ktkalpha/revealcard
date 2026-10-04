import { matchingError } from './lib/matching.js'
import { passageError, passageData } from './lib/passage.js'
import { bodyError } from './lib/masks.js'

export const CARD_SET_FORMAT = 'revealcard.card-set'
export const CARD_SET_VERSION = 1

export function exportCardSet(cards, name = '나의 암기 카드') {
  return {
    format: CARD_SET_FORMAT,
    version: CARD_SET_VERSION,
    name,
    cards: cards.map(card => ({
      title: card.title,
      body: card.body,
      ...(['note', 'matching', 'passage'].includes(card.kind) ? {kind: card.kind} : {}),
      ...(card.align && card.align !== 'center' ? {align: card.align} : {}),
      ...(card.kind === 'passage' ? passageData(card) : {}),
    })),
  }
}

export function parseCardSet(text) {
  let data
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('JSON 파일을 읽을 수 없습니다.')
  }
  if (!data || data.format !== CARD_SET_FORMAT)
    throw new Error('Revealcard 카드 셋 파일이 아닙니다.')
  if (data.version !== CARD_SET_VERSION)
    throw new Error(`지원하지 않는 카드 셋 버전입니다: ${String(data.version)}`)
  if (typeof data.name !== 'string' || !data.name.trim())
    throw new Error('카드 셋 이름이 없습니다.')
  if (data.name.length > 100)
    throw new Error('카드 셋 이름은 100자 이하여야 합니다.')
  if (!Array.isArray(data.cards) || data.cards.length === 0)
    throw new Error('카드가 한 장 이상 필요합니다.')
  if (data.cards.length > 1000)
    throw new Error('한 번에 최대 1,000장까지 불러올 수 있습니다.')
  const cards = data.cards.map((card, index) => {
    if (
      !card ||
      typeof card.title !== 'string' ||
      !card.title.trim() ||
      typeof card.body !== 'string' ||
      !card.body.trim()
    ) {
      throw new Error(
        `${index + 1}번 카드의 제목 또는 내용이 올바르지 않습니다.`,
      )
    }
    if (card.title.length > 200 || card.body.length > 20000)
      throw new Error(`${index + 1}번 카드가 너무 깁니다.`)
    if (card.align !== undefined && !['left', 'center', 'right'].includes(card.align))
      throw new Error(`${index + 1}번 카드의 정렬 값이 올바르지 않습니다.`)
    if (card.kind !== undefined && !['note', 'matching', 'passage'].includes(card.kind))
      throw new Error(`${index + 1}번 카드의 유형이 올바르지 않습니다.`)
    const error = card.kind === 'matching' ? matchingError(card.body) : bodyError(card.body)
    if (card.kind === 'passage' && passageError(card)) throw new Error(`${index + 1}번 본문: ${passageError(card)}`)
    if (error) throw new Error(`${index + 1}번 카드: ${error}`)
    return {
      ...(card.kind === 'passage' ? passageData(card) : {}),
      title: card.title,
      body: card.body,
      ...(['note', 'matching', 'passage'].includes(card.kind) ? { kind: card.kind } : {}),
      ...(card.align && card.align !== 'center' ? { align: card.align } : {}),
    }
  })
  return { name: data.name.trim(), cards }
}
