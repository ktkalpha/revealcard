import { mkdir, readFile, writeFile, rename, open, unlink, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { normalizePet, validPetImage } from '../src/lib/pet.js'
const uuid = /^[0-9a-f-]{36}$/
const error = (status,message) => Object.assign(new Error(message),{status})
const delay = ms => new Promise(r=>setTimeout(r,ms))
export function createPets(directory) {
  const dir=resolve(directory), file=resolve(dir,'state.json'), lock=resolve(dir,'state.lock')
  const empty=()=>({pets:{},jobs:{},workerSeen:0})
  async function read() {try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return empty();throw e}}
  async function change(fn) {
    await mkdir(dir,{recursive:true,mode:0o700})
    let handle
    for(let i=0;i<100;i++) {
      try {handle=await open(lock,'wx',0o600);break} catch(e) {
        if(e.code!=='EEXIST')throw e
        const info=await stat(lock).catch(()=>null)
        if(info && Date.now()-info.mtimeMs>30000) await unlink(lock).catch(()=>{})
        await delay(30)
      }
    }
    if(!handle)throw error(503,'잠시 후 다시 시도해 주세요.')
    try {const data=await read();const result=await fn(data);const tmp=`${file}.${randomUUID()}.tmp`;await writeFile(tmp,JSON.stringify(data),{mode:0o600});await rename(tmp,file);return result}
    finally {await handle.close();await unlink(lock).catch(()=>{})}
  }
  async function writeImage(image) {
    if(!validPetImage(image))throw error(400,'PNG, JPG, WebP 이미지를 확인해 주세요.')
    const [,type,encoded]=/^data:image\/(png|jpeg|webp);base64,(.*)$/.exec(image)
    const bytes=Buffer.from(encoded,'base64')
    if(bytes.length>8*1024*1024)throw error(413,'8MB 이하 이미지를 선택해 주세요.')
    const magic=type==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='jpeg'?bytes[0]===255&&bytes[1]===216:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'
    if(!magic)throw error(400,'올바른 이미지 파일이 아니에요.')
    const name=`${randomUUID()}.${type==='jpeg'?'jpg':type}`
    await mkdir(resolve(dir,'assets'),{recursive:true,mode:0o700})
    await writeFile(resolve(dir,'assets',name),bytes,{mode:0o600})
    return name
  }
  function view(data,owner) {
    const pet=data.pets[owner]||{...normalizePet(),reference:null,jobId:null}
    const job=data.jobs[pet.jobId]
    return {pet:{enabled:pet.enabled,name:pet.name,size:pet.size,side:pet.side,image:pet.reference?`/api/pet/assets/${pet.reference}`:'',sheet:job?.status==='done'?`/api/pet/assets/${job.output}`:''},job:job?{id:job.id,status:job.status,error:job.error||null}:null,workerOnline:Date.now()-data.workerSeen<45000}
  }
  return {
    async get(owner){return view(await read(),owner)},
    async settings(owner,input){return change(data=>{const prev=data.pets[owner]||{...normalizePet(),reference:null,jobId:null};const settings=normalizePet(input);data.pets[owner]={...prev,enabled:settings.enabled,name:settings.name,size:settings.size,side:settings.side};return view(data,owner)})},
    async reference(owner,image){const name=await writeImage(image);return change(data=>{data.pets[owner]={...(data.pets[owner]||normalizePet()),reference:name,jobId:null,enabled:true};return view(data,owner)})},
    async generate(owner){return change(data=>{
      const pet=data.pets[owner]
      if(!pet?.reference)throw error(400,'먼저 펫 이미지를 선택해 주세요.')
      const active=data.jobs[pet.jobId]
      if(active && ['queued','running'].includes(active.status))return view(data,owner)
      if(Object.values(data.jobs).filter(j=>['queued','running'].includes(j.status)).length>=20)throw error(429,'생성 요청이 많아요. 잠시 후 다시 시도해 주세요.')
      const id=randomUUID();data.jobs[id]={id,owner,reference:pet.reference,status:'queued',createdAt:Date.now(),attempts:0};pet.jobId=id
      return view(data,owner)
    })},
    async asset(owner,name){
      if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(name))throw error(404,'이미지를 찾을 수 없어요.')
      const data=await read();const pet=data.pets[owner];const allowed=pet?.reference===name || Object.values(data.jobs).some(j=>j.owner===owner&&(j.output===name||j.reference===name))
      if(!allowed)throw error(404,'이미지를 찾을 수 없어요.')
      return readFile(resolve(dir,'assets',name))
    },
    async claim(){return change(async data=>{
      data.workerSeen=Date.now()
      for(const job of Object.values(data.jobs))if(job.status==='running'&&job.leaseUntil<Date.now()) {job.status=job.attempts>=2?'failed':'queued';job.error='Codex 작업이 중단됐어요. 다시 생성해 주세요.'}
      const job=Object.values(data.jobs).filter(j=>j.status==='queued').sort((a,b)=>a.createdAt-b.createdAt)[0]
      if(!job)return null
      job.status='running';job.attempts++;job.claim=randomUUID();job.leaseUntil=Date.now()+20*60*1000
      const bytes=await readFile(resolve(dir,'assets',job.reference));const type=job.reference.endsWith('.jpg')?'jpeg':job.reference.endsWith('.webp')?'webp':'png'
      return {id:job.id,claim:job.claim,image:`data:image/${type};base64,${bytes.toString('base64')}`}
    })},
    async heartbeat(){return change(data=>{data.workerSeen=Date.now();return {ok:true}})},
    async finish(id,claim,image){if(!uuid.test(id))throw error(400,'Invalid job');return change(async data=>{const job=data.jobs[id];if(!job||job.claim!==claim||job.status!=='running')throw error(409,'작업이 이미 끝났어요.');job.output=await writeImage(image);job.status='done';job.finishedAt=Date.now();return {ok:true}})},
    async fail(id,claim){return change(data=>{const job=data.jobs[id];if(job?.claim===claim&&job.status==='running'){job.status='failed';job.error='Codex에서 이미지를 만들지 못했어요. 잠시 후 다시 생성해 주세요.'}return {ok:true}})},
  }
}
