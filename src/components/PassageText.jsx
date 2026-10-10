import React from 'react'
import MaskedText from './MaskedText'
import { masksIn, parseBody } from '../lib/masks'
export default function PassageText({ card, revealed, onToggle, onHighlight, focusIds, wrongIds, onMarkWrong, activeId }) {
  const highlights=[...(card.highlights || [])].sort((a,b)=>a.start-b.start)
  const masks=masksIn(card.body)
  const pieces=[];let cursor=0
  const fragment=(start,end,key)=> <React.Fragment key={key}>{parseBody(card.body.slice(start,end)).map((part,i)=>part.id === undefined ? <React.Fragment key={i}>{part.text}</React.Fragment> : <MaskedText key={i} body={`[[${part.text}]]`} align="left" revealed={revealed} onToggle={onToggle} focusIds={focusIds} wrongIds={wrongIds} onMarkWrong={onMarkWrong} activeId={activeId} maskParts={[masks.find(m=>m.start===start+part.start) || {...part,id:String(start+part.start)}]} maskOrdinalStart={masks.filter(m=>m.start<start+part.start).length}/>)}</React.Fragment>
  for(const h of highlights) {
    if(h.start>cursor) pieces.push(fragment(cursor,h.start,`text-${cursor}`))
    pieces.push(<span className="passage-highlight" key={h.id} onClick={e=>{if(!e.target.closest("button,a"))onHighlight(h)}}>{fragment(h.start,h.end,h.id)}<button className="passage-card-link" onClick={()=>onHighlight(h)} aria-label={`${h.cards[0]?.title || '연결'} 카드 열기`}>카드 {h.cards.length} ↗</button></span>)
    cursor=h.end
  }
  if(cursor<card.body.length) pieces.push(fragment(cursor,card.body.length,`text-${cursor}`))
  return <div className="passage-text">{pieces}</div>
}
