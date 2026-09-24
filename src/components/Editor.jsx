import React, { useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Highlighter,
  Rows3,
  Undo2,
} from 'lucide-react'
import { Button } from './ui/button'
import MaskedText from './MaskedText'
import { bodyError, masksIn, maskSelection } from '../lib/masks'

export default function Editor({
  draft,
  deckName,
  onChange,
  onSave,
  onExit,
  autosaved,
}) {
  const area = useRef(null)
  const selection = useRef([0, 0])
  const [selected, setSelected] = useState(false)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(new Set())
  const [history, setHistory] = useState([])
  const { card } = draft
  const ids = masksIn(card.body).map((mask) => mask.id)
  const syntaxError = bodyError(card.body)
  const canSave = card.title.trim() && card.body.trim() && !syntaxError
  const updateBody = (body) => {
    onChange({ ...card, body })
    setRevealed(new Set())
    setError('')
  }
  const rememberSelection = (e) => {
    selection.current = [e.target.selectionStart, e.target.selectionEnd]
    setSelected(e.target.selectionStart !== e.target.selectionEnd)
  }
  const mask = (wholeLine) => {
    try {
      const result = maskSelection(card.body, ...selection.current, wholeLine)
      setHistory((prev) => [...prev.slice(-19), card.body])
      updateBody(result.body)
      requestAnimationFrame(() => {
        area.current.focus()
        area.current.setSelectionRange(result.start, result.end)
        selection.current = [result.start, result.end]
        setSelected(result.start !== result.end)
      })
    } catch (e) {
      setError(e.message)
    }
  }
  const undo = () => {
    if (!history.length) return
    updateBody(history[history.length - 1])
    setHistory((prev) => prev.slice(0, -1))
  }
  const save = (e) => {
    e.preventDefault()
    if (canSave) onSave()
  }
  return (
    <main id="main" className="editor-page">
      <div className="editor-top">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft size={17} /> 돌아가기
        </Button>
        <span className="save-state">
          {autosaved ? '작성 내용 임시 저장됨' : '작성 중'}
        </span>
      </div>
      <div className="section-heading">
        <div>
          <p className="overline">{deckName}</p>
          <h1>{draft.isNew ? '새 카드 만들기' : '카드 수정'}</h1>
          <p className="muted">떠올릴 수 있도록, 핵심만 가려보세요.</p>
        </div>
      </div>
      <form onSubmit={save} className="editor-layout">
        <div className="editor-panel">
          <label htmlFor="card-title">
            제목 <span aria-hidden="true">{card.title.length} / 200</span>
          </label>
          <input
            id="card-title"
            autoFocus
            maxLength={200}
            value={card.title}
            placeholder="예: 광합성이 일어나는 곳"
            onChange={(e) => onChange({ ...card, title: e.target.value })}
            required
          />
          <div className="content-label">
            <label htmlFor="card-body">내용</label>
            <span>{ids.length}개의 빈칸</span>
          </div>
          <p id="editor-help" className="field-hint">
            가릴 글자를 선택하세요. 이미 가린 부분을 선택하면 해제돼요.
          </p>
          <div className="writing-area">
            <div className="mask-toolbar">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!selected}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => mask(false)}
              >
                <Highlighter size={16} /> 선택 가리기 / 해제
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => mask(true)}
              >
                <Rows3 size={16} /> 한 줄 가리기
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="가리기 실행 취소"
                title="가리기 실행 취소"
                disabled={!history.length}
                onPointerDown={(e) => e.preventDefault()}
                onClick={undo}
              >
                <Undo2 size={16} />
              </Button>
            </div>
            <textarea
              ref={area}
              id="card-body"
              value={card.body}
              maxLength={20000}
              rows={10}
              placeholder={
                '광합성은 엽록체에서 일어납니다.\n\n기억할 내용을 자유롭게 적어보세요.'
              }
              onChange={(e) => {
                updateBody(e.target.value)
                setHistory([])
              }}
              onSelect={rememberSelection}
              onKeyUp={rememberSelection}
              onClick={rememberSelection}
              aria-describedby="editor-help editor-feedback"
              aria-invalid={!!syntaxError}
              required
            />
          </div>
          <p
            id="editor-feedback"
            className={error || syntaxError ? 'field-error' : 'field-hint'}
            aria-live="polite"
          >
            {error || syntaxError || (
              <>
                직접 <code>[[가릴 내용]]</code>을 입력해도 좋아요. 줄바꿈도
                그대로 유지돼요.
              </>
            )}
          </p>
          {!ids.length && card.body.trim() && !syntaxError && (
            <p className="field-hint">빈칸 없는 카드도 저장할 수 있어요.</p>
          )}
          <div className="editor-actions">
            <Button type="button" variant="ghost" onClick={onExit}>
              닫기
            </Button>
            <Button type="submit" disabled={!canSave}>
              <Check size={17} /> 카드 저장
            </Button>
          </div>
        </div>
        <aside className="preview-panel">
          <div className="preview-heading">
            <span>
              <Eye size={16} /> 학습 미리보기
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!ids.length}
              onClick={() =>
                setRevealed(
                  revealed.size === ids.length ? new Set() : new Set(ids),
                )
              }
            >
              {revealed.size === ids.length && ids.length ? (
                <>
                  <EyeOff size={15} /> 가리기
                </>
              ) : (
                <>
                  <Eye size={15} /> 정답 보기
                </>
              )}
            </Button>
          </div>
          <div className="preview-sheet paper">
            <p className="overline">PREVIEW</p>
            <h2>{card.title || '카드 제목'}</h2>
            {card.body ? (
              <MaskedText
                body={card.body}
                revealed={revealed}
                onToggle={(id) =>
                  setRevealed((prev) => {
                    const next = new Set(prev)
                    next.has(id) ? next.delete(id) : next.add(id)
                    return next
                  })
                }
              />
            ) : (
              <p className="preview-placeholder">
                입력한 내용이 여기에 표시돼요.
              </p>
            )}
          </div>
          <p className="field-hint">빈칸을 눌러 실제 학습처럼 확인해 보세요.</p>
        </aside>
      </form>
    </main>
  )
}
