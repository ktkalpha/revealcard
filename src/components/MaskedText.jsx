import React from 'react'
import { parseBody } from '../lib/masks'

export default function MaskedText({ body, revealed, onToggle }) {
  let number = 0
  return (
    <div className="study-text">
      {parseBody(body).map((part, index) => {
        if (part.id === undefined)
          return <React.Fragment key={index}>{part.text}</React.Fragment>
        number++
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
                : `${number}번째 빈칸 정답 보기`
            }
            onClick={() => onToggle(part.id)}
          >
            <span className="mask-answer" aria-hidden="true">
              {part.text}
            </span>
            {!visible && (
              <span className="mask-question" aria-hidden="true">
                ?
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
