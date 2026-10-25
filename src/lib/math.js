import { useEffect, useState } from 'react'

// LaTeX for science cards: `$E=mc^2$` inline and `$$ … $$` on its own line.
// KaTeX is large, so it loads only once a card with math is shown.

export const hasMath = (text) => /\$[^$\n]*[^\s$][^$\n]*\$/.test(String(text || '')) || /\$\$/.test(String(text || ''))

let katex = null
let loading = null
const waiting = new Set()

export function loadKatex() {
  if (katex) return Promise.resolve(katex)
  loading ||= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([module]) => {
    katex = module.default
    for (const done of waiting) done(katex)
    waiting.clear()
    return katex
  })
  return loading
}

// Returns KaTeX once it is ready (null until then) and re-renders when it arrives.
export function useKatex(needed) {
  const [ready, setReady] = useState(katex)
  useEffect(() => {
    if (!needed || katex) return
    let live = true
    const done = (module) => live && setReady(module)
    waiting.add(done)
    loadKatex().catch(() => {})
    return () => {
      live = false
      waiting.delete(done)
    }
  }, [needed])
  return katex || ready
}

const OPTIONS = { throwOnError: true, strict: 'ignore', output: 'htmlAndMathml', maxSize: 20, maxExpand: 500 }

// Only \htmlData and \htmlClass are trusted; they mark the blanks inside formulas.
const trust = ({ command }) => command === '\\htmlData' || command === '\\htmlClass'

export function renderLatex(module, latex, display) {
  try {
    return module.renderToString(latex, { ...OPTIONS, displayMode: display, trust })
  } catch {
    return null
  }
}

const marker = /rc(\d+)/g

// A formula with blanks: each blank becomes a box the size of its answer until it
// is opened. `state(part)` says hidden / shown, active and wrong for each blank.
export function maskedLatex(value, masks, state) {
  return value.replace(marker, (token, index) => {
    const part = masks[Number(index)]
    if (!part) return token
    const { visible, active, wrong } = state(part)
    const flags = `mask-id=${part.id},mask-state=${visible ? 'shown' : 'hidden'}${active ? ',mask-active=1' : ''}${wrong ? ',mask-wrong=1' : ''}`
    return `\\htmlData{${flags}}{${visible ? `{${part.text}}` : `\\phantom{${part.text}}`}}`
  })
}

// When an answer is not valid LaTeX on its own, blanks fall back to plain boxes.
export function fallbackLatex(value, masks, state) {
  return value.replace(marker, (token, index) => {
    const part = masks[Number(index)]
    if (!part) return token
    const { visible } = state(part)
    const text = part.text.replace(/[\\{}$&#^_%~]/g, '')
    return `\\htmlData{mask-id=${part.id},mask-state=${visible ? 'shown' : 'hidden'}}{\\text{${visible ? text : '\\ ?\\ '}}}`
  })
}

// `$$…$$` written on one line of its own is shown as a centred display formula,
// the same as when the dollars sit on separate lines.
export const displayLines = (source) =>
  source.replace(/^([ \t]*)\$\$([^\n]+?)\$\$[ \t]*$/gm, (line, indent, latex) => `${indent}$$\n${indent}${latex}\n${indent}$$`)

// Splits plain text into text and `$…$` pieces, for answers such as `[[$x^2$]]`.
export function mathPieces(text) {
  const pieces = []
  let start = 0
  for (const match of String(text).matchAll(/\$\$([^$]+)\$\$|\$([^$\n]+)\$/g)) {
    if (match.index > start) pieces.push({ text: text.slice(start, match.index) })
    pieces.push({ latex: match[1] ?? match[2], display: match[1] !== undefined })
    start = match.index + match[0].length
  }
  if (start < text.length) pieces.push({ text: text.slice(start) })
  return pieces
}
