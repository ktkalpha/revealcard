export function parseBody(body) {
  const segments = []
  const pattern = /\[\[([\s\S]*?)\]\]/g
  let cursor = 0
  for (const match of body.matchAll(pattern)) {
    if (match.index > cursor)
      segments.push({ text: body.slice(cursor, match.index) })
    segments.push({
      text: match[1],
      id: String(match.index),
      start: match.index,
      end: match.index + match[0].length,
    })
    cursor = match.index + match[0].length
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor) })
  return segments
}
export const masksIn = (body) =>
  parseBody(body).filter((part) => part.id !== undefined)
export const plainText = (body) =>
  parseBody(body)
    .map((part) => part.text)
    .join('')

export function bodyError(body) {
  let inside = false
  let content = ''
  for (let i = 0; i < body.length; i++) {
    const pair = body.slice(i, i + 2)
    if (pair === '[[') {
      if (inside) return '가린 부분 안에 다른 가리기 표시를 넣을 수 없어요.'
      inside = true
      content = ''
      i++
    } else if (pair === ']]') {
      if (!inside) return '닫는 표시 ]] 앞에 여는 표시 [[가 필요해요.'
      if (!content.trim()) return '가린 부분에 정답을 입력해 주세요.'
      inside = false
      i++
    } else if (inside) content += body[i]
  }
  return inside ? '가린 부분 끝에 닫는 표시 ]]를 넣어 주세요.' : ''
}

export function maskSelection(body, start, end, wholeLine = false) {
  start = Math.max(0, Math.min(start, body.length))
  end = Math.max(start, Math.min(end, body.length))
  if (wholeLine) {
    start = start === 0 ? 0 : body.lastIndexOf('\n', start - 1) + 1
    const last = end > start && body[end - 1] === '\n' ? end - 1 : end
    const nextLine = body.indexOf('\n', last)
    end = nextLine < 0 ? body.length : nextLine
  }
  if (start === end || !body.slice(start, end).trim())
    throw new Error(
      '먼저 가릴 글자를 선택하거나, 내용이 있는 줄에 커서를 놓아 주세요.',
    )
  const intersecting = masksIn(body).filter(
    (mask) => mask.start < end && mask.end > start,
  )
  if (
    !wholeLine &&
    intersecting.length === 1 &&
    start >= intersecting[0].start &&
    end <= intersecting[0].end
  ) {
    const mask = intersecting[0]
    return {
      body: body.slice(0, mask.start) + mask.text + body.slice(mask.end),
      start: mask.start,
      end: mask.start + mask.text.length,
    }
  }
  if (intersecting.some((mask) => mask.start < start || mask.end > end))
    throw new Error(
      '가린 부분의 경계가 겹쳐요. 해당 부분 전체를 선택해 주세요.',
    )
  const selection = body.slice(start, end)
  const clear = plainText(selection)
  const wrapped = wholeLine
    ? clear
        .split('\n')
        .map((line) => (line.trim() ? `[[${line}]]` : line))
        .join('\n')
    : `[[${clear}]]`
  return {
    body: body.slice(0, start) + wrapped + body.slice(end),
    start,
    end: start + wrapped.length,
  }
}
