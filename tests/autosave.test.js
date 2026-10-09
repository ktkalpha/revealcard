import test from 'node:test'
import assert from 'node:assert/strict'
import { cardSaveError, isBlankCard, saveLabel } from '../src/lib/autosave.js'

test('autosave only sends cards the server accepts', () => {
  assert.equal(cardSaveError({ title: '카드', body: '[[정답]]' }), '')
  assert.ok(cardSaveError({ title: '', body: '[[정답]]' }))
  assert.ok(cardSaveError({ title: '카드', body: '[[열림' }))
  assert.ok(cardSaveError({ title: '카드', body: 'x', kind: 'matching' }))
  assert.ok(cardSaveError({ title: '카드', body: '{}', kind: 'occlusion' }))
  assert.equal(isBlankCard({ title: ' ', body: '' }), true)
  assert.equal(saveLabel('invalid', { title: '', body: '' }), '작성 중')
  assert.match(saveLabel('invalid', { title: '카드', body: '[[열림' }), /임시 보관/)
})
