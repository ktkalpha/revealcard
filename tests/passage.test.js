import test from 'node:test'
import assert from 'node:assert/strict'
import { passageError, rebaseHighlights } from '../src/lib/passage.js'
import { exportCardSet, parseCardSet } from '../src/cardSet.js'
const card={kind:'passage',title:'용비어천가',body:'주제는 [[건국의 정당성]]이다.',highlights:[{id:'h1',start:4,end:15,cards:[{title:'주제',body:'조선 건국의 [[정당성]]'}]}]}
test('passage preserves highlights and embedded masked cards in portable exports',()=>{
 assert.equal(passageError(card),'')
 assert.deepEqual(parseCardSet(JSON.stringify(exportCardSet([card]))).cards,[card])
})
test('passage rejects overlapping, dangling, and partial-mask annotations',()=>{
 for(const highlights of [[null],[{...card.highlights[0],end:100}],[{...card.highlights[0],start:5}],[...card.highlights, {...card.highlights[0],id:'other'}],[{...card.highlights[0],cards:[]}]])assert.ok(passageError({...card,highlights}))
})
test('annotations move with prefix edits and survive internal edits, partial deletion drops them',()=>{
 const h=[{id:'h',start:3,end:6,cards:[]}]
 assert.deepEqual(rebaseHighlights(h,'abcDEFghi','XabcDEFghi').map(x=>[x.start,x.end]),[[4,7]])
 assert.deepEqual(rebaseHighlights(h,'abcDEFghi','abcDXXFghi').map(x=>[x.start,x.end]),[[3,7]])
 assert.deepEqual(rebaseHighlights(h,'abcDEFghi','abFghi'),[])
})
test('API persists passage cards across restart and rejects malformed ranges',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{once}=await import('node:events'),{createApp}=await import('../server/app.js')
 const dir=await mkdtemp(join(tmpdir(),'revealcard-passage-')),dataFile=join(dir,'data.json')
 let server,base,cookie=''
 const start=async()=>{server=await createApp({dataFile,distDir:dir});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`}
 const req=(path,method='GET',body)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined})
 try{
  await start()
  const auth=await req('/api/register','POST',{username:'passage_test',password:'test-passage-2026'});cookie=auth.headers.get('set-cookie').split(';')[0]
  const result=await req('/api/decks','POST',{name:'본문',visibility:'private',cards:[card]});assert.equal(result.status,201);const {id}=await result.json()
  let deck=(await (await req('/api/bootstrap')).json()).decks.find(d=>d.id===id)
  assert.deepEqual(deck.cards[0].highlights,card.highlights)
  const endpoint=`/api/decks/${id}/cards/${deck.cards[0].id}`
  assert.equal((await req(endpoint,'PUT',{...card,baseVersion:deck.version,highlights:[null]})).status,400)
  assert.equal((await req(endpoint,'PUT',{...card,title:'수정된 본문',baseVersion:deck.version})).status,200)
  await new Promise(r=>server.close(r));await start()
  deck=(await (await req('/api/bootstrap')).json()).decks.find(d=>d.id===id)
  assert.equal(deck.cards[0].title,'수정된 본문');assert.deepEqual(deck.cards[0].highlights,card.highlights)
 }finally{if(server?.listening)await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
})
