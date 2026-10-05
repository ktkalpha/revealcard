import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createStore } from '../server/store.js'
import { classificationData } from '../src/lib/classification.js'

// Run while the app using DATA_FILE is stopped, so its in-memory store stays consistent.
const file = process.env.DATA_FILE
const username = process.argv[2]
if (!file || !username) throw new Error('Set DATA_FILE and provide the existing owner username.')
const card = JSON.parse(await readFile(fileURLToPath(new URL('../data/science-fossils.json', import.meta.url)), 'utf8'))
classificationData(card.body)
const store = await createStore(file)
const result = await store.change(data => {
  const owner = data.users.find(user => user.username === username)
  if (!owner) throw new Error('The specified owner does not exist.')
  const existing = data.decks.find(deck => deck.id === 'science-fossils-20261005')
  if (existing && existing.ownerId !== owner.id) throw new Error('The science set belongs to another owner.')
  if (existing) return {created:false,id:existing.id,name:existing.name}
  const deck = {
    id:'science-fossils-20261005', ownerId:owner.id, name:'과학', visibility:'private', version:0,
    cards:[{...card,id:'science-fossil-classification-v1'}],
  }
  data.decks.push(deck)
  data.revisions ||= {}
  data.revisions[deck.id] = [{version:0,name:deck.name,cards:structuredClone(deck.cards),timestamp:new Date().toISOString(),editor:owner.username,action:'initial'}]
  return {created:true,id:deck.id,name:deck.name,specimens:classificationData(card.body).items.length}
})
console.log(JSON.stringify(result))
