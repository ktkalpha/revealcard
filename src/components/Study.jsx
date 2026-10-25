import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  Eye,
  EyeOff,
  Layers3,
  Pencil,
  PenLine,
  Plus,
  RotateCcw,
  Shuffle,
  Keyboard,
} from 'lucide-react'
import { Button } from './ui/button'
import MaskedText from './MaskedText'
import PassageText from './PassageText'
import MatchingGame from './MatchingGame'
// The world map data is large, so the map game loads on first use.
const MapQuizGame = React.lazy(() => import('./MapQuizGame'))
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
  initialMode = 'all',
  ratings,
  wrongMasks,
  onMarkWrong,
  position,
  onHome,
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
  onHelp,
}) {
  const startsWithReview = initialMode === 'cards'
  const [queue, setQueue] = useState(() => startsWithReview
    ? deck.cards.filter((c) => ratings[c.id] === 'again').map((c) => c.id)
    : deck.cards.map((c) => c.id))
  const [cursor, setCursor] = useState(() =>
    startsWithReview ? 0 : Math.max(
      0,
      deck.cards.findIndex((c) => c.id === position),
    ),
  )
  const [gameVersion, setGameVersion] = useState(0)
  const [matchingDone, setMatchingDone] = useState(false)
  const [revealed, setRevealed] = useState(new Set())
  const [results, setResults] = useState({})
  const [complete, setComplete] = useState(false)
  const [reviewMode, setReviewMode] = useState(startsWithReview ? 'cards' : 'all')
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
  const isGame = ['matching','classification','mapquiz'].includes(card?.kind)
  // Notes are ordinary cards now; only passages and photo games keep a page layout.
  const wide = ['passage','classification','mapquiz'].includes(card?.kind)
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
  const knownCount = Object.values(results).filter((v) => v === 'known').length
  // Occlusion boxes take part only when every box has a label to type.
  const hardActive = hard && !isGame && maskIds.length > 0 && cardMasks.every((mask) => mask.text.trim())
  const hardTarget = !hardActive ? null
    : active !== null && maskIds.includes(active) && !revealed.has(active) ? active
      // After answering, carry on from that blank rather than jumping back to the top.
      : [...maskIds.slice(maskIds.indexOf(active) + 1), ...maskIds].find((id) => !revealed.has(id)) ?? null
  // 서술형 on a card with blanks: question on the left, answers on the right (wide screens).
  const split = hardActive && !complete
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
      className={`study-page${split ? ' hard-split' : ''}${card?.kind === 'classification' ? ' classification-study-page' : ''}${wide ? ' note-study-page' : ''}${hardActive && hardTarget !== null && !complete ? ' hard-answering' : ''}`}
    >
      <div className="study-layout">
        <div className="study-workspace">
          <header className="study-head">
            <Button variant="ghost" size="icon" className="study-back" aria-label="홈으로" title="홈으로" onClick={onHome}>
              <ArrowLeft size={19} />
            </Button>
            <div className="study-head-title">
              <strong>{deck.name}</strong>
              <span aria-live="polite">
                {reviewMode === 'cards' ? '다시 볼 카드' : reviewMode === 'masks' ? '틀린 가리개' : '전체'}
                {deck.cards.length > 0 && queue.length > 0 && !complete && <> · {cursor + 1} / {queue.length}</>}
              </span>
            </div>
            {onEdit && card && !complete && (
              <Button variant="ghost" size="sm" className="study-head-button" aria-label="현재 카드 수정" title="현재 카드 수정" onClick={() => onEdit(card)}>
                <Pencil size={16} /> <span>수정</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="study-head-button" aria-label="카드 관리" title="카드 관리" onClick={onLibrary}>
              <Layers3 size={16} /> <span>카드 관리</span>
            </Button>
          </header>
          {deck.cards.length > 0 && (
            <div className="study-controls">
              <div className="segmented study-range" role="group" aria-label="학습 범위">
                <button aria-pressed={reviewMode === 'all'} onClick={() => start(deck.cards.map((c) => c.id))}>
                  전체 <span>{deck.cards.length}</span>
                </button>
                <button aria-pressed={reviewMode === 'cards'} onClick={() => start(reviewIds, 'cards')} title="‘다시 볼게요’로 표시한 카드">
                  다시 볼 카드 <span>{reviewIds.length}</span>
                </button>
                <button aria-pressed={reviewMode === 'masks'} onClick={() => start(wrongReviewIds, 'masks')} title="✕로 틀림 표시한 빈칸이 있는 카드">
                  틀린 빈칸 <span>{wrongReviewIds.length}</span>
                </button>
              </div>
              <div className="study-switches">
                <Button
                  variant={hard ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={hard}
                  title="서술형: 빈칸의 답을 직접 써서 채점해요"
                  onClick={switchHard}
                >
                  <PenLine size={15} /> 서술형{hard ? ' 켜짐' : ''}
                </Button>
                <Button variant="outline" size="sm" onClick={shuffle} disabled={queue.length < 2} title="카드 순서 섞기">
                  <Shuffle size={15} /> 섞기
                </Button>
              </div>
            </div>
          )}
      {!deck.cards.length ? (
        <section className="empty-state paper">
          <BookOpen size={34} strokeWidth={1.4} />
          <h1>아직 카드가 없어요</h1>
          <p>기억할 내용을 적고, 중요한 부분을 가려보세요.</p>
          {onEdit && (
            <Button onClick={onAdd}>
              <Plus size={17} /> 카드 만들기
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" onClick={onImport}>
              파일에서 불러오기
            </Button>
          )}
        </section>
      ) : (
        <>
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
                <Button variant="ghost" onClick={onHome}>
                  홈으로
                </Button>
              </div>
            </section>
          ) : (
            card && (
              <>
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
                <div className={`study-stage${split ? ' split' : ''}`}>
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
                  {(isGame || card.kind === 'passage') && (
                    <div className="sheet-top">
                      <span className="overline">{isGame ? '게임' : '본문'}</span>
                    </div>
                  )}
                  <div className={wide ? 'note-study-content' : 'sheet-content'} key={card.id}>
                    <h1 style={wide ? undefined : { textAlign }}>{card.title}</h1>
                    {card.kind === 'classification' ? <ClassificationGame key={`${card.id}-${gameVersion}`} body={card.body} onComplete={()=>setMatchingDone(true)} onReset={()=>setMatchingDone(false)} onAnswer={correct=>companion?.react(correct ? 'known' : 'again')} keyboardEnabled={!modalOpen}/> : card.kind === 'passage' ? <PassageText card={card} revealed={revealed} onToggle={tapMask} activeId={activeId} onHighlight={onHighlight} focusIds={focusIds} wrongIds={new Set(wrongMasks[card.id] || [])} onMarkWrong={(id,wrong)=>onMarkWrong(card.id,id,wrong)}/> : card.kind === 'mapquiz' ? (
                      <React.Suspense fallback={<p className="muted">지도를 불러오는 중…</p>}><MapQuizGame key={`${card.id}-${gameVersion}`} body={card.body} onComplete={() => setMatchingDone(true)} onReset={() => setMatchingDone(false)} onAnswer={correct=>companion?.react(correct ? 'known' : 'again')} keyboardEnabled={!modalOpen} /></React.Suspense>
                    ) : card.kind === 'matching' ? (
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
                    <p className="action-hint">{card.kind === 'classification' ? '사진을 모두 분류하면 학습 완료를 표시할 수 있어요.' : card.kind === 'mapquiz' ? '모든 지역을 찾고 결과를 보면 학습 완료를 표시할 수 있어요. ‘다음’으로 건너뛸 수도 있어요.' : '모든 짝을 맞히면 학습 완료를 표시할 수 있어요. ‘다음’으로 건너뛸 수도 있어요.'}</p>
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
                      <p className="action-hint">답을 먼저 떠올려 보고, 빈칸을 눌러 확인하세요.</p>
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
                    <span className="study-count">{doneCount > 0 ? `${doneCount}장 확인` : card.kind === 'passage' ? '하이라이트를 눌러 카드 보기' : ''}</span>
                    <Button variant="ghost" onClick={() => move(1)}>
                      {cursor === queue.length - 1 ? '학습 마치기' : '다음'}
                      <ArrowRight size={17} />
                    </Button>
                  </div>
                </div>
                </div>
                {!isGame && (
                  <p className="study-keys">
                    <Keyboard size={14} />
                    <span><kbd>Space</kbd> 빈칸 보기</span>
                    <span><kbd>←</kbd><kbd>→</kbd> 이동</span>
                    <span><kbd>1</kbd> 다시 볼게요 · <kbd>2</kbd> 기억했어요</span>
                    {canMarkWrong && <span><kbd>X</kbd> 틀림 표시</span>}
                    {onHelp && <button type="button" className="link-button" onClick={() => onHelp('keys')}>전체 단축키</button>}
                  </p>
                )}
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
