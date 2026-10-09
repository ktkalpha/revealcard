import test from 'node:test'
import assert from 'node:assert/strict'
import { boxFromPoints, occlusionData, occlusionError, occlusionMasks } from '../src/lib/occlusion.js'
import { exportCardSet, parseCardSet } from '../src/cardSet.js'

const data = { image: '/api/images/cb63d748-5ea0-4b1c-995a-898e0c6da306.png', boxes: [
  { id: 'a', x: 10, y: 20, w: 30, h: 10, label: '명동 학교' },
  { id: 'b', x: 60, y: 70, w: 20, h: 15 },
] }
const card = { title: '독립운동 기지', kind: 'occlusion', body: JSON.stringify(data) }

test('occlusion cards round-trip through card set files', () => {
  assert.equal(occlusionError(card.body), '')
  assert.deepEqual(occlusionData(card.body), data)
  assert.deepEqual(occlusionMasks(card.body), [{ id: 'a', text: '명동 학교' }, { id: 'b', text: '' }])
  assert.deepEqual(parseCardSet(JSON.stringify(exportCardSet([card]))).cards, [card])
})

test('occlusion rejects outside images, missing boxes and boxes off the image', () => {
  for (const value of [
    { ...data, image: 'https://example.com/a.png' },
    { ...data, image: '/fossils/item-01.webp' },
    { ...data, boxes: [] },
    { ...data, boxes: [data.boxes[0], data.boxes[0]] },
    { ...data, boxes: [{ ...data.boxes[0], x: 90, w: 20 }] },
    { ...data, boxes: [{ ...data.boxes[0], w: 0 }] },
    { ...data, boxes: [{ ...data.boxes[0], y: '5' }] },
  ]) assert.ok(occlusionError(JSON.stringify(value)))
  assert.ok(occlusionError('not json'))
  assert.deepEqual(occlusionMasks('not json'), [])
})

test('drawn boxes are normalized and clamped to the image', () => {
  assert.deepEqual(boxFromPoints({ x: 50, y: 40 }, { x: 20, y: 10 }), { x: 20, y: 10, w: 30, h: 30 })
  assert.deepEqual(boxFromPoints({ x: -5, y: 90 }, { x: 10, y: 120 }), { x: 0, y: 90, w: 10, h: 10 })
})
