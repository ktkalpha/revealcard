import React, { useRef, useState } from 'react'
import { Button } from './ui/button'
import Modal from './Modal'
import ImageDialog from './ImageDialog'
import PassageText from './PassageText'
import { bodyError, maskSelection, plainText } from '../lib/masks'
import { passageError, rebaseHighlights } from '../lib/passage'
export default function PassageEditor({draft,deckName,onChange,onSave,onExit,autosaved}) {
 const {card}=draft, input=useRef(null), selection=useRef({start:0,end:0})
 const [error,setError]=useState(''),[adding,setAdding]=useState(false),[editing,setEditing]=useState(null),[revealed,setRevealed]=useState(new Set())
 const highlights=card.highlights || []
 const changeBody=body=>{
   const next=rebaseHighlights(highlights,card.body,body)
   if(next.length<highlights.length) setError('수정한 부분과 겹친 하이라이트를 제거했어요. 다시 선택해 추가해 주세요.')
   else setError('')
   onChange({...card,body,highlights:next})
 }
 const remember=()=>{if(input.current)selection.current={start:input.current.selectionStart,end:input.current.selectionEnd}}
 const add=()=>{
  const {start,end}=selection.current
  if(start===end || !card.body.slice(start,end).trim())return setError('본문에서 하이라이트할 부분을 먼저 선택해 주세요.')
  if(highlights.length>=100)return setError('하이라이트는 최대 100개까지 만들 수 있어요.')
  if(highlights.some(h=>h.start<end && h.end>start))return setError('기존 하이라이트와 겹쳐요. 아래 목록에서 수정해 주세요.')
  setError('')
  setEditing({id:crypto.randomUUID(),start,end,cards:[{title:plainText(card.body.slice(start,end)).slice(0,200),body:''}]})
 }
 const insertImage=markdown=>{
   const {start,end}=selection.current,before=card.body.slice(0,start),after=card.body.slice(end)
   const text=`${before&&!before.endsWith('\n')?'\n\n':''}${markdown}${after&&!after.startsWith('\n')?'\n\n':''}`
   changeBody(before+text+after);setAdding(false)
   requestAnimationFrame(()=>{const caret=start+text.length;input.current?.focus();input.current?.setSelectionRange(caret,caret);remember()})
 }
 const mask=()=>{try{
   const {start,end}=selection.current,next=maskSelection(card.body,start,end)
   // Wrapping a selected highlight keeps its entire range around the new mask.
   let adjusted=rebaseHighlights(highlights,card.body,next.body)
   adjusted=adjusted.filter(h=>!highlights.some(old=>old.id===h.id && old.start===start && old.end===end))
   adjusted.push(...highlights.filter(h=>h.start===start && h.end===end).map(h=>({...h,start:next.start,end:next.end})))
   const invalid=passageError({...card,body:next.body,highlights:adjusted})
   if(invalid) return setError(invalid)
   onChange({...card,body:next.body,highlights:adjusted});setError('')
   requestAnimationFrame(()=>{input.current.focus();input.current.setSelectionRange(next.start,next.end);remember()})
  }catch(e){setError(e.message)}}
 const validation=bodyError(card.body)||passageError(card)
 const updateCard=(i,field,value)=>setEditing({...editing,cards:editing.cards.map((c,n)=>n===i?{...c,[field]:value}:c)})
 const saveHighlight=()=>{
  const next=[...highlights.filter(h=>h.id!==editing.id),editing].sort((a,b)=>a.start-b.start)
  const message=passageError({...card,highlights:next})
  if(message)return setError(message)
  onChange({...card,highlights:next});setEditing(null);setError('')
 }
 return <main id="main" className="passage-editor"><div className="section-heading"><div><p className="muted">{deckName} · 본문</p><h1>본문 정리하기</h1></div><div className="library-actions"><Button variant="outline" onClick={onExit}>목록으로</Button><Button disabled={!card.title.trim() || !card.body.trim() || card.body.length>20000 || !!validation} onClick={onSave}>본문 저장</Button></div></div><label className="passage-field">제목<input maxLength={200} value={card.title} onChange={e=>onChange({...card,title:e.target.value})} placeholder="예: 용비어천가 — 작품 정리"/></label><p className="muted">본문을 입력하고 글자를 선택하세요. 하이라이트에는 카드를 넣고, 가릴 부분에는 [[정답]]을 사용할 수 있어요.</p><div className="passage-tools"><Button variant="outline" onClick={add}>선택 부분 하이라이트 + 카드</Button><Button variant="outline" onClick={mask}>선택 부분 가리기 / 해제</Button><Button variant="outline" onClick={()=>setAdding(true)}>사진 추가</Button><small className="muted">{autosaved ? '임시 저장됨' : '작성 중'}</small></div><div className="passage-editor-columns"><label className="passage-field">본문<textarea ref={input} value={card.body} maxLength={20000} onChange={e=>changeBody(e.target.value)} onSelect={remember} onKeyUp={remember} onMouseUp={remember} placeholder="사진에 있는 내용을 이곳에서 정리하세요."/></label><section className="passage-preview"><h2>미리보기</h2><PassageText card={card} revealed={revealed} onToggle={id=>setRevealed(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next})} onHighlight={h=>setEditing(structuredClone(h))}/></section></div>{(error||validation)&&<p role="alert" className="form-error">{error||validation}</p>}<section className="passage-highlight-list"><h2>하이라이트 {highlights.length}개</h2>{highlights.map(h=><div key={h.id}><button onClick={()=>{setEditing(structuredClone(h));setError('')}}>{plainText(card.body.slice(h.start,h.end))} <small>· 카드 {h.cards.length}장</small></button><Button variant="ghost" onClick={()=>onChange({...card,highlights:highlights.filter(x=>x.id!==h.id)})}>삭제</Button></div>)}</section>{adding&&<ImageDialog onClose={()=>setAdding(false)} onInsert={insertImage}/>}{editing&&<Modal title="하이라이트 카드 만들기" onClose={()=>{setEditing(null);setError('')}} wide><p className="passage-selected">{plainText(card.body.slice(editing.start,editing.end))}</p><p className="muted">카드 내용에서도 [[정답]]으로 가릴 수 있어요.</p>{editing.cards.map((c,i)=><div key={i} className="passage-linked-editor"><label className="passage-field">카드 {i+1} 제목<input value={c.title} maxLength={200} onChange={e=>updateCard(i,'title',e.target.value)}/></label><label className="passage-field">카드 내용<textarea value={c.body} maxLength={20000} onChange={e=>updateCard(i,'body',e.target.value)} placeholder="예: 용비어천가의 주제는 [[조선 건국의 정당성]]이다."/></label>{editing.cards.length>1&&<Button variant="ghost" onClick={()=>setEditing({...editing,cards:editing.cards.filter((_,n)=>n!==i)})}>이 카드 삭제</Button>}</div>)}{error&&<p role="alert" className="form-error">{error}</p>}<div className="modal-actions"><Button variant="outline" disabled={editing.cards.length>=20} onClick={()=>setEditing({...editing,cards:[...editing.cards,{title:'',body:''}]})}>카드 한 장 추가</Button><Button onClick={saveHighlight}>하이라이트 저장</Button></div></Modal>}</main>
}
