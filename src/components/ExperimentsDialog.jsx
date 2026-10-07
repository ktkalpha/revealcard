import React, { useRef, useState } from 'react'
import { ImagePlus, Upload, Smile, LoaderCircle } from 'lucide-react'
import Modal from './Modal'
import { Button } from './ui/button'
import { PetSprite } from './StudyPet'
import { petName, PET_STATES } from '../lib/pet'
import { readPetFile } from '../lib/petStorage'

const labels = ['평소','정답 · 웃음','오답 · 응원','학습 완료']
export default function ExperimentsDialog({user,ready,onLogin,pet,onUpdate,onUpload,onGenerate,onCancel,job,workerOnline,error:serverError,onClose}) {
  const reference=useRef(null)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[previewState,setPreviewState]=useState('idle'),[regenerate,setRegenerate]=useState(false),[submitting,setSubmitting]=useState(false),[cancelling,setCancelling]=useState(false)
  const generating=['queued','running'].includes(job?.status)
  const upload=async e=> {
    const file=e.target.files?.[0];e.target.value='';if(!file)return
    setBusy(true);setError('')
    try {const image=await readPetFile(file);await onUpload(image.data);setRegenerate(false)}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  const complete=async()=>{
    if(busy || submitting || generating)return
    if(!pet.image || (pet.sheet && !regenerate)){onClose();return}
    setSubmitting(true);setError('')
    try{await onGenerate();setRegenerate(false)}catch(err){setError(err.message)}finally{setSubmitting(false)}
  }
  const cancel=async()=>{if(cancelling)return;setCancelling(true);setError('');try{await onCancel(job.id)}catch(err){setError(err.message)}finally{setCancelling(false)}}
  if(!user)return <Modal title="실험실 · 커스텀 펫" onClose={onClose}><p className="modal-description">커스텀 펫은 로그인한 사용자 전용 기능이에요. 로그인하면 내 이미지로 학습 친구를 만들 수 있어요.</p><div className="modal-actions"><Button onClick={onLogin}>로그인하기</Button></div></Modal>
  if(!ready)return <Modal title="실험실 · 커스텀 펫" onClose={onClose}><p role="status">나의 펫을 불러오는 중…</p>{serverError && <p role="alert">{serverError}</p>}</Modal>
  return <Modal title="실험실 · 커스텀 펫" onClose={onClose}>
    <p className="modal-description">이미지를 고르고 완료를 누르면 Codex가 표정 4가지를 만들어 줘요. 학습 내내 곁에 있다가 맞추면 웃고, 헷갈리면 응원해요.</p>
    <div className="custom-pet-builder">
      <label className="custom-pet-toggle"><span><strong>학습 화면에 펫 표시</strong><small>캐릭터를 드래그해 원하는 곳으로 옮겨요</small></span><input type="checkbox" checked={pet.enabled} disabled={!pet.image && !pet.sheet} onChange={e=>onUpdate(prev=>({...prev,enabled:e.target.checked}))}/></label>
      <div className="custom-pet-upload"><div className="custom-pet-preview">{pet.image || pet.sheet ? <PetSprite pet={pet} state={previewState}/> : <ImagePlus size={32} strokeWidth={1.3}/>}</div><div><strong>나의 캐릭터</strong><p>사진·그림·마스코트 모두 좋아요.<br/>투명 배경 PNG를 권장해요.</p><Button variant="outline" size="sm" disabled={busy || submitting || generating} onClick={()=>reference.current.click()}><Upload size={14}/> 이미지 선택</Button></div></div>
      <input ref={reference} type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label="펫 원본 이미지" onChange={upload}/>
      <div className="custom-pet-variations"><strong>Codex가 만드는 표정</strong><p>이미지를 선택한 뒤 아래 완료를 눌러야 생성이 시작돼요. 시작한 뒤에는 창을 닫아도 작업이 계속돼요.</p>
        <p role="status" className="pet-builder-note">{job?.status==='running'?'Codex가 표정 4가지를 만들고 있어요…':job?.status==='queued'?(workerOnline?'생성 대기 중이에요…':'표정 생성 연결을 기다리는 중이에요…'):job?.status==='cancelled'?'표정 생성 작업을 취소했어요. 완료를 누르면 다시 시작해요.':job?.status==='done'?'표정이 완성됐어요!':pet.image?'완료를 누르면 표정 생성을 시작해요.':'먼저 캐릭터 이미지를 선택해 주세요.'}</p>
        {job?.status==='failed' && <p role="alert" className="pet-builder-error">{job.error}</p>}
        <div className="pet-expression-previews">{PET_STATES.map((state,index)=><button key={state} aria-pressed={previewState===state} aria-label={`${labels[index]} 표정 미리보기`} onClick={()=>setPreviewState(state)}><span>{pet.sheet ? <PetSprite pet={pet} state={state}/> : <span className="expression-placeholder">{['◉','☺','?','✦'][index]}</span>}</span><small>{labels[index]}</small></button>)}</div>
        {!pet.sheet && pet.image && <p className="pet-builder-note">표정이 완성되기 전에는 원본 이미지가 학습 화면에 표시돼요.</p>}
        {pet.image && pet.sheet && !generating && <div className="pet-builder-actions"><Button variant="outline" size="sm" disabled={busy || submitting} aria-pressed={regenerate} onClick={()=>setRegenerate(prev=>!prev)}><Smile size={14}/>{regenerate?'다시 만들기 선택 해제':'표정 다시 만들기 선택'}</Button></div>}
      </div>
      <div className="pet-display-settings"><label>이름<input aria-label="펫 이름" value={pet.name} maxLength={16} onChange={e=>onUpdate(prev=>({...prev,name:e.target.value}))} onBlur={()=>onUpdate(prev=>({...prev,name:petName(prev.name)}))}/></label><label>크기<select aria-label="펫 크기" value={pet.size} onChange={e=>onUpdate(prev=>({...prev,size:Number(e.target.value)}))}><option value={80}>작게</option><option value={112}>보통</option><option value={144}>크게</option></select></label><label>위치<select aria-label="펫 위치" value={pet.position?'custom':pet.side} onChange={e=>onUpdate(prev=>({...prev,side:e.target.value,position:null}))}>{pet.position && <option value="custom">직접 이동</option>}<option value="right">오른쪽</option><option value="left">왼쪽</option></select></label></div>
    </div>
    {busy && <p role="status">이미지를 저장하는 중…</p>}{(error || serverError) && <p role="alert" className="pet-builder-error">{error || serverError}</p>}
    <p className="experiment-note">내 계정에 저장돼요. 완성된 표정은 자동으로 적용돼요.</p>
    <div className="modal-actions"><Button disabled={busy || submitting || generating} onClick={complete}>완료</Button></div>
    {(submitting || generating) && <div className="pet-generation-progress" role="status" aria-live="polite"><LoaderCircle size={18} className="pet-generation-spinner" aria-hidden="true"/><span>{cancelling?'작업을 취소하고 있어요…':submitting?'표정 생성 작업을 요청하고 있어요…':job?.status==='running'?'Codex가 표정 4가지를 만들고 있어요…':workerOnline?'표정 생성 작업 대기 중이에요…':'서버의 Codex 연결을 기다리는 중이에요…'}</span>{generating && <Button variant="outline" size="sm" disabled={cancelling} onClick={cancel}>작업 취소</Button>}</div>}
    {regenerate && !generating && <p className="pet-builder-note">완료를 누르면 표정을 다시 만들어요.</p>}
  </Modal>
}
