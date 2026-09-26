import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { prepareMarkdown, remarkMasks } from '../lib/markdown'

export default function MaskedText({ body, align = 'center', revealed, onToggle }) {
  const { source, masks } = prepareMarkdown(body)
  const maskButton = (part, ordinal) => {
    const visible = revealed.has(part.id)
    return (
      <button
        key={part.id}
        type="button"
        className={`mask ${visible ? 'revealed' : ''}`}
        aria-pressed={visible}
        aria-label={
          visible
            ? `${part.text}, 다시 가리기`
            : `${ordinal}번째 빈칸 정답 보기`
        }
        onClick={() => onToggle(part.id)}
      >
        <span className="mask-answer" aria-hidden="true">{part.text}</span>
        {!visible && <span className="mask-question" aria-hidden="true">?</span>}
      </button>
    )
  }
  return (
    <div className="study-text" style={{ textAlign: align }}>
      <Markdown
        remarkPlugins={[remarkGfm, [remarkMasks, { masks }]]}
        components={{
          a({ href, children }) {
            const match = /^#revealcard-mask-(\d+)$/.exec(href || '')
            if (!match || !masks[Number(match[1])])
              return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            const part = masks[Number(match[1])]
            return maskButton(part, Number(match[1]) + 1)
          },
          code({ children, ...props }) {
            const pieces = String(children).split(/(\uE000rc\d+\uE001)/g)
            return (
              <code {...props}>
                {pieces.map((piece, index) => {
                  const match = /^\uE000rc(\d+)\uE001$/.exec(piece)
                  const part = match && masks[Number(match[1])]
                  return part
                    ? maskButton(part, Number(match[1]) + 1)
                    : <React.Fragment key={index}>{piece}</React.Fragment>
                })}
              </code>
            )
          },
          img({ alt }) {
            return <span>{alt}</span>
          },
        }}
      >
        {source}
      </Markdown>
    </div>
  )
}
