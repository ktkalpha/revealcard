import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPets } from '../server/pets.js'
import { run } from '../worker/run-command.mjs'
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII='
test('cancelling queued or running jobs prevents claims and late results, permits retry and isolates owners',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pet-cancel-'))
 try{
  const pets=createPets(dir)
  await pets.reference('one',png);await pets.reference('two',png)
  const first=await pets.generate('one')
  await assert.rejects(pets.cancel('two',first.job.id),{status:404})
  assert.equal((await pets.cancel('one',first.job.id)).job.status,'cancelled')
  assert.equal(await pets.claim(),null)
  const retry=await pets.generate('one');assert.notEqual(retry.job.id,first.job.id)
  await assert.rejects(pets.cancel('one',first.job.id),{status:404})
  const claimed=await pets.claim();assert.equal(await pets.active(claimed.id,claimed.claim),true)
  await pets.cancel('one',claimed.id)
  assert.equal(await pets.active(claimed.id,claimed.claim),false)
  await assert.rejects(pets.finish(claimed.id,claimed.claim,png),{status:409})
  await pets.fail(claimed.id,claimed.claim)
  assert.equal((await pets.get('one')).job.status,'cancelled')
  assert.equal((await pets.get('one')).pet.sheet,'')
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('worker abort terminates its running command, including commands that ignore SIGTERM',async()=>{
 const controller=new AbortController()
 const command=run(process.execPath,['-e','process.on("SIGTERM",()=>{});console.log("ready");setInterval(()=>{},1000)'],{timeout:10000,signal:controller.signal,log:part=>{if(String(part).includes('ready'))controller.abort()}})
 await assert.rejects(command,{name:'AbortError'})
})
