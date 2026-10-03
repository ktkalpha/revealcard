import test from 'node:test'
import assert from 'node:assert/strict'
import { matchingPairs, matchingError, shuffled } from '../src/lib/matching.js'
import { exportCardSet, parseCardSet } from '../src/cardSet.js'

const card = { title: '스페셜 퀴즈', kind: 'matching', body: '김상옥 | 종로 경찰서에 폭탄 투척\n윤봉길 | 상하이 훙커우 공원에서 폭탄 투척' }
test('matching pairs preserve identities after independently shuffling columns', () => {
  const pairs = matchingPairs(card.body)
  const names = shuffled(pairs, () => 0)
  const achievements = shuffled(pairs, () => 0.99)
  assert.notDeepEqual(names.map(p => p.id), achievements.map(p => p.id))
  for (const name of names) assert.equal(achievements.find(p => p.id === name.id).achievement, pairs[name.id].achievement)
  assert.equal(pairs[0].name, '김상옥')
})
test('matching export and import preserve type and reject ambiguous or malformed pairs', () => {
  assert.deepEqual(parseCardSet(JSON.stringify(exportCardSet([card], '한국사2'))).cards, [card])
  for (const body of ['한 쌍 | 업적', '이름 | 업적\n이름 | 다른 업적', '이름 | 업적\n다른 이름 | 업적', '이름 | 업적\n잘못된 줄', '이름 | 업적 | 추가\n둘 | 업적2']) {
    assert.ok(matchingError(body))
    assert.throws(() => parseCardSet(JSON.stringify(exportCardSet([{ ...card, body }]))))
  }
  assert.equal(matchingError(card.body), '')
  assert.ok(matchingError(Array.from({length: 21}, (_, i) => `이름${i} | 업적${i}`).join('\n')))
})

test('server persists matching type, inserts at requested position, and validates edits', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { once } = await import('node:events')
  const { createApp } = await import('../server/app.js')
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-matching-'))
  const dataFile = join(dir, 'data.json')
  let server = await createApp({ dataFile, distDir: dir })
  const listen = async () => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}` }
  let base = await listen()
  let cookie = ''
  const request = async (path, method = 'GET', body) => {
    const deckId = /^\/api\/decks\/([^/]+)/.exec(path)?.[1]
    if (deckId && body) {
      const decks = (await (await fetch(base + '/api/bootstrap', { headers: { Cookie: cookie } })).json()).decks
      body = { ...body, baseVersion: decks.find((deck) => deck.id === deckId)?.version }
    }
    return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined })
  }
  try {
    const registered = await request('/api/register', 'POST', { username: 'matchingowner', password: 'correct-horse-123' })
    cookie = registered.headers.get('set-cookie').split(';')[0]
    const created = await request('/api/decks', 'POST', { name: '역사', visibility: 'public', cards: [{ title: '앞', body: '앞 내용' }, { title: '뒤', body: '뒤 내용' }] })
    const { id } = await created.json()
    const path = `/api/decks/${id}/cards`
    assert.equal((await request(path, 'POST', { index: 1, cards: [card] })).status, 200)
    let cards = (await (await request('/api/bootstrap')).json()).decks[0].cards
    assert.deepEqual(cards.map(c => c.title), ['앞', card.title, '뒤'])
    assert.equal(cards[1].kind, 'matching')
    assert.equal((await request(`${path}/${cards[1].id}`, 'PUT', { ...card, body: '오류' })).status, 400)
    assert.equal((await request(`${path}/${cards[1].id}`, 'PUT', { ...card, title: '게임 수정' })).status, 200)
    await new Promise(resolve => server.close(resolve))
    server = await createApp({ dataFile, distDir: dir })
    base = await listen()
    cards = (await (await request('/api/bootstrap')).json()).decks[0].cards
    assert.equal(cards[1].kind, 'matching')
    assert.equal(cards[1].title, '게임 수정')
    assert.equal(cards[1].body, card.body)
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})
