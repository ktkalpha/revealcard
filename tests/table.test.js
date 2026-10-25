import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deleteColumns, deleteRows, emptyTable, expandRange, insertColumn, insertRow, mergeRange, serializeTable,
  tableAt, tableBlocks, toggleCellCovers, unmergeRange,
} from '../src/lib/table.js'
import { masksIn } from '../src/lib/masks.js'
import { markdownExcerpt } from '../src/lib/markdown.js'
import { isStructured, tapTokens } from '../src/lib/editing.js'

const sample = () => ({ rows: [['구분', '내용', ''], ['A', '[[답]]', 'x'], ['B', 'y', 'z']], merge: [], head: 1, side: 0, align: {} })

test('table blocks round-trip and only cell covers count as masks', () => {
  const block = serializeTable(sample())
  assert.ok(!/\[\[(?!답)/.test(block) && !/(?<!답)\]\]/.test(block))
  const body = `앞\n\n${block}\n\n뒤`
  const [found] = tableBlocks(body)
  assert.deepEqual(found.table.rows, sample().rows)
  assert.deepEqual(masksIn(body).map((mask) => mask.text), ['답'])
  assert.equal(markdownExcerpt(body), '앞 구분 내용 A 답 x B y z 뒤')
  assert.ok(isStructured(block))
  assert.deepEqual(tapTokens(body).filter((token) => token.type !== 'gap').map((token) => token.text), ['앞', '뒤'])
  assert.ok(tapTokens(body).some((token) => token.table))
})

test('merging joins text, expands selections and survives row/column edits', () => {
  const merged = mergeRange(sample(), { top: 0, left: 1, bottom: 0, right: 2 })
  assert.deepEqual(merged.merge, [[0, 1, 1, 2]])
  assert.equal(merged.rows[0][1], '내용')
  assert.deepEqual(expandRange(merged, { r: 0, c: 2 }, { r: 1, c: 2 }), { top: 0, left: 1, bottom: 1, right: 2 })
  assert.deepEqual(insertColumn(merged, 2).merge, [[0, 1, 1, 3]])
  assert.deepEqual(insertRow(merged, 0).merge, [[1, 1, 1, 2]])
  assert.deepEqual(deleteColumns(merged, 2, 2).merge, [])
  const tall = mergeRange(sample(), { top: 0, left: 0, bottom: 2, right: 0 })
  assert.equal(tall.rows[0][0], '구분 A B')
  const shrunk = deleteRows(tall, 0, 0)
  assert.deepEqual(shrunk.merge, [[0, 0, 2, 1]])
  assert.equal(shrunk.rows[0][0], '구분 A B')
  assert.deepEqual(unmergeRange(tall, { top: 0, left: 0, bottom: 0, right: 0 }).merge, [])
  const reparsed = tableBlocks(serializeTable(tall))[0].table
  assert.deepEqual(reparsed.merge, [[0, 0, 3, 1]])
})

test('cell covers toggle and markdown tables convert', () => {
  const covered = toggleCellCovers(sample(), [[2, 1], [2, 2]])
  assert.deepEqual(covered.rows[2], ['B', '[[y]]', '[[z]]'])
  assert.deepEqual(toggleCellCovers(covered, [[2, 1], [2, 2]]).rows[2], ['B', 'y', 'z'])
  const body = '제목\n\n| a | b |\n| --- | :-: |\n| [[c\\|d]] | e |\n\n끝'
  const found = tableAt(body, body.indexOf('e |'))
  assert.equal(found.markdown, true)
  assert.deepEqual(found.table.rows, [['a', 'b'], ['[[c\\|d]]', 'e']])
  assert.equal(found.table.align['1,1'], 'center')
  assert.equal(body.slice(found.start, found.end).split('\n').length, 3)
  assert.equal(tableAt(body, 1), null)
  assert.equal(tableAt(serializeTable(emptyTable()), 3).isNew, undefined)
})
