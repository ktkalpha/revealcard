import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { BORDERS, LAND } from '../lib/worldMap'

// Equirectangular frame: x = longitude + 180, y = 90 - latitude (lat 85°N..60°S shown).
const TOP = 5
const BOTTOM = 150
const MIN_W = 4
const MAX_W = 360
export const toXY = ({ lat, lon }) => [lon + 180, 90 - lat]
const GRID = [...Array(11)].map((_, i) => (i + 1) * 30)

// A pannable, zoomable world map. Drag or pinch to move, wheel or buttons to zoom,
// tap/click to pick. `fit` (points) eases the view to show them; `children(px)` draws
// overlay marks, where `px` is the size of one screen pixel in map units.
export default function WorldMap({ onPick, fit, children, label = '세계 지도', initial }) {
  const svg = useRef(null)
  const [size, setSize] = useState(null)
  const aspect = size ? size.width / size.height : 2
  const [view, setView] = useState(() => initial || { cx: 200, cy: 70, w: MAX_W })
  const viewRef = useRef(view)
  viewRef.current = view
  const gesture = useRef({ pointers: new Map() })
  const tween = useRef(0)

  useLayoutEffect(() => {
    const element = svg.current
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const clamp = ({ cx, cy, w }) => {
    w = Math.min(MAX_W, Math.max(MIN_W, w))
    const h = w / aspect
    const span = BOTTOM - TOP
    return {
      w,
      cx: Math.min(360 - w / 2, Math.max(w / 2, cx)) || 180,
      cy: h >= span ? (TOP + BOTTOM) / 2 : Math.min(BOTTOM - h / 2, Math.max(TOP + h / 2, cy)),
    }
  }
  const apply = (next) => { cancelAnimationFrame(tween.current); setView(clamp(next)) }
  const animate = (target) => {
    cancelAnimationFrame(tween.current)
    const from = viewRef.current
    const to = clamp(target)
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / 450)
      const e = 1 - (1 - t) ** 3
      setView({ cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, w: from.w * (to.w / from.w) ** e })
      if (t < 1) tween.current = requestAnimationFrame(step)
    }
    tween.current = requestAnimationFrame(step)
  }

  // Start zoomed out: the whole world on wide frames, Americas-to-Pacific on narrow ones.
  const measured = useRef(false)
  useLayoutEffect(() => {
    if (measured.current || !size) return
    measured.current = true
    if (!initial) setView(clamp({ cx: 220, cy: 77, w: Math.min(MAX_W, (BOTTOM - TOP) * aspect * 1.15) }))
  }, [size]) // eslint-disable-line react-hooks/exhaustive-deps

  const fitKey = fit ? JSON.stringify(fit) : ''
  useEffect(() => {
    if (!fit?.length) return
    const xy = fit.map(toXY)
    const xs = xy.map(([x]) => x)
    const ys = xy.map(([, y]) => y)
    const dx = Math.max(...xs) - Math.min(...xs)
    const dy = Math.max(...ys) - Math.min(...ys)
    animate({
      cx: (Math.max(...xs) + Math.min(...xs)) / 2,
      cy: (Math.max(...ys) + Math.min(...ys)) / 2,
      w: Math.max(dx * 1.5, dy * 1.6 * aspect, 24),
    })
  }, [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(tween.current), [])

  const h = view.w / aspect
  const box = { x: view.cx - view.w / 2, y: view.cy - h / 2 }
  const at = (clientX, clientY) => {
    const rect = svg.current.getBoundingClientRect()
    return [box.x + ((clientX - rect.left) / rect.width) * view.w, box.y + ((clientY - rect.top) / rect.height) * h]
  }
  const zoomAround = (factor, [x, y], from = view) => {
    const w = Math.min(MAX_W, Math.max(MIN_W, from.w * factor))
    const k = w / from.w
    return { w, cx: x - (x - from.cx) * k, cy: y - (y - from.cy) * k }
  }
  const pick = (x, y) => {
    if (!onPick) return
    const lat = Math.max(-85, Math.min(85, 90 - y))
    const lon = ((((x - 180) + 180) % 360) + 360) % 360 - 180
    onPick({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 })
  }

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  const wheelRef = useRef(null)
  wheelRef.current = (event) => {
    event.preventDefault()
    apply(zoomAround(event.deltaY > 0 ? 1.25 : 0.8, at(event.clientX, event.clientY)))
  }
  useEffect(() => {
    const element = svg.current
    const wheel = (event) => wheelRef.current(event)
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [])

  function down(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    svg.current.setPointerCapture(event.pointerId)
    const g = gesture.current
    g.pointers.set(event.pointerId, [event.clientX, event.clientY])
    g.start = { view, pointers: new Map(g.pointers) }
    if (g.pointers.size === 1) g.moved = false
    else g.moved = true
  }
  function move(event) {
    const g = gesture.current
    if (!g.pointers.has(event.pointerId)) return
    g.pointers.set(event.pointerId, [event.clientX, event.clientY])
    const rect = svg.current.getBoundingClientRect()
    const unit = g.start.view.w / rect.width
    const points = [...g.pointers.values()]
    const starts = [...g.start.pointers.values()]
    if (points.length === 1) {
      const [dx, dy] = [points[0][0] - starts[0][0], points[0][1] - starts[0][1]]
      if (!g.moved && Math.hypot(dx, dy) < 6) return
      g.moved = true
      apply({ ...g.start.view, cx: g.start.view.cx - dx * unit, cy: g.start.view.cy - dy * unit })
    } else if (points.length >= 2 && starts.length >= 2) {
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) || 1
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const s = g.start.view
      const sh = s.w / aspect
      const m0 = mid(starts[0], starts[1])
      const anchor = [s.cx - s.w / 2 + ((m0[0] - rect.left) / rect.width) * s.w, s.cy - sh / 2 + ((m0[1] - rect.top) / rect.height) * sh]
      const zoomed = zoomAround(dist(starts[0], starts[1]) / dist(points[0], points[1]), anchor, s)
      const m1 = mid(points[0], points[1])
      const u = zoomed.w / rect.width
      apply({ ...zoomed, cx: zoomed.cx - (m1[0] - m0[0]) * u, cy: zoomed.cy - (m1[1] - m0[1]) * u })
    }
  }
  function up(event) {
    const g = gesture.current
    if (!g.pointers.has(event.pointerId)) return
    g.pointers.delete(event.pointerId)
    if (event.type === 'pointerup' && !g.moved && g.pointers.size === 0) pick(...at(event.clientX, event.clientY))
    g.start = { view: viewRef.current, pointers: new Map(g.pointers) }
  }
  function key(event) {
    const step = view.w / 8
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) apply({ ...view, cx: view.cx + moves[event.key][0], cy: view.cy + moves[event.key][1] })
    else if (event.key === '+' || event.key === '=') apply({ ...view, w: view.w * 0.7 })
    else if (event.key === '-' || event.key === '_') apply({ ...view, w: view.w / 0.7 })
    else if ((event.key === 'Enter' || event.key === ' ') && onPick) pick(view.cx, view.cy)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  const px = view.w / (size?.width || 720)
  return (
    <div className="world-map" data-no-swipe>
      <svg ref={svg} viewBox={`${box.x} ${box.y} ${view.w} ${h}`} role="application" tabIndex={0}
        aria-label={`${label}. 끌어서 이동, 휠·+/− 키로 확대, ${onPick ? '눌러서 위치 선택, 방향키로 이동 후 Enter로 가운데 선택' : '방향키로 이동'}`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
        className={onPick ? 'pickable' : undefined}>
        <rect className="world-sea" x={-10} y={-10} width={380} height={200} />
        <g className="world-grid" strokeWidth={px}>
          {GRID.map((x) => <line key={`x${x}`} x1={x} x2={x} y1={TOP} y2={BOTTOM} />)}
          {[30, 60, 90, 120].map((y) => <line key={`y${y}`} x1={0} x2={360} y1={y} y2={y} className={y === 90 ? 'equator' : undefined} />)}
        </g>
        <path className="world-land" d={LAND} />
        <path className="world-borders" d={BORDERS} strokeWidth={px * 0.8} />
        {children?.(px)}
        {onPick && <g className="world-center" strokeWidth={px * 1.2}>
          <line x1={view.cx - px * 6} x2={view.cx + px * 6} y1={view.cy} y2={view.cy} />
          <line y1={view.cy - px * 6} y2={view.cy + px * 6} x1={view.cx} x2={view.cx} />
        </g>}
      </svg>
      <div className="world-map-zoom">
        <button type="button" aria-label="확대" onClick={() => apply({ ...view, w: view.w * 0.6 })}><Plus size={16} /></button>
        <button type="button" aria-label="축소" onClick={() => apply({ ...view, w: view.w / 0.6 })}><Minus size={16} /></button>
        <button type="button" aria-label="전체 지도" onClick={() => animate({ cx: 180, cy: 77, w: MAX_W })}><Maximize2 size={14} /></button>
      </div>
    </div>
  )
}

// Pin shaped mark whose tip sits on (x, y); sized in screen pixels.
export function Pin({ point, px, className, label }) {
  const [x, y] = toXY(point)
  const s = px
  return <g className={`world-pin ${className || ''}`} transform={`translate(${x} ${y}) scale(${s})`} aria-label={label}>
    <path d="M0 0 C-3 -7 -9 -11 -9 -17 A9 9 0 1 1 9 -17 C9 -11 3 -7 0 0Z" strokeWidth={1.5} />
    <circle cy={-17} r={3.4} className="world-pin-dot" />
  </g>
}
