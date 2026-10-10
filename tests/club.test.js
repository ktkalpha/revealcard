import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'

test('the secret club is served only to signed-in members', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-club-'))
  const clubDir = join(dir, 'club')
  await mkdir(join(clubDir, 'sub'), { recursive: true })
  await writeFile(join(clubDir, 'index.html'), '<title>club</title>')
  await writeFile(join(clubDir, 'beat.wav'), Buffer.from('RIFF'))
  await writeFile(join(dir, 'secret.txt'), 'outside')
  const server = await createApp({ dataFile: join(dir, 'data.json'), distDir: join(dir, 'dist'), clubDir })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const get = (path, cookie = '', method = 'GET') => fetch(base + path, { method, redirect: 'manual', headers: { Cookie: cookie } })
  try {
    // Signed out: the front page bounces to the main site, everything else is missing.
    const front = await get('/club/')
    assert.equal(front.status, 302)
    assert.equal(front.headers.get('location'), '/')
    assert.equal((await get('/club/beat.wav')).status, 404)
    assert.equal((await get('/club/index.html')).status, 404)
    assert.equal((await get('/club')).status, 302)

    const registered = await fetch(`${base}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'member', password: 'correct-horse-123' }) })
    const cookie = registered.headers.get('set-cookie').split(';')[0]

    assert.equal((await get('/club', cookie)).status, 308)
    const page = await get('/club/', cookie)
    assert.equal(page.status, 200)
    assert.equal(await page.text(), '<title>club</title>')
    assert.match(page.headers.get('content-type'), /text\/html/)
    assert.match(page.headers.get('cache-control'), /private/)
    assert.equal(page.headers.get('cloudflare-cdn-cache-control'), 'no-store')
    assert.match(page.headers.get('x-robots-tag'), /noindex/)
    const wav = await get('/club/beat.wav', cookie)
    assert.equal(wav.status, 200)
    assert.equal(wav.headers.get('content-type'), 'audio/wav')
    assert.equal(wav.headers.get('content-length'), '4')
    assert.equal((await get('/club/beat.wav', cookie, 'HEAD')).status, 200)

    // Nothing outside the club folder, no directories, no writes.
    for (const path of ['/club/sub', '/club/missing.png', '/club/..%2Fsecret.txt', '/club/%2e%2e/secret.txt', '/club/%E0%A4%A'])
      assert.equal((await get(path, cookie)).status, 404, path)
    assert.equal((await fetch(`${base}/club/`, { method: 'POST', headers: { Cookie: cookie } })).status, 405)

    // Visits show up in the admin activity log.
    const { createStore } = await import('../server/store.js')
    await new Promise((resolve) => server.close(resolve))
    const store = await createStore(join(dir, 'data.json'))
    await store.change((data) => { data.users[0].admin = true })
    const again = await createApp({ dataFile: join(dir, 'data.json'), distDir: join(dir, 'dist'), clubDir })
    again.listen(0, '127.0.0.1')
    await once(again, 'listening')
    const log = await fetch(`http://127.0.0.1:${again.address().port}/api/admin/activity`, { headers: { Cookie: cookie } }).then((r) => r.json())
    assert.ok(log.events.some((event) => event.action === 'club-visit' && event.username === 'member'))
    await new Promise((resolve) => again.close(resolve))
  } finally {
    server.close()
    await rm(dir, { recursive: true, force: true })
  }
})
