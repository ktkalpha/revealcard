import { tagsInput } from './tags.js'

// folders (added when first used): the folders each person files card sets into, { deckId: ['과학/물리'] }.
export const emptyProgress = () => ({ ratings: {}, positions: {}, wrongMasks: {} })
export function applyProgress(progress, operation) {
  const { kind, id, value, key } = operation
  if (kind === 'wrong') {
    const values = new Set(progress.wrongMasks[id] || [])
    if (value) values.add(key)
    else values.delete(key)
    progress.wrongMasks[id] = [...values]
  } else if (kind === 'folders') {
    progress.folders ||= {}
    const tags = tagsInput(value) || []
    if (tags.length) progress.folders[id] = tags
    else delete progress.folders[id]
  } else progress[kind][id] = value
  return progress
}
export function validOperation(op) {
  const safe = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !['__proto__', 'constructor', 'prototype'].includes(value)
  return op && safe(op.id) && (
    op.kind === 'ratings' && ['known', 'again'].includes(op.value) ||
    op.kind === 'positions' && safe(op.value) ||
    op.kind === 'wrong' && safe(op.key) && typeof op.value === 'boolean' ||
    op.kind === 'folders' && Array.isArray(op.value) && !!tagsInput(op.value)
  )
}
export function migrateProgress(target, legacy) {
  for (const kind of ['ratings', 'positions'])
    for (const [id, value] of Object.entries(legacy?.[kind] || {}))
      if (validOperation({ kind, id, value }) && !Object.hasOwn(target[kind], id)) target[kind][id] = value
  for (const [id, keys] of Object.entries(legacy?.wrongMasks || {}))
    if (!Object.hasOwn(target.wrongMasks, id) && Array.isArray(keys))
      target.wrongMasks[id] = keys.filter(key => validOperation({ kind: 'wrong', id, key, value: true }))
  return target
}
