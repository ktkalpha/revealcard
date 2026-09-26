import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export async function createStore(file) {
  let data
  try {
    data = JSON.parse(await readFile(file, 'utf8'))
    if (!Array.isArray(data.users) || !Array.isArray(data.decks))
      throw new Error('Invalid server data')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    data = { users: [], decks: [] }
  }
  let pending = Promise.resolve()
  return {
    read: () => data,
    change(fn) {
      const run = pending.then(async () => {
        const next = structuredClone(data)
        const result = fn(next)
        await mkdir(dirname(file), { recursive: true, mode: 0o700 })
        const temporary = `${file}.${randomUUID()}.tmp`
        await writeFile(temporary, JSON.stringify(next), { mode: 0o600 })
        await rename(temporary, file)
        data = next
        return result
      })
      pending = run.catch(() => {})
      return run
    },
  }
}
