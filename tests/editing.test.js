import test from 'node:test'
import assert from 'node:assert/strict'
import { continueList, insertBlock, isStructured, shiftLines, tapTokens, toggleList, toggleTap, wordRange } from '../src/lib/editing.js'

const tap = (body, text) => toggleTap(body, tapTokens(body).find((token) => token.text === text))

test('tapping words covers, grows and uncovers masks', () => {
  assert.equal(tap('광합성은 엽록체에서 일어난다.', '엽록체에서'), '광합성은 [[엽록체에서]] 일어난다.')
  assert.equal(tap('광합성은 [[엽록체에서]] 일어난다.', '일어난다'), '광합성은 [[엽록체에서 일어난다]].')
  assert.equal(tap('광합성은 [[엽록체에서]] 일어난다.', '광합성은'), '[[광합성은 엽록체에서]] 일어난다.')
  assert.equal(tap('광합성은 [[엽록체에서]] 일어난다.', '엽록체에서'), '광합성은 엽록체에서 일어난다.')
})

test('markdown and punctuation stay outside covers', () => {
  const tokens = tapTokens('- **조선 총독부** 설치, 1910\n| a | b |')
  assert.deepEqual(tokens.filter((t) => t.type === 'word').map((t) => t.text), ['조선', '총독부', '설치', '1910', 'a', 'b'])
  assert.equal(tap('- **조선** 설치', '조선'), '- **[[조선]]** 설치')
  assert.equal(tap('A [[b]] c [[d]] e', 'e'), 'A [[b]] c [[d e]]')
  const repeated = '사과 사과 [[배]] 사과'
  const last = tapTokens(repeated).filter((t) => t.text === '사과').at(-1)
  assert.equal(toggleTap(repeated, last), '사과 사과 [[배 사과]]')
})

test('caret word range and list editing', () => {
  assert.deepEqual(wordRange('가나 다라마 바', 4, 4), [3, 6])
  assert.deepEqual(wordRange('가나 다라', 0, 2), [0, 2])
  assert.deepEqual(continueList('- 하나', 4), { body: '- 하나\n- ', start: 7, end: 7 })
  assert.deepEqual(continueList('  2) 둘', 6), { body: '  2) 둘\n  3) ', start: 12, end: 12 })
  assert.deepEqual(continueList('- 하나\n- ', 7), { body: '- 하나\n', start: 5, end: 5 })
  assert.equal(continueList('그냥 문장', 5), null)
  assert.equal(toggleList('가\n나', 0, 3).body, '- 가\n- 나')
  assert.equal(toggleList('- 가\n- 나', 0, 7).body, '가\n나')
  assert.equal(shiftLines('- 가\n- 나', 5, 5, 1).body, '- 가\n  - 나')
  assert.equal(shiftLines('- 가\n  - 나', 6, 6, -1).body, '- 가\n- 나')
  assert.equal(insertBlock('문장', 2, 2, 'X').body, '문장\n\nX')
  assert.equal(isStructured('짧은 카드 [[내용]]'), false)
  assert.equal(isStructured('- 목록\n- 항목'), true)
})
