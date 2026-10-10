import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, Check } from 'lucide-react'
import { prepareMarkdown, remarkMasks } from '../lib/markdown'
import { maskKey } from '../lib/masks'
import { CARD_IMAGE_URL } from '../lib/images'

export default function MaskedText({
  body, align = 'center', revealed, onToggle, focusIds, wrongIds, onMarkWrong, activeId,
  maskParts, maskOrdinalStart = 0,
}) {
  const prepared = prepareMarkdown(body)
  const { source } = prepared
  const masks = maskParts || prepared.masks
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
          <span className="mask-answer" aria-hidden="true">{part.text}</span>
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
            return maskButton(part, Number(match[1]) + maskOrdinalStart + 1)
          },
          code({ children, ...props }) {
            const pieces = String(children).split(/(\uE000rc\d+\uE001)/g)
            return (
              <code {...props}>
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
        }}
      >
        {source}
      </Markdown>
    </div>
  )
}
