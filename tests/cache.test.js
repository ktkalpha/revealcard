import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'

test('HTML and PWA update files bypass caches while hashed assets remain immutable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-cache-'))
  let server
  try {
    await mkdir(join(dir, 'assets'))
    for (const name of ['index.html', 'sw.js', 'registerSW.js', 'manifest.webmanifest', 'workbox-123abc.js', 'assets/index-abc123.js'])
      await writeFile(join(dir, name), 'release-one')
    server = await createApp({ dataFile: join(dir, 'data.json'), distDir: dir })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`
    for (const path of ['/', '/sw.js', '/registerSW.js', '/manifest.webmanifest', '/workbox-123abc.js']) {
      const res = await fetch(base + path)
      assert.equal(res.status, 200)
      assert.equal(res.headers.get('cache-control'), 'no-store')
      assert.equal(res.headers.get('cloudflare-cdn-cache-control'), 'no-store')
    }
    const recovery = await fetch(base + '/api/app-update')
    assert.equal(recovery.status, 200)
    assert.match(recovery.headers.get('content-type'), /text\/html/)
    assert.equal(recovery.headers.get('cache-control'), 'no-store')
    assert.match(await recovery.text(), /updateViaCache: 'none'/)
    const asset = await fetch(base + '/assets/index-abc123.js')
    assert.match(asset.headers.get('cache-control'), /immutable/)
    await writeFile(join(dir, 'sw.js'), 'release-two')
    assert.equal(await (await fetch(base + '/sw.js')).text(), 'release-two')
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})
