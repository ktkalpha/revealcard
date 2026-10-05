import React from 'react'
import { Button } from './ui/button'
import ClassificationGame from './ClassificationGame'
import { classificationError, emptyClassification } from '../lib/classification'

export default function ClassificationEditor({ draft, deckName, onChange, onSave, onExit, autosaved }) {
  const { card } = draft
  let data
  try { data = JSON.parse(card.body) } catch { data = emptyClassification() }
  const error = classificationError(card.body)
  const commit = next => onChange({ ...card, kind: 'classification', body: JSON.stringify(next) })
  const update = (index, field, value) => commit({ ...data, items: data.items.map((item, i) => i === index ? { ...item, [field]: value } : item) })
  return <main id="main" className="passage-editor">
    <div className="section-heading"><div><p className="muted">{deckName} · 사진 분류 게임</p><h1>분류 게임 수정</h1></div><div className="library-actions"><Button variant="outline" onClick={onExit}>목록으로</Button><Button disabled={!!error || !card.title.trim() || card.body.length > 20000} onClick={onSave}>게임 저장</Button></div></div>
    <label className="passage-field">제목<input value={card.title} maxLength={200} onChange={e=>onChange({...card,title:e.target.value})}/></label>
    <p className="muted">{autosaved ? '임시 저장됨' : '작성 중'} · 사진 {data.items.length}개 · {data.categories.join(' / ')}</p>
    <div className="classification-editor-list">{data.items.map((item,index)=><section className="classification-editor-row" key={item.id}>
      <img src={item.image} alt={item.label || '분류 사진'} loading="lazy"/>
      <div><label className="passage-field">화석 이름<input value={item.label} maxLength={200} onChange={e=>update(index,'label',e.target.value)}/></label><label className="passage-field">정답 시대<select value={item.category} onChange={e=>update(index,'category',e.target.value)}>{data.categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="passage-field">해설<input value={item.explanation || ''} maxLength={1000} onChange={e=>update(index,'explanation',e.target.value)}/></label><label className="passage-field">사진 주소<input value={item.image} onChange={e=>update(index,'image',e.target.value)}/></label><Button variant="ghost" onClick={()=>commit({...data,items:data.items.filter((_,i)=>i!==index)})}>사진 삭제</Button></div>
    </section>)}</div>
    <Button variant="outline" disabled={data.items.length>=60} onClick={()=>commit({...data,items:[...data.items,{id:crypto.randomUUID(),label:'',image:'',category:data.categories[0],explanation:''}]})}>사진 추가</Button>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {!error&&<details className="classification-editor-preview"><summary>게임 미리보기</summary><ClassificationGame key={card.body} body={card.body}/></details>}
  </main>
}
