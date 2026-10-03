import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'

test('anonymous revisions persist, restore without erasing history, and reject stale writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-versions-'))
  const dataFile = join(dir, 'data.json')
  let server
  let base
  const start = async () => {
    server = await createApp({ dataFile, distDir: dir })
    server.listen(0, '127.0.0.1'); await once(server, 'listening')
    base = `http://127.0.0.1:${server.address().port}`
  }
  const request = async (path, method = 'GET', body, cookie = '', headers = {}) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: body ? JSON.stringify(body) : undefined })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  try {
    await start()
    const owner = await request('/api/register', 'POST', { username: 'versionowner', password: 'correct-horse-123' })
    const created = await request('/api/decks', 'POST', { name: 'Open', visibility: 'public', cards: [{ title: 'Original', body: 'Original body' }] }, owner.cookie)
    const path = `/api/decks/${created.data.id}`
    const card = (await request('/api/bootstrap')).data.decks[0].cards[0]
    assert.equal((await request(`${path}/cards/${card.id}`, 'PUT', { ...card, title: 'Anonymous' })).status, 428)
    assert.equal((await request(`${path}/cards/${card.id}`, 'PUT', { ...card, title: 'Anonymous', baseVersion: 0 })).status, 200)
    assert.equal((await request(`${path}/cards/${card.id}`, 'PUT', { ...card, title: 'Stale', baseVersion: 0 })).status, 409)
    assert.equal((await request(path, 'PATCH', { visibility: 'private', baseVersion: 1 })).status, 401)
    assert.equal((await request(path, 'DELETE')).status, 401)
    assert.equal((await request(`${path}/cards/${card.id}`, 'DELETE', undefined, '', { 'If-Match': '1' })).status, 200)
    assert.equal((await request(`${path}/restore`, 'POST', { version: 0, baseVersion: 2 })).status, 200)
    let history = (await request(`${path}/history`)).data.revisions
    assert.deepEqual(history.map((item) => item.version), [0, 1, 2, 3])
    assert.equal(history[1].editor, '익명')
    assert.equal(history[1].cards[0].title, 'Anonymous')
    assert.equal(history[2].cards.length, 0)
    assert.equal(history[3].cards[0].id, card.id)
    await new Promise((resolve) => server.close(resolve))
    await start()
    history = (await request(`${path}/history`)).data.revisions
    assert.equal(history.length, 4)
    assert.equal((await request('/api/bootstrap')).data.decks[0].cards[0].title, 'Original')
    const login = await request('/api/login', 'POST', { username: 'versionowner', password: 'correct-horse-123' })
    assert.equal((await request(path, 'PATCH', { visibility: 'private', baseVersion: 3 }, login.cookie)).status, 200)
    assert.equal((await request(`${path}/history`)).status, 404)
    assert.equal((await request(`${path}/restore`, 'POST', { version: 0, baseVersion: 4 })).status, 404)
    assert.equal((await request(`${path}/cards`, 'POST', { cards: [card], baseVersion: 4 })).status, 404)
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})
