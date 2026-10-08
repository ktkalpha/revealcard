import { emptyProgress, applyProgress, validOperation, migrateProgress } from '../src/lib/progress.js'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { classificationError } from '../src/lib/classification.js'
import { matchingError } from '../src/lib/matching.js'
import { passageError, passageData } from '../src/lib/passage.js'
import { bodyError } from '../src/lib/masks.js'
import { createStore } from './store.js'
import { createPets } from './pets.js'
import { createImages } from './images.js'

const hashPassword = promisify(scrypt)
const MAX_BODY = 25 * 1024 * 1024
const SESSION_AGE = 30 * 24 * 60 * 60 * 1000
const BROWSER_SESSION_AGE = 24 * 60 * 60 * 1000
const sessionKey = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
  ? createHash('sha256').update(token).digest('hex') : null
const liveSession = session => session && typeof session.userId === 'string' && Number.isFinite(session.expires) && session.expires > Date.now()
const pruneSessions = data => {
  data.sessions ||= {}
  for (const [key,session] of Object.entries(data.sessions))
    if (!liveSession(session)) delete data.sessions[key]
}
const contentTypes = {
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
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
    (card.kind !== undefined && !['note', 'matching', 'passage', 'classification'].includes(card.kind)) ||
    (card.align !== undefined &&
      !['left', 'center', 'right'].includes(card.align)) ||
    (card.kind === 'classification' ? classificationError(card.body) : card.kind === 'matching' ? matchingError(card.body) : bodyError(card.body)) ||
    (card.kind === 'passage' && passageError(card))
  )
    fail(400, '카드 제목, 내용 또는 빈칸 표시를 확인해 주세요.')
  return {
    id: randomUUID(),
    title: card.title.trim(),
    body: card.body,
    ...(['note', 'matching', 'passage', 'classification'].includes(card.kind) ? { kind: card.kind } : {}),
    ...(card.align ? { align: card.align } : {}),
    ...(card.kind === 'passage' ? passageData(card) : {}),
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
const editableDeck = (data, id, user) => {
  const deck = data.decks.find((item) => item.id === id)
  if (!deck || (deck.visibility !== 'public' && deck.ownerId !== user?.id))
    fail(404, '카드 셋을 찾을 수 없어요.')
  return deck
}
const snapshot = (deck, user, action) => ({
  version: deck.version || 0, name: deck.name, cards: structuredClone(deck.cards),
  timestamp: new Date().toISOString(), editor: user?.username || '익명', action,
})
const beginEdit = (data, deck, user, expected) => {
  if (!Number.isInteger(expected)) fail(428, '최신 버전을 불러온 뒤 다시 저장해 주세요.')
  if (expected !== (deck.version || 0)) fail(409, '다른 사용자가 수정했어요. 작성 내용을 보관하고 최신 버전을 확인해 주세요.')
  data.revisions ||= {}
  data.revisions[deck.id] ||= [snapshot(deck, null, 'initial')]
}
const finishEdit = (data, deck, user, action) => {
  deck.version = (deck.version || 0) + 1
  data.revisions[deck.id].push(snapshot(deck, user, action))
}
const visibleDecks = (data, user) =>
  data.decks
    .filter((deck) => deck.visibility === 'public' || deck.ownerId === user?.id)
    .map((deck) => ({
      ...deck,
      ownerName: data.users.find((owner) => owner.id === deck.ownerId)?.username,
      canEdit: deck.visibility === 'public' || deck.ownerId === user?.id,
      canManage: deck.ownerId === user?.id,
      version: deck.version || 0,
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
  const pets = createPets(resolve(dirname(dataFile), 'pets'))
  const images = createImages(resolve(dirname(dataFile), 'images'))
  // Only token hashes are persisted; the bearer token stays in the HttpOnly cookie.
  if (Object.values(store.read().sessions || {}).some(session => !liveSession(session)))
    await store.change(pruneSessions)
  const attempts = new Map()
  const cookie = (token, maxAge) =>
    `rc_session=${token}; Path=/; HttpOnly; SameSite=Lax${maxAge === undefined ? '' : `; Max-Age=${maxAge}`}${secureCookies ? '; Secure' : ''}`

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      const path = url.pathname
      if (path === '/api/app-update' && ['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Cloudflare-CDN-Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        res.end(req.method === 'HEAD' ? undefined : await readFile(new URL('./update.html', import.meta.url)))
        return
      }
      if (!path.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, '허용되지 않은 요청이에요.')
        const file = resolve(distDir, `.${path === '/' ? '/index.html' : path}`)
        if (file !== resolve(distDir) && !file.startsWith(resolve(distDir) + sep))
          fail(404, '파일을 찾을 수 없어요.')
        const target = await stat(file).then((info) => info.isFile() ? file : null).catch(() => null)
        if (!target) fail(404, '파일을 찾을 수 없어요.')
        res.writeHead(200, {
          'Content-Type': contentTypes[extname(file)] || 'application/octet-stream',
          // Only content-hashed build assets are safe to cache across releases.
          'Cache-Control': /^\/assets\/.+-[\w-]+\.(js|css)$/.test(path)
            ? 'public, max-age=31536000, immutable'
            : 'no-store',
          'Cloudflare-CDN-Cache-Control': path.startsWith('/assets/')
            ? 'public, max-age=31536000'
            : 'no-store',
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
      const key = sessionKey(token)
      const session = key ? store.read().sessions?.[key] : null
      const user = liveSession(session)
        ? store.read().users.find((item) => item.id === session.userId)
        : null
      if (path === '/api/pet' || path.startsWith('/api/pet/')) {
        if (!user) fail(401, '커스텀 펫은 로그인한 사용자 전용이에요.')
        if (path.startsWith('/api/pet/assets/') && req.method === 'GET') {
          const name=path.slice('/api/pet/assets/'.length)
          const bytes=await pets.asset(user.id,name)
          res.writeHead(200, {'Content-Type':name.endsWith('.jpg')?'image/jpeg':name.endsWith('.webp')?'image/webp':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
          res.end(bytes);return
        }
        let result
        if(path === '/api/pet' && req.method === 'GET')result=await pets.get(user.id)
        else if(path === '/api/pet' && req.method === 'PUT')result=await pets.settings(user.id,await jsonBody(req))
        else if(path === '/api/pet/reference' && req.method === 'POST')result=await pets.reference(user.id,(await jsonBody(req)).image)
        else if(path === '/api/pet/generate' && req.method === 'POST'){
          const {confirmed}=await jsonBody(req)
          if(confirmed!==true)fail(400,'완료를 눌러 펫 생성을 시작해 주세요.')
          result=await pets.generate(user.id)
        }
        else if(path === '/api/pet/cancel' && req.method === 'POST')result=await pets.cancel(user.id,(await jsonBody(req)).jobId)
        else fail(404,'요청을 찾을 수 없어요.')
        send(res,200,result);return
      }
      if (path.startsWith('/api/images/') && req.method === 'GET') {
        const name = path.slice('/api/images/'.length)
        const bytes = await images.read(name)
        res.writeHead(200, {
          'Content-Type': name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.webp') ? 'image/webp' : 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'",
        })
        res.end(bytes)
        return
      }
      if (path === '/api/images' && req.method === 'POST') {
        if (!user) fail(401, '사진을 올리려면 로그인이 필요해요.')
        const { image } = await jsonBody(req)
        const saved = await images.save(image)
        send(res, 201, { url: saved.url })
        return
      }
      if (path === '/api/bootstrap' && req.method === 'GET') {
        send(res, 200, { user: userView(user), decks: visibleDecks(store.read(), user), progress: user ? store.read().progress?.[user.id] || emptyProgress() : emptyProgress() })
        return
      }
      if (path === '/api/progress' && req.method === 'POST') {
        if (!user) fail(401, '로그인이 필요해요.')
        const { operations = [], legacy } = await jsonBody(req)
        if (!Array.isArray(operations) || operations.length > 1000 || !operations.every(validOperation))
          fail(400, '학습 기록을 확인해 주세요.')
        if (legacy !== undefined && (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)))
          fail(400, '학습 기록을 확인해 주세요.')
        const progress = await store.change(data => {
          data.progress ||= {}
          const target = data.progress[user.id] ||= emptyProgress()
          if (legacy) migrateProgress(target, legacy)
          for (const operation of operations) applyProgress(target, operation)
          return target
        })
        send(res, 200, { progress })
        return
      }
      if (path === '/api/register' || path === '/api/login') {
        if (req.method !== 'POST') fail(405, '허용되지 않은 요청이에요.')
        const ip = req.socket.remoteAddress
        const recent = (attempts.get(ip) || []).filter((time) => time > Date.now() - 60000)
        if (recent.length >= 10) fail(429, '잠시 후 다시 시도해 주세요.')
        recent.push(Date.now())
        attempts.set(ip, recent)
        const { username, password, remember = true } = await jsonBody(req)
        if (
          typeof remember !== 'boolean' ||
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
        await store.change(data => {
          pruneSessions(data)
          if (key) delete data.sessions[key]
          data.sessions[sessionKey(newToken)] = {
            userId: account.id, expires: Date.now() + (remember ? SESSION_AGE : BROWSER_SESSION_AGE),
          }
        })
        send(res, 200, { user: userView(account) }, { 'Set-Cookie': cookie(newToken, remember ? SESSION_AGE / 1000 : undefined) })
        return
      }
      if (path === '/api/logout' && req.method === 'POST') {
        if (key && store.read().sessions?.[key])
          await store.change(data => { delete data.sessions[key] })
        send(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) })
        return
      }
      if (!user && !/^\/api\/decks\/[^/]+(?:\/|$)/.test(path)) fail(401, '로그인이 필요해요.')
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
        if (parts.length === 4 && parts[3] === 'history' && req.method === 'GET') {
          const deck = editableDeck(store.read(), id, user)
          send(res, 200, { revisions: store.read().revisions?.[id] || [snapshot(deck, null, 'initial')] })
          return
        } else if (parts.length === 4 && parts[3] === 'restore' && req.method === 'POST') {
          await store.change((data) => {
            const deck = editableDeck(data, id, user)
            beginEdit(data, deck, user, body.baseVersion)
            const revision = data.revisions[id].find((item) => item.version === body.version)
            if (!revision) fail(404, '버전을 찾을 수 없어요.')
            deck.name = revision.name
            deck.cards = structuredClone(revision.cards)
            finishEdit(data, deck, user, `restore:${body.version}`)
          })
        } else if (parts.length === 3 && req.method === 'PATCH') {
          await store.change((data) => {
            const deck = editableDeck(data, id, user)
            if (body.visibility !== undefined) ownDeck(data, id, user)
            beginEdit(data, deck, user, body.baseVersion)
            if (body.name !== undefined) deck.name = nameInput(body.name)
            if (body.visibility !== undefined)
              deck.visibility = visibilityInput(body.visibility)
            finishEdit(data, deck, user, 'settings')
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
            const deck = editableDeck(data, id, user)
            beginEdit(data, deck, user, body.baseVersion)
            if (deck.cards.length + body.cards.length > 1000)
              fail(400, '카드 셋은 최대 1,000장까지 담을 수 있어요.')
            const index = Number.isInteger(body.index) &&
              body.index >= 0 && body.index <= deck.cards.length
              ? body.index : deck.cards.length
            deck.cards.splice(index, 0, ...body.cards.map(cardInput))
            finishEdit(data, deck, user, 'add-cards')
          })
        } else if (parts.length === 6 && parts[3] === 'cards' && parts[5] === 'move' && req.method === 'POST') {
          await store.change((data) => {
            const deck = editableDeck(data, id, user)
            beginEdit(data, deck, user, body.baseVersion)
            const from = deck.cards.findIndex((card) => card.id === parts[4])
            if (from < 0) fail(404, '카드를 찾을 수 없어요.')
            if (!Number.isInteger(body.index) || body.index < 0 || body.index >= deck.cards.length)
              fail(400, '옮길 위치가 올바르지 않아요.')
            if (body.index === from) return
            const [card] = deck.cards.splice(from, 1)
            deck.cards.splice(body.index, 0, card)
            finishEdit(data, deck, user, 'move-card')
          })
        } else if (parts.length === 5 && parts[3] === 'cards' && ['PUT', 'DELETE'].includes(req.method)) {
          await store.change((data) => {
            const deck = editableDeck(data, id, user)
            beginEdit(data, deck, user, req.method === 'DELETE' ? Number(req.headers['if-match']) : body.baseVersion)
            const index = deck.cards.findIndex((card) => card.id === parts[4])
            if (index < 0) fail(404, '카드를 찾을 수 없어요.')
            if (req.method === 'DELETE') deck.cards.splice(index, 1)
            else deck.cards[index] = { ...cardInput(body), id: parts[4] }
            finishEdit(data, deck, user, req.method === 'DELETE' ? 'delete-card' : 'edit-card')
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
