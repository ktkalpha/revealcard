import React, { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import ImageDialog from './ImageDialog'
import OcclusionImage from './OcclusionImage'
import { boxFromPoints, emptyOcclusion, occlusionError } from '../lib/occlusion'

export default function OcclusionEditor({ draft, deckName, onChange, onSave, onExit, autosaved }) {
  const { card } = draft
  let data
  try { data = { ...emptyOcclusion(), ...JSON.parse(card.body) } } catch { data = emptyOcclusion() }
  const error = occlusionError(card.body)
  const [adding, setAdding] = useState(false)
  const [drawing, setDrawing] = useState(null)
  const [revealed, setRevealed] = useState(new Set())
  const stage = useRef(null)
  const commit = (next) => onChange({ ...card, kind: 'occlusion', body: JSON.stringify(next) })
  const update = (id, field, value) => commit({ ...data, boxes: data.boxes.map((box) => box.id === id ? { ...box, [field]: value } : box) })
  const point = (e) => {
    const rect = stage.current.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width * 100, y: (e.clientY - rect.top) / rect.height * 100 }
  }
  const down = (e) => {
    if (!e.isPrimary || e.button !== 0 || e.target.closest('.occlusion-box')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrawing({ start: point(e), end: point(e) })
  }
  const move = (e) => drawing && setDrawing({ ...drawing, end: point(e) })
  const up = () => {
    if (!drawing) return
    const box = boxFromPoints(drawing.start, drawing.end)
    setDrawing(null)
    if (box.w >= 1 && box.h >= 1 && data.boxes.length < 60)
      commit({ ...data, boxes: [...data.boxes, { id: crypto.randomUUID(), ...box, label: '' }] })
  }
  const preview = drawing && boxFromPoints(drawing.start, drawing.end)
  const toggle = (id) => setRevealed((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  return <main id="main" className="editor-page occlusion-editor">
    <div className="editor-top"><Button variant="ghost" onClick={onExit}>← 돌아가기</Button>
      <span className="save-state">{autosaved}</span></div>
    <div className="section-heading"><div><p className="overline">{deckName}</p><h1>사진 가리개 카드 수정</h1></div></div>
    <form className="editor-layout" onSubmit={(e) => { e.preventDefault(); if (!error && card.title.trim()) onSave() }}>
      <div className="editor-panel">
        <label htmlFor="occlusion-title">제목</label>
        <input id="occlusion-title" value={card.title} maxLength={200} required onChange={(e) => onChange({ ...card, title: e.target.value })} />
        <div className="occlusion-editor-head">
          <span>사진과 가리개</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}><ImagePlus size={16} /> {data.image ? '사진 바꾸기' : '사진 추가'}</Button>
        </div>
        <p id="occlusion-help" className="field-hint">사진 위를 끌어서 가릴 부분을 상자로 그리세요. 가리개는 1~60개까지 넣을 수 있어요.</p>
        {data.image && <div className="occlusion-image occlusion-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrawing(null)}>
          <img src={data.image} alt="가리개를 그릴 사진" draggable={false} />
          {data.boxes.map((box, index) => <span key={box.id} className="occlusion-box editing" style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}><span>{index + 1}</span></span>)}
          {preview && <span className="occlusion-box drawing" style={{ left: `${preview.x}%`, top: `${preview.y}%`, width: `${preview.w}%`, height: `${preview.h}%` }} />}
        </div>}
        {data.boxes.length > 0 && <ol className="occlusion-list">{data.boxes.map((box, index) => <li key={box.id}>
          <span className="occlusion-number">{index + 1}</span>
          <input aria-label={`${index + 1}번째 가리개 이름`} placeholder="가린 내용 (선택)" value={box.label || ''} maxLength={200} onChange={(e) => update(box.id, 'label', e.target.value)} />
          <Button type="button" variant="ghost" size="sm" aria-label={`${index + 1}번째 가리개 삭제`} onClick={() => commit({ ...data, boxes: data.boxes.filter((item) => item.id !== box.id) })}><Trash2 size={16} /></Button>
        </li>)}</ol>}
        <p id="occlusion-error" className="field-error" role="status">{error}</p>
        <div className="editor-actions"><Button type="button" variant="ghost" onClick={onExit}>닫기</Button><Button type="submit" disabled={!!error || !card.title.trim() || card.body.length > 20000}>카드 저장</Button></div>
      </div>
      <aside className="preview-panel"><h2>학습 미리보기</h2>
        {!error ? <OcclusionImage body={card.body} alt={card.title} revealed={revealed} onToggle={toggle} /> : <p className="preview-placeholder">사진과 가리개를 넣으면 여기에 표시돼요.</p>}
        <p className="field-hint">가리개를 눌러 실제 학습처럼 확인해 보세요.</p>
      </aside>
    </form>
    {adding && <ImageDialog onClose={() => setAdding(false)} onInsert={(markdown) => {
      const url = /\]\((\/api\/images\/[^)]+)\)$/.exec(markdown)?.[1]
      if (url) commit({ ...data, image: url })
      setAdding(false)
    }} />}
  </main>
}
