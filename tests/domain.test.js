import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseBody,
  masksIn,
  maskKey,
  wrongMaskIds,
  maskSelection,
  bodyError,
  plainText,
} from '../src/lib/masks.js'
import { parseCardSet, exportCardSet } from '../src/cardSet.js'
import { loadLibrary, STORAGE_KEY, importCards } from '../src/lib/storage.js'

const storage = (values) => ({ getItem: (key) => values[key] ?? null })
test('selecting part of a word and toggling that mask preserves surrounding text', () => {
  const added = maskSelection('광합성은 엽록체에서', 5, 8)
  assert.equal(added.body, '광합성은 [[엽록체]]에서')
  const removed = maskSelection(added.body, 7, 10)
  assert.equal(removed.body, '광합성은 엽록체에서')
})
test('whole-line masking works at the very first character and on multiple selected lines', () => {
  assert.equal(
    maskSelection('첫 줄\n둘째 줄', 0, 0, true).body,
    '[[첫 줄]]\n둘째 줄',
  )
  assert.equal(
    maskSelection('첫 줄\n둘째 줄\n셋째 줄', 0, 9, true).body,
    '[[첫 줄]]\n[[둘째 줄]]\n셋째 줄',
  )
  assert.equal(
    maskSelection('앞 [[부분]] 뒤', 2, 2, true).body,
    '[[앞 부분 뒤]]',
  )
})
test('partial overlap, empty masks, and unbalanced markers produce actionable errors', () => {
  assert.throws(() => maskSelection('앞 [[정답]] 뒤', 0, 5), /경계/)
  assert.throws(() => maskSelection('내용', 0, 0), /선택/)
  assert.ok(bodyError('[[ ]]'))
  assert.ok(bodyError('[[중첩 [[내용]]]]'))
  assert.ok(bodyError('정답]]'))
  assert.ok(bodyError('[[미완성'))
  assert.equal(bodyError('[[여러\n줄]]'), '')
})
test('multiline and repeated answers are separate masks without losing text', () => {
  const body = '앞 [[답]]\n[[답]] 뒤 [[여러\n줄]]'
  assert.equal(masksIn(body).length, 3)
  assert.equal(new Set(masksIn(body).map((p) => p.id)).size, 3)
  assert.equal(plainText(body), '앞 답\n답 뒤 여러\n줄')
})
test('wrong-answer review targets only matching masks after card edits', () => {
  const original = '[[첫째]] 다음 [[둘째]]'
  const saved = [maskKey(masksIn(original)[1])]
  assert.deepEqual(wrongMaskIds(original, saved), [masksIn(original)[1].id])
  assert.deepEqual(wrongMaskIds('[[새 답]] 다음 [[둘째]]', saved), [])
  assert.deepEqual(wrongMaskIds('[[첫째]] 다음 [[수정]]', saved), [])
})
test('card sets round-trip exact Korean text, whitespace, and masks without internal state', () => {
  const cards = [
    {
      id: 'private-id',
      title: '제목',
      body: ' [[일부]]\n[[한 줄]]\n한글과 😀',
      rating: 'known',
    },
  ]
  const exported = exportCardSet(cards, '공유 셋')
  assert.deepEqual(parseCardSet('\uFEFF' + JSON.stringify(exported)), {
    name: '공유 셋',
    cards: [{ title: cards[0].title, body: cards[0].body }],
  })
  assert.equal(JSON.stringify(exported).includes('private-id'), false)
  assert.equal(JSON.stringify(exported).includes('rating'), false)
})
test('rejects broken, incompatible, empty, excessive, and malformed imported sets', () => {
  const fixture = exportCardSet([{ title: 'A', body: '[[B]]' }])
  for (const data of [
    { ...fixture, version: 2 },
    { ...fixture, cards: [] },
    { ...fixture, cards: [{ title: '', body: 'b' }] },
    { ...fixture, cards: [{ title: 'a', body: '[[b' }] },
    { ...fixture, cards: Array(1001).fill(fixture.cards[0]) },
  ])
    assert.throws(() => parseCardSet(JSON.stringify(data)))
  assert.throws(() => parseCardSet('not json'))
})
test('legacy cards and intentionally empty collections migrate without injecting examples', () => {
  const cards = [{ id: 'a', title: '원본', body: '[[원문]]' }]
  assert.deepEqual(
    loadLibrary(storage({ 'revealcard.cards': JSON.stringify(cards) })).data
      .decks[0].cards,
    cards,
  )
  assert.deepEqual(
    loadLibrary(storage({ 'revealcard.cards': '[]' })).data.decks[0].cards,
    [],
  )
  assert.equal(
    loadLibrary(storage({ [STORAGE_KEY]: '{invalid' })).error.length > 0,
    true,
  )
})
test('import deduplicates against current cards and within the file, with fresh IDs', () => {
  const a = { title: '제목', body: '[[정답]]' },
    b = { title: '제목', body: '다른 정답' }
  const added = importCards([a], [a, b, b], true)
  assert.equal(added.length, 1)
  assert.equal(added[0].body, b.body)
  assert.ok(added[0].id)
  const all = importCards([a], [a, a], false)
  assert.equal(all.length, 2)
  assert.notEqual(all[0].id, all[1].id)
})
