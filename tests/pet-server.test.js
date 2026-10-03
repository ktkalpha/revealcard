import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {once} from 'node:events'
import {createApp} from '../server/app.js'
import {createPets} from '../server/pets.js'
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII='

test('pet API requires login and keeps images and jobs isolated by account',async()=> {
  const dir=await mkdtemp(join(tmpdir(),'revealcard-pets-'))
  const server=await createApp({dataFile:join(dir,'data.json'),distDir:dir})
  try {
    server.listen(0,'127.0.0.1');await once(server,'listening')
    const base=`http://127.0.0.1:${server.address().port}`
    const request=async(path,method='GET',body,cookie='')=>fetch(base+path,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
    for(const [path,method,body] of [['/api/pet','GET'],['/api/pet/reference','POST',{image:png}],['/api/pet/generate','POST'],['/api/pet/assets/unknown.png','GET']])assert.equal((await request(path,method,body)).status,401)
    const register=async(username)=>{const r=await request('/api/register','POST',{username,password:'pet-test-password-123'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
    const a=await register('pet_alice'),b=await register('pet_bob')
    assert.equal((await request('/api/pet/generate','POST',undefined,a)).status,400)
    assert.equal((await request('/api/pet/reference','POST',{image:'data:image/svg+xml;base64,aGVsbG8='},a)).status,400)
    assert.equal((await request('/api/pet/reference','POST',{image:'data:image/png;base64,aGVsbG8='},a)).status,400)
    const ref=await (await request('/api/pet/reference','POST',{image:png},a)).json()
    assert.equal(ref.pet.enabled,true)
    assert.equal((await request(ref.pet.image,'GET',undefined,a)).status,200)
    assert.equal((await request(ref.pet.image,'GET',undefined,b)).status,404)
    const queued=await (await request('/api/pet/generate','POST',undefined,a)).json()
    assert.equal(queued.job.status,'queued')
    const same=await (await request('/api/pet/generate','POST',undefined,a)).json()
    assert.equal(same.job.id,queued.job.id)
    assert.equal((await (await request('/api/pet','GET',undefined,b)).json()).job,null)
    const worker=createPets(join(dir,'pets'))
    const claim=await worker.claim()
    assert.equal(claim.id,queued.job.id)
    assert.equal(await worker.claim(),null)
    await assert.rejects(worker.finish(claim.id,'wrong',png),{status:409})
    await worker.finish(claim.id,claim.claim,png)
    const done=await (await request('/api/pet','GET',undefined,a)).json()
    assert.equal(done.job.status,'done');assert.equal(done.workerOnline,true)
    assert.equal((await request(done.pet.sheet,'GET',undefined,b)).status,404)
    const output=await request(done.pet.sheet,'GET',undefined,a)
    assert.equal(output.status,200);assert.equal(output.headers.get('content-type'),'image/png')
    assert.equal(output.headers.get('cache-control'),'private, no-store')
    const settings=await (await request('/api/pet','PUT',{enabled:false,name:'내 펫',size:80,side:'left'},a)).json()
    assert.equal(settings.pet.name,'내 펫');assert.equal(settings.pet.image,ref.pet.image);assert.equal(settings.pet.sheet,done.pet.sheet)
    const persisted=await createPets(join(dir,'pets')).get(Object.keys(JSON.parse(await readFile(join(dir,'pets/state.json'),'utf8')).pets)[0])
    assert.equal(persisted.pet.enabled,false)
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
})

test('claim is exclusive across worker processes and failed generations can be retried',async()=> {
  const dir=await mkdtemp(join(tmpdir(),'pet-queue-'))
  try {
    const a=createPets(dir),b=createPets(dir)
    await a.reference('one',png);const first=await a.generate('one')
    const claims=await Promise.all([a.claim(),b.claim()])
    const job=claims.find(Boolean)
    assert.equal(claims.filter(Boolean).length,1)
    await b.fail(job.id,'wrong')
    assert.equal((await a.get('one')).job.status,'running')
    await b.fail(job.id,job.claim)
    assert.equal((await a.get('one')).job.status,'failed')
    const retry=await a.generate('one')
    assert.notEqual(retry.job.id,first.job.id)
    await a.reference('one',png)
    assert.equal((await a.get('one')).job,null)
    const old=await b.claim()
    await b.finish(old.id,old.claim,png)
    assert.equal((await a.get('one')).pet.sheet,'')
  }finally{await rm(dir,{recursive:true,force:true})}
})
