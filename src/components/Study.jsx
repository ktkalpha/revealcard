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
  PenLine,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Target,
  Layers3,
} from 'lucide-react'
import { Button } from './ui/button'
import MaskedText from './MaskedText'
import PassageText from './PassageText'
import MatchingGame from './MatchingGame'
import ClassificationGame from './ClassificationGame'
import OcclusionImage from './OcclusionImage'
import StudyPets from './StudyPet'
import HardAnswer from './HardAnswer'
import { masksIn, maskKey, wrongMaskIds } from '../lib/masks'
import { occlusionMasks } from '../lib/occlusion'
import { isStructured } from '../lib/editing'
import { grade, isNumberAnswer, normalize } from '../lib/grade'
import { api } from '../lib/api'

const HARD_KEY = 'revealcard-hard-mode'
const readHard = () => {
  try { return localStorage.getItem(HARD_KEY) === '1' } catch { return false }
}

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
  onHighlight,
  companion,
  onPetSettings,
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
  // The blank the keyboard acts on (↑↓ to move, Enter to toggle, X to mark wrong).
  const [active, setActive] = useState(null)
  // Hard (서술형) mode: blanks are answered by typing instead of being opened.
  const [hard, setHard] = useState(readHard)
  const [feedback, setFeedback] = useState(null)
  const [hardResults, setHardResults] = useState({})
  const [grading, setGrading] = useState(false)
  const currentCard = useRef(null)
  const completionActions = useRef(null)
  const pointer = useRef(null)
  const ignoreClick = useRef(false)
  const card = deck.cards.find((c) => c.id === queue[cursor])
  currentCard.current = card?.id
  const isGame = ['matching','classification'].includes(card?.kind)
  // Notes are ordinary cards now; only passages and photo games keep a page layout.
  const wide = ['passage','classification'].includes(card?.kind)
  const textAlign = card?.align || (isStructured(card?.body || '') ? 'left' : 'center')
  const cardMasks = card?.kind === 'occlusion' ? occlusionMasks(card.body) : masksIn(card?.body || '')
  const focusIds = reviewMode === 'masks'
    ? new Set(focusByCard[card?.id] || [])
    : null
  const maskIds = cardMasks
    .filter((mask) => !focusIds || focusIds.has(mask.id))
    .map((mask) => mask.id)
  const allVisible = isGame ? matchingDone : maskIds.every((id) => revealed.has(id))
  const canMarkWrong = !!onMarkWrong && card?.kind !== 'occlusion' && !isGame
  const cardWrongKeys = new Set(wrongMasks[card?.id] || [])
  const wrongCount = canMarkWrong
    ? cardMasks.filter((mask) => maskIds.includes(mask.id) && cardWrongKeys.has(maskKey(mask))).length
    : 0
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
  // Occlusion boxes take part only when every box has a label to type.
  const hardActive = hard && !isGame && maskIds.length > 0 && cardMasks.every((mask) => mask.text.trim())
  const hardTarget = !hardActive ? null
    : active !== null && maskIds.includes(active) && !revealed.has(active) ? active
      // After answering, carry on from that blank rather than jumping back to the top.
      : [...maskIds.slice(maskIds.indexOf(active) + 1), ...maskIds].find((id) => !revealed.has(id)) ?? null
  const hardTally = Object.values(hardResults).reduce((tally, verdict) => ({ ...tally, [verdict]: (tally[verdict] || 0) + 1 }), {})

  useEffect(() => {
    setRevealed(new Set())
    setActive(null)
    setMatchingDone(false)
    setFeedback(null)
    setHardResults({})
    if (card) onPosition(card.id)
  }, [card?.id])
  // In Hard mode the blank to answer comes into view (above the answer box) as it changes.
  const focusMask = hardTarget ?? active
  useEffect(() => {
    if (focusMask !== null)
      document.querySelector(`[data-mask-id="${CSS.escape(String(focusMask))}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [focusMask])
  useEffect(() => {
    if (complete) completionActions.current?.querySelector('button')?.focus()
  }, [complete])
  const toggle = (id) => {
    setActive(id)
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const reveal = (id) => {
    setActive(id)
    setRevealed((prev) => new Set([...prev, id]))
  }
  const revealNext = () => {
    const id = maskIds.find((id) => !revealed.has(id))
    if (id !== undefined) reveal(id)
  }
  const activeId = hardTarget ?? (maskIds.includes(active) ? active : null)
  const switchHard = () => {
    const next = !hard
    setHard(next)
    setFeedback(null)
    try { localStorage.setItem(HARD_KEY, next ? '1' : '0') } catch {}
  }
  // In Hard mode tapping a covered blank picks it to answer instead of opening it.
  const tapMask = (id) => (hardActive && !revealed.has(id) ? setActive(id) : toggle(id))
  const setWrongMark = (id, wrong) => {
    if (!canMarkWrong) return
    const key = maskKey(cardMasks.find((mask) => mask.id === id))
    if (cardWrongKeys.has(key) !== wrong) onMarkWrong(card.id, key, wrong)
  }
  const judge = (id, verdict, extra) => {
    reveal(id)
    setHardResults((prev) => ({ ...prev, [id]: verdict }))
    setWrongMark(id, verdict === 'wrong' || verdict === 'skip')
    setFeedback({ id, verdict, answer: cardMasks.find((mask) => mask.id === id).text, ...extra })
  }
  // Typed answers are checked locally first. Longer answers it cannot accept go to the
  // server's meaning-based grader, so paraphrases count; offline or on failure the local verdict stands.
  const submitAnswer = async (input) => {
    if (grading) return
    const id = hardTarget, cardId = card.id
    const answer = cardMasks.find((mask) => mask.id === id).text
    let result = grade(answer, input)
    let source = 'local'
    if (result.verdict !== 'correct' && normalize(answer).length >= 4 && !isNumberAnswer(answer) && navigator.onLine) {
      setGrading(true)
      try {
        const checked = await api('/api/grade', { method: 'POST', body: { answer, input } })
        result = checked
        source = 'meaning'
      } catch {}
      setGrading(false)
      if (currentCard.current !== cardId) return
    }
    companion?.react(result.verdict === 'wrong' ? 'again' : 'known')
    judge(id, result.verdict, { score: result.score, input: input.trim(), source })
  }
  const overrule = () => {
    if (!feedback) return
    const verdict = feedback.verdict === 'wrong' ? 'correct' : 'wrong'
    setHardResults((prev) => ({ ...prev, [feedback.id]: verdict }))
    setWrongMark(feedback.id, verdict === 'wrong')
    setFeedback({ ...feedback, verdict, overridden: true })
  }
  const selectMask = (step) => {
    if (!maskIds.length) return
    const index = maskIds.indexOf(activeId)
    const next = index < 0
      ? (step > 0 ? 0 : maskIds.length - 1)
      : Math.max(0, Math.min(maskIds.length - 1, index + step))
    setActive(maskIds[next])
  }
  // X: toggle the wrong mark on the selected blank. A hidden blank is opened
  // and marked at once — not knowing it is what makes it wrong.
  const toggleWrong = () => {
    if (!canMarkWrong || !maskIds.length) return
    const id = activeId ?? maskIds.find((id) => !revealed.has(id)) ?? maskIds[0]
    const mask = cardMasks.find((item) => item.id === id)
    const key = maskKey(mask)
    if (!revealed.has(id)) {
      reveal(id)
      onMarkWrong(card.id, key, true)
    } else {
      setActive(id)
      onMarkWrong(card.id, key, !cardWrongKeys.has(key))
    }
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
      if (!complete && card && !isGame) {
        // e.code keeps letter shortcuts working while a Korean IME is on.
        const code = e.code
        const onControl = e.target.closest('button,a,select')
        if (code === 'Space' && !onControl) {
          e.preventDefault()
          allVisible ? rate('known') : revealNext()
        }
        if (code === 'Enter' && !onControl && maskIds.length) {
          e.preventDefault()
          activeId !== null ? toggle(activeId) : revealNext()
        }
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && maskIds.length) {
          e.preventDefault()
          selectMask(e.key === 'ArrowDown' ? 1 : -1)
        }
        if (code === 'Digit1' || code === 'Numpad1') rate('again')
        if (code === 'Digit2' || code === 'Numpad2') rate('known')
        if (code === 'KeyX') toggleWrong()
        if (code === 'KeyA' && maskIds.length)
          setRevealed(allVisible ? new Set() : new Set(maskIds))
        if (code === 'KeyR') {
          setRevealed(new Set())
          setActive(null)
        }
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

  useEffect(() => {
    if (complete) companion?.react('complete')
  }, [complete])
  const petProps = companion ? { pets: companion.pets, reaction: companion.reaction, onReact: companion.react, onSettings: onPetSettings, onMove: (id, position) => companion.update(id, prev => ({...prev,position})) } : null
  return (
    <main
      id="main"
      className={`study-page${card?.kind === 'classification' ? ' classification-study-page' : ''}${wide ? ' note-study-page' : ''}${hardActive && hardTarget !== null && !complete ? ' hard-answering' : ''}`}
    >
      <div className="study-layout">
        <aside className="study-overview" aria-label="학습 현황">
          <p className="workspace-eyebrow"><Target size={14} /> MY PROGRESS</p>
          <h2>한 장씩,<br /><span>더 선명하게.</span></h2>
          <p className="overview-description">가리고, 떠올리고, 기억하기.<br />오늘도 한 장씩 채워보세요.</p>
          <div className="memory-summary">
            <div className="memory-summary-label"><Target size={16} /><span>나의 기억 현황</span><strong>{rememberedPercent}%</strong></div>
            <div className="memory-meter"><span style={{ width: `${rememberedPercent}%` }} /></div>
            <div className="memory-metrics"><div><strong>{rememberedCount}<small> / {deck.cards.length}</small></strong><span>기억한 카드</span></div><div><strong>{reviewIds.length}</strong><span>다시 볼 카드</span></div></div>
          </div>
          <div className="overview-tip"><span>작은 학습 팁</span><p>정답을 보기 전 잠깐 멈춰보세요.<br />떠올리는 순간, 기억이 깊어져요.</p></div>
        </aside>
        <div className="study-workspace">
          <div className="workspace-heading"><div><p className="workspace-eyebrow">STUDY WORKSPACE</p><h2>오늘의 학습</h2><p>정답을 떠올리는 순간, 기억이 시작돼요.</p></div><span className="workspace-status"><span />{deck.cards.length}장의 가능성</span></div>
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
              variant={hard ? 'default' : 'ghost'}
              size="sm"
              className="hard-toggle"
              aria-pressed={hard}
              title="Hard 모드: 빈칸의 답을 직접 써서 채점해요"
              onClick={switchHard}
            >
              <PenLine size={16} /> Hard
            </Button>
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
              <div className="completion-actions" ref={completionActions}>
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
                  className={wide ? 'note-study' : `card-sheet paper ${textAlign === 'left' ? 'long-card' : ''} ${drag ? 'dragging' : ''}`}
                  style={{
                    transform: !wide && drag
                      ? `translateX(${drag}px) rotate(${drag / 35}deg)`
                      : undefined,
                  }}
                  data-no-swipe={isGame ? true : undefined}
                  onPointerDown={wide ? undefined : pointerDown}
                  onPointerMove={wide ? undefined : pointerMove}
                  onPointerUp={wide ? undefined : pointerEnd}
                  onPointerCancel={wide ? undefined : () => {
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
                      {isGame ? 'SPECIAL GAME' : card.kind === 'passage' ? 'PASSAGE' : 'CARD'} {String(cursor + 1).padStart(2, '0')}
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
                  <div className={wide ? 'note-study-content' : 'sheet-content'} key={card.id}>
                    <h1 style={wide ? undefined : { textAlign }}>{card.title}</h1>
                    {card.kind === 'classification' ? <ClassificationGame key={`${card.id}-${gameVersion}`} body={card.body} onComplete={()=>setMatchingDone(true)} onReset={()=>setMatchingDone(false)} onAnswer={correct=>companion?.react(correct ? 'known' : 'again')} keyboardEnabled={!modalOpen}/> : card.kind === 'passage' ? <PassageText card={card} revealed={revealed} onToggle={tapMask} activeId={activeId} onHighlight={onHighlight} focusIds={focusIds} wrongIds={new Set(wrongMasks[card.id] || [])} onMarkWrong={(id,wrong)=>onMarkWrong(card.id,id,wrong)}/> : card.kind === 'matching' ? (
                      <MatchingGame key={`${card.id}-${gameVersion}`} body={card.body} onComplete={() => setMatchingDone(true)} onReset={() => setMatchingDone(false)} />
                    ) : card.kind === 'occlusion' ? (
                      <OcclusionImage body={card.body} alt={card.title} revealed={revealed} onToggle={tapMask} focusIds={focusIds} activeId={activeId} />
                    ) : (
                      <MaskedText
                        body={card.body}
                        align={textAlign}
                        revealed={revealed}
                        onToggle={tapMask}
                        activeId={activeId}
                        focusIds={focusIds}
                        wrongIds={new Set(wrongMasks[card.id] || [])}
                        onMarkWrong={(id, wrong) => onMarkWrong(card.id, id, wrong)}
                      />
                    )}
                  </div>
                  {!isGame && <div className="sheet-bottom" data-no-swipe>
                    <span aria-live="polite">
                      {maskIds.length
                        ? `${maskIds.filter((id) => revealed.has(id)).length} / ${maskIds.length}개 공개${wrongCount ? ` · 틀림 ${wrongCount}` : ''}`
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
                  {isGame && !matchingDone ? (
                    <p className="action-hint">{card.kind === 'classification' ? '사진을 모두 분류하면 학습 완료를 표시할 수 있어요.' : '모든 짝을 맞히면 학습 완료를 표시할 수 있어요. ‘다음’으로 건너뛸 수도 있어요.'}</p>
                  ) : hardActive && (!allVisible || feedback) ? (
                    <>
                      <HardAnswer
                        target={allVisible ? null : hardTarget}
                        ordinal={maskIds.indexOf(hardTarget) + 1}
                        remaining={maskIds.filter((id) => !revealed.has(id)).length}
                        feedback={feedback}
                        onSubmit={submitAnswer}
                        busy={grading}
                        onGiveUp={() => hardTarget !== null && judge(hardTarget, 'skip', { score: 0, input: '' })}
                        onOverride={overrule}
                      />
                      {allVisible && <HardRating tally={hardTally} onRate={rate} />}
                    </>
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
                      {hardActive && Object.keys(hardResults).length > 0 && <p className="hard-tally">서술형 결과 · 정답 {(hardTally.correct || 0) + (hardTally.close || 0)} · 오답 {(hardTally.wrong || 0) + (hardTally.skip || 0)}</p>}
                      <div className="rating-actions">
                        <Button variant="outline" onClick={() => rate('again')}>
                          <RotateCcw size={17} /> 다시 볼게요 <kbd>1</kbd>
                        </Button>
                        <Button onClick={() => rate('known')}>
                          <Check size={18} /> 기억했어요 <kbd>2</kbd>
                        </Button>
                      </div>
                      <p className="action-hint">
                        {canMarkWrong && maskIds.length
                          ? <>틀린 빈칸은 옆의 ✕로 표시해 두고, 기억 상태를 선택하세요. <kbd>X</kbd></>
                          : '얼마나 기억났나요? 선택하면 다음 카드로 넘어가요.'}
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
                    {!['matching', 'classification'].includes(card.kind) && <span className="swipe-tip">{card.kind === 'passage' ? '하이라이트를 눌러 카드 보기' : '좌우로 밀어 카드 이동'}</span>}
                    <Button variant="ghost" onClick={() => move(1)}>
                      {cursor === queue.length - 1 ? '학습 마치기' : '다음'}
                      <ArrowRight size={17} />
                    </Button>
                  </div>
                </div>
                {!isGame && <p className="keyboard-tip">
                  <Keyboard size={14} />
                  <span>← → 카드 이동</span>
                  <span>Space 빈칸 보기</span>
                  {maskIds.length > 0 && <span>↑ ↓ 빈칸 선택 · Enter 열기/닫기</span>}
                  {canMarkWrong && maskIds.length > 0 && <span>X 틀림 표시</span>}
                  {maskIds.length > 0 && <span>A 모두 보기</span>}
                  <span>R 다시 가리기</span>
                  <span>1 · 2 평가</span>
                </p>}
              </>
            )
          )}
        </>
      )}
        </div>
      </div>
      {petProps && <StudyPets {...petProps} />}
    </main>
  )
}

function HardRating({ tally, onRate }) {
  const right = (tally.correct || 0) + (tally.close || 0)
  const missed = (tally.wrong || 0) + (tally.skip || 0)
  return (
    <>
      <p className="hard-tally">서술형 결과 · 정답 {right} · 오답 {missed}</p>
      <div className="rating-actions">
        <Button variant={missed ? 'default' : 'outline'} onClick={() => onRate('again')}>
          <RotateCcw size={17} /> 다시 볼게요 <kbd>1</kbd>
        </Button>
        <Button variant={missed ? 'outline' : 'default'} onClick={() => onRate('known')}>
          <Check size={18} /> 기억했어요 <kbd>2</kbd>
        </Button>
      </div>
    </>
  )
}
