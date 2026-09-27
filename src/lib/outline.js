export function parseOutline(body) {
  if (!body) return [{ id: 1, depth: 0, text: '', collapsed: false }]
  let previousDepth = 0
  return body.split('\n').map((line, index) => {
    const match = /^( *)(?:-\s)(.*)$/.exec(line)
    const requestedDepth = match ? Math.floor(match[1].length / 2) : 0
    const depth = index ? Math.min(requestedDepth, previousDepth + 1) : 0
    previousDepth = depth
    return {
      id: index + 1,
      depth,
      text: match ? match[2] : line,
      collapsed: false,
    }
  })
}

export function serializeOutline(rows) {
  return rows.filter((row) => row.text.trim()).map(
    (row) => `${'  '.repeat(row.depth)}- ${row.text}`,
  ).join('\n')
}

export function subtreeEnd(rows, index) {
  let end = index + 1
  while (end < rows.length && rows[end].depth > rows[index].depth) end++
  return end
}

export function moveDepth(rows, index, delta) {
  const row = rows[index]
  if (!row || (delta < 0 && !row.depth) ||
    (delta > 0 && (index === 0 || rows[index - 1].depth < row.depth))) return rows
  const next = rows.map((item) => ({ ...item }))
  for (let i = index; i < subtreeEnd(rows, index); i++) next[i].depth += delta
  return next
}
