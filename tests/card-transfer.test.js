import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'

test('server moves several cards to another set in one step', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-transfer-'))
  const server = await createApp({ dataFile: join(dir, 'data.json'), distDir: dir })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  let cookie = ''
  const request = (path, method = 'GET', body) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined })
  const decks = async () => (await (await request('/api/bootstrap')).json()).decks
  try {
    const registered = await request('/api/register', 'POST', { username: 'transferowner', password: 'correct-horse-123' })
    cookie = registered.headers.get('set-cookie').split(';')[0]
    const made = (name, titles) => request('/api/decks', 'POST', { name, visibility: 'private', cards: titles.map(title => ({ title, body: `${title} 내용` })) }).then(r => r.json())
    const { id: fromId } = await made('출발', ['가', '나', '다', '라'])
    const { id: toId } = await made('도착', ['A'])
    let all = await decks()
    let from = all.find(d => d.id === fromId), to = all.find(d => d.id === toId)
    const [a, b, c] = from.cards
    const transfer = (cardIds, targetId = toId, baseVersion = from.version, targetVersion = to.version) =>
      request(`/api/decks/${fromId}/cards/transfer`, 'POST', { cardIds, targetId, baseVersion, targetVersion })

    assert.equal((await transfer([c.id, a.id])).status, 200)
    all = await decks()
    from = all.find(d => d.id === fromId); to = all.find(d => d.id === toId)
    assert.deepEqual(from.cards.map(x => x.title), ['나', '라'])
    assert.deepEqual(to.cards.map(x => x.title), ['A', '가', '다'])
    assert.deepEqual(to.cards.slice(1).map(x => x.id), [a.id, c.id])

    assert.equal((await transfer([b.id], toId, from.version - 1)).status, 409)
    assert.equal((await transfer([b.id], toId, from.version, to.version - 1)).status, 409)
    assert.equal((await transfer([a.id])).status, 404)
    assert.equal((await transfer([b.id], fromId)).status, 400)
    assert.equal((await transfer([])).status, 400)
    assert.equal((await transfer([b.id, b.id])).status, 400)
    assert.equal((await transfer([b.id], 'missing')).status, 404)
    all = await decks()
    assert.deepEqual(all.find(d => d.id === fromId).cards.map(x => x.title), ['나', '라'])
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})
