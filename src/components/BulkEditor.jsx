import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import {
  bulkDraftKey,
  emptyRow,
  loadBulkDraft,
  parseTable,
  rowError,
} from '../lib/bulk'

export default function BulkEditor({ deck, onSave, onExit }) {
  const available = 1000 - deck.cards.length
  const [rows, setRows] = useState(
    () =>
      loadBulkDraft(localStorage, deck.id) ||
      Array.from({ length: Math.min(5, available) }, emptyRow),
  )
  const [attempted, setAttempted] = useState(false)
  const [message, setMessage] = useState('')
  const [autosaved, setAutosaved] = useState(true)
  const grid = useRef(null)
  const nextFocus = useRef(null)
  const filled = rows.filter((row) => row.title.trim() || row.body.trim())
  const errors = rows.map(rowError)

  useEffect(() => {
    try {
      if (filled.length)
        localStorage.setItem(
          bulkDraftKey(deck.id),
          JSON.stringify({ deckId: deck.id, rows }),
        )
      else localStorage.removeItem(bulkDraftKey(deck.id))
      setAutosaved(true)
    } catch {
      setAutosaved(false)
      setMessage('임시 저장에 실패했어요. 카드를 저장하기 전 이 페이지를 닫지 마세요.')
    }
  }, [rows, deck.id])

  useEffect(() => {
    if (!nextFocus.current) return
    const [index, column] = nextFocus.current
    grid.current?.querySelector(`[data-cell="${index}-${column}"]`)?.focus()
    nextFocus.current = null
  }, [rows])

  const change = (index, column, value) => {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [column]: value }
      if (index === next.length - 1 && next.length < available)
        next.push(emptyRow())
      return next
    })
    setMessage('')
  }
  const focus = (index, column) => {
    if (index >= rows.length && rows.length < available) {
      nextFocus.current = [index, column]
      setRows((prev) => [...prev, emptyRow()])
    } else
      grid.current?.querySelector(`[data-cell="${index}-${column}"]`)?.focus()
  }
  const handleKey = (event, index, column) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      focus(
        column === 'title' ? index : index + 1,
        column === 'title' ? 'body' : 'title',
      )
    } else if (event.key === 'Tab' && !event.shiftKey && column === 'body') {
      event.preventDefault()
      focus(index + 1, 'title')
    } else if (event.key === 'Tab' && event.shiftKey && column === 'title' && index > 0) {
      event.preventDefault()
      focus(index - 1, 'body')
    }
  }
  const handlePaste = (event, index, column) => {
    const text = event.clipboardData.getData('text/plain')
    if (!text.includes('\t') && (column === 'body' || !/[\r\n]/.test(text)))
      return
    const table = parseTable(text)
    const start = column === 'title' ? 0 : 1
    if (table.length === 1 && table[0].length === 1) return
    event.preventDefault()
    if (
      table.some((line) => line.length > 2 - start) ||
      index + table.length > available
    ) {
      setMessage(`붙여넣기는 제목·내용 두 열, 최대 ${available}행까지 가능해요.`)
      return
    }
    setRows((prev) => {
      const next = [...prev]
      while (next.length < index + table.length) next.push(emptyRow())
      table.forEach((line, offset) => {
        const row = { ...next[index + offset] }
        line.forEach((value, cell) => {
          row[cell + start === 0 ? 'title' : 'body'] = value
        })
        next[index + offset] = row
      })
      if (next.length === index + table.length && next.length < available)
        next.push(emptyRow())
      return next
    })
    setMessage(`${table.length}행을 붙여넣었어요.`)
  }
  const save = () => {
    setAttempted(true)
    const firstError = errors.findIndex(Boolean)
    if (firstError >= 0) {
      focus(firstError, !rows[firstError].title.trim() ? 'title' : 'body')
      setMessage(`${firstError + 1}행: ${errors[firstError]}`)
      return
    }
    if (!filled.length) return
    if (filled.length > available) {
      setMessage(`이 셋에는 ${available}장까지만 추가할 수 있어요.`)
      return
    }
    if (onSave(filled.map((row) => ({ title: row.title.trim(), body: row.body }))))
      localStorage.removeItem(bulkDraftKey(deck.id))
  }
  const discard = () => {
    if (filled.length && !window.confirm('작성 중인 카드들을 모두 버릴까요?')) return
    localStorage.removeItem(bulkDraftKey(deck.id))
    setRows(Array.from({ length: Math.min(5, available) }, emptyRow))
    setAttempted(false)
    setMessage('')
  }

  return (
    <main id="main" className="bulk-page">
      <div className="editor-top">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft size={17} /> 돌아가기
        </Button>
        <span className="save-state">
          {autosaved ? '작성 내용 임시 저장됨' : '임시 저장 실패'}
        </span>
      </div>
      <div className="section-heading bulk-heading">
        <div>
          <p className="overline">{deck.name}</p>
          <h1>카드 여러 장 만들기</h1>
        </div>
        <Button onClick={save} disabled={!filled.length}>
          <Check size={17} /> {filled.length}장 저장
        </Button>
      </div>
      <div className="bulk-toolbar">
        <span>{filled.length}장 작성 중 <span>·</span> 이 셋에 {available}장 추가 가능</span>
        <div>
          <Button variant="ghost" size="sm" onClick={discard} disabled={!filled.length}>
            모두 지우기
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length >= available}
            onClick={() =>
              setRows((prev) => [
                ...prev,
                ...Array.from(
                  { length: Math.min(5, available - prev.length) },
                  emptyRow,
                ),
              ])
            }
          >
            <Plus size={15} /> 5행 추가
          </Button>
        </div>
      </div>
      <div className="bulk-grid-wrap" ref={grid}>
        <div className="bulk-grid">
          <div className="bulk-grid-head"><span>번호</span><span>제목</span><span>내용</span><span></span></div>
          {rows.map((row, index) => {
            const invalid = attempted && !!errors[index]
            return (
              <div className={`bulk-row ${invalid ? 'invalid' : ''}`} key={index}>
                <span className="bulk-number">{index + 1}</span>
                <input
                  data-cell={`${index}-title`}
                  aria-label={`${index + 1}행 제목`}
                  aria-invalid={invalid && !row.title.trim()}
                  autoFocus={index === 0}
                  value={row.title}
                  maxLength={200}
                  placeholder="카드 제목"
                  title="Enter: 내용으로 이동"
                  onChange={(e) => change(index, 'title', e.target.value)}
                  onKeyDown={(e) => handleKey(e, index, 'title')}
                  onPaste={(e) => handlePaste(e, index, 'title')}
                />
                <textarea
                  data-cell={`${index}-body`}
                  aria-label={`${index + 1}행 내용`}
                  aria-invalid={invalid && !!row.title.trim()}
                  value={row.body}
                  maxLength={20000}
                  rows={1}
                  placeholder="내용과 [[가릴 부분]]"
                  title="Enter: 다음 행, Shift+Enter: 줄바꿈"
                  onChange={(e) => change(index, 'body', e.target.value)}
                  onKeyDown={(e) => handleKey(e, index, 'body')}
                  onPaste={(e) => handlePaste(e, index, 'body')}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${index + 1}행 삭제`}
                  title="행 삭제"
                  onClick={() =>
                    setRows((prev) =>
                      prev.length === 1
                        ? [emptyRow()]
                        : prev.filter((_, i) => i !== index),
                    )
                  }
                ><Trash2 size={15} /></Button>
                {invalid && <span className="bulk-row-error">{errors[index]}</span>}
              </div>
            )
          })}
        </div>
      </div>
      <div className="bulk-footer">
        <p
          className={message && attempted && errors.some(Boolean) ? 'field-error' : 'field-hint'}
          role="status"
        >
          {message}
        </p>
        <Button onClick={save} disabled={!filled.length}><Check size={17} /> {filled.length}장 저장</Button>
      </div>
    </main>
  )
}
