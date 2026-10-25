import test from 'node:test'
import assert from 'node:assert/strict'
import { mapQuizPlaces, mapQuizError, distanceKm, roundScore, MAX_ROUND_SCORE } from '../src/lib/mapquiz.js'
import { exportCardSet, parseCardSet } from '../src/cardSet.js'

const card = { title: '분쟁 지역 찾기', kind: 'mapquiz', body: '카슈미르 분쟁 | 34.2, 75.5 | 인도와 파키스탄 간의 영토 및 종교 분쟁\n포클랜드 제도 분쟁 | -51.7, -59.5' }
test('map quiz lines parse into named coordinates with optional notes', () => {
  const places = mapQuizPlaces(card.body)
  assert.deepEqual(places[0], { id: 0, name: '카슈미르 분쟁', lat: 34.2, lon: 75.5, note: '인도와 파키스탄 간의 영토 및 종교 분쟁' })
  assert.equal(places[1].note, '')
})
test('map quiz rejects malformed lines, bad coordinates and duplicate names', () => {
  for (const body of ['', '이름만', '이름 | 34.2', '이름 | 95, 10', '이름 | 10, 200', '이름 | 가, 나', '이름 | 1, 2 | 설명 | 추가', '같은 곳 | 1, 2\n같은 곳 | 3, 4'])
    assert.ok(mapQuizError(body), body)
})
test('distance and score favour closer guesses', () => {
  const seoul = { lat: 37.57, lon: 126.98 }, tokyo = { lat: 35.68, lon: 139.69 }
  assert.ok(Math.abs(distanceKm(seoul, tokyo) - 1150) < 30)
  assert.equal(roundScore(50), MAX_ROUND_SCORE)
  assert.ok(roundScore(500) > roundScore(1500) && roundScore(1500) > roundScore(5000))
  assert.ok(roundScore(20000) >= 0)
})
test('map quiz cards survive export and import', () => {
  assert.deepEqual(parseCardSet(JSON.stringify(exportCardSet([card], '사회 4단원'))).cards, [card])
  assert.throws(() => parseCardSet(JSON.stringify(exportCardSet([{ ...card, body: '이름 | 100, 0' }]))))
})
