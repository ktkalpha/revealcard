import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
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
    for(const [path,method,body] of [['/api/pet','GET'],['/api/pet','POST',{}],['/api/pet/x/reference','POST',{image:png}],['/api/pet/x/generate','POST'],['/api/pet/cancel','POST',{jobId:'unknown'}],['/api/pet/assets/unknown.png','GET']])assert.equal((await request(path,method,body)).status,401)
    const register=async(username)=>{const r=await request('/api/register','POST',{username,password:'pet-test-password-123'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
    const a=await register('pet_alice'),b=await register('pet_bob')
    assert.deepEqual((await (await request('/api/pet','GET',undefined,a)).json()).pets,[])
    const made=await (await request('/api/pet','POST',{name:'첫 펫',description:'  파란   목도리 고양이 '},a)).json()
    const id=made.created
    assert.equal(made.pets[0].description,'파란 목도리 고양이')
    assert.equal((await request(`/api/pet/${id}/generate`,'POST',{confirmed:true},a)).status,400)
    assert.equal((await request(`/api/pet/${id}/reference`,'POST',{image:png},b)).status,404)
    assert.equal((await request(`/api/pet/${id}/reference`,'POST',{image:'data:image/svg+xml;base64,aGVsbG8='},a)).status,400)
    assert.equal((await request(`/api/pet/${id}/reference`,'POST',{image:'data:image/png;base64,aGVsbG8='},a)).status,400)
    const ref=(await (await request(`/api/pet/${id}/reference`,'POST',{image:png},a)).json()).pets[0]
    assert.equal(ref.enabled,true)
    assert.equal(ref.job,null)
    assert.equal(await createPets(join(dir,'pets')).claim(),null)
    for(const confirmed of [undefined,false,'true']) {
      assert.equal((await request(`/api/pet/${id}/generate`,'POST',{confirmed},a)).status,400)
      assert.equal((await (await request('/api/pet','GET',undefined,a)).json()).pets[0].job,null)
    }
    assert.equal((await request(ref.image,'GET',undefined,a)).status,200)
    assert.equal((await request(ref.image,'GET',undefined,b)).status,404)
    let queued=(await (await request(`/api/pet/${id}/generate`,'POST',{confirmed:true},a)).json()).pets[0]
    assert.equal(queued.job.status,'queued')
    const same=(await (await request(`/api/pet/${id}/generate`,'POST',{confirmed:true},a)).json()).pets[0]
    assert.equal(same.job.id,queued.job.id)
    assert.deepEqual((await (await request('/api/pet','GET',undefined,b)).json()).pets,[])
    assert.equal((await request('/api/pet/cancel','POST',{jobId:queued.job.id},b)).status,404)
    const cancelled=(await (await request('/api/pet/cancel','POST',{jobId:queued.job.id},a)).json()).pets[0]
    assert.equal(cancelled.job.status,'cancelled')
    assert.equal(await createPets(join(dir,'pets')).claim(),null)
    queued=(await (await request(`/api/pet/${id}/generate`,'POST',{confirmed:true},a)).json()).pets[0]
    assert.notEqual(queued.job.id,cancelled.job.id)
    const worker=createPets(join(dir,'pets'))
    const claim=await worker.claim()
    assert.equal(claim.id,queued.job.id)
    assert.equal(claim.kind,'sheet')
    assert.match(claim.prompt,/Top left: calm idle/)
    assert.match(claim.prompt,/"파란 목도리 고양이"/)
    assert.equal(await worker.claim(),null)
    await assert.rejects(worker.finish(claim.id,'wrong',png),{status:409})
    await worker.finish(claim.id,claim.claim,png)
    const done=await (await request('/api/pet','GET',undefined,a)).json()
    assert.equal(done.pets[0].job.status,'done');assert.equal(done.workerOnline,true)
    assert.equal((await request(done.pets[0].sheet,'GET',undefined,b)).status,404)
    const output=await request(done.pets[0].sheet,'GET',undefined,a)
    assert.equal(output.status,200);assert.equal(output.headers.get('content-type'),'image/png')
    assert.equal(output.headers.get('cache-control'),'private, no-store')
    const settings=(await (await request(`/api/pet/${id}`,'PUT',{enabled:false,name:'내 펫',size:80,side:'left'},a)).json()).pets[0]
    assert.equal(settings.name,'내 펫');assert.equal(settings.image,ref.image);assert.equal(settings.sheet,done.pets[0].sheet)
    assert.equal(settings.description,'파란 목도리 고양이')
    const persisted=await createPets(join(dir,'pets')).get(Object.keys(JSON.parse(await readFile(join(dir,'pets/state.json'),'utf8')).pets)[0])
    assert.equal(persisted.pets[0].enabled,false)
    const moved=(await (await request(`/api/pet/${id}`,'PUT',{position:{x:.25,y:.6}},a)).json()).pets[0]
    assert.deepEqual(moved.position,{x:.25,y:.6})
    assert.equal(moved.name,'내 펫')
    const unchanged=(await (await request(`/api/pet/${id}`,'PUT',{size:112},a)).json()).pets[0]
    assert.deepEqual(unchanged.position,{x:.25,y:.6})
    assert.equal((await request(`/api/pet/${id}`,'PUT',{size:112},b)).status,404)
    const reset=(await (await request(`/api/pet/${id}`,'PUT',{side:'right',position:null},a)).json()).pets[0]
    assert.equal(reset.position,null)

    // Custom expressions: generated from a description, or uploaded, and mapped to study events.
    assert.equal((await request(`/api/pet/${id}/expressions`,'POST',{label:'',prompt:'졸린 표정'},a)).status,400)
    assert.equal((await request(`/api/pet/${id}/expressions`,'POST',{label:'졸림'},a)).status,400)
    const sleepy=await (await request(`/api/pet/${id}/expressions`,'POST',{label:'졸림',prompt:'하품하는 "졸린" 표정'},a)).json()
    const sleepyId=sleepy.created
    assert.equal(sleepy.pets[0].expressions[0].job.status,'queued')
    assert.equal(sleepy.pets[0].expressions[0].image,'')
    const expressionClaim=await worker.claim()
    assert.equal(expressionClaim.kind,'expression')
    assert.match(expressionClaim.prompt,/하품하는 '졸린' 표정/)
    assert.doesNotMatch(expressionClaim.prompt,/2 by 2/)
    await worker.finish(expressionClaim.id,expressionClaim.claim,png)
    const uploaded=await (await request(`/api/pet/${id}/expressions`,'POST',{label:'윙크',image:png},a)).json()
    const winkId=uploaded.created
    const [sleepyView,winkView]=uploaded.pets[0].expressions
    assert.equal((await request(sleepyView.image,'GET',undefined,a)).status,200)
    assert.equal((await request(winkView.image,'GET',undefined,a)).status,200)
    assert.equal((await request(winkView.image,'GET',undefined,b)).status,404)
    assert.equal(winkView.job,null)
    const mapped=(await (await request(`/api/pet/${id}`,'PUT',{mapping:{known:winkId,again:sleepyId,pat:'celebrate',complete:'nope'}},a)).json()).pets[0]
    assert.deepEqual(mapped.mapping,{idle:'idle',known:winkId,again:sleepyId,complete:'celebrate',pat:'celebrate'})
    assert.equal((await request(`/api/pet/${id}/expressions/${winkId}/generate`,'POST',{},a)).status,400)
    const regenerated=(await (await request(`/api/pet/${id}/expressions/${sleepyId}/generate`,'POST',{},a)).json()).pets[0]
    assert.equal(regenerated.expressions[0].job.status,'queued')
    assert.equal((await request('/api/pet/cancel','POST',{jobId:regenerated.expressions[0].job.id},a)).status,200)
    const removed=(await (await request(`/api/pet/${id}/expressions/${winkId}`,'DELETE',undefined,a)).json()).pets[0]
    assert.equal(removed.expressions.length,1)
    assert.equal(removed.mapping.known,'happy')
    assert.equal(removed.mapping.again,sleepyId)

    // Several pets per account, up to the limit, each with its own settings.
    const second=await (await request('/api/pet','POST',{name:'둘째'},a)).json()
    assert.equal(second.pets.length,2)
    assert.equal(second.pets[1].name,'둘째')
    assert.equal(second.pets[1].side,'left')
    for(let i=2;i<second.limits.pets;i++)assert.equal((await request('/api/pet','POST',{},a)).status,200)
    assert.equal((await request('/api/pet','POST',{},a)).status,400)
    assert.equal((await request(`/api/pet/${second.created}`,'DELETE',undefined,b)).status,404)
    const left=await (await request(`/api/pet/${second.created}`,'DELETE',undefined,a)).json()
    assert.equal(left.pets.length,second.limits.pets-1)
    assert.equal(left.pets[0].id,id)
  }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
})

