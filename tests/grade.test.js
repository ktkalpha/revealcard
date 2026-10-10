import test from 'node:test'
import assert from 'node:assert/strict'
import { grade } from '../src/lib/grade.js'

const verdict = (answer, input) => grade(answer, input).verdict

test('spacing, punctuation, bracketed detail and order do not matter', () => {
  assert.equal(verdict('감정 이입', '감정이입'), 'correct')
  assert.equal(verdict('같은 부모(혈육)', '같은부모'), 'correct')
  assert.equal(verdict('무상감(허무함)', '무상감'), 'correct')
  assert.equal(verdict('시련, 소멸', '소멸 시련'), 'correct')
  assert.equal(verdict('① 누이의 요절 ② 죽음의 원인', '죽음의 원인, 누이의 요절'), 'correct')
  assert.equal(verdict('4-4-2', '442'), 'correct')
})

test('small typos pass, near answers are close, other answers are wrong', () => {
  assert.equal(verdict('무상감', '무상깜'), 'correct')
  assert.equal(verdict('누이의 죽음에 대한 슬픔과 안타까움', '누이 죽음에 대한 슬픔, 안타까움'), 'correct')
  assert.equal(verdict('누이의 죽음에 대한 슬픔과 안타까움', '누이의 죽음이 안타까움'), 'close')
  assert.equal(verdict('시련, 소멸', '시련'), 'close')
  assert.equal(verdict('자연과 더불어 사는 안빈낙도의 삶', '임을 여읜 슬픔'), 'wrong')
  assert.equal(verdict('정답', ''), 'wrong')
})

test('short answers and numbers must match exactly', () => {
  assert.equal(verdict('음', '뜻'), 'wrong')
  assert.equal(verdict('은유', '직유'), 'wrong')
  assert.equal(verdict('9', '9행'), 'correct')
  assert.equal(verdict('4-4-2', '4-4-3'), 'wrong')
  assert.equal(verdict('20', '24'), 'wrong')
})
