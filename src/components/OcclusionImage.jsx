import React, { useMemo } from 'react'
import { occlusionData } from '../lib/occlusion'

export default function OcclusionImage({ body, alt, revealed, onToggle, focusIds }) {
  const data = useMemo(() => occlusionData(body), [body])
  return (
    <div className="occlusion-image" data-no-swipe>
      <img src={data.image} alt={alt || '가리개 사진'} draggable={false} />
      {data.boxes.map((box, index) => {
        if (focusIds && !focusIds.has(box.id)) return null
        const visible = revealed.has(box.id)
        return (
          <button
            type="button"
            key={box.id}
            className={`occlusion-box ${visible ? 'revealed' : ''}`}
            style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
            aria-pressed={visible}
            aria-label={`${index + 1}번째 가리개${visible && box.label ? `: ${box.label}` : ''} ${visible ? '다시 가리기' : '보기'}`}
            onClick={() => onToggle(box.id)}
          >
            {!visible && <span aria-hidden="true">{index + 1}</span>}
          </button>
        )
      })}
    </div>
  )
}
