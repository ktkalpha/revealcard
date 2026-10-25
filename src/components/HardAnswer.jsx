import React, { useEffect, useRef, useState } from 'react'
import { Check, CircleHelp, Send, X } from 'lucide-react'
import { Button } from './ui/button'
import MathText from './MathText'

const LABELS = { correct: '정답', close: '거의 맞음', wrong: '오답', skip: '모름' }

// Hard (서술형) mode: type the answer for the highlighted blank, then it is graded and opened.
export default function HardAnswer({ target, ordinal, remaining, feedback, busy, onSubmit, onGiveUp, onOverride }) {
  const [text, setText] = useState('')
  const input = useRef(null)
  useEffect(() => {
    setText('')
    if (target !== null) input.current?.focus({ preventScroll: true })
  }, [target])
  const submit = (e) => {
    e?.preventDefault()
    if (target === null || !text.trim() || busy) return
    onSubmit(text)
  }
  return (
    <div className={`hard-answer${target !== null ? ' floating' : ''}`} data-no-swipe>
      {feedback && (
        <div className={`hard-feedback ${feedback.verdict}`} role="status" aria-live="polite">
          <div className="hard-feedback-head">
            <strong>{LABELS[feedback.verdict]}</strong>
            {feedback.verdict !== 'skip' && <span>{feedback.source === 'meaning' ? '의미 채점' : '유사도'} {Math.round(feedback.score * 100)}%{feedback.overridden ? ' · 직접 판정' : ''}</span>}
            {feedback.verdict !== 'skip' && (
              <Button type="button" variant="ghost" size="sm" className="hard-override" onClick={onOverride}>
                {feedback.verdict === 'wrong'
                  ? <><Check size={14} /> 맞은 걸로</>
                  : <><X size={14} /> 틀린 걸로</>}
              </Button>
            )}
          </div>
          <div className="hard-feedback-body">
            <p><span>정답</span> <MathText text={feedback.answer} /></p>
            {feedback.input && <p><span>내 답</span> {feedback.input}</p>}
          </div>
        </div>
      )}
      {target !== null && (
        <form onSubmit={submit}>
          <div className="hard-label-row">
            <label htmlFor="hard-input">{ordinal}번째 빈칸</label>
            <span>남은 {remaining}개</span>
            <button type="button" className="hard-skip" onClick={onGiveUp} disabled={busy}>
              <CircleHelp size={14} /> 모르겠어요
            </button>
          </div>
          <div className="hard-input-row">
            <textarea
              id="hard-input"
              ref={input}
              rows={1}
              value={text}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="답을 써 보세요"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) submit(e)
              }}
            />
            <Button type="submit" className="hard-send" disabled={!text.trim() || busy} aria-label="채점">
              <Send size={16} /> <span>{busy ? '채점 중…' : '채점'}</span>
            </Button>
          </div>
          <p className="hard-tip">Enter로 채점 · 문제의 다른 빈칸을 눌러 고를 수 있어요</p>
        </form>
      )}
    </div>
  )
}
