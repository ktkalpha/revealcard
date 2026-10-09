import React, { useEffect, useRef, useState } from 'react'
import { ImagePlus, Upload, Smile, LoaderCircle, Plus, Trash2, RotateCcw, Sparkles, X } from 'lucide-react'
import Modal from './Modal'
import { Button } from './ui/button'
import { PetSprite } from './StudyPet'
import { petName, petDescription, PET_STATES, PET_STATE_LABELS, PET_EVENTS, PET_EVENT_LABELS } from '../lib/pet'
import { readPetFile } from '../lib/petStorage'

const labels = ['평소','정답 · 웃음','오답 · 응원','학습 완료']
const generating = job => ['queued','running'].includes(job?.status)
const jobLabel = (job, workerOnline) => job?.status==='running' ? 'Codex가 만드는 중…' : job?.status==='queued' ? (workerOnline ? '생성 대기 중…' : '생성 연결 대기 중…') : job?.status==='failed' ? '생성 실패' : job?.status==='cancelled' ? '취소됨' : ''

export default function ExperimentsDialog({ user, onLogin, companion, initialPetId, onClose }) {
  const { pets, ready, error: serverError, workerOnline, limits } = companion
  const [selected, setSelected] = useState(initialPetId || null)
  const [creating, setCreating] = useState(false), [error, setError] = useState('')
  const pet = pets.find(item => item.id === selected) || pets[0]
  useEffect(() => { if (pet && pet.id !== selected) setSelected(pet.id) }, [pet?.id])
  const create = async () => {
    if (creating) return
    setCreating(true); setError('')
    try { const result = await companion.create(`펫 ${pets.length + 1}`); if (result?.created) setSelected(result.created) } catch (err) { setError(err.message) } finally { setCreating(false) }
  }
  if(!user)return <Modal title="실험실 · 커스텀 펫" onClose={onClose}><p className="modal-description">커스텀 펫은 로그인한 사용자 전용 기능이에요. 로그인하면 내 이미지로 학습 친구를 만들 수 있어요.</p><div className="modal-actions"><Button onClick={onLogin}>로그인하기</Button></div></Modal>
  if(!ready)return <Modal title="실험실 · 커스텀 펫" onClose={onClose}><p role="status">나의 펫을 불러오는 중…</p>{serverError && <p role="alert">{serverError}</p>}</Modal>
  return <Modal title="실험실 · 커스텀 펫" onClose={onClose}>
    <p className="modal-description">이미지를 고르고 완료를 누르면 Codex가 표정 4가지를 만들어 줘요. 원하는 표정을 더 만들고, 상황마다 어떤 표정을 보일지 정할 수 있어요.</p>
    <div className="pet-tabs" role="tablist" aria-label="나의 펫">
      {pets.map(item => <button key={item.id} role="tab" aria-selected={item.id === pet?.id} onClick={() => setSelected(item.id)}>
        <span className="pet-tab-thumb">{item.image || item.sheet ? <PetSprite pet={item} /> : <ImagePlus size={14} />}</span>
        <span className="pet-tab-name">{item.name}</span>{item.enabled && <span className="pet-tab-on" aria-label="표시 중" />}
      </button>)}
      <Button variant="outline" size="sm" disabled={creating || pets.length >= limits.pets} onClick={create} title={pets.length >= limits.pets ? `펫은 최대 ${limits.pets}마리까지 만들 수 있어요.` : undefined}><Plus size={14} /> 펫 추가</Button>
    </div>
    {error && <p role="alert" className="pet-builder-error">{error}</p>}
    {pet ? <PetEditor key={pet.id} pet={pet} companion={companion} workerOnline={workerOnline} limits={limits} serverError={serverError} onClose={onClose} />
      : <div className="pet-empty"><p>아직 펫이 없어요. 펫을 추가해 학습 친구를 만들어 보세요.</p><Button disabled={creating} onClick={create}><Plus size={14} /> 첫 펫 만들기</Button></div>}
  </Modal>
}

