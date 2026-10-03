import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {once} from 'node:events'
import {createHash} from 'node:crypto'
import {createApp} from '../server/app.js'

const credentials={username:'session_user',password:'test-session-password-2026'}
const digest=cookie=>createHash('sha256').update(cookie.split('=')[1]).digest('hex')
async function fixture(secureCookies=false) {
  const dir=await mkdtemp(join(tmpdir(),'revealcard-session-')),file=join(dir,'cards.json')
  let server,base
  const restart=async()=> {
    if(server?.listening)await new Promise(r=>server.close(r))
    server=await createApp({dataFile:file,distDir:dir,secureCookies})
    server.listen(0,'127.0.0.1');await once(server,'listening')
    base=`http://127.0.0.1:${server.address().port}`
  }
  await restart()
  return {
    file,restart,
    async request(path,method='GET',body,cookie='') {
      const r=await fetch(base+path,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
      const setCookie=r.headers.get('set-cookie')
      return {status:r.status,data:await r.json(),setCookie,cookie:setCookie?.split(';')[0]}
    },
    read:async()=>JSON.parse(await readFile(file,'utf8')),
    async dispose(){if(server?.listening)await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})},
  }
}

test('remembered login and private account access survive restart; only token hashes persist',async()=> {
  const f=await fixture(true)
  try {
    // Omitted remember stays compatible with existing installed clients.
    const registered=await f.request('/api/register','POST',credentials)
    assert.equal(registered.status,200)
    assert.match(registered.setCookie,/Max-Age=2592000/)
    for(const attribute of ['HttpOnly','SameSite=Lax','Secure'])assert.ok(registered.setCookie.includes(attribute))
    const data=await f.read(),key=digest(registered.cookie)
    assert.equal(data.sessions[key].userId,registered.data.user.id)
    assert.ok(!JSON.stringify(data).includes(registered.cookie.split('=')[1]))
    assert.equal((await stat(f.file)).mode&0o777,0o600)
    const deck=await f.request('/api/decks','POST',{name:'비공개',visibility:'private',cards:[]},registered.cookie)
    assert.equal(deck.status,201)
    assert.equal((await f.request('/api/bootstrap')).data.user,null)
    await f.restart()
    const restored=await f.request('/api/bootstrap','GET',undefined,registered.cookie)
    assert.equal(restored.data.user.id,registered.data.user.id)
    assert.equal(restored.data.decks[0].id,deck.data.id)
    assert.equal(restored.data.sessions,undefined)
    assert.equal((await f.request('/api/pet','GET',undefined,registered.cookie)).status,200)
    assert.equal((await f.request('/api/bootstrap','GET',undefined,'rc_session='+'0'.repeat(64))).data.user,null)
  }finally{await f.dispose()}
})

test('login rotates the current session and logout stays revoked after restart without ending other devices',async()=> {
  const f=await fixture()
  try {
    const initial=await f.request('/api/register','POST',credentials)
    const current=await f.request('/api/login','POST',{...credentials,remember:true},initial.cookie)
    assert.notEqual(current.cookie,initial.cookie)
    assert.equal((await f.request('/api/bootstrap','GET',undefined,initial.cookie)).data.user,null)
    const other=await f.request('/api/login','POST',credentials)
    const logout=await f.request('/api/logout','POST',{},current.cookie)
    assert.equal(logout.status,200);assert.match(logout.setCookie,/Max-Age=0/)
    assert.equal((await f.request('/api/bootstrap','GET',undefined,current.cookie)).data.user,null)
    await f.restart()
    assert.equal((await f.request('/api/bootstrap','GET',undefined,current.cookie)).data.user,null)
    assert.equal((await f.request('/api/bootstrap','GET',undefined,other.cookie)).data.user.id,initial.data.user.id)
    assert.equal((await f.read()).sessions[digest(current.cookie)],undefined)
  }finally{await f.dispose()}
})

test('unchecked remember uses a session cookie with a 24-hour server expiry, and expired sessions are rejected and pruned',async()=> {
  const f=await fixture()
  try {
    const login=await f.request('/api/register','POST',{...credentials,remember:false})
    assert.equal(login.status,200)
    assert.ok(!/Max-Age|Expires/i.test(login.setCookie))
    const data=await f.read(),key=digest(login.cookie)
    const remaining=data.sessions[key].expires-Date.now()
    assert.ok(remaining>23*60*60*1000 && remaining<=24*60*60*1000)
    await f.restart()
    assert.equal((await f.request('/api/bootstrap','GET',undefined,login.cookie)).data.user.id,login.data.user.id)
    data.sessions[key].expires=Date.now()-1
    data.sessions['invalid-record']={userId:login.data.user.id,expires:'invalid'}
    await writeFile(f.file,JSON.stringify(data))
    await f.restart()
    assert.equal((await f.request('/api/bootstrap','GET',undefined,login.cookie)).data.user,null)
    assert.equal((await f.request('/api/pet','GET',undefined,login.cookie)).status,401)
    assert.deepEqual((await f.read()).sessions,{})
  }finally{await f.dispose()}
})

test('invalid remember values and wrong passwords do not replace an authenticated session',async()=> {
  const f=await fixture()
  try {
    const login=await f.request('/api/register','POST',credentials)
    assert.equal((await f.request('/api/login','POST',{...credentials,remember:'yes'},login.cookie)).status,400)
    assert.equal((await f.request('/api/login','POST',{...credentials,password:'wrong-password-2026'},login.cookie)).status,401)
    assert.equal((await f.request('/api/bootstrap','GET',undefined,login.cookie)).data.user.id,login.data.user.id)
  }finally{await f.dispose()}
})
