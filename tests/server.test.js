import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'

test('public sets allow collaborative edits while private sets remain owner-only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-test-'))
  const dataFile = join(dir, 'cards.json')
  let server
  try {
    server = await createApp({ dataFile, distDir: dir })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`
    const request = async (path, method = 'GET', body, cookie = '', origin = base) => {
      const deckId = /^\/api\/decks\/([^/]+)/.exec(path)?.[1]
      const current = deckId && (await (await fetch(base + '/api/bootstrap', { headers: { Cookie: cookie } })).json()).decks.find((deck) => deck.id === deckId)
      if (body && current) body = { ...body, baseVersion: current.version }
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(current && method === 'DELETE' ? { 'If-Match': String(current.version) } : {}),
          ...(method !== 'GET' ? { Origin: origin } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
    }
    const a = await request('/api/register', 'POST', {
      username: 'alice', password: 'correct-horse-123',
    })
    assert.equal(a.status, 200)
    const own = await request('/api/decks', 'POST', {
      name: '개인 노트', visibility: 'private',
      cards: [{ title: '비밀', body: '[[정답]]' }],
    }, a.cookie)
    assert.equal(own.status, 201)
    const id = own.data.id
    assert.deepEqual((await request('/api/bootstrap')).data.decks, [])
    const b = await request('/api/register', 'POST', {
      username: 'bob', password: 'another-good-123',
    })
    assert.deepEqual((await request('/api/bootstrap', 'GET', null, b.cookie)).data.decks, [])
    assert.equal((await request(`/api/decks/${id}`, 'PATCH', { visibility: 'public' }, b.cookie)).status, 404)
    assert.equal((await request(`/api/decks/${id}/cards`, 'POST', {
      cards: [{ title: '침입', body: '내용' }],
    }, b.cookie)).status, 404)
    assert.equal((await request(`/api/decks/${id}`, 'PATCH', {
      visibility: 'public',
    }, a.cookie)).status, 200)
    const publicView = (await request('/api/bootstrap')).data.decks
    assert.equal(publicView.length, 1)
    assert.equal(publicView[0].canEdit, true)
    assert.equal(publicView[0].canManage, false)
    assert.equal(publicView[0].cards[0].title, '비밀')
    assert.equal((await request(`/api/decks/${id}/cards/${publicView[0].cards[0].id}`, 'PUT', { title: '비밀', body: '[[정답]]' }, b.cookie)).status, 200)
    assert.equal((await request(`/api/decks/${id}`, 'PATCH', {
      visibility: 'private',
    }, a.cookie)).status, 200)
    assert.deepEqual((await request('/api/bootstrap')).data.decks, [])
    assert.equal((await request(`/api/decks/${id}`, 'DELETE', null, a.cookie, 'https://other.example')).status, 403)
    assert.equal((await request(`/api/decks/${id}/cards`, 'POST', {
      cards: [{ title: '오류', body: '[[미완성' }],
    }, a.cookie)).status, 400)
    assert.equal((await request('/api/bootstrap', 'GET', null, a.cookie)).data.decks[0].cards.length, 1)
    await new Promise((resolve) => server.close(resolve))
    server = await createApp({ dataFile, distDir: dir })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const persisted = (await fetch(`http://127.0.0.1:${server.address().port}/api/bootstrap`)).json()
    assert.deepEqual((await persisted).decks, [])
    const login = await fetch(`http://127.0.0.1:${server.address().port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'correct-horse-123' }),
    })
    assert.equal(login.status, 200)
    const saved = await fetch(`http://127.0.0.1:${server.address().port}/api/bootstrap`, {
      headers: { Cookie: login.headers.get('set-cookie').split(';')[0] },
    })
    assert.equal((await saved.json()).decks[0].cards[0].title, '비밀')
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})

test('browser migration is private and can only run once per account', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-migrate-'))
  const server = await createApp({ dataFile: join(dir, 'cards.json'), distDir: dir })
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`
    const register = await fetch(base + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'migrator', password: 'secure-pass-123' }),
    })
    const cookie = register.headers.get('set-cookie').split(';')[0]
    const migrate = () => fetch(base + '/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        decks: [{ name: '예전 카드', cards: [{ title: '하나', body: '내용' }] }],
      }),
    })
    assert.equal((await migrate()).status, 201)
    assert.equal((await migrate()).status, 409)
    const privateView = await fetch(base + '/api/bootstrap', { headers: { Cookie: cookie } })
    assert.equal((await privateView.json()).decks[0].visibility, 'private')
    assert.deepEqual((await (await fetch(base + '/api/bootstrap')).json()).decks, [])
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})

test('public notes allow anonymous editing and reject unknown kinds', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-note-'))
  const server = await createApp({ dataFile: join(dir, 'cards.json'), distDir: dir })
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`
    const request = async (path, method = 'GET', body, cookie = '') => {
      const deckId = /^\/api\/decks\/([^/]+)/.exec(path)?.[1]
      const current = deckId && (await (await fetch(base + '/api/bootstrap', { headers: { Cookie: cookie } })).json()).decks.find((deck) => deck.id === deckId)
      if (body && current) body = { ...body, baseVersion: current.version }
      const response = await fetch(base + path, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      })
      return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
    }
    const owner = await request('/api/register', 'POST', { username: 'noteowner', password: 'correct-horse-123' })
    const deck = await request('/api/decks', 'POST', { name: '노트', visibility: 'public' }, owner.cookie)
    const path = `/api/decks/${deck.data.id}/cards`
    const note = { title: '역사', body: '- 서간도\n  - [[경학사]]', kind: 'note' }
    assert.equal((await request(path, 'POST', { cards: [note] }, owner.cookie)).status, 200)
    const publicView = (await request('/api/bootstrap')).data.decks[0].cards[0]
    assert.equal(publicView.kind, 'note')
    assert.equal(publicView.body, note.body)
    assert.equal((await request(`${path}/${publicView.id}`, 'PUT', { ...note, title: '익명 수정' })).status, 200)
    assert.equal((await request(`${path}/${publicView.id}`, 'PUT', { ...note, title: '수정' }, owner.cookie)).status, 200)
    assert.equal((await request('/api/bootstrap', 'GET', null, owner.cookie)).data.decks[0].cards[0].kind, 'note')
    assert.equal((await request(path, 'POST', { cards: [{ ...note, kind: 'unknown' }] }, owner.cookie)).status, 400)
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})
