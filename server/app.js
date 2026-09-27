import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { bodyError } from '../src/lib/masks.js'
import { createStore } from './store.js'

const hashPassword = promisify(scrypt)
const MAX_BODY = 25 * 1024 * 1024
const SESSION_AGE = 30 * 24 * 60 * 60 * 1000
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message)
}
const send = (res, status, value, headers = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  res.end(JSON.stringify(value))
}
const userView = (user) =>
  user && { id: user.id, username: user.username, migrated: !!user.migrated }
const cardInput = (card) => {
  if (
    !card ||
    typeof card.title !== 'string' ||
    !card.title.trim() ||
    card.title.length > 200 ||
    typeof card.body !== 'string' ||
    !card.body.trim() ||
    card.body.length > 20000 ||
    (card.kind !== undefined && card.kind !== 'note') ||
    (card.align !== undefined &&
      !['left', 'center', 'right'].includes(card.align)) ||
    bodyError(card.body)
  )
    fail(400, '카드 제목, 내용 또는 빈칸 표시를 확인해 주세요.')
  return {
    id: randomUUID(),
    title: card.title.trim(),
    body: card.body,
    ...(card.kind === 'note' ? { kind: 'note' } : {}),
    ...(card.align ? { align: card.align } : {}),
  }
}
const nameInput = (name) => {
  if (typeof name !== 'string' || !name.trim() || name.length > 100)
    fail(400, '카드 셋 이름은 1~100자로 입력해 주세요.')
  return name.trim()
}
const visibilityInput = (visibility) => {
  if (!['public', 'private'].includes(visibility))
    fail(400, '공개 설정을 확인해 주세요.')
  return visibility
}
const ownDeck = (data, id, user) => {
  if (!user) fail(401, '로그인이 필요해요.')
  const deck = data.decks.find((item) => item.id === id)
  if (!deck || deck.ownerId !== user.id) fail(404, '카드 셋을 찾을 수 없어요.')
  return deck
}
const visibleDecks = (data, user) =>
  data.decks
    .filter((deck) => deck.visibility === 'public' || deck.ownerId === user?.id)
    .map((deck) => ({
      ...deck,
      ownerName: data.users.find((owner) => owner.id === deck.ownerId)?.username,
      canEdit: deck.ownerId === user?.id,
    }))

async function jsonBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json'))
    fail(415, 'JSON 요청만 받을 수 있어요.')
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) fail(413, '요청이 너무 커요.')
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value))
      fail(400, '요청 내용을 확인해 주세요.')
    return value
  } catch {
    fail(400, '요청 내용을 읽을 수 없어요.')
  }
}

