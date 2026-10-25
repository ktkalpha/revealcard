import React, { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from './ui/button'
import WorldMap, { Pin, toXY } from './WorldMap'
import { CLOSE_KM, MAX_ROUND_SCORE, distanceKm, formatKm, mapQuizPlaces, roundScore } from '../lib/mapquiz'
import { shuffled } from '../lib/matching'

// GeoGuessr-style round: show a place name, the learner drops a pin, then the answer is revealed.
export default function MapQuizGame({ body, onComplete = () => {}, onReset = () => {}, onAnswer = () => {}, keyboardEnabled = true }) {
  const places = mapQuizPlaces(body)
  const [order, setOrder] = useState(() => shuffled(places))
  const [cursor, setCursor] = useState(0)
  const [guess, setGuess] = useState(null)
  const [results, setResults] = useState([])
  const place = order[cursor]
  const result = results.length > cursor ? results[cursor] : null
  const total = results.reduce((sum, r) => sum + r.score, 0)
  const [finished, setFinished] = useState(false)

  function submit() {
    if (!guess || result) return
    const km = distanceKm(guess, place)
    const next = [...results, { place, guess, km, score: roundScore(km) }]
    setResults(next)
    onAnswer(km <= CLOSE_KM)
  }
  function next() {
    if (!result) return
    if (cursor < order.length - 1) { setCursor(cursor + 1); setGuess(null) }
    else if (!finished) { setFinished(true); onComplete() }
  }
  function restart() {
    setOrder(shuffled(places)); setCursor(0); setGuess(null); setResults([]); setFinished(false)
    onReset()
  }
  useEffect(() => {
    function keydown(event) {
      if (!keyboardEnabled || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key !== 'Enter' || event.target.closest('dialog,input,textarea,select,button,svg,[contenteditable="true"]')) return
      event.preventDefault(); event.stopImmediatePropagation()
      result ? next() : submit()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  if (finished) {
    const max = order.length * MAX_ROUND_SCORE
    return <section className="mapquiz-game" aria-label="분쟁 지역 지도 찾기 게임">
      <div className="matching-result mapquiz-result" role="status">
        <h2>총점 {total.toLocaleString('ko-KR')} / {max.toLocaleString('ko-KR')}</h2>
        <p>{order.length}곳 중 {results.filter((r) => r.km <= CLOSE_KM).length}곳을 {CLOSE_KM}km 안으로 찾았어요. 아래의 ‘기억했어요’를 눌러 다음 카드로 이어가세요.</p>
      </div>
      <WorldMap fit={results.flatMap((r) => [r.place, r.guess])} label="결과 지도">
        {(px) => results.map((r) => <g key={r.place.id}>
          <line className="mapquiz-line" x1={toXY(r.guess)[0]} y1={toXY(r.guess)[1]} x2={toXY(r.place)[0]} y2={toXY(r.place)[1]} strokeWidth={px * 1.5} strokeDasharray={`${px * 4} ${px * 3}`} />
          <circle className="mapquiz-guess-dot" cx={toXY(r.guess)[0]} cy={toXY(r.guess)[1]} r={px * 4} />
          <Pin point={r.place} px={px * 0.8} className="answer" label={r.place.name} />
        </g>)}
      </WorldMap>
      <ol className="mapquiz-summary">
        {results.map((r) => <li key={r.place.id} className={r.km <= CLOSE_KM ? 'close' : undefined}>
          <span>{r.place.name}</span><span>{formatKm(r.km)}</span><strong>{r.score}점</strong>
        </li>)}
      </ol>
      <Button variant="outline" type="button" onClick={restart}>순서 섞고 다시 도전</Button>
    </section>
  }

  return <section className="mapquiz-game" aria-label="분쟁 지역 지도 찾기 게임">
    <div className="matching-stats">
      <span>지역 <strong>{cursor + 1} / {order.length}</strong></span>
      <span>점수 <strong>{total.toLocaleString('ko-KR')}</strong></span>
    </div>
    <div className="mapquiz-prompt">
      <MapPin size={20} aria-hidden="true" />
      <div><strong>{place.name}</strong><span>{result ? '정답 위치를 확인하세요.' : '이곳의 위치를 지도에서 눌러 찍으세요.'}</span></div>
    </div>
    <WorldMap key={cursor} onPick={result ? undefined : setGuess} fit={result ? [result.guess, place] : undefined} label={`${place.name} 위치 찾기 지도`}>
      {(px) => <>
        {result && <line className="mapquiz-line" x1={toXY(result.guess)[0]} y1={toXY(result.guess)[1]} x2={toXY(place)[0]} y2={toXY(place)[1]} strokeWidth={px * 2} strokeDasharray={`${px * 6} ${px * 4}`} />}
        {guess && <Pin point={guess} px={px} className="guess" label="내가 찍은 위치" />}
        {result && <Pin point={place} px={px} className="answer" label={`정답: ${place.name}`} />}
      </>}
    </WorldMap>
    <div className={`mapquiz-feedback${result ? (result.km <= CLOSE_KM ? ' close' : ' far') : ''}`} role="status">
      {result ? <>
        <p><strong>{formatKm(result.km)}</strong> 떨어졌어요 · <strong>+{result.score}점</strong>{result.km <= CLOSE_KM ? ' 🎯' : ''}</p>
        {place.note && <p className="mapquiz-note">{place.note}</p>}
      </> : <p className="muted">{guess ? '위치를 바꾸려면 다시 누르세요. 확정하면 정답이 나와요.' : '끌어서 이동하고, 휠이나 두 손가락·+ 버튼으로 확대할 수 있어요.'}</p>}
    </div>
    <div className="mapquiz-actions">
      {result
        ? <Button type="button" onClick={next}>{cursor < order.length - 1 ? '다음 지역' : '결과 보기'}</Button>
        : <Button type="button" onClick={submit} disabled={!guess}>위치 확정</Button>}
      <Button variant="ghost" type="button" onClick={restart}>처음부터</Button>
    </div>
  </section>
}
