export async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: { ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
  })
  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('서버 응답을 읽지 못했어요.')
  }
  if (!response.ok) throw new Error(result.error || '요청에 실패했어요.')
  return result
}
