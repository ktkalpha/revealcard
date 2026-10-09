import React, { useLayoutEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { petPositionAt, petPositionPixels } from '../lib/petPosition'
import { petExpression } from '../lib/pet'

const positions = { idle:'0% 0%',happy:'100% 0%',thinking:'0% 100%',celebrate:'100% 100%' }
const messages = { idle:'',known:'잘했어!',again:'한 번 더 해보자!',complete:'학습 완료! 수고했어.',pat:'헤헤, 좋아!' }
// `state` is a built-in sheet cell or the ID of one of the pet's own expressions.
export function PetSprite({ pet, state = 'idle' }) {
  const custom=pet.expressions?.find(item=>item.id===state)
  if(custom?.image) return <img className="custom-pet-image" src={custom.image} alt="" draggable="false" />
  if(!pet.image && !pet.sheet) return null
  return pet.sheet
    ? <span className="custom-pet-sheet" style={{backgroundImage:`url(${pet.sheet})`,backgroundPosition:positions[state] || positions.idle}} />
    : <img className="custom-pet-image" src={pet.image} alt="" draggable="false" />
}
// Pets without a saved position line up beside each other on their side of the screen.
export default function StudyPets({ pets, reaction, onReact, onSettings, onMove }) {
  const shown=pets.filter(pet=>pet.enabled && (pet.image || pet.sheet))
  const offsets={left:0,right:0}
  return shown.map(pet=> {
    const offset=pet.position?0:offsets[pet.side]++
    const event=reaction.petId && reaction.petId!==pet.id ? 'idle' : reaction.event
    return <StudyPet key={pet.id} pet={pet} offset={offset} reaction={{event,serial:reaction.serial}} onReact={event=>onReact(event,pet.id)} onSettings={()=>onSettings(pet.id)} onMove={position=>onMove(pet.id,position)} />
  })
}
function StudyPet({ pet, offset, reaction, onReact, onSettings, onMove }) {
  const root=useRef(null),drag=useRef(null),suppressClick=useRef(false)
  const [draft,setDraft]=useState(null)
  const [layout,setLayout]=useState({viewport:{width:0,height:0},box:{width:0,height:0}})
  const visible=pet.enabled && Boolean(pet.image || pet.sheet)
  useLayoutEffect(()=> {
    if(!visible){drag.current=null;setDraft(null);return}
    const measure=()=> {
      if(!root.current)return
      const rect=root.current.getBoundingClientRect()
      setLayout({viewport:{width:window.innerWidth,height:window.innerHeight},box:{width:rect.width,height:rect.height}})
    }
    measure()
    const observer=new ResizeObserver(measure)
    observer.observe(root.current)
    window.addEventListener('resize',measure)
    return()=>{observer.disconnect();window.removeEventListener('resize',measure)}
  },[visible])
  if(!visible)return null
  const placement=draft || pet.position
  const state=petExpression(reaction.event,pet.mapping)
  const style={'--pet-size':`${pet.size}px`,'--pet-offset':offset,...(placement?{...petPositionPixels(placement,layout.viewport,layout.box),right:'auto',bottom:'auto'}:{})}
  const start=e=> {
    if(!e.isPrimary || e.button!==0 || drag.current)return
    const rect=root.current.getBoundingClientRect()
    suppressClick.current=false
    drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,position:null}
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move=e=> {
    const active=drag.current
    if(!active || active.id!==e.pointerId)return
    if(!active.position && Math.hypot(e.clientX-active.x,e.clientY-active.y)<5)return
    const rect=root.current.getBoundingClientRect()
    active.position=petPositionAt(e.clientX-active.offsetX,e.clientY-active.offsetY,{width:window.innerWidth,height:window.innerHeight},{width:rect.width,height:rect.height})
    suppressClick.current=true
    setDraft(active.position)
  }
  const end=(e,cancel=false)=> {
    const active=drag.current
    if(!active || active.id!==e.pointerId)return
    drag.current=null
    if(!cancel && active.position)onMove(active.position)
    setDraft(null)
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const keyboard=e=> {
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key]
    if(!direction)return
    e.preventDefault();e.stopPropagation()
    const rect=root.current.getBoundingClientRect(),step=e.shiftKey?40:10
    onMove(petPositionAt(rect.left+direction[0]*step,rect.top+direction[1]*step,{width:window.innerWidth,height:window.innerHeight},{width:rect.width,height:rect.height}))
  }
  return <aside ref={root} className={`floating-study-pet pet-side-${pet.side} pet-event-${reaction.event}${draft?' pet-dragging':''}`} style={style} aria-label={`학습 펫 ${pet.name}`}>
    <div className="pet-speech" role="status" aria-live="polite">{messages[reaction.event]}</div>
    <button className="custom-pet-touch" onPointerDown={start} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={e=>end(e,true)} onKeyDown={keyboard} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return}onReact('pat')}} title="드래그 또는 방향키로 이동 · 누르면 쓰다듬기" aria-label={`${pet.name} 쓰다듬기`}><span key={reaction.serial} className="custom-pet-motion"><PetSprite pet={pet} state={state} /></span></button>
    <div className="floating-pet-caption"><span>{pet.name}</span><button aria-label={`${pet.name} 설정`} onClick={onSettings}><Settings2 size={13} /></button></div>
  </aside>
}