test('claim is exclusive across worker processes and failed generations can be retried',async()=> {
  const dir=await mkdtemp(join(tmpdir(),'pet-queue-'))
  try {
    const a=createPets(dir),b=createPets(dir)
    const pet=(await a.create('one')).created
    await a.reference('one',pet,png);const first=(await a.generate('one',pet)).pets[0]
    const claims=await Promise.all([a.claim(),b.claim()])
    const job=claims.find(Boolean)
    assert.equal(claims.filter(Boolean).length,1)
    await b.fail(job.id,'wrong')
    assert.equal((await a.get('one')).pets[0].job.status,'running')
    await b.fail(job.id,job.claim)
    assert.equal((await a.get('one')).pets[0].job.status,'failed')
    const retry=(await a.generate('one',pet)).pets[0]
    assert.notEqual(retry.job.id,first.job.id)
    await a.reference('one',pet,png)
    assert.equal((await a.get('one')).pets[0].job,null)
    assert.equal(await b.claim(),null)
    assert.equal((await a.get('one')).pets[0].sheet,'')
  }finally{await rm(dir,{recursive:true,force:true})}
})

test('a legacy single pet becomes the first pet of the list with default mapping',async()=> {
  const dir=await mkdtemp(join(tmpdir(),'pet-legacy-'))
  try {
    await writeFile(join(dir,'state.json'),JSON.stringify({pets:{owner:{enabled:true,name:'teto',size:144,side:'right',position:{x:1,y:.3},reference:null,jobId:null}},jobs:{},workerSeen:0}))
    const pets=createPets(dir)
    const view=await pets.get('owner')
    assert.equal(view.pets.length,1)
    assert.equal(view.pets[0].id,'owner')
    assert.equal(view.pets[0].name,'teto')
    assert.deepEqual(view.pets[0].position,{x:1,y:.3})
    assert.deepEqual(view.pets[0].expressions,[])
    assert.equal(view.pets[0].mapping.known,'happy')
    const renamed=await pets.settings('owner','owner',{name:'테토'})
    assert.equal(renamed.pets[0].name,'테토')
    assert.equal(JSON.parse(await readFile(join(dir,'state.json'),'utf8')).pets.owner.list.length,1)
  }finally{await rm(dir,{recursive:true,force:true})}
})
