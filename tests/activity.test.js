import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'
import { createStore } from '../server/store.js'

test('admins can read the activity log; other users cannot', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-activity-'))
  const dataFile = join(dir, 'data.json')
  const start = async () => {
    const server = await createApp({ dataFile, distDir: dir })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    return server
  }
  let server = await start()
  const jar = {}
  const request = async (who, path, method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: jar[who] || '', 'CF-Connecting-IP': '203.0.113.7' }, body: body ? JSON.stringify(body) : undefined })
    const cookie = response.headers.get('set-cookie')
    if (cookie) jar[who] = cookie.split(';')[0]
    return response
  }
  try {
    await request('boss', '/api/register', 'POST', { username: 'boss', password: 'correct-horse-123' })
    await request('student', '/api/register', 'POST', { username: 'student', password: 'correct-horse-123' })
    await request('student', '/api/login', 'POST', { username: 'student', password: 'wrong-password-1' })
    await request('student', '/api/decks', 'POST', { name: '내 셋', visibility: 'private', cards: [{ title: '가', body: '[[나]]' }] })
    assert.equal((await request('boss', '/api/admin/activity')).status, 403)
    assert.equal((await request('guest', '/api/admin/activity')).status, 403)
    assert.equal((await request('boss', '/api/bootstrap').then((r) => r.json())).user.admin, undefined)

    await new Promise((resolve) => server.close(resolve))
    const store = await createStore(dataFile)
    await store.change((data) => { data.users.find((user) => user.username === 'boss').admin = true })
    server = await start()

    const me = await request('boss', '/api/bootstrap').then((r) => r.json())
    assert.equal(me.user.admin, true)
    await request('guest', '/api/bootstrap')
    const log = await request('boss', '/api/admin/activity').then((r) => r.json())
    assert.deepEqual(log.events.map((event) => event.action).reverse(), ['register', 'register', 'login-failed', 'create-deck'])
    assert.equal(log.events[0].deck, '내 셋')
    assert.equal(log.events[0].ip, '203.0.113.7')
    assert.ok(log.online.some((item) => item.username === 'boss'))
    assert.ok(log.online.some((item) => item.username === null))
    assert.deepEqual(log.accounts.map((item) => [item.username, item.admin, item.online]), [['boss', true, true], ['student', false, false]])
    assert.ok(!JSON.stringify(log).includes('hash'))
    assert.match(await readFile(join(dir, 'activity.log'), 'utf8'), /login-failed/)

    const studentDeck = (await request('student', '/api/bootstrap').then((r) => r.json())).decks[0]
    const listed = (await request('boss', '/api/bootstrap').then((r) => r.json())).decks.find((deck) => deck.id === studentDeck.id)
    assert.deepEqual([listed.adminView, listed.canEdit, listed.cards.length, listed.cardCount, listed.ownerName], [true, false, 0, 1, 'student'])
    assert.equal((await request('student', `/api/admin/decks/${studentDeck.id}`)).status, 403)
    const opened = await request('boss', `/api/admin/decks/${studentDeck.id}`).then((r) => r.json())
    assert.equal(opened.cards[0].title, '가')
    assert.equal((await request('boss', `/api/decks/${studentDeck.id}/cards`, 'POST', { cards: [{ title: 'x', body: '[[y]]' }], baseVersion: 0 })).status, 404)
    const viewed = (await request('boss', '/api/admin/activity').then((r) => r.json())).events[0]
    assert.deepEqual([viewed.action, viewed.username, viewed.deck, viewed.owner], ['admin-view-deck', 'boss', '내 셋', 'student'])
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})

test('admins can kick a user, which ends every session and blocks login until unbanned', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-kick-'))
  const dataFile = join(dir, 'data.json')
  const start = async () => {
    const server = await createApp({ dataFile, distDir: dir })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    return server
  }
  let server = await start()
  const jar = {}
  const request = async (who, path, method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: jar[who] || '' }, body: body ? JSON.stringify(body) : undefined })
    const cookie = response.headers.get('set-cookie')
    if (cookie) jar[who] = cookie.split(';')[0]
    return response
  }
  const password = 'correct-horse-123'
  try {
    for (const name of ['boss', 'chief', 'student']) await request(name, '/api/register', 'POST', { username: name, password })
    await request('student-phone', '/api/login', 'POST', { username: 'student', password })
    await request('student', '/api/decks', 'POST', { name: '공개 셋', visibility: 'public', cards: [{ title: '가', body: '[[나]]' }] })
    assert.equal((await request('student', '/api/admin/users/boss/kick', 'POST')).status, 403)
    assert.equal((await request('guest', '/api/admin/users/student/kick', 'POST')).status, 403)

    await new Promise((resolve) => server.close(resolve))
    const store = await createStore(dataFile)
    await store.change((data) => { for (const user of data.users) if (user.username !== 'student') user.admin = true })
    server = await start()

    assert.equal((await request('boss', '/api/admin/users/chief/kick', 'POST')).status, 400)
    assert.equal((await request('boss', '/api/admin/users/nobody/kick', 'POST')).status, 404)
    const kicked = await request('boss', '/api/admin/users/student/kick', 'POST').then((r) => r.json())
    const account = kicked.accounts.find((item) => item.username === 'student')
    assert.equal(account.banned, true)
    assert.ok(account.bannedAt)
    assert.equal(kicked.online.some((item) => item.username === 'student'), false)
    assert.deepEqual(kicked.events[0].action === 'admin-kick' && [kicked.events[0].username, kicked.events[0].target], ['boss', 'student'])
    for (const device of ['student', 'student-phone']) {
      assert.equal((await request(device, '/api/bootstrap').then((r) => r.json())).user, null)
      assert.equal((await request(device, '/api/decks', 'POST', { name: '새 셋', visibility: 'private' })).status, 401)
    }
    const blocked = await request('student', '/api/login', 'POST', { username: 'student', password })
    assert.equal(blocked.status, 403)
    assert.equal((await request('student', '/api/login', 'POST', { username: 'student', password: 'wrong-password-1' })).status, 401)
    // The kicked user's public cards stay available.
    assert.equal((await request('guest', '/api/bootstrap').then((r) => r.json())).decks.length, 1)

    const unbanned = await request('boss', '/api/admin/users/student/unban', 'POST').then((r) => r.json())
    assert.equal(unbanned.accounts.find((item) => item.username === 'student').banned, false)
    assert.equal((await request('student', '/api/login', 'POST', { username: 'student', password })).status, 200)
    assert.equal((await request('student', '/api/bootstrap').then((r) => r.json())).user.username, 'student')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})
