import { mkdir, readFile, readdir, writeFile, rename, open, unlink, stat, rm, rmdir } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { normalizePet, normalizePetPosition, validPetImage, normalizeMapping, expressionLabel, expressionPrompt, DEFAULT_PET_MAPPING, MAX_PETS, MAX_PET_EXPRESSIONS, petSheetPrompt, petExpressionPrompt, petDescription } from '../src/lib/pet.js'
const uuid = /^[0-9a-f-]{36}$/
const error = (status,message) => Object.assign(new Error(message),{status})
const delay = ms => new Promise(r=>setTimeout(r,ms))
const activeJob = job => !!job && ['queued','running'].includes(job.status)
const assetName = /^[0-9a-f-]{36}\.(png|jpg|webp)$/
// The worker keeps each job's files in workDir and Codex keeps its own copy of every
// generated image in codexImages; both are removed along with a deleted output.
export function createPets(directory,{workDir=process.env.PET_WORK_DIR,codexImages=process.env.PET_CODEX_IMAGES}={}) {
  const dir=resolve(directory), file=resolve(dir,'state.json'), lock=resolve(dir,'state.lock')
  const jobsDir=resolve(workDir||resolve(dir,'worker-jobs')), codexDir=resolve(codexImages||resolve(homedir(),'.codex/generated_images'))
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
  // Accounts used to own a single pet object; it becomes the first pet, keyed by the owner ID.
  function pets(data,owner) {
    const entry=data.pets[owner]
    if(!entry)return []
    if(!Array.isArray(entry.list)) data.pets[owner]={list:[{...entry,id:owner,expressions:[],mapping:{...DEFAULT_PET_MAPPING}}]}
    return data.pets[owner].list
  }
  function findPet(data,owner,id) {
    const pet=typeof id==='string'&&pets(data,owner).find(item=>item.id===id)
    if(!pet)throw error(404,'펫을 찾을 수 없어요.')
    return pet
  }
  const asset=name=>name?`/api/pet/assets/${name}`:''
  const jobView=job=>job?{id:job.id,status:job.status,error:job.error||null}:null
  function petView(data,pet) {
    const job=data.jobs[pet.jobId],expressions=pet.expressions||[]
    return {id:pet.id,enabled:pet.enabled,name:pet.name,description:pet.description||'',size:pet.size,side:pet.side,position:normalizePetPosition(pet.position),image:asset(pet.reference),sheet:job?.status==='done'?asset(job.output):'',job:jobView(job),
      expressions:expressions.map(item=>{const job=data.jobs[item.jobId];return {id:item.id,label:item.label,prompt:item.prompt||'',image:asset(item.asset||(job?.status==='done'?job.output:'')),job:jobView(job)}}),
      mapping:normalizeMapping(pet.mapping,expressions.map(item=>item.id))}
  }
  function view(data,owner) {
    return {pets:pets(data,owner).map(pet=>petView(data,pet)),workerOnline:Date.now()-data.workerSeen<45000,limits:{pets:MAX_PETS,expressions:MAX_PET_EXPRESSIONS}}
  }
  function enqueue(data,job) {
    if(Object.values(data.jobs).filter(activeJob).length>=20)throw error(429,'생성 요청이 많아요. 잠시 후 다시 시도해 주세요.')
    const id=randomUUID();data.jobs[id]={id,status:'queued',createdAt:Date.now(),attempts:0,...job}
    return id
  }
  function cancelJob(job) {if(activeJob(job)){job.status='cancelled';job.cancelledAt=Date.now();job.error=null}}
  function queueExpression(data,owner,pet,expression) {
    if(!pet.reference)throw error(400,'먼저 펫 이미지를 선택해 주세요.')
    if(activeJob(data.jobs[expression.jobId]))return
    expression.asset=null
    expression.jobId=enqueue(data,{owner,petId:pet.id,kind:'expression',expressionId:expression.id,prompt:expression.prompt,description:pet.description||'',reference:pet.reference})
  }
  return {
    async get(owner){return view(await read(),owner)},
    async create(owner,input={}){return change(data=>{
      const list=pets(data,owner)
      if(list.length>=MAX_PETS)throw error(400,`펫은 최대 ${MAX_PETS}마리까지 만들 수 있어요.`)
      const id=randomUUID()
      list.push({...normalizePet({name:input.name,side:list.length%2?'left':'right'}),description:petDescription(input.description),id,reference:null,jobId:null,expressions:[],mapping:{...DEFAULT_PET_MAPPING}})
      data.pets[owner]={list}
      return {...view(data,owner),created:id}
    })},
    async remove(owner,id){return change(data=>{
      const pet=findPet(data,owner,id)
      cancelJob(data.jobs[pet.jobId]);for(const item of pet.expressions||[])cancelJob(data.jobs[item.jobId])
      data.pets[owner].list=data.pets[owner].list.filter(item=>item!==pet)
      return view(data,owner)
    })},
    async settings(owner,id,input){return change(data=>{
      const pet=findPet(data,owner,id)
      const settings=normalizePet({...pet,...input})
      Object.assign(pet,{enabled:settings.enabled,name:settings.name,size:settings.size,side:settings.side,position:settings.position})
      if(input.description!==undefined)pet.description=petDescription(input.description)
      if(input.mapping!==undefined)pet.mapping=normalizeMapping(input.mapping,(pet.expressions||[]).map(item=>item.id))
      return view(data,owner)
    })},
    async reference(owner,id,image){const name=await writeImage(image);return change(data=>{const pet=findPet(data,owner,id);cancelJob(data.jobs[pet.jobId]);Object.assign(pet,{reference:name,jobId:null,enabled:true});return view(data,owner)})},
    async generate(owner,id){return change(data=>{
      const pet=findPet(data,owner,id)
      if(!pet.reference)throw error(400,'먼저 펫 이미지를 선택해 주세요.')
      if(activeJob(data.jobs[pet.jobId]))return view(data,owner)
      pet.jobId=enqueue(data,{owner,petId:pet.id,kind:'sheet',description:pet.description||'',reference:pet.reference})
      return view(data,owner)
    })},
    // An expression is either generated by Codex from a description or uploaded as an image.
    async addExpression(owner,id,input={}){
      const label=expressionLabel(input.label),prompt=expressionPrompt(input.prompt)
      if(!label)throw error(400,'표정 이름을 입력해 주세요.')
      if(input.image===undefined&&!prompt)throw error(400,'만들고 싶은 표정을 설명해 주세요.')
      const uploaded=input.image===undefined?null:await writeImage(input.image)
      return change(data=>{
        const pet=findPet(data,owner,id)
        pet.expressions||=[]
        if(pet.expressions.length>=MAX_PET_EXPRESSIONS)throw error(400,`표정은 펫마다 최대 ${MAX_PET_EXPRESSIONS}개까지 추가할 수 있어요.`)
        const expression={id:randomUUID(),label,prompt,jobId:null,asset:uploaded}
        if(!uploaded)queueExpression(data,owner,pet,expression)
        pet.expressions.push(expression)
        return {...view(data,owner),created:expression.id}
      })
    },
    async regenerateExpression(owner,id,expressionId){return change(data=>{
      const pet=findPet(data,owner,id),expression=(pet.expressions||[]).find(item=>item.id===expressionId)
      if(!expression)throw error(404,'표정을 찾을 수 없어요.')
      if(!expression.prompt)throw error(400,'직접 올린 표정은 다시 만들 수 없어요.')
      queueExpression(data,owner,pet,expression)
      return view(data,owner)
    })},
    async removeExpression(owner,id,expressionId){return change(data=>{
      const pet=findPet(data,owner,id),expression=(pet.expressions||[]).find(item=>item.id===expressionId)
      if(!expression)throw error(404,'표정을 찾을 수 없어요.')
      cancelJob(data.jobs[expression.jobId])
      pet.expressions=pet.expressions.filter(item=>item!==expression)
      pet.mapping=normalizeMapping(pet.mapping,pet.expressions.map(item=>item.id))
      return view(data,owner)
    })},
    async cancel(owner,id){
      if(typeof id!=='string'||!uuid.test(id))throw error(400,'취소할 작업을 확인해 주세요.')
      return change(data=>{
        const job=data.jobs[id]
        const current=pets(data,owner).some(pet=>pet.jobId===id||(pet.expressions||[]).some(item=>item.jobId===id))
        if(!current||!job||job.owner!==owner)throw error(404,'작업을 찾을 수 없어요.')
        cancelJob(job)
        return view(data,owner)
      })
    },
    async active(id,claim){const job=(await read()).jobs[id];return !!job&&job.claim===claim&&job.status==='running'},
    async asset(owner,name){
      if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(name))throw error(404,'이미지를 찾을 수 없어요.')
      const data=await read()
      const allowed=pets(data,owner).some(pet=>pet.reference===name||(pet.expressions||[]).some(item=>item.asset===name)) || Object.values(data.jobs).some(j=>j.owner===owner&&(j.output===name||j.reference===name))
      if(!allowed)throw error(404,'이미지를 찾을 수 없어요.')
      return readFile(resolve(dir,'assets',name))
    },
    // Admin: every stored image with its owner, what it is and whether a pet still shows it.
    async adminImages(users=[]){
      const data=await read(),items=new Map()
      const files=await readdir(resolve(dir,'assets')).catch(()=>[])
      for(const name of files)if(assetName.test(name)){const info=await stat(resolve(dir,'assets',name)).catch(()=>null);if(info)items.set(name,{name,size:info.size,createdAt:info.mtimeMs,owner:null,kind:'unknown',inUse:false,pet:null,label:null})}
      const mark=(name,fields)=>{const item=name&&items.get(name);if(item)Object.assign(item,fields,{inUse:item.inUse||!!fields.inUse})}
      for(const job of Object.values(data.jobs)){mark(job.reference,{owner:job.owner,kind:'reference'});mark(job.output,{owner:job.owner,kind:job.kind==='expression'?'expression':'sheet'})}
      for(const owner of Object.keys(data.pets))for(const pet of pets(data,owner)) {
        mark(pet.reference,{owner,kind:'reference',inUse:true,pet:pet.name})
        const sheet=data.jobs[pet.jobId];if(sheet?.status==='done')mark(sheet.output,{owner,kind:'sheet',inUse:true,pet:pet.name})
        for(const item of pet.expressions||[]){const job=data.jobs[item.jobId];mark(item.asset||(job?.status==='done'?job.output:null),{owner,kind:item.asset?'upload':'expression',inUse:true,pet:pet.name,label:item.label})}
      }
      const username=id=>users.find(user=>user.id===id)?.username||null
      return {images:[...items.values()].map(item=>({...item,username:username(item.owner),createdAt:new Date(item.createdAt).toISOString()})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
    },
    async adminImage(name){if(!assetName.test(name))throw error(404,'이미지를 찾을 수 없어요.');return readFile(resolve(dir,'assets',name)).catch(()=>{throw error(404,'이미지를 찾을 수 없어요.')})},
    // Removes images and every record pointing at them; pets fall back to what they have left.
    async adminDelete(names){
      if(!Array.isArray(names)||!names.length||names.length>1000||!names.every(name=>typeof name==='string'&&assetName.test(name)))throw error(400,'지울 이미지를 선택해 주세요.')
      const doomed=new Set(names),jobDirs=[]
      await change(data=>{
        for(const job of Object.values(data.jobs)) {
          if(doomed.has(job.reference))cancelJob(job)
          if(doomed.has(job.output)){job.output=null;job.status='deleted';jobDirs.push(job.id)}
        }
        for(const owner of Object.keys(data.pets))for(const pet of pets(data,owner)) {
          if(doomed.has(pet.reference))pet.reference=null
          if(data.jobs[pet.jobId]?.status==='deleted')pet.jobId=null
          const kept=(pet.expressions||[]).filter(item=>!doomed.has(item.asset)&&data.jobs[item.jobId]?.status!=='deleted')
          if(kept.length!==(pet.expressions||[]).length){pet.expressions=kept;pet.mapping=normalizeMapping(pet.mapping,kept.map(item=>item.id))}
          if(!pet.reference&&!data.jobs[pet.jobId])pet.enabled=false
        }
      })
      let removed=0
      for(const name of doomed)await unlink(resolve(dir,'assets',name)).then(()=>removed++,()=>{})
      for(const id of jobDirs)if(uuid.test(id)) {
        const jobDir=resolve(jobsDir,id)
        const log=await readFile(resolve(jobDir,'events.jsonl'),'utf8').catch(()=>'')
        for(const path of new Set(log.match(/[^"\\\s]+\/exec-[0-9a-f-]+\.png/g)||[])) {
          const copy=resolve(path)
          if(!copy.startsWith(codexDir+sep))continue
          await unlink(copy).catch(()=>{})
          await rmdir(dirname(copy)).catch(()=>{})
        }
        await rm(jobDir,{recursive:true,force:true})
      }
      return {removed}
    },
    async claim(){return change(async data=>{
      data.workerSeen=Date.now()
      for(const job of Object.values(data.jobs))if(job.status==='running'&&job.leaseUntil<Date.now()) {job.status=job.attempts>=2?'failed':'queued';job.error='Codex 작업이 중단됐어요. 다시 생성해 주세요.'}
      const job=Object.values(data.jobs).filter(j=>j.status==='queued').sort((a,b)=>a.createdAt-b.createdAt)[0]
      if(!job)return null
      job.status='running';job.attempts++;job.claim=randomUUID();job.leaseUntil=Date.now()+20*60*1000
      const bytes=await readFile(resolve(dir,'assets',job.reference));const type=job.reference.endsWith('.jpg')?'jpeg':job.reference.endsWith('.webp')?'webp':'png'
      const kind=job.kind==='expression'?'expression':'sheet'
      return {id:job.id,claim:job.claim,kind,prompt:kind==='expression'?petExpressionPrompt(job.prompt,job.description):petSheetPrompt(job.description),image:`data:image/${type};base64,${bytes.toString('base64')}`}
    })},
    async heartbeat(){return change(data=>{data.workerSeen=Date.now();return {ok:true}})},
    async finish(id,claim,image){if(!uuid.test(id))throw error(400,'Invalid job');return change(async data=>{const job=data.jobs[id];if(!job||job.claim!==claim||job.status!=='running')throw error(409,'작업이 이미 끝났어요.');job.output=await writeImage(image);job.status='done';job.finishedAt=Date.now();return {ok:true}})},
    async fail(id,claim){return change(data=>{const job=data.jobs[id];if(job?.claim===claim&&job.status==='running'){job.status='failed';job.error='Codex에서 이미지를 만들지 못했어요. 잠시 후 다시 생성해 주세요.'}return {ok:true}})},
  }
}
