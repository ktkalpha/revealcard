import { bodyError } from './masks.js'
import { matchingError } from './matching.js'
import { classificationError } from './classification.js'
import { occlusionError } from './occlusion.js'
import { passageError } from './passage.js'

// Mirrors the server's card checks so autosave only sends cards it will accept.
export function cardSaveError(card) {
  if (!card || !card.title?.trim() || !card.body?.trim()) return '제목과 내용을 입력하면 자동 저장돼요.'
  if (card.title.length > 200 || card.body.length > 20000) return '제목은 200자, 내용은 20,000자 이하로 입력해 주세요.'
  const error = card.kind === 'classification' ? classificationError(card.body)
    : card.kind === 'occlusion' ? occlusionError(card.body)
      : card.kind === 'matching' ? matchingError(card.body)
        : bodyError(card.body)
  return error || (card.kind === 'passage' ? passageError(card) : '')
}

export const isBlankCard = (card) => !card?.title?.trim() && !card?.body?.trim()

export function saveLabel(state, card) {
  if (state === 'saving') return '저장 중…'
  if (state === 'saved') return '자동 저장됨'
  if (state === 'pending') return '입력 중 · 곧 자동 저장돼요'
  if (state === 'offline') return '오프라인 · 이 기기에 임시 보관 중'
  if (state === 'error') return '자동 저장 실패 · 이 기기에 임시 보관 중'
  if (state === 'invalid') return isBlankCard(card) ? '작성 중' : `${cardSaveError(card)} 지금은 이 기기에 임시 보관 중이에요.`
  return '작성 중'
}
