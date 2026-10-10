import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApp } from '../server/app.js'
import { createGrader } from '../server/grader.js'

test('meaning grading needs a login, maps Jev levels to verdicts and limits each account', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'revealcard-grader-'))
  const sent = []
  const fetcher = async (url, options) => {
    sent.push({ url, headers: options.headers, body: JSON.parse(options.body) })
    const { student_answer } = JSON.parse(JSON.parse(options.body).state)
    const score = student_answer.includes('같은') ? 1.9 : student_answer.includes('일부') ? 1 : 0.1
    return new Response(JSON.stringify({ answers: { grade: { type: 'score', score } } }), { status: 200 })
  }
  const server = await createApp({ dataFile: join(dir, 'data.json'), distDir: dir, grader: createGrader({ apiKey: 'test-key', fetcher }) })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const post = async (body, cookie = '') => {
    const response = await fetch(`${base}/api/grade`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) })
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  try {
    assert.equal((await post({ answer: '정답', input: '같은 뜻' })).status, 401)
    const account = await fetch(`${base}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'grader', password: 'correct-horse-123' }) })
    const cookie = account.headers.get('set-cookie').split(';')[0]
    assert.deepEqual((await post({ answer: '안빈낙도의 삶', input: '같은 뜻' }, cookie)).data, { verdict: 'correct', score: 0.95 })
    assert.equal((await post({ answer: '안빈낙도의 삶', input: '일부만' }, cookie)).data.verdict, 'close')
    assert.equal((await post({ answer: '안빈낙도의 삶', input: '다른 답' }, cookie)).data.verdict, 'wrong')
    assert.equal((await post({ answer: '', input: '답' }, cookie)).status, 400)
    assert.equal(sent[0].headers.Authorization, 'Bearer test-key')
    assert.deepEqual(JSON.parse(sent[0].body.state), { model_answer: '안빈낙도의 삶', student_answer: '같은 뜻' })
    let status
    for (let i = 0; i < 30 && status !== 429; i++) status = (await post({ answer: '안빈낙도의 삶', input: '같은 뜻' }, cookie)).status
    assert.equal(status, 429)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})

test('without an API key the grader is off', async () => {
  const grader = createGrader({ apiKey: '' })
  assert.equal(grader.enabled(), false)
})
