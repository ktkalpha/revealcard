import React, { useLayoutEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { X, Check, Table2 } from 'lucide-react'
import { prepareMarkdown, remarkMasks } from '../lib/markdown'
import { maskKey } from '../lib/masks'
import { CARD_IMAGE_URL } from '../lib/images'
import { placeAnnotations } from '../lib/annotations'
import { TABLE_LANG, parseTableData, tableLayout } from '../lib/table'
import { displayLines, fallbackLatex, hasMath, maskedLatex, renderLatex, useKatex } from '../lib/math'
import MathText from './MathText'
import MotionBlock from './MotionBlock'
import { MOTION_LANG } from '../lib/motion'

export default function MaskedText({
  body, align = 'center', revealed, onToggle, focusIds, wrongIds, onMarkWrong, activeId,
  maskParts, maskOrdinalStart = 0, onEditTable,
}) {
  const root = useRef(null)
  const annotated = body.includes('^[[')
  useLayoutEffect(() => {
    const element = root.current
    if (!annotated || !element) return
    const place = () => placeAnnotations(element)
    place()
    const observer = new ResizeObserver(place)
    observer.observe(element)
    return () => observer.disconnect()
  })
  const prepared = prepareMarkdown(body)
  const source = displayLines(prepared.source)
  const masks = maskParts || prepared.masks
  const math = hasMath(source)
  const katex = useKatex(math)
  // Blanks inside formulas are drawn by KaTeX, so they are wired up here instead of as buttons.
  const maskState = (part) => {
    const focused = !focusIds || focusIds.has(part.id)
    return {
      focused,
      visible: !focused || revealed.has(part.id),
      active: focused && part.id === activeId,
      wrong: wrongIds?.has(maskKey(part)),
    }
  }
  useLayoutEffect(() => {
    if (!math || !root.current) return
    root.current.querySelectorAll('.katex [data-mask-id]').forEach((element) => {
      const part = masks.find((item) => item.id === element.dataset.maskId)
      if (!part) return
      const { focused, visible } = maskState(part)
      element.setAttribute('role', 'button')
      element.setAttribute('tabindex', focused ? '0' : '-1')
      element.setAttribute('aria-pressed', String(visible))
      element.setAttribute('aria-label', visible ? `${part.text}, 다시 가리기` : `${masks.indexOf(part) + maskOrdinalStart + 1}번째 빈칸 정답 보기`)
    })
  })
  const mathMask = (e) => {
    const element = e.target.closest?.('.katex [data-mask-id]')
    const part = element && masks.find((item) => item.id === element.dataset.maskId)
    if (!part || !maskState(part).focused) return null
    return part
  }
  const formula = (value, display) => {
    if (!katex) return <code className="rc-math-loading">{value.replace(/\uE000rc(\d+)\uE001/g, '[ ? ]')}</code>
    const html = renderLatex(katex, maskedLatex(value, masks, maskState), display)
      ?? renderLatex(katex, fallbackLatex(value, masks, maskState), display)
    if (!html) return <code className="rc-math-error" title="수식을 읽을 수 없어요">{value}</code>
    return display
      ? <div className="rc-math rc-math-display" dangerouslySetInnerHTML={{ __html: html }} />
      : <span className="rc-math" dangerouslySetInnerHTML={{ __html: html }} />
  }
  const maskButton = (part, ordinal) => {
    const focused = !focusIds || focusIds.has(part.id)
    const visible = !focused || revealed.has(part.id)
    const key = maskKey(part)
    const wrong = wrongIds?.has(key)
    return (
      <span key={part.id} className="mask-wrap">
        <button
          type="button"
          className={`mask ${visible ? 'revealed' : ''} ${wrong ? 'mask-wrong' : ''} ${focused && part.id === activeId ? 'mask-active' : ''}`}
          data-mask-id={part.id}
          aria-pressed={visible}
          aria-label={visible ? `${part.text}, 다시 가리기` : `${ordinal}번째 빈칸 정답 보기`}
          onClick={() => focused && onToggle(part.id)}
          disabled={!focused}
        >
          <span className="mask-answer" aria-hidden="true"><MathText text={part.text} /></span>
          {!visible && <span className="mask-question" aria-hidden="true">?</span>}
        </button>
        {visible && onMarkWrong && focused && (
          <button
            type="button"
            className={`mask-mark ${wrong ? 'marked' : ''}`}
            aria-label={`${ordinal}번째 빈칸 ${wrong ? '틀림 해제' : '틀림 표시'}`}
            aria-pressed={!!wrong}
            title={wrong ? '틀림 해제' : '틀림 표시'}
            onClick={() => onMarkWrong(key, !wrong)}
          >
            {wrong ? <Check size={14} /> : <X size={14} />}
          </button>
        )}
      </span>
    )
  }
  const plugins = [remarkGfm, remarkMath, [remarkMasks, { masks }]]
  // A table block renders as a real table; each cell is Markdown with covers.
  // Tables are counted in order so the editor knows which one was picked.
  let tableCount = 0
  const richTable = (data) => {
    const table = parseTableData(data)
    if (!table) return null
    const index = tableCount++
    const layout = tableLayout(table)
    const rendered = (
      <div className="rc-table-scroll">
        <table className="rc-table">
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => {
                  const owner = layout[r][c]
                  if (owner.r !== r || owner.c !== c) return null
                  const Cell = (table.head && r === 0) || (table.side && c === 0) ? 'th' : 'td'
                  return (
                    <Cell
                      key={c}
                      rowSpan={owner.rs > 1 ? owner.rs : undefined}
                      colSpan={owner.cs > 1 ? owner.cs : undefined}
                      style={table.align[`${r},${c}`] ? { textAlign: table.align[`${r},${c}`] } : undefined}
                    >
                      {cell.trim() && <Markdown remarkPlugins={plugins} components={components}>{cell}</Markdown>}
                    </Cell>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    if (!onEditTable) return rendered
    return (
      <div className="rc-table-editable">
        {rendered}
        <button type="button" className="rc-table-edit" onClick={() => onEditTable(index)}>
          <Table2 size={14} /> 표 편집
        </button>
      </div>
    )
  }
  const components = {
      a({ href, children }) {
        const match = /^#revealcard-mask-(\d+)$/.exec(href || '')
        if (!match || !masks[Number(match[1])])
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        const part = masks[Number(match[1])]
        return maskButton(part, Number(match[1]) + maskOrdinalStart + 1)
      },
      code({ children, className, ...props }) {
        if (/\bmath-(inline|display)\b/.test(className || '')) return formula(String(children), /math-display/.test(className))
        const pieces = String(children).split(/(\uE000rc\d+\uE001)/g)
        return (
          <code className={className} {...props}>
            {pieces.map((piece, index) => {
              const match = /^\uE000rc(\d+)\uE001$/.exec(piece)
              const part = match && masks[Number(match[1])]
              return part
                ? maskButton(part, Number(match[1]) + maskOrdinalStart + 1)
                : <React.Fragment key={index}>{piece}</React.Fragment>
            })}
          </code>
        )
      },
      img({ src, alt }) {
        // Only photos uploaded through the app load; external images stay alt-text only.
        return CARD_IMAGE_URL.test(src || '')
          ? <img className="card-image" src={src} alt={alt || ''} loading="lazy" />
          : <span>{alt}</span>
      },
      pre({ node, children }) {
        const code = node?.children?.[0]
        const lang = code?.properties?.className
        if (Array.isArray(lang) && lang.includes(`language-${TABLE_LANG}`)) {
          const rendered = richTable(code.children.map((child) => child.value || '').join('').trim())
          if (rendered) return rendered
        }
        if (Array.isArray(lang) && lang.includes('math-display')) return <>{children}</>
        if (Array.isArray(lang) && lang.includes(`language-${MOTION_LANG}`))
          return <MotionBlock name={code.children.map((child) => child.value || '').join('').trim()} />
        return <pre>{children}</pre>
      },
  }
  return (
    <div
      ref={root}
      className="study-text"
      style={{ textAlign: align }}
      onClick={math ? (e) => {
        const part = mathMask(e)
        if (part) onToggle(part.id)
      } : undefined}
      onKeyDown={math ? (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const part = mathMask(e)
        if (!part) return
        e.preventDefault()
        e.stopPropagation()
        onToggle(part.id)
      } : undefined}
    >
      <Markdown remarkPlugins={plugins} components={components}>
        {source}
      </Markdown>
    </div>
  )
}
