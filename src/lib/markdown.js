import { parseBody } from './masks.js'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

const marker = /\uE000rc(\d+)\uE001/g
const markerPresence = /\uE000rc\d+\uE001/

export function prepareMarkdown(body) {
  const masks = []
  const source = parseBody(body)
    .map((part) => {
      if (part.id === undefined) return part.text
      masks.push(part)
      return `\uE000rc${masks.length - 1}\uE001`
    })
    .join('')
  return { source, masks }
}

export function remarkMasks({ masks }) {
  const restore = (value) =>
    value.replace(marker, (token, index) =>
      masks[index] ? `[[${masks[index].text}]]` : token,
    )
  const maskLink = (index) => ({
    type: 'link',
    url: `#revealcard-mask-${index}`,
    children: [{ type: 'text', value: '?' }],
  })
  const splitLink = (link) => {
    const result = []
    let children = []
    const flush = () => {
      if (children.length) result.push({ ...link, children })
      children = []
    }
    for (const child of link.children) {
      if (child.type !== 'text') {
        children.push(child)
        continue
      }
      let start = 0
      for (const match of child.value.matchAll(marker)) {
        if (match.index > start)
          children.push({ ...child, value: child.value.slice(start, match.index) })
        const index = Number(match[1])
        if (masks[index]) {
          flush()
          result.push(maskLink(index))
        } else children.push({ type: 'text', value: match[0] })
        start = match.index + match[0].length
      }
      if (start < child.value.length)
        children.push({ ...child, value: child.value.slice(start) })
    }
    flush()
    return result
  }
  const visit = (node) => {
    if (node.type === 'code' || node.type === 'inlineCode') return
    if (!node.children) return
    node.children = node.children.flatMap((child) => {
      if (
        child.type === 'link' &&
        child.children.some(
          (part) => part.type === 'text' && markerPresence.test(part.value),
        )
      ) {
        return splitLink(child)
      }
      if (child.type !== 'text') {
        visit(child)
        return [child]
      }
      if (node.type === 'link') return [{ ...child, value: restore(child.value) }]
      const pieces = []
      let start = 0
      for (const match of child.value.matchAll(marker)) {
        if (match.index > start)
          pieces.push({ type: 'text', value: child.value.slice(start, match.index) })
        const mask = masks[Number(match[1])]
        pieces.push(
          mask
            ? maskLink(Number(match[1]))
            : { type: 'text', value: match[0] },
        )
        start = match.index + match[0].length
      }
      if (start < child.value.length)
        pieces.push({ type: 'text', value: child.value.slice(start) })
      return pieces
    })
  }
  return visit
}

const excerptParser = remark().use(remarkGfm)

export function markdownExcerpt(body) {
  const text = parseBody(body).map((part) => part.text).join('')
  const read = (node) => {
    if (node.type === 'text' || node.type === 'code' || node.type === 'inlineCode')
      return node.value
    if (node.type === 'image') return node.alt || ''
    if (!node.children) return ''
    const separator = ['root', 'list', 'listItem', 'table', 'tableRow'].includes(node.type)
      ? ' '
      : ''
    return node.children.map(read).join(separator)
  }
  return read(excerptParser.parse(text)).replace(/\s+/g, ' ').trim()
}
