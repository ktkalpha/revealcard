import React, { useEffect, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Check,
  Highlighter,
  PanelLeft,
  PanelTop,
  SquareDashedMousePointer,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
} from 'lucide-react'
import Modal from './Modal'
import { Button } from './ui/button'
import { bodyError } from '../lib/masks'
import {
  deleteColumns, deleteRows, expandRange, insertColumn, insertRow, isMergedIn, mergeRange,
  tableLayout, toggleCellCovers, unmergeRange,
} from '../lib/table'

// Spreadsheet-like table editor: type in cells, drag (or shift-click) to select
// a range, then merge, add or delete rows and columns, align or cover cells.
export default function TableDialog({ initial, isNew, converted, onSave, onDelete, onClose }) {
  const [table, setTable] = useState(initial)
  const [anchor, setAnchor] = useState({ r: 0, c: 0 })
  const [focus, setFocus] = useState({ r: 0, c: 0 })
  const [extend, setExtend] = useState(false)
  const [error, setError] = useState('')
  const dragging = useRef(false)
  const grid = useRef(null)
  const pendingFocus = useRef(null)

  useEffect(() => {
    const stop = () => { dragging.current = false }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])
  useEffect(() => {
    const cell = pendingFocus.current
    if (!cell) return
    pendingFocus.current = null
    grid.current?.querySelector(`[data-cell="${cell.r},${cell.c}"]`)?.focus()
  })

  const rowCount = table.rows.length
  const columnCount = table.rows[0].length
  const clamp = (cell) => ({ r: Math.min(cell.r, rowCount - 1), c: Math.min(cell.c, columnCount - 1) })
  const range = expandRange(table, clamp(anchor), clamp(focus))
  const layout = tableLayout(table)
  const single = range.top === range.bottom && range.left === range.right
  const anchorsInRange = () => {
    const cells = []
    for (let r = range.top; r <= range.bottom; r++)
      for (let c = range.left; c <= range.right; c++)
        if (layout[r][c].r === r && layout[r][c].c === c) cells.push([r, c])
    return cells
  }
  const select = (from, to = from) => {
    setAnchor(from)
    setFocus(to)
  }
  const update = (next, selection) => {
    setTable(next)
    setError('')
    if (selection) select(...selection)
  }
  const setCell = (r, c, value) => {
    const rows = table.rows.map((row) => [...row])
    rows[r][c] = value
    update({ ...table, rows })
  }
  const moveTo = (r, c) => {
    const owner = layout[Math.max(0, Math.min(r, rowCount - 1))][Math.max(0, Math.min(c, columnCount - 1))]
    select({ r: owner.r, c: owner.c })
    pendingFocus.current = { r: owner.r, c: owner.c }
  }
  const cellKeyDown = (e, r, c) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    const owner = layout[r][c]
    if (e.key === 'Tab') {
      e.preventDefault()
      const order = table.rows.flatMap((row, i) => row.map((_, j) => [i, j]))
        .filter(([i, j]) => layout[i][j].r === i && layout[i][j].c === j)
      const index = order.findIndex(([i, j]) => i === r && j === c) + (e.shiftKey ? -1 : 1)
      if (index >= order.length) {
        update(insertRow(table, rowCount))
        pendingFocus.current = { r: rowCount, c: 0 }
        select({ r: rowCount, c: 0 })
      } else if (index >= 0) moveTo(...order[index])
    } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      moveTo(owner.r + owner.rs, c)
    }
  }
  const pointerDown = (e, r, c) => {
    if (e.shiftKey || extend) {
      e.preventDefault()
      setFocus({ r, c })
      return
    }
    dragging.current = true
    select({ r, c })
  }
  const pointerEnter = (e, r, c) => {
    if (!dragging.current || !(e.buttons & 1)) return
    if (r !== focus.r || c !== focus.c) {
      setFocus({ r, c })
      document.activeElement?.blur?.()
    }
  }
  const setAlign = (value) => {
    const align = { ...table.align }
    for (const [r, c] of anchorsInRange()) {
      if (value === 'left') delete align[`${r},${c}`]
      else align[`${r},${c}`] = value
    }
    update({ ...table, align })
  }
  const merged = isMergedIn(table, range)
  const save = () => {
    for (const row of table.rows) {
      for (const cell of row) {
        const problem = bodyError(cell)
        if (problem) return setError(problem)
      }
    }
    if (!table.rows.flat().some((cell) => cell.trim())) return setError('표에 내용을 한 칸 이상 입력해 주세요.')
    onSave(table)
  }
  const tool = (label, Icon, action, props = {}) => (
    <Button
      key={label}
      type="button"
      variant="ghost"
      className="table-tool"
      title={label}
      onPointerDown={(e) => e.preventDefault()}
      onClick={action}
      {...props}
    >
      <Icon size={17} />
      <span>{label}</span>
    </Button>
  )
  const currentAlign = table.align[`${range.top},${range.left}`] || 'left'

  return (
    <Modal title={isNew ? '표 넣기' : '표 편집'} onClose={onClose} className="table-modal">
      <p className="modal-description">
        칸을 끌거나 Shift를 누른 채 눌러 여러 칸을 고른 뒤 병합할 수 있어요. Tab은 다음 칸, Enter는 아래 칸으로 가요.
        {converted && ' Markdown 표를 편집 가능한 표로 바꿔요.'}
      </p>
      <div className="table-toolbar" role="toolbar" aria-label="표 도구">
        <div className="table-tool-group">
          {tool('병합', TableCellsMerge, () => update(mergeRange(table, range), [{ r: range.top, c: range.left }]), { disabled: single })}
          {tool('병합 해제', TableCellsSplit, () => update(unmergeRange(table, range)), { disabled: !merged })}
          {tool('여러 칸', SquareDashedMousePointer, () => setExtend(!extend), { 'aria-pressed': extend, className: `table-tool ${extend ? 'active' : ''}` })}
        </div>
        <div className="table-tool-group">
          {tool('위에 행', BetweenHorizontalStart, () => update(insertRow(table, range.top), [{ r: range.top, c: range.left }]))}
          {tool('아래 행', BetweenHorizontalEnd, () => update(insertRow(table, range.bottom + 1), [{ r: range.bottom + 1, c: range.left }]))}
          {tool('왼쪽 열', BetweenVerticalStart, () => update(insertColumn(table, range.left), [{ r: range.top, c: range.left }]))}
          {tool('오른쪽 열', BetweenVerticalEnd, () => update(insertColumn(table, range.right + 1), [{ r: range.top, c: range.right + 1 }]))}
        </div>
        <div className="table-tool-group">
          {tool('행 삭제', Trash2, () => update(deleteRows(table, range.top, range.bottom), [{ r: Math.max(0, range.top - 1), c: range.left }]), {
            disabled: range.bottom - range.top + 1 >= rowCount,
          })}
          {tool('열 삭제', Trash2, () => update(deleteColumns(table, range.left, range.right), [{ r: range.top, c: Math.max(0, range.left - 1) }]), {
            disabled: range.right - range.left + 1 >= columnCount,
          })}
        </div>
        <div className="table-tool-group">
          {tool('왼쪽', AlignLeft, () => setAlign('left'), { 'aria-pressed': currentAlign === 'left' })}
          {tool('가운데', AlignCenter, () => setAlign('center'), { 'aria-pressed': currentAlign === 'center' })}
          {tool('오른쪽', AlignRight, () => setAlign('right'), { 'aria-pressed': currentAlign === 'right' })}
        </div>
        <div className="table-tool-group">
          {tool('칸 가리기', Highlighter, () => update(toggleCellCovers(table, anchorsInRange())))}
          {tool('머리글 행', PanelTop, () => update({ ...table, head: table.head ? 0 : 1 }), { 'aria-pressed': !!table.head, className: `table-tool ${table.head ? 'active' : ''}` })}
          {tool('머리글 열', PanelLeft, () => update({ ...table, side: table.side ? 0 : 1 }), { 'aria-pressed': !!table.side, className: `table-tool ${table.side ? 'active' : ''}` })}
        </div>
      </div>
      <div className="table-grid-scroll">
        <table className="table-grid" ref={grid}>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => {
                  const owner = layout[r][c]
                  if (owner.r !== r || owner.c !== c) return null
                  const selected = r >= range.top && r <= range.bottom && c >= range.left && c <= range.right
                  const header = (table.head && r === 0) || (table.side && c === 0)
                  return (
                    <td
                      key={c}
                      rowSpan={owner.rs > 1 ? owner.rs : undefined}
                      colSpan={owner.cs > 1 ? owner.cs : undefined}
                      className={`${selected ? 'selected' : ''} ${header ? 'header' : ''} ${single && selected ? 'current' : ''}`}
                      onPointerDown={(e) => pointerDown(e, r, c)}
                      onPointerEnter={(e) => pointerEnter(e, r, c)}
                    >
                      <textarea
                        data-cell={`${r},${c}`}
                        aria-label={`${r + 1}행 ${c + 1}열`}
                        rows={Math.max(1, owner.rs, cell.split('\n').length)}
                        value={cell}
                        style={table.align[`${r},${c}`] ? { textAlign: table.align[`${r},${c}`] } : undefined}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        onFocus={() => { if (!dragging.current && !extend) select({ r, c }) }}
                        onKeyDown={(e) => cellKeyDown(e, r, c)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={error ? 'field-error' : 'field-hint'} aria-live="polite">
        {error || <>{rowCount}행 × {columnCount}열 · 칸 안에서도 <code>**굵게**</code>, <code>[[정답]]</code>을 쓸 수 있어요.</>}
      </p>
      <div className="dialog-actions">
        {!isNew && onDelete && (
          <Button variant="ghost" className="table-delete" onClick={onDelete}>
            <Trash2 size={16} /> 표 삭제
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>취소</Button>
        <Button onClick={save}>
          <Check size={16} /> {isNew ? '표 넣기' : '적용'}
        </Button>
      </div>
    </Modal>
  )
}
