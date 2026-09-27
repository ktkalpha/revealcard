import React from 'react'
import MaskedText from './MaskedText'
import { studyOutline } from '../lib/outline'

export default function NoteStudy({ body, revealed, onToggle, focusIds, wrongIds, onMarkWrong }) {
  return (
    <div className="note-study-outline">
      {studyOutline(body).map((row) => (
        <div className="note-study-row" key={row.id} style={{ '--depth': row.depth }}>
          <span className={`note-study-bullet depth-${Math.min(row.depth, 2)}`} aria-hidden="true" />
          <MaskedText
            body={row.text}
            align="left"
            revealed={revealed}
            onToggle={onToggle}
            focusIds={focusIds}
            wrongIds={wrongIds}
            onMarkWrong={onMarkWrong}
            maskParts={row.maskParts}
            maskOrdinalStart={row.maskOrdinalStart}
          />
        </div>
      ))}
    </div>
  )
}
