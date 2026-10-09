import React, { useLayoutEffect, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  Eye,
  EyeOff,
  Hand,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  List,
  PenLine,
  Rows3,
  Table2,
  Undo2,
} from 'lucide-react'
import { Button } from './ui/button'
import MaskedText from './MaskedText'
import MatchingEditor from './MatchingEditor'
import ClassificationEditor from './ClassificationEditor'
import OcclusionEditor from './OcclusionEditor'
import ImageDialog from './ImageDialog'
import { bodyError, masksIn, maskSelection } from '../lib/masks'
import {
  TABLE_TEMPLATE, continueList, insertBlock, isStructured, shiftLines, tapTokens, toggleList, toggleTap, wordRange,
} from '../lib/editing'

// One editor for every text card: short cards, outline notes and long passages
// are all Markdown with [[covers]]. Notes created before the merge open here too.
export default function Editor({ draft, deckName, onChange, onSave, onExit, autosaved }) {
  const area = useRef(null)
  const selection = useRef([0, 0])
  const [mode, setMode] = useState('write')
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(new Set())
  const [history, setHistory] = useState([])
  const [adding, setAdding] = useState(false)
  // Caret to restore after a toolbar edit; applied before paint so fast typing lands in place.
  const pendingCaret = useRef(null)
  useLayoutEffect(() => {
    const caret = pendingCaret.current
    if (!caret || !area.current) return
    pendingCaret.current = null
    area.current.focus()
    area.current.setSelectionRange(caret[0], caret[1])
    selection.current = caret
  })
  const { card } = draft
  if (card.kind === 'classification') return <ClassificationEditor {...{ draft, deckName, onChange, onSave, onExit, autosaved }} />
  if (card.kind === 'occlusion') return <OcclusionEditor {...{ draft, deckName, onChange, onSave, onExit, autosaved }} />
  if (card.kind === 'matching') return <MatchingEditor {...{ draft, deckName, onChange, onSave, onExit, autosaved }} />

  const ids = masksIn(card.body).map((mask) => mask.id)
  const syntaxError = bodyError(card.body)
  const canSave = card.title.trim() && card.body.trim() && !syntaxError
  const align = card.align || (isStructured(card.body) ? 'left' : 'center')
  // Saving through this editor turns old notes into ordinary cards.
  const change = (next) => {
    const { kind, ...rest } = next
    onChange(kind === 'note' ? rest : next)
  }
  const setBody = (body, remember = true) => {
    if (remember) setHistory((prev) => [...prev.slice(-29), card.body])
    change({ ...card, body })
    setRevealed(new Set())
    setError('')
  }
  const apply = (result) => {
    pendingCaret.current = [result.start, result.end]
    setBody(result.body)
  }
  const remember = (e) => {
    selection.current = [e.target.selectionStart, e.target.selectionEnd]
  }
  const cover = (wholeLine) => {
    try {
      const [start, end] = wholeLine ? selection.current : wordRange(card.body, ...selection.current)
      apply(maskSelection(card.body, start, end, wholeLine))
    } catch (e) {
      setError(e.message)
    }
  }
  const bold = () => {
    const [start, end] = wordRange(card.body, ...selection.current)
    const text = card.body.slice(start, end) || '굵은 글씨'
    apply({ body: card.body.slice(0, start) + `**${text}**` + card.body.slice(end), start: start + 2, end: start + 2 + text.length })
  }
  const undo = () => {
    if (!history.length) return
    change({ ...card, body: history.at(-1) })
    setHistory((prev) => prev.slice(0, -1))
  }
  const keyDown = (e) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      const [start, end] = [e.target.selectionStart, e.target.selectionEnd]
      const result = start === end && continueList(card.body, start)
      if (result) {
        e.preventDefault()
        apply(result)
      }
    } else if (e.key === 'Tab' && /^\s*([-*+]|\d+[.)])\s/m.test(card.body)) {
      e.preventDefault()
      apply(shiftLines(card.body, e.target.selectionStart, e.target.selectionEnd, e.shiftKey ? -1 : 1))
    }
  }
  const tool = (label, Icon, action, props = {}) => (
    <Button
      key={label}
      type="button"
      variant="ghost"
      className="editor-tool"
      aria-label={label}
      title={label}
      // Keep the textarea selection when a toolbar button is tapped.
      onPointerDown={(e) => e.preventDefault()}
      onClick={action}
      {...props}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Button>
  )
  const save = (e) => {
    e?.preventDefault()
    if (canSave) onSave()
    else setError(syntaxError || '제목과 내용을 입력해 주세요.')
  }
  const toggle = (id) => setRevealed((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <main id="main" className="editor-page card-editor">
      <div className="editor-top">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft size={17} /> 돌아가기
        </Button>
        <span className="save-state" aria-live="polite">{autosaved}</span>
        <Button className="editor-top-save" size="sm" onClick={save} disabled={!canSave}>
          <Check size={16} /> 저장
        </Button>
      </div>
      <p className="overline editor-deck">{deckName}</p>
      <form onSubmit={save} className="editor-layout">
        <div className="editor-panel">
          <input
            id="card-title"
            className="card-title-input"
            aria-label="제목"
            autoFocus={draft.isNew}
            maxLength={200}
            value={card.title}
            placeholder="제목"
            onChange={(e) => change({ ...card, title: e.target.value })}
            required
          />
          <div className="editor-mode" role="tablist" aria-label="편집 방식">
            <button type="button" role="tab" aria-selected={mode === 'write'} onClick={() => setMode('write')}>
              <PenLine size={16} /> 쓰기
            </button>
            <button type="button" role="tab" aria-selected={mode === 'tap'} onClick={() => setMode('tap')} disabled={!card.body.trim()}>
              <Hand size={16} /> 탭해서 가리기
            </button>
            <span className="editor-mask-count">가리개 {ids.length}개</span>
          </div>
          <div className="alignment-control">
            <span>텍스트 정렬</span>
            <div className="segmented" role="group" aria-label="텍스트 정렬">
              {[
                ['left', AlignLeft, '왼쪽 정렬'],
                ['center', AlignCenter, '가운데 정렬'],
                ['right', AlignRight, '오른쪽 정렬'],
              ].map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={align === value}
                  onClick={() => change({ ...card, align: value })}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
          {mode === 'write' ? (
            <div className="writing-area">
              <textarea
                ref={area}
                id="card-body"
                aria-label="내용"
                value={card.body}
                maxLength={20000}
                rows={12}
                placeholder={'기억할 내용을 적어 보세요.\n\n- 로 시작하면 목록이 되고, 단어를 고른 뒤 ‘가리기’를 누르면 가려져요.'}
                onChange={(e) => setBody(e.target.value, false)}
                onKeyDown={keyDown}
                onSelect={remember}
                onKeyUp={remember}
                onClick={remember}
                aria-describedby="editor-feedback"
                aria-invalid={!!syntaxError}
                required
              />
              <div className="editor-toolbar" role="toolbar" aria-label="편집 도구">
                {tool('가리기', Highlighter, () => cover(false))}
                {tool('줄 가리기', Rows3, () => cover(true))}
                {tool('목록', List, () => apply(toggleList(card.body, ...selection.current)))}
                {tool('들여쓰기', IndentIncrease, () => apply(shiftLines(card.body, ...selection.current, 1)))}
                {tool('내어쓰기', IndentDecrease, () => apply(shiftLines(card.body, ...selection.current, -1)))}
                {tool('표', Table2, () => apply(insertBlock(card.body, ...selection.current, TABLE_TEMPLATE)))}
                {tool('사진', ImagePlus, () => setAdding(true))}
                {tool('굵게', Bold, bold)}
                {tool('되돌리기', Undo2, undo, { disabled: !history.length })}
              </div>
            </div>
          ) : (
            <div className="tap-area" aria-describedby="tap-help">
              <p id="tap-help" className="field-hint">
                단어를 탭하면 가려져요. 가린 부분 옆 단어를 탭하면 가리개가 늘어나고, 가린 부분을 다시 탭하면 풀려요.
              </p>
              <div className="tap-text">
                {tapTokens(card.body).map((token) => token.type === 'gap'
                  ? <span key={token.start} className="tap-gap">{token.text}</span>
                  : (
                    <button
                      type="button"
                      key={token.start}
                      className={`tap-word ${token.type === 'mask' ? 'masked' : ''}`}
                      aria-pressed={token.type === 'mask'}
                      onClick={() => setBody(toggleTap(card.body, token))}
                    >
                      {token.text}
                    </button>
                  ))}
              </div>
              <div className="tap-actions">
                <Button type="button" variant="outline" disabled={!history.length} onClick={undo}>
                  <Undo2 size={16} /> 되돌리기
                </Button>
                <Button type="button" variant="outline" onClick={() => setMode('write')}>
                  <PenLine size={16} /> 글 고치기
                </Button>
              </div>
            </div>
          )}
          <p
            id="editor-feedback"
            className={error || syntaxError ? 'field-error' : 'field-hint'}
            aria-live="polite"
          >
            {error || syntaxError || (mode === 'write'
              ? <>글자를 고르지 않고 ‘가리기’를 누르면 커서가 있는 단어를 가려요. <code>[[정답]]</code>처럼 직접 써도 돼요.</>
              : null)}
          </p>
          <div className="editor-actions">
            <Button type="button" variant="ghost" onClick={onExit}>
              닫기
            </Button>
            <Button type="submit" disabled={!canSave}>
              <Check size={17} /> 카드 저장
            </Button>
          </div>
        </div>
        <aside className="preview-panel" aria-label="학습 미리보기">
          <div className="preview-heading">
            <span>
              <Eye size={16} /> 학습 미리보기
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!ids.length}
              onClick={() => setRevealed(revealed.size === ids.length ? new Set() : new Set(ids))}
            >
              {revealed.size === ids.length && ids.length
                ? <><EyeOff size={15} /> 가리기</>
                : <><Eye size={15} /> 정답 보기</>}
            </Button>
          </div>
          <div className="preview-sheet paper">
            <h2 style={{ textAlign: align }}>{card.title || '카드 제목'}</h2>
            {card.body
              ? <MaskedText body={card.body} align={align} revealed={revealed} onToggle={toggle} />
              : <p className="preview-placeholder">입력한 내용이 여기에 표시돼요.</p>}
          </div>
        </aside>
      </form>
      {adding && (
        <ImageDialog
          onClose={() => setAdding(false)}
          onInsert={(markdown) => {
            setAdding(false)
            apply(insertBlock(card.body, ...selection.current, markdown))
          }}
        />
      )}
    </main>
  )
}
