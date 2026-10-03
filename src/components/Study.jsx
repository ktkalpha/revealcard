import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Eye,
  EyeOff,
  Keyboard,
  Pencil,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Target,
  Layers3,
} from 'lucide-react'
import { Button } from './ui/button'
import MaskedText from './MaskedText'
import NoteStudy from './NoteStudy'
import MatchingGame from './MatchingGame'
import { masksIn, wrongMaskIds } from '../lib/masks'

export default function Study({
  deck,
  decks,
  ratings,
  wrongMasks,
  onMarkWrong,
  position,
  onDeck,
  onRate,
  onPosition,
  onEdit,
  onLibrary,
  onAdd,
  onImport,
  modalOpen,
}) {
  const [queue, setQueue] = useState(() => deck.cards.map((c) => c.id))
  const [cursor, setCursor] = useState(() =>
    Math.max(
      0,
      deck.cards.findIndex((c) => c.id === position),
    ),
  )
  const [gameVersion, setGameVersion] = useState(0)
  const [matchingDone, setMatchingDone] = useState(false)
  const [revealed, setRevealed] = useState(new Set())
  const [results, setResults] = useState({})
  const [complete, setComplete] = useState(false)
  const [reviewMode, setReviewMode] = useState('all')
  const [focusByCard, setFocusByCard] = useState({})
  const [drag, setDrag] = useState(0)
  const pointer = useRef(null)
  const ignoreClick = useRef(false)
  const card = deck.cards.find((c) => c.id === queue[cursor])
  const cardMasks = masksIn(card?.body || '')
  const focusIds = reviewMode === 'masks'
    ? new Set(focusByCard[card?.id] || [])
    : null
  const maskIds = cardMasks
    .filter((mask) => !focusIds || focusIds.has(mask.id))
    .map((mask) => mask.id)
  const allVisible = card?.kind === 'matching' ? matchingDone : maskIds.every((id) => revealed.has(id))
  const reviewIds = deck.cards
    .filter((c) => ratings[c.id] === 'again')
    .map((c) => c.id)
  const wrongFocus = Object.fromEntries(deck.cards.map((item) => [
    item.id, wrongMaskIds(item.body, wrongMasks[item.id]),
  ]))
  const wrongReviewIds = deck.cards
    .filter((item) => wrongFocus[item.id].length)
    .map((item) => item.id)
  const doneCount = Object.keys(results).length
  const againIds = queue.filter((id) => results[id] === 'again')
  const unmarkedIds = queue.filter((id) => !results[id])
  const rememberedCount = deck.cards.filter((item) => ratings[item.id] === 'known').length
  const rememberedPercent = deck.cards.length ? Math.round(rememberedCount / deck.cards.length * 100) : 0
  const knownCount = Object.values(results).filter((v) => v === 'known').length

  useEffect(() => {
    setRevealed(new Set())
    setMatchingDone(false)
    if (card) onPosition(card.id)
  }, [card?.id])
  const toggle = (id) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const revealNext = () => {
    const id = maskIds.find((id) => !revealed.has(id))
    if (id !== undefined) setRevealed((prev) => new Set([...prev, id]))
  }
  const move = (step) => {
    if (complete) return
    const next = cursor + step
    if (next >= queue.length) {
      setComplete(true)
      return
    }
    if (next >= 0) setCursor(next)
  }
  const rate = (value) => {
    if (!card || !allVisible || complete) return
    setResults((prev) => ({ ...prev, [card.id]: value }))
    onRate(card.id, value)
    move(1)
  }
  const start = (ids, mode = 'all') => {
    setMatchingDone(false)
    setGameVersion((version) => version + 1)
    setQueue(ids)
    setCursor(0)
    setRevealed(new Set())
    setResults({})
    setComplete(false)
    setReviewMode(mode)
    setFocusByCard(mode === 'masks' ? wrongFocus : {})
  }
  const shuffle = () => {
    const ids = [...queue]
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    start(ids, reviewMode)
  }
  useEffect(() => {
    const keydown = (e) => {
      if (
        modalOpen ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.repeat ||
        e.target.closest(
          'input,textarea,select,dialog,[contenteditable="true"]',
        )
      )
        return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        move(-1)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        move(1)
      }
      if (!complete && card && card.kind !== 'matching') {
        if (e.code === 'Space' && !e.target.closest('button')) {
          e.preventDefault()
          allVisible ? rate('known') : revealNext()
        }
        if (e.key === '1') rate('again')
        if (e.key === '2') rate('known')
        if (e.key.toLowerCase() === 'r') setRevealed(new Set())
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })
  const pointerDown = (e) => {
    if (!e.isPrimary || e.button !== 0 || e.target.closest('[data-no-swipe]'))
      return
    ignoreClick.current = false
    pointer.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      horizontal: false,
      vertical: false,
    }
  }
  const pointerMove = (e) => {
    const p = pointer.current
    if (!p || p.id !== e.pointerId || p.vertical) return
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y
    if (!p.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
      p.vertical = true
      return
    }
    if (
      !p.horizontal &&
      Math.abs(dx) > 12 &&
      Math.abs(dx) > Math.abs(dy) * 1.3
    ) {
      p.horizontal = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (p.horizontal) {
      ignoreClick.current = true
      setDrag(Math.max(-100, Math.min(100, dx * 0.35)))
    }
  }
  const pointerEnd = (e) => {
    const p = pointer.current
    pointer.current = null
    setDrag(0)
    if (!p || p.id !== e.pointerId || !p.horizontal) return
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.3)
      move(dx < 0 ? 1 : -1)
  }

  return (
    <main
      id="main"
      className={`study-page${card?.kind === 'note' ? ' note-study-page' : ''}`}
    >
      <div className="study-layout">
        <aside className="study-overview" aria-label="학습 현황">
          <p className="workspace-eyebrow"><Sparkles size={14} /> YOUR DAILY PRACTICE</p>
          <h2>작은 반복이,<br /><span>큰 기억으로.</span></h2>
          <p className="overview-description">가리고, 떠올리고, 기억하기.<br />오늘도 한 장씩 채워보세요.</p>
          <div className="overview-art" aria-hidden="true"><div className="art-card art-back" /><div className="art-card art-middle" /><div className="art-card art-front"><Layers3 size={25} /><span>reveal.</span><i /><i /></div><span className="art-spark">✦</span></div>
          <div className="memory-summary">
            <div className="memory-summary-label"><Target size={16} /><span>나의 기억 현황</span><strong>{rememberedPercent}%</strong></div>
            <div className="memory-meter"><span style={{ width: `${rememberedPercent}%` }} /></div>
            <div className="memory-metrics"><div><strong>{rememberedCount}<small> / {deck.cards.length}</small></strong><span>기억한 카드</span></div><div><strong>{reviewIds.length}</strong><span>다시 볼 카드</span></div></div>
          </div>
          <div className="overview-tip"><span>작은 학습 팁</span><p>정답을 보기 전 잠깐 멈춰보세요.<br />떠올리는 순간, 기억이 깊어져요.</p></div>
        </aside>
        <div className="study-workspace">
      <div className="study-toolbar">
        <div className="deck-select">
          <BookOpen size={17} />
          <select
            aria-label="학습할 카드 셋"
            value={deck.id}
            onChange={(e) => onDeck(e.target.value)}
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </div>
        <Button variant="ghost" size="sm" onClick={onLibrary}>
          <Layers3 size={16} />
          <span>카드 관리</span>
        </Button>
      </div>
      {!deck.cards.length ? (
        <section className="empty-state paper">
          <BookOpen size={34} strokeWidth={1.4} />
          <h1>첫 카드를 만들어볼까요?</h1>
          <p>기억할 내용을 적고, 중요한 부분을 가려보세요.</p>
          <Button onClick={onAdd}>
            <Plus size={17} /> 카드 만들기
          </Button>
          <Button variant="ghost" onClick={onImport}>
            카드 셋 불러오기
          </Button>
        </section>
      ) : (
        <>
          <div className="session-bar">
            <div className="segmented" aria-label="학습 범위">
              <button
                aria-pressed={reviewMode === 'all'}
                onClick={() => start(deck.cards.map((c) => c.id))}
              >
                전체 <span>{deck.cards.length}</span>
              </button>
              <button
                aria-pressed={reviewMode === 'cards'}
                onClick={() => start(reviewIds, 'cards')}
              >
                다시 볼 카드 <span>{reviewIds.length}</span>
              </button>
              <button
                aria-pressed={reviewMode === 'masks'}
                onClick={() => start(wrongReviewIds, 'masks')}
              >
                틀린 가리개 <span>{wrongReviewIds.length}</span>
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="카드 순서 섞기"
              title="카드 순서 섞기"
              onClick={shuffle}
              disabled={queue.length < 2}
            >
              <Shuffle size={17} />
            </Button>
          </div>
          {queue.length === 0 ? (
            <section className="empty-state paper">
              <CheckCheck size={34} />
              <h2>{reviewMode === 'masks' ? '틀린 가리개가 없어요' : '다시 볼 카드가 없어요'}</h2>
              <p>{reviewMode === 'masks'
                ? '정답을 본 뒤 틀린 가리개를 표시하면 여기에 모여요.'
                : '학습 중 헷갈리는 카드를 표시하면 여기에 모여요.'}</p>
              <Button onClick={() => start(deck.cards.map((c) => c.id))}>
                전체 카드 학습
              </Button>
            </section>
          ) : complete ? (
            <section className="completion paper" aria-live="polite">
              <span className="completion-icon">
                <CheckCheck size={29} strokeWidth={1.5} />
              </span>
              <p className="overline">이번 학습 완료</p>
              <h1>한 번 더, 선명해진 기억.</h1>
              <p className="muted">
                {queue.length}장 중 {doneCount}장의 기억 상태를 표시했어요.
              </p>
              <div className="result-grid">
                <div>
                  <strong>{knownCount}</strong>
                  <span>기억했어요</span>
                </div>
                <div>
                  <strong>{againIds.length}</strong>
                  <span>다시 볼게요</span>
                </div>
                <div>
                  <strong>{unmarkedIds.length}</strong>
                  <span>건너뛰었어요</span>
                </div>
              </div>
              <div className="completion-actions">
                {wrongReviewIds.length > 0 && (
                  <Button
                    onClick={() => start(wrongReviewIds, 'masks')}
                  >
                    <RotateCcw size={16} /> 틀린 가리개 {wrongReviewIds.length}장 복습
                  </Button>
                )}
                {againIds.length + unmarkedIds.length > 0 && (
                  <Button
                    onClick={() => start([...againIds, ...unmarkedIds], 'cards')}
                  >
                    <RotateCcw size={16} /> 남은{' '}
                    {againIds.length + unmarkedIds.length}장 다시 학습
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => start(deck.cards.map((c) => c.id))}
                >
                  전체 다시 학습
                </Button>
                <Button variant="ghost" onClick={onLibrary}>
                  내 카드로 돌아가기
                </Button>
              </div>
            </section>
          ) : (
            card && (
              <>
                <div className="session-progress">
                  <span aria-live="polite">
                    {cursor + 1} <span className="muted">/ {queue.length}</span>
                  </span>
                  <span>{doneCount}장 확인</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="확인한 카드"
                  aria-valuenow={doneCount}
                  aria-valuemin={0}
                  aria-valuemax={queue.length}
                >
                  <span
                    style={{ width: `${(doneCount / queue.length) * 100}%` }}
                  />
                </div>
                <article
                  className={card.kind === 'note' ? 'note-study' : `card-sheet paper ${drag ? 'dragging' : ''}`}
                  style={{
                    transform: card.kind !== 'note' && drag
                      ? `translateX(${drag}px) rotate(${drag / 35}deg)`
                      : undefined,
                  }}
                  data-no-swipe={card.kind === 'matching' ? true : undefined}
                  onPointerDown={card.kind === 'note' ? undefined : pointerDown}
                  onPointerMove={card.kind === 'note' ? undefined : pointerMove}
                  onPointerUp={card.kind === 'note' ? undefined : pointerEnd}
                  onPointerCancel={card.kind === 'note' ? undefined : () => {
                    pointer.current = null
                    setDrag(0)
                  }}
                  onClickCapture={(e) => {
                    if (ignoreClick.current) {
                      e.preventDefault()
                      e.stopPropagation()
                      ignoreClick.current = false
                    }
                  }}
                >
                  <div className="sheet-top">
                    <span className="overline">
                      {card.kind === 'matching' ? 'SPECIAL GAME' : card.kind === 'note' ? 'NOTE' : 'CARD'} {String(cursor + 1).padStart(2, '0')}
                    </span>
                    {onEdit && (
                      <Button
                        data-no-swipe
                        variant="ghost"
                        size="icon"
                        aria-label="현재 카드 수정"
                        onClick={() => onEdit(card)}
                      >
                        <Pencil size={16} />
                      </Button>
                    )}
                  </div>
                  <div className={card.kind === 'note' ? 'note-study-content' : 'sheet-content'} key={card.id}>
                    <h1 style={card.kind === 'note' ? undefined : { textAlign: card.align || 'center' }}>{card.title}</h1>
                    {card.kind === 'matching' ? (
                      <MatchingGame key={`${card.id}-${gameVersion}`} body={card.body} onComplete={() => setMatchingDone(true)} onReset={() => setMatchingDone(false)} />
                    ) : card.kind === 'note' ? (
                      <NoteStudy
                        body={card.body}
                        revealed={revealed}
                        onToggle={toggle}
                        focusIds={focusIds}
                        wrongIds={new Set(wrongMasks[card.id] || [])}
                        onMarkWrong={(id, wrong) => onMarkWrong(card.id, id, wrong)}
                      />
                    ) : (
                      <MaskedText
                        body={card.body}
                        align={card.align}
                        revealed={revealed}
                        onToggle={toggle}
                        focusIds={focusIds}
                        wrongIds={new Set(wrongMasks[card.id] || [])}
                        onMarkWrong={(id, wrong) => onMarkWrong(card.id, id, wrong)}
                      />
                    )}
                  </div>
                  {card.kind !== 'matching' && <div className="sheet-bottom" data-no-swipe>
                    <span aria-live="polite">
                      {maskIds.length
                        ? `${revealed.size} / ${maskIds.length}개 공개`
                        : '내용을 떠올려 보세요'}
                    </span>
                    {maskIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRevealed(allVisible ? new Set() : new Set(maskIds))
                        }
                      >
                        {allVisible ? (
                          <>
                            <EyeOff size={16} /> 다시 가리기
                          </>
                        ) : (
                          <>
                            <Eye size={16} /> 모두 보기
                          </>
                        )}
                      </Button>
                    )}
                  </div>}
                </article>
                <div className="study-dock">
                  {card.kind === 'matching' && !matchingDone ? (
                    <p className="action-hint">모든 짝을 맞히면 학습 완료를 표시할 수 있어요. ‘다음’으로 건너뛸 수도 있어요.</p>
                  ) : !allVisible ? (
                    <>
                      <Button className="reveal-next" onClick={revealNext}>
                        <Eye size={18} /> 빈칸 하나씩 보기 <kbd>Space</kbd>
                      </Button>
                      <p className="action-hint">
                        먼저 답을 떠올린 뒤, 빈칸을 눌러도 좋아요.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="rating-actions">
                        <Button variant="outline" onClick={() => rate('again')}>
                          <RotateCcw size={17} /> 다시 볼게요 <kbd>1</kbd>
                        </Button>
                        <Button onClick={() => rate('known')}>
                          <Check size={18} /> 기억했어요 <kbd>2</kbd>
                        </Button>
                      </div>
                      <p className="action-hint">
                        얼마나 기억났나요? 선택하면 다음 카드로 넘어가요.
                      </p>
                    </>
                  )}
                  <div className="study-navigation">
                    <Button
                      variant="ghost"
                      onClick={() => move(-1)}
                      disabled={cursor === 0}
                    >
                      <ArrowLeft size={17} /> 이전
                    </Button>
                    {!['note', 'matching'].includes(card.kind) && <span className="swipe-tip">좌우로 밀어 카드 이동</span>}
                    <Button variant="ghost" onClick={() => move(1)}>
                      {cursor === queue.length - 1 ? '학습 마치기' : '다음'}
                      <ArrowRight size={17} />
                    </Button>
                  </div>
                </div>
                {card.kind !== 'matching' && <p className="keyboard-tip">
                  <Keyboard size={14} />
                  <span>← → 카드 이동</span>
                  <span>Space 빈칸 보기</span>
                  <span>R 다시 가리기</span>
                </p>}
              </>
            )
          )}
        </>
      )}
        </div>
      </div>
    </main>
  )
}
