const DATABASE = 'revealcard-offline'
const STORE = 'decks'
const USER_KEY = 'revealcard.offline-user.v1'

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact(mode, action) {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = action(transaction.objectStore(STORE))
      let result
      request.onsuccess = () => { result = request.result }
      request.onerror = () => reject(request.error)
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export function rememberedUser() {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY))
    return typeof user?.id === 'string' && typeof user?.username === 'string' ? user : null
  } catch {
    return null
  }
}

export function rememberUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, username: user.username }))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // Browsers with disabled storage can still use the online app.
  }
}

export function availableDecks(records, userId) {
  return records
    .filter((record) => record.visibility === 'public' || (userId && record.ownerId === userId))
    .map(({ deck }) => ({ ...deck, canEdit: false }))
}

export async function offlineDecks(userId) {
  const records = await transact('readonly', (store) => store.getAll())
  return {
    decks: availableDecks(records, userId),
    savedIds: records
      .filter((record) => record.visibility === 'public' || (userId && record.ownerId === userId))
      .map((record) => record.id),
  }
}

export async function saveOfflineDeck(deck, userId) {
  const record = {
    id: deck.id,
    ownerId: userId && deck.canEdit ? userId : null,
    visibility: deck.visibility,
    deck: {
      id: deck.id,
      name: deck.name,
      ownerName: deck.ownerName,
      visibility: deck.visibility,
      cards: deck.cards,
    },
  }
  if (record.visibility !== 'public' && !record.ownerId)
    throw new Error('이 카드 셋을 기기에 저장할 수 없어요.')
  await transact('readwrite', (store) => store.put(record))
}

export async function removeOfflineDeck(id) {
  await transact('readwrite', (store) => store.delete(id))
}
