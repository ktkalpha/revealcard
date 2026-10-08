// Pure geometry for the image cropper; all coordinates are in image pixels.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// Rectangle between two drag points. `ratio` (width / height) locks the shape;
// the rectangle always stays inside the image.
export function boxFromDrag(start, end, size, ratio) {
  const x = clamp(end.x, 0, size.width), y = clamp(end.y, 0, size.height)
  let dx = x - start.x, dy = y - start.y
  if (ratio) {
    const room = {
      x: dx < 0 ? start.x : size.width - start.x,
      y: dy < 0 ? start.y : size.height - start.y,
    }
    let width = Math.min(Math.abs(dx), Math.abs(dy) * ratio)
    width = Math.min(width, room.x, room.y * ratio)
    dx = Math.sign(dx || 1) * width
    dy = Math.sign(dy || 1) * (width / ratio)
  }
  return {
    x: Math.min(start.x, start.x + dx), y: Math.min(start.y, start.y + dy),
    width: Math.abs(dx), height: Math.abs(dy),
  }
}

export function pathBounds(points) {
  if (!points.length) return null
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

// Output size that keeps the longest side within `max` pixels.
export function fitWithin(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export const MIN_CROP = 8
export const usableCrop = (rect) => !!rect && rect.width >= MIN_CROP && rect.height >= MIN_CROP
