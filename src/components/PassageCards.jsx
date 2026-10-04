import React, { useState } from 'react'
import Modal from './Modal'
import MaskedText from './MaskedText'
import { Button } from './ui/button'
import { masksIn } from '../lib/masks'
export default function PassageCards({ highlight, onClose }) {
 const [index,setIndex]=useState(0),[revealed,setRevealed]=useState(new Set())
 const card=highlight.cards[index]
 const move=(i)=>{setIndex(i);setRevealed(new Set())}
 return <Modal title="본문 연결 카드" onClose={onClose} wide><article className="passage-popup-card"><p className="muted">{index+1} / {highlight.cards.length}</p><h2>{card.title}</h2><MaskedText body={card.body} revealed={revealed} onToggle={id=>setRevealed(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next})}/><Button variant="outline" onClick={()=>setRevealed(revealed.size ? new Set() : new Set(masksIn(card.body).map(m=>m.id)))}>{revealed.size ? '다시 가리기' : '모두 보기'}</Button></article><div className="modal-actions"><Button variant="outline" disabled={!index} onClick={()=>move(index-1)}>이전 카드</Button><Button variant="outline" disabled={index===highlight.cards.length-1} onClick={()=>move(index+1)}>다음 카드</Button><Button onClick={onClose}>본문으로</Button></div></Modal>
}
