import React, { useEffect, useRef, useState } from 'react'
import { Crop, Highlighter, ImagePlus, LassoSelect, Undo2 } from 'lucide-react'
import { Button } from './ui/button'
import Modal from './Modal'
import { api } from '../lib/api'
import { boxFromDrag, fitWithin, pathBounds, usableCrop } from '../lib/crop'
import { CARD_IMAGE_MAX_BYTES, imageMarkdown } from '../lib/images'

const MAX_SIDE = 1600
const RATIOS = [['free', '자유', 0], ['1:1', '1 : 1', 1], ['4:3', '4 : 3', 4 / 3], ['16:9', '16 : 9', 16 / 9]]
const COLORS = [['yellow', '노랑', '#ffe14d'], ['pink', '분홍', '#ff8fb3'], ['green', '초록', '#7be495'], ['blue', '파랑', '#6ec1ff']]
const WIDTHS = [['thin', '얇게', 0.012], ['normal', '보통', 0.025], ['thick', '굵게', 0.05]]
const TYPES = ['image/png', 'image/jpeg', 'image/webp']

const loadImage = (url) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'))
  image.src = url
})

// Draws `rect` of the image to a canvas, optionally clipped to a free-form path.
function render(image, rect, path, strokes = []) {
  const size = fitWithin(rect.width, rect.height, MAX_SIDE)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  context.scale(size.width / rect.width, size.height / rect.height)
  context.translate(-rect.x, -rect.y)
  if (path) {
    context.beginPath()
    path.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)))
    context.closePath()
    context.clip()
  }
  context.drawImage(image, 0, 0)
  // Multiply keeps the text under a highlight readable, like a real highlighter.
  context.globalCompositeOperation = 'multiply'
  context.lineCap = context.lineJoin = 'round'
  for (const stroke of strokes) {
    context.strokeStyle = stroke.color
    context.lineWidth = stroke.width
    context.beginPath()
    stroke.points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)))
    if (stroke.points.length === 1) context.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y)
    context.stroke()
  }
  return canvas
}

function encode(canvas, jpeg) {
  let current = canvas
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = jpeg ? current.toDataURL('image/jpeg', 0.9) : current.toDataURL('image/png')
    if (url.length * 0.75 <= CARD_IMAGE_MAX_BYTES * 0.95) return url
    const smaller = document.createElement('canvas')
    smaller.width = Math.max(1, Math.round(current.width * 0.7))
    smaller.height = Math.max(1, Math.round(current.height * 0.7))
    smaller.getContext('2d').drawImage(current, 0, 0, smaller.width, smaller.height)
    current = smaller
  }
  throw new Error('이미지가 너무 커요. 더 작은 사진을 사용해 주세요.')
}

const blobUrl = (canvas) => new Promise((resolve, reject) =>
  canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('이미지를 처리하지 못했어요.'))), 'image/png'))

