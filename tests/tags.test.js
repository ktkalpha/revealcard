import test from 'node:test'
import assert from 'node:assert/strict'
import { UNTAGGED, folderTree, inFolder, normalizeTag, tagsInput } from '../src/lib/tags.js'
import { applyProgress, emptyProgress, validOperation } from '../src/lib/progress.js'

test('folder names are tidied and checked', () => {
  assert.equal(normalizeTag('  #과학 /  물리 ㅤ/ '), '과학/물리')
  assert.deepEqual(tagsInput(['과학/물리', ' 과학 / 물리', '화학']), ['과학/물리', '화학'])
  assert.deepEqual(tagsInput(undefined), [])
  assert.equal(tagsInput(['']), null)
  assert.equal(tagsInput('과학'), null)
  assert.equal(tagsInput(Array.from({ length: 11 }, (_, i) => `t${i}`)), null)
  assert.equal(tagsInput(['가'.repeat(41)]), null)
})

test('folders nest by slash and include their subfolders', () => {
  const cards = [
    { id: 'a', tags: ['과학/물리'] },
    { id: 'b', tags: ['과학/화학', '시험'] },
    { id: 'c', tags: ['과학'] },
    { id: 'd' },
  ]
  assert.deepEqual(folderTree(cards).map(({ path, depth, count }) => [path, depth, count]), [
    ['과학', 0, 3], ['과학/물리', 1, 1], ['과학/화학', 1, 1], ['시험', 0, 1],
  ])
  assert.deepEqual(cards.filter((card) => inFolder(card, '과학')).map((card) => card.id), ['a', 'b', 'c'])
  assert.deepEqual(cards.filter((card) => inFolder(card, '과학/물리')).map((card) => card.id), ['a'])
  assert.deepEqual(cards.filter((card) => inFolder(card, UNTAGGED)).map((card) => card.id), ['d'])
  assert.equal(inFolder({ tags: ['과학자'] }, '과학'), false)
})

test('each person files card sets into folders through progress', () => {
  const progress = emptyProgress()
  assert.equal(validOperation({ kind: 'folders', id: 'deck1', value: ['과학/물리', ' 시험 '] }), true)
  assert.equal(validOperation({ kind: 'folders', id: 'deck1', value: '과학' }), false)
  assert.equal(validOperation({ kind: 'folders', id: 'deck1', value: ['x'.repeat(41)] }), false)
  applyProgress(progress, { kind: 'folders', id: 'deck1', value: ['과학/물리', ' 시험 '] })
  assert.deepEqual(progress.folders, { deck1: ['과학/물리', '시험'] })
  applyProgress(progress, { kind: 'folders', id: 'deck1', value: [] })
  assert.deepEqual(progress.folders, {})
})
