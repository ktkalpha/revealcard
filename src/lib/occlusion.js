import { CARD_IMAGE_URL } from './images.js'

// Image occlusion cards keep a JSON body: an uploaded image and boxes in percent
// of the image size, so covers stay on their labels at any display width.
export const emptyOcclusion = () => ({ image: '', boxes: [] })

const percent = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100

export function occlusionData(body) {
  let data
  try { data = JSON.parse(body) } catch { throw new Error('가리개 카드의 내용을 확인해 주세요.') }
  if (!data || typeof data.image !== 'string' || !CARD_IMAGE_URL.test(data.image))
    throw new Error('사진 추가로 올린 사진이 필요해요.')
  if (!Array.isArray(data.boxes) || data.boxes.length < 1 || data.boxes.length > 60)
    throw new Error('가리개는 1~60개가 필요해요.')
  const ids = new Set()
  for (const box of data.boxes) {
    if (!box || typeof box.id !== 'string' || !box.id || box.id.length > 100 || ids.has(box.id))
      throw new Error('가리개 정보를 확인해 주세요.')
    if (![box.x, box.y, box.w, box.h].every(percent) || box.w < 0.5 || box.h < 0.5 || box.x + box.w > 100.01 || box.y + box.h > 100.01)
      throw new Error('가리개 위치를 확인해 주세요.')
    if (box.label !== undefined && (typeof box.label !== 'string' || box.label.length > 200))
      throw new Error('가리개 이름은 200자 이하로 입력해 주세요.')
    ids.add(box.id)
  }
  return data
}

export function occlusionError(body) {
  try { occlusionData(body); return '' } catch (error) { return error.message }
}

export const occlusionMasks = (body) => {
  try { return occlusionData(body).boxes.map((box) => ({ id: box.id, text: box.label || '' })) } catch { return [] }
}

// Converts two drag points (percent) into a box clamped to the image.
export function boxFromPoints(a, b) {
  const clamp = (v) => Math.min(100, Math.max(0, v))
  const x = clamp(Math.min(a.x, b.x)), y = clamp(Math.min(a.y, b.y))
  const round = (v) => Math.round(v * 100) / 100
  return { x: round(x), y: round(y), w: round(clamp(Math.max(a.x, b.x)) - x), h: round(clamp(Math.max(a.y, b.y)) - y) }
}
