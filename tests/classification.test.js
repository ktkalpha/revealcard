import test from 'node:test'
import assert from 'node:assert/strict'
import { classificationAnswer, classificationData, classificationError, FOSSIL_ERAS, safeImageUrl } from '../src/lib/classification.js'
import { exportCardSet, parseCardSet } from '../src/cardSet.js'
import { shuffled } from '../src/lib/matching.js'
const data = { categories: FOSSIL_ERAS, items: [
 {id:'one',label:'삼엽충',category:'고생대',image:'/fossils/item-01.webp',explanation:'고생대의 대표 화석'},
 {id:'two',label:'암모나이트',category:'중생대',image:'/fossils/item-02.webp',source:'https://commons.wikimedia.org/wiki/File:Example.jpg',credit:'Photographer',license:'CC BY 2.0'},
] }
const card={title:'화석 시대 분류',kind:'classification',body:JSON.stringify(data)}
test('classification exports preserve images, era keys and credits',()=>{
 assert.equal(classificationError(card.body),'')
 assert.deepEqual(classificationData(card.body),data)
 assert.deepEqual(parseCardSet(JSON.stringify(exportCardSet([card]))).cards,[card])
})
test('classification rejects missing categories, duplicate IDs and unsafe image/source URLs',()=>{
 for(const value of [{...data,categories:['고생대','고생대']},{...data,items:[data.items[0],data.items[0]]},{...data,items:[{...data.items[0],category:'없는 시대'},data.items[1]]},{...data,items:[{...data.items[0],image:'javascript:alert(1)'},data.items[1]]},{...data,items:[{...data.items[0],source:'javascript:alert(1)'},data.items[1]]}])assert.ok(classificationError(JSON.stringify(value)))
 for(const url of ['//evil.example/a.jpg','/fossils/../secret.jpg','data:image/svg+xml,bad','http://example.com/a.jpg'])assert.equal(safeImageUrl(url),false)
 assert.equal(safeImageUrl('https://example.com/fossil.jpg'),true)
})
test('random order does not mutate specimens or change correct era classification',()=>{
 const round=shuffled(data.items,()=>0)
 assert.deepEqual(data.items.map(i=>i.id),['one','two'])
 assert.deepEqual(round.map(i=>i.id),['two','one'])
 assert.equal(classificationAnswer(round[0],'中生代').correct,false)
 assert.deepEqual(classificationAnswer(round[0],'중생대'),{itemId:'two',chosen:'중생대',correct:true})
})
test('API validates and preserves a classification game across server restart',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{once}=await import('node:events'),{createApp}=await import('../server/app.js')
 const dir=await mkdtemp(join(tmpdir(),'revealcard-classification-')),dataFile=join(dir,'data.json')
 let server,base,cookie=''
 const start=async()=>{server=await createApp({dataFile,distDir:dir});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`}
 const req=(path,method='GET',body)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined})
 try{
  await start();const auth=await req('/api/register','POST',{username:'classification_test',password:'test-classification-2026'});cookie=auth.headers.get('set-cookie').split(';')[0]
  const created=await req('/api/decks','POST',{name:'과학',visibility:'private',cards:[card]});assert.equal(created.status,201);const {id}=await created.json()
  let deck=(await (await req('/api/bootstrap')).json()).decks.find(d=>d.id===id)
  assert.equal(deck.cards[0].kind,'classification');assert.equal(deck.cards[0].body,card.body)
  assert.equal((await req(`/api/decks/${id}/cards/${deck.cards[0].id}`,'PUT',{...card,body:'{}',baseVersion:deck.version})).status,400)
  await new Promise(r=>server.close(r));await start();deck=(await (await req('/api/bootstrap')).json()).decks.find(d=>d.id===id)
  assert.deepEqual(classificationData(deck.cards[0].body),data)
 }finally{if(server?.listening)await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
})
test('science set covers the supplied handout with twenty credited, locally available photos',async()=>{
 const {readFile,stat}=await import('node:fs/promises')
 const game=JSON.parse(await readFile(new URL('../data/science-fossils.json',import.meta.url),'utf8'))
 const content=classificationData(game.body)
 assert.equal(content.items.length,20)
 assert.deepEqual(content.categories,FOSSIL_ERAS)
 assert.deepEqual(content.categories.map(category=>content.items.filter(item=>item.category===category).length),[3,11,3,3])
 for(const item of content.items){
  assert.ok(item.source.startsWith('https://commons.wikimedia.org/wiki/File:'))
  assert.ok(item.credit);assert.ok(item.license)
  assert.ok((await stat(new URL(`../public${item.image}`,import.meta.url))).size>2000)
 }
})
