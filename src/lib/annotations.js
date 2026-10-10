// Notes written above words (`단어^[[필기]]`) float over the line, so two notes on
// the same line can collide. Each note starts above its word, moves right just
// enough to clear the note before it, and notes that would run past the right
// edge push the earlier ones on that line back to the left.
export function placeAnnotations(root) {
  const notes = [...root.querySelectorAll('.annot-note')]
  if (!notes.length) return
  for (const note of notes) note.style.transform = ''
  const box = root.getBoundingClientRect()
  const lines = []
  for (const note of notes) {
    const top = note.parentElement.getBoundingClientRect().top
    const rect = note.getBoundingClientRect()
    const line = lines.at(-1)
    const item = { note, start: rect.left, width: Math.max(rect.width, note.scrollWidth) }
    if (line && Math.abs(line.top - top) <= 2) line.items.push(item)
    else lines.push({ top, items: [item] })
  }
  for (const { items } of lines) {
    let cursor = box.left
    for (const item of items) {
      item.left = Math.max(item.start, cursor)
      cursor = item.left + item.width + 4
    }
    let limit = box.right
    for (const item of [...items].reverse()) {
      item.left = Math.max(box.left, Math.min(item.left, limit - item.width))
      limit = item.left - 4
    }
    for (const item of items)
      if (item.left !== item.start) item.note.style.transform = `translateX(${item.left - item.start}px)`
  }
}
