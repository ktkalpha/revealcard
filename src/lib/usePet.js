import { useEffect, useRef, useState } from 'react'
import { api } from './api'

export default function usePet(owner) {
  const [snapshot,setSnapshot] = useState(null)
  const [error,setError] = useState('')
  // petId limits a reaction (a pat) to one pet; study events reach every displayed pet.
  const [reaction,setReaction] = useState({event:'idle',petId:null,serial:0})
  const current = useRef(null), chain = useRef(Promise.resolve()), pending = useRef(0), generation = useRef(0)
  const pets = snapshot?.owner === owner ? snapshot.pets : []
  useEffect(()=> {
    const epoch=++generation.current
    let active=true
    current.current=null;pending.current=0;chain.current=Promise.resolve()
    setSnapshot(null);setError('');setReaction({event:'idle',petId:null,serial:0})
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
    if(reaction.event==='idle')return
    const timer=setTimeout(()=>setReaction(prev=>({...prev,event:'idle',petId:null})),3500)
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
  function update(id,action) {
    const pet=current.current?.pets.find(item=>item.id===id)
    if(!owner || !pet)return
    const next=action(pet)
    current.current={...current.current,pets:current.current.pets.map(item=>item.id===id?next:item)}
    setSnapshot({owner,...current.current})
    const {enabled,name,description,size,side,position,mapping}=next
    mutate(()=>api(`/api/pet/${id}`,{method:'PUT',body:{enabled,name,description,size,side,position,mapping}})).catch(()=>{})
  }
  const create=name=>mutate(()=>api('/api/pet',{method:'POST',body:{name}}))
  const remove=id=>mutate(()=>api(`/api/pet/${id}`,{method:'DELETE'}))
  const upload=(id,image)=>mutate(()=>api(`/api/pet/${id}/reference`,{method:'POST',body:{image}}))
  const generate=id=>mutate(()=>api(`/api/pet/${id}/generate`,{method:'POST',body:{confirmed:true}}))
  const cancel=jobId=>mutate(()=>api('/api/pet/cancel',{method:'POST',body:{jobId}}))
  const addExpression=(id,expression)=>mutate(()=>api(`/api/pet/${id}/expressions`,{method:'POST',body:expression}))
  const regenerateExpression=(id,expressionId)=>mutate(()=>api(`/api/pet/${id}/expressions/${expressionId}/generate`,{method:'POST',body:{}}))
  const removeExpression=(id,expressionId)=>mutate(()=>api(`/api/pet/${id}/expressions/${expressionId}`,{method:'DELETE'}))
  const react=(event,petId=null)=>{if(pets.some(pet=>pet.enabled))setReaction(prev=>({event,petId,serial:prev.serial+1}))}
  const ready=snapshot?.owner===owner
  return {pets,reaction,error,ready,workerOnline:ready&&snapshot.workerOnline,limits:ready?snapshot.limits:{pets:5,expressions:12},update,create,remove,upload,generate,cancel,addExpression,regenerateExpression,removeExpression,react}
}