export default function ImageDialog({ onClose, onInsert }) {
  const [original, setOriginal] = useState(null)
  const [current, setCurrent] = useState(null)
  const [mode, setMode] = useState('box')
  const [ratio, setRatio] = useState('free')
  const [box, setBox] = useState(null)
  const [path, setPath] = useState([])
  const [strokes, setStrokes] = useState([])
  const [color, setColor] = useState('yellow')
  const [thickness, setThickness] = useState('normal')
  const [alt, setAlt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const drag = useRef(null)
  const stage = useRef(null)
  const urls = useRef([])
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const open = async (file) => {
    if (!file) return
    if (!TYPES.includes(file.type)) return setError('PNG, JPG, WebP 사진만 사용할 수 있어요.')
    setError('')
    const url = URL.createObjectURL(file)
    urls.current.push(url)
    try {
      const image = await loadImage(url)
      const next = { url, image, width: image.naturalWidth, height: image.naturalHeight, jpeg: file.type === 'image/jpeg', cropped: false }
      setOriginal(next)
      setCurrent(next)
      setBox(null)
      setPath([])
      setStrokes([])
      setAlt((value) => value || file.name.replace(/\.[^.]+$/, '').slice(0, 60))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    const paste = (event) => {
      const file = [...(event.clipboardData?.files || [])].find((item) => TYPES.includes(item.type))
      if (file) {
        event.preventDefault()
        open(file)
      }
    }
    document.addEventListener('paste', paste)
    return () => document.removeEventListener('paste', paste)
  }, [])

  const point = (event) => {
    const rect = stage.current.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * current.width,
      y: ((event.clientY - rect.top) / rect.height) * current.height,
    }
  }
  const ratioValue = RATIOS.find(([key]) => key === ratio)[2]
  const start = (event) => {
    if (busy) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const origin = point(event)
    drag.current = { origin }
    if (mode === 'mark') {
      const width = current.width * WIDTHS.find(([key]) => key === thickness)[2]
      setStrokes((all) => [...all, { color: COLORS.find(([key]) => key === color)[2], width, points: [origin] }])
    } else if (mode === 'box') setBox(null)
    else setPath([origin])
  }
  const move = (event) => {
    if (!drag.current) return
    const next = point(event)
    if (mode === 'mark') setStrokes((all) => all.map((stroke, index) => (index === all.length - 1 ? { ...stroke, points: [...stroke.points, next] } : stroke)))
    else if (mode === 'box') setBox(boxFromDrag(drag.current.origin, next, current, ratioValue))
    else setPath((points) => {
      const last = points[points.length - 1]
      return last && Math.hypot(next.x - last.x, next.y - last.y) < current.width / 300 ? points : [...points, next]
    })
  }
  const end = () => { drag.current = null }

  const selection = mode === 'box'
    ? (usableCrop(box) ? { rect: box, path: null } : null)
    : (path.length >= 3 && usableCrop(pathBounds(path)) ? { rect: pathBounds(path), path } : null)

  const bake = async () => {
    const canvas = render(current.image, selection.rect, selection.path, strokes)
    const url = await blobUrl(canvas)
    urls.current.push(url)
    const image = await loadImage(url)
    const next = { url, image, width: canvas.width, height: canvas.height, jpeg: false, cropped: true, transparent: current.transparent || !!selection.path }
    setCurrent(next)
    setBox(null)
    setPath([])
    setStrokes([])
    return next
  }
  const crop = async () => {
    setError('')
    try { await bake() } catch (e) { setError(e.message) }
  }
  const reset = () => {
    setCurrent(original)
    setBox(null)
    setPath([])
    setStrokes([])
    setError('')
  }
  const insert = async () => {
    setBusy(true)
    setError('')
    try {
      const source = selection ? await bake() : current
      const canvas = render(source.image, { x: 0, y: 0, width: source.width, height: source.height }, null, selection ? [] : strokes)
      const image = encode(canvas, source.jpeg && !source.cropped && !source.transparent)
      const { url } = await api('/api/images', { method: 'POST', body: { image } })
      onInsert(imageMarkdown(alt, url))
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const outline = mode === 'box'
    ? selection && `M${box.x} ${box.y}h${box.width}v${box.height}h${-box.width}Z`
    : path.length > 1 && `M${path.map((p) => `${p.x} ${p.y}`).join('L')}${path.length >= 3 ? 'Z' : ''}`

  return (
    <Modal title="사진 추가" onClose={onClose} wide>
      {!current ? (
        <label
          className="image-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); open(e.dataTransfer.files[0]) }}
        >
          <ImagePlus size={28} />
          <strong>사진을 선택하거나 끌어다 놓으세요</strong>
          <span>PNG · JPG · WebP, 붙여넣기(Ctrl+V)도 돼요.</span>
          <input data-autofocus type="file" accept={TYPES.join(',')} onChange={(e) => open(e.target.files[0])} />
        </label>
      ) : (
        <>
          <div className="image-tools">
            <div className="segmented" role="group" aria-label="자르기 방식">
              <button type="button" aria-pressed={mode === 'box'} onClick={() => { setMode('box'); setPath([]) }}>
                <Crop size={15} /> 박스 자르기
              </button>
              <button type="button" aria-pressed={mode === 'free'} onClick={() => { setMode('free'); setBox(null) }}>
                <LassoSelect size={15} /> 자유 자르기
              </button>
              <button type="button" aria-pressed={mode === 'mark'} onClick={() => { setMode('mark'); setBox(null); setPath([]) }}>
                <Highlighter size={15} /> 형광펜
              </button>
            </div>
            {mode === 'mark' && (
              <>
                <div className="segmented" role="group" aria-label="형광펜 색">
                  {COLORS.map(([key, label, value]) => (
                    <button key={key} type="button" aria-pressed={color === key} onClick={() => setColor(key)}>
                      <span className="image-swatch" style={{ background: value }} /> {label}
                    </button>
                  ))}
                </div>
                <div className="segmented" role="group" aria-label="형광펜 굵기">
                  {WIDTHS.map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={thickness === key} onClick={() => setThickness(key)}>{label}</button>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" disabled={!strokes.length} onClick={() => setStrokes((all) => all.slice(0, -1))}>
                  <Undo2 size={15} /> 마지막 획 취소
                </Button>
              </>
            )}
            {mode === 'box' && (
              <div className="segmented" role="group" aria-label="자르기 비율">
                {RATIOS.map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={ratio === key} onClick={() => { setRatio(key); setBox(null) }}>{label}</button>
                ))}
              </div>
            )}
          </div>
          <p className="field-hint">
            {mode === 'box' ? '사진 위를 드래그해 자를 영역을 정하세요.' : mode === 'free' ? '남길 부분의 테두리를 따라 그려 보세요. 바깥쪽은 투명해져요.' : '강조할 부분을 따라 칠하세요. 자르기와 함께 써도 돼요.'}
          </p>
          <div className="image-stage-wrap">
            <div className={`image-stage ${current.transparent ? 'checker' : ''}`}>
              <img src={current.url} alt="자를 사진 미리보기" draggable="false" />
              <svg
                ref={stage}
                viewBox={`0 0 ${current.width} ${current.height}`}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
              >
                {strokes.map((stroke, index) => (
                  <polyline
                    key={index}
                    className="image-stroke"
                    points={stroke.points.length === 1 ? `${stroke.points[0].x},${stroke.points[0].y} ${stroke.points[0].x + 0.01},${stroke.points[0].y}` : stroke.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                  />
                ))}
                {outline && (
                  <>
                    <path className="image-dim" fillRule="evenodd" d={`M0 0H${current.width}V${current.height}H0Z${mode === 'box' || path.length >= 3 ? outline : ''}`} />
                    <path className="image-outline" d={outline} vectorEffect="non-scaling-stroke" />
                  </>
                )}
              </svg>
            </div>
          </div>
          <label className="image-alt">
            사진 설명
            <input value={alt} maxLength={60} placeholder="예: 헌병 경찰서 배치도" onChange={(e) => setAlt(e.target.value)} />
          </label>
          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={reset} disabled={busy || (current === original && !strokes.length)}>
              <Undo2 size={16} /> 원본으로
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setOriginal(null); setCurrent(null); setBox(null); setPath([]); setStrokes([]) }} disabled={busy}>
              다른 사진
            </Button>
            <Button type="button" variant="outline" onClick={crop} disabled={busy || !selection}>자르기 적용</Button>
            <Button type="button" onClick={insert} disabled={busy}>{busy ? '올리는 중…' : selection ? '자르고 삽입' : '삽입'}</Button>
          </div>
        </>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}
    </Modal>
  )
}
