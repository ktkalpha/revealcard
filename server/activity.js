import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const ONLINE_WINDOW = 5 * 60 * 1000

// Admin-only activity log. Events are appended as JSON lines next to the data
// file; who is online lives in memory because it only matters while running.
export async function createActivity(file, { keep = 5000 } = {}) {
  let events = []
  try {
    events = (await readFile(file, 'utf8')).split('\n').filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)] } catch { return [] }
    })
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  if (events.length > keep) {
    events = events.slice(-keep)
    await writeFile(file, events.map((event) => JSON.stringify(event) + '\n').join(''), { mode: 0o600 })
  }
  const seen = new Map()
  let writing = Promise.resolve()
  return {
    record(event) {
      const entry = { at: new Date().toISOString(), ...event }
      events.push(entry)
      if (events.length > keep * 1.2) events = events.slice(-keep)
      writing = writing
        .then(() => appendFile(file, JSON.stringify(entry) + '\n', { mode: 0o600 }))
        .catch(() => {})
    },
    touch(user, ip, path) {
      const key = user ? `user:${user.id}` : `guest:${ip}`
      seen.set(key, { username: user?.username || null, ip, path, at: Date.now() })
    },
    snapshot(users, limit = 500) {
      const now = Date.now()
      for (const [key, value] of seen) if (now - value.at > 24 * 60 * 60 * 1000) seen.delete(key)
      const online = [...seen.values()]
        .filter((value) => now - value.at <= ONLINE_WINDOW)
        .sort((a, b) => b.at - a.at)
        .map((value) => ({ ...value, at: new Date(value.at).toISOString() }))
      const lastLogin = new Map()
      for (const event of events) if (event.action === 'login' || event.action === 'register') lastLogin.set(event.username, event.at)
      const accounts = users.map((user) => {
        const live = seen.get(`user:${user.id}`)
        return {
          username: user.username,
          admin: !!user.admin,
          banned: !!user.banned,
          bannedAt: user.bannedAt || null,
          lastSeen: live ? new Date(live.at).toISOString() : null,
          lastLogin: lastLogin.get(user.username) || null,
          online: !!live && now - live.at <= ONLINE_WINDOW,
        }
      })
      return { online, accounts, events: events.slice(-limit).reverse() }
    },
    // Drops a kicked user from the online list right away instead of after the online window.
    forget(username) {
      for (const [key, value] of seen) if (value.username === username) seen.delete(key)
    },
    flush: () => writing,
  }
}
