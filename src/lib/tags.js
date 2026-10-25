// Folders for card sets work like tags. A tag with slashes ("과학/물리") is a folder
// inside a folder, and a set can sit in several folders at once.

export const MAX_TAGS = 10
export const MAX_TAG_LENGTH = 40
// The folder of sets without any tag.
export const UNTAGGED = '\u0000untagged'

export function normalizeTag(tag) {
  return String(tag ?? '')
    // Blank-looking characters (Hangul filler, zero-width space) would make folders that look empty.
    .replace(/[\u115f\u1160\u3164\uffa0\u200b-\u200d\ufeff]/g, '')
    .trim()
    .replace(/^#+/, '')
    .split('/')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('/')
}

// Returns the clean tag list, or null when it cannot be stored.
export function tagsInput(tags) {
  if (tags === undefined) return []
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) return null
  const clean = []
  for (const tag of tags) {
    if (typeof tag !== 'string') return null
    const value = normalizeTag(tag)
    if (!value || value.length > MAX_TAG_LENGTH) return null
    if (!clean.includes(value)) clean.push(value)
  }
  return clean
}

export const itemTags = (item) => (Array.isArray(item?.tags) ? item.tags : [])

export function inFolder(card, folder) {
  if (!folder) return true
  const tags = itemTags(card)
  if (folder === UNTAGGED) return !tags.length
  return tags.some((tag) => tag === folder || tag.startsWith(`${folder}/`))
}

// Every folder path with its parents, sorted so children follow their parent.
export function folderTree(cards) {
  const counts = new Map()
  for (const card of cards) {
    const paths = new Set()
    for (const tag of itemTags(card)) {
      const parts = tag.split('/')
      parts.forEach((_, index) => paths.add(parts.slice(0, index + 1).join('/')))
    }
    for (const path of paths) counts.set(path, (counts.get(path) || 0) + 1)
  }
  return [...counts]
    .sort(([a], [b]) => a.split('/').join('\u0001').localeCompare(b.split('/').join('\u0001'), 'ko'))
    .map(([path, count]) => ({ path, name: path.split('/').at(-1), depth: path.split('/').length - 1, count }))
}

export const folderLabel = (folder) => (folder === UNTAGGED ? '폴더 없음' : folder.replaceAll('/', ' › '))
