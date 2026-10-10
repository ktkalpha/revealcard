import React, { useEffect, useRef, useState } from 'react'
import { Check, CircleHelp, Send, X } from 'lucide-react'
import { Button } from './ui/button'

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
          </div>
          <p><span>정답</span> {feedback.answer}</p>
          {feedback.input && <p><span>내 답</span> {feedback.input}</p>}
          {feedback.verdict !== 'skip' && (
            <Button type="button" variant="ghost" size="sm" onClick={onOverride}>
              {feedback.verdict === 'wrong'
                ? <><Check size={15} /> 맞은 걸로 할게요</>
                : <><X size={15} /> 틀린 걸로 할게요</>}
            </Button>
          )}
        </div>
      )}
      {target !== null && (
        <form onSubmit={submit}>
          <label htmlFor="hard-input">
            {ordinal}번째 빈칸 <span>남은 빈칸 {remaining}개 · 다른 빈칸을 눌러 고를 수 있어요</span>
          </label>
          <textarea
            id="hard-input"
            ref={input}
            rows={2}
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
          <div className="hard-actions">
            <Button type="button" variant="ghost" onClick={onGiveUp} disabled={busy}>
              <CircleHelp size={16} /> 모르겠어요
            </Button>
            <Button type="submit" disabled={!text.trim() || busy}>
              <Send size={16} /> {busy ? '채점 중…' : <>채점 <kbd>Enter</kbd></>}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
