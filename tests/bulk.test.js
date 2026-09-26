import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bulkDraftKey,
  loadBulkDraft,
  parseTable,
  rowError,
} from '../src/lib/bulk.js'

test('Excel clipboard rows retain quoted tabs, line breaks, and escaped quotes', () => {
  assert.deepEqual(
    parseTable('제목\t내용\r\n"A\tB"\t"첫 줄\n둘째 ""줄"""\r\n'),
    [['제목', '내용'], ['A\tB', '첫 줄\n둘째 "줄"']],
  )
  assert.deepEqual(parseTable('한 열\n다음 열'), [['한 열'], ['다음 열']])
})

test('bulk rows reject incomplete cards and invalid masks but permit blank rows', () => {
  assert.equal(rowError({ title: '', body: '' }), '')
  assert.match(rowError({ title: '제목', body: '' }), /내용/)
  assert.match(rowError({ title: '', body: '내용' }), /제목/)
  assert.ok(rowError({ title: '제목', body: '[[미완성' }))
  assert.equal(rowError({ title: '제목', body: '여기 [[정답]]' }), '')
})

test('bulk drafts are isolated by card set', () => {
  const rows = [{ title: '첫 카드', body: '내용' }]
  const storage = {
    getItem: (key) =>
      key === bulkDraftKey('a')
        ? JSON.stringify({ deckId: 'a', rows })
        : null,
  }
  assert.deepEqual(loadBulkDraft(storage, 'a'), rows)
  assert.equal(loadBulkDraft(storage, 'b'), null)
})
