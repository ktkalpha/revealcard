import React from 'react'
import { Settings2 } from 'lucide-react'

const positions = { idle:'0% 0%',happy:'100% 0%',thinking:'0% 100%',celebrate:'100% 100%' }
const messages = { idle:'',happy:'잘했어!',thinking:'한 번 더 해보자!',celebrate:'학습 완료! 수고했어.' }
export function PetSprite({ pet, state = 'idle' }) {
  if(!pet.image && !pet.sheet) return null
  return pet.sheet
    ? <span className="custom-pet-sheet" style={{backgroundImage:`url(${pet.sheet})`,backgroundPosition:positions[state] || positions.idle}} />
    : <img className="custom-pet-image" src={pet.image} alt="" draggable="false" />
}
export default function StudyPet({ pet, reaction, onReact, onSettings }) {
  if(!pet.enabled || (!pet.image && !pet.sheet)) return null
  return <aside className={`floating-study-pet pet-side-${pet.side} pet-state-${reaction.state}`} style={{'--pet-size':`${pet.size}px`}} aria-label="학습 펫">
    <div className="pet-speech" role="status" aria-live="polite">{messages[reaction.state]}</div>
    <button key={reaction.serial} className="custom-pet-touch" onClick={()=>onReact('pat')} aria-label={`${pet.name} 쓰다듬기`}><PetSprite pet={pet} state={reaction.state} /></button>
    <div className="floating-pet-caption"><span>{pet.name}</span><button aria-label="학습 펫 설정" onClick={onSettings}><Settings2 size={13} /></button></div>
  </aside>
}
