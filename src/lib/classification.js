export const FOSSIL_ERAS = ['선캄브리아 시대', '고생대', '중생대', '신생대']
export const emptyClassification = () => ({ categories: [...FOSSIL_ERAS], items: [] })
export function safeImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return false
  if (/^\/fossils\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/.test(value)) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}
export function safeSourceUrl(value) {
  if (value === undefined || value === '') return true
  if (typeof value !== 'string' || value.length > 2000) return false
  try { return new URL(value).protocol === 'https:' } catch { return false }
}
export function classificationData(body) {
  let data
  try { data = JSON.parse(body) } catch { throw new Error('분류 게임의 내용을 확인해 주세요.') }
  if (!data || !Array.isArray(data.categories) || data.categories.length < 2 || data.categories.length > 6 || data.categories.some(c => typeof c !== 'string' || !c.trim() || c.length > 50) || new Set(data.categories).size !== data.categories.length)
    throw new Error('분류 기준은 중복 없이 2~6개가 필요해요.')
  if (!Array.isArray(data.items) || data.items.length < 2 || data.items.length > 60)
    throw new Error('사진은 2~60개가 필요해요.')
  const ids = new Set()
  for (const item of data.items) {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id) || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 200 || !data.categories.includes(item.category) || !safeImageUrl(item.image))
      throw new Error('각 사진의 이름, 분류와 사진 주소를 확인해 주세요.')
    ids.add(item.id)
    for (const key of ['explanation', 'credit', 'license'])
      if (item[key] !== undefined && (typeof item[key] !== 'string' || item[key].length > 1000)) throw new Error('사진 설명 또는 출처가 너무 길어요.')
    if (!safeSourceUrl(item.source)) throw new Error('출처는 https 주소로 입력해 주세요.')
  }
  return data
}
export function classificationError(body) {
  try { classificationData(body); return '' } catch (error) { return error.message }
}
export function classificationAnswer(item, category) {
  return { itemId: item.id, chosen: category, correct: category === item.category }
}
