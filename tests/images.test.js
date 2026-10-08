import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'
import { boxFromDrag, fitWithin, pathBounds, usableCrop } from '../src/lib/crop.js'
import { CARD_IMAGE_URL, imageMarkdown } from '../src/lib/images.js'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

test('card images need a login to upload and are readable by anyone with the link', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-images-'))
  let server
  try {
    server = await createApp({ dataFile: join(dir, 'cards.json'), distDir: dir })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`
    const post = (path, body, cookie = '') => fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    })
    assert.equal((await post('/api/images', { image: PNG })).status, 401)
    const login = await post('/api/register', { username: 'alice', password: 'correct-horse-123' })
    const cookie = login.headers.get('set-cookie').split(';')[0]
    assert.equal((await post('/api/images', { image: 'data:image/png;base64,AAAA' }, cookie)).status, 400)
    assert.equal((await post('/api/images', { image: 'data:image/svg+xml;base64,AAAA' }, cookie)).status, 400)
    const saved = await post('/api/images', { image: PNG }, cookie)
    assert.equal(saved.status, 201)
    const { url } = await saved.json()
    assert.match(url, CARD_IMAGE_URL)
    const image = await fetch(base + url)
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('content-type'), 'image/png')
    assert.equal((await fetch(base + '/api/images/' + '0'.repeat(36) + '.png')).status, 404)
    assert.equal((await fetch(base + '/api/images/..%2Fcards.json')).status, 404)
  } finally {
    server?.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('image markdown only embeds app-hosted photos', () => {
  const url = '/api/images/00000000-0000-0000-0000-000000000000.png'
  assert.equal(imageMarkdown('지도 [1]', url), `![지도  1](${url})`)
  assert.equal(imageMarkdown('', url), `![사진](${url})`)
  assert.equal(CARD_IMAGE_URL.test('https://example.com/a.png'), false)
  assert.equal(CARD_IMAGE_URL.test('/api/images/../x.png'), false)
})

test('box crops stay inside the image and honor a locked ratio', () => {
  const size = { width: 400, height: 300 }
  assert.deepEqual(boxFromDrag({ x: 100, y: 100 }, { x: 50, y: 40 }, size, 0), { x: 50, y: 40, width: 50, height: 60 })
  assert.deepEqual(boxFromDrag({ x: 300, y: 200 }, { x: 900, y: 900 }, size, 0), { x: 300, y: 200, width: 100, height: 100 })
  const square = boxFromDrag({ x: 10, y: 10 }, { x: 200, y: 80 }, size, 1)
  assert.equal(square.width, square.height)
  assert.deepEqual(square, { x: 10, y: 10, width: 70, height: 70 })
  const wide = boxFromDrag({ x: 390, y: 290 }, { x: 0, y: 0 }, size, 16 / 9)
  assert.ok(wide.x >= 0 && wide.y >= 0 && Math.abs(wide.width / wide.height - 16 / 9) < 1e-9)
})

test('free-form crops use the path bounds and tiny selections are ignored', () => {
  assert.deepEqual(pathBounds([{ x: 5, y: 9 }, { x: 25, y: 3 }, { x: 15, y: 30 }]), { x: 5, y: 3, width: 20, height: 27 })
  assert.equal(pathBounds([]), null)
  assert.equal(usableCrop({ x: 0, y: 0, width: 3, height: 50 }), false)
  assert.equal(usableCrop({ x: 0, y: 0, width: 30, height: 50 }), true)
  assert.deepEqual(fitWithin(3200, 1600, 1600), { width: 1600, height: 800 })
  assert.deepEqual(fitWithin(100, 50, 1600), { width: 100, height: 50 })
})
