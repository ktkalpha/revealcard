import test from 'node:test'
import assert from 'node:assert/strict'
import { moveBranch, moveDepth, parseOutline, serializeOutline, studyOutline, subtreeEnd } from '../src/lib/outline.js'
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

test('dragging a branch moves its children together before or after another branch', () => {
  const rows = parseOutline('- 첫째\n  - [[하위]]\n- 둘째\n  - 둘째 하위\n- 셋째')
  const after = moveBranch(rows, 1, 3, 'after')
  assert.deepEqual(after.map((row) => row.text), ['둘째', '둘째 하위', '첫째', '[[하위]]', '셋째'])
  assert.deepEqual(after.map((row) => row.depth), [0, 1, 0, 1, 0])
  assert.equal(masksIn(serializeOutline(after)).length, 1)
  assert.deepEqual(moveBranch(after, 1, 3, 'before').map((row) => row.text), rows.map((row) => row.text))
  assert.deepEqual(rows.map((row) => row.text), ['첫째', '[[하위]]', '둘째', '둘째 하위', '셋째'])
})

test('cross-depth drops preserve relative nesting and reject dropping inside itself', () => {
  const rows = parseOutline('- 첫째\n  - 하위\n- 둘째\n  - 대상\n    - 자식')
  const moved = moveBranch(rows, 1, 4, 'after')
  assert.deepEqual(moved.map((row) => row.text), ['둘째', '대상', '자식', '첫째', '하위'])
  assert.deepEqual(moved.map((row) => row.depth), [0, 1, 2, 1, 2])
  assert.equal(moveBranch(rows, 1, 2, 'before'), rows)
  assert.equal(moveBranch(rows, 1, 1, 'after'), rows)
  assert.equal(moveBranch(rows, 1, 99, 'before'), rows)
})

test('study rows retain global mask ids for reveal and wrong-answer review', () => {
  const body = '- [[첫째]]\n  - **[[둘째]]**\n- [[셋째]]'
  const rows = studyOutline(body)
  assert.deepEqual(rows.map((row) => row.depth), [0, 1, 0])
  assert.deepEqual(rows.map((row) => row.maskOrdinalStart), [0, 1, 2])
  assert.deepEqual(rows.flatMap((row) => row.maskParts.map((mask) => mask.id)),
    masksIn(body).map((mask) => mask.id))
})

test('Markdown tables round-trip as movable outline rows with stable mask ids', () => {
  const body = '- 분류\n  - | 종류 | 설명 |\n    | --- | --- |\n    | [[체언]] | 이름\\|뜻 |\n- 끝'
  const rows = parseOutline(body)
  assert.deepEqual(rows.map((row) => row.depth), [0, 1, 0])
  assert.equal(rows[1].type, 'table')
  assert.deepEqual(rows[1].cells, [['종류', '설명'], ['[[체언]]', '이름|뜻']])
  assert.equal(serializeOutline(rows), body)
  assert.deepEqual(studyOutline(body)[1].maskParts.map((mask) => mask.id),
    masksIn(body).map((mask) => mask.id))
  const moved = moveBranch(rows, rows[1].id, rows[2].id, 'after')
  assert.deepEqual(parseOutline(serializeOutline(moved)).map((row) => row.type),
    [undefined, undefined, 'table'])
})

test('table masks can contain pipes without changing the answer', () => {
  const body = '- | 질문 | 정답 |\n  | --- | --- |\n  | 단어 | [[가|나]] |'
  const rows = parseOutline(body)
  assert.equal(rows[0].cells[1][1], '[[가|나]]')
  assert.equal(serializeOutline(rows), body)
  assert.equal(studyOutline(body)[0].maskParts[0].text, '가|나')
})
