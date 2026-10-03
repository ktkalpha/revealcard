export function matchingPairs(body) {
  const rows = body.trim().split('\n').filter((line) => line.trim())
  if (rows.length < 2 || rows.length > 20)
    throw new Error('매칭 게임은 2~20쌍으로 작성해 주세요.')
  const pairs = rows.map((row, id) => {
    const parts = row.split('|').map((part) => part.trim())
    if (parts.length !== 2 || parts.some((part) => !part || part.length > 500))
      throw new Error(`${id + 1}번째 줄을 이름 | 업적 형식으로 작성해 주세요. (각 500자 이하)`)
    return { id, name: parts[0], achievement: parts[1] }
  })
  for (const key of ['name', 'achievement']) {
    if (new Set(pairs.map((pair) => pair[key])).size !== pairs.length)
      throw new Error('이름과 업적은 각각 중복 없이 작성해 주세요.')
  }
  return pairs
}

export function matchingError(body) {
  try { matchingPairs(body); return '' } catch (error) { return error.message }
}

export function shuffled(items, random = Math.random) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
