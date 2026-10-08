import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'

test('server moves a card to a new position with version checks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-move-'))
  const server = await createApp({ dataFile: join(dir, 'data.json'), distDir: dir })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  let cookie = ''
  const request = (path, method = 'GET', body) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined })
  const deckState = async () => (await (await request('/api/bootstrap')).json()).decks[0]
  try {
    const registered = await request('/api/register', 'POST', { username: 'moveowner', password: 'correct-horse-123' })
    cookie = registered.headers.get('set-cookie').split(';')[0]
    const { id } = await (await request('/api/decks', 'POST', { name: '순서', visibility: 'private', cards: ['가', '나', '다'].map(title => ({ title, body: `${title} 내용` })) })).json()
    let deck = await deckState()
    const [a, b, c] = deck.cards
    const move = (card, index, baseVersion) => request(`/api/decks/${id}/cards/${card.id}/move`, 'POST', { index, baseVersion })
    assert.equal((await move(a, 2, deck.version)).status, 200)
    deck = await deckState()
    assert.deepEqual(deck.cards.map(x => x.title), ['나', '다', '가'])
    assert.equal((await move(c, 0, deck.version - 1)).status, 409)
    assert.equal((await move(c, 3, deck.version)).status, 400)
    assert.equal((await move(c, -1, deck.version)).status, 400)
    assert.equal((await move({ id: 'missing' }, 0, deck.version)).status, 404)
    const before = deck.version
    assert.equal((await move(c, 1, before)).status, 200)
    assert.equal((await deckState()).version, before)
    assert.equal((await move(b, 1, before)).status, 200)
    assert.deepEqual((await deckState()).cards.map(x => x.title), ['다', '나', '가'])
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})
