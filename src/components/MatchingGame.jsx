import React, { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'
import { matchingPairs, shuffled } from '../lib/matching'

export default function MatchingGame({ body, onComplete = () => {}, onReset = () => {} }) {
  const pairs = matchingPairs(body)
  const [round, setRound] = useState(() => ({ names: shuffled(pairs), achievements: shuffled(pairs) }))
  const [selected, setSelected] = useState({})
  const [matched, setMatched] = useState(new Set())
  const [mistakes, setMistakes] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const [feedback, setFeedback] = useState('이름과 업적을 하나씩 선택하세요. 어느 쪽부터 눌러도 좋아요.')
  const [wrong, setWrong] = useState(null)
  const startTime = useRef(null)
  const done = matched.size === pairs.length

  useEffect(() => {
    if (!started || done) return
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 250)
    return () => clearInterval(timer)
  }, [started, done])
  useEffect(() => {
    if (!wrong) return
    const timer = setTimeout(() => { setWrong(null); setSelected({}) }, 650)
    return () => clearTimeout(timer)
  }, [wrong])

  function choose(side, id) {
    if (wrong || matched.has(id) || done) return
    if (!started) { startTime.current = Date.now(); setStarted(true) }
    const next = { ...selected, [side]: selected[side] === id ? undefined : id }
    setSelected(next)
    if (next.name === undefined || next.achievement === undefined) return
    if (next.name === next.achievement) {
      const updated = new Set([...matched, id])
      setMatched(updated)
      setSelected({})
      setFeedback(`정답! ${pairs[id].name} · ${pairs[id].achievement}`)
      if (updated.size === pairs.length) {
        setElapsed(Math.floor((Date.now() - startTime.current) / 1000))
        onComplete()
      }
    } else {
      setMistakes((count) => count + 1)
      setWrong(next)
      setFeedback('다른 짝이에요. 다시 연결해 보세요!')
    }
  }
  function restart() {
    setRound({ names: shuffled(pairs), achievements: shuffled(pairs) })
    setSelected({}); setMatched(new Set()); setMistakes(0); setElapsed(0)
    setStarted(false); setWrong(null); startTime.current = null
    setFeedback('새로운 순서로 섞었어요. 이름과 업적을 연결하세요.')
    onReset()
  }
  const tiles = (items, side) => items.map((pair) => (
    <button type="button" key={pair.id}
      className={`matching-tile${selected[side] === pair.id ? ' selected' : ''}${wrong?.[side] === pair.id ? ' wrong' : ''}${matched.has(pair.id) ? ' matched' : ''}`}
      aria-pressed={selected[side] === pair.id}
      aria-label={`${side === 'name' ? pair.name : pair.achievement}${matched.has(pair.id) ? ' · 매칭 완료' : ''}`}
      disabled={matched.has(pair.id) || !!wrong || done}
      onClick={() => choose(side, pair.id)}>
      <span>{side === 'name' ? pair.name : pair.achievement}</span>
      {matched.has(pair.id) && <small>✓ 완료</small>}
    </button>
  ))
  return (
    <section className="matching-game" data-no-swipe aria-label="인물과 업적 매칭 게임">
      <p className="muted">인물의 이름과 업적을 연결해 모든 짝을 완성하세요.</p>
      <div className="matching-stats">
        <span>매칭 <strong>{matched.size} / {pairs.length}</strong></span>
        <span>시간 <strong>{elapsed}초</strong></span>
        <span>오답 <strong>{mistakes}회</strong></span>
      </div>
      <p className={`matching-feedback${wrong ? ' error' : ''}`} role="status">{feedback}</p>
      <div className="matching-board">
        <div><h2>인물</h2>{tiles(round.names, 'name')}</div>
        <div><h2>업적</h2>{tiles(round.achievements, 'achievement')}</div>
      </div>
      {done && <div className="matching-result" role="status">
        <h2>모든 짝을 찾았어요!</h2>
        <p>{pairs.length}쌍 완성 · {elapsed}초 · 오답 {mistakes}회</p>
        <p>아래의 ‘기억했어요’를 눌러 다음 카드로 이어가세요.</p>
      </div>}
      <Button variant="outline" type="button" onClick={restart}>순서 섞고 다시 도전</Button>
    </section>
  )
}
