import test from 'node:test'
import assert from 'node:assert/strict'
import { moveDepth, parseOutline, serializeOutline, subtreeEnd } from '../src/lib/outline.js'
import { exportCardSet, parseCardSet } from '../src/cardSet.js'
import { masksIn } from '../src/lib/masks.js'

test('outline preserves nested bullets and masks through card-set export', () => {
  const body = '- 서간도\n  - 삼원보\n    - [[경학사]] - 자치 기구\n  - 신흥무관학교'
  const rows = parseOutline(body)
  assert.deepEqual(rows.map((row) => row.depth), [0, 1, 2, 1])
  assert.equal(serializeOutline(rows), body)
  assert.equal(subtreeEnd(rows, 1), 3)
  assert.equal(masksIn(body).length, 1)
  const card = { title: '독립운동 노트', body, kind: 'note' }
  assert.deepEqual(parseCardSet(JSON.stringify(exportCardSet([card]))).cards, [card])
})

test('indent and outdent move an entire branch without changing its content', () => {
  const rows = parseOutline('- 북간도\n- 용정\n  - [[명동학교]]')
  const indented = moveDepth(rows, 1, 1)
  assert.deepEqual(indented.map((row) => row.depth), [0, 1, 2])
  assert.deepEqual(rows.map((row) => row.depth), [0, 0, 1])
  assert.deepEqual(moveDepth(indented, 1, -1).map((row) => row.depth), [0, 0, 1])
  assert.equal(moveDepth(rows, 0, -1), rows)
})

test('oversized indentation is normalized on import', () => {
  assert.deepEqual(parseOutline('- 첫째\n        - 둘째').map((row) => row.depth), [0, 1])
})
