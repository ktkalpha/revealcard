// Map quiz cards: one place per line as `이름 | 위도, 경도 | 설명(선택)`.
export function mapQuizPlaces(body) {
  const rows = body.trim().split('\n').filter((line) => line.trim())
  if (rows.length < 1 || rows.length > 30)
    throw new Error('지도 게임은 1~30곳으로 작성해 주세요.')
  const places = rows.map((row, id) => {
    const parts = row.split('|').map((part) => part.trim())
    const coords = (parts[1] || '').split(',').map((part) => part.trim())
    const lat = Number(coords[0])
    const lon = Number(coords[1])
    if (parts.length < 2 || parts.length > 3 || !parts[0] || parts[0].length > 200 || (parts[2] || '').length > 500)
      throw new Error(`${id + 1}번째 줄을 이름 | 위도, 경도 | 설명 형식으로 작성해 주세요.`)
    if (coords.length !== 2 || !coords[0] || !coords[1] || !(Math.abs(lat) <= 85) || !(Math.abs(lon) <= 180))
      throw new Error(`${id + 1}번째 줄의 위도(-85~85)와 경도(-180~180)를 확인해 주세요.`)
    return { id, name: parts[0], lat, lon, note: parts[2] || '' }
  })
  if (new Set(places.map((place) => place.name)).size !== places.length)
    throw new Error('지역 이름은 중복 없이 작성해 주세요.')
  return places
}

export function mapQuizError(body) {
  try { mapQuizPlaces(body); return '' } catch (error) { return error.message }
}

// Great-circle distance in km.
export function distanceKm(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const MAX_ROUND_SCORE = 1000
// Full marks within 100 km, then decays; about half at 1,000 km.
export function roundScore(km) {
  if (km <= 100) return MAX_ROUND_SCORE
  return Math.round(MAX_ROUND_SCORE * Math.exp(-(km - 100) / 1300))
}

export const CLOSE_KM = 600
export const formatKm = (km) => km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km).toLocaleString('ko-KR')}km`
