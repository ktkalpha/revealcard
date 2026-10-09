import React from 'react'
import { Button } from './ui/button'
import { matchingError } from '../lib/matching'
import MatchingGame from './MatchingGame'

export default function MatchingEditor({ draft, deckName, onChange, onSave, onExit, autosaved }) {
  const { card } = draft
  const error = matchingError(card.body)
  return <main id="main" className="editor-page">
    <div className="editor-top"><Button variant="ghost" onClick={onExit}>← 돌아가기</Button>
      <span className="save-state">{autosaved}</span></div>
    <div className="section-heading"><div><p className="overline">{deckName}</p><h1>스페셜 매칭 게임 수정</h1></div></div>
    <form className="editor-layout" onSubmit={(e) => { e.preventDefault(); if (!error && card.title.trim()) onSave() }}>
      <div className="editor-panel">
        <label htmlFor="matching-title">제목</label>
        <input id="matching-title" value={card.title} maxLength={200} required onChange={(e) => onChange({ ...card, title: e.target.value })} />
        <label htmlFor="matching-body">인물과 업적</label>
        <p id="matching-help" className="field-hint">한 줄에 한 쌍씩 ‘이름 | 업적’으로 작성하세요. 2~20쌍을 넣을 수 있어요.</p>
        <textarea id="matching-body" value={card.body} rows={12} maxLength={20000} required aria-describedby="matching-help matching-error" aria-invalid={!!error} onChange={(e) => onChange({ ...card, body: e.target.value })} />
        <p id="matching-error" className="field-error" role="status">{error}</p>
        <div className="editor-actions"><Button type="button" variant="ghost" onClick={onExit}>닫기</Button><Button type="submit" disabled={!!error || !card.title.trim()}>게임 저장</Button></div>
      </div>
      <aside className="preview-panel"><h2>게임 미리보기</h2>{!error && <MatchingGame key={card.body} body={card.body} />}</aside>
    </form>
  </main>
}
