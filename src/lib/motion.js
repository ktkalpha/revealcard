// Built-in animations a card can show with a fenced block:
//
//   ```motion
//   fusion
//   ```
//
// Cards cannot run their own scripts, so each animation is part of the app.

export const MOTION_LANG = 'motion'
export const MOTIONS = { fusion: '수소 핵융합 반응', 'solar-flow': '태양 에너지의 전환과 흐름' }
const BLOCK = /^```motion[ \t]*\n([^\n`]*)\n```[ \t]*$/gm

export function motionBlocks(body) {
  return [...String(body).matchAll(BLOCK)].map((match) => ({
    start: match.index, end: match.index + match[0].length, name: match[1].trim(),
  }))
}

export const motionTitle = (name) => MOTIONS[String(name).trim()] || null
