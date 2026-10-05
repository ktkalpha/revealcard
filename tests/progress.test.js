import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'
import { emptyProgress, migrateProgress, validOperation } from '../src/lib/progress.js'

test('migration preserves newer server answers and cleared wrong blanks', () => {
  const server = { ratings: { a: 'known' }, positions: {}, wrongMasks: { a: [] } }
  migrateProgress(server, { ratings: { a: 'again', b: 'again' }, wrongMasks: { a: ['old'], b: ['blank'] } })
  assert.deepEqual(server, { ratings: { a: 'known', b: 'again' }, positions: {}, wrongMasks: { a: [], b: ['blank'] } })
  assert.equal(validOperation({ kind: 'ratings', id: '__proto__', value: 'known' }), false)
})

test('two devices share account progress, remain isolated from other accounts and survive restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-progress-'))
  let server, base
  const start = async () => { server = await createApp({ dataFile: join(dir, 'data.json'), distDir: dir }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}` }
  const request = (cookie, path, body) => fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const auth = async (username, path = '/api/register') => (await request('', path, { username, password: 'progress-test-2026' })).headers.get('set-cookie').split(';')[0]
  try {
    await start()
    const a = await auth('progress_one'), device = await auth('progress_one', '/api/login'), b = await auth('progress_two')
    assert.equal((await request('', '/api/progress', { operations: [] })).status, 401)
    assert.equal((await request(a, '/api/progress', { operations: [{ kind: 'ratings', id: 'a', value: 'invalid' }] })).status, 400)
    await request(a, '/api/progress', { legacy: { ratings: { a: 'again' } }, operations: [{ kind: 'ratings', id: 'a', value: 'known' }, { kind: 'wrong', id: 'a', key: '1', value: true }] })
    await request(device, '/api/progress', { operations: [{ kind: 'ratings', id: 'b', value: 'again' }, { kind: 'positions', id: 'deck', value: 'b' }, { kind: 'wrong', id: 'a', key: '2', value: true }] })
    await request(a, '/api/progress', { operations: [{ kind: 'wrong', id: 'a', key: '1', value: false }] })
    const expected = { ratings: { a: 'known', b: 'again' }, positions: { deck: 'b' }, wrongMasks: { a: ['2'] } }
    assert.deepEqual((await (await request(device, '/api/bootstrap')).json()).progress, expected)
    assert.deepEqual((await (await request(b, '/api/bootstrap')).json()).progress, emptyProgress())
    await new Promise(resolve => server.close(resolve)); await start()
    assert.deepEqual((await (await request(a, '/api/bootstrap')).json()).progress, expected)
  } finally { if (server?.listening) await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }) }
})
