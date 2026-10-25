import React, { useState } from 'react'
import { Button } from './ui/button'
import { mapQuizError, mapQuizPlaces } from '../lib/mapquiz'
import MapQuizGame from './MapQuizGame'
import WorldMap, { Pin } from './WorldMap'

export default function MapQuizEditor({ draft, deckName, onChange, onSave, onExit, autosaved }) {
  const { card } = draft
  const error = mapQuizError(card.body)
  const [preview, setPreview] = useState(false)
  let places = []
  try { places = mapQuizPlaces(card.body) } catch {}
  // Clicking the map appends a new line with that position.
  const add = ({ lat, lon }) => {
    const body = card.body.replace(/\s*$/, '')
    let n = 1
    while (body.split('\n').some((line) => line.split('|')[0].trim() === `새 지역 ${n}`)) n++
    onChange({ ...card, body: `${body}${body ? '\n' : ''}새 지역 ${n} | ${lat}, ${lon} | ` })
  }
  return <main id="main" className="editor-page">
    <div className="editor-top"><Button variant="ghost" onClick={onExit}>← 돌아가기</Button>
      <span className="save-state">{autosaved}</span></div>
    <div className="section-heading"><div><p className="overline">{deckName}</p><h1>지도 찾기 게임 수정</h1></div></div>
    <form className="editor-layout" onSubmit={(e) => { e.preventDefault(); if (!error && card.title.trim()) onSave() }}>
      <div className="editor-panel">
        <label htmlFor="mapquiz-title">제목</label>
        <input id="mapquiz-title" value={card.title} maxLength={200} required onChange={(e) => onChange({ ...card, title: e.target.value })} />
        <label htmlFor="mapquiz-body">지역과 위치</label>
        <p id="mapquiz-help" className="field-hint">한 줄에 한 곳씩 ‘이름 | 위도, 경도 | 설명’으로 작성하세요. 설명은 정답을 보여줄 때 나오며 생략할 수 있어요. 오른쪽 지도를 누르면 그 위치로 새 줄이 추가돼요.</p>
        <textarea id="mapquiz-body" value={card.body} rows={14} maxLength={20000} required aria-describedby="mapquiz-help mapquiz-error" aria-invalid={!!error} onChange={(e) => onChange({ ...card, body: e.target.value })} />
        <p id="mapquiz-error" className="field-error" role="status">{error}</p>
        <div className="editor-actions"><Button type="button" variant="ghost" onClick={onExit}>닫기</Button><Button type="submit" disabled={!!error || !card.title.trim()}>게임 저장</Button></div>
      </div>
      <aside className="preview-panel">
        <h2>{preview ? '게임 미리보기' : '위치 확인'}</h2>
        <Button type="button" variant="outline" size="sm" disabled={!!error} onClick={() => setPreview(!preview)}>{preview ? '위치 확인으로' : '게임으로 미리보기'}</Button>
        {preview && !error ? <MapQuizGame key={card.body} body={card.body} keyboardEnabled={false} /> : <WorldMap onPick={add} label="지역 위치 지도">
          {(px) => places.map((place) => <g key={place.id}>
            <Pin point={place} px={px * 0.8} className="answer" label={place.name} />
          </g>)}
        </WorldMap>}
        {!preview && <ul className="mapquiz-legend">{places.map((place) => <li key={place.id}>{place.name} <span className="muted">{place.lat}, {place.lon}</span></li>)}</ul>}
      </aside>
    </form>
  </main>
}
