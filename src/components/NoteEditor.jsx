import React, { useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, GripVertical, Highlighter, ListPlus, Maximize2, Minus, Plus, RotateCcw, Table2, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { bodyError, masksIn, maskSelection } from '../lib/masks'
import { moveBranch, moveDepth, parseOutline, serializeOutline, subtreeEnd } from '../lib/outline'

export default function NoteEditor({ draft, deckName, onChange, onSave, onExit, autosaved }) {
  const { card } = draft
  const [rows, setRows] = useState(() => parseOutline(card.body))
  const [selected, setSelected] = useState(() => parseOutline(card.body)[0].id)
  const [activeCell, setActiveCell] = useState(null)
  const [zoom, setZoom] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(null)
  const [drop, setDrop] = useState(null)
  const inputRefs = useRef({})
  const selection = useRef(null)
  const dragRef = useRef(null)
  const tableRefs = useRef({})
  const nextId = useRef(Math.max(...rows.map((row) => row.id)) + 1)
  const body = serializeOutline(rows)
  const syntaxError = bodyError(body)
  const canSave = !!card.title.trim() && !!body.trim() &&
    rows.every((row) => row.type === 'table' || row.text.trim()) && body.length <= 20000 && !syntaxError
  const indexOf = (id) => rows.findIndex((row) => row.id === id)
  const ancestors = (index) => {
    const result = []
    let depth = rows[index].depth
    for (let i = index - 1; i >= 0 && depth > 0; i--)
      if (rows[i].depth < depth) {
        result.unshift(rows[i])
        depth = rows[i].depth
      }
    return result
  }
  const visible = (row, index) => {
    const parents = ancestors(index)
    return (zoom === null || row.id === zoom || parents.some((parent) => parent.id === zoom)) &&
      !parents.some((parent) => parent.collapsed && parent.id !== zoom)
  }
  const commit = (next) => {
    setRows(next)
    onChange({ ...card, body: serializeOutline(next), kind: 'note' })
    setError('')
  }
  const focus = (id, start) => requestAnimationFrame(() => {
    const input = inputRefs.current[id] || tableRefs.current[`${id}:0:0`]
    input?.focus()
    if (start !== undefined) input?.setSelectionRange(start, start)
  })
  const focusTable = (id, row, column, start) => requestAnimationFrame(() => {
    const input = tableRefs.current[`${id}:${row}:${column}`]
    input?.focus()
    if (start !== undefined) input?.setSelectionRange(start, start)
    if (input) selection.current = {
      id, row, column, start: input.selectionStart, end: input.selectionEnd,
    }
  })
  const tablePosition = (id) => activeCell?.id === id
    ? activeCell : { row: 1, column: 0 }
  const updateTable = (id, cells, target) => {
    const index = indexOf(id)
    const next = [...rows]
    next[index] = { ...next[index], cells }
    commit(next)
    if (target) focusTable(id, target.row, target.column)
  }
  const insertTable = () => {
    const index = indexOf(selected)
    const parent = rows[index]
    const next = [...rows]
    const fresh = {
      id: nextId.current++, depth: parent?.depth || 0,
      type: 'table', cells: [['', ''], ['', '']], collapsed: false,
    }
    if (parent && parent.type !== 'table' && !parent.text.trim()) {
      fresh.id = parent.id
      next[index] = fresh
    } else if (parent) {
      fresh.depth = parent.type === 'table' ? parent.depth : Math.min(parent.depth + 1, 12)
      next.splice(parent.type === 'table' ? subtreeEnd(rows, index) : index + 1, 0, fresh)
      next[index] = { ...parent, collapsed: false }
    } else next.push(fresh)
    commit(next)
    setSelected(fresh.id)
    focusTable(fresh.id, 0, 0)
  }
  const addTableRow = (id, row, column = 0) => {
    const cells = rows[indexOf(id)].cells.map((line) => [...line])
    if (cells.length >= 100) return
    cells.splice(row + 1, 0, Array(cells[0].length).fill(''))
    updateTable(id, cells, { row: row + 1, column })
  }
  const addTableColumn = (id, column) => {
    const cells = rows[indexOf(id)].cells.map((line) => [...line])
    if (cells[0].length >= 12) return
    cells.forEach((line) => line.splice(column + 1, 0, ''))
    updateTable(id, cells, { row: tablePosition(id).row, column: column + 1 })
  }
  const removeTableRow = (id, row) => {
    const cells = rows[indexOf(id)].cells.map((line) => [...line])
    if (row === 0 || cells.length <= 2) return
    cells.splice(row, 1)
    updateTable(id, cells, { row: Math.max(1, row - 1), column: tablePosition(id).column })
  }
  const removeTableColumn = (id, column) => {
    const cells = rows[indexOf(id)].cells.map((line) => [...line])
    if (cells[0].length <= 2) return
    cells.forEach((line) => line.splice(column, 1))
    updateTable(id, cells, { row: tablePosition(id).row, column: Math.max(0, column - 1) })
  }
  const add = (id) => {
    const index = indexOf(id)
    if (rows[index].type !== 'table' && !rows[index].text.trim()) {
      focus(id)
      return
    }
    const after = subtreeEnd(rows, index)
    if (rows[after] && rows[after].depth === rows[index].depth &&
      rows[after].type !== 'table' && !rows[after].text.trim()) {
      setSelected(rows[after].id)
      focus(rows[after].id)
      return
    }
    const fresh = { id: nextId.current++, depth: rows[index].depth, text: '', collapsed: false }
    const next = [...rows]
    next.splice(after, 0, fresh)
    commit(next)
    setSelected(fresh.id)
    focus(fresh.id)
  }
  const indent = (id, delta) => {
    const next = moveDepth(rows, indexOf(id), delta)
    if (next === rows) return
    commit(next)
    focus(id)
  }
  const moveSibling = (id, direction) => {
    const index = indexOf(id)
    const depth = rows[index].depth
    let target = direction > 0 ? subtreeEnd(rows, index) : index - 1
    if (direction < 0) {
      while (target >= 0 && rows[target].depth > depth) target--
    }
    if (!rows[target] || rows[target].depth !== depth) return
    commit(moveBranch(rows, id, rows[target].id, direction > 0 ? 'after' : 'before'))
    setSelected(id)
  }
  const dragStart = (event, id) => {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { id, pointerId: event.pointerId, startY: event.clientY, active: false, drop: null }
    setSelected(id)
  }
  const dragMove = (event) => {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    if (!current.active && Math.abs(event.clientY - current.startY) < 5) return
    if (!current.active) {
      current.active = true
      setDragging(current.id)
    }
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-outline-id]')
    const targetId = Number(element?.dataset.outlineId)
    const source = indexOf(current.id)
    const target = indexOf(targetId)
    const invalid = !element || target < 0 || (target >= source && target < subtreeEnd(rows, source)) ||
      targetId === zoom
    const side = element && event.clientY < element.getBoundingClientRect().top +
      element.getBoundingClientRect().height / 2 ? 'before' : 'after'
    const candidate = invalid ? null : { targetId, side }
    current.drop = candidate
    setDrop(candidate)
    if (event.clientY < 55) window.scrollBy(0, -18)
    else if (event.clientY > window.innerHeight - 55) window.scrollBy(0, 18)
  }
  const dragEnd = (event, cancelled = false) => {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(null)
    setDrop(null)
    if (cancelled || !current.active || !current.drop) return
    const next = moveBranch(rows, current.id, current.drop.targetId, current.drop.side)
    if (next !== rows) commit(next)
    setSelected(current.id)
  }
  const mask = () => {
    const index = indexOf(selected)
    if (rows[index]?.type === 'table') {
      const position = tablePosition(selected)
      const input = tableRefs.current[`${selected}:${position.row}:${position.column}`]
      const saved = selection.current?.id === selected &&
        selection.current.row === position.row && selection.current.column === position.column
        ? selection.current : { start: input?.selectionStart, end: input?.selectionEnd }
      if (!input || saved.start === saved.end || saved.start === undefined) {
        setError('먼저 표 셀에서 가릴 글자를 선택해 주세요.')
        return
      }
      try {
        const cells = rows[index].cells.map((line) => [...line])
        const result = maskSelection(cells[position.row][position.column], saved.start, saved.end)
        cells[position.row][position.column] = result.body
        updateTable(selected, cells)
        selection.current = null
        requestAnimationFrame(() => {
          input.focus()
          input.setSelectionRange(result.start, result.end)
        })
      } catch (cause) {
        setError(cause.message)
      }
      return
    }
    const input = inputRefs.current[selected]
    const saved = selection.current
    const start = saved?.id === selected && saved.row === undefined ? saved.start : input?.selectionStart
    const end = saved?.id === selected && saved.row === undefined ? saved.end : input?.selectionEnd
    if (!input || start === undefined || end === undefined || start === end) {
      setError('먼저 항목에서 가릴 글자를 선택해 주세요.')
      return
    }
    try {
      const result = maskSelection(rows[index].text, start, end)
      const next = [...rows]
      next[index] = { ...next[index], text: result.body }
      commit(next)
      selection.current = null
      requestAnimationFrame(() => {
        inputRefs.current[selected]?.focus()
        inputRefs.current[selected]?.setSelectionRange(result.start, result.end)
      })
    } catch (cause) {
      setError(cause.message)
    }
  }
  const remove = (id) => {
    const index = indexOf(id), end = subtreeEnd(rows, index)
    if (end > index + 1 && !window.confirm('이 항목과 하위 항목을 삭제할까요?')) return
    const next = [...rows]
    next.splice(index, end - index)
    if (!next.length) next.push({ id: nextId.current++, depth: 0, text: '', collapsed: false })
    const previous = next[Math.max(0, index - 1)].id
    commit(next)
    setSelected(previous)
    if (zoom === id || !next.some((row) => row.id === zoom)) setZoom(null)
    focus(previous)
  }
  const handlePaste = (event, id) => {
    const text = event.clipboardData.getData('text/plain')
    if (!/[\r\n]/.test(text)) return
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim())
    if (lines.length < 2) return
    event.preventDefault()
    const index = indexOf(id)
    const base = rows[index].depth
    const parsed = parseOutline(lines.join('\n'))
    const next = [...rows]
    next[index] = { ...next[index], text: parsed[0].text }
    const inserted = parsed.slice(1).map((row) => ({
      ...row, id: nextId.current++, depth: Math.min(base + row.depth, 12),
    }))
    next.splice(index + 1, 0, ...inserted)
    commit(next)
    setSelected(inserted.at(-1).id)
    focus(inserted.at(-1).id)
  }
  const handleKey = (event, id) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      indent(id, event.shiftKey ? -1 : 1)
    } else if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault()
      if (!event.repeat) add(id)
    } else if (event.key === 'Backspace' && !event.currentTarget.value && rows.length > 1 &&
      subtreeEnd(rows, indexOf(id)) === indexOf(id) + 1) {
      event.preventDefault()
      remove(id)
    }
  }
  const handleTableKey = (event, id, row, column) => {
    const cells = rows[indexOf(id)].cells
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault()
      if (event.shiftKey) focusTable(id, Math.max(0, row - 1), column)
      else if (row < cells.length - 1) focusTable(id, row + 1, column)
      else if (!event.repeat) addTableRow(id, row, column)
    } else if (event.key === 'Tab') {
      if (event.shiftKey && row === 0 && column === 0) return
      event.preventDefault()
      if (event.shiftKey) {
        focusTable(id, column ? row : row - 1, column ? column - 1 : cells[0].length - 1)
      } else if (column < cells[0].length - 1) focusTable(id, row, column + 1)
      else if (row < cells.length - 1) focusTable(id, row + 1, 0)
      else addTableRow(id, row, 0)
    }
  }
  const save = (event) => {
    event.preventDefault()
    if (canSave) onSave()
    else setError(syntaxError || '제목과 모든 항목의 내용을 입력해 주세요.')
  }
  const dropIndex = drop && indexOf(drop.targetId)
  const markerId = drop && (drop.side === 'before'
    ? drop.targetId
    : rows.slice(dropIndex, subtreeEnd(rows, dropIndex))
      .filter((row) => visible(row, indexOf(row.id))).at(-1)?.id)

  return (
    <main id="main" className="note-page">
      <div className="editor-top">
        <Button variant="ghost" onClick={onExit}><ArrowLeft size={17} /> 돌아가기</Button>
        <span className="save-state">{autosaved ? '작성 내용 임시 저장됨' : '작성 중'}</span>
      </div>
      <div className="section-heading">
        <div><p className="overline">{deckName}</p><h1>{draft.isNew ? '새 노트' : '노트 수정'}</h1></div>
        <Button onClick={save} disabled={!canSave}><Check size={17} /> 노트 저장</Button>
      </div>
      <form className="note-editor" onSubmit={save}>
        <label htmlFor="note-title">제목</label>
        <input
          id="note-title"
          autoFocus
          maxLength={200}
          value={card.title}
          placeholder="노트 제목"
          onChange={(event) => onChange({ ...card, title: event.target.value, kind: 'note' })}
        />
        <div className="note-toolbar" role="toolbar" aria-label="노트 편집">
          <Button type="button" variant="ghost" size="sm" onClick={() => add(selected)}>
            <ListPlus size={16} /> 항목 추가
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={insertTable}>
            <Table2 size={16} /> 표 추가
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => indent(selected, 1)}>
            들여쓰기
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => indent(selected, -1)}>
            내어쓰기
          </Button>
          <Button type="button" variant="ghost" size="sm" onPointerDown={(event) => event.preventDefault()} onClick={mask}>
            <Highlighter size={16} /> 가리개
          </Button>
          <Button
            type="button" variant="ghost" size="icon" title="모두 펼치기" aria-label="모두 펼치기"
            onClick={() => commit(rows.map((row) => ({ ...row, collapsed: false })))}
          ><RotateCcw size={16} /></Button>
          <span className="note-mask-count">가리개 {masksIn(body).length}개</span>
        </div>
        {zoom !== null && (
          <button type="button" className="note-breadcrumb" onClick={() => setZoom(null)}>
            전체 노트 / {rows[indexOf(zoom)]?.type === 'table'
              ? '표' : rows[indexOf(zoom)]?.text.replace(/\[\[|\]\]/g, '')}
          </button>
        )}
        <div className="outline-rows">
          {rows.map((row, index) => {
            if (!visible(row, index)) return null
            const hasChildren = subtreeEnd(rows, index) > index + 1
            const depth = row.depth - (zoom === null ? 0 : rows[indexOf(zoom)].depth)
            const table = row.type === 'table'
            const position = table ? tablePosition(row.id) : null
            const cellInput = (value, rowIndex, columnIndex) => (
              <input
                ref={(element) => { tableRefs.current[`${row.id}:${rowIndex}:${columnIndex}`] = element }}
                aria-label={`표 ${rowIndex === 0 ? '머리글' : `${rowIndex}행`} ${columnIndex + 1}열`}
                value={value}
                maxLength={20000}
                placeholder={rowIndex === 0 ? `열 ${columnIndex + 1}` : '내용'}
                onFocus={(event) => {
                  setSelected(row.id)
                  setActiveCell({ id: row.id, row: rowIndex, column: columnIndex })
                  selection.current = {
                    id: row.id, row: rowIndex, column: columnIndex,
                    start: event.currentTarget.selectionStart,
                    end: event.currentTarget.selectionEnd,
                  }
                }}
                onSelect={(event) => {
                  selection.current = {
                    id: row.id, row: rowIndex, column: columnIndex,
                    start: event.currentTarget.selectionStart,
                    end: event.currentTarget.selectionEnd,
                  }
                }}
                onChange={(event) => {
                  const cells = row.cells.map((line) => [...line])
                  cells[rowIndex][columnIndex] = event.target.value
                  updateTable(row.id, cells)
                }}
                onKeyDown={(event) => handleTableKey(event, row.id, rowIndex, columnIndex)}
              />
            )
            return (
              <div
                className={`outline-row ${table ? 'outline-table-row' : ''} ${selected === row.id ? 'selected' : ''} ${dragging === row.id ? 'moving' : ''} ${markerId === row.id ? `drop-${drop.side}` : ''}`}
                key={row.id}
                data-outline-id={row.id}
                style={{
                  '--depth': depth,
                  '--table-min-width': table ? `${Math.max(420, row.cells[0].length * 128)}px` : undefined,
                }}
              >
                {row.id !== zoom && (
                  <button
                    type="button"
                    className="outline-drag"
                    aria-label={`${index + 1}번 항목 순서 변경`}
                    title="드래그해서 순서 변경 · 위아래 화살표로 이동"
                    onPointerDown={(event) => dragStart(event, row.id)}
                    onPointerMove={dragMove}
                    onPointerUp={dragEnd}
                    onPointerCancel={(event) => dragEnd(event, true)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault()
                        moveSibling(row.id, event.key === 'ArrowUp' ? -1 : 1)
                      }
                    }}
                  ><GripVertical size={15} /></button>
                )}
                <button
                  type="button" className="outline-bullet"
                  aria-label={`${table ? '표' : row.text || '빈 항목'} ${hasChildren ? row.collapsed ? '펼치기' : '접기' : '선택'}`}
                  onClick={() => {
                    setSelected(row.id)
                    if (hasChildren) commit(rows.map((item) => item.id === row.id ? { ...item, collapsed: !item.collapsed } : item))
                    else focus(row.id)
                  }}
                >{hasChildren && row.collapsed ? <ChevronRight size={17} />
                  : table ? <Table2 size={16} /> : <span aria-hidden="true">•</span>}</button>
                {table ? <div className="outline-table-block">
                  <div className="outline-table-scroll">
                    <table>
                      <thead><tr>{row.cells[0].map((cell, column) => (
                        <th key={column}>{cellInput(cell, 0, column)}</th>
                      ))}</tr></thead>
                      <tbody>{row.cells.slice(1).map((line, dataIndex) => (
                        <tr key={dataIndex}>{line.map((cell, column) => (
                          <td key={column}>{cellInput(cell, dataIndex + 1, column)}</td>
                        ))}</tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div className="outline-table-tools" role="toolbar" aria-label="표 편집">
                    <span>행</span>
                    <Button type="button" variant="ghost" size="icon" title="선택한 셀 다음에 행 추가" aria-label="행 추가"
                      disabled={row.cells.length >= 100} onPointerDown={(event) => event.preventDefault()}
                      onClick={() => addTableRow(row.id, position.row, position.column)}><Plus size={14} /></Button>
                    <Button type="button" variant="ghost" size="icon" title="선택한 행 삭제" aria-label="행 삭제"
                      disabled={position.row === 0 || row.cells.length <= 2} onPointerDown={(event) => event.preventDefault()}
                      onClick={() => removeTableRow(row.id, position.row)}><Minus size={14} /></Button>
                    <span>열</span>
                    <Button type="button" variant="ghost" size="icon" title="선택한 셀 다음에 열 추가" aria-label="열 추가"
                      disabled={row.cells[0].length >= 12} onPointerDown={(event) => event.preventDefault()}
                      onClick={() => addTableColumn(row.id, position.column)}><Plus size={14} /></Button>
                    <Button type="button" variant="ghost" size="icon" title="선택한 열 삭제" aria-label="열 삭제"
                      disabled={row.cells[0].length <= 2} onPointerDown={(event) => event.preventDefault()}
                      onClick={() => removeTableColumn(row.id, position.column)}><Minus size={14} /></Button>
                  </div>
                </div> : <input
                  ref={(element) => { inputRefs.current[row.id] = element }}
                  aria-label={`${index + 1}번 항목`}
                  value={row.text}
                  maxLength={20000}
                  placeholder="내용 입력"
                  onFocus={() => setSelected(row.id)}
                  onSelect={(event) => {
                    selection.current = {
                      id: row.id, start: event.currentTarget.selectionStart,
                      end: event.currentTarget.selectionEnd,
                    }
                  }}
                  onChange={(event) => {
                    const next = [...rows]
                    next[index] = { ...row, text: event.target.value }
                    commit(next)
                  }}
                  onKeyDown={(event) => handleKey(event, row.id)}
                  onPaste={(event) => handlePaste(event, row.id)}
                />}
                <span className="outline-row-actions">
                  {(table ? row.cells.some((line) => line.some((cell) => cell.includes('[[')))
                    : row.text.includes('[[')) && <span className="outline-mask-badge">가리개</span>}
                  <Button type="button" variant="ghost" size="icon" title="이 가지에 집중" aria-label={`${index + 1}번 가지에 집중`} onClick={() => setZoom(row.id)}><Maximize2 size={15} /></Button>
                  <Button type="button" variant="ghost" size="icon" title="하위 항목 추가" aria-label={`${index + 1}번 하위 항목 추가`} onClick={() => {
                    const fresh = { id: nextId.current++, depth: row.depth + 1, text: '', collapsed: false }
                    const next = [...rows]
                    next.splice(index + 1, 0, fresh)
                    commit(next.map((item) => item.id === row.id ? { ...item, collapsed: false } : item))
                    setSelected(fresh.id)
                    focus(fresh.id)
                  }}><Plus size={15} /></Button>
                  <Button type="button" variant="ghost" size="icon" title="항목 삭제" aria-label={`${index + 1}번 항목 삭제`} onClick={() => remove(row.id)}><Trash2 size={15} /></Button>
                </span>
              </div>
            )
          })}
        </div>
        <p className="field-hint">Enter 새 항목 · Tab 들여쓰기 · Shift+Tab 내어쓰기 · 글자를 선택한 뒤 가리개</p>
        <p className="field-error" role="alert">{error || syntaxError}</p>
        <div className="editor-actions"><Button type="submit" disabled={!canSave}><Check size={17} /> 노트 저장</Button></div>
      </form>
    </main>
  )
}