function PetEditor({ pet, companion, workerOnline, limits, serverError, onClose }) {
  const reference = useRef(null)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[previewState,setPreviewState]=useState('idle'),[regenerate,setRegenerate]=useState(false),[submitting,setSubmitting]=useState(false),[cancelling,setCancelling]=useState(false)
  const job = pet.job, sheetGenerating = generating(job)
  // Saved on blur: the server trims the text, which would swallow spaces while typing.
  const [description,setDescription]=useState(pet.description)
  const saveDescription=()=>{const next=petDescription(description);setDescription(next);if(next!==pet.description)update(prev=>({...prev,description:next}))}
  const update = action => companion.update(pet.id, action)
  const attempt = async (operation) => { setError(''); try { return await operation() } catch (err) { setError(err.message) } }
  const upload=async e=> {
    const file=e.target.files?.[0];e.target.value='';if(!file)return
    setBusy(true);setError('')
    try {const image=await readPetFile(file);await companion.upload(pet.id,image.data);setRegenerate(false)}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  const complete=async()=>{
    if(busy || submitting || sheetGenerating)return
    if(!pet.image || (pet.sheet && !regenerate)){onClose();return}
    setSubmitting(true);setError('')
    try{await companion.generate(pet.id);setRegenerate(false)}catch(err){setError(err.message)}finally{setSubmitting(false)}
  }
  const cancel=async()=>{if(cancelling)return;setCancelling(true);await attempt(()=>companion.cancel(job.id));setCancelling(false)}
  const remove=()=>{if(window.confirm(`‘${pet.name}’ 펫을 삭제할까요? 만든 표정도 함께 사라져요.`))attempt(()=>companion.remove(pet.id))}
  return <div className="custom-pet-builder">
    <label className="custom-pet-toggle"><span><strong>학습 화면에 펫 표시</strong><small>여러 펫을 함께 표시할 수 있어요. 캐릭터를 드래그해 원하는 곳으로 옮겨요</small></span><input type="checkbox" checked={pet.enabled} disabled={!pet.image && !pet.sheet} onChange={e=>update(prev=>({...prev,enabled:e.target.checked}))}/></label>
    <div className="custom-pet-upload"><div className="custom-pet-preview">{pet.image || pet.sheet ? <PetSprite pet={pet} state={previewState}/> : <ImagePlus size={32} strokeWidth={1.3}/>}</div><div><strong>나의 캐릭터</strong><p>사진·그림·마스코트 모두 좋아요.<br/>투명 배경 PNG를 권장해요.</p><Button variant="outline" size="sm" disabled={busy || submitting || sheetGenerating} onClick={()=>reference.current.click()}><Upload size={14}/> 이미지 선택</Button></div></div>
    <input ref={reference} type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label="펫 원본 이미지" onChange={upload}/>
    <label className="pet-description"><span><strong>캐릭터 설명</strong><small>선택 · 300자까지. 표정을 만들 때 Codex에게 함께 전달돼요.</small></span>
      <textarea aria-label="캐릭터 설명" rows={3} maxLength={300} placeholder="예: 파란 목도리를 한 통통한 고양이, 수채화 느낌, 눈이 크고 귀엽게" value={description} onChange={e=>setDescription(e.target.value)} onBlur={saveDescription}/></label>
    <div className="custom-pet-variations"><strong>Codex가 만드는 기본 표정</strong><p>이미지를 선택한 뒤 아래 완료를 눌러야 생성이 시작돼요. 시작한 뒤에는 창을 닫아도 작업이 계속돼요.</p>
      <p role="status" className="pet-builder-note">{job?.status==='running'?'Codex가 표정 4가지를 만들고 있어요…':job?.status==='queued'?(workerOnline?'생성 대기 중이에요…':'표정 생성 연결을 기다리는 중이에요…'):job?.status==='cancelled'?'표정 생성 작업을 취소했어요. 완료를 누르면 다시 시작해요.':job?.status==='done'?'표정이 완성됐어요!':pet.image?'완료를 누르면 표정 생성을 시작해요.':'먼저 캐릭터 이미지를 선택해 주세요.'}</p>
      {job?.status==='failed' && <p role="alert" className="pet-builder-error">{job.error}</p>}
      <div className="pet-expression-previews">{PET_STATES.map((state,index)=><button key={state} aria-pressed={previewState===state} aria-label={`${labels[index]} 표정 미리보기`} onClick={()=>setPreviewState(state)}><span>{pet.sheet ? <PetSprite pet={pet} state={state}/> : <span className="expression-placeholder">{['◉','☺','?','✦'][index]}</span>}</span><small>{labels[index]}</small></button>)}</div>
      {!pet.sheet && pet.image && <p className="pet-builder-note">표정이 완성되기 전에는 원본 이미지가 학습 화면에 표시돼요.</p>}
      {pet.image && pet.sheet && !sheetGenerating && <div className="pet-builder-actions"><Button variant="outline" size="sm" disabled={busy || submitting} aria-pressed={regenerate} onClick={()=>setRegenerate(prev=>!prev)}><Smile size={14}/>{regenerate?'다시 만들기 선택 해제':'표정 다시 만들기 선택'}</Button></div>}
    </div>
    <CustomExpressions pet={pet} companion={companion} workerOnline={workerOnline} limit={limits.expressions} previewState={previewState} onPreview={setPreviewState} />
    <ExpressionMapping pet={pet} onChange={mapping=>update(prev=>({...prev,mapping}))} />
    <div className="pet-display-settings"><label>이름<input aria-label="펫 이름" value={pet.name} maxLength={16} onChange={e=>update(prev=>({...prev,name:e.target.value}))} onBlur={()=>update(prev=>({...prev,name:petName(prev.name)}))}/></label><label>크기<select aria-label="펫 크기" value={pet.size} onChange={e=>update(prev=>({...prev,size:Number(e.target.value)}))}><option value={80}>작게</option><option value={112}>보통</option><option value={144}>크게</option></select></label><label>위치<select aria-label="펫 위치" value={pet.position?'custom':pet.side} onChange={e=>update(prev=>({...prev,side:e.target.value,position:null}))}>{pet.position && <option value="custom">직접 이동</option>}<option value="right">오른쪽</option><option value="left">왼쪽</option></select></label></div>
    {busy && <p role="status">이미지를 저장하는 중…</p>}{(error || serverError) && <p role="alert" className="pet-builder-error">{error || serverError}</p>}
    <p className="experiment-note">내 계정에 저장돼요. 완성된 표정은 자동으로 적용돼요.</p>
    <div className="modal-actions pet-editor-actions"><Button variant="outline" onClick={remove}><Trash2 size={14}/> 펫 삭제</Button><Button disabled={busy || submitting || sheetGenerating} onClick={complete}>완료</Button></div>
    {(submitting || sheetGenerating) && <div className="pet-generation-progress" role="status" aria-live="polite"><LoaderCircle size={18} className="pet-generation-spinner" aria-hidden="true"/><span>{cancelling?'작업을 취소하고 있어요…':submitting?'표정 생성 작업을 요청하고 있어요…':job?.status==='running'?'Codex가 표정 4가지를 만들고 있어요…':workerOnline?'표정 생성 작업 대기 중이에요…':'서버의 Codex 연결을 기다리는 중이에요…'}</span>{sheetGenerating && <Button variant="outline" size="sm" disabled={cancelling} onClick={cancel}>작업 취소</Button>}</div>}
    {regenerate && !sheetGenerating && <p className="pet-builder-note">완료를 누르면 표정을 다시 만들어요.</p>}
  </div>
}

function CustomExpressions({ pet, companion, workerOnline, limit, previewState, onPreview }) {
  const file = useRef(null)
  const [label,setLabel]=useState(''),[prompt,setPrompt]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const full = pet.expressions.length >= limit
  const run = async operation => { if(busy)return; setBusy(true); setError(''); try { await operation(); return true } catch (err) { setError(err.message) } finally { setBusy(false) } }
  const add = async () => {
    if(!label.trim()) { setError('표정 이름을 입력해 주세요.'); return }
    if(!prompt.trim()) { setError('만들고 싶은 표정을 설명해 주세요.'); return }
    if(await run(()=>companion.addExpression(pet.id,{label,prompt}))) { setLabel(''); setPrompt('') }
  }
  const upload = async e => {
    const chosen=e.target.files?.[0];e.target.value='';if(!chosen)return
    if(!label.trim()) { setError('표정 이름을 먼저 입력해 주세요.'); return }
    if(await run(async()=>{const image=await readPetFile(chosen);await companion.addExpression(pet.id,{label,prompt,image:image.data})})) { setLabel(''); setPrompt('') }
  }
  return <section className="pet-custom-expressions" aria-labelledby={`pet-custom-${pet.id}`}>
    <strong id={`pet-custom-${pet.id}`}>나만의 표정 <span>{pet.expressions.length}/{limit}</span></strong>
    <p>원하는 표정을 설명하면 Codex가 이 캐릭터로 만들어 줘요. 이미 가진 그림을 직접 올릴 수도 있어요.</p>
    {pet.expressions.length > 0 && <ul className="pet-custom-list">{pet.expressions.map(item => {
      const pending = generating(item.job)
      return <li key={item.id}>
        <button className="pet-custom-thumb" aria-pressed={previewState===item.id} disabled={!item.image} onClick={()=>onPreview(item.id)} aria-label={`${item.label} 미리보기`}>{item.image ? <img src={item.image} alt="" /> : pending ? <LoaderCircle size={18} className="pet-generation-spinner" /> : <Sparkles size={18} />}</button>
        <span className="pet-custom-text"><strong>{item.label}</strong><small>{item.prompt || '직접 올린 이미지'}</small>{item.job && item.job.status !== 'done' && <small className={item.job.status==='failed'?'pet-custom-failed':undefined}>{jobLabel(item.job, workerOnline)}</small>}</span>
        <span className="pet-custom-actions">
          {pending ? <Button variant="outline" size="sm" disabled={busy} onClick={()=>run(()=>companion.cancel(item.job.id))} aria-label={`${item.label} 생성 취소`}><X size={13}/></Button>
            : item.prompt && pet.image && <Button variant="outline" size="sm" disabled={busy} onClick={()=>run(()=>companion.regenerateExpression(pet.id,item.id))} aria-label={`${item.label} 다시 만들기`} title="다시 만들기"><RotateCcw size={13}/></Button>}
          <Button variant="outline" size="sm" disabled={busy} onClick={()=>{if(window.confirm(`‘${item.label}’ 표정을 삭제할까요?`))run(()=>companion.removeExpression(pet.id,item.id))}} aria-label={`${item.label} 삭제`}><Trash2 size={13}/></Button>
        </span>
      </li>
    })}</ul>}
    {!full && <div className="pet-custom-form">
      <input aria-label="새 표정 이름" placeholder="표정 이름 (예: 졸림)" maxLength={12} value={label} onChange={e=>setLabel(e.target.value)} />
      <input aria-label="새 표정 설명" placeholder="표정 설명 (예: 하품하며 눈을 비비는 졸린 표정)" maxLength={200} value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}} />
      <div className="pet-builder-actions">
        <Button size="sm" disabled={busy || !pet.image} onClick={add} title={!pet.image?'먼저 캐릭터 이미지를 선택해 주세요.':undefined}><Sparkles size={14}/> Codex로 만들기</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={()=>file.current.click()}><Upload size={14}/> 이미지로 추가</Button>
      </div>
      <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label="표정 이미지" onChange={upload}/>
    </div>}
    {full && <p className="pet-builder-note">표정은 펫마다 최대 {limit}개까지 추가할 수 있어요.</p>}
    {error && <p role="alert" className="pet-builder-error">{error}</p>}
  </section>
}

function ExpressionMapping({ pet, onChange }) {
  const options = [...PET_STATES.map(state => ({ value: state, label: `기본 · ${PET_STATE_LABELS[state]}` })), ...pet.expressions.map(item => ({ value: item.id, label: item.image ? item.label : `${item.label} (준비 중)` }))]
  return <section className="pet-mapping">
    <strong>상황별 표정</strong>
    <p>학습 중 상황마다 보일 표정을 골라요. 준비 중인 표정은 완성될 때까지 기본 표정으로 보여요.</p>
    <div className="pet-mapping-grid">{PET_EVENTS.map(event => <label key={event}><span>{PET_EVENT_LABELS[event]}</span>
      <select aria-label={`${PET_EVENT_LABELS[event]} 표정`} value={pet.mapping[event]} onChange={e=>onChange({...pet.mapping,[event]:e.target.value})}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    </label>)}</div>
  </section>
}
