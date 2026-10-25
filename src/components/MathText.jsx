import React from 'react'
import { hasMath, mathPieces, renderLatex, useKatex } from '../lib/math'

// Plain text with `$…$` formulas, used for blank answers and grading feedback.
export default function MathText({ text }) {
  const math = hasMath(text)
  const katex = useKatex(math)
  if (!math || !katex) return <>{text}</>
  return (
    <>
      {mathPieces(text).map((piece, index) => {
        if (piece.text !== undefined) return <React.Fragment key={index}>{piece.text}</React.Fragment>
        const html = renderLatex(katex, piece.latex, false)
        return html
          ? <span key={index} className="rc-math" dangerouslySetInnerHTML={{ __html: html }} />
          : <code key={index}>{piece.latex}</code>
      })}
    </>
  )
}