export async function createApp({ dataFile, distDir, secureCookies = false }) {
  const store = await createStore(dataFile)
  const sessions = new Map()
  const attempts = new Map()
  const cookie = (token, maxAge) =>
    `rc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      const path = url.pathname
      if (!path.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, '허용되지 않은 요청이에요.')
        const file = resolve(distDir, `.${path === '/' ? '/index.html' : path}`)
        if (file !== resolve(distDir) && !file.startsWith(resolve(distDir) + sep))
          fail(404, '파일을 찾을 수 없어요.')
        const target = await stat(file).then((info) => info.isFile() ? file : null).catch(() => null)
        if (!target) fail(404, '파일을 찾을 수 없어요.')
        res.writeHead(200, {
          'Content-Type': contentTypes[extname(file)] || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
        })
        if (req.method === 'HEAD') res.end()
        else res.end(await readFile(file))
        return
      }
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method))
        fail(405, '허용되지 않은 요청이에요.')
      if (req.method !== 'GET') {
        const origin = req.headers.origin
        if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`)
          fail(403, '다른 출처의 요청은 허용되지 않아요.')
      }
      const token = /(?:^|;\s*)rc_session=([^;]+)/.exec(req.headers.cookie || '')?.[1]
      const session = sessions.get(token)
      if (session && session.expires < Date.now()) sessions.delete(token)
      const user = session?.expires > Date.now()
        ? store.read().users.find((item) => item.id === session.userId)
        : null
      if (path === '/api/bootstrap' && req.method === 'GET') {
        send(res, 200, { user: userView(user), decks: visibleDecks(store.read(), user) })
        return
      }
      if (path === '/api/register' || path === '/api/login') {
        if (req.method !== 'POST') fail(405, '허용되지 않은 요청이에요.')
        const ip = req.socket.remoteAddress
        const recent = (attempts.get(ip) || []).filter((time) => time > Date.now() - 60000)
        if (recent.length >= 10) fail(429, '잠시 후 다시 시도해 주세요.')
        recent.push(Date.now())
        attempts.set(ip, recent)
        const { username, password } = await jsonBody(req)
        if (
          typeof username !== 'string' ||
          !/^[a-zA-Z0-9_-]{3,32}$/.test(username) ||
          typeof password !== 'string' ||
          password.length < 10 ||
          password.length > 128
        )
          fail(400, '아이디는 영문·숫자 3~32자, 비밀번호는 10~128자로 입력해 주세요.')
        const loginName = username.toLowerCase()
        let account
        if (path === '/api/register') {
          const salt = randomBytes(16).toString('hex')
          const hash = (await hashPassword(password, salt, 64)).toString('hex')
          account = await store.change((data) => {
            if (data.users.some((item) => item.username === loginName))
              fail(409, '이미 사용 중인 아이디예요.')
            const created = { id: randomUUID(), username: loginName, salt, hash, migrated: false }
            data.users.push(created)
            return created
          })
        } else {
          account = store.read().users.find((item) => item.username === loginName)
          const salt = account?.salt || '00000000000000000000000000000000'
          const actual = await hashPassword(password, salt, 64)
          if (!account || !timingSafeEqual(actual, Buffer.from(account.hash, 'hex')))
            fail(401, '아이디 또는 비밀번호가 맞지 않아요.')
        }
        const newToken = randomBytes(32).toString('hex')
        if (token) sessions.delete(token)
        sessions.set(newToken, { userId: account.id, expires: Date.now() + SESSION_AGE })
        send(res, 200, { user: userView(account) }, { 'Set-Cookie': cookie(newToken, SESSION_AGE / 1000) })
        return
      }
      if (path === '/api/logout' && req.method === 'POST') {
        sessions.delete(token)
        send(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) })
        return
      }
      if (!user) fail(401, '로그인이 필요해요.')
      const parts = path.split('/').filter(Boolean)
      const body = req.method === 'GET' || req.method === 'DELETE' ? null : await jsonBody(req)
      if (path === '/api/decks' && req.method === 'POST') {
        const name = nameInput(body?.name)
        const visibility = visibilityInput(body?.visibility)
        const cards = body.cards || []
        if (!Array.isArray(cards) || cards.length > 1000) fail(400, '카드는 최대 1,000장까지 담을 수 있어요.')
        const created = await store.change((data) => {
          const deck = {
            id: randomUUID(), ownerId: user.id, name, visibility,
            cards: cards.map(cardInput),
          }
          data.decks.push(deck)
          return deck
        })
        send(res, 201, { id: created.id })
        return
      }
      if (path === '/api/migrate' && req.method === 'POST') {
        if (!Array.isArray(body?.decks) || body.decks.length > 100)
          fail(400, '가져올 카드 셋을 확인해 주세요.')
        const created = await store.change((data) => {
          const account = data.users.find((item) => item.id === user.id)
          if (account.migrated) fail(409, '이 계정에 브라우저 카드를 이미 가져왔어요.')
          const decks = body.decks.map((item) => {
            const name = nameInput(item.name)
            if (!Array.isArray(item.cards) || item.cards.length > 1000)
              fail(400, '카드 셋은 최대 1,000장까지 담을 수 있어요.')
            return {
              id: randomUUID(), ownerId: user.id, name, visibility: 'private',
              cards: item.cards.map(cardInput),
            }
          })
          data.decks.push(...decks)
          account.migrated = true
          return decks.length
        })
        send(res, 201, { count: created })
        return
      }
      if (parts[0] === 'api' && parts[1] === 'decks' && parts[2]) {
        const id = parts[2]
        if (parts.length === 3 && req.method === 'PATCH') {
          await store.change((data) => {
            const deck = ownDeck(data, id, user)
            if (body.name !== undefined) deck.name = nameInput(body.name)
            if (body.visibility !== undefined)
              deck.visibility = visibilityInput(body.visibility)
          })
        } else if (parts.length === 3 && req.method === 'DELETE') {
          await store.change((data) => {
            ownDeck(data, id, user)
            data.decks = data.decks.filter((deck) => deck.id !== id)
          })
        } else if (parts.length === 4 && parts[3] === 'cards' && req.method === 'POST') {
          if (!Array.isArray(body?.cards) || !body.cards.length)
            fail(400, '추가할 카드가 없어요.')
          await store.change((data) => {
            const deck = ownDeck(data, id, user)
            if (deck.cards.length + body.cards.length > 1000)
              fail(400, '카드 셋은 최대 1,000장까지 담을 수 있어요.')
            const index = Number.isInteger(body.index) &&
              body.index >= 0 && body.index <= deck.cards.length
              ? body.index : deck.cards.length
            deck.cards.splice(index, 0, ...body.cards.map(cardInput))
          })
        } else if (parts.length === 5 && parts[3] === 'cards' && ['PUT', 'DELETE'].includes(req.method)) {
          await store.change((data) => {
            const deck = ownDeck(data, id, user)
            const index = deck.cards.findIndex((card) => card.id === parts[4])
            if (index < 0) fail(404, '카드를 찾을 수 없어요.')
            if (req.method === 'DELETE') deck.cards.splice(index, 1)
            else deck.cards[index] = { ...cardInput(body), id: parts[4] }
          })
        } else fail(404, '요청을 찾을 수 없어요.')
        send(res, 200, { ok: true })
        return
      }
      fail(404, '요청을 찾을 수 없어요.')
    } catch (error) {
      if (!res.headersSent)
        send(res, error.status || 500, { error: error.status ? error.message : '서버에 저장하지 못했어요.' })
    }
  })
}
