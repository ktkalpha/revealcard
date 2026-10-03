import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { newPet, petExpression } from './pet'

export default function usePet(owner) {
  const [snapshot,setSnapshot] = useState(null)
  const [error,setError] = useState('')
  const [reaction,setReaction] = useState({state:'idle',serial:0})
  const current = useRef(null), chain = useRef(Promise.resolve()), pending = useRef(0), generation = useRef(0)
  const pet = snapshot?.owner === owner ? snapshot.pet : newPet()
  useEffect(()=> {
    const epoch=++generation.current
    let active=true
    current.current=null;pending.current=0;chain.current=Promise.resolve()
    setSnapshot(null);setError('');setReaction({state:'idle',serial:0})
    if(!owner)return
    const refresh=async()=> {
      if(pending.current)return
      try {
        const result=await api('/api/pet')
        if(active && generation.current===epoch && !pending.current){current.current=result;setSnapshot({owner,...result});setError('')}
      }catch(err){if(active)setError(err.message)}
    }
    refresh()
    const timer=setInterval(refresh,5000)
    return()=>{active=false;clearInterval(timer)}
  },[owner])
  useEffect(()=> {
    if(reaction.state==='idle')return
    const timer=setTimeout(()=>setReaction(prev=>({...prev,state:'idle'})),3500)
    return()=>clearTimeout(timer)
  },[reaction])
  function mutate(operation) {
    const epoch=generation.current
    pending.current++
    const task=chain.current.catch(()=>{}).then(()=> {
      if(epoch!==generation.current) return null
      return operation()
    }).then(result=> {
      if(result && epoch===generation.current && pending.current===1){current.current=result;setSnapshot({owner,...result});setError('')}
      return result
    }).catch(err=>{if(epoch===generation.current)setError(err.message);throw err}).finally(()=>{if(epoch===generation.current)pending.current--})
    chain.current=task.catch(()=>{})
    return task
  }
  function update(action) {
    if(!owner || !current.current)return
    const next=action(current.current.pet)
    current.current={...current.current,pet:next}
    setSnapshot({owner,...current.current})
    const {enabled,name,size,side,position}=next
    mutate(()=>api('/api/pet',{method:'PUT',body:{enabled,name,size,side,position}})).catch(()=>{})
  }
  const upload=image=> {
    const epoch=generation.current
    return mutate(async()=> {
    const result=await api('/api/pet/reference',{method:'POST',body:{image}})
    if(epoch===generation.current) {current.current=result;setSnapshot({owner,...result})}
    if(epoch!==generation.current)return null
    return api('/api/pet/generate',{method:'POST'})
    })
  }
  const generate=()=>mutate(()=>api('/api/pet/generate',{method:'POST'}))
  const react=event=>{if(pet.enabled)setReaction(prev=>({state:petExpression(event),serial:prev.serial+1}))}
  return {pet,reaction,error,ready:snapshot?.owner===owner,job:snapshot?.owner===owner?snapshot.job:null,workerOnline:snapshot?.owner===owner&&snapshot.workerOnline,update,upload,generate,react}
}
